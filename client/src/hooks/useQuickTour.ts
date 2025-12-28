import { useState, useLayoutEffect, useCallback, useRef } from "react";

const GLOBAL_DISABLE_KEY = "quick-tour-global-disabled";

interface QuickTourState {
  shouldShow: boolean;
  hasSeenTour: boolean;
  openTour: () => void;
  closeTour: (dontShowAgain: boolean) => void;
  isGloballyDisabled: boolean;
  setGlobalDisabled: (disabled: boolean) => void;
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

/**
 * Check if tours are globally disabled
 */
function isToursGloballyDisabled(): boolean {
  try {
    return localStorage.getItem(GLOBAL_DISABLE_KEY) === "true";
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
  const [globalDisabled, setGlobalDisabledState] = useState(false);
  
  // Track if we've already scheduled auto-open to prevent duplicates
  const autoOpenScheduledRef = useRef(false);

  // Use useLayoutEffect to read localStorage synchronously before paint
  // This blocks the first render until we know the storage state
  useLayoutEffect(() => {
    const seen = checkIfSeen(storageKey);
    const globalOff = isToursGloballyDisabled();
    setHasSeenTour(seen);
    setGlobalDisabledState(globalOff);
  }, [storageKey]);

  // Auto-open tour ONLY after storage is loaded AND user hasn't seen it AND tours not globally disabled
  useLayoutEffect(() => {
    // Wait until storage has been checked (hasSeenTour is not null)
    if (hasSeenTour === null) return;
    
    // Check global disable - if globally disabled, never auto-open
    if (globalDisabled) return;
    
    // Only auto-open if not seen and we haven't already scheduled it
    if (hasSeenTour === false && !autoOpenScheduledRef.current) {
      autoOpenScheduledRef.current = true;
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, globalDisabled]);

  const setGlobalDisabled = useCallback((disabled: boolean) => {
    try {
      if (disabled) {
        localStorage.setItem(GLOBAL_DISABLE_KEY, "true");
      } else {
        localStorage.removeItem(GLOBAL_DISABLE_KEY);
      }
      setGlobalDisabledState(disabled);
    } catch {
      // localStorage not available
    }
  }, []);

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
    isGloballyDisabled: globalDisabled,
    setGlobalDisabled,
  };
}
