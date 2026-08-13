/**
 * groceryCoachRecommend.test.ts
 *
 * Integration tests for POST /api/grocery-coach/recommend confirming that the
 * post-generation protocol scan and GLP-1 macro validation fire correctly and
 * block unsafe responses before they reach the user.
 *
 * Allergen scenarios:
 *   The protocol envelope is loaded with avoidances: ["shellfish"].  The scan
 *   mock enforces the real constraint — it inspects every ingredient name the
 *   route passes to it and returns a violation when a shellfish term is found.
 *   This means the test breaks if the route ever stops passing shoppingList
 *   (or ownedIngredients) to scanGeneratedOutput, or if it stops loading the
 *   correct protocol envelope.
 *
 * GLP-1 scenarios:
 *   macros in the LLM response are compared against resolvedTargets; the retry
 *   path and the 400 fail-close are exercised with concrete fat values.
 *
 * Run: npx jest server/tests/groceryCoachRecommend.test.ts
 */

// ── Captured OpenAI call storage ──────────────────────────────────────────────
type OpenAICallArgs = { systemContent: string; userContent: string };
const capturedCalls: OpenAICallArgs[] = [];

// ── OpenAI response queue ─────────────────────────────────────────────────────
// Each push() adds one response; consumed in order. The last entry is reused.
const openAIResponseQueue: Array<() => object> = [];

function nextOpenAIResponse(): object {
  if (openAIResponseQueue.length > 1) return (openAIResponseQueue.shift()!)();
  if (openAIResponseQueue.length === 1) return (openAIResponseQueue[0])();
  return makeValidCoachResult();
}

// ── Mock: OpenAI ───────────────────────────────────────────────────────────────
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    const systemMsg = (params.messages ?? []).find((m: any) => m.role === "system");
    const userMsg   = (params.messages ?? []).find((m: any) => m.role === "user");
    capturedCalls.push({
      systemContent: systemMsg?.content ?? "",
      userContent:   userMsg?.content ?? "",
    });
    return { choices: [{ message: { content: JSON.stringify(nextOpenAIResponse()) } }] };
  });

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));

  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: DB ───────────────────────────────────────────────────────────────────
// Two queries in the recommend route:
//   1. db.select({...}).from(users).where(...).limit(1)  → user macro rows
//   2. db.select({...}).from(userSavedGroceryItems).where(...)  → saved grocery rows
//
// Differentiated by whether .limit() follows .where():
//   • .where().limit() resolves mockDbUserRows
//   • awaiting .where() directly resolves mockDbSgRows (thenable)
const mockDbUserRows: any[] = [];
const mockDbSgRows:   any[] = [];

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const chain: any = {
        from: () => chain,
        where: () => ({
          limit: () => Promise.resolve(mockDbUserRows),
          // savedGroceryItems query ends at .where() — direct await
          then: (resolve: any, reject: any) =>
            Promise.resolve(mockDbSgRows).then(resolve, reject),
        }),
      };
      return chain;
    }),
  },
}));

// ── Protocol envelope factory ──────────────────────────────────────────────────
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

function makeEnvelope(overrides: Partial<UserProtocolEnvelope> = {}): UserProtocolEnvelope {
  return {
    userId: "test-user-id",
    dietaryIdentity: [],
    allergies: [],
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances: [],
    preferences: [],
    procedural: {} as any,
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
    ...overrides,
  } as UserProtocolEnvelope;
}

// ── Shellfish avoidance envelope ───────────────────────────────────────────────
// Used in allergen tests: avoidances: ["shellfish"] + allergies: ["shellfish"]
// so both the prompt enforcement AND the post-gen scan have the real constraint.
function makeShellfishEnvelope(): UserProtocolEnvelope {
  return makeEnvelope({ avoidances: ["shellfish"], allergies: ["shellfish"] });
}

// ── Configurable envelope for loadUserProtocolEnvelope ────────────────────────
// Tests can swap this to change what the route loads.
let activeEnvelope: UserProtocolEnvelope = makeEnvelope();

