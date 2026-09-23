import express from "express";
import request from "supertest";
import { oneTouchHistorySchema, type OneTouchDirection } from "@shared/oneTouch";

const mockSets = new Map<string, Record<string, any>>();
let mockFingerprint = "a".repeat(43);

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.authUser = { id: req.headers["x-test-user"] || "menu-person" };
    next();
  },
}));
jest.mock("../services/oneTouch/menuRecipeCompletion", () => ({ completeMenuRecipe: jest.fn() }));
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
    resolve: async () => ({
      status: "resolved", diet: { effective: ["vegan"] },
      flavor: { cuisine: { available: false, value: null } }, notices: [],
    }),
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
  oneTouchContextFingerprint: jest.fn(() => mockFingerprint),
  oneTouchChangedAuthorityBranches: jest.fn(() => []),
}));

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
    complete = require("../services/oneTouch/menuRecipeCompletion").completeMenuRecipe;
    directions = require("../services/oneTouch/directions").generateOneTouchDirections;
    history = require("../services/oneTouch/history").appendOneTouchHistory;
  });
  afterAll(() => { process.env.NODE_ENV = priorEnv; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockSets.clear();
    mockFingerprint = "a".repeat(43);
    directions.mockImplementation(async ({ occasion }: { occasion: "lunch" | "snack" }) => ({
      directions: [1, 2, 3].map((n) => idea(n, occasion)), attemptsCompleted: 1,
    }));
    complete.mockImplementation(async ({ approvedConcept }: { approvedConcept: OneTouchDirection }) => ({
      ok: true,
      card: {
        name: approvedConcept.title, description: approvedConcept.description,
        ingredients: [{ name: "lentils", quantity: "3", unit: "cups" }],
        instructions: "Simmer.", cookingTime: "25 minutes",
        nutrition: { calories: 900, protein: 60, carbs: 75, fat: 15, starchyCarbs: 60 },
        servingSize: "3 servings", nutritionSource: "model_estimate",
        imageUrl: "/completed.jpg",
      },
    }));
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
        approvedConcept: expect.objectContaining({ title: initial.body.concepts[1].title }),
        servings: 3, cuisine: "italian", dietaryDirection: "vegan",
        clinicalMealSlot: "lunch", contextCreator: creator,
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

  it("keeps unprovable finished-food evidence fail-closed after selection", async () => {
    const first = await request(app).post("/api/one-touch-create").send(choices("create_a_dish"));
    complete.mockResolvedValue({ ok: false, code: "requirement_evidence_unsupported", retryable: false });
    const selected = await request(app).post("/api/one-touch-create/choose").send({
      request: choices("create_a_dish"), conceptId: first.body.concepts[0].id,
    });
    expect(selected.status).toBe(422);
    expect(selected.body.code).toBe("ONE_TOUCH_REQUIREMENT_UNAVAILABLE");
    expect(history).not.toHaveBeenCalled();
  });
});