import express from "express";
import request from "supertest";
import { oneTouchHistorySchema, type OneTouchDirection } from "@shared/oneTouch";

const mockSets = new Map<string, Record<string, any>>();
let mockFingerprint = "a".repeat(43);
let useRealFingerprint = false;
let nutritionCalories = 1900;
let resolutionCount = 0;
let glp1Active = false;
let glp1NutritionCalories = 900;
let glp1ResolutionCount = 0;
const routeFingerprints: string[] = [];

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.authUser = { id: req.headers["x-test-user"] || "menu-person" };
    next();
  },
}));
jest.mock("../services/oneTouch/selectedConceptHandoff", () => ({ completeSelectedConcept: jest.fn() }));
jest.mock("../services/oneTouch/directions", () => ({ generateOneTouchDirections: jest.fn() }));
jest.mock("../services/oneTouch/history", () => ({
  readOneTouchHistory: jest.fn(async (id: string) => ({
    create_a_dish: [], craving_creator: [], ...mockSets.get(id),
  })),
  saveOneTouchConceptSet: jest.fn(async (id: string, creator: string, set: unknown) => {
    mockSets.set(id, { ...mockSets.get(id), workingSets: { ...mockSets.get(id)?.workingSets, [creator]: set } });
  }),
  appendOneTouchHistory: jest.fn(async () => undefined),
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: jest.fn(() => ({
    resolve: async () => {
      const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, resolutionCount++)).toISOString();
      return {
        status: "resolved", diet: { effective: ["vegan"] },
        flavor: { cuisine: { available: false, value: null } }, notices: [],
        subjectUserId: "menu-person",
        authorization: { status: "none", action: null, waivers: [] },
        resolvedAt: stamp,
        nutrition: {
          resolvedAt: stamp, prescription: { calories: nutritionCalories },
          provenance: { calculationTimestamp: stamp },
        },
      };
    },
    executionState: {},
    completeAuthorization: async () => undefined,
  })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(async () => ({
    medicalHardLimits: [], medicalOptimization: ["therapeutic-support", "performance-nutrition"],
  })),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "Optimization guidance" })),
}));
jest.mock("../services/oneTouch/dietAuthority", () => ({
  withOneTouchDiet: jest.fn((envelope: unknown) => envelope),
  mutableProfileStyles: jest.fn(() => []),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({
  buildCreatorHumanFoodPrompt: jest.fn(() => ""),
}));
jest.mock("../services/allergyGuardrails", () => ({
  buildDietPromptBlock: jest.fn(() => ""),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(async () => {
    const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, glp1ResolutionCount++)).toISOString();
    return {
      isActive: glp1Active,
      activationSources: glp1Active ? ["personalNutritionSupport"] : [],
      resolvedTargets: glp1Active ? { resolvedMealCalories: 400 } : null,
      dailyNutritionState: glp1Active ? {
        resolvedAt: stamp,
        remaining: { calories: glp1NutritionCalories },
        provenance: { calculationTimestamp: stamp, prescriptionSource: "macro_calculator" },
      } : null,
    };
  }),
  buildGLP1RecommendationBlock: jest.fn(() => ""),
}));
jest.mock("../services/oneTouch/contextFingerprint", () => {
  const actual = jest.requireActual("../services/oneTouch/contextFingerprint");
  return {
    oneTouchContextFingerprint: jest.fn((...args: unknown[]) => {
      const fingerprint = useRealFingerprint
        ? actual.oneTouchContextFingerprint(...args) : mockFingerprint;
      routeFingerprints.push(fingerprint);
      return fingerprint;
    }),
    oneTouchChangedAuthorityBranches: actual.oneTouchChangedAuthorityBranches,
  };
});

