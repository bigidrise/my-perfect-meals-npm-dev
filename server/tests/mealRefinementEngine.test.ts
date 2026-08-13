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
import { getMealRefinementEngine } from "../services/mealRefinementEngine";

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
