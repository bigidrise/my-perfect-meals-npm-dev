import express from "express";
import request from "supertest";
import type { OneTouchDirection } from "@shared/oneTouch";

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.authUser = { id: "menu-test-person" };
    next();
  },
}));
jest.mock("../services/oneTouch/menuRecipeCompletion", () => ({ completeMenuRecipe: jest.fn() }));
jest.mock("../services/oneTouch/directions", () => ({ generateOneTouchDirections: jest.fn() }));
jest.mock("../services/oneTouch/history", () => ({
  readOneTouchHistory: jest.fn(async () => ({ create_a_dish: [], craving_creator: [] })),
  appendOneTouchHistory: jest.fn(async () => undefined),
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: jest.fn(() => ({
    resolve: async () => ({
      status: "resolved", diet: { effective: ["vegan"] },
      flavor: { cuisine: { available: false, value: null } }, notices: [],
    }),
    executionState: {},
  })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(async () => ({ medicalHardLimits: [], medicalOptimization: [] })),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "" })),
}));
jest.mock("../services/oneTouch/dietAuthority", () => ({
  withOneTouchDiet: jest.fn((envelope: unknown) => envelope),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({
  buildCreatorHumanFoodPrompt: jest.fn(() => ""),
}));
jest.mock("../services/allergyGuardrails", () => ({
  buildDietPromptBlock: jest.fn(() => ""),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(async () => ({ isActive: false, resolvedTargets: null })),
  buildGLP1RecommendationBlock: jest.fn(() => ""),
}));
jest.mock("../services/oneTouch/contextFingerprint", () => ({
  oneTouchContextFingerprint: jest.fn(() => "test-fingerprint"),
  oneTouchChangedAuthorityBranches: jest.fn(() => []),
}));

const choice = (creator: "create_a_dish" | "craving_creator") => ({
  creator, servings: 3, cuisine: { mode: "explicit", value: "italian" },
  eatingStyle: { mode: "explicit", value: "vegan" },
  ...(creator === "craving_creator" ? { cravingType: "food", cravingFeel: "light" } : {}),
});
function concept(n: number, occasion: "snack" | "lunch"): OneTouchDirection {
  return {
    title: `Tomato Lentil Stew ${n}`, description: "Tomatoes and lentils simmered as a stew.",
    primaryIngredients: ["tomatoes", "lentils"], primaryProtein: "lentils",
    produceItems: ["tomatoes"], cuisine: "Italian", dietaryEvidence: [],
    preparationMethod: "simmered", signature: `stew-lentils-${n}`,
    culinaryIdentity: {
      dishForm: "stew", preparationStyle: "simmered", temperature: "hot",
      primaryProteinBase: "lentils", majorStarchBase: null,
      flavorFamily: "tomato", cuisineEvidence: "Italian",
      definingComponents: ["tomatoes", "lentils"],
    }, occasion,
  };
}
function card(name: string) {
  return {
    name, description: "A complete cooked meal.",
    ingredients: [{ name: "lentils", quantity: "3", unit: "cups" }],
    instructions: "Simmer until cooked.", cookingTime: "25 minutes",
    nutrition: { calories: 900, protein: 60, carbs: 75, fat: 15, starchyCarbs: 60 },
    servingSize: "3 servings", nutritionSource: "model_estimate",
  };
}

describe("signed-in Creator Menu route uses one isolated completion per concept", () => {
  let app: express.Express;
  let complete: jest.Mock;
  let directions: jest.Mock;
  let appendHistory: jest.Mock;
  let nextNumber: number;
  const priorEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "development";
    // Import after setting the DEV-only server gate; manual Creator is never imported.
    const router = require("../routes/oneTouchCreate").default;
    app = express();
    app.use(express.json());
    app.use("/api/one-touch-create", router());
    complete = require("../services/oneTouch/menuRecipeCompletion").completeMenuRecipe;
    directions = require("../services/oneTouch/directions").generateOneTouchDirections;
    appendHistory = require("../services/oneTouch/history").appendOneTouchHistory;
  });
  afterAll(() => {
    if (priorEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnv;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    nextNumber = 0;
    directions.mockImplementation(async ({ occasion, targetCount }: {
      occasion: "snack" | "lunch"; targetCount: number;
    }) => ({ directions: Array.from({ length: targetCount }, () => concept(++nextNumber, occasion)) }));
    complete.mockImplementation(async ({ approvedConcept }: { approvedConcept: OneTouchDirection }) =>
      ({ ok: true, card: card(approvedConcept.title) }));
  });

  it.each(["create_a_dish", "craving_creator"] as const)(
    "%s returns exactly three finished cards sequentially, preserving direction and lunch clinical slot",
    async (creator) => {
      let inFlight = 0;
      let peak = 0;
      complete.mockImplementation(async ({ approvedConcept }: { approvedConcept: OneTouchDirection }) => {
        peak = Math.max(peak, ++inFlight);
        await Promise.resolve();
        --inFlight;
        return { ok: true, card: card(approvedConcept.title) };
      });
      const response = await request(app).post("/api/one-touch-create").send(choice(creator));
      expect(response.status).toBe(200);
      expect(response.body.meals).toHaveLength(3);
      expect(response.body.meals[0]).toMatchObject({
        nutritionSource: "model_estimate", servingSize: "3 servings",
        calories: 900, nutrition: { calories: 900 },
      });
      expect(peak).toBe(1);
      expect(complete).toHaveBeenCalledTimes(3);
      expect(directions).toHaveBeenCalledWith(expect.objectContaining({
        occasion: creator === "craving_creator" ? "snack" : "lunch",
        menuShape: creator === "craving_creator" ? "craving" : "dish",
        targetCount: 3,
        cravingType: creator === "craving_creator" ? "food" : "surprise",
      }));
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({
        actorUserId: "menu-test-person",
        subject: { id: "menu-test-person", kind: "account" },
        servings: 3, cuisine: "italian", dietaryDirection: "vegan",
        clinicalMealSlot: "lunch", contextCreator: creator,
      }));
      expect(appendHistory).toHaveBeenCalledTimes(1);
    },
  );

  it("retains two completed siblings and requests only one replacement", async () => {
    complete.mockImplementation(async ({ approvedConcept }: { approvedConcept: OneTouchDirection }) =>
      approvedConcept.title.endsWith("3")
        ? { ok: false, code: "protocol_scan_rejected", retryable: false }
        : { ok: true, card: card(approvedConcept.title) });
    const response = await request(app).post("/api/one-touch-create").send(choice("create_a_dish"));
    expect(response.status).toBe(200);
    expect(response.body.meals.map((meal: { name: string }) => meal.name)).toEqual([
      "Tomato Lentil Stew 1", "Tomato Lentil Stew 2", "Tomato Lentil Stew 4",
    ]);
    expect(directions.mock.calls.map(([input]) => input.targetCount)).toEqual([3, 1]);
    expect(complete).toHaveBeenCalledTimes(4);
  });

  it("returns customer-safe unavailability without fallback when completion cannot prove keto", async () => {
      complete.mockResolvedValue({ ok: false, code: "requirement_evidence_unsupported", retryable: false });
      const response = await request(app).post("/api/one-touch-create").send({
        ...choice("craving_creator"), eatingStyle: { mode: "explicit", value: "keto" },
      });
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: "ONE_TOUCH_REQUIREMENT_UNAVAILABLE" });
      expect(response.body.error).toContain("Your settings have not been changed");
      expect(response.body.error).not.toContain("requirement_evidence_unsupported");
      expect(complete).toHaveBeenCalledTimes(1);
      expect(appendHistory).not.toHaveBeenCalled();
  });

  it("does not retry an unprovable clinical directive or write history", async () => {
    complete.mockResolvedValue({ ok: false, code: "protocol_clinical_rejected", retryable: false });
    const response = await request(app).post("/api/one-touch-create").send(choice("create_a_dish"));
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("ONE_TOUCH_REQUIREMENT_UNAVAILABLE");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(appendHistory).not.toHaveBeenCalled();
  });
});