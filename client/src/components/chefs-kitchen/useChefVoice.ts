import { useRef, useCallback } from "react";
import { ttsService } from "@/lib/tts";

export function useChefVoice(
  setIsPlaying: (v: boolean) => void
) {
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const genRef    = useRef(0); // increments on every speak() call

  const speak = useCallback(
    async (text: string, onListened?: () => void): Promise<void> => {
      // Stop any audio that is already playing / loading
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }

      // Capture this call's generation. If a newer call arrives while we are
      // awaiting the network, we will bail out and not play stale audio.
      const myGen = ++genRef.current;

      setIsPlaying(true);

      // Unlock the UI step immediately — don't wait for slow TTS response
      onListened?.();

      try {
        const result = await ttsService.speak(text, {
          onStart: () => { if (genRef.current === myGen) setIsPlaying(true); },
          onEnd:   () => { if (genRef.current === myGen) setIsPlaying(false); },
          onError: () => { if (genRef.current === myGen) setIsPlaying(false); },
        });

        // A newer speak() call arrived while we were fetching — discard silently
        if (genRef.current !== myGen) {
          if (result.audioUrl) URL.revokeObjectURL(result.audioUrl);
          return;
        }

        if (result.audioUrl) {
          const audio = new Audio(result.audioUrl);
          audioRef.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              if (genRef.current === myGen) setIsPlaying(false);
              URL.revokeObjectURL(result.audioUrl!);
              audioRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              if (genRef.current === myGen) setIsPlaying(false);
              URL.revokeObjectURL(result.audioUrl!);
              audioRef.current = null;
              reject(new Error("Audio playback failed"));
            };
            audio.play().catch(reject);
          });
        }
      } catch {
        if (genRef.current === myGen) setIsPlaying(false);
      }
    },
    [setIsPlaying]
  );

  const stop = useCallback(() => {
    genRef.current++; // invalidate any in-flight fetch
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, [setIsPlaying]);

  return { speak, stop, audioRef };
}
