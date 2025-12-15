import { useState, useEffect, useCallback } from "react";

interface QuickTourState {
  shouldShow: boolean;
  hasSeenTour: boolean;
  openTour: () => void;
  closeTour: (dontShowAgain: boolean) => void;
}

export function useQuickTour(pageKey: string): QuickTourState {
  const storageKey = `quick-tour::${pageKey}`;
  
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "seen";
    } catch {
      return false;
    }
  });
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenTour) {
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
        // localStorage not available
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
