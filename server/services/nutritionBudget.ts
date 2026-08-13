/**
 * nutritionBudget.ts — Next Meal Budget Resolver (#690)
 *
 * computeNextMealBudget() is the single function every meal builder calls
 * before generation. It takes the canonical DailyNutritionState and returns
 * the per-meal nutrient envelope the AI must stay within.
 *
 * Design rules (advisor-approved):
 *  - Constrain generation BEFORE the AI runs (prompt injection)
 *  - Server validates generated meal macros AFTER generation
 *  - Clinical ceilings only tighten — they never widen the envelope
 *  - Starch slot gate is absolute: zero starchy carbs when slots exhausted
 *  - GLP-1 and Diabetic constraints layer in order; neither can be bypassed
 */

import type { DailyNutritionState, MealContext, NextMealBudget } from "../../shared/dailyNutritionPrescription";

/**
 * Compute the per-meal nutrient budget given the current day's nutrition state.
 *
 * Algorithm:
 *   1. Base budget = remaining nutrition ÷ meals remaining (even split)
 *   2. Starch slot gate: if starchMealsRemaining === 0, starchyBudget = 0;
 *      excess starchy grams are rerouted to fibrous carbs so the meal's
 *      calorie total stays intact.
 *   3. Adaptive starchy cap: if only one starch meal is left but gramsPerRemainingStarchMeal
 *      says "save X grams for that slot", cap starchyBudget at X.
 *   4. Clinical ceilings (tighten only):
 *      - Diabetic: carbs ≤ 35 g/meal (in-range glucose floor; validator applies
 *        the full glucose-state-aware ceiling at generation time)
 *      - GLP-1: fat ≤ prescription.fatTarget ÷ mealsPerDay
 */
export function computeNextMealBudget(
  state: DailyNutritionState,
  _mealContext: MealContext,
): NextMealBudget {
  const { remaining, mealPlan, activeConstraints, resolvedPrescription } = state;
  const clinicalNotes: string[] = [];

  // Avoid division by zero — treat 0 meals remaining as 1 so the budget
  // is computed (the builder will show it as zero-opportunity anyway).
  const mealsLeft = Math.max(1, mealPlan.mealsRemaining);

  // ── 1. Base per-meal share (even split of remaining) ───────────────────
  let caloriesBudget = Math.round(remaining.calories     / mealsLeft);
  let proteinBudget  = Math.round(remaining.protein      / mealsLeft);
  let carbsBudget    = Math.round(remaining.totalCarbs   / mealsLeft);
  let fatBudget      = Math.round(remaining.fat          / mealsLeft);
  let starchyBudget  = Math.round(remaining.starchyCarbs / mealsLeft);
  let fibrousBudget  = Math.round(remaining.fibrousCarbs / mealsLeft);

  // ── 2. Starch slot gate ────────────────────────────────────────────────
  const starchAllowed = mealPlan.starchMealsRemaining > 0;

  if (!starchAllowed) {
    // All starch slots are used. Reroute starchy gram budget to fibrous
    // so the meal keeps its calorie target (both are 4 kcal/g).
    if (starchyBudget > 0) {
      fibrousBudget += starchyBudget;
      starchyBudget  = 0;
      clinicalNotes.push("starch_slots_exhausted_rerouted_to_fibrous");
    }
  } else {
    // ── 3. Adaptive starchy cap ─────────────────────────────────────────
    // gramsPerRemainingStarchMeal is the reservation-aware target.
    // If the budget exceeds it, hold back the excess for future starch meals.
    const adaptiveTarget = resolvedPrescription.gramsPerRemainingStarchMeal;
    if (adaptiveTarget !== undefined && starchyBudget > adaptiveTarget) {
      const excess = starchyBudget - adaptiveTarget;
      starchyBudget  = adaptiveTarget;
      fibrousBudget += excess;
      clinicalNotes.push("starchy_carbs_capped_to_adaptive_per_meal_target");
    }
  }

  // ── 4. Clinical ceilings — tighten only, never widen ──────────────────

  if (activeConstraints.diabeticActive) {
    // 35 g/meal is the platform-wide in-range carb floor constraint.
    // The full glucose-state-aware ceiling (15/25/35/45 g depending on BGL)
    // is applied by diabeticPromptBuilder.ts during generation.
    const DIABETIC_CARB_CEILING = 35;
    if (carbsBudget > DIABETIC_CARB_CEILING) {
      const excess = carbsBudget - DIABETIC_CARB_CEILING;
      carbsBudget = DIABETIC_CARB_CEILING;
      // Carb → protein calorie swap (4 kcal/g each — 1:1 gram substitution)
      proteinBudget += excess;
      clinicalNotes.push("diabetic_carb_ceiling_applied_35g");
    }
  }

  if (activeConstraints.glp1Active) {
    // Per-meal fat ceiling = daily fat target ÷ mealsPerDay.
    // The prescriptionResolver already enforced the daily fat ceiling;
    // this per-meal slice prevents any single meal from consuming all the
    // daily fat budget, which is a GLP-1 tolerability failure mode.
    const fatPerMeal = Math.round(
      resolvedPrescription.fatTarget / Math.max(1, mealPlan.mealsPerDay),
    );
    if (fatBudget > fatPerMeal) {
      fatBudget = fatPerMeal;
      clinicalNotes.push("glp1_per_meal_fat_ceiling_applied");
    }
  }

  // ── Floor everything at 0 ──────────────────────────────────────────────
  return {
    caloriesBudget:      Math.max(0, caloriesBudget),
    proteinBudget:       Math.max(0, proteinBudget),
    carbsBudget:         Math.max(0, carbsBudget),
    fatBudget:           Math.max(0, fatBudget),
    starchyBudget:       Math.max(0, starchyBudget),
    fibrousBudget:       Math.max(0, fibrousBudget),
    starchAllowed,
    mealsRemaining:      mealPlan.mealsRemaining,
    starchMealsRemaining: mealPlan.starchMealsRemaining,
    clinicalNotes,
  };
}
