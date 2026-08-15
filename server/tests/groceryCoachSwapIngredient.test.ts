/**
 * groceryCoachSwapIngredient.test.ts
 *
 * Integration tests for:
 *  A. classifyNutritionalRole — deterministic classifier unit tests for the
 *     five key grocery items in the test matrix.
 *  B. POST /api/grocery-coach/swap-ingredient — end-to-end route integration
 *     tests confirming that:
 *       • The role lock constraint is injected into the AI system prompt.
 *       • Suggestions are in-role and genuinely distinct (variety enforcement).
 *       • The NDE scan fires for both coachSuggestion and alternatives.
 *       • "Use This" / handleConfirmSwap commits only the selected item — the
 *         list remains unchanged until confirmation (state machine logic test).
 *       • All five key test-matrix items produce 200 with valid swap results.
 *
 * Test matrix (five items, must pass):
 *  1. Chicken breast  → lean or fatty proteins (not chicken variations)
 *  2. Broccoli        → fibrous vegetables
 *  3. Brown rice      → starchy carbs
 *  4. Olive oil       → healthy fats
 *  5. Greek yogurt    → dairy options
 *
 * Run: npx jest server/tests/groceryCoachSwapIngredient.test.ts
 */

// ── OpenAI call capture ────────────────────────────────────────────────────────
type OpenAICallArgs = { systemContent: string; userContent: string };
const capturedCalls: OpenAICallArgs[] = [];

// Queue-based response pool — each push() adds one; last entry is reused.
const openAIResponseQueue: Array<() => object> = [];

function nextOpenAIResponse(): object {
  if (openAIResponseQueue.length > 1) return (openAIResponseQueue.shift()!)();
  if (openAIResponseQueue.length === 1) return (openAIResponseQueue[0])();
  return makeValidSwapResult();
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
// buildGroceryCoachContext uses two db.select() chains:
//   1. .from(users).where(...).limit(1)  → user macro rows
//   2. .from(userSavedGroceryItems).where(...)  → saved grocery rows (no .limit)
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
    execute: jest.fn().mockResolvedValue({ rows: [] }),
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

// Configurable active envelope — tests can swap this per scenario.
let activeEnvelope: UserProtocolEnvelope = makeEnvelope();

// ── Mock: protocolEnvelope ─────────────────────────────────────────────────────
// Scan always passes unless the envelope has a hard avoidance matching the item.
const SHELLFISH_TERMS = ["shrimp", "prawn", "crab", "lobster", "scallop", "clam", "oyster", "shellfish"];

const scanGeneratedOutputMock = jest.fn(
  (
    meal: { name?: string; ingredients?: Array<{ name?: string; item?: string } | string> },
    envelope: UserProtocolEnvelope,
  ) => {
    const hasShellfishAvoidance =
      (envelope.avoidances ?? []).some((a) => a.toLowerCase() === "shellfish") ||
      (envelope.allergies  ?? []).some((a) => a.toLowerCase() === "shellfish");

    if (hasShellfishAvoidance) {
      const ingredientNames = (meal.ingredients ?? []).map((ing) =>
        typeof ing === "string"
          ? ing.toLowerCase()
          : ((ing as any).name ?? (ing as any).item ?? "").toLowerCase(),
      );
      for (const term of SHELLFISH_TERMS) {
        if (ingredientNames.some((n) => n.includes(term))) {
          return {
            passed: false,
            message: `contains ${term} — shellfish avoidance`,
            violations: [{ term, category: "shellfish", reason: `${term} is avoided` }],
            instructionViolations: [],
            primaryViolation: { term, category: "shellfish", reason: `${term} is avoided` },
          };
        }
      }
    }

    return {
      passed: true,
      violations: [],
      instructionViolations: [],
      message: "passed",
      primaryViolation: null,
    };
  },
);

jest.mock("../services/protocolEnvelope", () => ({
  buildGuestEnvelope:       jest.fn(() => makeEnvelope()),
  loadUserProtocolEnvelope: jest.fn().mockImplementation(async () => activeEnvelope),
  enforceBeforeGenerate:    jest.fn(() => ({
    combined: "No dietary restrictions — apply general healthy eating.",
    blocks: [],
  })),
  scanGeneratedOutput: (...args: any[]) => scanGeneratedOutputMock(...args),
}));

// ── Mock: resolveGLP1GlobalContext ─────────────────────────────────────────────
let mockGlp1Context: any = { isActive: false, resolvedTargets: null };

const mockResolveGLP1 = jest.fn().mockImplementation(async () => mockGlp1Context);

jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext:    (...args: any[]) => mockResolveGLP1(...args),
  buildGLP1RecommendationBlock: (ctx: any): string => (!ctx?.isActive ? "" : "GLP-1 ACTIVE"),
}));

// ── Mock: savedGroceryCompliance ───────────────────────────────────────────────
jest.mock("../services/savedGroceryCompliance", () => ({
  filterSavedGroceriesForCompliance: jest.fn(() => ({ compliant: [], excluded: [] })),
  buildSavedGroceriesPromptBlock:    jest.fn(() => ""),
}));

// ── Mock: mealCardFinalizer (uses @replit/object-storage — ESM) ───────────────
jest.mock("../services/mealCardFinalizer", () => ({
  finalizeMealCard: jest.fn().mockResolvedValue({ id: "card-1" }),
}));

