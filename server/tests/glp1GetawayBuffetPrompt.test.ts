/**
 * glp1GetawayBuffetPrompt.test.ts
 *
 * Integration tests confirming that GLP-1 protocol guidance and remaining-macros
 * blocks are injected into the AI prompts for both the Getaway coach (POST /coach)
 * and the Buffet recommendation service (generateBuffetRecommendations).
 *
 * Strategy:
 *   • Pure helper tests — buildGLP1RecommendationBlock, buildRemainingMacrosBlock.
 *   • Buffet service integration — call generateBuffetRecommendations() (the real
 *     function) with pre-built GLP-1 + remaining-macros blocks; mock OpenAI to
 *     capture the messages array; assert the user prompt contains both blocks.
 *   • Getaway route integration — mount the getaway router in supertest; mock
 *     resolveGLP1GlobalContext, resolveDailyNutritionState, and OpenAI; POST to
 *     /coach; assert the captured user prompt contains GLP-1 and remaining-macros
 *     text.
 *   • Edge case: no meals logged (dailyState null) — GLP-1 block present, no
 *     remaining-macros block.
 *
 * Run: npx jest server/tests/glp1GetawayBuffetPrompt.test.ts
 */

// ── Captured OpenAI call storage ───────────────────────────────────────────────
// Declared before jest.mock so the factory closure can reference the array
// by reference. The factory only defines create(); the array is already
// initialised before any test runs the function.
const capturedOpenAICalls: Array<{ messages: any[]; maxTokens: number }> = [];

// ── Stable mock responses ──────────────────────────────────────────────────────
const BUFFET_AI_RESPONSE = JSON.stringify({
  plates: [
    {
      plateName: "Grilled Salmon Plate",
      plateDescription: "Lean protein with vegetables",
      estimatedCalories: 380,
      estimatedProteinGrams: 32,
      estimatedCarbGrams: 25,
      estimatedFatGrams: 14,
      fiberGrams: 6,
      starchyCarbGrams: 10,
      caloriesLow: 340,
      caloriesHigh: 420,
      buffetItems: [{ food: "Grilled salmon", portion: "5oz", note: null }],
      reason: "High protein, GLP-1 compliant",
      portionGuidance: "Start with protein, add vegetables",
      cautionNotes: [],
      protocolAlignmentSummary: "GLP-1 compliant — high protein, low fat",
      medicalGuidance: null,
    },
  ],
});

const GETAWAY_AI_RESPONSE = JSON.stringify({
  venue: "Disney World",
  venueType: "theme park",
  zone: null,
  bestChoices: [
    {
      name: "Grilled Chicken",
      where: "Flame Tree Barbecue",
      why: "High protein, GLP-1 friendly",
    },
  ],
  whyTheyFit: ["High protein option", "GLP-1 protocol aligned"],
  avoid: [],
  familyNote: ["Good for families"],
  coachNote: "Great choices for your GLP-1 protocol!",
});

// ── Mock: OpenAI ───────────────────────────────────────────────────────────────
// __esModule: true is required so ts-jest (useESM mode) resolves the default
// export correctly when routes do `new OpenAI(...)`.
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    capturedOpenAICalls.push({
      messages: params.messages ?? [],
      maxTokens: params.max_tokens ?? 0,
    });
    // Differentiate Getaway (max_tokens 900) from Buffet (max_tokens 2400)
    const content =
      params.max_tokens === 900 ? GETAWAY_AI_RESPONSE : BUFFET_AI_RESPONSE;
    return { choices: [{ message: { content } }] };
  });

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));

  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: ESM chain from restaurantMealGeneratorAI ────────────────────────────
// restaurantMealGeneratorAI → mealImageGenerator → imageLifecycle →
//   mediaAssetService → @replit/object-storage → uuid (ESM, breaks Jest)
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));
jest.mock("../services/restaurantMealGenerator", () => ({
  generateRestaurantMeals: jest.fn().mockResolvedValue([]),
}));

