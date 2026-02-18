import clsx from "clsx";
import { motion } from "framer-motion";
import type { VoiceState } from "@/voice/VoiceSessionController";
import ChefEmojiButton from "./ChefEmojiButton";

interface ChefVoiceAvatarProps {
  voiceState: VoiceState;
  onClick?: () => void;
}

export default function ChefVoiceAvatar({ voiceState, onClick }: ChefVoiceAvatarProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow ring when speaking */}
      {voiceState === "speaking" && (
        <motion.div
          className="absolute inset-0 rounded-full bg-orange-500/30 blur-xl"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        />
      )}

      {/* Listening pulse ring */}
      {voiceState === "listening" && (
        <motion.div
          className="absolute -inset-2 rounded-full border-2 border-lime-400/60"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.8, 0.3, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Thinking subtle glow */}
      {voiceState === "thinking" && (
        <motion.div
          className="absolute -inset-1 rounded-full bg-amber-400/20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.div
        className={clsx({
          "opacity-70": voiceState === "idle",
        })}
        animate={
          voiceState === "speaking"
            ? { scale: [1, 1.05, 1] }
            : voiceState === "thinking"
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={{ repeat: Infinity, duration: 0.8 }}
      >
        <ChefEmojiButton onClick={onClick} size={72} />
      </motion.div>
    </div>
  );
}
