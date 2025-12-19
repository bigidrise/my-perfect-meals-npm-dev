import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useCopilot } from "./CopilotContext";
import { ChefCapIcon } from "./ChefCapIcon";
import { getPageExplanation } from "./CopilotPageExplanations";

export const CopilotButton: React.FC = () => {
  const { toggle, isOpen, open, setLastResponse } = useCopilot();
  const [pathname] = useLocation();

  const handlePress = useCallback(() => {
    if (isOpen) {
      toggle();
      return;
    }

    const normalizedPath = pathname.replace(/\/+$/, '').split('?')[0];
    const explanation = getPageExplanation(normalizedPath);

    if (explanation) {
      setLastResponse({
        title: explanation.title,
        description: explanation.description,
        spokenText: explanation.spokenText,
        autoClose: false,
      });
    }

    open();
  }, [isOpen, toggle, open, setLastResponse, pathname]);

  return (
    <motion.button
      onClick={handlePress}
      className="fixed bottom-16 right-4 z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border-2 border-orange-600/60 backdrop-blur-xl shadow-lg shadow-orange-600/80 hover:shadow-orange-600/100 hover:border-orange-500/100 transition-all duration-300"
      whileTap={{ scale: 0.92 }}
      whileHover={{ y: -2, scale: 1.08 }}
      style={{
        boxShadow: '0 0 35px rgba(234,88,12,0.9), 0 0 55px rgba(249,115,22,0.7), 0 0 75px rgba(249,115,22,0.5)'
      }}
    >
      <ChefCapIcon size={54} />
    </motion.button>
  );
};
