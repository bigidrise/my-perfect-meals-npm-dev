import React, { useState, useCallback } from "react";
import { PRO_TIP_SECTIONS } from "@/components/copilot/scripts/proTipScript";
import { useNarration } from "@/hooks/useNarration";
import { PillButton } from "@/components/ui/pill-button";
import { Play, Pause, RotateCcw } from "lucide-react";

export const ProTipCard: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);

  const {
    isPlaying,
    currentSectionIndex,
    totalSections,
    play,
    pause,
    resume,
    stop,
    reset,
  } = useNarration(PRO_TIP_SECTIONS, {
    onEnd: () => setHasStarted(false),
  });

  const isActive = hasStarted;

  const handleListen = () => {
    setHasStarted(true);
    play();
  };

  const handleStop = () => {
    stop();
    setHasStarted(false);
  };

  const handleStartOver = useCallback(() => {
    reset();
    setHasStarted(true);
    setTimeout(() => play(), 50);
  }, [reset, play]);

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

                {isActive && (
                  <span className="text-xs text-white/35">
                    {currentSectionIndex + 1} / {totalSections}
                  </span>
                )}
              </div>

              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
                {isActive
                  ? PRO_TIP_SECTIONS[currentSectionIndex]?.heading
                  : "Learn how to use the Meal Builder for maximum accuracy."}
              </p>

              {isActive && (
                <div className="flex items-center gap-2 mt-3">
                  {isPlaying ? (
                    <PillButton onClick={pause} active className="flex items-center gap-1.5">
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </PillButton>
                  ) : (
                    <PillButton onClick={resume} active className="flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </PillButton>
                  )}
                  <PillButton onClick={handleStartOver} className="flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Start Over
                  </PillButton>
                </div>
              )}
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
              {!isActive ? (
                <PillButton onClick={handleListen}>
                  Listen
                </PillButton>
              ) : (
                <PillButton onClick={handleStop}>
                  Stop
                </PillButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProTipCard;
