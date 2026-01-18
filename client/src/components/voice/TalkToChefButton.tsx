import { useState } from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import VoiceModeOverlay from "./VoiceModeOverlay";

interface TalkToChefButtonProps {
  onTranscript?: (text: string) => void;
}

export default function TalkToChefButton({ onTranscript }: TalkToChefButtonProps) {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsVoiceOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-shadow"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
      >
        <Mic className="w-5 h-5" />
        <span className="text-sm">Talk to Chef</span>
      </motion.button>

      {/* Voice overlay */}
      <VoiceModeOverlay
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onTranscript={onTranscript}
      />
    </>
  );
}
