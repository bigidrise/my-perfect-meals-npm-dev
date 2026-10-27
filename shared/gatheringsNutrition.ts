/** Gatherings pilot contract. Nutrition is always whole-recipe, never a portion. */
export const GATHERINGS_NUTRITION_VERSION = "ingredient-recipe-v2";
export const GATHERINGS_MACROS = ["calories", "protein", "carbs", "fat"] as const;
export type GatheringsMacros = Record<(typeof GATHERINGS_MACROS)[number], number>;
export interface GatheringsNutritionResult {
  version: typeof GATHERINGS_NUTRITION_VERSION;
  status: "available" | "needs_review" | "unavailable";
  basis: "whole_recipe";
  servings: number;
  reasons: string[];
  assumptions: string[];
  /** Consistency binding, not an authentication token or clinical clearance. */
  recipeSignature?: string;
  sources: Array<{
    ingredientIndex: number; fdcId: number; description: string; dataType: string;
    retrievedAt: string; grams: number; conversion: string;
  }>;
}
export function gatheringsRecipeSignature(meal: any, servings: number, nutrition: GatheringsMacros): string {
  return JSON.stringify([
    servings, GATHERINGS_MACROS.map(key => nutrition[key]),
    meal.ingredients.map((i: any) => [i.name, i.amount, i.unit, i.originalText]),
    meal.name ?? null, meal.instructions ?? null,
  ]);
}
/** Explicit origin for new records; narrow legacy Gatherings course shape. */
export function isGatheringsMeal(meal: any): boolean {
  return meal?.sourceFeature === "my-perfect-gatherings" ||
    (typeof meal?.nutritionResult?.version === "string" &&
      meal.nutritionResult.version.startsWith("ingredient-recipe-")) ||
    (["appetizer", "main", "side", "dessert"].includes(meal?.courseType) &&
      typeof meal?.courseLabel === "string" &&
      (Object.prototype.hasOwnProperty.call(meal, "assignedDish") || meal?._fallback === true));
}
/** Never infer availability from a plausible-looking legacy numeric vector. */
export function hasGatheringsNutrition(meal: any): boolean {
  const result = meal?.nutritionResult;
  return result?.version === GATHERINGS_NUTRITION_VERSION &&
    result.status === "available" && result.basis === "whole_recipe" &&
    Number.isInteger(meal.servings) && meal.servings > 0 && meal.servings <= 50 &&
    result.servings === meal.servings &&
    Array.isArray(meal.ingredients) && meal.ingredients.length > 0 &&
    Array.isArray(result.sources) && result.sources.length === meal.ingredients.length &&
    Array.isArray(result.reasons) && result.reasons.length === 0 &&
    Array.isArray(result.assumptions) &&
    result.sources.every((source: any, index: number) =>
      source != null && source.ingredientIndex === index && Number.isInteger(source.fdcId) && source.fdcId > 0 &&
      Number.isFinite(source.grams) && source.grams > 0 &&
      !meal.ingredients[index]?.parseIssue &&
      Number.isFinite(meal.ingredients[index]?.amount) && meal.ingredients[index].amount > 0) &&
    GATHERINGS_MACROS.every(key =>
      typeof meal.nutrition?.[key] === "number" &&
      Number.isFinite(meal.nutrition[key]) && meal.nutrition[key] >= 0) &&
    result.recipeSignature === gatheringsRecipeSignature(meal, meal.servings, meal.nutrition);
}
