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

export function useQuickTour(
  pageKey: string,
  onPreferenceSaveError?: () => void,
  { autoOpenDelayMs = 500, setupComplete }: {
    autoOpenDelayMs?: number;
    /** undefined keeps ordinary tours unchanged; null waits for saved evidence. */
    setupComplete?: boolean | null;
  } = {},
): QuickTourState {
  const storageKey = `quick-tour::${pageKey}`;
  
  // Tri-state: null = not yet loaded, true = seen, false = not seen
  // This prevents race conditions where auto-open fires before storage is read
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [globalDisabled, setGlobalDisabledState] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const setupVisitRef = useRef({ key: storageKey, opened: false });
  
  // Track if we've already scheduled auto-open to prevent duplicates
  const autoOpenScheduledRef = useRef(false);

  // Use useLayoutEffect to read localStorage synchronously before paint
  // This blocks the first render until we know the storage state
  useLayoutEffect(() => {
    const seen = checkIfSeen(storageKey);
    const globalOff = isToursGloballyDisabled();
    setHasSeenTour(seen);
    setGlobalDisabledState(globalOff);
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  // Auto-open tour ONLY after storage is loaded AND user hasn't seen it AND tours not globally disabled
  useLayoutEffect(() => {
    if (setupComplete !== undefined) {
      if (setupVisitRef.current.key !== storageKey) {
        setupVisitRef.current = { key: storageKey, opened: false };
        setIsOpen(false);
      }
      // Setup completion, not an old "seen" preference, owns this entrance.
      // Unknown saved state never means unfinished setup.
      if (loadedStorageKey !== storageKey || globalDisabled
        || setupComplete !== false || setupVisitRef.current.opened) return;
      const open = () => {
        setupVisitRef.current.opened = true;
        setIsOpen(true);
      };
      if (autoOpenDelayMs === 0) { open(); return; }
      const timer = setTimeout(open, autoOpenDelayMs);
      return () => clearTimeout(timer);
    }
    // Wait until storage has been checked (hasSeenTour is not null)
    if (hasSeenTour === null) return;
    
    // Check global disable - if globally disabled, never auto-open
    if (globalDisabled) return;
    
    // Only auto-open if not seen and we haven't already scheduled it
    if (hasSeenTour === false && !autoOpenScheduledRef.current) {
      autoOpenScheduledRef.current = true;
      // The onboarding entrance opens as soon as preferences are loaded.
      // Other guides retain their existing delayed presentation.
      if (autoOpenDelayMs === 0) {
        setIsOpen(true);
        return;
      }
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, autoOpenDelayMs);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, globalDisabled, autoOpenDelayMs, setupComplete, storageKey, loadedStorageKey]);

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
    setupVisitRef.current = { key: storageKey, opened: true };
    setIsOpen(true);
  }, [storageKey]);

  const closeTour = useCallback((dontShowAgain: boolean) => {
    setupVisitRef.current = { key: storageKey, opened: true };
    setIsOpen(false);
    if (dontShowAgain && setupComplete === undefined) {
      try {
        localStorage.setItem(storageKey, "seen");
        setHasSeenTour(true);
      } catch {
        onPreferenceSaveError?.();
      }
    }
  }, [storageKey, onPreferenceSaveError, setupComplete]);

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
