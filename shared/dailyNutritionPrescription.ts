/**
 * DailyNutritionPrescription — Shared Contract
 *
 * This is the single output type produced by the prescription resolver and consumed
 * by every builder, coach, and tracker in MyPerfectMeals.
 *
 * Design rules:
 *  - All fields that cannot be determined are undefined, never null or 0.
 *  - starchMealsAllowed is an integer — callers no longer interpret "one"/"flex" strings.
 *  - rationaleCodes carry machine-readable reasons for every non-fallback decision.
 *  - The contract is additive — new fields may be added; old ones must never be removed
 *    without a migration.
 */

export type PrescriptionSource =
  | "professional_override"
  | "performance"
  | "clinical"
  | "user_default"
  | "fallback";

export type StarchDistributionStrategy =
  | "even"
  | "workout"
  | "morning"
  | "evening"
  | "ai";

/**
 * Training day type, mapped from SessionType in performanceProtocolResolver.
 * null = no performance protocol active for this user.
 */
export type TrainingDayType =
  | "rest"
  | "light"
  | "moderate"
  | "heavy"
  | "competition"
  | null;

/**
 * Four-state clinical precision label, written into the prescription and
 * displayed in Macro Calculator + builders.
 */
export type ClinicalPrecisionStatus =
  | "standard_personalization"
  | "clinical_information_needed"
  | "clinical_precision_available"
  | "clinical_precision_active";

export interface DailyNutritionPrescription {
  /** ISO date this prescription applies to (YYYY-MM-DD) */
  date: string;

  /** What produced these numbers */
  source: PrescriptionSource;

  // ── Macro targets ──────────────────────────────────────────────────────────
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;

  /** Starchy carb portion of carbsTarget (rice, pasta, potato, bread, etc.) */
  starchyCarbsTarget: number;
  /** Fibrous / vegetable carb portion of carbsTarget */
  fibrousCarbsTarget: number;

  // ── Starch meal tracking ───────────────────────────────────────────────────
  /** How many starch meals are allowed today (integer, replaces "one"/"flex") */
  starchMealsAllowed: number;
  /** How many starch meals have been logged so far today */
  starchMealsUsed: number;
  /** starchMealsAllowed − starchMealsUsed (clamped to 0) */
  starchMealsRemaining: number;

  /** Grams of starchy carbs already consumed today */
  starchyCarbsConsumed: number;
  /** starchyCarbsTarget − starchyCarbsConsumed (clamped to 0) */
  starchyCarbsRemaining: number;
  /**
   * Adaptive per-meal gram target: starchyCarbsRemaining ÷ starchMealsRemaining.
   * undefined when starchMealsRemaining is 0 (all slots used).
   */
  gramsPerRemainingStarchMeal?: number;

  /** How starchy carbs should be distributed across meals */
  starchDistributionStrategy: StarchDistributionStrategy;

  /** True on rest days or specific clinical protocols that eliminate starch */
  isZeroStarchDay: boolean;

  // ── Performance / training context ────────────────────────────────────────
  /** Session type from the user's Performance Hub schedule. null = no schedule. */
  trainingDayType: TrainingDayType;

  // ── Optional performance / clinical extensions ─────────────────────────────
  hydrationTarget?: number;        // ml
  electrolyteEmphasis?: boolean;
  refeedDay?: boolean;
  recoveryEmphasis?: boolean;

  // ── Clinical precision ─────────────────────────────────────────────────────
  clinicalPrecisionStatus: ClinicalPrecisionStatus;

  /**
   * Machine-readable codes explaining why this prescription looks the way it does.
   * Used for UI tooltips, audit logs, and future AI coach context injection.
   * Example values: "performance_modifier_active", "zero_starch_rest_day",
   *   "clinical_precision_active", "procare_override", "fallback_no_targets"
   */
  rationaleCodes: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a SessionType string (from performanceProtocolResolver) to a TrainingDayType.
 * Keeps the two type systems decoupled.
 */
export function sessionTypeToTrainingDayType(sessionType: string | null | undefined): TrainingDayType {
  switch (sessionType) {
    case "off":
    case "recovery":
      return "rest";
    case "strength":
    case "sport_practice":
      return "moderate";
    case "power":
    case "endurance":
      return "heavy";
    case "competition":
      return "competition";
    default:
      return null;
  }
}

/**
 * Derive the integer starch meal allowance from a performance session type and
 * a user's starch strategy baseline.
 *
 * Rules:
 *  - rest/recovery → 0 or 1 depending on baseline (zero-starch rest day default)
 *  - moderate training → 2
 *  - heavy / competition → 3
 *  - no performance protocol → fall back to baseline starch strategy integer
 *  - baseline starch strategy: "one" = 1, "flex" = 2
 */
export function deriveStarchMealsAllowed(
  trainingDayType: TrainingDayType,
  baselineStarchStrategy: "one" | "flex" | undefined,
  zeroStarchOverride?: boolean,
): number {
  if (zeroStarchOverride) return 0;
  if (trainingDayType === null) {
    return baselineStarchStrategy === "flex" ? 2 : 1;
  }
  switch (trainingDayType) {
    case "rest":      return 0;
    case "light":     return 1;
    case "moderate":  return 2;
    case "heavy":     return 3;
    case "competition": return 4;
    default:          return baselineStarchStrategy === "flex" ? 2 : 1;
  }
}

/**
 * Compute the adaptive per-meal gram guidance given current consumption.
 */
export function computeGramsPerRemainingMeal(
  starchyCarbsRemaining: number,
  starchMealsRemaining: number,
): number | undefined {
  if (starchMealsRemaining <= 0) return undefined;
  return Math.round(starchyCarbsRemaining / starchMealsRemaining);
}

/**
 * Build a minimal fallback prescription when no targets are available.
 */
export function buildFallbackPrescription(date: string): DailyNutritionPrescription {
  return {
    date,
    source: "fallback",
    caloriesTarget: 0,
    proteinTarget: 0,
    carbsTarget: 0,
    fatTarget: 0,
    starchyCarbsTarget: 0,
    fibrousCarbsTarget: 0,
    starchMealsAllowed: 1,
    starchMealsUsed: 0,
    starchMealsRemaining: 1,
    starchyCarbsConsumed: 0,
    starchyCarbsRemaining: 0,
    gramsPerRemainingStarchMeal: undefined,
    starchDistributionStrategy: "even",
    isZeroStarchDay: false,
    trainingDayType: null,
    clinicalPrecisionStatus: "standard_personalization",
    rationaleCodes: ["fallback_no_targets"],
  };
}
