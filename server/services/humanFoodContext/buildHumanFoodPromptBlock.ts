import type { HumanFoodContext } from "../../../shared/humanFoodContext";

function line(label: string, value: string | null | undefined): string | null {
  return value ? `- ${label}: ${value}` : null;
}

export function buildHumanFoodPromptBlock(context: HumanFoodContext): string {
  const flavor = context.flavor;
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
    context.rejectedCandidateSignatures.length
      ? `- Do not repeat these rejected candidates: ${context.rejectedCandidateSignatures.join(" | ")}`
      : null,
    "- Clinical adaptation may change ingredients, amounts, and technique, but must not silently erase the requested cuisine or named dish identity.",
  ].filter(Boolean);

  return lines.join("\n");
}
