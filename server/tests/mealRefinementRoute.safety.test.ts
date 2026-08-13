/**
 * mealRefinementRoute.safety.test.ts
 *
 * Route-level safety tests for POST /api/meal-refinement/refine.
 *
 * Proves that the safety gate enforces the full protocol scan result — including
 * the instruction-only violation case (passed: false, empty violations array)
 * that would otherwise slip through a `violations.length > 0` guard.
 *
 * Tests:
 *   1. Compliant refinement returns 200 with the refined meal.
 *   2. Ingredient violation (passed: false, violations: [allergen]) → 422.
 *   3. Instruction-only violation (passed: false, violations: []) → 422.
 *      This is the critical regression case: `scanGeneratedOutput` can return
 *      passed=false with an empty violations array when only an instruction
 *      step is prohibited. The old guard `violations.length > 0` would have
 *      served the meal; `!scan.passed` correctly blocks it.
 *
 * Run: npx jest server/tests/mealRefinementRoute.safety.test.ts
 */

// ── Mocks must be declared before imports ─────────────────────────────────────

// Auth middleware — bypass auth/access for all requests
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "test-user-refinement", planLookupKey: "mpm_ultimate" };
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

// ── Scan control ───────────────────────────────────────────────────────────────
// Each test suite configures these before running a request.
let scanPassed = true;
let scanMessage = "";
let scanViolations: any[] = [];

jest.mock("../services/protocolEnvelope", () => ({
  buildGuestEnvelope: jest.fn(() => ({
    userId: null,
    dietaryIdentity: [],
    allergies: [],
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances: [],
    preferences: [],
    procedural: {},
    cuisinePreference: null,
    cuisineIntensity: null,
    diabeticGuidance: null,
    hasDiabetes: false,
    diabeticGlucoseState: null,
    conditionGuidanceBlocks: [],
    glp1DailyTolerance: null,
    thyroidSupport: false,
    thyroidMedication: null,
    thyroidType: null,
    hormoneOptimization: false,
    measurementSystem: "imperial",
    fitnessGoal: null,
    goalType: null,
    goalTarget: null,
    performanceOverlay: "standard",
    performanceControlMode: "self_guided",
    pregnancySupport: false,
    pregnancySupportContext: null,
    carbCycleContext: null,
    performanceNutrition: false,
    performanceContext: null,
    performanceLayer: null,
    dailyNutritionState: null,
    therapeuticSupport: false,
    therapeuticSupportContext: null,
    selectedMealBuilder: null,
    preferredLanguage: null,
    flavorPreference: null,
    heatPreference: null,
    palateSpiceTolerance: null,
    palateSeasoningIntensity: null,
    palateFlavorStyle: null,
    providerInterventions: [],
    interventionPatientSummary: [],
  })),
  // Return a valid envelope so authenticated users pass the fail-closed check.
  // Individual tests that need to simulate a load failure override this mock.
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue({
    userId: "test-user-refinement",
    dietaryIdentity: [],
    allergies: [],
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances: [],
    preferences: [],
    procedural: {},
    cuisinePreference: null,
    cuisineIntensity: null,
    diabeticGuidance: null,
    hasDiabetes: false,
    diabeticGlucoseState: null,
    conditionGuidanceBlocks: [],
    glp1DailyTolerance: null,
    thyroidSupport: false,
    thyroidMedication: null,
    thyroidType: null,
    hormoneOptimization: false,
    measurementSystem: "imperial",
    fitnessGoal: null,
    goalType: null,
    goalTarget: null,
    performanceOverlay: "standard",
    performanceControlMode: "self_guided",
    pregnancySupport: false,
    pregnancySupportContext: null,
    carbCycleContext: null,
    performanceNutrition: false,
    performanceContext: null,
    performanceLayer: null,
    dailyNutritionState: null,
    therapeuticSupport: false,
    therapeuticSupportContext: null,
    selectedMealBuilder: null,
    preferredLanguage: null,
    flavorPreference: null,
    heatPreference: null,
    palateSpiceTolerance: null,
    palateSeasoningIntensity: null,
    palateFlavorStyle: null,
    providerInterventions: [],
    interventionPatientSummary: [],
  }),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "", blocks: [] })),
  scanGeneratedOutput: jest.fn((_meal: any, _env: any, _ctx: any) => ({
    passed: scanPassed,
    message: scanMessage,
    violations: scanViolations,
    instructionViolations: [],
    primaryViolation: scanViolations[0] ?? undefined,
  })),
}));

