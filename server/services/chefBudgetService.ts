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
import { computeNextMealBudget } from "./nutritionBudget";
import type { NextMealBudget } from "../../shared/dailyNutritionPrescription";

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
  budget: NextMealBudget;
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

  const gCtx = deriveGenerationContext(
    nutritionState.activeConstraints,
    clientCtx,
  );

  const budget = computeNextMealBudget(nutritionState, {
    generationContext: gCtx,
    mealIndex: 0,
  });

  return {
    remainingMacros: {
      calories: budget.caloriesBudget,
      protein:  budget.proteinBudget,
      carbs:    budget.carbsBudget,
      fat:      budget.fatBudget,
    },
    starchAllowed: budget.starchAllowed,
    starchMealsRemaining:        nutritionState.mealPlan.starchMealsRemaining,
    starchyCarbsRemaining:       nutritionState.remaining.starchyCarbs,
    gramsPerRemainingStarchMeal: nutritionState.mealPlan.gramsPerRemainingStarchMeal,
    budget,
  };
}
