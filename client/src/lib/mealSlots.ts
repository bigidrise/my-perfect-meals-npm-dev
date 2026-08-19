import type { DayLists } from "@/../../shared/schema/weeklyBoard";

export type BoardMealSlot = keyof DayLists;
export type MacroLogMealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

/**
 * Macro logs support the four canonical nutrition categories. Extra board
 * meals are intentionally grouped with snacks when they are logged.
 */
export function normalizeBoardSlotForMacroLog(
  slot: BoardMealSlot | null | undefined,
): MacroLogMealSlot {
  if (slot === "meal4" || slot === "meal5" || slot === "meal6") {
    return "snacks";
  }

  return slot ?? "snacks";
}