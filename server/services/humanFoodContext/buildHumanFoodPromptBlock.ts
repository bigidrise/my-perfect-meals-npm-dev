import type { HumanFoodContext, HumanFoodMacroGoalOptions } from "../../../shared/humanFoodContext";
import { buildLowCarbSourceGuidance } from "../../../shared/carbSourcePolicy";
import { buildNutritionPriorityPromptProjection } from "../nutritionPriorityPromptProjection";

function line(label: string, value: string | null | undefined): string | null {
  return value ? `- ${label}: ${value}` : null;
}

export function buildHumanFoodPromptBlock(
  context: HumanFoodContext,
  options: HumanFoodMacroGoalOptions = {},
): string {
  const flavor = context.flavor;
  const nutrition = context.nutrition;
  const hasCanonicalNumericTargets = nutrition?.prescription?.source !== "fallback";
  const projected = hasCanonicalNumericTargets
    ? nutrition?.projectedRemaining ?? nutrition?.remaining
    : null;
  const consumedStarch = nutrition?.starch?.consumed;
  const glucosePreferences = context.diabetesFoodPreferences;
  const enjoyment = context.foodsIEnjoy ?? { explicit: [], legacyLikes: [] };
  const sweeteners = context.sweeteners ?? { preferred: [], avoided: [] };
  const priorityProjection = buildNutritionPriorityPromptProjection(context);
  const lines = [
    "HUMAN FOOD CONTEXT v1 — preserve through every retry, correction, and fallback:",
    "- Adaptation-first: identify the requested food's defining form, ingredients, and culinary identity. Change only adaptable components (such as starch, sauce, sweetener, dairy, portion, or technique) to satisfy the resolved requirements. Never silently replace the requested dish with an unrelated meal.",
    "- Apply all applicable dietary, allergy, avoidance, and current clinical requirements together before generating. If a component conflicts, choose a compatible substitute that performs the same culinary role; do not assume a requested dish is impossible merely because its customary recipe conflicts.",
    "- Keep final safety checks authoritative. If a recognizable, safe adaptation cannot be established, do not claim compliance; explain the unsatisfied requirement rather than returning a generic substitute.",
    `- Effective diet: ${context.diet.effective.join(", ") || "no optional diet preference available"}`,
    context.diet.effective.some((diet) => diet.toLowerCase().replace(/[_-]+/g, " ").trim() === "low carb")
      ? buildLowCarbSourceGuidance()
      : null,
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
    enjoyment.explicit.length
      ? `- Foods this person explicitly enjoys (soft guidance only; never override current intent, safety, medical, dietary, or avoidance rules): ${enjoyment.explicit.map((item) => item.displayLabel).join(", ")}`
      : null,
    enjoyment.legacyLikes.length
      ? `- Legacy profile likes (compatibility context only; not newly confirmed Foods I Enjoy): ${enjoyment.legacyLikes.join(", ")}`
      : null,
    priorityProjection,
    sweeteners.preferred.length
      ? `- Preferred sweeteners (soft ingredient guidance): ${sweeteners.preferred.join(", ")}`
      : null,
    sweeteners.avoided.length
      ? `- Avoided sweeteners: ${sweeteners.avoided.join(", ")}`
      : null,
    "- Explicit current food intent, when provided by the request, outranks these soft enjoyment hints; never redirect a current request to an unrelated favorite.",
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
      ? `- Ordinary daily goals remaining: ${projected.calories} kcal, ${projected.carbs}g total carbohydrate, ${projected.fat}g fat, and ${projected.protein}g protein. These are personalization and tracking guidance, NOT meal-blocking ceilings. Do not reject, shrink, or replace a requested meal solely for exceeding ordinary calorie, fat, protein, or total-carbohydrate goals. Preserve the requested dish and report honest nutrition so overages can be tracked. Starchy-carbohydrate allowances remain strict. Explicitly configured limits and applicable clinical restrictions still apply independently; never infer them from ordinary macro goals.`
      : nutrition
        ? "- Canonical numeric calorie and macro targets are unavailable. Use a standard meal portion; do not interpret unavailable targets as a zero-calorie budget."
      : null,
    consumedStarch
      ? `- STRICT starchy-carbohydrate authority: ${consumedStarch.remainingGrams}g and ${consumedStarch.mealsRemaining} confirmed starch meal slot(s) remain; exhausted=${consumedStarch.exhausted}. Do not exceed the verified remaining starchy-carbohydrate grams. Planned meals may create a projected conflict but cannot change consumed exhaustion.`
      : null,
    nutrition?.activeConstraints.projectedStarchConflict
      ? "- Projected starch conflict is active: avoid adding another starchy allocation unless an authorized workflow explicitly replaces a reservation."
      : null,
    "- Clinical adaptation may change ingredients, amounts, and technique, but must not silently erase the requested cuisine or named dish identity.",
  ].filter(Boolean);

  return lines.join("\n");
}
