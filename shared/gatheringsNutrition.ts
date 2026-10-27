/** Gatherings pilot contract. Nutrition is always whole-recipe, never a portion. */
export const GATHERINGS_NUTRITION_VERSION = "ingredient-recipe-v1";
export const GATHERINGS_MACROS = ["calories", "protein", "carbs", "fat"] as const;
export type GatheringsMacros = Record<(typeof GATHERINGS_MACROS)[number], number>;
export interface GatheringsNutritionResult {
  version: typeof GATHERINGS_NUTRITION_VERSION;
  status: "available" | "needs_review" | "unavailable";
  basis: "whole_recipe";
  servings: number;
  reasons: string[];
  assumptions: string[];
  sources: Array<{
    ingredientIndex: number; fdcId: number; description: string; dataType: string;
    retrievedAt: string; grams: number; conversion: string;
  }>;
}
/** Never infer availability from a plausible-looking legacy numeric vector. */
export function hasGatheringsNutrition(meal: any): boolean {
  const result = meal?.nutritionResult;
  return result?.version === GATHERINGS_NUTRITION_VERSION &&
    result.status === "available" && result.basis === "whole_recipe" &&
    Number.isInteger(meal.servings) && meal.servings > 0 &&
    result.servings === meal.servings &&
    GATHERINGS_MACROS.every(key =>
      typeof meal.nutrition?.[key] === "number" &&
      Number.isFinite(meal.nutrition[key]) && meal.nutrition[key] >= 0);
}
