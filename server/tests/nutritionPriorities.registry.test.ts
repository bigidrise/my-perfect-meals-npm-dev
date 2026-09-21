import {
  FOOD_INCLUSION_PRIORITY_REGISTRY,
  NUTRITION_PRIORITIES_REGISTRY_VERSION,
  emptyFoodInclusionPrioritiesDocument,
  foodInclusionPrioritiesWriteSchema,
} from "../../shared/nutritionPriorities";
import {
  getNutritionPriorityEducationEntries,
  NUTRITION_PRIORITY_EDUCATION_POLICY,
  renderNutritionPriorityEducationBlock,
} from "../../shared/nutritionPriorityEducation";

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
      expect(entry.pediatricProjection.status).toBe("approved");
      expect(entry.pediatricProjection.shortSummary).toBeTruthy();
      expect(entry.pediatricProjection.whyChooseIt).toBeTruthy();
      expect(entry.pediatricProjection.whatMpmDoes).toBeTruthy();
      expect(entry.pediatricProjection.limitations.length).toBeGreaterThan(0);
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

  it("projects evidence-bounded adult and pediatric education from one registry", () => {
    const adult = getNutritionPriorityEducationEntries("adult");
    const pediatric = getNutritionPriorityEducationEntries("pediatric");
    expect(adult).toHaveLength(8);
    expect(pediatric).toHaveLength(8);
    for (const item of adult) {
      expect(item.citations.length).toBeGreaterThan(0);
      expect(item.limitations.length).toBeGreaterThan(0);
    }
    for (const item of pediatric) {
      const definition = FOOD_INCLUSION_PRIORITY_REGISTRY[item.id];
      expect(item.shortSummary).toBe(definition.pediatricProjection.shortSummary);
      expect(item.shortSummary).not.toBe(definition.shortSummary);
    }
    expect(NUTRITION_PRIORITY_EDUCATION_POLICY.behavior).toMatch(
      /not a requirement, prescription, dose, or guarantee/i,
    );
  });

  it("preserves the approved food-evidence distinctions", () => {
    const fermented = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    expect(fermented.limitations.join(" ")).toMatch(
      /fermented does not automatically mean probiotic/i,
    );

    const omega3 = FOOD_INCLUSION_PRIORITY_REGISTRY.omega_3_food_sources;
    expect(omega3.whatItIs).toMatch(/EPA\/DHA/);
    expect(omega3.whatItIs).toMatch(/ALA/);
    expect(omega3.limitations.join(" ")).toMatch(/ALA is not equivalent to EPA\/DHA/i);

    const protein = FOOD_INCLUSION_PRIORITY_REGISTRY.protein_rich_foods;
    expect(protein.whatMpmDoes).toMatch(/without creating, increasing, or replacing any macro target/i);

    for (const id of [
      "iron_rich_foods",
      "calcium_rich_foods",
      "magnesium_rich_foods",
    ] as const) {
      const entry = FOOD_INCLUSION_PRIORITY_REGISTRY[id];
      const affirmativeEducation = [
        entry.shortSummary,
        entry.whatItIs,
        entry.whyChooseIt,
        entry.generallySupports,
      ].join(" ");
      expect(affirmativeEducation).not.toMatch(
        /diagnos|deficien|treat|prevent|cure|sleep|anxiety|cramp/i,
      );
    }
  });

  it("keeps every customer citation navigable and centrally owned", () => {
    for (const entry of Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY)) {
      for (const citation of entry.citations) {
        expect(citation.title.trim()).not.toBe("");
        expect(() => new URL(citation.url)).not.toThrow();
        expect(new URL(citation.url).protocol).toMatch(/^https?:$/);
      }
    }
  });

  it("renders a bounded pediatric Copilot block with no adult projection leakage", () => {
    const block = renderNutritionPriorityEducationBlock("pediatric");
    const omega3 = FOOD_INCLUSION_PRIORITY_REGISTRY.omega_3_food_sources;
    expect(block).toContain(omega3.pediatricProjection.whatMpmDoes);
    expect(block).not.toContain(omega3.whatMpmDoes);
    expect(block).toMatch(/explanation only/i);
    expect(block).toMatch(/Do not select, remove, or modify priorities/i);
  });
});