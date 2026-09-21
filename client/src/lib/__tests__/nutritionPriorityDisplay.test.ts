import {
  CLINICAL_NUTRITION_PRIORITY_SUMMARY_COPY,
  CUSTOMER_NUTRITION_PRIORITY_SUMMARY_COPY,
  resolveActiveNutritionPriorityLabels,
} from "@/lib/nutritionPriorityDisplay";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "@shared/nutritionPriorities";

describe("Nutrition Priority summary display", () => {
  it("resolves selected stable IDs through the canonical registry", () => {
    expect(resolveActiveNutritionPriorityLabels([
      "fermented_foods",
      "plant_variety",
      "omega_3_food_sources",
    ])).toEqual([
      "Fermented Foods",
      "Plant Variety",
      "Omega-3 Food Sources",
    ]);
  });

  it("omits inactive historical IDs without broken labels or warnings", () => {
    const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    const previousStatus = definition.status;
    definition.status = "inactive";
    try {
      expect(resolveActiveNutritionPriorityLabels([
        "fermented_foods",
        "plant_variety",
      ])).toEqual(["Plant Variety"]);
      expect(resolveActiveNutritionPriorityLabels([])).toEqual([]);
    } finally {
      definition.status = previousStatus;
    }
  });

  it("uses configuration wording rather than consumption or outcome claims", () => {
    expect(CUSTOMER_NUTRITION_PRIORITY_SUMMARY_COPY).toBe(
      "Considered when appropriate for your meals.",
    );
    expect(CLINICAL_NUTRITION_PRIORITY_SUMMARY_COPY).toContain("Patient-selected");
    for (const copy of [
      CUSTOMER_NUTRITION_PRIORITY_SUMMARY_COPY,
      CLINICAL_NUTRITION_PRIORITY_SUMMARY_COPY,
    ]) {
      expect(copy).not.toMatch(/consumed|completed|achieved|deficien|prescribed|guarantee/i);
    }
  });
});