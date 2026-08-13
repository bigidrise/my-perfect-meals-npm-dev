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

// ── Generation context ────────────────────────────────────────────────────────

/**
 * What kind of generation session is active for this meal.
 * Kept separate from the persistent `performanceModeEnabled` flag so that
 * a rest-day user with Performance Mode on gets "standard", not
 * "performance_training_day".
 */
export type GenerationContext =
  | "standard"
  | "performance_training_day"
  | "glp1"
  | "diabetic"
  | "renal"
  | "cardiac"
  | "pregnancy";

// ── Daily Nutrition State ─────────────────────────────────────────────────────

/**
 * Complete nutrition state for one calendar day.
 * Returned by GET /api/nutrition-state/:dateISO.
 *
 * Combines:
 *  - prescription  (resolved macro targets for the day)
 *  - consumed      (what's been logged via macro_logs)
 *  - planned       (board reservations not yet converted to logs)
 *  - remaining     (prescription − consumed − planned, clamped ≥ 0)
 *  - mealPlanConfig (snapshotted user preferences for this day)
 *  - activeConstraints (generationContext + budget exhaustion flags)
 *
 * Double-counting rule:
 *   A board item with a matching macro_log (board_item_reference = item.id)
 *   counts in "consumed" ONLY — never in both consumed and planned.
 */
export interface DailyNutritionState {
  /** Calendar date (YYYY-MM-DD) */
  date: string;
  /** ISO timestamp when this state was computed */
  resolvedAt: string;

  /** Resolved macro targets for this day */
  prescription: DailyNutritionPrescription;

  /** Meals already logged today (from macro_logs) */
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs: number;
    fibrousCarbs: number;
    /** Number of log rows that contained starchy carbs */
    starchMealsLogged: number;
    /** Total number of macro_log rows for this date */
    mealCount: number;
  };

  /**
   * Board reservations for today that have NOT yet been converted to logs.
   * A reservation is "planned" until board_item_reference appears in macro_logs.
   */
  planned: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs: number;
    /** Board items on the board with starchy carbs (not yet logged) */
    starchMealsPlanned: number;
    /** Count of unlogged board items for today */
    reservationCount: number;
  };

  /**
   * Remaining macro budget = prescription − consumed − planned.
   * All values clamped to 0 — never negative.
   */
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs: number;
    fibrousCarbs: number;
    /** starchMealsAllowed − starchMealsLogged − starchMealsPlanned, clamped to 0 */
    starchMealsRemaining: number;
  };

  /** Meal-plan config snapshotted for this day */
  mealPlanConfig: {
    /** User's meals-per-day preference (from macroMealsPerDay) */
    mealsPerDay: number;
    /** Resolved starch meal count for today (performance-adjusted) */
    starchMealsPerDay: number;
    starchDistributionStrategy: StarchDistributionStrategy;
  };

  /** Flags that constrain the next generation call */
  activeConstraints: {
    /** What type of generation context is active for THIS meal */
    generationContext: GenerationContext;
    /** True when all starch meal slots are used (consumed + planned ≥ allowed) */
    starchSlotsExhausted: boolean;
    /** True when remaining.calories ≤ 0 */
    calorieBudgetExhausted: boolean;
    /** True when consumed.protein + planned.protein ≥ prescription.proteinTarget */
    proteinBudgetMet: boolean;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive clinical precision status from verifiable data sources only.
 *
 * Conservative rules — never upgrades status from incomplete evidence:
 *   standard_personalization    — user is not on a clinical plan
 *   clinical_information_needed — clinical tier but no lab or medication records
 *   clinical_precision_available — clinical tier + at least one verifiable source
 *   clinical_precision_active    — clinical tier + labs AND medications confirmed
 *
 * Exported from the shared contract so it can be unit-tested independently
 * of the server resolver (which has DB dependencies).
 */
export function deriveClinicalStatus(
  tier: string,
  /** Verified medication data — from companionProfiles.medications (requires clinical builder). */
  hasVerifiedMedications: boolean,
  hasLabs: boolean,
  /**
   * Self-reported clinical screening — user confirmed they are on medications/hormones
   * in the Macro Calculator gate. Elevates to `available` but never to `active` alone.
   * Defaults to false for backward-compat with existing callers/tests.
   */
  hasScreeningResponse: boolean = false,
): ClinicalPrecisionStatus {
  if (tier !== "ultimate") {
    return "standard_personalization";
  }
  // `active` requires BOTH verified medications AND labs — self-reported screening is insufficient.
  if (hasVerifiedMedications && hasLabs) return "clinical_precision_active";
  // `available` = at least one confirmed source: verified meds, labs, OR self-reported screening.
  if (hasVerifiedMedications || hasLabs || hasScreeningResponse) return "clinical_precision_available";
  return "clinical_information_needed";
}

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

/** Contextual inputs for a single meal-generation request */
export interface MealContext {
  generationContext: GenerationContext;
  /** 0-based position in the day's meal plan (0 = first meal) */
  mealIndex: number;
  isSnack?: boolean;
  timeOfDay?: "morning" | "midday" | "afternoon" | "evening";
}

/** Macro totals shape reused across consumed / planned / remaining */
export interface MacroTotals {
  calories: number;
  protein: number;
  totalCarbs: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  fat: number;
}

/**
 * Per-meal budget produced by computeNextMealBudget().
 *
 * Every meal builder feeds these values into the AI prompt constraints AND
 * validates the generated meal's actual macros against them server-side.
 * A meal that exceeds the envelope must be repaired / regenerated before
 * being presented to the user.
 */
export interface NextMealBudget {
  caloriesBudget: number;
  proteinBudget: number;
  carbsBudget: number;
  fatBudget: number;
  starchyBudget: number;
  fibrousBudget: number;
  /** false when all starch slots for the day have been used */
  starchAllowed: boolean;
  mealsRemaining: number;
  starchMealsRemaining: number;
  /** Machine-readable notes explaining any clinical ceiling that was applied */
  clinicalNotes: string[];
}

// ── Build a minimal fallback prescription ─────────────────────────────────────

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
