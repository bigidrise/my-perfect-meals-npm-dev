import { useState, useCallback } from "react";

type MealSlot = "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6";

interface UseCreateWithChefControllerResult {
  open: boolean;
  slot: MealSlot;
  openForSlot: (slot: MealSlot) => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

export function useCreateWithChefController(): UseCreateWithChefControllerResult {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<MealSlot>("breakfast");

  const openForSlot = useCallback((newSlot: MealSlot) => {
    setSlot(newSlot);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    slot,
    openForSlot,
    close,
    setOpen,
  };
}
