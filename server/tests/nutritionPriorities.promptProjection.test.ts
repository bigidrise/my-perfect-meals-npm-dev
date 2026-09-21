import { buildNutritionPriorityPromptProjection } from "../services/nutritionPriorityPromptProjection";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "../../shared/nutritionPriorities";

function context(selectedPriorityIds: string[], creator = "create_a_dish") {
  return {
    creator,
    nutritionPriorities: {
      selectedPriorityIds,
      registryVersion: "nutrition-priorities.v1",
    },
  } as any;
}

describe("Nutrition Priorities prompt projection", () => {
  it("projects selected priorities as optional and subordinate guidance", () => {
    const block = buildNutritionPriorityPromptProjection(context([
      "fiber_rich_foods",
      "protein_rich_foods",
    ]));
    expect(block).toContain("Omission is valid");
    expect(block).toContain("Allergies, safety, dietary identity, medical/protocol authority");
    expect(block).toContain("Fiber-Rich Foods");
    expect(block).toContain("Protein-Rich Foods");
    expect(block).toContain("never increase or replace a protein or macro target");
  });

  it("does not project anything for an empty selection", () => {
    expect(buildNutritionPriorityPromptProjection(context([]))).toBeNull();
  });

  it("does not project a deferred pediatric concept into My Perfect Beginnings", () => {
    const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    const previousStatus = definition.pediatricProjection.status;
    definition.pediatricProjection.status = "deferred";
    try {
      expect(
        buildNutritionPriorityPromptProjection(
          context(["fermented_foods"], "my_perfect_beginning"),
        ),
      ).toBeNull();
      expect(buildNutritionPriorityPromptProjection(context(["fermented_foods"]))).toContain(
        "Fermented Foods",
      );
    } finally {
      definition.pediatricProjection.status = previousStatus;
    }
  });
});