// ── Mock: DB (Getaway route loads user row) ────────────────────────────────────
const MOCK_USER = {
  id: "test-user-glp1",
  dietaryRestrictions: [],
  allergies: [],
  healthConditions: ["semaglutide"],
  goalType: "weight_loss",
};
jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const chain: any = {
        from: () => chain,
        where: () => Promise.resolve([MOCK_USER]),
      };
      return chain;
    }),
  },
}));

// ── Mock: getActiveNutritionContext ────────────────────────────────────────────
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({
  getActiveNutritionContext: jest.fn().mockResolvedValue({
    combinedBlock: "GLP-1 active. Protein priority. Lower appetite expected.",
    envelope: { hasDiabetes: false },
  }),
}));

// ── Mock: locationContext engine & discovery ───────────────────────────────────
jest.mock("../services/locationContext/engine", () => ({
  assembleLocationContext: jest.fn().mockReturnValue(null),
  buildVenueContextBlock: jest.fn().mockReturnValue(""),
  getVenuesPublicPayload: jest.fn().mockReturnValue([]),
}));
jest.mock("../services/locationContext/venueDiscovery", () => ({
  discoverVenue: jest.fn().mockResolvedValue({}),
}));

// ── Mock: resolveDailyNutritionState ──────────────────────────────────────────
// "WITH MEALS" variant — remaining macros reflect logged meals (< full budget)
const DAILY_STATE_WITH_MEALS = {
  remaining: {
    calories: 750,
    protein: 55,
    carbs: 70,
    fat: 25,
    starchyCarbs: 35,
    fibrousCarbs: 12,
    starchMealsRemaining: 1,
  },
};
const mockResolveDailyNutritionState = jest.fn().mockResolvedValue(DAILY_STATE_WITH_MEALS);
jest.mock("../services/nutritionStateService", () => ({
  resolveDailyNutritionState: (...args: any[]) => mockResolveDailyNutritionState(...args),
}));

// ── Mock: resolveGLP1GlobalContext + buildGLP1RecommendationBlock ──────────────
// resolveGLP1GlobalContext is async/DB-dependent → mock it.
// buildGLP1RecommendationBlock is pure → inline a faithful implementation so
// the route's call to it produces real GLP-1 language in the captured prompt.
const GLP1_CONTEXT_ACTIVE = {
  isActive: true,
  activationSources: ["medicalConditions"],
  performanceActive: false,
  compositionNote: "",
  resolvedTargets: {
    treatmentPhase: "maintenance",
    resolvedMealCalories: 420,
    targetProteinGrams: 28,
    maximumToleratedFatGrams: 12,
  },
  dailyNutritionState: null,
};
const mockResolveGLP1GlobalContext = jest.fn().mockResolvedValue(GLP1_CONTEXT_ACTIVE);

jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: (...args: any[]) => mockResolveGLP1GlobalContext(...args),
  // Faithful inline implementation of the pure export so real GLP-1 language
  // reaches the prompt without importing the DB-dependent real module.
  buildGLP1RecommendationBlock: (ctx: any): string => {
    if (!ctx?.isActive) return "";
    const t = ctx.resolvedTargets ?? {};
    const phase = t.treatmentPhase ?? "maintenance";
    const protein = t.targetProteinGrams ?? 15;
    const fat = t.maximumToleratedFatGrams ?? 12;
    const cal = t.resolvedMealCalories ?? 400;
    const sources = (ctx.activationSources ?? []).join(", ");
    return [
      `GLP-1 MEDICATION PROTOCOL — ACTIVE (sources: ${sources})`,
      `Treatment phase: ${phase} | Meal target: ~${cal} kcal | Protein: ≥${protein}g | Fat ceiling: ≤${fat}g`,
      "",
      "FOOD SELECTION RULES for this GLP-1 patient (recommendation surface — you cannot control exact serving sizes, so guide CHOICES and PREPARATION):",
      `• PROTEIN FIRST: Always lead recommendations with the highest-protein option available. Target ≥${protein}g protein.`,
      `• FAT CEILING: Avoid fried foods, heavy cream sauces, buttery preparations, and high-fat cheeses. Favor preparations ≤${fat}g fat.`,
      "• PREPARATION: Prefer grilled, baked, steamed, or roasted. Avoid breaded, fried, or sauce-heavy dishes.",
      "• STARCH STRATEGY: Recommend skipping or reducing starchy sides (fries, rice, bun, bread). Suggest vegetables or salad instead.",
      "• PORTION AWARENESS: Note that GLP-1 medications reduce appetite — smaller portions are appropriate. Do NOT encourage large plates or 'hearty' meals.",
      "• AVOID: Heavy appetizers, creamy soups, sugary drinks, desserts, high-fat entrees.",
    ].join("\n");
  },
}));

