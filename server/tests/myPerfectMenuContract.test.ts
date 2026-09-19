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
      recentCulinaryFingerprints: [],
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

  it("keeps maximum-length structured culinary history schema-valid and compact", () => {
    const maxText = "x".repeat(80);
    const culinaryConcept = {
      ...concept,
      culinaryIdentity: {
        dishForm: maxText,
        preparationStyle: maxText,
        texture: maxText,
        temperature: "warm",
        primaryProteinBase: maxText,
        majorStarchBase: maxText,
        flavorFamily: maxText,
        cuisineEvidence: maxText,
        definingComponents: Array.from({ length: 8 }, () => maxText),
      },
    } as const;
    const { buildCulinaryFingerprint } = require("../../shared/culinaryIdentity");
    const fingerprint = buildCulinaryFingerprint(culinaryConcept, "breakfast");
    const preferences = {
      ...emptyMyPerfectMenuPreferences(),
      categories: {
        breakfast: [
          { ...culinaryConcept, id: "concept-123" },
          { ...culinaryConcept, id: "concept-456" },
          { ...culinaryConcept, id: "concept-789" },
        ],
      },
      recentCulinaryFingerprints: [fingerprint],
      updatedAt: new Date().toISOString(),
    };

    expect(fingerprint.fingerprint.length).toBeLessThanOrEqual(40);
    expect(myPerfectMenuPreferencesSchema.safeParse(preferences).success).toBe(true);
  });

  it.each([
    {
      title: "豆腐麺料理",
      ingredients: ["豆腐", "麺", "白菜"],
      dishForm: "麺料理",
      method: "煮る",
      cuisine: "日本料理",
      flavor: "生姜醤油",
    },
    {
      title: "طبق حمص وخضار",
      ingredients: ["حمص", "طماطم", "بقدونس"],
      dishForm: "طبق مشترك",
      method: "مطهو",
      cuisine: "مطبخ عربي",
      flavor: "ليمون وأعشاب",
    },
  ])("round-trips non-Latin culinary history without losing preferences", (example) => {
    const { buildCulinaryFingerprint } = require("../../shared/culinaryIdentity");
    const unicodeConcept = {
      ...concept,
      title: example.title,
      primaryIngredients: example.ingredients,
      primaryProtein: example.ingredients[0],
      cuisine: example.cuisine,
      preparationMethod: example.method,
      culinaryIdentity: {
        dishForm: example.dishForm,
        preparationStyle: example.method,
        primaryProteinBase: example.ingredients[0],
        majorStarchBase: example.ingredients[1],
        flavorFamily: example.flavor,
        cuisineEvidence: example.cuisine,
        definingComponents: example.ingredients,
      },
    };
    const fingerprint = buildCulinaryFingerprint(unicodeConcept, "lunch");
    const preferences = {
      ...emptyMyPerfectMenuPreferences(),
      categories: {
        lunch: [
          { ...unicodeConcept, id: "concept-123", ideaType: "lunch" },
          { ...unicodeConcept, id: "concept-456", ideaType: "lunch" },
          { ...unicodeConcept, id: "concept-789", ideaType: "lunch" },
        ],
      },
      recentCulinaryFingerprints: [fingerprint],
      updatedAt: new Date().toISOString(),
    };

    const parsed = myPerfectMenuPreferencesSchema.parse(preferences);
    expect(parsed.categories.lunch?.[0].title).toBe(example.title);
    expect(parsed.recentCulinaryFingerprints[0].dishForm).toBe(example.dishForm.replace(/\s+/g, "_"));
    expect(parsed.recentCulinaryFingerprints[0].ingredients.length).toBeGreaterThan(0);
  });
});