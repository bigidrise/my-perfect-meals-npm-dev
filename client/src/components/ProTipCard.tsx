import React, { useState, useCallback, useRef } from "react";
import { ttsService } from "@/lib/tts";
import { PRO_TIP_SCRIPT } from "@/components/copilot/scripts/proTipScript";
import { PillButton } from "@/components/ui/pill-button";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";

type PlayState = "idle" | "loading" | "playing" | "paused";

export const ProTipCard: React.FC = () => {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const attachAudioHandlers = useCallback((audio: HTMLAudioElement, url: string) => {
    audio.onended = () => {
      cleanupAudio();
      setPlayState("idle");
    };
    audio.onerror = () => {
      cleanupAudio();
      setPlayState("idle");
    };
  }, [cleanupAudio]);

  const handleListen = useCallback(async () => {
    setPlayState("loading");
    try {
      ttsService.stop();
      const result = await ttsService.speak(PRO_TIP_SCRIPT, {
        onEnd: () => setPlayState("idle"),
        onError: () => setPlayState("idle"),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = result.audioUrl;
        attachAudioHandlers(audio, result.audioUrl);
        await audio.play();
        setPlayState("playing");
      } else {
        setPlayState("playing");
      }
    } catch {
      setPlayState("idle");
    }
  }, [attachAudioHandlers]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
    }
    setPlayState("paused");
  }, []);

  const handleResume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => setPlayState("idle"));
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
    }
    setPlayState("playing");
  }, []);

  const handleStartOver = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setPlayState("playing");
    } else {
      cleanupAudio();
      ttsService.stop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      await handleListen();
    }
  }, [cleanupAudio, handleListen]);

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

              {(playState === "playing" || playState === "paused") && (
                <div className="flex items-center gap-2 mt-3">
                  {playState === "playing" ? (
                    <PillButton onClick={handlePause} active className="flex items-center gap-1.5">
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </PillButton>
                  ) : (
                    <PillButton onClick={handleResume} active className="flex items-center gap-1.5">
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
              {playState === "idle" && (
                <PillButton onClick={handleListen}>
                  Listen
                </PillButton>
              )}
              {playState === "loading" && (
                <PillButton active className="flex items-center gap-1.5 opacity-70 cursor-not-allowed">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </PillButton>
              )}
              {(playState === "playing" || playState === "paused") && (
                <PillButton
                  onClick={() => {
                    cleanupAudio();
                    ttsService.stop();
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                    setPlayState("idle");
                  }}
                >
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
