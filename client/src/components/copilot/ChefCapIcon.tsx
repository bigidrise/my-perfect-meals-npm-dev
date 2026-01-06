import React from "react";
import { motion } from "framer-motion";

interface ChefCapIconProps {
  size?: number;
  glow?: boolean;
}

export const ChefCapIcon: React.FC<ChefCapIconProps> = ({
  size = 32,
  glow = true,
}) => {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* CHEF EMOJI - INSTANTLY RECOGNIZABLE */}
      <span
        className="relative z-10"
        style={{
          fontSize: size * 0.85,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        👨🏿‍🍳
      </span>

      {/* Subtle glow effect */}
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-full bg-orange-400/30"
          animate={{
            boxShadow: [
              "0 0 10px rgba(251,146,60,0.5), 0 0 20px rgba(251,146,60,0.5)",
              "0 0 18px rgba(251,146,60,0.7), 0 0 30px rgba(251,146,60,0.5), 0 0 40px rgba(251,146,60,0.35)",
              "0 0 10px rgba(251,146,60,0.5), 0 0 20px rgba(251,146,60,0.4)",
            ],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.div>
  );
};
