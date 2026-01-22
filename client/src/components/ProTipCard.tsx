import React, { useState, useCallback, useRef } from "react";
import { ttsService } from "@/lib/tts";
import { PRO_TIP_SCRIPT } from "@/components/copilot/scripts/proTipScript";
import { PillButton } from "@/components/ui/pill-button";

export const ProTipCard: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggle = useCallback(async () => {
    if (isPlaying) {
      ttsService.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    try {
      const result = await ttsService.speak(PRO_TIP_SCRIPT, {
        onStart: () => setIsPlaying(true),
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
    }
  }, [isPlaying]);

  return (
    <div className="col-span-full">
      <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Pro Tip
            </span>
            <p className="text-sm text-white/80 mt-1">
              Learn how to use the Meal Builder for maximum accuracy.
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">👨🏿‍🍳</span>
            <PillButton
              onClick={handleToggle}
              active={isPlaying}
            >
              {isPlaying ? "Stop" : "Listen"}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProTipCard;
