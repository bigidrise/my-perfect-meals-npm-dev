import {
  FOOD_INCLUSION_PRIORITY_REGISTRY,
  type FoodInclusionPriorityId,
} from "@shared/nutritionPriorities";

export const CUSTOMER_NUTRITION_PRIORITY_SUMMARY_COPY =
  "Considered when appropriate for your meals.";

export const CLINICAL_NUTRITION_PRIORITY_SUMMARY_COPY =
  "Patient-selected food personalization preferences. Considered when appropriate during meal creation.";

export function resolveActiveNutritionPriorityLabels(
  ids: FoodInclusionPriorityId[] | null | undefined,
): string[] {
  return (ids ?? [])
    .map((id) => FOOD_INCLUSION_PRIORITY_REGISTRY[id])
    .filter((definition) => definition?.status === "active")
    .map((definition) => definition.label);
}