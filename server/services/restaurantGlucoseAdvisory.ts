import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { validateHumanFoodCandidate } from "./humanFoodContext/finalValidation";

/** Enforce configured glucose produce lists when restaurant ingredients exist;
 * otherwise retain an explicitly advisory, unverifiable result. */
export function applyRestaurantGlucoseProduceAdvisory(
  recommendations: any[],
  context: HumanFoodContext,
): any[] {
  const preferences = context.diabetesFoodPreferences;
  if (!preferences?.preferencesConfigured) return recommendations;
  return recommendations.flatMap((recommendation) => {
    const meal = recommendation?.meal ?? recommendation;
    const ingredients = Array.isArray(meal?.ingredients)
      ? meal.ingredients.map((item: any) =>
          typeof item === "string" ? item : item?.name ?? item?.item ?? "",
        ).filter(Boolean)
      : [];
    if (ingredients.length) {
      const validation = validateHumanFoodCandidate({
        name: meal?.name ?? recommendation?.name ?? "",
        description: meal?.description ?? recommendation?.description,
        ingredients,
        evidence: {
          sourceType: "restaurant",
          ingredientEvidence: "verified",
          preparationEvidence: "unknown",
          nutritionEvidence: "unknown",
        },
      }, context);
      return validation.findings.some((finding) =>
        finding.dimension === "glucose_food_preference",
      ) ? [] : [recommendation];
    }
    return [{
      ...recommendation,
      glucoseProduceGuidance: {
        status: "advisory_unverified",
        message: "Restaurant ingredient details were not verified. Ask to use only your approved glucose-state fruits and vegetables, and do not assume unlisted produce is suitable.",
        approvedFruits: preferences.selectedFruits,
        approvedVegetables: preferences.selectedVegetables,
      },
    }];
  });
}