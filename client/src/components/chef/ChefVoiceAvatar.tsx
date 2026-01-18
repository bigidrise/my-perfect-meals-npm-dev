import clsx from "clsx";
import { motion } from "framer-motion";
import type { VoiceState } from "@/voice/VoiceSessionController";

interface ChefVoiceAvatarProps {
  voiceState: VoiceState;
  size?: number;
}

export default function ChefVoiceAvatar({ voiceState, size = 64 }: ChefVoiceAvatarProps) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Glow ring for speaking state */}
      {voiceState === "speaking" && (
        <motion.div
          className="absolute rounded-full bg-orange-500/30"
          style={{
            width: size + 24,
            height: size + 24,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Listening pulse ring */}
      {voiceState === "listening" && (
        <motion.div
          className="absolute rounded-full border-2 border-lime-400/60"
          style={{
            width: size + 16,
            height: size + 16,
          }}
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
          className="absolute rounded-full bg-amber-400/20"
          style={{
            width: size + 12,
            height: size + 12,
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Chef emoji icon */}
      <motion.div
        className={clsx(
          "relative z-10 flex items-center justify-center rounded-full",
          {
            "opacity-60": voiceState === "idle",
          }
        )}
        style={{ width: size, height: size }}
        animate={
          voiceState === "speaking"
            ? { scale: [1, 1.05, 1] }
            : voiceState === "listening"
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={{
          duration: voiceState === "speaking" ? 0.4 : 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <span
          style={{
            fontSize: size * 0.85,
            lineHeight: 1,
          }}
        >
          👨🏿‍🍳
        </span>
      </motion.div>
    </div>
  );
}
