import { useCallback } from "react";

/** Founder-requested calculator narration pause. No synthesis, preload or microphone calls. */
export function useCalculatorVoice(setIsPlaying?: (playing: boolean) => void) {
  const speak = useCallback(async (_text: string, onComplete?: () => void) => {
    setIsPlaying?.(false);
    // Written guidance and wizard progression must not depend on audio.
    onComplete?.();
  }, [setIsPlaying]);
  const stop = useCallback(() => { setIsPlaying?.(false); }, [setIsPlaying]);
  const preload = useCallback(async () => {}, []);
  return { speak, stop, preload };
}
