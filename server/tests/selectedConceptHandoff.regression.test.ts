import type { OneTouchDirection } from "@shared/oneTouch";

const generate = jest.fn();
const preflight = jest.fn();
jest.mock("../services/unifiedMealPipeline", () => ({ generateCravingMealOptions: (...args: unknown[]) => generate(...args) }));
jest.mock("../services/safetyProfileService", () => ({ enforceSafetyProfile: (...args: unknown[]) => preflight(...args) }));
jest.mock("../services/oneTouch/directions", () => ({
  validateOneTouchDirectionSafety: jest.fn(() => []),
  validateDishConcept: jest.fn(() => []),
}));
jest.mock("../services/dishAdaptation/dishAdaptationLayer", () => ({
  buildGuardrailContext: jest.fn(() => ({})),
  getDishAdaptationDirective: jest.fn(async () => null),
}));
jest.mock("../services/dishAdaptation/dishIdentityValidator", () => ({
  validateDishIdentity: jest.fn(() => ({ passed: true, catastrophicDeviation: false })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  enforceBeforeGenerate: jest.fn(() => ({ combined: "No shellfish ingredients or derivatives." })),
  scanGeneratedOutput: jest.fn((meal: any) => ({
    passed: !meal.ingredients.some((i: any) => /shrimp/i.test(i.name)),
  })),
  filterMealsByProtocol: jest.fn((meals: any[]) =>
    meals.filter((meal) => !meal.ingredients.some((i: any) => /shrimp/i.test(i.name)))),
}));
jest.mock("../services/humanFoodContext/validateHumanFoodResult", () => ({
  validateHumanFoodResult: jest.fn(() => ({ valid: true, violations: [] })),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({
  validateHumanFoodCandidate: jest.fn(() => ({ outcome: "pass" })),
}));
jest.mock("../services/humanFoodContext/enforceFinalCreatorCandidates", () => ({
  enforceFinalCreatorCandidates: jest.fn(async ({ candidates }: any) => ({ accepted: candidates })),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({ buildCreatorHumanFoodPrompt: jest.fn(() => "") }));
jest.mock("../services/humanFoodContext/servingNutrition", () => ({
  toPerServingNutrition: jest.fn((meal: any) => meal),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(async () => "/images/meal.jpg"),
  normalizeMealTypeToSourceType: jest.fn(() => "meal"),
}));

import { completeSelectedConcept } from "../services/oneTouch/selectedConceptHandoff";

const concept = (title: string, ingredients: string[]): OneTouchDirection => ({
  title, description: `A ${title} made from ${ingredients.join(" and ")}.`,
  primaryIngredients: ingredients, primaryProtein: ingredients[0], produceItems: ingredients.slice(1),
  cuisine: "Thai", preparationMethod: "stir-fry", signature: "beef-vegetables",
  dietaryEvidence: [], occasion: "lunch",
  culinaryIdentity: {
    dishForm: "stir-fry", preparationStyle: "stir-fry", temperature: "hot",
    primaryProteinBase: ingredients[0], majorStarchBase: null, flavorFamily: "savory",
    cuisineEvidence: "Thai", definingComponents: ingredients,
  },
});

const input = (direction: OneTouchDirection) => ({
  actorUserId: "test-user",
  creator: "create_a_dish" as const,
  concept: direction,
  servings: 1,
  cuisine: null,
  context: {
    status: "resolved", subjectUserId: "test-user",
    safety: { healthConditions: [], allergies: ["shellfish"] },
    diet: { effective: [] }, flavor: { cuisine: { available: false, value: null } },
  } as any,
  envelope: { allergies: ["shellfish"], medicalHardLimits: [], hasDiabetes: false } as any,
  glp1: { isActive: false, resolvedTargets: null } as any,
  overriddenDietaryIdentities: [],
});

describe("selected Creator Menu concept handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preflight.mockResolvedValue({ result: "SAFE" });
    generate.mockImplementation(async (prompt: string) => [{
      name: prompt.split("\n")[0],
      description: "Shellfish-free beef and cauliflower.",
      ingredients: [
        { name: "beef", quantity: "6", unit: "oz" },
        { name: "cauliflower", quantity: "1/2", unit: "cup" },
      ],
      instructions: ["Heat the pan.", "Cook the beef and cauliflower."],
      calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
  });

  it.each(["create_a_dish", "craving_creator"] as const)(
    "lets %s generate a beef stir-fry, retaining explicit allergy constraints and ordered steps",
    async (creator) => {
      const direction = concept("Spicy Beef and Cauliflower Stir-Fry", ["beef", "cauliflower"]);
      if (creator === "craving_creator") direction.occasion = "snack";
      const result = await completeSelectedConcept({ ...input(direction), creator });
      expect(preflight).toHaveBeenCalledWith("test-user", expect.objectContaining({
        kind: "food_intent",
        requestedDish: direction.title,
        explicitIngredients: direction.primaryIngredients,
      }), "menu-selected-concept",
        expect.objectContaining({ safetyMode: "STRICT", ignoredDietaryRestrictions: [] }));
      expect(generate.mock.calls[0][0]).toContain("No shellfish ingredients or derivatives.");
      expect(result.ok).toBe(true);
      expect(result).toMatchObject({ meal: {
        ingredients: expect.arrayContaining([{ name: "cauliflower", quantity: "0.5", unit: "cup" }]),
      } });
      if (result.ok) expect(result.meal.instructions).toEqual(["Heat the pan.", "Cook the beef and cauliflower."]);
    },
  );

  it("blocks an explicit shrimp concept before generation", async () => {
    preflight.mockResolvedValue({ result: "BLOCKED" });
    const result = await completeSelectedConcept(input(concept("Shrimp Stir-Fry", ["shrimp", "cauliflower"])));
    expect(result).toEqual({ ok: false, code: "concept_rejected" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("exempts only a requested dish label in final checks, not shellfish ingredients", async () => {
    const direction = concept("Chicken Gumbo", ["chicken", "okra"]);
    generate.mockImplementation(async () => [{
      name: "Chicken Gumbo", description: "Gumbo without shellfish.",
      ingredients: [
        { name: "chicken", quantity: "6", unit: "oz" },
        { name: "okra", quantity: "1", unit: "cup" },
      ], instructions: ["Simmer chicken and okra."],
      calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
    const result = await completeSelectedConcept(input(direction));
    expect(result.ok).toBe(true);
    const { scanGeneratedOutput, filterMealsByProtocol } = require("../services/protocolEnvelope");
    expect(scanGeneratedOutput).toHaveBeenCalledWith(expect.any(Object), expect.any(Object),
      expect.objectContaining({ exemptDishNameTerms: new Set(["gumbo"]) }));
    expect(filterMealsByProtocol).toHaveBeenCalledWith(expect.any(Array), expect.any(Object),
      expect.objectContaining({ exemptDishNameTerms: new Set(["gumbo"]) }));
  });

  it("rejects a generated recipe containing an actual prohibited ingredient", async () => {
    generate.mockImplementation(async () => [{
      name: "Spicy Beef and Cauliflower Stir-Fry", description: "Stir-fry",
      ingredients: [
        { name: "beef", quantity: "6", unit: "oz" },
        { name: "cauliflower", quantity: "1", unit: "cup" },
        { name: "shrimp", quantity: "1", unit: "oz" },
      ], instructions: ["Cook the shrimp."],
      calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
    const result = await completeSelectedConcept(input(concept("Spicy Beef and Cauliflower Stir-Fry", ["beef", "cauliflower"])));
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "final_validation_rejected" });
  });

  it("rejects an unparseable ingredient quantity instead of returning an invalid meal card", async () => {
    generate.mockImplementation(async (prompt: string) => [{
      name: prompt.split("\n")[0], description: "Beef and cauliflower.",
      ingredients: [
        { name: "beef", quantity: { unexpected: "6" }, unit: "oz" },
        { name: "cauliflower", quantity: "1", unit: "cup" },
      ],
      instructions: ["Cook the beef and cauliflower."],
      calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
    const result = await completeSelectedConcept(input(concept("Beef and Cauliflower Stir-Fry", ["beef", "cauliflower"])));
    expect(result).toEqual({ ok: false, code: "final_validation_rejected" });
  });

  it("will not silently replace the selected dish", async () => {
    generate.mockImplementation(async () => [{
      name: "Unrelated chicken soup", description: "Soup",
      ingredients: [{ name: "chicken", quantity: "6", unit: "oz" }],
      instructions: ["Simmer."], calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
    const result = await completeSelectedConcept(input(concept("Beef and Cauliflower Stir-Fry", ["beef", "cauliflower"])));
    expect(result).toEqual({ ok: false, code: "identity_mismatch" });
  });

  it("accepts concrete Gomen ingredients under ordinary singular/plural preparation wording", async () => {
    const direction = concept("Gomen (Ethiopian Collard Greens)", [
      "collard greens", "onions", "garlic", "niter kibbeh", "turmeric", "injera",
    ]);
    generate.mockResolvedValue([{
      name: "Gomen (Ethiopian Collard Greens)", description: "Ethiopian collard greens.",
      ingredients: ["chopped collard greens", "red onion", "minced garlic", "niter kibbeh",
        "ground turmeric", "injera"].map(name => ({ name, quantity: "1", unit: "tbsp" })),
      instructions: ["Cook the greens and serve with injera."],
      calories: 400, protein: 30, carbs: 20, fat: 15, imageUrl: "",
    }]);
    const result = await completeSelectedConcept(input(direction));
    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("still rejects a missing concrete Gomen ingredient after the targeted repair", async () => {
    const direction = concept("Gomen (Ethiopian Collard Greens)", [
      "collard greens", "onions", "garlic", "niter kibbeh", "turmeric", "injera",
    ]);
    generate.mockResolvedValue([{
      name: "Gomen (Ethiopian Collard Greens)", description: "Ethiopian collard greens.",
      ingredients: ["collard greens", "red onion", "garlic", "olive oil", "turmeric",
        "injera"].map(name => ({ name, quantity: "1", unit: "tbsp" })),
      instructions: ["Cook the greens."], calories: 400, protein: 30, carbs: 20, fat: 15,
    }]);
    const result = await completeSelectedConcept(input(direction));
    expect(result).toEqual({ ok: false, code: "identity_mismatch" });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("rejects old abstract ingredient cards before spending time generating recipes", async () => {
    const { validateDishConcept } = require("../services/oneTouch/directions");
    validateDishConcept.mockReturnValueOnce(["culinary_shape:abstract_primary_ingredient"]);
    const result = await completeSelectedConcept(input(concept("Gomen", ["collard greens", "spices"])));
    expect(result).toEqual({ ok: false, code: "concept_rejected", reasonCode: "abstract_primary_ingredient" });
    expect(generate).not.toHaveBeenCalled();
  });
});