// OpenAI — always returns a well-formed refined meal JSON
const REFINED_MEAL_RESPONSE = JSON.stringify({
  name: "Refined Grilled Chicken Bowl",
  description: "More protein, same flavors.",
  ingredients: [
    { name: "Grilled Chicken Breast", quantity: 8, unit: "oz", category: "Meat" },
    { name: "Brown Rice", quantity: 0.75, unit: "cup", category: "Grains & Packaged" },
  ],
  instructions: ["Grill chicken until cooked through.", "Serve over brown rice."],
  nutrition: { calories: 480, protein: 42, carbs: 38, fat: 10 },
  servings: 2,
  cookingTime: "25 min",
  difficulty: "Easy",
});

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: REFINED_MEAL_RESPONSE } }],
        }),
      },
    },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const router = (await import("../routes/mealRefinement")).default;
  app.use("/api/meal-refinement", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

// ── Shared fixture ────────────────────────────────────────────────────────────

const ORIGINAL_MEAL = {
  id: "ai-meal-test-1",
  name: "Basic Chicken Bowl",
  description: "A simple chicken bowl.",
  ingredients: [
    { name: "Chicken Breast", quantity: 6, unit: "oz", category: "Meat" },
    { name: "Brown Rice", quantity: 0.5, unit: "cup", category: "Grains & Packaged" },
  ],
  instructions: ["Cook chicken.", "Serve over rice."],
  nutrition: { calories: 420, protein: 36, carbs: 35, fat: 8 },
  servings: 2,
  cookingTime: "20 min",
  difficulty: "Easy",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/meal-refinement/refine — protocol safety gate", () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    // Reset scan to passing state before each test
    scanPassed = true;
    scanMessage = "";
    scanViolations = [];
  });

  // ── Test 1: Compliant refinement ────────────────────────────────────────────
  it("returns 200 with refined meal when the protocol scan passes", async () => {
    scanPassed = true;
    scanViolations = [];
    scanMessage = "No violations.";

    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({
        meal: ORIGINAL_MEAL,
        request: "More protein",
        builderType: "craving-creator",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("meal");
    expect(res.body.meal).toHaveProperty("name");
    // Both name and title must be present so MealCard surfaces render the updated name
    expect(res.body.meal).toHaveProperty("title");
    expect(res.body.meal.name).toBe(res.body.meal.title);
    expect(res.body).toHaveProperty("refinementApplied", "More protein");
  });

  // ── Test 2: Ingredient-level allergen violation ─────────────────────────────
  it("returns 422 when the refined meal contains an allergen violation", async () => {
    scanPassed = false;
    scanViolations = [
      {
        term: "peanut",
        reason: "Allergen: peanut allergy on file",
        severity: "hard",
        source: "allergies",
      },
    ];
    scanMessage =
      'Refined meal contains "peanut" which conflicts with your allergen restrictions.';

    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({
        meal: ORIGINAL_MEAL,
        request: "Add peanut sauce",
      });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/dietary protocol/i);
    expect(res.body).toHaveProperty("ndeSummary");
    expect(res.body.ndeSummary).toMatch(/peanut/i);
  });

  // ── Test 3: Instruction-only violation (the regression case) ───────────────
  // scanGeneratedOutput can return passed:false with an EMPTY violations array
  // when only a preparation instruction is prohibited (e.g. "deep fry" for a
  // cardiac protocol).  The previous guard `violations.length > 0` would have
  // passed this meal through. `!scan.passed` correctly blocks it.
  it("returns 422 for an instruction-only violation even when violations array is empty", async () => {
    scanPassed = false;
    scanViolations = []; // ← empty: no ingredient-level hits
    scanMessage =
      'Cooking instruction "deep fry in lard" conflicts with cardiac diet constraints.';

    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({
        meal: {
          ...ORIGINAL_MEAL,
          instructions: ["Deep fry in lard until golden.", "Serve immediately."],
        },
        request: "Make it crunchier",
      });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/dietary protocol/i);
    // ndeSummary should surface the instruction violation message
    expect(res.body.ndeSummary).toMatch(/instruction|fry|cardiac/i);
  });

  // ── Test 4: Missing required fields ────────────────────────────────────────
  it("returns 400 when meal is missing", async () => {
    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({ request: "More protein" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when request string is missing", async () => {
    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({ meal: ORIGINAL_MEAL });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  // ── Test 5: Protocol-load failure — fail closed ─────────────────────────────
  // An authenticated user whose profile DB call throws must NOT receive a meal
  // generated against the guest (empty) envelope — that would silently ignore
  // their allergies/medical restrictions. The route must return 503 instead.
  it("returns 503 when the authenticated user's protocol envelope cannot be loaded (throw)", async () => {
    // Temporarily override the mock to simulate a DB/network failure
    const { loadUserProtocolEnvelope } = await import("../services/protocolEnvelope");
    const mockLoad = loadUserProtocolEnvelope as jest.Mock;
    mockLoad.mockRejectedValueOnce(new Error("DB connection timeout"));

    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({ meal: ORIGINAL_MEAL, request: "More protein" });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/dietary profile|try again/i);

    // Restore default behavior
    mockLoad.mockResolvedValue(null);
  });

  it("returns 503 when the authenticated user's protocol envelope returns null", async () => {
    const { loadUserProtocolEnvelope } = await import("../services/protocolEnvelope");
    const mockLoad = loadUserProtocolEnvelope as jest.Mock;
    mockLoad.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/meal-refinement/refine")
      .send({ meal: ORIGINAL_MEAL, request: "More protein" });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/dietary profile|try again/i);

    // Restore default behavior
    mockLoad.mockResolvedValue(null);
  });
});
