import express from "express";
import request from "supertest";
import type { OneTouchDirection } from "@shared/oneTouch";

const saved = new Map<string, any>();
let selectedTitle = "Chocolate Custard";
let primaryIngredients = ["almond milk", "cocoa"];
let recipe: any;

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.authUser = { id: "menu-person" };
    next();
  },
}));
jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/oneTouch/history", () => ({
  readOneTouchHistory: jest.fn(async () => ({
    create_a_dish: [], craving_creator: [], workingSets: Object.fromEntries(saved),
  })),
  saveOneTouchConceptSet: jest.fn(async (_id: string, creator: string, set: unknown) => {
    saved.set(creator, set);
  }),
  appendOneTouchHistory: jest.fn(async () => undefined),
}));
jest.mock("../services/oneTouch/directions", () => ({
  generateOneTouchDirections: jest.fn(async ({ occasion }: { occasion: "lunch" | "snack" }) => ({
    directions: [1, 2, 3].map((n) => ({
      title: n === 1 ? selectedTitle : `${selectedTitle} ${n}`,
      description: "A complete prepared dish.",
      primaryIngredients, primaryProtein: primaryIngredients[0], produceItems: [],
      cuisine: "American", dietaryEvidence: [],
      preparationMethod: "prepared", signature: `concept-${n}`,
      culinaryIdentity: {
        dishForm: "bowl", preparationStyle: "prepared", temperature: "cold",
        primaryProteinBase: null, majorStarchBase: null, flavorFamily: "mild",
        cuisineEvidence: "American", definingComponents: primaryIngredients,
      }, occasion,
    } as OneTouchDirection)),
    attemptsCompleted: 1,
  })),
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
  createHumanFoodRequestScope: jest.fn(() => ({
    resolve: async () => context, executionState: { rejectedCandidateSignatures: [] },
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
    dietaryIdentity: ["low_carb"], hasDiabetes: false,
    medicalHardLimits: [], medicalOptimization: [], glp1DailyTolerance: null,
  })),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "" })),
  scanGeneratedOutput: jest.fn(() => ({ passed: true })),
}));
jest.mock("../services/oneTouch/dietAuthority", () => ({
  withOneTouchDiet: jest.fn((envelope: unknown) => envelope),
  mutableProfileStyles: jest.fn(() => []),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(async () => ({ isActive: false, resolvedTargets: null })),
  buildGLP1RecommendationBlock: jest.fn(() => ""),
}));
jest.mock("../services/oneTouch/contextFingerprint", () => ({
  oneTouchContextFingerprint: jest.fn(() => "stable-context"),
  oneTouchChangedAuthorityBranches: jest.fn(() => []),
}));
jest.mock("../services/oneTouch/menuRecipeGenerator", () => ({
  generateMenuRecipe: jest.fn(async () => recipe),
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
  generateOneTouchDirections: jest.fn(async ({ occasion }: { occasion: "lunch" | "snack" }) => ({
    directions: [1, 2, 3].map((n) => ({
      title: n === 1 ? selectedTitle : `${selectedTitle} ${n}`,
      description: "A complete prepared dish.", primaryIngredients,
      primaryProtein: primaryIngredients[0], produceItems: [],
      cuisine: "American", dietaryEvidence: [], preparationMethod: "prepared",
      signature: `concept-${n}`,
      culinaryIdentity: {
        dishForm: "bowl", preparationStyle: "prepared", temperature: "cold",
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
  beforeEach(() => { saved.clear(); });

  it.each([
    ["craving_creator", "food", "Zucchini Noodle Bowl", ["zucchini", "chicken"], ["zucchini noodles", "chicken breast"]],
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
    const chosen = await request(app).post("/api/one-touch-create/choose").send({
      request: choices, conceptId: concepts.body.concepts[0].id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.meal).toMatchObject({
      name: title, nutritionSource: "model_estimate",
      ingredients: expect.arrayContaining(names.map((name) => expect.objectContaining({ name }))),
    });
  });
});