// ── Imports (after jest.mock declarations) ─────────────────────────────────────
import express from "express";
import request from "supertest";
import {
  buildRemainingMacrosBlock,
  buildCravingInstructions,
} from "../services/restaurantMealGeneratorAI";
import { generateBuffetRecommendations } from "../services/buffetRecommendationAI";
import type { ActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import type { DailyNutritionState } from "../../shared/dailyNutritionPrescription";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeRemainingMacros(
  overrides: Partial<DailyNutritionState["remaining"]> = {},
): DailyNutritionState["remaining"] {
  return {
    calories: 800,
    protein: 60,
    carbs: 80,
    fat: 30,
    starchyCarbs: 40,
    fibrousCarbs: 15,
    starchMealsRemaining: 1,
    ...overrides,
  };
}

const MOCK_NUTRITION_CONTEXT = {
  combinedBlock: "GLP-1 active. Protein priority. Lower appetite expected.",
  envelope: { hasDiabetes: false },
} as unknown as ActiveNutritionContext;

// ── Supertest app for Getaway route ───────────────────────────────────────────
// Imported lazily to ensure all jest.mock hoisting completes first.
let testApp: express.Express;

beforeAll(async () => {
  const { default: getawayRouter } = await import("../routes/getaway");
  testApp = express();
  testApp.use(express.json());
  // Inject authUser (normally set by requireAuth middleware)
  testApp.use((req: any, _res, next) => {
    req.authUser = { id: "test-user-glp1" };
    next();
  });
  testApp.use("/api/getaway", getawayRouter);
});

beforeEach(() => {
  capturedOpenAICalls.length = 0;
  mockResolveDailyNutritionState.mockResolvedValue(DAILY_STATE_WITH_MEALS);
  mockResolveGLP1GlobalContext.mockResolvedValue(GLP1_CONTEXT_ACTIVE);
});

// ─────────────────────────────────────────────────────────────────────────────
// PURE FUNCTION TESTS — buildGLP1RecommendationBlock
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRemainingMacrosBlock — pure function", () => {
  test("returns non-empty string when user has logged meals", () => {
    const block = buildRemainingMacrosBlock(makeRemainingMacros());
    expect(block).toBeTruthy();
  });

  test("contains CURRENT DAY REMAINING BUDGET header", () => {
    const block = buildRemainingMacrosBlock(makeRemainingMacros({ calories: 750 }));
    expect(block).toContain("CURRENT DAY REMAINING BUDGET");
    expect(block).toContain("750");
  });

  test("contains starch meals remaining when provided", () => {
    const block = buildRemainingMacrosBlock(makeRemainingMacros({ starchMealsRemaining: 1 }));
    expect(block).toContain("Starch meals remaining today: 1");
  });

  test("returns empty string when remaining is null", () => {
    expect(buildRemainingMacrosBlock(null)).toBe("");
  });

  test("returns empty string when remaining is undefined", () => {
    expect(buildRemainingMacrosBlock(undefined)).toBe("");
  });
});