const choices = (creator: "create_a_dish" | "craving_creator") => ({
  creator, servings: 3, cuisine: { mode: "explicit", value: "italian" },
  eatingStyle: { mode: "explicit", value: "vegan" },
  ...(creator === "craving_creator" ? { cravingType: "food", cravingFeel: "light" } : {}),
});
function idea(n: number, occasion: "lunch" | "snack"): OneTouchDirection {
  return {
    title: `Tomato Lentil Stew ${n}`, description: "A tomato and lentil stew.",
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

describe("Creator Menu selects one server-owned concept before completion", () => {
  let app: express.Express;
  let complete: jest.Mock;
  let directions: jest.Mock;
  let history: jest.Mock;
  const priorEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "development";
    const router = require("../routes/oneTouchCreate").default;
    app = express();
    app.use(express.json());
    app.use("/api/one-touch-create", router());
    complete = require("../services/oneTouch/selectedConceptHandoff").completeSelectedConcept;
    directions = require("../services/oneTouch/directions").generateOneTouchDirections;
    history = require("../services/oneTouch/history").appendOneTouchHistory;
  });
  afterAll(() => { process.env.NODE_ENV = priorEnv; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockSets.clear();
    mockFingerprint = "a".repeat(43);
    useRealFingerprint = false;
    nutritionCalories = 1900;
    resolutionCount = 0;
    glp1Active = false;
    glp1NutritionCalories = 900;
    glp1ResolutionCount = 0;
    routeFingerprints.length = 0;
    directions.mockImplementation(async ({ occasion }: { occasion: "lunch" | "snack" }) => ({
      directions: [1, 2, 3].map((n) => idea(n, occasion)), attemptsCompleted: 1,
    }));
    complete.mockImplementation(async ({ concept }: { concept: OneTouchDirection }) => ({
      ok: true,
      meal: {
        name: concept.title, description: concept.description,
        ingredients: [{ name: "lentils", quantity: "3", unit: "cups" }],
        instructions: "Simmer.", cookingTime: "25 minutes",
        nutrition: { calories: 900, protein: 60, carbs: 75, fat: 15, starchyCarbs: 60 },
        servingSize: "3 servings", nutritionSource: "model_estimate",
        imageUrl: "/completed.jpg",
      },
    }));
  });

  it("uses the real fingerprint at both route checks: timestamp churn alone does not 409", async () => {
    const oldSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "creator-menu-route-test-only";
    useRealFingerprint = true;
    try {
      const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
      expect(first.status).toBe(200);
      expect(routeFingerprints).toHaveLength(2);
      expect(routeFingerprints[0]).toBe(routeFingerprints[1]);
      const selected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
      });
      expect(selected.status).toBe(200);
      expect(routeFingerprints).toHaveLength(4);
      expect(new Set(routeFingerprints).size).toBe(1);
      expect(resolutionCount).toBeGreaterThanOrEqual(4);
    } finally {
      useRealFingerprint = false;
      if (oldSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = oldSecret;
    }
  });

  it("creates and selects an active GLP-1 menu despite calculation-time churn, but rejects a real nutrition change", async () => {
    const oldSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "creator-menu-route-test-only";
    useRealFingerprint = true;
    glp1Active = true;
    try {
      const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
      expect(first.status).toBe(200);
      expect(routeFingerprints).toHaveLength(2);
      expect(routeFingerprints[0]).toBe(routeFingerprints[1]);
      const selected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
      });
      expect(selected.status).toBe(200);
      expect(new Set(routeFingerprints).size).toBe(1);

      glp1NutritionCalories = 800;
      const rejected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices("create_a_dish"), conceptId: first.body.concepts[1].id,
      });
      expect(rejected.status).toBe(409);
      expect(complete).toHaveBeenCalledTimes(1);
    } finally {
      useRealFingerprint = false;
      if (oldSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = oldSecret;
    }
  });

  it("uses the real fingerprint to reject a substantive changed nutrition target", async () => {
    const oldSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "creator-menu-route-test-only";
    useRealFingerprint = true;
    try {
      const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
      expect(first.status).toBe(200);
      nutritionCalories = 1700;
      const selected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
      });
      expect(selected.status).toBe(409);
      expect(routeFingerprints[0]).not.toBe(routeFingerprints[2]);
      expect(complete).not.toHaveBeenCalled();
    } finally {
      useRealFingerprint = false;
      if (oldSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = oldSecret;
    }
  });

  it.each(["create_a_dish", "craving_creator"] as const)(
    "%s returns three concepts, restores them, then completes only the chosen one",
    async (creator) => {
      const initial = await request(app).post("/api/one-touch-create").send(choices(creator));
      expect(initial.status).toBe(200);
      expect(initial.body.concepts).toHaveLength(3);
      expect(initial.body.meals).toBeUndefined();
      expect(oneTouchHistorySchema.safeParse({
        version: 1, create_a_dish: [], craving_creator: [],
        ...mockSets.get("menu-person"),
      }).success).toBe(true);
      expect(complete).not.toHaveBeenCalled();
      expect(history).not.toHaveBeenCalled();
      const restored = await request(app).post("/api/one-touch-create/restore").send(choices(creator));
      expect(restored.body.concepts).toEqual(initial.body.concepts);
      expect(directions).toHaveBeenCalledTimes(1);
      const selected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices(creator), conceptId: initial.body.concepts[1].id,
      });
      expect(selected.status).toBe(200);
      expect(selected.body.meal.name).toBe(initial.body.concepts[1].title);
      expect(selected.body.meal.imageUrl).toBe("/completed.jpg");
      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({
        concept: expect.objectContaining({ title: initial.body.concepts[1].title }),
        servings: 3, cuisine: "italian", creator,
        context: expect.objectContaining({ status: "resolved" }),
      }));
      expect(history).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a forged ID, changed choices, stale authority, and another account", async () => {
    const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
    const conceptId = first.body.concepts[0].id;
    const select = (requestChoices: unknown, id = conceptId) =>
      request(app).post("/api/one-touch-create/choose").send({ request: requestChoices, conceptId: id });
    expect((await select(choices("create_a_dish"), "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await select({ ...choices("create_a_dish"), servings: 2 })).status).toBe(409);
    expect((await request(app).post("/api/one-touch-create/choose")
      .set("x-test-user", "other-person").send({ request: choices("create_a_dish"), conceptId })).status).toBe(409);
    mockFingerprint = "b".repeat(43);
    expect((await select(choices("create_a_dish"))).status).toBe(409);
    expect(complete).not.toHaveBeenCalled();
  });

  it("Try 3 More replaces the three ideas without completing recipes", async () => {
    const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
    const second = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
    expect(second.body.concepts).toHaveLength(3);
    expect(second.body.concepts[0].id).not.toBe(first.body.concepts[0].id);
    expect(complete).not.toHaveBeenCalled();
    expect((await request(app).post("/api/one-touch-create/choose").send({
      request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
    })).status).toBe(404);
  });

  it.each([
    ["concept_rejected", false, 422, "concept_rejected"],
    ["identity_mismatch", false, 422, "identity_mismatch"],
    ["final_validation_rejected", false, 422, "final_validation_rejected"],
    ["generation_failed", true, 502, "generation_failed"],
    ["diabetes_rejected", false, 422, "protected_food_or_authority_rejected"],
  ] as const)("logs a safe %s reason for the general rejection, then restores the same ideas", async (reason, retryable, status, safeReason) => {
    const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      complete.mockResolvedValue({ ok: false, code: reason, retryable });
      const selected = await request(app).post("/api/one-touch-create/choose").send({
        request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
      });
      expect(selected.status).toBe(status);
      expect(selected.body).toEqual({
        code: "ONE_TOUCH_RECIPE_REJECTED",
        error: "We couldn't safely complete this selected idea. Please choose another or try again.",
      });
      expect(warn).toHaveBeenCalledWith("[CreatorMenu] Choose completion rejected", {
        creator: "create_a_dish", reason: safeReason, retryable, status,
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain(first.body.concepts[0].title);
      if (reason === "diabetes_rejected") expect(JSON.stringify(warn.mock.calls)).not.toContain(reason);
      expect(history).not.toHaveBeenCalled();
      const restored = await request(app).post("/api/one-touch-create/restore").send(choices("create_a_dish"));
      expect(restored.status).toBe(200);
      expect(restored.body.concepts).toEqual(first.body.concepts);
      expect(directions).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});