import type { HumanFoodContext } from "../../../shared/humanFoodContext";

function line(label: string, value: string | null | undefined): string | null {
  return value ? `- ${label}: ${value}` : null;
}

export function buildHumanFoodPromptBlock(context: HumanFoodContext): string {
  const flavor = context.flavor;
  const nutrition = context.nutrition;
  const projected = nutrition?.projectedRemaining ?? nutrition?.remaining;
  const consumedStarch = nutrition?.starch?.consumed;
  const lines = [
    "HUMAN FOOD CONTEXT v1 — preserve through every retry, correction, and fallback:",
    `- Effective diet: ${context.diet.effective.join(", ") || "no optional diet preference available"}`,
    line("Cuisine", flavor.cuisine.value),
    line("Cuisine intensity", flavor.cuisineIntensity.value),
    line("Heat", flavor.heat.value),
    line("Seasoning intensity", flavor.seasoningIntensity.value),
    line("Broad flavor", flavor.broadFlavor.value),
    line("Flavor style", flavor.flavorStyle.value),
    "- Spice complexity: unavailable in v1; do not infer it.",
    context.safety.allergies.length
      ? `- Hard allergy exclusions: ${context.safety.allergies.join(", ")}`
      : null,
    context.safety.avoidedFoods.length
      ? `- Hard user avoidances: ${context.safety.avoidedFoods.join(", ")}`
      : null,
    context.safety.dislikedFoods.length
      ? `- Disliked foods: ${context.safety.dislikedFoods.join(", ")}`
      : null,
    context.behavior?.preferredCuisines.length
      ? `- Behavioral cuisine hints (soft only): ${context.behavior.preferredCuisines.join(", ")}`
      : null,
    context.behavior?.preferredProteins.length
      ? `- Behavioral protein hints (soft only): ${context.behavior.preferredProteins.join(", ")}`
      : null,
    nutrition
      ? `- Canonical nutrition authority: ${nutrition.authority ?? "nutritionStateService"}; status ${nutrition.resolution?.status ?? "resolved"}; generation context ${nutrition.activeConstraints.generationContext}.`
      : null,
    projected
      ? `- Projected remaining daily allocation after planned meals: ${projected.calories} kcal, ${projected.protein}g protein, ${projected.carbs}g total carbohydrate, ${projected.fat}g fat.`
      : null,
    consumedStarch
      ? `- Consumed-starch authority: ${consumedStarch.remainingGrams}g and ${consumedStarch.mealsRemaining} confirmed starch meal slot(s) remain; exhausted=${consumedStarch.exhausted}. Planned meals may create a projected conflict but cannot change consumed exhaustion.`
      : null,
    nutrition?.activeConstraints.projectedStarchConflict
      ? "- Projected starch conflict is active: avoid adding another starchy allocation unless an authorized workflow explicitly replaces a reservation."
      : null,
    "- Clinical adaptation may change ingredients, amounts, and technique, but must not silently erase the requested cuisine or named dish identity.",
  ].filter(Boolean);

  return lines.join("\n");
}
