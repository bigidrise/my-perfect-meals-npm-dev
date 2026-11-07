import { mealMacroSnapshot } from "./mealMacroSnapshot";
import type { GroceryCoachCarbReview } from "@shared/groceryCoachCarbReview";

/** Board nutrition is one eating portion; cooking quantities remain a full recipe. */
export function groceryCoachPlanHandoff(meal: any) {
  const { servings, ...nutrition } = mealMacroSnapshot(meal);
  const carbohydrateReview: GroceryCoachCarbReview = meal.carbohydrateReview ?? {
    version: 1, status: "unresolved", reason: "historical_breakdown_not_verified",
  };
  return {
    groceryCoachNutritionHandoff: true,
    sourceType: "grocery-coach",
    nutrition,
    nutritionBasis: "per-serving",
    servings: 1,
    recipeServings: servings,
    carbohydrateReview,
  };
}
