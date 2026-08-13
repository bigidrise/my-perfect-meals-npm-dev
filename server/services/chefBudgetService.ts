/**
 * chefBudgetService.ts
 *
 * Resolves the server-authoritative per-meal budget for the Create-with-Chef
 * generation path. This service is the enforcement point that prevents stale or
 * tampered client-supplied remainingMacros from reaching the AI.
 *
 * Authorization contract:
 *   - The budget is ALWAYS resolved for the authenticated user (authUserId).
 *   - The request-body userId is deliberately not accepted here — it is untrusted.
 *   - ProCare physician-for-client delegation is not supported in the Chef path;
 *     physicians generate meals under their own nutrition targets.
 *
 * Fail-closed contract:
 *   - If resolution fails for any reason, the caller MUST NOT proceed with
 *     client-supplied macros. It should return HTTP 503 instead.
 *   - The only safe fallback is no generation at all.
 */

import { resolveDailyNutritionState, deriveGenerationContext } from "./nutritionStateService";
import { computeNextMealBudget, type MealBudget } from "./nutritionBudget";

export interface ChefBudgetResult {
  remainingMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** When false the starchContext must be patched with isZeroStarchDay: true */
  starchAllowed: boolean;
  /** Server-authoritative starch slot count remaining today (from macro_logs consumption) */
  starchMealsRemaining: number;
  /** Server-authoritative starchy-carb grams remaining today */
  starchyCarbsRemaining: number;
  /** Adaptive per-starch-meal gram target based on remaining allocation */
  gramsPerRemainingStarchMeal: number | undefined;
  budget: MealBudget;
}

/**
 * Resolve the per-meal budget for a Create-with-Chef generation request.
 *
 * @param authUserId   Authenticated user ID from req.authUser — never from body.
 * @param dateISO      Local date string (YYYY-MM-DD) for the builder's active day.
 *                     Comes from starchContext.dateISO or today's UTC date.
 * @param clientCtx    Optional generationContext string from the request body
 *                     (used only to detect explicit performance-day intent).
 * @throws             Any error from resolution propagates; callers must catch and
 *                     return HTTP 503 rather than proceeding with client macros.
 */
export async function resolveChefBudget(
  authUserId: string,
  dateISO: string,
  clientCtx?: string,
): Promise<ChefBudgetResult> {
  const nutritionState = await resolveDailyNutritionState(authUserId, dateISO);

  // mealsLeft = how many meal slots still need a budget (unconsumed + unplanned).
  // remaining macros already have consumed + planned subtracted, so we divide by
  // the number of genuinely unfilled slots. Clamped to 1 to avoid ÷0.
  const filledSlots =
    (nutritionState.consumed.mealCount ?? 0) +
    (nutritionState.planned.reservationCount ?? 0);
  const mealsLeft = Math.max(
    1,
    nutritionState.mealPlanConfig.mealsPerDay - filledSlots,
  );

  const budget = computeNextMealBudget(nutritionState, mealsLeft);

  const { remaining } = nutritionState;

  // gramsPerRemainingStarchMeal: divide remaining starchy carbs evenly across
  // remaining starch slots. undefined when no starch slots remain.
  const gramsPerRemainingStarchMeal: number | undefined =
    remaining.starchMealsRemaining > 0
      ? Math.round(remaining.starchyCarbs / remaining.starchMealsRemaining)
      : undefined;

  return {
    remainingMacros: {
      calories: budget.caloriesTarget,
      protein:  budget.proteinTarget,
      carbs:    budget.carbsTarget,
      fat:      budget.fatTarget,
    },
    starchAllowed:               budget.starchSlotAvailable,
    starchMealsRemaining:        remaining.starchMealsRemaining,
    starchyCarbsRemaining:       remaining.starchyCarbs,
    gramsPerRemainingStarchMeal,
    budget,
  };
}
