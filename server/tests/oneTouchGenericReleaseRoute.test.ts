import express from "express";
import request from "supertest";
import type { OneTouchDirection } from "@shared/oneTouch";

const saved = new Map<string, any>();
let selectedTitle = "Chocolate Custard";
let primaryIngredients = ["almond milk", "cocoa"];
let recipe: any;
let diabetesEnabled = false;
let glp1Active = false;

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.authUser = { id: "menu-person" };
    next();
  },
}));
jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/diabetesGenerationSnapshot", () => {
  let attemptNumber = 0;
  return {
    resolveDiabetesGenerationAttempt: jest.fn(async (subjectId: string) => {
      const generatedAt = `2026-01-01T00:00:${String(++attemptNumber).padStart(2, "0")}.000Z`;
      return {
        subjectId, resolvedAt: generatedAt,
        glucose: { state: "HIGH", valueMgdl: 130, context: "PRE_MEAL", activePreferences: [] },
        context: {
          hasDiabetes: true, diabetesType: "T2D", hypoHistory: false,
          latestGlucose: {
            value: 130, context: "PRE_MEAL", state: "high-risk",
            recordedAt: new Date("2025-12-31T23:55:00.000Z"), ageMinutes: 5,
          },
        }, profile: { type: "T2D" }, settings: null,
        snapshot: {
          version: 2, generatedBglMgdl: 130, glucoseContext: "PRE_MEAL", bglBucket: "elevated",
          protocolTypeLabel: "Elevated Glucose Support", recommendedBglRange: "Above 120 mg/dL",
          generatedAt, source: "diabetic-builder",
          readingRecordedAt: "2025-12-31T23:55:00.000Z", readingSource: "LOG",
          glucoseState: "HIGH", policyVersion: "diabetic-generation-v2",
        },
      };
    }),
    assertDiabetesAttemptSubject: jest.fn((attempt: { subjectId: string }, subjectId: string) => {
      if (attempt.subjectId !== subjectId) throw new Error("Diabetes generation subject mismatch");
    }),
  };
});
jest.mock("../services/oneTouch/history", () => ({
  readOneTouchHistory: jest.fn(async () => ({
    create_a_dish: [], craving_creator: [], workingSets: Object.fromEntries(saved),
  })),
  saveOneTouchConceptSet: jest.fn(async (_id: string, creator: string, set: unknown) => {
    saved.set(creator, set);
  }),
  appendOneTouchHistory: jest.fn(async () => undefined),
}));
const context = {
  version: "human_food_context_v1", status: "resolved", creator: "craving_creator",
  actorUserId: "menu-person", subjectUserId: "menu-person",
  generationChainId: "chain", correlationId: "correlation",
  resolvedAt: "2026-09-27T00:00:00Z", expiresAt: "2026-09-27T01:00:00Z",
  diet: { stored: ["low_carb"], effective: ["low_carb"], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
  flavor: {
    heat: { available: false }, seasoningIntensity: { available: false },
    broadFlavor: { available: false }, flavorStyle: { available: false },
    cuisine: { available: false, value: null }, cuisineIntensity: { available: false },
    spiceComplexity: { available: false },
  },
  safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
  authorization: { status: "none", waivers: [] },
  nutrition: {
    prescription: { source: "user_default" }, subject: { userId: "menu-person" },
    projectedRemaining: { calories: 1200, carbs: 100, fat: 75 },
    remaining: { calories: 1200, carbs: 100, fat: 75 },
    activeConstraints: { consumedStarchExhausted: false },
  },
  diabetesFoodPreferences: null, gaps: [], notices: [], blockedReasons: [],
};
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: jest.fn(({ dietOverride }: { dietOverride?: string | null }) => ({
    resolve: async () => ({
      ...context,
      diet: { ...context.diet, effective: dietOverride ? [dietOverride] : context.diet.effective },
    }),
    executionState: { rejectedCandidateSignatures: [] },
    completeAuthorization: async () => undefined,
  })),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({ buildCreatorHumanFoodPrompt: jest.fn(() => "") }));
