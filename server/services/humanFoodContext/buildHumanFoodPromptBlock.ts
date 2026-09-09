import type { HumanFoodContext } from "../../../shared/humanFoodContext";

function line(label: string, value: string | null | undefined): string | null {
  return value ? `- ${label}: ${value}` : null;
}

export function buildHumanFoodPromptBlock(context: HumanFoodContext): string {
  const flavor = context.flavor;
  const nutrition = context.nutrition;
  const hasCanonicalNumericTargets = nutrition?.prescription?.source !== "fallback";
  const projected = hasCanonicalNumericTargets
    ? nutrition?.projectedRemaining ?? nutrition?.remaining
    : null;
  const consumedStarch = nutrition?.starch?.consumed;
  const glucosePreferences = context.diabetesFoodPreferences;
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
    context.authorization.status === "authorized"
      ? `- Authorized one-action exception: ${context.authorization.waivers.map((waiver) => `${waiver.ruleCode} for "${waiver.matchedTerm}"`).join(", ")}. Honor only this exception; all allergies and every other protection remain hard constraints.`
      : null,
    context.safety.dislikedFoods.length
      ? `- Disliked foods: ${context.safety.dislikedFoods.join(", ")}`
      : null,
    glucosePreferences
      ? `- Canonical glucose state: ${glucosePreferences.state}` +
        `${glucosePreferences.valueMgdl == null ? "" : ` at ${glucosePreferences.valueMgdl} mg/dL`}` +
        `${glucosePreferences.source ? ` from ${glucosePreferences.source.toLowerCase()}` : ""}` +
        `${glucosePreferences.ageMinutes == null ? "" : ` (${glucosePreferences.ageMinutes} minutes old)`}.`
      : null,
    glucosePreferences?.preferencesConfigured && glucosePreferences.preferenceBand
      ? `- STRICT ${glucosePreferences.preferenceBand} glucose produce allowlist. Fruits: ` +
        `${glucosePreferences.selectedFruits.join(", ") || "none selected"}. Vegetables: ` +
        `${glucosePreferences.selectedVegetables.join(", ") || "none selected"}. ` +
        "Do not add any other fruit or vegetable."
      : null,
    glucosePreferences?.safetyOverride.active
      ? `- Narrow hypoglycemia treatment override is active. Only these otherwise-unselected whole produce treatments may be used: ${glucosePreferences.safetyOverride.allowedProduce.join(", ")}. This does not waive any allergy or other diabetic safety rule.`
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
      ? `- HARD PER-CANDIDATE NUTRITION CEILINGS from the canonical projected remaining allocation: no candidate may exceed ${projected.calories} kcal, ${projected.carbs}g total carbohydrate, or ${projected.fat}g fat.`
      : nutrition
        ? "- Canonical numeric calorie and macro targets are unavailable. Use a standard meal portion; do not interpret unavailable targets as a zero-calorie budget."
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
