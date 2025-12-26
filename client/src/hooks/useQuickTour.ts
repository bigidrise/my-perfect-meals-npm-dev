import { useState, useEffect, useCallback, useRef } from "react";

interface QuickTourState {
  shouldShow: boolean;
  hasSeenTour: boolean;
  openTour: () => void;
  closeTour: (dontShowAgain: boolean) => void;
}

/**
 * Helper to check localStorage for tour seen status
 */
function checkIfSeen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === "seen";
  } catch {
    return false;
  }
}

export function useQuickTour(pageKey: string): QuickTourState {
  const storageKey = `quick-tour::${pageKey}`;
  
  // Use ref to track if we've already auto-opened this session
  const hasAutoOpenedRef = useRef(false);
  
  // Always read fresh from localStorage on mount
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(() => checkIfSeen(storageKey));
  const [isOpen, setIsOpen] = useState(false);

  // Re-check localStorage on mount (handles React strict mode double-mount)
  useEffect(() => {
    const seen = checkIfSeen(storageKey);
    setHasSeenTour(seen);
  }, [storageKey]);

  // Auto-open tour if not seen and haven't already opened this session
  useEffect(() => {
    if (!hasSeenTour && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour]);

  const openTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback((dontShowAgain: boolean) => {
    setIsOpen(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem(storageKey, "seen");
        setHasSeenTour(true);
        console.log(`✅ Tour dismissed permanently: ${storageKey}`);
      } catch (e) {
        console.warn("Failed to save tour preference to localStorage:", e);
      }
    }
  }, [storageKey]);

  return {
    shouldShow: isOpen,
    hasSeenTour,
    openTour,
    closeTour,
  };
}