// ── Mock: protocolEnvelope (smart scan mock) ───────────────────────────────────
//
// scanGeneratedOutput inspects what the route actually passes to it:
//   • It reads the envelope's avoidances to get the real constraint.
//   • It checks ingredient names in the meal against shellfish terms from
//     AVOIDANCE_EXPANSION["shellfish"] (a subset sufficient to cover the tests).
//   • If a shellfish term is found in an ingredient name, it returns a violation.
//
// This means the test BREAKS if:
//   - The route stops passing shoppingList ingredients to the scanner.
//   - The route stops loading the protocol envelope for the user.
//   - The route hard-codes avoidances or skips them.
//
// For non-shellfish envelopes the scan always passes, which lets the GLP-1
// macro tests run without scan interference.

const SHELLFISH_TERMS = [
  "shrimp", "shrimps", "prawn", "prawns", "crab", "crabs",
  "lobster", "scallop", "clam", "oyster", "shellfish",
];

const scanGeneratedOutputMock = jest.fn(
  (
    meal: { name?: string; ingredients?: Array<{ name?: string; item?: string } | string> },
    envelope: UserProtocolEnvelope,
  ) => {
    const hasShellfishAvoidance =
      (envelope.avoidances ?? []).some(a => a.toLowerCase() === "shellfish") ||
      (envelope.allergies ?? []).some(a => a.toLowerCase() === "shellfish");

    if (hasShellfishAvoidance) {
      // Collect all ingredient text the route passed in
      const ingredientNames = (meal.ingredients ?? []).map((ing) =>
        typeof ing === "string"
          ? ing.toLowerCase()
          : ((ing as any).name ?? (ing as any).item ?? "").toLowerCase()
      );

      for (const term of SHELLFISH_TERMS) {
        const found = ingredientNames.some(name => name.includes(term));
        if (found) {
          return {
            passed: false,
            message: `contains ${term} — shellfish avoidance`,
            violations: [
              {
                term,
                category: "shellfish",
                reason: `"${term}" is in the user's foods-to-avoid list (shellfish)`,
              },
            ],
            instructionViolations: [],
            primaryViolation: {
              term,
              category: "shellfish",
              reason: `"${term}" is in the user's foods-to-avoid list (shellfish)`,
            },
          };
        }
      }
    }

    // No violation
    return {
      passed: true,
      violations: [],
      instructionViolations: [],
      message: "passed protocol scan",
      primaryViolation: null,
    };
  },
);

jest.mock("../services/protocolEnvelope", () => ({
  buildGuestEnvelope: jest.fn(() => makeEnvelope()),
  loadUserProtocolEnvelope: jest.fn().mockImplementation(async () => activeEnvelope),
  enforceBeforeGenerate: jest.fn(() => ({
    combined: "No dietary restrictions — apply general healthy eating.",
    blocks: [],
  })),
  scanGeneratedOutput: (...args: any[]) => scanGeneratedOutputMock(...args),
}));

// ── Mock: resolveGLP1GlobalContext ─────────────────────────────────────────────
let mockGlp1Context: any = { isActive: false, resolvedTargets: null };

const mockResolveGLP1 = jest.fn().mockImplementation(async () => mockGlp1Context);

jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: (...args: any[]) => mockResolveGLP1(...args),
  buildGLP1RecommendationBlock: (ctx: any): string => {
    if (!ctx?.isActive) return "";
    const t = ctx.resolvedTargets ?? {};
    return [
      `GLP-1 MEDICATION PROTOCOL — ACTIVE`,
      `Meal target: ~${t.resolvedMealCalories ?? 400} kcal | ` +
        `Protein: ≥${t.targetProteinGrams ?? 15}g | ` +
        `Fat ceiling: ≤${t.maximumToleratedFatGrams ?? 12}g`,
    ].join("\n");
  },
}));

// ── Mock: savedGroceryCompliance ───────────────────────────────────────────────
jest.mock("../services/savedGroceryCompliance", () => ({
  filterSavedGroceriesForCompliance: jest.fn(() => ({ compliant: [], excluded: [] })),
  buildSavedGroceriesPromptBlock: jest.fn(() => ""),
}));

