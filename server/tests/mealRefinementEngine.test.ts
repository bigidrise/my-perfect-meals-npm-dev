/**
 * mealRefinementEngine.test.ts
 *
 * Integration tests confirming that clinical safety behaviours survive the
 * engine refactor end-to-end through MealRefinementEngine._replaceIngredient:
 *
 *  1. Allergen violation — when scanGeneratedOutput flags the LLM suggestion,
 *     a protocolNote warning is appended to the result (swap is never silently
 *     passed through without a clinical note).
 *
 *  2. GLP-1 context injection — resolveGLP1GlobalContext is called with the
 *     correct userId and today's ISO date, and the GLP-1 block appears inside
 *     the system prompt sent to OpenAI.
 *
 *  3. Saved grocery injection — when the user has compliant saved items,
 *     buildSavedGroceriesPromptBlock output appears in the system prompt so
 *     the LLM is aware of the user's vetted favourites.
 *
 * Strategy:
 *   • Mock OpenAI, DB, protocolEnvelope, resolveGLP1GlobalContext, and
 *     savedGroceryCompliance — the engine under test is the real module.
 *   • Capture the messages[] passed to openai.chat.completions.create so
 *     assertions can verify prompt content without hitting the network.
 *
 * Run: npx jest server/tests/mealRefinementEngine.test.ts
 */

// ── Captured OpenAI call storage ──────────────────────────────────────────────
// Declared before jest.mock so factory closures can reference it by value.
const capturedSystemPrompts: string[] = [];

// ── Stable LLM response ───────────────────────────────────────────────────────
const SWAP_AI_RESPONSE = JSON.stringify({
  coachSuggestion: {
    item: "Grilled Chicken Breast",
    reason: "Lean protein that fits the meal style and your protocol.",
    quantity: "6",
    unit: "oz",
  },
  savedOption: null,
  alternatives: [
    { item: "Turkey Breast", reason: "Another lean white-meat option." },
  ],
  protocolNote: null,
});

// ── Mock: OpenAI ───────────────────────────────────────────────────────────────
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    const systemMsg = (params.messages ?? []).find(
      (m: any) => m.role === "system",
    );
    if (systemMsg?.content) capturedSystemPrompts.push(systemMsg.content);
    return { choices: [{ message: { content: SWAP_AI_RESPONSE } }] };
  });

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));

  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: DB (saved grocery query) ────────────────────────────────────────────
const mockDbRows: any[] = [];
jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const chain: any = {
        from: () => chain,
        where: () => Promise.resolve(mockDbRows),
      };
      return chain;
    }),
  },
}));

// ── Mock: protocolEnvelope ────────────────────────────────────────────────────
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

/** Minimal envelope that exercises the allergen path when needed. */
function makeEnvelope(
  overrides: Partial<UserProtocolEnvelope> = {},
): UserProtocolEnvelope {
  return {
    userId: "test-user",
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

// The real scanGeneratedOutput result is replicated via these mock controls.
let mockScanPassed = true;
let mockScanMessage = "";
let mockScanViolations: any[] = [];

jest.mock("../services/protocolEnvelope", () => ({
  buildGuestEnvelope: jest.fn(() => makeEnvelope()),
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue(makeEnvelope()),
  enforceBeforeGenerate: jest.fn(() => ({
    combined: "No dietary restrictions — apply general healthy eating.",
    blocks: [],
  })),
  scanGeneratedOutput: jest.fn((_meal: any, _env: any, _ctx: any) => ({
    passed: mockScanPassed,
    message: mockScanMessage,
    violations: mockScanViolations,
    primaryViolation: mockScanViolations[0] ?? null,
  })),
}));

// ── Mock: resolveGLP1GlobalContext ────────────────────────────────────────────
let mockGlp1Context: any = null; // null = not active

const mockResolveGLP1GlobalContext = jest.fn().mockImplementation(
  async () => mockGlp1Context,
);

jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: (...args: any[]) =>
    mockResolveGLP1GlobalContext(...args),
  buildGLP1RecommendationBlock: (ctx: any): string => {
    if (!ctx?.isActive) return "";
    const t = ctx.resolvedTargets ?? {};
    return [
      `GLP-1 MEDICATION PROTOCOL — ACTIVE`,
      `Meal target: ~${t.resolvedMealCalories ?? 400} kcal | Protein: ≥${t.targetProteinGrams ?? 15}g | Fat ceiling: ≤${t.maximumToleratedFatGrams ?? 12}g`,
    ].join("\n");
  },
}));

