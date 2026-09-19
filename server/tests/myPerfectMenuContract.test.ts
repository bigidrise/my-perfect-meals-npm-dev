import {
  emptyMyPerfectMenuPreferences,
  myPerfectMenuConceptSchema,
  myPerfectMenuPreferencesSchema,
} from "../../shared/myPerfectMenu";

const concept = {
  id: "concept-123",
  ideaType: "breakfast",
  title: "Herbed Egg Breakfast Plate",
  description: "Eggs, roasted potatoes, tomatoes, and whole-grain toast.",
  primaryIngredients: ["eggs", "potatoes", "tomatoes", "whole-grain bread"],
  primaryProtein: "eggs",
  produceItems: ["potatoes", "tomatoes"],
  cuisine: "American",
  dietaryEvidence: [],
  preparationMethod: "skillet and roast",
  signature: "breakfast-plate|eggs|skillet-roast",
};

describe("My Perfect Menu persistence contract", () => {
  it("starts with independent empty category sets", () => {
    expect(emptyMyPerfectMenuPreferences()).toEqual(expect.objectContaining({
      version: 1,
      categories: {},
      recentSignatures: [],
    }));
  });

  it("accepts bounded structured concept evidence without becoming a recipe", () => {
    expect(myPerfectMenuConceptSchema.safeParse(concept).success).toBe(true);
    expect("instructions" in concept).toBe(false);
    expect("nutrition" in concept).toBe(false);
  });

  it("requires exactly three concepts in each persisted category", () => {
    const base = {
      version: 1,
      recentSignatures: [],
      updatedAt: new Date().toISOString(),
    };
    expect(myPerfectMenuPreferencesSchema.safeParse({
      ...base,
      categories: { breakfast: [concept, { ...concept, id: "concept-456" }] },
    }).success).toBe(false);
    expect(myPerfectMenuPreferencesSchema.safeParse({
      ...base,
      categories: {
        breakfast: [
          concept,
          { ...concept, id: "concept-456", signature: "bowl|chicken|baked" },
          { ...concept, id: "concept-789", signature: "toast|salmon|toasted" },
        ],
      },
    }).success).toBe(true);
  });

  it("rejects unbounded concept metadata", () => {
    expect(myPerfectMenuConceptSchema.safeParse({
      ...concept,
      primaryIngredients: Array.from({ length: 11 }, (_, index) => `ingredient-${index}`),
    }).success).toBe(false);
  });
});