jest.mock("../services/allergyGuardrails", () => ({
  ...jest.requireActual("../services/allergyGuardrails"),
  buildDietPromptBlock: jest.fn(() => ""),
}));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: jest.fn(async () => ({ result: "SAFE" })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(async () => ({
    dietaryIdentity: ["low_carb"], allergies: [], hasDiabetes: diabetesEnabled,
    diabeticGlucoseState: diabetesEnabled ? "normal" : null,
    medicalHardLimits: [], medicalOptimization: [], glp1DailyTolerance: null,
  })),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "" })),
  scanGeneratedOutput: jest.fn(() => ({ passed: true })),
  filterMealsByProtocol: jest.fn((meals: unknown[]) => meals),
}));
jest.mock("../services/dishAdaptation/dishAdaptationLayer", () => ({
  buildGuardrailContext: jest.fn((input: unknown) => input),
  getDishAdaptationDirective: jest.fn(async () => null),
}));
jest.mock("../services/oneTouch/dietAuthority", () => ({
  withOneTouchDiet: jest.fn((envelope: unknown) => envelope),
  mutableProfileStyles: jest.fn(() => ["low_carb"]),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(async () => ({
    isActive: glp1Active,
    resolvedTargets: glp1Active ? { resolvedMealCalories: 450 } : null,
  })),
  buildGLP1RecommendationBlock: jest.fn(() => ""),
}));
jest.mock("../services/guardrails", () => ({
  validateMealForDiet: jest.fn(({ macros }: { macros: { calories: number } }) =>
    ({ isValid: macros.calories <= 450 })),
}));
jest.mock("../services/guardrails/validators/diabeticValidator", () => ({
  validateDiabeticMeal: jest.fn(({ macros }: { macros: { carbs: number } }) =>
    ({ isValid: macros.carbs <= 40 })),
}));
jest.mock("../services/oneTouch/contextFingerprint", () => ({
  oneTouchContextFingerprint: jest.fn(() => "stable-context"),
  oneTouchChangedAuthorityBranches: jest.fn(() => []),
}));
jest.mock("../services/unifiedMealPipeline", () => ({
  generateCravingMealOptions: jest.fn(async () => [{
    ...recipe,
    id: "generated-meal", carbs: recipe.starchyCarbs + recipe.fibrousCarbs,
    imageUrl: "", source: "ai",
  }]),
}));
jest.mock("../services/foodAdaptation/contextualFoodEvidence", () => ({
  resolveContextualFoodEvidence: jest.fn(async () => [
    { ingredient: "unsweetened cocoa powder", category: "non_starchy_fibrous", role: "structural", reason: "Named plant source." },
    { ingredient: "vanilla extract", category: "nonmaterial", role: "flavoring", reason: "Measured flavoring." },
  ]),
}));
jest.mock("../services/dishAdaptation/dishIdentityValidator", () => ({
  validateDishIdentity: jest.fn(() => ({ passed: true, catastrophicDeviation: false })),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(async () => "/meal.png"),
  normalizeMealTypeToSourceType: jest.fn(() => "meal"),
}));
jest.mock("../services/oneTouch/directions", () => ({
  validateOneTouchDirectionSafety: jest.fn(() => []),
  validateDishConcept: jest.fn(() => []),
  generateOneTouchDirections: jest.fn(async ({ occasion }: { occasion: "lunch" | "snack" }) => ({
    directions: [1, 2, 3].map((n) => ({
      title: n === 1 ? selectedTitle : `${selectedTitle} ${n}`,
      description: "A complete prepared dish.", primaryIngredients,
      primaryProtein: primaryIngredients[0], produceItems: [],
      cuisine: "American", dietaryEvidence: [], preparationMethod: "prepared",
      signature: `concept-${n}`,
      culinaryIdentity: {
        dishForm: "bowl", preparationStyle: "prepared", temperature: "chilled",
        primaryProteinBase: null, majorStarchBase: null, flavorFamily: "mild",
        cuisineEvidence: "American", definingComponents: primaryIngredients,
      }, occasion,
    } as OneTouchDirection)),
    attemptsCompleted: 1,
  })),
}));