// ── Mock: mealCardFinalizer (imports @replit/object-storage — ESM) ─────────────
jest.mock("../services/mealCardFinalizer", () => ({
  finalizeMealCard: jest.fn().mockResolvedValue({ id: "card-1" }),
}));

// ── Mock: productAdvisor ───────────────────────────────────────────────────────
jest.mock("../services/productAdvisor", () => ({
  getProductAdvisorEngine: jest.fn(() => ({
    buildCartRecommendations: jest.fn().mockResolvedValue({ recommendations: [] }),
  })),
}));

// ── Mock: mealRefinementEngine ─────────────────────────────────────────────────
jest.mock("../services/mealRefinementEngine", () => ({
  getMealRefinementEngine: jest.fn(() => ({
    refine: jest.fn().mockResolvedValue({
      coachSuggestion: null,
      alternatives: [],
      protocolNote: null,
    }),
  })),
}));

// ── CoachResult helpers ────────────────────────────────────────────────────────

/** Build a minimal valid CoachResult that passes invalidReason(). */
function makeValidCoachResult(overrides: Record<string, any> = {}): object {
  return {
    meal: {
      name: "Grilled Salmon",
      description: "A light, protein-rich dinner.",
      prepTime: "20 minutes",
      servings: 1,
    },
    reasoning: [
      "High protein for muscle repair.",
      "Low fat fits your protocol.",
      "Quick to prepare.",
    ],
    macros: { calories: 380, protein: 35, carbs: 20, fat: 9 },
    ownedIngredients: [],
    shoppingList: [
      { item: "Salmon fillet", quantity: "6", unit: "oz", category: "Meat" },
      { item: "Asparagus",     quantity: "1", unit: "bunch", category: "Produce" },
    ],
    followUpSuggestions: ["Make it cheaper", "Add a side", "Higher protein"],
    ...overrides,
  };
}

/** CoachResult whose shoppingList contains shrimp — triggers shellfish scan. */
function makeShrimpResult(mealName = "Shrimp Stir-fry"): object {
  return makeValidCoachResult({
    meal: { name: mealName, description: "Stir-fry with rice.", prepTime: "15 minutes", servings: 1 },
    shoppingList: [
      { item: "shrimp",  quantity: "6", unit: "oz", category: "Meat" },
      { item: "Bok choy", quantity: "1", unit: "bunch", category: "Produce" },
    ],
  });
}

/** CoachResult whose shoppingList is shellfish-free. */
function makeChickenResult(): object {
  return makeValidCoachResult({
    meal: { name: "Grilled Chicken", description: "Lean protein dinner.", prepTime: "20 minutes", servings: 1 },
    shoppingList: [
      { item: "Chicken breast", quantity: "6", unit: "oz", category: "Meat" },
      { item: "Broccoli",       quantity: "1", unit: "head", category: "Produce" },
    ],
  });
}

/** CoachResult violating GLP-1 fat ceiling (fat=25g, ceiling=10g). */
function makeFatViolatingResult(): object {
  return makeValidCoachResult({ macros: { calories: 380, protein: 35, carbs: 20, fat: 25 } });
}

/** CoachResult within GLP-1 fat ceiling (fat=8g). */
function makeCompliantResult(): object {
  return makeValidCoachResult({ macros: { calories: 330, protein: 35, carbs: 20, fat: 8 } });
}

// ── App factory ───────────────────────────────────────────────────────────────
import request from "supertest";
import express, { Request, Response, NextFunction } from "express";

async function buildApp() {
  const app = express();
  app.use(express.json());

  // Inject auth so resolveUserId() succeeds — the route checks req.authUser?.id.
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.authUser = { id: "test-user-id", planLookupKey: "mpm_premium" };
    next();
  });

  const router = (await import("../routes/groceryCoach")).default;
  app.use("/api/grocery-coach", router);

  // Generic error boundary
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });

  return app;
}

