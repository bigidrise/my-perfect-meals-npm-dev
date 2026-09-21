import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "../../shared/nutritionPriorities";

export function buildNutritionPriorityPromptProjection(
  context: HumanFoodContext,
): string | null {
  const selected = (context.nutritionPriorities?.selectedPriorityIds ?? [])
    .map((id) => FOOD_INCLUSION_PRIORITY_REGISTRY[id])
    .filter((definition) =>
      definition?.status === "active" &&
      (
        context.creator !== "my_perfect_beginning" ||
        definition.pediatricProjection.status === "approved"
      ),
    );
  if (selected.length === 0) return null;

  const guidance = selected.map(
    (definition) => `- ${definition.label}: ${definition.promptSafeCulinaryGuidance}`,
  );
  return [
    "OPTIONAL FOOD INCLUSION PRIORITIES:",
    "Consider each selected priority only when it is safe, relevant, compatible with the person's complete context, and culinarily appropriate.",
    "Omission is valid. Never force an ingredient, reject an otherwise valid meal, create a quota or dosage, or alter an authoritative nutrition target merely to satisfy a priority.",
    "Allergies, safety, dietary identity, medical/protocol authority, the current request, and authoritative nutrition targets remain superior.",
    ...guidance,
  ].join("\n");
}