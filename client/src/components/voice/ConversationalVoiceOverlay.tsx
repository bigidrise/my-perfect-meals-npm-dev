import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff } from "lucide-react";
import ChefVoiceAvatar from "@/components/chef/ChefVoiceAvatar";
import type { VoiceState, CollectedData } from "@/voice/VoiceEngine";

interface ConversationalVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  voiceState: VoiceState;
  transcript: string;
  collectedData: CollectedData;
  onStart: () => void;
  onStop: () => void;
  autoStart?: boolean;
}

export default function ConversationalVoiceOverlay({
  isOpen,
  onClose,
  voiceState,
  transcript,
  collectedData,
  onStart,
  onStop,
  autoStart = true,
}: ConversationalVoiceOverlayProps) {
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen && autoStart && voiceState === "idle" && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        onStart();
      }, 400);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen, autoStart, voiceState, onStart]);

  const getStatusText = () => {
    switch (voiceState) {
      case "speaking":
        return "Chef is talking...";
      case "listening":
        return "I'm listening...";
      case "thinking":
        return "Creating your meal...";
      default:
        return "Tap to talk to Chef";
    }
  };

  const getCollectedSummary = () => {
    const items: string[] = [];
    if (collectedData.ingredients.length > 0) {
      items.push(`${collectedData.ingredients.length} ingredient${collectedData.ingredients.length > 1 ? 's' : ''}`);
    }
    if (collectedData.preferences.length > 0) {
      items.push(`${collectedData.preferences.length} preference${collectedData.preferences.length > 1 ? 's' : ''}`);
    }
    if (collectedData.dietaryRules.length > 0) {
      items.push(`${collectedData.dietaryRules.length} dietary rule${collectedData.dietaryRules.length > 1 ? 's' : ''}`);
    }
    return items.length > 0 ? items.join(' • ') : '';
  };

  const handleClose = () => {
    onStop();
    onClose();
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
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ marginTop: "env(safe-area-inset-top, 0px)" }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="flex flex-col items-center gap-6 px-6 max-w-md w-full">
            <ChefVoiceAvatar voiceState={voiceState} />

            <div className="text-center">
              <p className="text-xl font-semibold text-white mb-1">
                {getStatusText()}
              </p>
              {voiceState !== "idle" && (
                <p className="text-sm text-white/60">
                  Just talk naturally — I'll understand
                </p>
              )}
            </div>

            {transcript && voiceState === "listening" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/10 rounded-xl px-4 py-3 max-w-full"
              >
                <p className="text-white/90 text-sm italic text-center">
                  "{transcript}"
                </p>
              </motion.div>
            )}

            {getCollectedSummary() && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-orange-400/80 text-xs text-center"
              >
                Collected: {getCollectedSummary()}
              </motion.div>
            )}

            <div className="flex gap-4 mt-4">
              {voiceState === "idle" && (
                <button
                  onClick={onStart}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                >
                  <Mic className="w-5 h-5" />
                  Start Talking
                </button>
              )}

              {voiceState === "listening" && (
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/80 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  <MicOff className="w-5 h-5" />
                  Stop
                </button>
              )}
            </div>

            <p className="text-white/40 text-xs text-center mt-6 max-w-xs">
              Say things like "I have chicken and rice" or "make it gluten-free" — then say "cook now" when ready
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