const BASE_BODY = {
  message: "What should I make for dinner tonight?",
  conversationHistory: [],
  servingCount: 1,
};

// ── Reset helpers ─────────────────────────────────────────────────────────────
function resetAll() {
  capturedCalls.length = 0;
  openAIResponseQueue.length = 0;
  mockDbUserRows.length = 0;
  mockDbSgRows.length = 0;
  mockGlp1Context = { isActive: false, resolvedTargets: null };
  activeEnvelope = makeEnvelope();  // reset to no-restriction envelope
  scanGeneratedOutputMock.mockClear();
  mockResolveGLP1.mockClear();
  mockResolveGLP1.mockImplementation(async () => mockGlp1Context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/grocery-coach/recommend — protocol scan + GLP-1 validation", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetAll();
  });

  // ── 1. Allergen blocking (real constraint enforcement) ─────────────────────
  //
  // The envelope has avoidances: ["shellfish"] and allergies: ["shellfish"].
  // The scan mock inspects the actual meal ingredients the route passes to it
  // and returns a violation when it finds "shrimp" (or any shellfish term).
  // If the route stops including shoppingList ingredients in the scan input,
  // or stops loading the correct protocol envelope, these tests will fail.
  describe("allergen / protocol scan blocking", () => {
    beforeEach(() => {
      // Give the route a real shellfish avoidance — the smart scan mock will
      // enforce it against whatever ingredients the route passes in.
      activeEnvelope = makeShellfishEnvelope();
    });

    test(
      "shrimp in shoppingList triggers retry; 422 when retry also contains shellfish",
      async () => {
        // Both LLM calls return shrimp — scan will catch it both times.
        openAIResponseQueue.push(() => makeShrimpResult("Shrimp Stir-fry"));
        openAIResponseQueue.push(() => makeShrimpResult("Garlic Crab Bowl"));

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(422);
        expect(res.body.error).toContain("conflicts with your active health protocol");
        expect(res.body.ndeSummary).toBeDefined();

        // Both initial and retry LLM calls must have been issued.
        expect(capturedCalls).toHaveLength(2);

        // Retry system prompt must name the excluded shellfish term.
        const retryPrompt = capturedCalls[1].systemContent;
        expect(retryPrompt).toContain("CRITICAL CORRECTION");
        expect(retryPrompt).toMatch(/shrimp/i);

        // The scan mock must have been called at least twice (initial + retry).
        expect(scanGeneratedOutputMock.mock.calls.length).toBeGreaterThanOrEqual(2);

        // Each call to the scanner must have received the offending ingredient
        // and the shellfish-constrained envelope.
        const [firstMeal, firstEnv] = scanGeneratedOutputMock.mock.calls[0];
        const firstIngredients = (firstMeal.ingredients ?? []).map((i: any) =>
          (i.name ?? i.item ?? "").toLowerCase()
        );
        expect(firstIngredients.some((n: string) => n.includes("shrimp"))).toBe(true);
        expect(firstEnv.avoidances).toContain("shellfish");
      },
    );

    test(
      "shrimp in shoppingList triggers retry; 200 when retry is shellfish-free",
      async () => {
        // Initial call has shrimp; retry has chicken (no shellfish).
        openAIResponseQueue.push(() => makeShrimpResult("Shrimp Stir-fry"));
        openAIResponseQueue.push(() => makeChickenResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(200);
        expect(res.body.meal?.name).toBe("Grilled Chicken");

        // Two LLM calls: initial violation + compliant retry.
        expect(capturedCalls).toHaveLength(2);

        // Scanner called twice; second call passed chicken (no shellfish → passed).
        expect(scanGeneratedOutputMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        const [retryMeal, retryEnv] = scanGeneratedOutputMock.mock.calls[1];
        const retryIngredients = (retryMeal.ingredients ?? []).map((i: any) =>
          (i.name ?? i.item ?? "").toLowerCase()
        );
        expect(retryIngredients.some((n: string) => n.includes("shrimp"))).toBe(false);
        expect(retryIngredients.some((n: string) => n.includes("chicken"))).toBe(true);
        expect(retryEnv.avoidances).toContain("shellfish");
      },
    );

    test(
      "when the initial scan passes (no shellfish), only one LLM call is made",
      async () => {
        // Initial LLM response is shellfish-free.
        openAIResponseQueue.push(() => makeChickenResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(200);
        expect(capturedCalls).toHaveLength(1);

        // Scan must still have been called (the route must always scan).
        expect(scanGeneratedOutputMock).toHaveBeenCalledTimes(1);
        // And the envelope passed to it must carry the shellfish avoidance.
        const [, envArg] = scanGeneratedOutputMock.mock.calls[0];
        expect(envArg.avoidances).toContain("shellfish");
      },
    );
  });

  // ── 2. GLP-1 macro (fat) validation ───────────────────────────────────────
  describe("GLP-1 macro (fat) validation", () => {
    const GLP1_TARGETS = {
      treatmentPhase: "maintenance",
      resolvedMealCalories: 400,
      targetProteinGrams: 25,
      minimumProteinFloor: 20,
      maximumToleratedFatGrams: 10,
    };

    beforeEach(() => {
      // No shellfish avoidance — scan always passes so GLP-1 logic is isolated.
      activeEnvelope = makeEnvelope();
      mockGlp1Context = {
        isActive: true,
        activationSources: ["medicalConditions"],
        performanceActive: false,
        compositionNote: "",
        resolvedTargets: GLP1_TARGETS,
        dailyNutritionState: null,
      };
    });

    test(
      "fat exceeding GLP-1 ceiling triggers macro-correction retry; 200 when retry is compliant",
      async () => {
        // Initial: fat=25g (violates 10g ceiling); Retry: fat=8g (compliant).
        openAIResponseQueue.push(() => makeFatViolatingResult());
        openAIResponseQueue.push(() => makeCompliantResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(200);
        // Two LLM calls: initial violation + macro-corrected retry.
        expect(capturedCalls).toHaveLength(2);

        // Retry system prompt must carry the GLP-1 macro correction.
        const retryPrompt = capturedCalls[1].systemContent;
        expect(retryPrompt).toContain("CRITICAL GLP-1 MACRO CORRECTION");
        expect(retryPrompt).toContain("10");  // fat ceiling
        expect(retryPrompt).toContain("400"); // calorie ceiling
      },
    );

    test(
      "fat exceeding GLP-1 ceiling; 400 PROTOCOL_VIOLATION when retry is also non-compliant",
      async () => {
        // Both initial and retry violate the fat ceiling.
        openAIResponseQueue.push(() => makeFatViolatingResult());
        openAIResponseQueue.push(() => makeFatViolatingResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("PROTOCOL_VIOLATION");
        expect(res.body.retryable).toBe(true);
        expect(res.body.message).toContain("GLP-1 fat limit");

        // Two LLM calls must have been made.
        expect(capturedCalls).toHaveLength(2);
      },
    );

    test(
      "macros within GLP-1 ceiling — no retry triggered",
      async () => {
        openAIResponseQueue.push(() => makeCompliantResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(200);
        expect(capturedCalls).toHaveLength(1);
      },
    );

    test(
      "GLP-1 resolver returning null causes 503 before any LLM call",
      async () => {
        mockResolveGLP1.mockResolvedValueOnce(null);

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(503);
        expect(res.body.retryable).toBe(true);
        // LLM must not have been contacted.
        expect(capturedCalls).toHaveLength(0);
      },
    );
  });

  // ── 3. Scan error propagation ─────────────────────────────────────────────
  describe("scan error handling", () => {
    test(
      "scanGeneratedOutput throwing propagates to 500 — never silently passes",
      async () => {
        scanGeneratedOutputMock.mockImplementationOnce(() => {
          throw new Error("scan engine internal failure");
        });

        openAIResponseQueue.push(() => makeValidCoachResult());

        const res = await request(app)
          .post("/api/grocery-coach/recommend")
          .send(BASE_BODY);

        expect(res.status).toBe(500);
      },
    );
  });
});
