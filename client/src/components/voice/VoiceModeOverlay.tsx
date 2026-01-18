import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic } from "lucide-react";
import ChefVoiceAvatar from "@/components/chef/ChefVoiceAvatar";

type VoiceState = "idle" | "speaking" | "listening" | "processing";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  voiceState: VoiceState;
  currentStep: number;
  totalSteps: number;
  lastTranscript: string;
  isPlaying: boolean;
  onStart: () => Promise<boolean> | void;
  autoStart?: boolean;
}

export default function VoiceModeOverlay({
  isOpen,
  onClose,
  voiceState,
  currentStep,
  totalSteps,
  lastTranscript,
  isPlaying,
  onStart,
  autoStart = true,
}: VoiceModeOverlayProps) {
  const hasAutoStartedRef = useRef(false);

  // Auto-start voice mode when overlay opens (true hands-free)
  useEffect(() => {
    if (isOpen && autoStart && voiceState === "idle" && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Small delay to let animation complete
      const timer = setTimeout(async () => {
        const result = await onStart();
        // If permission denied, reset so user can retry with button
        if (result === false) {
          hasAutoStartedRef.current = false;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen, autoStart, voiceState, onStart]);

  const getStatusText = () => {
    switch (voiceState) {
      case "speaking":
        return "Chef is speaking...";
      case "listening":
        return "Listening...";
      case "processing":
        return "Processing...";
      default:
        return "Tap to start hands-free mode";
    }
  };

  const getStepLabel = () => {
    if (voiceState === "idle") return "";
    return `Step ${currentStep + 1} of ${totalSteps}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Step indicator */}
          {voiceState !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-20 left-0 right-0 flex flex-col items-center gap-2"
            >
              <p className="text-orange-400 text-sm font-medium">{getStepLabel()}</p>
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-1 rounded-full transition-colors ${
                      i <= currentStep ? "bg-orange-500" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Chef Avatar - center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <ChefVoiceAvatar
              voiceState={voiceState === "speaking" ? "speaking" : voiceState === "listening" ? "listening" : "idle"}
              onClick={voiceState === "idle" ? onStart : undefined}
            />

            {/* Status text */}
            <motion.p
              key={voiceState}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/80 text-lg font-medium text-center"
            >
              {getStatusText()}
            </motion.p>

            {/* Last transcript */}
            {lastTranscript && (voiceState === "processing" || voiceState === "speaking") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-sm text-center px-4 py-3 bg-white/10 rounded-xl"
              >
                <p className="text-white/50 text-xs mb-1">You said:</p>
                <p className="text-white text-base">"{lastTranscript}"</p>
              </motion.div>
            )}

            {/* Start button (only when idle) */}
            {voiceState === "idle" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={onStart}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold shadow-lg hover:shadow-orange-500/50 transition-all"
              >
                <Mic className="w-5 h-5" />
                Start Hands-Free
              </motion.button>
            )}

            {/* End button (when active) */}
            {voiceState !== "idle" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="px-6 py-3 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Exit Voice Mode
              </motion.button>
            )}
          </div>

          {/* Hint at bottom */}
          <div className="pb-8 text-center px-4">
            <p className="text-orange-400/80 text-sm font-medium mb-1">
              Hands-Free Mode
            </p>
            <p className="text-white/40 text-xs">
              Chef will guide you through each step by voice
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
