import React from "react";
import { useAudioCtx } from "./AudioProvider";
import { useSfx } from "./useSfx";

export function AudioTestPanel() {
  const { muted, setMuted, musicVolume, setMusicVolume, autoPause, setAutoPause, startMusic, pauseMusic, resumeMusic, stopMusic, ensureUserGestureUnlocked } = useAudioCtx();
  const { play } = useSfx();

  React.useEffect(() => {
    ensureUserGestureUnlocked();
  }, [ensureUserGestureUnlocked]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
      <div className="text-sm font-semibold">Audio Test</div>
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => startMusic()}>Start Music</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => pauseMusic()}>Pause</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => resumeMusic()}>Resume</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => stopMusic()}>Stop</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm opacity-80">Music Volume</label>
        <input type="range" min={0} max={1} step={0.01} value={musicVolume} onChange={e => setMusicVolume(Number(e.target.value))} />
        <span className="text-xs opacity-70">{Math.round(musicVolume * 100)}%</span>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} />
          Mute all
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={autoPause} onChange={e => setAutoPause(e.target.checked)} />
          Auto-pause on tab blur
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => play("correct")}>Play Correct</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => play("wrong")}>Play Wrong</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => play("streak",{ cooldownMs: 400 })}>Play Streak</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => play("roundWin",{ volume: 0.9 })}>Play Round Win</button>
        <button className="px-3 py-1 rounded bg-white/10" onClick={() => play("finalFanfare",{ volume: 1 })}>Play Final Fanfare</button>
      </div>
      <div className="text-xs opacity-60">
        Files load from <code>/sounds/*.mp3</code>. If a file is missing, you'll see a console warning.
      </div>
    </div>
  );
}