describe("buildCravingInstructions — pure function", () => {
  test("returns empty string when no craving provided", () => {
    expect(buildCravingInstructions(undefined, false)).toBe("");
  });

  test("returns craving block with the requested food", () => {
    const block = buildCravingInstructions("grilled salmon", false);
    expect(block).toContain("grilled salmon");
    expect(block).toContain("CRITICAL");
  });

  test("adds diabetic protein-preservation rule for diabetic users", () => {
    const block = buildCravingInstructions("steak", true);
    expect(block).toContain("DIABETIC COMPLIANCE RULE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE INTEGRATION — generateBuffetRecommendations (real function call)
// Verifies that when glp1RecommendationBlock and remainingMacrosBlock are
// provided, the actual service assembles a user prompt containing both and
// sends it to OpenAI.
// ─────────────────────────────────────────────────────────────────────────────

describe("generateBuffetRecommendations — GLP-1 user with logged meals", () => {
  const GLP1_BLOCK =
    "GLP-1 MEDICATION PROTOCOL — ACTIVE (sources: medicalConditions)\n" +
    "Treatment phase: maintenance | Meal target: ~420 kcal | Protein: ≥28g | Fat ceiling: ≤12g\n" +
    "• PROTEIN FIRST: Always lead with the highest-protein option.\n" +
    "• FAT CEILING: Avoid fried foods and heavy sauces.\n" +
    "• STARCH STRATEGY: Skip starchy sides — vegetables instead.";

  const REMAINING_BLOCK = buildRemainingMacrosBlock(
    makeRemainingMacros({ calories: 750, protein: 55 }),
  );

  test("sends a prompt to OpenAI that contains GLP-1 protocol language", async () => {
    await generateBuffetRecommendations({
      foodsDescription: "grilled chicken, salmon, mashed potatoes, salad bar, broccoli",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: REMAINING_BLOCK,
    });

    expect(capturedOpenAICalls).toHaveLength(1);
    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toContain("GLP-1 MEDICATION PROTOCOL");
    expect(userMsg.content).toContain("PROTEIN FIRST");
  });

  test("sends a prompt that contains the remaining-macros budget block", async () => {
    await generateBuffetRecommendations({
      foodsDescription: "grilled chicken, salmon, mashed potatoes, salad bar, broccoli",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: REMAINING_BLOCK,
    });

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("CURRENT DAY REMAINING BUDGET");
    expect(userMsg.content).toContain("750"); // calories remaining
  });

  test("GLP-1 block appears before remaining-macros block in the user prompt", async () => {
    await generateBuffetRecommendations({
      foodsDescription: "grilled chicken, roasted turkey, salad bar, vegetables",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: REMAINING_BLOCK,
    });

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    const glp1Pos = userMsg.content.indexOf("GLP-1 MEDICATION PROTOCOL");
    const budgetPos = userMsg.content.indexOf("CURRENT DAY REMAINING BUDGET");
    expect(glp1Pos).toBeGreaterThanOrEqual(0);
    expect(budgetPos).toBeGreaterThanOrEqual(0);
    expect(glp1Pos).toBeLessThan(budgetPos);
  });

  test("available foods list appears in the prompt", async () => {
    await generateBuffetRecommendations({
      foodsDescription: "wild-caught tuna, roasted asparagus, quinoa",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: REMAINING_BLOCK,
    });

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("wild-caught tuna");
    expect(userMsg.content).toContain("BUFFET FOODS AVAILABLE");
  });

  test("returns parsed plate recommendations from OpenAI response", async () => {
    const results = await generateBuffetRecommendations({
      foodsDescription: "grilled salmon, vegetables",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: REMAINING_BLOCK,
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source).toBe("buffet");
  });
});

describe("generateBuffetRecommendations — GLP-1 user with NO meals logged (edge case)", () => {
  test("GLP-1 block is present in prompt even when remainingMacrosBlock is empty", async () => {
    const GLP1_BLOCK = "GLP-1 MEDICATION PROTOCOL — ACTIVE (sources: medicalConditions)\n• PROTEIN FIRST.";

    await generateBuffetRecommendations({
      foodsDescription: "grilled chicken, salad, rice",
      nutritionContext: MOCK_NUTRITION_CONTEXT,
      glp1RecommendationBlock: GLP1_BLOCK,
      remainingMacrosBlock: undefined, // no meals logged → no remaining block
    });

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("GLP-1 MEDICATION PROTOCOL");
    expect(userMsg.content).not.toContain("CURRENT DAY REMAINING BUDGET");
  });

  test("does not crash when both GLP-1 and remaining blocks are absent", async () => {
    await expect(
      generateBuffetRecommendations({
        foodsDescription: "grilled chicken, salad",
        nutritionContext: MOCK_NUTRITION_CONTEXT,
        glp1RecommendationBlock: undefined,
        remainingMacrosBlock: undefined,
      }),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE INTEGRATION — Getaway POST /coach (real route, mocked services + OpenAI)
// Verifies that when resolveGLP1GlobalContext returns an active context and
// resolveDailyNutritionState returns remaining macros, the route sends a
// user prompt to OpenAI that contains both GLP-1 language and a remaining-
// macros block.
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/getaway/coach — GLP-1 user with logged meals", () => {
  test("sends a prompt containing GLP-1 protocol language", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "I'm at Disney World, what should I eat?" });

    expect(res.status).toBe(200);
    expect(capturedOpenAICalls).toHaveLength(1);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toContain("GLP-1 MEDICATION PROTOCOL");
  });

  test("sends a prompt containing the remaining-macros block when meals are logged", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "What's healthy at Universal Studios?" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("CURRENT DAY REMAINING BUDGET");
    expect(userMsg.content).toContain("750"); // calories remaining from mock
  });

  test("GLP-1 block appears before remaining-macros block in the user prompt", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Airport food options?" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    const glp1Pos = userMsg.content.indexOf("GLP-1 MEDICATION PROTOCOL");
    const budgetPos = userMsg.content.indexOf("CURRENT DAY REMAINING BUDGET");
    expect(glp1Pos).toBeGreaterThanOrEqual(0);
    expect(budgetPos).toBeGreaterThanOrEqual(0);
    expect(glp1Pos).toBeLessThan(budgetPos);
  });

  test("user message appears in the prompt", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Cruise ship deck 9 lunch options?" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("Cruise ship deck 9 lunch options?");
  });

  test("combinedBlock from nutrition context appears in the prompt", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Theme park options?" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("GLP-1 active. Protein priority.");
  });

  test("resolveGLP1GlobalContext was called with the authenticated user ID", async () => {
    await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "What should I order?" });

    expect(mockResolveGLP1GlobalContext).toHaveBeenCalledWith(
      "test-user-glp1",
      expect.any(String),
    );
  });

  test("resolveDailyNutritionState was called with the authenticated user ID", async () => {
    await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Best dinner options at the resort?" });

    expect(mockResolveDailyNutritionState).toHaveBeenCalledWith(
      "test-user-glp1",
      expect.any(String),
    );
  });
});