describe("Development Creator Menu selection returns completed cards, not just ideas", () => {
  let app: express.Express;
  const previousEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = "development";
    app = express();
    app.use(express.json());
    app.use("/api/one-touch-create", require("../routes/oneTouchCreate").default());
  });
  afterAll(() => { process.env.NODE_ENV = previousEnv; });
  beforeEach(() => {
    jest.clearAllMocks();
    saved.clear();
    diabetesEnabled = false;
    glp1Active = false;
    context.status = "resolved";
    context.gaps = [];
    context.diet.effective = ["low_carb"];
    context.safety.allergies = [];
    context.safety.avoidedFoods = [];
    context.safety.healthConditions = [];
  });

  it.each([
    ["craving_creator", "food", "Zucchini Noodle Bowl", ["zucchini", "chicken"], ["zucchini noodles", "chicken breast", "cauliflower rice"]],
    ["craving_creator", "dessert", "Chocolate Custard", ["almond milk", "cocoa"], ["unsweetened almond milk", "unsweetened cocoa powder", "vanilla extract"]],
    ["create_a_dish", "food", "Creamy Zucchini Bowl", ["almond milk", "zucchini"], ["unsweetened almond milk", "zucchini"]],
  ] as const)("%s %s returns a complete card through the real completion service", async (
    creator, cravingType, title, required, names,
  ) => {
    selectedTitle = title;
    primaryIngredients = [...required];
    recipe = {
      name: title, description: `Prepared ${title}.`,
      ingredients: names.map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Combine and prepare all named ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 12, fat: 20,
      cookingTime: "20 minutes",
    };
    const choices = {
      creator, servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" },
      ...(creator === "craving_creator" ? { cravingType, cravingFeel: "light" } : {}),
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    expect(concepts.status).toBe(200);
    expect(concepts.body.concepts).toHaveLength(3);
    if (cravingType === "dessert") {
      expect(concepts.body.concepts.every((idea: { title: string }) => idea.title.includes("Custard"))).toBe(true);
    }
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal).toMatchObject({
      name: title, nutritionSource: "model_estimate",
      ingredients: expect.arrayContaining(names.map((name) => expect.objectContaining({ name }))),
    });
    const slot = creator === "craving_creator" ? "snack" : "lunch";
    expect(require("../services/glp1/resolveGLP1GlobalContext").resolveGLP1GlobalContext)
      .toHaveBeenLastCalledWith("menu-person", expect.any(String), slot);
  });

  it("finishes an accepted Create a Dish idea when only non-blocking profile preferences are missing", async () => {
    context.status = "resolved_with_gaps";
    context.gaps = ["flavor.heat"];
    selectedTitle = "Tofu Zucchini Bowl";
    primaryIngredients = ["tofu", "zucchini"];
    recipe = {
      name: selectedTitle, description: "A prepared tofu and zucchini bowl.",
      ingredients: ["tofu", "zucchini noodles"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook tofu and zucchini.",
      calories: 310, protein: 20, starchyCarbs: 0, fibrousCarbs: 12, fat: 18,
    };
    const choices = {
      creator: "create_a_dish", servings: 1,
      cuisine: { mode: "explicit", value: "american" }, eatingStyle: { mode: "profile" },
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    expect(concepts.status).toBe(200);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal).toMatchObject({ name: selectedTitle, nutritionSource: "model_estimate" });
  });

  it("repairs a varied dish that omitted defining ingredients without accepting the wrong card", async () => {
    selectedTitle = "Spicy Turkey Lettuce Wraps";
    primaryIngredients = ["ground turkey", "lettuce leaves", "ginger", "garlic"];
    recipe = {
      name: selectedTitle, description: "Turkey and aromatics wrapped in lettuce.",
      ingredients: primaryIngredients.map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook turkey with aromatics and serve in lettuce.",
      calories: 320, protein: 28, starchyCarbs: 0, fibrousCarbs: 10, fat: 16,
    };
    const generator = require("../services/unifiedMealPipeline").generateCravingMealOptions as jest.Mock;
    generator.mockResolvedValueOnce([{
      ...recipe, id: "variant", ingredients: recipe.ingredients.slice(0, 2),
      carbs: 10, source: "ai",
    }]);
    const choices = {
      creator: "create_a_dish", servings: 1,
      cuisine: { mode: "profile" }, eatingStyle: { mode: "profile" },
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal.name).toBe(selectedTitle);
    expect(chosen.body.meal.ingredients).toEqual(expect.arrayContaining(
      primaryIngredients.map((name) => expect.objectContaining({ name })),
    ));
    expect(generator).toHaveBeenCalledTimes(2);
    expect(generator.mock.calls[1][0]).toContain("SELECTED DISH IDENTITY REPAIR");
  });

  it("still rejects an allergen introduced by the identity repair", async () => {
    selectedTitle = "Spicy Turkey Lettuce Wraps";
    primaryIngredients = ["ground turkey", "lettuce leaves", "ginger"];
    context.safety.allergies = ["shellfish"];
    recipe = {
      name: selectedTitle, description: "Spicy turkey in lettuce.",
      ingredients: [...primaryIngredients, "shellfish"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook turkey and serve in lettuce.",
      calories: 320, protein: 28, starchyCarbs: 0, fibrousCarbs: 10, fat: 16,
    };
    const generator = require("../services/unifiedMealPipeline").generateCravingMealOptions as jest.Mock;
    generator.mockResolvedValueOnce([{
      ...recipe, id: "variant", ingredients: recipe.ingredients.slice(0, 2),
      carbs: 10, source: "ai",
    }]);
    const choices = {
      creator: "create_a_dish", servings: 1,
      cuisine: { mode: "profile" }, eatingStyle: { mode: "profile" },
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(422);
    expect(chosen.body.meal).toBeUndefined();
    expect(generator).toHaveBeenCalledTimes(2);
  });

  it("scales the same card's flat macros, nutrition and ingredients together", async () => {
    selectedTitle = "Zucchini Noodle Bowl";
    primaryIngredients = ["zucchini", "chicken"];
    recipe = {
      name: selectedTitle, description: "A prepared zucchini bowl.",
      ingredients: ["zucchini noodles", "chicken breast"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook all ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 12, fat: 20,
    };
    const choices = {
      creator: "craving_creator", servings: 3, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal).toMatchObject({
      calories: 960, protein: 54, carbs: 36, fat: 60,
      nutrition: { calories: 960, protein: 54, carbs: 36, fat: 60, starchyCarbs: 0 },
      servingSize: "3 servings",
      ingredients: [
        expect.objectContaining({ name: "zucchini noodles", quantity: "3" }),
        expect.objectContaining({ name: "chicken breast", quantity: "3" }),
      ],
    });
  });

  it("uses a server-validated temporary Builder diet instead of the stored profile style", async () => {
    selectedTitle = "Tofu Zucchini Bowl";
    primaryIngredients = ["tofu", "zucchini"];
    recipe = {
      name: selectedTitle, description: "A tofu and zucchini bowl.",
      ingredients: ["tofu", "zucchini noodles"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook tofu and zucchini.",
      calories: 310, protein: 20, starchyCarbs: 0, fibrousCarbs: 12, fat: 18,
    };
    const choices = {
      creator: "create_a_dish", servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "explicit", value: "vegan" },
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    const variety = require("../services/unifiedMealPipeline").generateCravingMealOptions as jest.Mock;
    expect(variety.mock.calls.at(-1)?.[3]).toEqual(["vegan"]);
    expect(variety.mock.calls.at(-1)?.[14]).toEqual(["low_carb"]);
    expect(require("../services/safetyProfileService").enforceSafetyProfile)
      .toHaveBeenCalledWith("menu-person", expect.objectContaining({ kind: "food_intent", requestedDish: selectedTitle }), "menu-selected-concept",
        expect.objectContaining({ ignoredDietaryRestrictions: ["low_carb"] }));
  });

  it("preserves Vegan plus Low Carb without accepting an animal ingredient", async () => {
    context.diet.effective = ["vegan", "low_carb"];
    selectedTitle = "Tofu Zucchini Bowl";
    primaryIngredients = ["tofu", "zucchini"];
    recipe = {
      name: selectedTitle, description: "A tofu and zucchini bowl.",
      ingredients: ["tofu", "zucchini noodles", "cauliflower rice"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook tofu and vegetables.",
      calories: 310, protein: 20, starchyCarbs: 0, fibrousCarbs: 12, fat: 18,
    };
    const choices = { creator: "create_a_dish", servings: 1, cuisine: { mode: "profile" }, eatingStyle: { mode: "profile" } };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal.ingredients.map((item: { name: string }) => item.name))
      .toEqual(expect.arrayContaining(["tofu", "zucchini noodles", "cauliflower rice"]));
  });

  it.each(["allergy", "avoidance", "identity"] as const)("does not return a card on %s conflict", async (conflict) => {
    selectedTitle = "Zucchini Noodle Bowl";
    primaryIngredients = ["zucchini", "chicken"];
    recipe = {
      name: conflict === "identity" ? "Unrelated Rice Bowl" : selectedTitle,
      description: "Prepared bowl.",
      ingredients: (conflict === "identity" ? ["brown rice", "beans"] : ["zucchini noodles", "chicken breast"])
        .map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook all named ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 12, fat: 20,
    };
    if (conflict === "allergy") context.safety.allergies = ["chicken"];
    if (conflict === "avoidance") context.safety.avoidedFoods = ["zucchini"];
    const choices = {
      creator: "craving_creator", servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(422);
    expect(chosen.body.meal).toBeUndefined();
  });

  it("does not return a card when the clinical evidence is unresolved", async () => {
    selectedTitle = "Zucchini Noodle Bowl";
    primaryIngredients = ["zucchini", "chicken"];
    recipe = {
      name: selectedTitle, description: "Prepared bowl.",
      ingredients: ["zucchini noodles", "chicken breast"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook the ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 12, fat: 20,
    };
    context.safety.healthConditions = ["diabetes"];
    const choices = {
      creator: "craving_creator", servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(422);
    expect(chosen.body.meal).toBeUndefined();
  });

  it("rejects a specialist hard limit that a protocol text scan cannot prove", async () => {
    selectedTitle = "Zucchini Noodle Bowl";
    primaryIngredients = ["zucchini", "chicken"];
    recipe = {
      name: selectedTitle, description: "Prepared bowl.",
      ingredients: ["zucchini noodles", "chicken breast"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook the ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 12, fat: 20,
    };
    context.safety.healthConditions = ["renal disease"];
    const choices = {
      creator: "craving_creator", servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(422);
    expect(chosen.body.meal).toBeUndefined();
    expect(require("../services/unifiedMealPipeline").generateCravingMealOptions).not.toHaveBeenCalled();
  });

  it.each(["glp1", "diabetes"] as const)(
    "checks a three-serving %s card against per-serving clinical nutrition",
    async (clinical) => {
      selectedTitle = "Zucchini Noodle Bowl";
      primaryIngredients = ["zucchini", "chicken"];
      recipe = {
        name: selectedTitle, description: "A prepared zucchini bowl.",
        ingredients: ["zucchini noodles", "chicken breast"].map((name) => ({ name, quantity: "1", unit: "cup" })),
        instructions: "Cook the ingredients.",
        calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: clinical === "diabetes" ? 25 : 12, fat: 20,
      };
      glp1Active = clinical === "glp1";
      diabetesEnabled = clinical === "diabetes";
      context.safety.healthConditions = [clinical === "glp1" ? "GLP-1" : "diabetes"];
      const choices = {
        creator: "craving_creator", servings: 3, cuisine: { mode: "profile" },
        eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
      };
      const concepts = await request(app).post("/api/one-touch-create").send(choices);
      const chosen = await request(app).post("/api/one-touch-create/choose").send({
        request: choices, conceptId: concepts.body.concepts[0].id,
      });
      expect(chosen.status).toBe(200);
      expect(chosen.body.meal.nutrition.calories).toBe(960);
      if (clinical === "glp1") {
        expect(require("../services/guardrails").validateMealForDiet).toHaveBeenLastCalledWith(
          expect.objectContaining({ macros: expect.objectContaining({ calories: 320 }) }),
          "glp1", undefined, true, expect.anything(),
        );
      } else {
        expect(require("../services/guardrails/validators/diabeticValidator").validateDiabeticMeal)
          .toHaveBeenLastCalledWith(
            expect.objectContaining({ macros: expect.objectContaining({ carbs: 25 }) }),
            expect.anything(),
          );
      }
    },
  );

  it("uses one frozen diabetic attempt for selected-concept generation, validation, and meal provenance", async () => {
    diabetesEnabled = true;
    context.safety.healthConditions = ["diabetes"];
    selectedTitle = "Zucchini Noodle Bowl";
    primaryIngredients = ["zucchini", "chicken"];
    recipe = {
      name: selectedTitle, description: "A prepared zucchini bowl.",
      ingredients: ["zucchini noodles", "chicken breast"].map((name) => ({ name, quantity: "1", unit: "cup" })),
      instructions: "Cook the ingredients.",
      calories: 320, protein: 18, starchyCarbs: 0, fibrousCarbs: 10, fat: 20,
    };
    const choices = {
      creator: "craving_creator", servings: 1, cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" }, cravingType: "food", cravingFeel: "light",
    };
    const concepts = await request(app).post("/api/one-touch-create").send(choices);
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    const attempts = require("../services/protocolEnvelope").loadUserProtocolEnvelope.mock.calls
      .map((call: any[]) => call[2]?.diabetesAttempt).filter(Boolean);
    const chooseAttempt = attempts[2];
    const envelopeReads = require("../services/protocolEnvelope").loadUserProtocolEnvelope.mock.calls;
    expect(envelopeReads[0][2]).toEqual({
      includeDailyNutritionState: false, skipDiabetesGlucose: true,
    });
    expect(envelopeReads[4][2]).toEqual({
      includeDailyNutritionState: false, skipDiabetesGlucose: true,
    });
    expect(envelopeReads[5][2]).toEqual({ diabetesAttempt: chooseAttempt });
    const generationCalls = require("../services/unifiedMealPipeline").generateCravingMealOptions.mock.calls;
    expect(generationCalls.at(-1)?.[18]).toBe(chooseAttempt);
    expect(chosen.body.meal.diabeticMemory).toEqual(chooseAttempt.snapshot);
    expect(chosen.body.meal.diabeticMemory).toMatchObject({ generatedBglMgdl: 130, bglBucket: "elevated" });
    expect(require("../services/guardrails/validators/diabeticValidator").validateDiabeticMeal)
      .toHaveBeenCalledWith(expect.any(Object), {
        glucoseState: chooseAttempt.context.latestGlucose.state,
      });
    expect(chooseAttempt.context.latestGlucose.state).toBe("high-risk");
  });
});