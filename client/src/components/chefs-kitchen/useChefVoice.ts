import { useRef, useCallback } from "react";
import { ttsService } from "@/lib/tts";

export function useChefVoice(
  setIsPlaying: (v: boolean) => void
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(
    async (text: string, onListened?: () => void) => {
      setIsPlaying(true);

      try {
        ttsService.stop();
        const result = await ttsService.speak(text, {
          onStart: () => {
            setIsPlaying(true);
            onListened?.();
          },
          onEnd: () => setIsPlaying(false),
          onError: () => setIsPlaying(false),
        });

        if (result.audioUrl) {
          const audio = new Audio(result.audioUrl);
          audioRef.current = audio;
          audio.onended = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(result.audioUrl!);
          };
          audio.onerror = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(result.audioUrl!);
          };
          await audio.play();
        }
      } catch {
        setIsPlaying(false);
        onListened?.();
      }
    },
    [setIsPlaying]
  );

  return { speak, audioRef };
}
