import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface SimpleStepOverlayProps {
  selector: string;
  text?: string;
  showArrow?: boolean;
  onTap: () => void;
}

export function SimpleStepOverlay({ selector, text, showArrow = false, onTap }: SimpleStepOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const element = document.querySelector(selector) as HTMLElement | null;
    
    // Save original styles to restore later
    let originalZIndex = "";
    let originalPosition = "";
    
    const updateTargetRect = () => {
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Elevate target element above the overlay (z-9999)
    if (element) {
      originalZIndex = element.style.zIndex;
      originalPosition = element.style.position;
      element.style.zIndex = "10000";
      element.style.position = "relative";
    }

    updateTargetRect();

    const observer = new MutationObserver(updateTargetRect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      // Restore original styles
      if (element) {
        element.style.zIndex = originalZIndex;
        element.style.position = originalPosition;
      }
      observer.disconnect();
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [selector]);

  if (!targetRect) return null;

  const arrowPosition = {
    top: targetRect.top - 60,
    left: targetRect.left + targetRect.width / 2 - 15,
  };

  // Calculate cutout bounds with padding
  const cutout = {
    top: targetRect.top - 4,
    left: targetRect.left - 4,
    width: targetRect.width + 8,
    height: targetRect.height + 8,
    bottom: targetRect.top + targetRect.height + 4,
    right: targetRect.left + targetRect.width + 4,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-none"
      >
        {/* 4 overlay panels around the target - tap to advance */}
        {/* Top panel */}
        <div
          className="absolute bg-black/50 pointer-events-auto cursor-pointer"
          style={{ top: 0, left: 0, right: 0, height: cutout.top }}
          onClick={onTap}
        />
        {/* Bottom panel */}
        <div
          className="absolute bg-black/50 pointer-events-auto cursor-pointer"
          style={{ top: cutout.bottom, left: 0, right: 0, bottom: 0 }}
          onClick={onTap}
        />
        {/* Left panel */}
        <div
          className="absolute bg-black/50 pointer-events-auto cursor-pointer"
          style={{ top: cutout.top, left: 0, width: cutout.left, height: cutout.height }}
          onClick={onTap}
        />
        {/* Right panel */}
        <div
          className="absolute bg-black/50 pointer-events-auto cursor-pointer"
          style={{ top: cutout.top, left: cutout.right, right: 0, height: cutout.height }}
          onClick={onTap}
        />

        {/* Highlight border around target - pointer-events-none so clicks go through */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            boxShadow: "0 0 20px 4px rgba(249, 115, 22, 0.6)",
            borderRadius: "12px",
            border: "3px solid rgba(249, 115, 22, 0.9)",
          }}
        />

        {/* Optional animated arrow - points DOWN toward the element */}
        {showArrow && (
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: arrowPosition.top,
              left: arrowPosition.left,
            }}
            animate={{
              y: [0, 10, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path
                d="M15 5 L15 25 M15 25 L10 20 M15 25 L20 20"
                stroke="rgba(249, 115, 22, 0.9)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}

        {/* Step text with Next button - Orange/Black gradient */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs"
          style={{
            top: targetRect.bottom + 12,
            left: Math.max(12, Math.min(targetRect.left, window.innerWidth - 280)),
            pointerEvents: "auto",
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #f97316 100%)",
            border: "1px solid rgba(249, 115, 22, 0.5)",
          }}
        >
          {text && <p className="mb-2">{text}</p>}
          <button
            onClick={onTap}
            className="w-full font-semibold py-2 px-4 rounded-md transition-colors"
            style={{
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              color: "white",
            }}
          >
            Next →
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