describe("GET /api/getaway/coach — GLP-1 user with NO meals logged (edge case)", () => {
  beforeEach(() => {
    // Simulate no meals logged: resolveDailyNutritionState throws (caught by route)
    mockResolveDailyNutritionState.mockRejectedValue(new Error("No daily state"));
  });

  test("GLP-1 protocol block still reaches the prompt even when daily state unavailable", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "I'm at Disney World, recommend something!" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toContain("GLP-1 MEDICATION PROTOCOL");
  });

  test("remaining-macros block is absent from prompt when daily state unavailable", async () => {
    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Airport terminal B options?" });

    expect(res.status).toBe(200);

    const userMsg = capturedOpenAICalls[0].messages.find((m: any) => m.role === "user");
    expect(userMsg.content).not.toContain("CURRENT DAY REMAINING BUDGET");
  });

  test("resolver rejection returns 503 fail-closed (no recommendation served)", async () => {
    mockResolveGLP1GlobalContext.mockRejectedValue(new Error("GLP-1 resolver error"));

    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Resort options?" });

    // Fail closed: GLP-1 status indeterminate → 503, no recommendation
    expect(res.status).toBe(503);
    expect(res.body.retryable).toBe(true);
  });

  test("isActive=true but resolvedTargets=null returns 503 fail-closed", async () => {
    mockResolveGLP1GlobalContext.mockResolvedValue({
      ...GLP1_CONTEXT_ACTIVE,
      resolvedTargets: null,
    });

    const res = await request(testApp)
      .post("/api/getaway/coach")
      .send({ message: "Beach resort lunch?" });

    // Fail closed: active GLP-1 patient but clinical targets unavailable → 503
    expect(res.status).toBe(503);
    expect(res.body.retryable).toBe(true);
  });
});
