import { motion } from "framer-motion";

type Props = {
  onClick?: () => void;
  animate?: boolean;
};

export default function ChefEmojiButton({ onClick, animate = true }: Props) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-all duration-300"
      whileTap={animate ? { scale: 0.92 } : undefined}
      whileHover={animate ? { y: -2, scale: 1.08 } : undefined}
      style={{
        boxShadow:
          "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
      }}
      aria-label="Chef"
    >
      <span className="text-5xl leading-none">👨🏿‍🍳</span>
    </motion.button>
  );
}
