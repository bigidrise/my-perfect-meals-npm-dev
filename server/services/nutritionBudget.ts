/**
 * Nutrition Budget Engine
 *
 * Computes the per-meal macro budget that constrains AI generation before
 * the generator runs, and is validated server-side after generation.
 *
 * Design rules:
 *  - computeNextMealBudget() is pure — no DB access, no side effects.
 *  - Starchy carb target is 0 when all starch slots have been used.
 *  - All targets are clamped to 0 — never negative.
 *  - remainingMeals = 0 is handled gracefully (returns 0 targets).
 *  - generationContext is kept separate from performanceModeEnabled;
 *    it reflects what is active for THIS generation request, not user state.
 */

import type {
  DailyNutritionState,
  GenerationContext,
} from "../../shared/dailyNutritionPrescription";

export interface MealBudget {
  /** Per-meal calorie target (remaining ÷ mealsLeft) */
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  /** 0 when all starch slots are exhausted — callers must honour this */
  starchyCarbsTarget: number;
  fibrousCarbsTarget: number;
  /** True when at least one starch slot remains */
  starchSlotAvailable: boolean;
  /** The generation context driving this budget */
  generationContext: GenerationContext;
  /** How many more meals are expected after this one */
  mealsLeft: number;
}

/**
 * Compute the macro budget for the NEXT meal given the current daily state.
 *
 * - Budget = remaining (prescription − consumed − planned) ÷ mealsLeft
 * - starchyCarbsTarget = 0 when starchMealsRemaining ≤ 0
 * - All values clamped ≥ 0
 *
 * @param state   Current DailyNutritionState (from /api/nutrition-state)
 * @param mealsLeft  How many more meals (including this one) are expected today.
 *                   Callers should pass (mealsPerDay − mealsConsumedSoFar).
 *                   Clamped to 1 to avoid division-by-zero.
 */
export function computeNextMealBudget(
  state: DailyNutritionState,
  mealsLeft: number,
): MealBudget {
  const divisor = Math.max(1, mealsLeft);

  const { remaining, activeConstraints, mealPlanConfig } = state;

  const starchSlotAvailable = remaining.starchMealsRemaining > 0;

  // When starch budget is exhausted the generator must not produce starchy carbs.
  const starchyCarbsTarget = starchSlotAvailable
    ? Math.max(0, Math.round(remaining.starchyCarbs / divisor))
    : 0;

  const carbsTarget = Math.max(0, Math.round(remaining.carbs / divisor));
  // fibrousCarbsTarget picks up any carbs that starchy budget can't use
  const fibrousCarbsTarget = starchSlotAvailable
    ? Math.max(0, Math.round(remaining.fibrousCarbs / divisor))
    : Math.max(0, carbsTarget); // all remaining carbs become fibrous

  return {
    caloriesTarget: Math.max(0, Math.round(remaining.calories / divisor)),
    proteinTarget: Math.max(0, Math.round(remaining.protein / divisor)),
    carbsTarget,
    fatTarget: Math.max(0, Math.round(remaining.fat / divisor)),
    starchyCarbsTarget,
    fibrousCarbsTarget,
    starchSlotAvailable,
    generationContext: activeConstraints.generationContext,
    mealsLeft: divisor,
  };
}

/**
 * Derive the GenerationContext from a resolved DailyNutritionState.
 *
 * Rules (evaluated in priority order):
 *  1. diabetic   — specialtyConditions includes "diabetic"
 *  2. glp1       — rationaleCodes includes "glp1_daily_overlay_active"
 *  3. performance_training_day — source === "performance" AND trainingDayType !== "rest"
 *  4. standard   — fallback
 *
 * This is intentionally kept separate from performanceModeEnabled (a persistent
 * user flag). generationContext reflects what is ACTIVE for THIS meal — e.g.
 * a user with performanceModeEnabled on a rest day gets "standard" not
 * "performance_training_day".
 */
export function deriveGenerationContext(
  source: string,
  trainingDayType: string | null,
  rationaleCodes: string[],
  specialtyConditions: string[],
): GenerationContext {
  if (specialtyConditions.includes("diabetic")) return "diabetic";
  if (rationaleCodes.includes("glp1_daily_overlay_active")) return "glp1";
  if (
    source === "performance" &&
    trainingDayType !== null &&
    trainingDayType !== "rest"
  ) {
    return "performance_training_day";
  }
  return "standard";
}
