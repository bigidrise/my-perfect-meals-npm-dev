import { useState } from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import VoiceModeOverlay from "./VoiceModeOverlay";

type VoiceState = "idle" | "speaking" | "listening" | "processing";

interface TalkToChefButtonProps {
  voiceState: VoiceState;
  currentStep: number;
  totalSteps: number;
  lastTranscript: string;
  isPlaying: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function TalkToChefButton({
  voiceState,
  currentStep,
  totalSteps,
  lastTranscript,
  isPlaying,
  onStart,
  onStop,
}: TalkToChefButtonProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  const handleOpen = () => {
    setIsVoiceOpen(true);
  };

  const handleClose = () => {
    onStop();
    setIsVoiceOpen(false);
  };

  const handleStart = () => {
    onStart();
  };

  return (
    <>
      {/* Chef emoji floating button at bottom */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 hover:border-orange-400 backdrop-blur-none transition-all"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        <span className="text-4xl">👨🏿‍🍳</span>
        <Mic className="w-6 h-6 text-orange-400" />
      </motion.button>

      {/* Voice overlay */}
      <VoiceModeOverlay
        isOpen={isVoiceOpen}
        onClose={handleClose}
        voiceState={voiceState}
        currentStep={currentStep}
        totalSteps={totalSteps}
        lastTranscript={lastTranscript}
        isPlaying={isPlaying}
        onStart={handleStart}
      />
    </>
  );
}