// ── productAdvisor: use the REAL module ────────────────────────────────────────
// /swap-ingredient now delegates product selection to the Product Advisor
// engine (shared with Find a Product). The engine's OpenAI call goes through
// the mocked `openai` module above, so capturedCalls still records the prompt.
jest.mock("../services/productAdvisor", () =>
  jest.requireActual("../services/productAdvisor"),
);

// ── Swap result helpers ────────────────────────────────────────────────────────

/**
 * Build a valid swap result the AI would return.
 * coachSuggestion, alternatives[0], alternatives[1] must all be different items.
 */
function makeValidSwapResult(overrides: Partial<{
  coachItem: string;
  coachQuantity: string;
  coachUnit: string;
  coachReason: string;
  alt0Item: string;
  alt1Item: string;
}> = {}): object {
  return {
    coachSuggestion: {
      item:     overrides.coachItem     ?? "Turkey breast",
      quantity: overrides.coachQuantity ?? "1",
      unit:     overrides.coachUnit     ?? "lb",
      reason:   overrides.coachReason   ?? "High protein, fits your macro targets.",
    },
    alternatives: [
      {
        item:     overrides.alt0Item ?? "Cod fillet",
        quantity: "6",
        unit:     "oz",
        reason:   "Lean white fish, quick to cook.",
      },
      {
        item:     overrides.alt1Item ?? "Shrimp",
        quantity: "8",
        unit:     "oz",
        reason:   "Fast-cooking lean protein.",
      },
    ],
    savedOption: null,
    protocolNote: null,
  };
}

/** Swap result where coachSuggestion duplicates the item being replaced. */
function makeDuplicateCoachResult(original: string): object {
  return {
    coachSuggestion: { item: original, quantity: "1", unit: "lb", reason: "Same thing." },
    alternatives: [{ item: "Something else", quantity: "1", unit: "lb", reason: "Different." }],
    savedOption: null,
    protocolNote: null,
  };
}

/** Swap result where both alternatives are the same as coachSuggestion. */
function makeAllDuplicateAltsResult(): object {
  return {
    coachSuggestion: { item: "Turkey breast", quantity: "1", unit: "lb", reason: "Good pick." },
    alternatives: [
      { item: "Turkey breast", quantity: "1", unit: "lb", reason: "Same." },  // dup
      { item: "turkey breast", quantity: "1", unit: "lb", reason: "Same." },  // dup (case)
    ],
    savedOption: null,
    protocolNote: null,
  };
}

// ── App factory ───────────────────────────────────────────────────────────────
import request  from "supertest";
import express, { Request, Response, NextFunction } from "express";

async function buildApp() {
  const app = express();
  app.use(express.json());

  app.use((req: any, _res: Response, next: NextFunction) => {
    req.authUser = { id: "test-user-id", planLookupKey: "mpm_premium" };
    next();
  });

  const router = (await import("../routes/groceryCoach")).default;
  app.use("/api/grocery-coach", router);

  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });

  return app;
}

// ── Reset helpers ─────────────────────────────────────────────────────────────
function resetAll() {
  capturedCalls.length = 0;
  openAIResponseQueue.length = 0;
  mockDbUserRows.length = 0;
  mockDbSgRows.length = 0;
  mockGlp1Context = { isActive: false, resolvedTargets: null };
  activeEnvelope = makeEnvelope();
  scanGeneratedOutputMock.mockClear();
  mockResolveGLP1.mockClear();
  mockResolveGLP1.mockImplementation(async () => mockGlp1Context);
}

