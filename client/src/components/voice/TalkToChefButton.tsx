import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AudioWaveform } from "lucide-react";
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

const HINT_STORAGE_KEY = "mpm_chef_voice_hint_seen";

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
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem(HINT_STORAGE_KEY);
    if (!hasSeenHint) {
      setShowHint(true);
      const timer = setTimeout(() => {
        setShowHint(false);
        localStorage.setItem(HINT_STORAGE_KEY, "true");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOpen = () => {
    setShowHint(false);
    localStorage.setItem(HINT_STORAGE_KEY, "true");
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
      {/* Auto-fading hint text */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="fixed right-4 z-40 text-xs text-white/80"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 145px)" }}
          >
            <div className="px-2 py-1 rounded-full bg-black/50 backdrop-blur-md whitespace-nowrap">
              Talk it out — tap the Chef for hands-free
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chef emoji floating button at bottom */}
      <button
        onClick={handleOpen}
        className="fixed right-4 z-50 flex flex-col items-center select-none touch-manipulation"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        <div className="flex items-center gap-1">
          <img 
            src="/icons/chef.png?v=2026c" 
            alt="Chef" 
            className="w-12 h-12 object-contain"
          />
          <Mic className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <AudioWaveform className="w-4 h-4 text-orange-400" />
          <span className="text-[10px] text-orange-400 font-medium">Hands-Free</span>
        </div>
      </button>

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