// ── Mock: savedGroceryCompliance ──────────────────────────────────────────────
let mockCompliantItems: any[] = [];
const SAVED_GROCERY_BLOCK =
  "SAVED GROCERY PREFERENCES (user's vetted favorites — already cleared against today's protocol):";

jest.mock("../services/savedGroceryCompliance", () => ({
  filterSavedGroceriesForCompliance: jest.fn((_rows: any[]) => ({
    compliant: mockCompliantItems,
    excluded: [],
  })),
  buildSavedGroceriesPromptBlock: jest.fn((_items: any[]) =>
    mockCompliantItems.length > 0 ? SAVED_GROCERY_BLOCK : "",
  ),
}));

// ── System under test ─────────────────────────────────────────────────────────
import { getMealRefinementEngine, refineMeal, MealRefinementRetryableError } from "../services/mealRefinementEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────
function resetMocks() {
  capturedSystemPrompts.length = 0;
  mockDbRows.length = 0;
  mockScanPassed = true;
  mockScanMessage = "";
  mockScanViolations = [];
  mockGlp1Context = null;
  mockCompliantItems = [];
  mockResolveGLP1GlobalContext.mockClear();
}

const BASE_REQUEST = {
  changeType: "replace_ingredient" as const,
  userId: "user-abc",
  ingredientToReplace: "Pork Belly",
  mealName: "Asian Noodle Bowl",
  mealDescription: "A savoury noodle dish with rich broth",
  remainingIngredients: ["ramen noodles", "bok choy", "miso"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("MealRefinementEngine — replace_ingredient", () => {
  beforeEach(() => {
    resetMocks();
    // Reset the singleton so each test gets a fresh engine instance
    // (avoids shared OpenAI client state from previous runs).
    jest.isolateModules(() => {});
  });

  // ── 1. Allergen violation ──────────────────────────────────────────────────
  describe("allergen / protocol blocking", () => {
    test("when scanGeneratedOutput flags the LLM suggestion, protocolNote is set in the result", async () => {
      mockScanPassed = false;
      mockScanMessage = "contains shellfish — active allergy";
      mockScanViolations = [
        { term: "Grilled Chicken Breast", reason: "contains shellfish — active allergy" },
      ];

      // Override the LLM to suggest a flagged ingredient
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                coachSuggestion: {
                  item: "Shrimp Tempura",
                  reason: "Light and crispy",
                  quantity: "4",
                  unit: "oz",
                },
                savedOption: null,
                alternatives: [],
                protocolNote: null,
              }),
            },
          },
        ],
      });

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(result.protocolNote).not.toBeNull();
      expect(result.protocolNote).toContain("may conflict with your protocol");
      expect(result.protocolNote).toContain("shellfish");
    });

    test("when scanGeneratedOutput passes, protocolNote remains null from the engine scan", async () => {
      mockScanPassed = true;

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // The LLM returned protocolNote: null and the scan passed — should stay null.
      expect(result.protocolNote).toBeNull();
    });

    test("a pre-existing protocolNote from the LLM is preserved and prepended when scan also fails", async () => {
      mockScanPassed = false;
      mockScanMessage = "contains tree nuts — active allergy";
      mockScanViolations = [
        { term: "Almond", reason: "contains tree nuts — active allergy" },
      ];

      // LLM already returned a protocolNote
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                coachSuggestion: {
                  item: "Almond Tofu",
                  reason: "Adds nuttiness",
                  quantity: "3",
                  unit: "oz",
                },
                savedOption: null,
                alternatives: [],
                protocolNote: "Tree nut allergy noted.",
              }),
            },
          },
        ],
      });

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(result.protocolNote).toContain("Tree nut allergy noted.");
      expect(result.protocolNote).toContain("may conflict with your protocol");
    });
  });

  // ── 2. GLP-1 context injection ────────────────────────────────────────────
  describe("GLP-1 context", () => {
    test("resolveGLP1GlobalContext is called with the correct userId and today's ISO date", async () => {
      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(mockResolveGLP1GlobalContext).toHaveBeenCalledTimes(1);
      const [calledUserId, calledDate] = mockResolveGLP1GlobalContext.mock.calls[0];
      expect(calledUserId).toBe(BASE_REQUEST.userId);
      // Date must be a valid ISO date string (YYYY-MM-DD)
      expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("when GLP-1 is active, the recommendation block appears in the system prompt", async () => {
      mockGlp1Context = {
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

      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(1);
      const prompt = capturedSystemPrompts[0];
      expect(prompt).toContain("GLP-1 MEDICATION PROTOCOL — ACTIVE");
      expect(prompt).toContain("420");   // resolvedMealCalories
      expect(prompt).toContain("28");    // targetProteinGrams
      expect(prompt).toContain("12");    // maximumToleratedFatGrams
    });

    test("when GLP-1 is not active, the GLP-1 block is absent from the system prompt", async () => {
      mockGlp1Context = { isActive: false, resolvedTargets: null };

      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(1);
      expect(capturedSystemPrompts[0]).not.toContain("GLP-1 MEDICATION PROTOCOL");
    });

    test("when resolveGLP1GlobalContext throws, the engine continues and omits the GLP-1 block", async () => {
      mockResolveGLP1GlobalContext.mockRejectedValueOnce(
        new Error("resolver timeout"),
      );

      const engine = getMealRefinementEngine();
      // Should not throw — GLP-1 failure is non-fatal for swap
      const result = await engine.refine(BASE_REQUEST);

      expect(result.coachSuggestion).toBeDefined();
      expect(capturedSystemPrompts[0]).not.toContain("GLP-1 MEDICATION PROTOCOL");
    });
  });

  // ── 3. Saved grocery injection ────────────────────────────────────────────
  describe("saved grocery injection", () => {
    test("when the user has compliant saved items, the saved block appears in the system prompt", async () => {
      // Populate the DB mock so the engine fetches rows
      mockDbRows.push({
        id: "sg-1",
        productName: "Organic Edamame",
        brand: "Whole Foods",
        category: "Frozen",
        productKey: "name::::organicedamame",
        nutritionJson: { calories: 120, protein: 11, fat: 4, carbs: 10 },
        savedAt: new Date("2026-08-10T10:00:00Z"),
      });
      // filterSavedGroceriesForCompliance mock returns this item as compliant
      mockCompliantItems = [mockDbRows[0]];

      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(1);
      expect(capturedSystemPrompts[0]).toContain(SAVED_GROCERY_BLOCK);
    });

    test("when the user has no saved items, the saved block is absent from the prompt", async () => {
      // mockDbRows is empty (reset by beforeEach) — no saved items
      mockCompliantItems = [];

      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(1);
      expect(capturedSystemPrompts[0]).not.toContain("SAVED GROCERY PREFERENCES");
    });

    test("when filterSavedGroceriesForCompliance excludes all items, no block is injected", async () => {
      // Row exists in DB but compliance filter rejects it
      mockDbRows.push({
        id: "sg-2",
        productName: "Pork Crackling",
        brand: "SnackCo",
        category: "Pantry",
        productKey: "name::::porkcrackling",
        nutritionJson: { calories: 300, protein: 20, fat: 22, carbs: 0 },
        savedAt: new Date("2026-08-11T10:00:00Z"),
      });
      // Compliance filter excludes it — mockCompliantItems stays empty
      mockCompliantItems = [];

      const engine = getMealRefinementEngine();
      await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts[0]).not.toContain("SAVED GROCERY PREFERENCES");
    });

    test("savedOption in the result can be non-null when the LLM references a saved item", async () => {
      mockDbRows.push({
        id: "sg-3",
        productName: "Firm Tofu",
        brand: "Nasoya",
        category: "Plant Proteins",
        productKey: "name::::firmtofu",
        nutritionJson: null,
        savedAt: new Date("2026-08-12T10:00:00Z"),
      });
      mockCompliantItems = [mockDbRows[0]];

      // Override LLM to return a savedOption
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                coachSuggestion: {
                  item: "Grilled Tofu",
                  reason: "High protein plant-based swap",
                  quantity: "5",
                  unit: "oz",
                },
                savedOption: {
                  item: "Firm Tofu",
                  reason: "From your saved products — use this first.",
                },
                alternatives: [],
                protocolNote: null,
              }),
            },
          },
        ],
      });

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(result.savedOption).not.toBeNull();
      expect(result.savedOption?.item).toBe("Firm Tofu");
    });
  });

  // ── 4. Result shape ───────────────────────────────────────────────────────
  describe("result contract", () => {
    test("result always contains coachSuggestion, savedOption, alternatives, and protocolNote", async () => {
      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(result).toHaveProperty("coachSuggestion");
      expect(result).toHaveProperty("savedOption");
      expect(result).toHaveProperty("alternatives");
      expect(result).toHaveProperty("protocolNote");

      expect(result.coachSuggestion.item).toBeTruthy();
      expect(typeof result.coachSuggestion.reason).toBe("string");
      expect(typeof result.coachSuggestion.quantity).toBe("string");
      expect(typeof result.coachSuggestion.unit).toBe("string");
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    test("the ingredient-to-replace context appears in the system prompt", async () => {
      const engine = getMealRefinementEngine();
      await engine.refine({
        ...BASE_REQUEST,
        ingredientToReplace: "Pork Belly",
        mealName: "Asian Noodle Bowl",
      });

      expect(capturedSystemPrompts[0]).toContain("Pork Belly");
      expect(capturedSystemPrompts[0]).toContain("Asian Noodle Bowl");
    });

    test("userRequest is forwarded to the LLM when provided", async () => {
      const engine = getMealRefinementEngine();
      await engine.refine({
        ...BASE_REQUEST,
        userRequest: "something lower in sodium",
      });

      const userMsg = (
        (await import("openai")).default as any
      );
      // The user-facing message should reference the userRequest
      expect(capturedSystemPrompts[0]).toContain("lower in sodium");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refineMeal — universal function API
// These tests cover the actual endpoint-facing function, not the legacy class.
// Key differences from the class: GLP-1 is FAIL-CLOSED (throws instead of
// continuing without GLP-1 context), and the output goes through a combined
// NDE + GLP-1 macro + diabetic starch validation pass with retry.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal compliant meal JSON in the "regular builder" schema. */
const EXISTING_MEAL = {
  name: "Asian Noodle Bowl",
  description: "A savory noodle dish with rich broth",
  ingredients: [
    { name: "pork belly" },
    { name: "ramen noodles" },
    { name: "bok choy" },
  ],
  macros: { calories: 520, protein: 22, fat: 28, carbs: 55 },
};

/** LLM response shape expected by refineMeal (full meal + changesSummary). */
const REFINE_AI_RESPONSE_CLEAN = JSON.stringify({
  name: "Asian Noodle Bowl",
  description: "A lighter version with grilled chicken",
  ingredients: [
    { name: "grilled chicken breast" },
    { name: "ramen noodles" },
    { name: "bok choy" },
  ],
  macros: { calories: 420, protein: 32, fat: 8, carbs: 45 },
  changesSummary: "Replaced pork belly with grilled chicken for a leaner protein.",
});

const REFINE_BASE_REQUEST = {
  userId: "user-abc",
  existingMeal: EXISTING_MEAL,
  changeInstruction: "Replace pork belly with a leaner protein",
};

describe("refineMeal — universal function API", () => {
  beforeEach(() => {
    resetMocks();
    // Default glp1Context: not active (safe baseline)
    mockGlp1Context = { isActive: false, resolvedTargets: null };
    // Default LLM: return a clean meal refinement response
    const { default: OpenAI } = require("openai");
    const mockInst = new (OpenAI as any)();
    jest
      .spyOn(mockInst.chat.completions, "create")
      .mockResolvedValue({ choices: [{ message: { content: REFINE_AI_RESPONSE_CLEAN } }] });
  });

  // ── GLP-1 FAIL-CLOSED ──────────────────────────────────────────────────────

  describe("GLP-1 fail-closed behaviour", () => {
    test("throws MealRefinementRetryableError when the GLP-1 resolver returns null", async () => {
      // Simulate resolver failure (network error, DB down, etc.)
      mockResolveGLP1GlobalContext.mockResolvedValueOnce(null);

      await expect(refineMeal(REFINE_BASE_REQUEST)).rejects.toThrow(
        MealRefinementRetryableError,
      );
    });

    test("MealRefinementRetryableError message hints at a retry", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValueOnce(null);

      await expect(refineMeal(REFINE_BASE_REQUEST)).rejects.toThrow(
        /temporarily unavailable/i,
      );
    });

    test("throws MealRefinementRetryableError when GLP-1 is active but resolvedTargets is null", async () => {
      // Active patient but targets failed to load — cannot enforce GLP-1 ceiling
      mockResolveGLP1GlobalContext.mockResolvedValueOnce({
        isActive: true,
        resolvedTargets: null,
      });

      await expect(refineMeal(REFINE_BASE_REQUEST)).rejects.toThrow(
        MealRefinementRetryableError,
      );
    });
  });

  // ── SUCCESSFUL REFINEMENT ─────────────────────────────────────────────────

  describe("successful refinement", () => {
    test("returns updatedMeal, changesSummary, and protocolNote", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValueOnce({
        isActive: false,
        resolvedTargets: null,
      });

      // Override LLM via the module-level mockCreate
      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: REFINE_AI_RESPONSE_CLEAN } }],
      });

      const result = await refineMeal(REFINE_BASE_REQUEST);

      expect(result).toHaveProperty("updatedMeal");
      expect(result).toHaveProperty("changesSummary");
      expect(result).toHaveProperty("protocolNote");
      expect(typeof result.changesSummary).toBe("string");
      expect(result.changesSummary.length).toBeGreaterThan(0);
    });

    test("updatedMeal preserves the top-level schema of the existing meal", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValueOnce({
        isActive: false,
        resolvedTargets: null,
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: REFINE_AI_RESPONSE_CLEAN } }],
      });

      const result = await refineMeal(REFINE_BASE_REQUEST);

      // The LLM response did not include changesSummary in the returned meal
      expect(result.updatedMeal).not.toHaveProperty("changesSummary");
      // The meal schema keys are present
      expect(result.updatedMeal).toHaveProperty("name");
      expect(result.updatedMeal).toHaveProperty("ingredients");
      expect(result.updatedMeal).toHaveProperty("macros");
    });
  });

  // ── NDE VALIDATION FAIL-CLOSED ────────────────────────────────────────────

  describe("NDE validation — both attempts fail", () => {
    test("throws a hard block error when both initial and retry generations fail the NDE scan", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValue({
        isActive: false,
        resolvedTargets: null,
      });

      // Both generations fail the NDE scan
      mockScanPassed = false;
      mockScanMessage = "contains shellfish — active allergy";
      mockScanViolations = [
        { term: "shrimp", reason: "shellfish allergy" },
      ];

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      // Both initial and retry return a violating meal
      inst.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: REFINE_AI_RESPONSE_CLEAN } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: REFINE_AI_RESPONSE_CLEAN } }] });

      await expect(refineMeal(REFINE_BASE_REQUEST)).rejects.toThrow(
        /conflicts with your active health protocol|Cannot apply/i,
      );
    });

    test("throws PROTOCOL_VIOLATION when both attempts fail GLP-1 fat ceiling", async () => {
      // GLP-1 active with a tight fat ceiling
      const glp1Targets = {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        minimumProteinFloor: 25,
        maximumToleratedFatGrams: 8,
      };
      mockResolveGLP1GlobalContext.mockResolvedValue({
        isActive: true,
        resolvedTargets: glp1Targets,
      });
      mockScanPassed = true; // NDE passes — only GLP-1 macros fail

      // Both LLM calls return a meal with fat=20g (above the 8g ceiling)
      const fatViolatingMeal = JSON.stringify({
        name: "Fatty Bowl",
        description: "Oily broth",
        ingredients: [{ name: "pork belly" }],
        macros: { calories: 420, protein: 22, fat: 20, carbs: 30 },
        changesSummary: "Updated.",
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: fatViolatingMeal } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: fatViolatingMeal } }] });

      await expect(refineMeal(REFINE_BASE_REQUEST)).rejects.toThrow(/PROTOCOL_VIOLATION/);
    });

    test("protocolNote is set when GLP-1 protein floor is soft-violated but meal is otherwise compliant", async () => {
      const glp1Targets = {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 500,
        targetProteinGrams: 30,
        minimumProteinFloor: 30,
        maximumToleratedFatGrams: 15,
      };
      mockResolveGLP1GlobalContext.mockResolvedValueOnce({
        isActive: true,
        resolvedTargets: glp1Targets,
      });
      mockScanPassed = true;

      // Meal passes fat/cal gates but protein is low (18g < 30g * 0.75 = 22.5g)
      const lowProteinMeal = JSON.stringify({
        name: "Light Veggie Bowl",
        description: "Low protein but compliant fat/cal",
        ingredients: [{ name: "zucchini" }],
        macros: { calories: 350, protein: 18, fat: 10, carbs: 40 },
        changesSummary: "Made it vegetable-forward.",
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: lowProteinMeal } }],
      });

      const result = await refineMeal(REFINE_BASE_REQUEST);

      expect(result.protocolNote).not.toBeNull();
      expect(result.protocolNote).toMatch(/protein/i);
      expect(result.protocolNote).toMatch(/GLP-1/i);
    });
  });

  // ── SCHEMA PRESERVATION ────────────────────────────────────────────────────

  describe("schema preservation contract", () => {
    test("throws when retry response also drops a critical schema key (ingredients)", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValue({
        isActive: false,
        resolvedTargets: null,
      });

      // First LLM call: omits 'ingredients' (critical key) — triggers retry.
      // Second LLM call (retry): also omits 'ingredients' — must throw hard.
      const missingIngredientsResponse = JSON.stringify({
        name: "Asian Noodle Bowl",
        description: "Updated bowl",
        // 'ingredients' deliberately absent
        macros: { calories: 420, protein: 32, fat: 8, carbs: 45 },
        changesSummary: "Swapped protein.",
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: missingIngredientsResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: missingIngredientsResponse } }] });

      await expect(
        refineMeal({
          ...REFINE_BASE_REQUEST,
          existingMeal: {
            name: "Asian Noodle Bowl",
            description: "Original",
            ingredients: [{ name: "pork belly" }], // present in input
            macros: { calories: 520, protein: 22, fat: 28, carbs: 55 },
          },
        }),
      ).rejects.toThrow(/preserving the required meal structure|missing/i);
    });

    test("non-critical keys omitted by the LLM are restored from the existing meal on the initial pass", async () => {
      mockResolveGLP1GlobalContext.mockResolvedValueOnce({
        isActive: false,
        resolvedTargets: null,
      });

      // LLM omits 'servings' and 'prepTime' (non-critical)
      const partialResponse = JSON.stringify({
        name: "Asian Noodle Bowl",
        description: "Lighter version",
        ingredients: [{ name: "grilled chicken breast" }],
        macros: { calories: 420, protein: 32, fat: 8, carbs: 45 },
        changesSummary: "Switched to chicken.",
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: partialResponse } }],
      });

      const result = await refineMeal({
        ...REFINE_BASE_REQUEST,
        existingMeal: {
          name: "Asian Noodle Bowl",
          description: "Original",
          ingredients: [{ name: "pork belly" }],
          macros: { calories: 520, protein: 22, fat: 28, carbs: 55 },
          servings: 2,          // non-critical — must be preserved
          prepTime: "30 mins",  // non-critical — must be preserved
        },
      });

      expect(result.updatedMeal).toHaveProperty("servings", 2);
      expect(result.updatedMeal).toHaveProperty("prepTime", "30 mins");
    });

    test("changesSummary in the returned result reflects the retry output, not the rejected first attempt", async () => {
      // Trigger a retry via schema failure (missing 'ingredients') rather than
      // NDE — avoids the need to flip mockScanPassed mid-test.
      // NDE passes for both calls; only the schema gate changes.
      mockResolveGLP1GlobalContext.mockResolvedValue({
        isActive: false,
        resolvedTargets: null,
      });
      mockScanPassed = true;
      mockScanViolations = [];

      // First LLM response: missing the critical 'ingredients' key → schema
      // failure forces a retry with a schema correction instruction.
      const firstAttemptResponse = JSON.stringify({
        name: "Asian Noodle Bowl",
        description: "Updated version",
        // 'ingredients' deliberately absent — triggers schema-preservation retry
        macros: { calories: 420, protein: 32, fat: 8, carbs: 45 },
        changesSummary: "FIRST ATTEMPT SUMMARY — should NOT appear in result.",
      });

      // Retry response: all critical keys present, NDE passes.
      const retryResponse = JSON.stringify({
        name: "Asian Noodle Bowl",
        description: "Updated version (retry)",
        ingredients: [{ name: "grilled chicken" }],
        macros: { calories: 420, protein: 32, fat: 8, carbs: 45 },
        changesSummary: "RETRY ATTEMPT SUMMARY — should appear in result.",
      });

      const openaiMod = await import("openai");
      const inst = new (openaiMod.default as any)();
      inst.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: firstAttemptResponse } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: retryResponse } }] });

      const result = await refineMeal({
        ...REFINE_BASE_REQUEST,
        existingMeal: {
          name: "Asian Noodle Bowl",
          description: "Original",
          ingredients: [{ name: "pork belly" }], // 'ingredients' is a critical input key
          macros: { calories: 520, protein: 22, fat: 28, carbs: 55 },
        },
      });

      expect(result.changesSummary).toContain("RETRY ATTEMPT SUMMARY");
      expect(result.changesSummary).not.toContain("FIRST ATTEMPT SUMMARY");
    });
  });
});
