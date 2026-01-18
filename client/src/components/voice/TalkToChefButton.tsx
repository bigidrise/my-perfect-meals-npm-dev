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
        onClick={handleOpen}
        className="fixed right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-orange-500/10 border border-orange-400/20 backdrop-blur-xl shadow-[0_0_18px_rgba(251,146,60,0.18)] hover:border-orange-400/35 transition-all"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-4xl leading-none">👨🏿‍🍳</span>
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
