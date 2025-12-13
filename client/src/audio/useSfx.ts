import React from "react";
import { useAudioCtx } from "./AudioProvider";
import type { SoundKey } from "./sounds";

export function useSfx() {
  const { playOnce } = useAudioCtx();
  const lastPlayedAt = React.useRef<Record<string, number>>({});

  const play = React.useCallback((key: Exclude<SoundKey,"music">, opts?: { volume?: number; cooldownMs?: number }) => {
    const now = performance.now();
    const cd = opts?.cooldownMs ?? 150;
    const last = lastPlayedAt.current[key] || 0;
    if (now - last < cd) return;
    lastPlayedAt.current[key] = now;
    playOnce(key, { volume: opts?.volume });
  }, [playOnce]);

  return { play };
}
