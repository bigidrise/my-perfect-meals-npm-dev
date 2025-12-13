import { useCallback, useEffect, useRef, useState } from "react";

type SfxMap = Record<string, string>;

type Options = {
  musicUrl: string;
  sfx: SfxMap;
  musicVolume?: number; // 0..1
  sfxVolume?: number;   // 0..1
};

const LS_MUSIC = "fitbrain_music_enabled";
const LS_SFX   = "fitbrain_sfx_enabled";

export function useAudioEngine(opts: Options) {
  const { musicUrl, sfx, musicVolume = 0.4, sfxVolume = 0.9 } = opts;

  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    const v = localStorage.getItem(LS_MUSIC);
    return v ? v === "1" : true;
  });
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    const v = localStorage.getItem(LS_SFX);
    return v ? v === "1" : true;
  });

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = new Audio(musicUrl);
    el.loop = true;
    el.preload = "auto";
    el.volume = musicVolume;
    musicRef.current = el;
    readyRef.current = true;
    setReady(true);
    return () => {
      try { el.pause(); } catch {}
      musicRef.current = null;
    };
  }, [musicUrl, musicVolume]);

  useEffect(() => { localStorage.setItem(LS_MUSIC, musicEnabled ? "1" : "0"); }, [musicEnabled]);
  useEffect(() => { localStorage.setItem(LS_SFX,   sfxEnabled ? "1" : "0"); }, [sfxEnabled]);

  const startMusic = useCallback(async () => {
    if (!musicRef.current) return;
    if (!musicEnabled) return;
    try {
      await musicRef.current.play();
    } catch {
      // playback may fail if not triggered by gesture
    }
  }, [musicEnabled]);

  const stopMusic = useCallback(() => {
    if (!musicRef.current) return;
    try { musicRef.current.pause(); } catch {}
    try { musicRef.current.currentTime = 0; } catch {}
  }, []);

  const playSfx = useCallback((name: string) => {
    if (!sfxEnabled) return;
    const src = sfx[name];
    if (!src) return;
    try {
      const fx = new Audio(src);
      fx.volume = sfxVolume;
      fx.play().catch(() => {});
    } catch {}
  }, [sfx, sfxEnabled, sfxVolume]);

  return {
    musicEnabled, setMusicEnabled,
    sfxEnabled, setSfxEnabled,
    startMusic, stopMusic, playSfx,
    ready
  };
}
