import {
  FOOD_INCLUSION_PRIORITY_REGISTRY,
  NUTRITION_PRIORITIES_REGISTRY_VERSION,
  emptyFoodInclusionPrioritiesDocument,
  foodInclusionPrioritiesWriteSchema,
} from "../../shared/nutritionPriorities";

describe("Food Inclusion Priorities registry", () => {
  it("contains exactly the eight approved active concepts", () => {
    const entries = Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY);
    expect(entries).toHaveLength(8);
    expect(entries.every((entry) => entry.status === "active")).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(8);
    expect(NUTRITION_PRIORITIES_REGISTRY_VERSION).toBe("nutrition-priorities.v1");
  });

  it("keeps education, evidence, pediatric explanation, and culinary guidance central", () => {
    for (const entry of Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY)) {
      expect(entry.whatItIs).toBeTruthy();
      expect(entry.whyChooseIt).toBeTruthy();
      expect(entry.generallySupports).toBeTruthy();
      expect(entry.whatMpmDoes).toBeTruthy();
      expect(entry.foodExamples.length).toBeGreaterThan(0);
      expect(entry.limitations.length).toBeGreaterThan(0);
      expect(entry.citations.length).toBeGreaterThan(0);
      expect(entry.parentFacingPediatricExplanation).toBeTruthy();
      expect(entry.promptSafeCulinaryGuidance).toBeTruthy();
    }
  });

  it("accepts empty selections and rejects unknown or deferred IDs", () => {
    expect(foodInclusionPrioritiesWriteSchema.safeParse({
      ...emptyFoodInclusionPrioritiesDocument(),
      updatedAt: undefined,
    }).success).toBe(false);
    expect(foodInclusionPrioritiesWriteSchema.safeParse({
      schemaVersion: 1,
      registryVersion: "nutrition-priorities.v1",
      selectedPriorityIds: [],
    }).success).toBe(true);
    for (const id of ["prebiotic_rich_foods", "potassium_rich_foods", "ginger", "turmeric", "unknown"]) {
      expect(foodInclusionPrioritiesWriteSchema.safeParse({
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: [id],
      }).success).toBe(false);
    }
  });
});