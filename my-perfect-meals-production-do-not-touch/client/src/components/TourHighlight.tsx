
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface TourHighlightProps {
  active: boolean;
  children: React.ReactNode;
  message?: string;
  position?: "top" | "bottom" | "left" | "right";
  onComplete?: () => void;
  duration?: number;
}

export default function TourHighlight({
  active,
  children,
  message,
  position = "bottom",
  onComplete,
  duration = 8000
}: TourHighlightProps) {
  const [show, setShow] = useState(active);

  useEffect(() => {
    if (active) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [active, duration, onComplete]);

  const messagePositions = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2"
  };

  return (
    <div className="relative">
      {show && (
        <>
          {/* Pulsing ring */}
          <motion.div
            className="absolute inset-0 rounded-xl ring-4 ring-white/60 pointer-events-none z-10"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Message tooltip */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: position === "bottom" ? -10 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`absolute ${messagePositions[position]} left-1/2 -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap z-20 backdrop-blur-md border border-white/20`}
            >
              <div className="flex items-center gap-2">
                <span>👉</span>
                <span>{message}</span>
              </div>
            </motion.div>
          )}
        </>
      )}
      {children}
    </div>
  );
}
