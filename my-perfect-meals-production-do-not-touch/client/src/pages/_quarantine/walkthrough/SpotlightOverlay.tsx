import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { WalkthroughControls } from "./walkthrough/WalkthroughControls";

export interface SpotlightStep {
  target: string; // CSS selector or data attribute
  instruction: string; // Short 1-2 sentence instruction
  action?: "click" | "input" | "change" | "blur"; // Action type for auto-advance
}

interface SpotlightOverlayProps {
  currentStep: SpotlightStep | null;
  onAdvance: () => void;
  onExit: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onSkip?: () => void;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  currentStep,
  onAdvance,
  onExit,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onSkip,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Update spotlight position when target element changes
  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(currentStep.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);

        // Scroll element into view
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      } else {
        setTargetRect(null);
      }
    };

    // Initial position
    updatePosition();

    // Track element position changes
    const element = document.querySelector(currentStep.target);
    if (element) {
      resizeObserverRef.current = new ResizeObserver(updatePosition);
      resizeObserverRef.current.observe(element);
    }

    // Track window resize/scroll
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [currentStep]);

  // Setup action listener for auto-advance
  useEffect(() => {
    if (!currentStep || !targetRect) return;

    const actionType = currentStep.action;
    if (!actionType) return;

    const element = document.querySelector(currentStep.target);
    if (!element) return;

    const handleAction = () => {
      onAdvance();
    };

    element.addEventListener(actionType, handleAction);

    return () => {
      element.removeEventListener(actionType, handleAction);
    };
  }, [currentStep, targetRect, onAdvance]);


  if (!currentStep) return null;

  const overlay = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{
          background: "rgba(0, 0, 0, 0.45)",
        }}
      >
        {/* Exit button */}
        <button
          onClick={onExit}
          className="absolute top-4 right-4 z-[10001] p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors pointer-events-auto"
          aria-label="Exit walkthrough"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Spotlight highlight */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute pointer-events-auto"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              border: "2px solid var(--accent-color, #10b981)",
              borderRadius: "8px",
              boxShadow:
                "0 0 0 4px rgba(16, 185, 129, 0.2), 0 0 20px rgba(16, 185, 129, 0.6)",
              background: "transparent",
            }}
          />
        )}

        {/* Instruction card */}
        <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pointer-events-auto w-full max-w-md"
          >
            <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-4 shadow-2xl">
              <p className="text-white text-sm leading-relaxed mb-3">
                {currentStep.instruction}
              </p>

              {/* Manual navigation controls - always visible for Apple App Store reliability */}
              <WalkthroughControls
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
                onPrevious={onPrevious}
                onNext={onAdvance}
                onSkip={onSkip}
              />
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2), 0 0 20px rgba(16, 185, 129, 0.6);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.3), 0 0 30px rgba(16, 185, 129, 0.8);
            }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
};
