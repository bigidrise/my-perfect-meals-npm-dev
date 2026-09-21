import { buildNutritionPriorityPromptProjection } from "../services/nutritionPriorityPromptProjection";

function context(selectedPriorityIds: string[]) {
  return {
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
});