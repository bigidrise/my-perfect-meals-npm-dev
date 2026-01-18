import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic } from "lucide-react";
import { VoiceSessionController, VoiceState } from "@/voice/VoiceSessionController";
import ChefVoiceAvatar from "@/components/chef/ChefVoiceAvatar";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript?: (text: string) => void;
}

export default function VoiceModeOverlay({ isOpen, onClose, onTranscript }: VoiceModeOverlayProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [lastTranscript, setLastTranscript] = useState("");

  const controllerRef = useRef<VoiceSessionController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new VoiceSessionController({
      onStateChange: setVoiceState,
      onTranscript: (text) => {
        setLastTranscript(text);
        onTranscript?.(text);
      },
    });
  }

  const controller = controllerRef.current;

  const handleStartVoice = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      controller.startVoiceMode();
    } catch (err) {
      console.error("Microphone permission denied:", err);
    }
  };

  const handleClose = () => {
    controller.stopVoiceMode();
    setVoiceState("idle");
    onClose();
  };

  const getStatusText = () => {
    switch (voiceState) {
      case "listening":
        return "Listening...";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Chef is speaking...";
      default:
        return "Tap the Chef to talk";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Chef Avatar */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <ChefVoiceAvatar 
              voiceState={voiceState} 
              onClick={voiceState === "idle" ? handleStartVoice : undefined}
            />

            {/* Status text */}
            <motion.p
              key={voiceState}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/80 text-lg font-medium"
            >
              {getStatusText()}
            </motion.p>

            {/* Last transcript */}
            {lastTranscript && voiceState === "thinking" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xs text-center px-4 py-2 bg-white/10 rounded-xl"
              >
                <p className="text-white/60 text-sm">You said:</p>
                <p className="text-white text-base">{lastTranscript}</p>
              </motion.div>
            )}

            {/* Start button (only when idle) */}
            {voiceState === "idle" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleStartVoice}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold shadow-lg hover:shadow-orange-500/50 transition-all"
              >
                <Mic className="w-5 h-5" />
                Start Talking
              </motion.button>
            )}

            {/* End button (when active) */}
            {voiceState !== "idle" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleClose}
                className="px-6 py-3 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                End Voice Mode
              </motion.button>
            )}
          </div>

          {/* Hint at bottom */}
          <p className="text-white/40 text-xs mb-8">
            Voice works in Chrome, Edge, and Safari
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
