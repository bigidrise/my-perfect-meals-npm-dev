import React from "react";
import { SOUND_URLS, SoundKey } from "./sounds";

type Ctx = {
  muted: boolean;
  setMuted: (v: boolean) => void;
  autoPause: boolean;
  setAutoPause: (v: boolean) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  ensureUserGestureUnlocked: () => void;
  playOnce: (key: Exclude<SoundKey,"music">, opts?: { volume?: number }) => void;
  startMusic: () => Promise<void>;
  pauseMusic: () => void;
  resumeMusic: () => void;
  stopMusic: () => void;
};

const AudioCtx = React.createContext<Ctx | null>(null);
export const useAudioCtx = () => {
  const c = React.useContext(AudioCtx);
  if (!c) throw new Error("AudioProvider missing");
  return c;
};

function createLoopingAudio(src: string) {
  const a = new Audio(src);
  a.loop = true;
  a.preload = "auto";
  a.crossOrigin = "anonymous";
  return a;
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [muted, setMutedState] = React.useState<boolean>(() => localStorage.getItem("mpm.muted") === "1");
  const [autoPause, setAutoPauseState] = React.useState<boolean>(() => localStorage.getItem("mpm.autoPause") !== "0");
  const [musicVolume, setMusicVolumeState] = React.useState<number>(() => {
    const v = Number(localStorage.getItem("mpm.musicVol"));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.4;
  });

  const setMuted = (v: boolean) => { setMutedState(v); localStorage.setItem("mpm.muted", v ? "1" : "0"); };
  const setAutoPause = (v: boolean) => { setAutoPauseState(v); localStorage.setItem("mpm.autoPause", v ? "1" : "0"); };
  const setMusicVolume = (v: number) => { const clamped = Math.max(0, Math.min(1, v)); setMusicVolumeState(clamped); localStorage.setItem("mpm.musicVol", String(clamped)); };

  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  if (!musicRef.current) musicRef.current = createLoopingAudio(SOUND_URLS.music);

  React.useEffect(() => {
    const m = musicRef.current!;
    m.volume = muted ? 0 : musicVolume;
  }, [muted, musicVolume]);

  React.useEffect(() => {
    if (!autoPause) return;
    let wasPlaying = false;
    const onBlur = () => { 
      wasPlaying = !musicRef.current?.paused;
      musicRef.current?.pause(); 
    };
    const onFocus = () => { 
      if (!muted && wasPlaying) musicRef.current?.play().catch(()=>{}); 
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onBlur();
      else onFocus();
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [autoPause, muted]);

  const unlockedRef = React.useRef(false);
  const ensureUserGestureUnlocked = React.useCallback(() => {
    if (unlockedRef.current) return;
    const m = musicRef.current!;
    m.play().then(() => {
      m.pause();
      unlockedRef.current = true;
    }).catch(() => {
    });
  }, []);

  const playOnce = (key: Exclude<SoundKey,"music">, opts?: { volume?: number }) => {
    if (muted) return;
    const url = SOUND_URLS[key];
    if (!url) return console.warn("[audio] missing URL for", key);
    const a = new Audio(url);
    a.preload = "auto";
    a.volume = Math.max(0, Math.min(1, opts?.volume ?? 1));
    a.play().catch(()=>{ });
  };

  const startMusic = async () => {
    const m = musicRef.current!;
    try {
      if (muted) return;
      m.currentTime = 0;
      await m.play();
    } catch (e) {
    }
  };
  const pauseMusic = () => { musicRef.current?.pause(); };
  const resumeMusic = () => { if (!muted) musicRef.current?.play().catch(()=>{}); };
  const stopMusic = () => { const m = musicRef.current!; m.pause(); m.currentTime = 0; };

  const value: Ctx = {
    muted, setMuted,
    autoPause, setAutoPause,
    musicVolume, setMusicVolume,
    ensureUserGestureUnlocked,
    playOnce, startMusic, pauseMusic, resumeMusic, stopMusic,
  };
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
};