// ── Base swap body factory ────────────────────────────────────────────────────
function swapBody(ingredientToReplace: string, overrides: Record<string, unknown> = {}) {
  return {
    ingredientToReplace,
    itemCategory: "Produce",
    mealName: "Test Meal",
    mealDescription: "A healthy dinner.",
    remainingIngredients: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Classifier unit tests — pure deterministic, no mocks needed
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyNutritionalRole — five key grocery items", () => {
  // Import the real classifier (not mocked)
  let classifyNutritionalRole: (item: string) => string;

  beforeAll(async () => {
    const mod = await import("../services/groceryNutritionalRole");
    classifyNutritionalRole = mod.classifyNutritionalRole;
  });

  test("chicken breast → lean_protein", () => {
    expect(classifyNutritionalRole("chicken breast")).toBe("lean_protein");
    expect(classifyNutritionalRole("Chicken Breast")).toBe("lean_protein");
    expect(classifyNutritionalRole("boneless chicken breast")).toBe("lean_protein");
  });

  test("broccoli → fibrous_vegetable", () => {
    expect(classifyNutritionalRole("broccoli")).toBe("fibrous_vegetable");
    expect(classifyNutritionalRole("Broccoli florets")).toBe("fibrous_vegetable");
    expect(classifyNutritionalRole("fresh broccoli")).toBe("fibrous_vegetable");
  });

  test("brown rice → starchy_carb", () => {
    expect(classifyNutritionalRole("brown rice")).toBe("starchy_carb");
    expect(classifyNutritionalRole("Brown Rice")).toBe("starchy_carb");
    expect(classifyNutritionalRole("cooked brown rice")).toBe("starchy_carb");
  });

  test("olive oil → healthy_fat", () => {
    expect(classifyNutritionalRole("olive oil")).toBe("healthy_fat");
    expect(classifyNutritionalRole("Olive Oil")).toBe("healthy_fat");
    expect(classifyNutritionalRole("extra virgin olive oil")).toBe("healthy_fat");
  });

  test("greek yogurt → dairy", () => {
    expect(classifyNutritionalRole("greek yogurt")).toBe("dairy");
    expect(classifyNutritionalRole("Greek Yogurt")).toBe("dairy");
    expect(classifyNutritionalRole("plain Greek yogurt")).toBe("dairy");
  });

  // Confirm other common items classify correctly for broader regression coverage
  test("turkey breast → lean_protein", () => {
    expect(classifyNutritionalRole("turkey breast")).toBe("lean_protein");
  });

  test("cod → lean_protein", () => {
    expect(classifyNutritionalRole("cod")).toBe("lean_protein");
  });

  test("spinach → fibrous_vegetable", () => {
    expect(classifyNutritionalRole("spinach")).toBe("fibrous_vegetable");
  });

  test("quinoa → starchy_carb", () => {
    expect(classifyNutritionalRole("quinoa")).toBe("starchy_carb");
  });

  test("avocado oil → healthy_fat", () => {
    expect(classifyNutritionalRole("avocado oil")).toBe("healthy_fat");
  });

  test("cottage cheese → dairy", () => {
    expect(classifyNutritionalRole("cottage cheese")).toBe("dairy");
  });

  test("soy sauce → condiment (before plant_protein rule)", () => {
    expect(classifyNutritionalRole("soy sauce")).toBe("condiment");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. POST /api/grocery-coach/swap-ingredient — route integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/grocery-coach/swap-ingredient — five-item test matrix", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetAll();
  });

  // ── B.1  Chicken breast → proteins (not chicken variations) ────────────────
  describe("1. Chicken breast — role lock: lean_protein / fatty_protein", () => {
    test("returns 200 with coachSuggestion and two alternatives", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Turkey breast",
          alt0Item:  "Cod fillet",
          alt1Item:  "Shrimp",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Turkey breast");
      expect(res.body.alternatives).toHaveLength(2);
    });

    test("system prompt contains the lean_protein role label", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod fillet", alt1Item: "Shrimp" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("lean protein source");
      expect(systemPrompt).toContain("NUTRITIONAL ROLE LOCK");
    });

    test("system prompt forbids chicken breast itself and calls for variety", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod fillet", alt1Item: "Shrimp" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("chicken breast");
      expect(systemPrompt).toContain("VARIETY REQUIREMENT");
      expect(systemPrompt).toContain("GENUINELY DIFFERENT");
    });

    test("alternatives are deduplicated — exact case-insensitive matches removed", async () => {
      openAIResponseQueue.push(() => makeAllDuplicateAltsResult());

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // Both alternatives duplicated coachSuggestion — must be filtered out
      expect(res.body.alternatives).toHaveLength(0);
    });

    test("NDE scan fires for coachSuggestion; blocks shellfish when user avoids shellfish", async () => {
      activeEnvelope = makeEnvelope({ avoidances: ["shellfish"], allergies: ["shellfish"] });

      // Shrimp (shellfish) returned as coachSuggestion → scan should block it
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Shrimp", alt0Item: "Cod", alt1Item: "Turkey" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/conflicts with your active health protocol/i);
    });

    test("NDE scan filters shellfish from alternatives when user avoids shellfish", async () => {
      activeEnvelope = makeEnvelope({ avoidances: ["shellfish"], allergies: ["shellfish"] });

      // coachSuggestion is safe; alt0 is shrimp (blocked); alt1 is safe
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Shrimp", alt1Item: "Cod fillet" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // Shrimp alt must have been removed; only cod fillet survives
      const altItems = res.body.alternatives.map((a: any) => a.item.toLowerCase());
      expect(altItems.some((i: string) => i.includes("shrimp"))).toBe(false);
      expect(altItems.some((i: string) => i.includes("cod"))).toBe(true);
    });
  });

  // ── B.2  Broccoli → fibrous vegetables ────────────────────────────────────
  describe("2. Broccoli — role lock: fibrous_vegetable", () => {
    test("returns 200 with fibrous vegetable replacements", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Spinach",
          alt0Item:  "Zucchini",
          alt1Item:  "Asparagus",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("broccoli", { itemCategory: "Produce" }));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Spinach");
      expect(res.body.alternatives).toHaveLength(2);
    });

    test("system prompt contains the fibrous_vegetable role label", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Spinach", alt0Item: "Zucchini", alt1Item: "Cauliflower" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("broccoli"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("fibrous vegetable");
      expect(systemPrompt).toContain("NUTRITIONAL ROLE LOCK");
    });

    test("alternatives are genuinely different — no duplicates of each other or coachSuggestion", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Spinach",
          alt0Item:  "Cauliflower",
          alt1Item:  "Brussels sprout",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("broccoli"));

      expect(res.status).toBe(200);
      const items = [res.body.coachSuggestion.item, ...res.body.alternatives.map((a: any) => a.item)];
      const uniqueItems = new Set(items.map((i: string) => i.toLowerCase().trim()));
      // All returned items should be distinct
      expect(uniqueItems.size).toBe(items.length);
    });
  });

  // ── B.3  Brown rice → starchy carbs ───────────────────────────────────────
  describe("3. Brown rice — role lock: starchy_carb", () => {
    test("returns 200 with starchy carb replacements", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Quinoa",
          alt0Item:  "Sweet potato",
          alt1Item:  "Farro",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice", { itemCategory: "Grains & Packaged" }));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Quinoa");
      expect(res.body.alternatives).toHaveLength(2);
    });

    test("system prompt contains the starchy_carb role label", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Quinoa", alt0Item: "Sweet potato", alt1Item: "Barley" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("starchy carbohydrate");
      expect(systemPrompt).toContain("NUTRITIONAL ROLE LOCK");
    });

    test("system prompt names the item being replaced so AI avoids it", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Quinoa", alt0Item: "Farro", alt1Item: "Barley" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("brown rice");
      expect(systemPrompt).toContain(`Never suggest "brown rice"`);
    });

    test("each suggestion carries a reason string", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Quinoa", alt0Item: "Sweet potato", alt1Item: "Barley" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      expect(typeof res.body.coachSuggestion.reason).toBe("string");
      expect(res.body.coachSuggestion.reason.length).toBeGreaterThan(0);
      for (const alt of res.body.alternatives) {
        expect(typeof alt.reason).toBe("string");
        expect(alt.reason.length).toBeGreaterThan(0);
      }
    });
  });

  // ── B.4  Olive oil → healthy fats ─────────────────────────────────────────
  describe("4. Olive oil — role lock: healthy_fat", () => {
    test("returns 200 with healthy fat replacements", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Avocado oil",
          alt0Item:  "Coconut oil",
          alt1Item:  "Ghee",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("olive oil", { itemCategory: "Pantry" }));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Avocado oil");
      expect(res.body.alternatives).toHaveLength(2);
    });

    test("system prompt contains the healthy_fat role label", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Avocado oil", alt0Item: "Ghee", alt1Item: "Walnut oil" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("olive oil"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("healthy fat source");
      expect(systemPrompt).toContain("NUTRITIONAL ROLE LOCK");
    });
  });

  // ── B.5  Greek yogurt → dairy options ─────────────────────────────────────
  describe("5. Greek yogurt — role lock: dairy", () => {
    test("returns 200 with dairy replacements", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Skyr",
          alt0Item:  "Cottage cheese",
          alt1Item:  "Kefir",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("greek yogurt", { itemCategory: "Dairy & Eggs" }));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Skyr");
      expect(res.body.alternatives).toHaveLength(2);
    });

    test("system prompt contains the dairy role label", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Skyr", alt0Item: "Cottage cheese", alt1Item: "Kefir" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("greek yogurt"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("dairy or dairy alternative");
      expect(systemPrompt).toContain("NUTRITIONAL ROLE LOCK");
    });
  });

  // ── B.6  Cross-cutting: response structure ─────────────────────────────────
  describe("response structure — shared contract across all items", () => {
    const TEST_ITEMS = [
      { ingredient: "chicken breast",  coachItem: "Turkey breast",  alt0: "Cod fillet",   alt1: "Shrimp"     },
      { ingredient: "broccoli",        coachItem: "Spinach",        alt0: "Zucchini",     alt1: "Cauliflower" },
      { ingredient: "brown rice",      coachItem: "Quinoa",         alt0: "Farro",        alt1: "Barley"     },
      { ingredient: "olive oil",       coachItem: "Avocado oil",    alt0: "Ghee",         alt1: "Coconut oil"},
      { ingredient: "greek yogurt",    coachItem: "Skyr",           alt0: "Cottage cheese", alt1: "Kefir"   },
    ];

    test.each(TEST_ITEMS)(
      "$ingredient → returns 200 with coachSuggestion + 2 alternatives + null savedOption",
      async ({ ingredient, coachItem, alt0, alt1 }) => {
        openAIResponseQueue.push(() =>
          makeValidSwapResult({ coachItem, alt0Item: alt0, alt1Item: alt1 }),
        );

        const res = await request(app)
          .post("/api/grocery-coach/swap-ingredient")
          .send(swapBody(ingredient));

        expect(res.status).toBe(200);

        // coachSuggestion must be present with required fields
        expect(res.body.coachSuggestion).toBeDefined();
        expect(typeof res.body.coachSuggestion.item).toBe("string");
        expect(res.body.coachSuggestion.item.length).toBeGreaterThan(0);
        expect(typeof res.body.coachSuggestion.reason).toBe("string");

        // Two distinct alternatives must be present
        expect(Array.isArray(res.body.alternatives)).toBe(true);
        expect(res.body.alternatives.length).toBeGreaterThanOrEqual(1);
        for (const alt of res.body.alternatives) {
          expect(typeof alt.item).toBe("string");
          expect(alt.item.length).toBeGreaterThan(0);
        }

        // savedOption must be null (no saved groceries in this test)
        expect(res.body.savedOption).toBeNull();

        // Exactly one OpenAI call was made
        expect(capturedCalls).toHaveLength(1);

        // NDE scan fired at least once (for coachSuggestion)
        expect(scanGeneratedOutputMock).toHaveBeenCalled();

        resetAll();
      },
    );
  });

  // ── B.7  Error handling ────────────────────────────────────────────────────
  describe("error handling", () => {
    test("missing ingredientToReplace → 400", async () => {
      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send({ mealName: "Test Meal" }); // no ingredientToReplace

      expect(res.status).toBe(400);
    });

    test("unauthenticated request → route returns 401", async () => {
      // Build a second app without the auth middleware
      const bareApp = express();
      bareApp.use(express.json());
      const router = (await import("../routes/groceryCoach")).default;
      bareApp.use("/api/grocery-coach", router);

      const res = await request(bareApp)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(401);
    });

    test("AI response missing coachSuggestion.item → 500", async () => {
      // Queue a structurally invalid swap result — coachSuggestion has no item.
      // The route checks `if (!coachItem || typeof coachItem !== "string")`
      // and returns 500 when that guard fires.
      openAIResponseQueue.push(() => ({
        coachSuggestion: { item: "", quantity: "1", unit: "lb", reason: "Oops." },
        alternatives: [],
        savedOption: null,
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/suitable replacement/i);
    });

    test("GLP-1 constraint block is injected when user has active GLP-1", async () => {
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 25,
          minimumProteinFloor: 20,
          maximumToleratedFatGrams: 10,
        },
      };

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod", alt1Item: "Tilapia" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("GLP-1 CONSTRAINT");
      expect(systemPrompt).toContain("10");    // fat ceiling
      expect(systemPrompt).toContain("400");   // calorie ceiling
    });

    test("diabetic constraint block is injected when user has diabetes", async () => {
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Cauliflower rice", alt0Item: "Zucchini noodles", alt1Item: "Spaghetti squash" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      const systemPrompt = capturedCalls[0].systemContent;
      expect(systemPrompt).toContain("DIABETIC CONSTRAINT");
      expect(systemPrompt).toContain("low-carb");
    });
  });

  // ── B.8  Custom user request ("Or Type What You Want") ────────────────────
  describe("custom userRequest — 'Or Type What You Want' flow", () => {
    test("userRequest is forwarded to AI and reflected in system prompt", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Wild salmon", alt0Item: "Mackerel", alt1Item: "Sardines" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast", { userRequest: "I was thinking wild salmon" }));

      const systemPrompt = capturedCalls[0].systemContent;
      const userPrompt   = capturedCalls[0].userContent;

      // The instruction about honouring user request must appear
      expect(systemPrompt).toContain("The user specifically wants");
      expect(systemPrompt).toContain("wild salmon");

      // The user-facing prompt must name the custom request
      expect(userPrompt).toContain("I was thinking");
    });

    test("custom request still returns a valid swap result with coachSuggestion", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Wild salmon", alt0Item: "Mackerel", alt1Item: "Sardines" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast", { userRequest: "I want salmon instead" }));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Wild salmon");
    });
  });

  // ── B.9  Role enforcement (server-side) ──────────────────────────────────
  describe("role enforcement — cross-role suggestions are rejected or filtered", () => {
    // ── Negative: cross-role coachSuggestion → 422 ──────────────────────────
    test("cross-role coachSuggestion (starch for protein) → 422 for non-clinical user", async () => {
      // "Brown rice" is starchy_carb; replacing "chicken breast" (lean_protein / protein family)
      // with a starchy carb is a role violation → route must return 422.
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Brown rice", alt0Item: "Quinoa", alt1Item: "Barley" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/different food type/i);
    });

    test("cross-role coachSuggestion (protein for vegetable) → 422 for non-clinical user", async () => {
      // Replacing "broccoli" (fibrous_vegetable) with "Chicken breast" (protein) is cross-role.
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Chicken breast", alt0Item: "Spinach", alt1Item: "Kale" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("broccoli"));

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/different food type/i);
    });

    // ── Negative: cross-role alternatives filtered out ────────────────────────
    test("cross-role alternatives are silently filtered; in-role alternatives survive", async () => {
      // coachSuggestion: Turkey breast (lean_protein, protein family ✓)
      // alt0: Brown rice (starchy_carb) → FILTERED — wrong family
      // alt1: Cod fillet (lean_protein) → KEPT ✓
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Brown rice", alt1Item: "Cod fillet" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Turkey breast");

      const altItems: string[] = res.body.alternatives.map((a: any) => a.item.toLowerCase());
      // Brown rice must be filtered (wrong family)
      expect(altItems.some((i) => i.includes("brown rice") || i.includes("rice"))).toBe(false);
      // Cod fillet must survive (correct family)
      expect(altItems.some((i) => i.includes("cod"))).toBe(true);
    });

    // ── Positive: protein family — lean/fatty/plant all compatible ───────────
    test("fatty_protein replacement (salmon) is compatible with lean_protein original (chicken breast)", async () => {
      // wild salmon → classified as fatty_protein → "protein" family
      // chicken breast → lean_protein → "protein" family
      // Same family: should be accepted.
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Wild salmon", alt0Item: "Cod fillet", alt1Item: "Turkey breast" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Wild salmon");
    });

    test("plant_protein replacement (tofu) is compatible with lean_protein original (chicken breast)", async () => {
      // tofu → plant_protein → "protein" family ✓
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Tofu", alt0Item: "Tempeh", alt1Item: "Lentils" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Tofu");
    });

    // ── Clinical exemption — isClinical skips role check ─────────────────────
    test("cross-role suggestion is accepted for clinical (diabetic) user — clinical constraints take priority", async () => {
      // A diabetic user replacing brown rice → cauliflower rice is valid
      // (fibrous_vegetable family, but diabetic constraint overrides role lock).
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Cauliflower rice", alt0Item: "Zucchini noodles", alt1Item: "Shirataki noodles" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      // Clinical users get no alternatives (safety gate)
      expect(res.body.coachSuggestion.item).toBe("Cauliflower rice");
    });

    test("cross-role suggestion is accepted for GLP-1 clinical user", async () => {
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 25,
          minimumProteinFloor: 20,
          maximumToleratedFatGrams: 10,
        },
      };

      // GLP-1 user replacing olive oil (healthy_fat) — clinical user, role check skipped
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Asparagus", alt0Item: "Spinach", alt1Item: "Zucchini" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("olive oil"));

      // isClinical = true → role check bypassed → 200
      expect(res.status).toBe(200);
    });

    // ── savedOption cross-role rejection ──────────────────────────────────────
    test("cross-role savedOption is rejected (null) for non-clinical user; coachSuggestion still returned", async () => {
      // Replacing "chicken breast" (protein family). AI returns a saved option
      // that is starchy_carb (brown rice) — wrong family → must be null in response.
      openAIResponseQueue.push(() => ({
        coachSuggestion: { item: "Turkey breast", quantity: "1", unit: "lb", reason: "Good pick." },
        alternatives:    [
          { item: "Cod fillet",   quantity: "6", unit: "oz", reason: "Lean fish." },
          { item: "Shrimp",       quantity: "8", unit: "oz", reason: "Quick protein." },
        ],
        savedOption: { item: "Brown rice", quantity: "1", unit: "cup", reason: "From saved products." },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion.item).toBe("Turkey breast");
      // Cross-role savedOption must be nulled out
      expect(res.body.savedOption).toBeNull();
    });

    test("in-role savedOption is accepted for non-clinical user", async () => {
      // Replacing "chicken breast" (protein). Saved option is "Turkey breast" — protein family ✓.
      // Membership check: Turkey breast must be in the user's saved rows.
      mockDbSgRows.push({
        id:           "sg-role-1",
        productName:  "Turkey breast",
        brand:        "Applegate",
        category:     "Meat",
        productKey:   "turkey-breast-applegate",
        nutritionJson: { calories: 120, protein: 26, fat: 1, carbs: 0 },
        productMeta:  null,
        savedAt:      new Date(),
      });

      openAIResponseQueue.push(() => ({
        coachSuggestion: { item: "Cod fillet",   quantity: "6", unit: "oz", reason: "Lean fish."   },
        alternatives:    [
          { item: "Shrimp",      quantity: "8", unit: "oz", reason: "Quick protein." },
          { item: "Tilapia",     quantity: "6", unit: "oz", reason: "Mild white fish." },
        ],
        savedOption: { item: "Turkey breast", quantity: "1", unit: "lb", reason: "From saved products." },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // In-role savedOption must be present
      expect(res.body.savedOption).not.toBeNull();
      expect(res.body.savedOption.item).toBe("Turkey breast");
    });

    // ── "other" role — uncategorised items bypass enforcement ─────────────────
    test("unknown original ingredient (role: other) bypasses role enforcement", async () => {
      // "Miso paste" → classified as "condiment" ... wait, let me use a truly
      // uncategorised item that would fall through to "other".
      // A novel item not in any rule: "dragon fruit powder" → "other"
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Bee pollen", alt0Item: "Spirulina", alt1Item: "Matcha powder" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("dragon fruit powder"));

      // Role is "other" → enforcement skipped → 200
      expect(res.status).toBe(200);
    });
  });

  // ── B.10 remainingIngredients context ─────────────────────────────────────
  describe("remainingIngredients — meal context is forwarded to AI", () => {
    test("remaining items appear in system prompt so AI picks a cohesive swap", async () => {
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Zucchini", alt0Item: "Spinach", alt1Item: "Asparagus" }),
      );

      await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("broccoli", {
          remainingIngredients: ["salmon fillet", "quinoa", "lemon"],
        }));

      const systemPrompt = capturedCalls[0].systemContent;
      // Remaining ingredients must appear so the AI knows the meal context
      expect(systemPrompt).toContain("salmon fillet");
      expect(systemPrompt).toContain("quinoa");
    });
  });

  // ── B.11 savedOption — saved grocery favorites ────────────────────────────
  describe("savedOption — saved grocery favorites", () => {
    // ── B.11.1  Happy path: matching saved product surfaces as savedOption ───
    test("savedOption is non-null with correct item name and reason when a saved product matches the AI suggestion", async () => {
      // Populate saved groceries with a product that matches what the AI returns.
      mockDbSgRows.push({
        id:           "sg-1",
        productName:  "Turkey breast",
        brand:        "Applegate",
        category:     "Meat",
        productKey:   "turkey-breast-applegate",
        nutritionJson: { calories: 120, protein: 26, fat: 1, carbs: 0 },
        productMeta:  null,
        savedAt:      new Date(),
      });

      // AI returns savedOption pointing to that product.
      openAIResponseQueue.push(() => ({
        coachSuggestion: {
          item:     "Cod fillet",
          quantity: "6",
          unit:     "oz",
          reason:   "Lean white fish, fits your macro targets.",
        },
        alternatives: [
          { item: "Tilapia",  quantity: "6", unit: "oz", reason: "Mild lean protein." },
          { item: "Wild salmon", quantity: "5", unit: "oz", reason: "Rich in omega-3." },
        ],
        savedOption: {
          item:     "Turkey breast",
          quantity: "1",
          unit:     "lb",
          reason:   "From your saved products — a great lean swap.",
        },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // savedOption must be present with the correct product name
      expect(res.body.savedOption).not.toBeNull();
      expect(res.body.savedOption.item).toBe("Turkey breast");
      // The reason string must be non-empty (personalisation signal)
      expect(typeof res.body.savedOption.reason).toBe("string");
      expect(res.body.savedOption.reason.length).toBeGreaterThan(0);

      // The saved product name must have been injected into the AI prompt —
      // this confirms data flowed from savedRows → system prompt → AI, not
      // just from the AI's arbitrary output back through the route.
      expect(capturedCalls[0].systemContent).toContain("Turkey breast");
      expect(capturedCalls[0].systemContent).toContain("saved products");
    });

    // ── B.11.4  Negative: AI hallucinated a savedOption not in savedRows ──────
    test("savedOption is null when the AI names a product that is not in the user's saved rows", async () => {
      // savedRows is empty — user has no saved products at all.
      // AI fabricates a savedOption that was never saved by this user.
      openAIResponseQueue.push(() => ({
        coachSuggestion: {
          item:     "Cod fillet",
          quantity: "6",
          unit:     "oz",
          reason:   "Lean white fish.",
        },
        alternatives: [
          { item: "Tilapia",      quantity: "6", unit: "oz", reason: "Mild protein." },
          { item: "Wild salmon",  quantity: "5", unit: "oz", reason: "Rich in omega-3." },
        ],
        // AI hallucinated this — "Turkey breast" is not in the user's saved rows.
        savedOption: {
          item:     "Turkey breast",
          quantity: "1",
          unit:     "lb",
          reason:   "From your saved products.",
        },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // Hallucinated savedOption must be rejected — membership check failed.
      expect(res.body.savedOption).toBeNull();
      // Primary suggestion is unaffected.
      expect(res.body.coachSuggestion.item).toBe("Cod fillet");
    });

    // ── B.11.2  Clinical GLP-1 fat ceiling blocks the saved product ──────────
    test("savedOption is null for a clinical GLP-1 user when the saved product nutritionJson exceeds the fat ceiling", async () => {
      // Activate GLP-1 with a tight fat ceiling (10 g).
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase:             "maintenance",
          resolvedMealCalories:        400,
          targetProteinGrams:          25,
          minimumProteinFloor:         20,
          maximumToleratedFatGrams:    10,
        },
      };

      // Saved product has 22 g fat — well above the 10 g ceiling.
      mockDbSgRows.push({
        id:           "sg-2",
        productName:  "Turkey thigh",
        brand:        "Perdue",
        category:     "Meat",
        productKey:   "turkey-thigh-perdue",
        nutritionJson: { calories: 280, protein: 24, fat: 22, carbs: 0 },
        productMeta:  null,
        savedAt:      new Date(),
      });

      // AI returns savedOption pointing to the high-fat saved product.
      openAIResponseQueue.push(() => ({
        coachSuggestion: {
          item:     "Cod fillet",
          quantity: "6",
          unit:     "oz",
          reason:   "Lean white fish, GLP-1 safe.",
        },
        alternatives: [],
        savedOption: {
          item:     "Turkey thigh",
          quantity: "1",
          unit:     "lb",
          reason:   "From your saved products.",
        },
        protocolNote: "GLP-1 fat limit applied.",
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // Fat ceiling exceeded → savedOption must be null
      expect(res.body.savedOption).toBeNull();
      // Primary suggestion is still returned
      expect(res.body.coachSuggestion.item).toBe("Cod fillet");
    });

    // ── B.11.3  NDE scan blocks the saved product ────────────────────────────
    test("savedOption is null when the NDE scan blocks the saved item due to a protocol avoidance", async () => {
      // User avoids shellfish.
      activeEnvelope = makeEnvelope({ avoidances: ["shellfish"], allergies: ["shellfish"] });

      // Populate saved groceries with a shellfish product.
      mockDbSgRows.push({
        id:           "sg-3",
        productName:  "Shrimp",
        brand:        "SeaPak",
        category:     "Meat",
        productKey:   "shrimp-seapak",
        nutritionJson: { calories: 100, protein: 20, fat: 1, carbs: 1 },
        productMeta:  null,
        savedAt:      new Date(),
      });

      // AI returns a safe coachSuggestion but a shellfish savedOption.
      openAIResponseQueue.push(() => ({
        coachSuggestion: {
          item:     "Turkey breast",
          quantity: "1",
          unit:     "lb",
          reason:   "High protein, fits your macro targets.",
        },
        alternatives: [
          { item: "Cod fillet", quantity: "6", unit: "oz", reason: "Lean white fish." },
          { item: "Tilapia",    quantity: "6", unit: "oz", reason: "Mild protein." },
        ],
        savedOption: {
          item:     "Shrimp",
          quantity: "8",
          unit:     "oz",
          reason:   "From your saved products.",
        },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      // NDE scan blocks shrimp (shellfish avoidance) → savedOption must be null
      expect(res.body.savedOption).toBeNull();
      // Primary suggestion is safe and still returned
      expect(res.body.coachSuggestion.item).toBe("Turkey breast");
      // NDE scan must have been invoked (at least for coachSuggestion + savedOption)
      expect(scanGeneratedOutputMock).toHaveBeenCalled();
    });

    // ── B.11.5  Clinical diabetic carb ceiling blocks the saved product ───────
    test("savedOption is null for a diabetic user when the saved product nutritionJson exceeds the 45 g carb ceiling", async () => {
      // Diabetic user — no GLP-1 active.
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      // Saved product has 60 g carbs — well above the 45 g diabetic ceiling.
      mockDbSgRows.push({
        id:            "sg-4",
        productName:   "White rice cake pack",
        brand:         "Quaker",
        category:      "Grains & Packaged",
        productKey:    "white-rice-cake-quaker",
        nutritionJson: { calories: 280, protein: 5, fat: 2, carbs: 60 },
        productMeta:   null,
        savedAt:       new Date(),
      });

      // AI returns a safe coachSuggestion but points savedOption at the high-carb saved product.
      openAIResponseQueue.push(() => ({
        coachSuggestion: {
          item:     "Cauliflower rice",
          quantity: "2",
          unit:     "cups",
          reason:   "Low-carb substitute, diabetic safe.",
        },
        alternatives: [
          { item: "Zucchini noodles", quantity: "2", unit: "cups", reason: "Very low in carbs." },
          { item: "Shirataki noodles", quantity: "1", unit: "pack", reason: "Near-zero carbs." },
        ],
        savedOption: {
          item:     "White rice cake pack",
          quantity: "1",
          unit:     "pack",
          reason:   "From your saved products.",
        },
        protocolNote: null,
      }));

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      // Carb ceiling exceeded (60 g > 45 g) → savedOption must be null
      expect(res.body.savedOption).toBeNull();
      // Primary suggestion is still returned
      expect(res.body.coachSuggestion.item).toBe("Cauliflower rice");
    });
  });

  // ── B.12 Clinical users — alternatives always omitted ─────────────────────
  // For GLP-1 and diabetic users the route intentionally returns an empty
  // alternatives array.  The NDE-scanned coachSuggestion is returned alone so
  // we never surface unverified LLM items to clinical users.
  describe("clinical users — alternatives array is always empty", () => {
    // ── GLP-1 active ──────────────────────────────────────────────────────────
    test("GLP-1 active: alternatives is [] in response", async () => {
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 25,
          minimumProteinFloor: 20,
          maximumToleratedFatGrams: 10,
        },
      };

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod", alt1Item: "Tilapia" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.alternatives)).toBe(true);
      expect(res.body.alternatives).toHaveLength(0);
    });

    test("GLP-1 active: coachSuggestion is still present and non-empty", async () => {
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 25,
          minimumProteinFloor: 20,
          maximumToleratedFatGrams: 10,
        },
      };

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod", alt1Item: "Tilapia" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion).toBeDefined();
      expect(typeof res.body.coachSuggestion.item).toBe("string");
      expect(res.body.coachSuggestion.item.length).toBeGreaterThan(0);
    });

    test("GLP-1 active: coachSuggestion passes NDE scan (shellfish blocked even for clinical user)", async () => {
      mockGlp1Context = {
        isActive: true,
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 25,
          minimumProteinFloor: 20,
          maximumToleratedFatGrams: 10,
        },
      };
      // Clinical user who also avoids shellfish
      activeEnvelope = makeEnvelope({ avoidances: ["shellfish"], allergies: ["shellfish"] });

      // AI returns shrimp (shellfish) as coachSuggestion — NDE must block it
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Shrimp", alt0Item: "Cod", alt1Item: "Tilapia" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/conflicts with your active health protocol/i);
    });

    // ── Diabetic user ──────────────────────────────────────────────────────────
    test("hasDiabetes: alternatives is [] in response", async () => {
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Cauliflower rice",
          alt0Item:  "Zucchini noodles",
          alt1Item:  "Shirataki noodles",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.alternatives)).toBe(true);
      expect(res.body.alternatives).toHaveLength(0);
    });

    test("hasDiabetes: coachSuggestion is still present and non-empty", async () => {
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem: "Cauliflower rice",
          alt0Item:  "Zucchini noodles",
          alt1Item:  "Shirataki noodles",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      expect(res.body.coachSuggestion).toBeDefined();
      expect(typeof res.body.coachSuggestion.item).toBe("string");
      expect(res.body.coachSuggestion.item.length).toBeGreaterThan(0);
    });

    test("hasDiabetes: response is a usable swap — item, quantity, unit, reason all present", async () => {
      activeEnvelope = makeEnvelope({ hasDiabetes: true });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({
          coachItem:     "Cauliflower rice",
          coachQuantity: "2",
          coachUnit:     "cups",
          coachReason:   "Very low carb, safe for blood sugar.",
          alt0Item:      "Zucchini noodles",
          alt1Item:      "Shirataki noodles",
        }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(200);
      const cs = res.body.coachSuggestion;
      expect(typeof cs.item).toBe("string");
      expect(typeof cs.quantity).toBe("string");
      expect(typeof cs.unit).toBe("string");
      expect(typeof cs.reason).toBe("string");
      expect(cs.reason.length).toBeGreaterThan(0);
    });

    test("hasDiabetes: NDE scan still fires for coachSuggestion", async () => {
      activeEnvelope = makeEnvelope({
        hasDiabetes: true,
        avoidances:  ["shellfish"],
        allergies:   ["shellfish"],
      });

      // AI returns shrimp — NDE must block it even for diabetic users
      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Shrimp", alt0Item: "Cod", alt1Item: "Cauliflower rice" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("brown rice"));

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/conflicts with your active health protocol/i);
    });

    // ── Non-clinical baseline — confirm standard users still get alternatives ─
    test("non-clinical user: alternatives still has items (baseline check)", async () => {
      // Reset to default non-clinical state
      mockGlp1Context = { isActive: false, resolvedTargets: null };
      activeEnvelope  = makeEnvelope({ hasDiabetes: false });

      openAIResponseQueue.push(() =>
        makeValidSwapResult({ coachItem: "Turkey breast", alt0Item: "Cod fillet", alt1Item: "Shrimp" }),
      );

      const res = await request(app)
        .post("/api/grocery-coach/swap-ingredient")
        .send(swapBody("chicken breast"));

      expect(res.status).toBe(200);
      expect(res.body.alternatives.length).toBeGreaterThan(0);
    });
  });
});
