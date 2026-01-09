import React, { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { ttsService } from "@/lib/tts";
import { PRO_TIP_SCRIPT } from "@/components/copilot/scripts/proTipScript";

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
      <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Pro Tip</span>
            <p className="text-sm text-white/80 mt-1">
              Learn how to use the Meal Builder for maximum accuracy.
            </p>
          </div>
          
          <motion.button
            onClick={handleToggle}
            className={`flex items-center justify-center w-14 h-14 rounded-full border-2 backdrop-blur-xl transition-all duration-300 ${
              isPlaying 
                ? "bg-green-900/70 border-green-500/60 shadow-lg shadow-green-500/50"
                : "bg-amber-900/70 border-amber-500/60 shadow-lg shadow-amber-500/50"
            }`}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -2, scale: 1.08 }}
            style={{
              boxShadow: isPlaying
                ? '0 0 25px rgba(34,197,94,0.6), 0 0 45px rgba(34,197,94,0.4)'
                : '0 0 25px rgba(245,158,11,0.6), 0 0 45px rgba(245,158,11,0.4)'
            }}
          >
            <Lightbulb className={`h-7 w-7 ${isPlaying ? "text-green-400" : "text-amber-400"}`} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ProTipCard;
