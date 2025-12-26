import { useState, useLayoutEffect, useCallback, useRef } from "react";

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
  
  // Tri-state: null = not yet loaded, true = seen, false = not seen
  // This prevents race conditions where auto-open fires before storage is read
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Track if we've already scheduled auto-open to prevent duplicates
  const autoOpenScheduledRef = useRef(false);

  // Use useLayoutEffect to read localStorage synchronously before paint
  // This blocks the first render until we know the storage state
  useLayoutEffect(() => {
    const seen = checkIfSeen(storageKey);
    setHasSeenTour(seen);
  }, [storageKey]);

  // Auto-open tour ONLY after storage is loaded AND user hasn't seen it
  useLayoutEffect(() => {
    // Wait until storage has been checked (hasSeenTour is not null)
    if (hasSeenTour === null) return;
    
    // Only auto-open if not seen and we haven't already scheduled it
    if (hasSeenTour === false && !autoOpenScheduledRef.current) {
      autoOpenScheduledRef.current = true;
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
      } catch {
        // localStorage not available - silently fail
      }
    }
  }, [storageKey]);

  return {
    shouldShow: isOpen,
    // Return false while loading to avoid UI flicker
    hasSeenTour: hasSeenTour === true,
    openTour,
    closeTour,
  };
}
