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
      <div
        className="rounded-2xl p-px mb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.7) 0%, rgba(245,158,11,0.3) 40%, rgba(251,191,36,0.5) 100%)",
          boxShadow: "0 0 18px 2px rgba(251,191,36,0.18), 0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="rounded-2xl p-4 backdrop-blur-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(30,20,0,0.85) 0%, rgba(20,15,0,0.92) 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.15) 100%)",
                    color: "#fbbf24",
                    border: "1px solid rgba(251,191,36,0.4)",
                    letterSpacing: "0.12em",
                    textShadow: "0 0 8px rgba(251,191,36,0.6)",
                  }}
                >
                  ★ Pro Tip
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
                Learn how to use the Meal Builder for maximum accuracy.
              </p>
            </div>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className="rounded-full overflow-hidden"
                style={{
                  width: 36,
                  height: 36,
                  backgroundImage: "url(/icons/chef.png?v=2026c)",
                  backgroundSize: "130%",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  boxShadow: "0 0 8px rgba(251,191,36,0.35)",
                }}
              />
              <PillButton onClick={handleToggle} active={isPlaying}>
                {isPlaying ? "Stop" : "Listen"}
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProTipCard;
