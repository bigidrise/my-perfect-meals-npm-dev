import { z } from "zod";
import type { StarchDistributionStrategy } from "./dailyNutritionPrescription";

// Shared with the Macro Calculator; these are preference definitions, not a
// replacement for the authoritative prescription or generation algorithms.
export const STARCH_MEAL_COUNTS = [1, 2, 3, 4, 5, 6] as const;
export const STARCH_TIMING_OPTIONS: ReadonlyArray<{
  value: StarchDistributionStrategy; label: string;
}> = [
  { value: "even", label: "Spread evenly" },
  { value: "morning", label: "Earlier in day" },
  { value: "workout", label: "Around workouts" },
  { value: "evening", label: "Evening" },
  { value: "ai", label: "AI decides" },
];
export const studioStarchPreferencesSchema = z.object({
  defaultStarchMealsPerDay: z.number().int().min(1).max(6),
  starchDistributionStrategy: z.enum(["even", "workout", "morning", "evening", "ai"]),
}).strict();
export type StarchPreferences = z.infer<typeof studioStarchPreferencesSchema>;

export function legacyStarchMealCount(strategy: unknown): number | null {
  return strategy === "one" ? 1 : strategy === "flex" ? 2 : null;
}

/** The existing calculator's illustrative allocation, including its rounding. */
export function starchPreviewGrams(target: number, count: number): number[] {
  if (!Number.isFinite(target) || target <= 0 || !Number.isInteger(count) || count <= 0 || count > 8) return [];
  const base = Math.floor(target / count);
  const remainder = target - base * count;
  return Array.from({ length: count }, (_, i) => i === count - 1 ? base + remainder : base);
}

export interface StudioStarchState {
  clientUserId: string;
  savedPreferences: {
    defaultStarchMealsPerDay: number | null;
    starchDistributionStrategy: StarchDistributionStrategy | null;
    starchPlanDefined: boolean;
  };
  currentPrescription: {
    starchyCarbsTarget: number;
    starchMealsAllowed: number;
    starchDistributionStrategy: StarchDistributionStrategy;
  };
  workoutTimingAvailable: boolean;
}

export function studioStarchDraft(
  saved: StudioStarchState["savedPreferences"], legacy: unknown,
) {
  return {
    // Null is not automatically persisted or converted into a legacy default.
    defaultStarchMealsPerDay: saved.defaultStarchMealsPerDay ?? legacyStarchMealCount(legacy),
    starchDistributionStrategy: saved.starchDistributionStrategy ?? "even" as StarchDistributionStrategy,
    legacyPreview: saved.defaultStarchMealsPerDay === null && legacyStarchMealCount(legacy) !== null,
  };
}
