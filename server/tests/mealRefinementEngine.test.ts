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

// ── Stable LLM responses for new types ───────────────────────────────────────
const ADJUST_MACROS_AI_RESPONSE = JSON.stringify({
  adjustedIngredients: [
    { item: "Greek Yogurt", change: "swapped from sour cream", reason: "Higher protein, lower fat" },
  ],
  macroImpact: { calories: 350, protein: 30, carbs: 40, fat: 8, summary: "+18g protein, -5g fat" },
  coachNote: "Swapping to Greek yogurt boosts your protein significantly.",
  protocolNote: null,
});

const CHANGE_METHOD_AI_RESPONSE = JSON.stringify({
  newMethod: "Air Fryer",
  cookingNotes: "Cook at 400°F for 15 minutes, flipping halfway through.",
  cookingTips: [
    { tip: "Pat dry before cooking", reason: "Removes excess moisture for better crispiness." },
  ],
  ingredientChanges: [
    { item: "Cooking Spray", change: "Add 1 spray to prevent sticking" },
  ],
  estimatedMealFatGrams: 10,
  protocolNote: null,
});

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

  // Restore scanGeneratedOutput and loadUserProtocolEnvelope implementations
  // so that mockReturnValue() calls from previous tests don't leak.
  const envMock = jest.requireMock("../services/protocolEnvelope");
  envMock.scanGeneratedOutput.mockReset();
  envMock.scanGeneratedOutput.mockImplementation((_meal: any, _env: any, _ctx: any) => ({
    passed: mockScanPassed,
    message: mockScanMessage,
    violations: mockScanViolations,
    primaryViolation: mockScanViolations[0] ?? null,
  }));
  envMock.loadUserProtocolEnvelope.mockReset();
  envMock.loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope());
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

// ── Shared helpers for strict-loader tests ────────────────────────────────────

/**
 * Set mockGlp1Context to a non-null inactive context so strict-loader tests
 * don't fail at the GLP-1 null-check (null = resolver failure in strict mode).
 * Call this in beforeEach for test suites that exercise adjust_macros /
 * change_cooking_method.
 */
function useDefaultStrictContext() {
  mockGlp1Context = { isActive: false, resolvedTargets: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// adjust_macros tests
// ─────────────────────────────────────────────────────────────────────────────

const BASE_MACRO_REQUEST = {
  changeType: "adjust_macros" as const,
  userId: "user-abc",
  macroGoal: "more protein",
  mealName: "Chicken Bowl",
  mealDescription: "A balanced grain bowl with vegetables",
  currentIngredients: ["chicken breast", "brown rice", "spinach"],
  currentMacros: { calories: 450, protein: 25, carbs: 55, fat: 12 },
};

describe("MealRefinementEngine — adjust_macros", () => {
  beforeEach(() => {
    resetMocks();
    useDefaultStrictContext();
  });

  // Helper: configure the LLM mock to return a given JSON string for its next call(s).
  function mockLLM(response: string) {
    const openai = jest.requireMock("openai");
    const instance = new openai.default();
    instance.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: response } }],
    });
    return instance.chat.completions.create;
  }

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  test("returns MacroAdjustmentResult with correct shape on happy path", async () => {
    mockLLM(ADJUST_MACROS_AI_RESPONSE);

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_MACRO_REQUEST) as any;

    expect(Array.isArray(result.adjustedIngredients)).toBe(true);
    expect(result.adjustedIngredients.length).toBeGreaterThan(0);
    expect(typeof result.adjustedIngredients[0].item).toBe("string");
    expect(typeof result.adjustedIngredients[0].change).toBe("string");
    expect(result.macroImpact).toBeDefined();
    expect(typeof result.macroImpact.summary).toBe("string");
    expect(typeof result.coachNote).toBe("string");
    expect(result).toHaveProperty("protocolNote");
  });

  // ── 2. Strict fail-closed: GLP-1 resolver returns null ───────────────────
  test("throws when GLP-1 resolver returns null (strict fail-closed)", async () => {
    // null = resolver failure in strict mode
    mockGlp1Context = null;

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /clinical guidance temporarily unavailable/i,
    );
  });

  // ── 3. Strict fail-closed: protocol envelope load fails ──────────────────
  test("throws when protocol envelope fails to load (strict fail-closed)", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockRejectedValueOnce(new Error("DB connection error"));

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /could not load dietary protocol/i,
    );
  });

  // ── 4. Allergen in adjustedIngredients item — blocked by allergen guard ───
  test("blocks when allergen appears in adjustedIngredients item and scan passes", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["peanut"] }));
    mockScanPassed = true; // avoidances scan passes — allergen guard must catch it

    // First attempt: allergen in item name
    const allergenResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Peanut Butter", change: "added for protein", reason: "High protein" }],
      macroImpact: { calories: 400, protein: 32, carbs: 38, fat: 16, summary: "+7g protein, +4g fat" },
      coachNote: "Added peanut butter for a protein boost.",
      protocolNote: null,
    });
    // Second attempt (retry) also contains the allergen → both fail → throws
    mockLLM(allergenResponse);
    mockLLM(allergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 5. Allergen hidden only in macroImpact.summary — caught by extractAllStrings
  test("blocks when allergen is hidden only in macroImpact.summary", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["walnut"] }));
    mockScanPassed = true;

    // allergen is ONLY in the summary string — not in item names
    const hiddenAllergenResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Greek Yogurt", change: "added for protein", reason: "Good protein source" }],
      macroImpact: {
        calories: 360, protein: 32, carbs: 38, fat: 9,
        summary: "+7g protein (consider walnut topping for extra calories)",
      },
      coachNote: "Greek yogurt is an excellent swap.",
      protocolNote: null,
    });
    mockLLM(hiddenAllergenResponse);
    mockLLM(hiddenAllergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 6. Allergen hidden in protocolNote — caught by extractAllStrings ──────
  test("blocks when allergen is hidden only in protocolNote", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["sesame"] }));
    mockScanPassed = true;

    const hiddenAllergenResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Chickpea Flour", change: "swapped from white flour", reason: "More protein" }],
      macroImpact: { calories: 370, protein: 28, carbs: 42, fat: 10, summary: "+3g protein" },
      coachNote: "Chickpea flour is a great swap for protein.",
      protocolNote: "Note: sesame-based tahini is a common complement but avoided here.",
    });
    mockLLM(hiddenAllergenResponse);
    mockLLM(hiddenAllergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 7. Violation on first pass → retry succeeds → result returned ─────────
  test("retry succeeds when first LLM attempt has a violation", async () => {
    const shellfisnResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Shrimp", change: "added for lean protein", reason: "Very lean" }],
      macroImpact: { calories: 340, protein: 34, carbs: 35, fat: 6, summary: "+9g protein" },
      coachNote: "Shrimp is an excellent lean protein.",
      protocolNote: null,
    });
    mockLLM(shellfisnResponse);   // first LLM call: scan will flag it
    mockLLM(ADJUST_MACROS_AI_RESPONSE); // second LLM call (retry): clean

    // Scan fails on first call only, passes on retry
    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    (scanGeneratedOutput as jest.Mock)
      .mockReturnValueOnce({ passed: false, message: "contains shellfish", violations: [{ term: "Shrimp" }] })
      .mockReturnValueOnce({ passed: true, violations: [], message: "" });

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_MACRO_REQUEST) as any;

    expect(result.adjustedIngredients).toBeDefined();
    expect(result.macroImpact).toBeDefined();
  });

  // ── 8. Violation on both attempts → throws ────────────────────────────────
  test("throws when both LLM attempts produce a protocol violation", async () => {
    const violatingResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Almond Butter", change: "added", reason: "Rich in protein" }],
      macroImpact: { calories: 410, protein: 29, carbs: 35, fat: 18, summary: "+4g protein" },
      coachNote: "Almond butter adds healthy fats and protein.",
      protocolNote: null,
    });
    mockLLM(violatingResponse);
    mockLLM(violatingResponse);

    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    (scanGeneratedOutput as jest.Mock)
      .mockReturnValueOnce({ passed: false, message: "contains tree nuts — hard stop", violations: [{ term: "Almond" }] })
      .mockReturnValueOnce({ passed: false, message: "contains tree nuts — hard stop", violations: [{ term: "Almond" }] });

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 9. Allergen in currentIngredients baseline → blocked before LLM call ──
  test("throws before calling the LLM when currentIngredients contains a confirmed allergen", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    // "Peanuts" category expands to include "peanut" via taxonomy
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Peanuts"] }));

    const engine = getMealRefinementEngine();
    // peanut is in the baseline currentIngredients → must throw before any LLM call
    await expect(
      engine.refine({
        ...BASE_MACRO_REQUEST,
        currentIngredients: ["chicken breast", "peanut sauce", "rice"],
      }),
    ).rejects.toThrow(/confirmed allergen/i);

    // Verify the LLM was never called (no system prompt captured)
    expect(capturedSystemPrompts).toHaveLength(0);
  });

  // ── 10. GLP-1 fat ceiling violated in macroImpact.fat → blocked ──────────
  test("blocks when macroImpact.fat exceeds the GLP-1 fat ceiling on both attempts", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    // fat = 25g — exceeds ceiling of 12g
    const highFatResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Full-fat Cheese", change: "added", reason: "Boosts protein" }],
      macroImpact: { calories: 380, protein: 31, carbs: 35, fat: 25, summary: "+6g protein, +13g fat" },
      coachNote: "Full-fat cheese boosts protein nicely.",
      protocolNote: null,
    });
    mockLLM(highFatResponse);
    mockLLM(highFatResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 11. coachNote is forwarded as instructions to scanGeneratedOutput ─────
  test("passes coachNote as the instructions field to scanGeneratedOutput", async () => {
    mockLLM(ADJUST_MACROS_AI_RESPONSE);

    const engine = getMealRefinementEngine();
    await engine.refine(BASE_MACRO_REQUEST);

    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    const calls = (scanGeneratedOutput as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0];
    // coachNote from ADJUST_MACROS_AI_RESPONSE should appear in payload.instructions
    expect(typeof payload.instructions).toBe("string");
    expect(payload.instructions).toMatch(/greek yogurt/i);
  });

  // ── 9b. Category-label allergen expansion — Tree Nuts catches "cashew" ───
  test("blocks when allergen is 'Tree Nuts' and response contains 'cashew cream'", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Tree Nuts"] }));

    // macroImpact.summary contains "cashew cream" — caught via taxonomy expansion
    const cashewResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Cashew Cream", change: "added for creaminess", reason: "Lower dairy" }],
      macroImpact: { calories: 370, protein: 28, carbs: 40, fat: 12, summary: "Replaced sour cream with cashew cream (+3g fat)" },
      coachNote: "Cashew cream adds a rich texture.",
      protocolNote: null,
    });
    mockLLM(cashewResponse);
    mockLLM(cashewResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 9c. Compound label "Wheat/Gluten" catches "pasta" ─────────────────────
  test("blocks when allergen is 'Wheat/Gluten' and response contains 'pasta'", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Wheat/Gluten"] }));

    const pastaResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Whole Wheat Pasta", change: "added for carbs", reason: "Complex carbs" }],
      macroImpact: { calories: 420, protein: 28, carbs: 55, fat: 9, summary: "+15g carbs from pasta" },
      coachNote: "Pasta is a great carb source for sustained energy.",
      protocolNote: null,
    });
    mockLLM(pastaResponse);
    mockLLM(pastaResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 9d. Qualified label "Lactose Intolerance" catches "cheese" ────────────
  test("blocks when allergen is 'Lactose Intolerance' and response contains 'cheese'", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Lactose Intolerance"] }));

    const cheeseResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Cheddar Cheese", change: "added for protein", reason: "High protein dairy" }],
      macroImpact: { calories: 380, protein: 33, carbs: 38, fat: 11, summary: "+8g protein from cheese" },
      coachNote: "Cheddar cheese is high in protein and calcium.",
      protocolNote: null,
    });
    mockLLM(cheeseResponse);
    mockLLM(cheeseResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 12. GLP-1 active + null macroImpact.fat → blocked ────────────────────
  test("blocks when GLP-1 is active and macroImpact.fat is null on both attempts", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    // fat is null — GLP-1 must treat this as a violation
    const nullFatResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Greek Yogurt", change: "swapped", reason: "Higher protein" }],
      macroImpact: { calories: 350, protein: 30, carbs: 40, fat: null, summary: "+5g protein" },
      coachNote: "Greek yogurt is a great swap.",
      protocolNote: null,
    });
    mockLLM(nullFatResponse);
    mockLLM(nullFatResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 12b. Non-numeric macroImpact values are rejected (GLP-1 active) ───────
  test.each([
    ["empty string", ""],
    ["whitespace", "   "],
    ["boolean true", true],
    ["boolean false", false],
    ["numeric string", "9"],
  ])(
    "blocks when GLP-1 is active and macroImpact.fat is a non-numeric value: %s",
    async (_label, badFat) => {
      mockGlp1Context = {
        isActive: true,
        activationSources: ["medicalConditions"],
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 28,
          maximumToleratedFatGrams: 12,
          minimumProteinFloor: 20,
        },
      };

      const badResponse = JSON.stringify({
        adjustedIngredients: [{ item: "Greek Yogurt", change: "swapped", reason: "Higher protein" }],
        macroImpact: { calories: 350, protein: 30, carbs: 40, fat: badFat, summary: "+5g protein" },
        coachNote: "Greek yogurt is a great swap.",
        protocolNote: null,
      });
      mockLLM(badResponse);
      mockLLM(badResponse);

      const engine = getMealRefinementEngine();
      await expect(engine.refine(BASE_MACRO_REQUEST)).rejects.toThrow(
        /conflicts with your active health protocol/i,
      );
    },
  );

  // ── 13. GLP-1 fat retry succeeds when retry is within ceiling ────────────
  test("returns result when retry macroImpact.fat is within the GLP-1 ceiling", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    // First attempt: fat = 18g (over ceiling)
    const highFatResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Whole Milk", change: "added", reason: "Boosts protein" }],
      macroImpact: { calories: 380, protein: 29, carbs: 35, fat: 18, summary: "+4g protein, +6g fat" },
      coachNote: "Whole milk adds creaminess and protein.",
      protocolNote: null,
    });
    // Retry: fat = 8g (within ceiling)
    const compliantResponse = JSON.stringify({
      adjustedIngredients: [{ item: "Greek Yogurt", change: "swapped from sour cream", reason: "Higher protein, lower fat" }],
      macroImpact: { calories: 350, protein: 30, carbs: 40, fat: 8, summary: "+5g protein, -4g fat" },
      coachNote: "Greek yogurt is the perfect lower-fat swap.",
      protocolNote: null,
    });
    mockLLM(highFatResponse);
    mockLLM(compliantResponse);

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_MACRO_REQUEST) as any;

    expect(result.macroImpact.fat).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// change_cooking_method tests
// ─────────────────────────────────────────────────────────────────────────────

const BASE_COOKING_METHOD_REQUEST = {
  changeType: "change_cooking_method" as const,
  userId: "user-abc",
  targetMethod: "air fryer",
  mealName: "Herb Chicken",
  mealDescription: "Seasoned chicken thighs with rosemary and lemon",
  currentIngredients: ["chicken thighs", "rosemary", "lemon", "olive oil"],
  currentMethod: "oven-baked",
};

describe("MealRefinementEngine — change_cooking_method", () => {
  beforeEach(() => {
    resetMocks();
    useDefaultStrictContext();
  });

  function mockLLM(response: string) {
    const openai = jest.requireMock("openai");
    const instance = new openai.default();
    instance.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: response } }],
    });
    return instance.chat.completions.create;
  }

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  test("returns CookingMethodResult with correct shape on happy path", async () => {
    mockLLM(CHANGE_METHOD_AI_RESPONSE);

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_COOKING_METHOD_REQUEST) as any;

    expect(typeof result.newMethod).toBe("string");
    expect(result.newMethod).toBeTruthy();
    expect(typeof result.cookingNotes).toBe("string");
    expect(result.cookingNotes).toBeTruthy();
    expect(Array.isArray(result.cookingTips)).toBe(true);
    expect(Array.isArray(result.ingredientChanges)).toBe(true);
    expect(result).toHaveProperty("protocolNote");
  });

  // ── 2. Strict fail-closed: GLP-1 resolver returns null ───────────────────
  test("throws when GLP-1 resolver returns null (strict fail-closed)", async () => {
    mockGlp1Context = null;

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /clinical guidance temporarily unavailable/i,
    );
  });

  // ── 3. Allergen hidden in cookingTips[].reason — caught by extractAllStrings
  test("blocks when allergen is hidden only in cookingTips[].reason", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["peanut"] }));
    mockScanPassed = true;

    // allergen ONLY in tip reason — not in item names or cookingNotes
    const tipAllergenResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Cook at 400°F for 15 minutes, flipping halfway.",
      cookingTips: [
        {
          tip: "Pat the chicken dry before cooking",
          reason: "A peanut oil spray can help crispiness but avoid if allergic.",
        },
      ],
      ingredientChanges: [{ item: "Cooking Spray", change: "Use 1 spray" }],
      protocolNote: null,
    });
    mockLLM(tipAllergenResponse);
    mockLLM(tipAllergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 4. Allergen hidden in cookingNotes — caught by extractAllStrings ──────
  test("blocks when allergen is hidden only in cookingNotes", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["shellfish"] }));
    mockScanPassed = true;

    const notesAllergenResponse = JSON.stringify({
      newMethod: "Slow Cooker",
      cookingNotes: "Cook on low for 6 hours. A shellfish stock can enhance depth — skip if allergic.",
      cookingTips: [{ tip: "Add vegetables in the last 30 minutes", reason: "Keeps them firm." }],
      ingredientChanges: [],
      protocolNote: null,
    });
    mockLLM(notesAllergenResponse);
    mockLLM(notesAllergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 5. Allergen hidden in protocolNote — caught by extractAllStrings ──────
  test("blocks when allergen is hidden only in protocolNote", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValue(makeEnvelope({ allergies: ["soy"] }));
    mockScanPassed = true;

    const noteAllergenResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Cook at 400°F for 15 minutes.",
      cookingTips: [{ tip: "Pat dry first", reason: "Better crispiness." }],
      ingredientChanges: [{ item: "Cooking Spray", change: "Use 1 spray" }],
      protocolNote: "Note: soy-based marinades pair well but are excluded for this user.",
    });
    mockLLM(noteAllergenResponse);
    mockLLM(noteAllergenResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 6. Violation on first pass → retry succeeds → result returned ─────────
  test("retry succeeds when first LLM attempt has a scan violation", async () => {
    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    (scanGeneratedOutput as jest.Mock)
      .mockReturnValueOnce({
        passed: false,
        message: "contains pork — active avoidance",
        violations: [{ term: "lard", reason: "active avoidance" }],
      })
      .mockReturnValueOnce({ passed: true, violations: [], message: "" });

    const violatingResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Coat with lard for extra crispiness. Cook at 400°F for 15 minutes.",
      cookingTips: [{ tip: "Use lard sparingly", reason: "Enhances flavour." }],
      ingredientChanges: [{ item: "Lard", change: "Add 1 tbsp coating" }],
      protocolNote: null,
    });
    mockLLM(violatingResponse);
    mockLLM(CHANGE_METHOD_AI_RESPONSE);

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_COOKING_METHOD_REQUEST) as any;

    expect(typeof result.newMethod).toBe("string");
    expect(typeof result.cookingNotes).toBe("string");
  });

  // ── 7. Violation on both attempts → throws ────────────────────────────────
  test("throws when both LLM attempts produce a protocol violation", async () => {
    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    (scanGeneratedOutput as jest.Mock)
      .mockReturnValueOnce({ passed: false, message: "contains dairy — hard stop", violations: [{ term: "butter" }] })
      .mockReturnValueOnce({ passed: false, message: "contains dairy — hard stop", violations: [{ term: "butter" }] });

    const violatingResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Brush with melted butter before cooking at 400°F.",
      cookingTips: [{ tip: "Use butter generously", reason: "Better browning." }],
      ingredientChanges: [{ item: "Butter", change: "Add 2 tbsp" }],
      estimatedMealFatGrams: 20,
      protocolNote: null,
    });
    mockLLM(violatingResponse);
    mockLLM(violatingResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 8. Allergen in currentIngredients baseline → blocked before LLM call ──
  test("throws before calling the LLM when currentIngredients contains a confirmed allergen", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    // "Shellfish" expands via taxonomy to include "shrimp", so "shrimp paste" is caught
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Shellfish"] }));

    const engine = getMealRefinementEngine();
    await expect(
      engine.refine({
        ...BASE_COOKING_METHOD_REQUEST,
        currentIngredients: ["chicken thighs", "shrimp paste", "lemon"],
      }),
    ).rejects.toThrow(/confirmed allergen/i);

    expect(capturedSystemPrompts).toHaveLength(0);
  });

  // ── 9b. Category-label allergen expansion — Tree Nuts catches "almond" ──
  test("blocks when allergen is 'Tree Nuts' and response contains 'almond butter'", async () => {
    const { loadUserProtocolEnvelope } = jest.requireMock("../services/protocolEnvelope");
    loadUserProtocolEnvelope.mockResolvedValueOnce(makeEnvelope({ allergies: ["Tree Nuts"] }));

    // LLM response contains "almond butter" — caught via taxonomy expansion
    const almondResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Toss in almond butter sauce and cook at 400°F for 15 minutes.",
      cookingTips: [{ tip: "Pat dry first", reason: "Better crispiness." }],
      ingredientChanges: [{ item: "Almond Butter", change: "Add 1 tbsp glaze" }],
      estimatedMealFatGrams: 11,
      protocolNote: null,
    });
    mockLLM(almondResponse);
    mockLLM(almondResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 9. GLP-1 fat ceiling violated via estimatedMealFatGrams → blocked ─────
  test("blocks when estimatedMealFatGrams exceeds the GLP-1 fat ceiling on both attempts", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    // estimatedMealFatGrams = 30 — exceeds ceiling of 12g
    const highFatMethodResponse = JSON.stringify({
      newMethod: "Deep Fryer",
      cookingNotes: "Heat oil to 375°F and fry for 8 minutes until golden.",
      cookingTips: [{ tip: "Use plenty of oil", reason: "Ensures even cooking." }],
      ingredientChanges: [{ item: "Frying Oil", change: "Add 2 cups vegetable oil" }],
      estimatedMealFatGrams: 30,
      protocolNote: "High fat content due to deep frying.",
    });
    mockLLM(highFatMethodResponse);
    mockLLM(highFatMethodResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 10. cookingNotes + tips are forwarded as instructions to scanner ──────
  test("passes cookingNotes and tip text as the instructions field to scanGeneratedOutput", async () => {
    mockLLM(CHANGE_METHOD_AI_RESPONSE);

    const engine = getMealRefinementEngine();
    await engine.refine(BASE_COOKING_METHOD_REQUEST);

    const { scanGeneratedOutput } = jest.requireMock("../services/protocolEnvelope");
    const calls = (scanGeneratedOutput as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0];
    // cookingNotes from CHANGE_METHOD_AI_RESPONSE should appear in payload.instructions
    expect(typeof payload.instructions).toBe("string");
    expect(payload.instructions).toMatch(/400.*f|flipping/i);  // from "Cook at 400°F for 15 minutes, flipping halfway through."
  });

  // ── 11. GLP-1 active + null estimatedMealFatGrams → blocked ──────────────
  test("blocks when GLP-1 is active and estimatedMealFatGrams is null on both attempts", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    const nullFatResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Cook at 400°F for 15 minutes.",
      cookingTips: [{ tip: "Pat dry", reason: "Better crispiness." }],
      ingredientChanges: [],
      estimatedMealFatGrams: null,   // GLP-1 must treat null as a violation
      protocolNote: null,
    });
    mockLLM(nullFatResponse);
    mockLLM(nullFatResponse);

    const engine = getMealRefinementEngine();
    await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
      /conflicts with your active health protocol/i,
    );
  });

  // ── 11b. Non-numeric estimatedMealFatGrams rejected (GLP-1 active) ────────
  test.each([
    ["empty string", ""],
    ["whitespace", "   "],
    ["boolean true", true],
    ["boolean false", false],
    ["numeric string", "9"],
  ])(
    "blocks when GLP-1 is active and estimatedMealFatGrams is a non-numeric value: %s",
    async (_label, badFat) => {
      mockGlp1Context = {
        isActive: true,
        activationSources: ["medicalConditions"],
        resolvedTargets: {
          treatmentPhase: "maintenance",
          resolvedMealCalories: 400,
          targetProteinGrams: 28,
          maximumToleratedFatGrams: 12,
          minimumProteinFloor: 20,
        },
      };

      const badResponse = JSON.stringify({
        newMethod: "Air Fryer",
        cookingNotes: "Cook at 400°F for 15 minutes.",
        cookingTips: [{ tip: "Pat dry", reason: "Better crispiness." }],
        ingredientChanges: [],
        estimatedMealFatGrams: badFat,
        protocolNote: null,
      });
      mockLLM(badResponse);
      mockLLM(badResponse);

      const engine = getMealRefinementEngine();
      await expect(engine.refine(BASE_COOKING_METHOD_REQUEST)).rejects.toThrow(
        /conflicts with your active health protocol/i,
      );
    },
  );

  // ── 12. GLP-1 retry succeeds when estimatedMealFatGrams is within ceiling ─
  test("returns result when retry estimatedMealFatGrams is within the GLP-1 fat ceiling", async () => {
    mockGlp1Context = {
      isActive: true,
      activationSources: ["medicalConditions"],
      resolvedTargets: {
        treatmentPhase: "maintenance",
        resolvedMealCalories: 400,
        targetProteinGrams: 28,
        maximumToleratedFatGrams: 12,
        minimumProteinFloor: 20,
      },
    };

    // First attempt: 25g fat (over ceiling)
    const highFatResponse = JSON.stringify({
      newMethod: "Pan Fried",
      cookingNotes: "Fry in 3 tbsp butter until golden.",
      cookingTips: [{ tip: "Use generous butter", reason: "Better browning." }],
      ingredientChanges: [{ item: "Butter", change: "Add 3 tbsp" }],
      estimatedMealFatGrams: 25,
      protocolNote: null,
    });
    // Retry: 9g fat (within ceiling)
    const compliantMethodResponse = JSON.stringify({
      newMethod: "Air Fryer",
      cookingNotes: "Cook at 400°F for 15 minutes, flipping halfway.",
      cookingTips: [{ tip: "Pat dry before cooking", reason: "Better crispiness." }],
      ingredientChanges: [{ item: "Cooking Spray", change: "1 light spray instead of butter" }],
      estimatedMealFatGrams: 9,
      protocolNote: null,
    });
    mockLLM(highFatResponse);
    mockLLM(compliantMethodResponse);

    const engine = getMealRefinementEngine();
    const result = await engine.refine(BASE_COOKING_METHOD_REQUEST) as any;

    expect(result.estimatedMealFatGrams).toBe(9);
    expect(result.newMethod).toBe("Air Fryer");
  });
});

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

      // Provide a compliant fat_grams so no retry is triggered — isolates
      // the prompt-content assertion from the retry path.
      const COMPLIANT_FAT_RESPONSE = JSON.stringify({
        coachSuggestion: {
          item: "Grilled Chicken Breast",
          reason: "Lean protein that fits the meal style and your protocol.",
          quantity: "6",
          unit: "oz",
          fat_grams: 4, // well within 12g ceiling
        },
        savedOption: null,
        alternatives: [
          { item: "Turkey Breast", reason: "Another lean white-meat option." },
        ],
        protocolNote: null,
      });

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: COMPLIANT_FAT_RESPONSE } }] };
        },
      );

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

  // ── 4. GLP-1 fat ceiling validation ──────────────────────────────────────
  describe("GLP-1 fat ceiling validation", () => {
    const HIGH_FAT_RESPONSE = JSON.stringify({
      coachSuggestion: {
        item: "Peanut Butter",
        reason: "Good protein source",
        quantity: "2",
        unit: "tbsp",
        fat_grams: 16, // exceeds ceiling of 12g
      },
      savedOption: null,
      alternatives: [],
      protocolNote: null,
    });

    const LOW_FAT_RESPONSE = JSON.stringify({
      coachSuggestion: {
        item: "Greek Yogurt",
        reason: "Low-fat protein source",
        quantity: "6",
        unit: "oz",
        fat_grams: 5, // within ceiling
      },
      savedOption: null,
      alternatives: [],
      protocolNote: null,
    });

    const STILL_HIGH_FAT_RESPONSE = JSON.stringify({
      coachSuggestion: {
        item: "Avocado",
        reason: "Healthy fats",
        quantity: "1/2",
        unit: "medium",
        fat_grams: 15, // still exceeds 12g ceiling
      },
      savedOption: null,
      alternatives: [],
      protocolNote: null,
    });

    beforeEach(() => {
      // Activate GLP-1 with a fat ceiling of 12g per meal
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
    });

    test("when LLM suggestion exceeds fat ceiling, retry is triggered with a corrective prompt", async () => {
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      // First call — high-fat suggestion
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: HIGH_FAT_RESPONSE } }] };
        },
      );
      // Retry call — compliant low-fat suggestion
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: LOW_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // Two LLM calls should have been made
      expect(capturedSystemPrompts).toHaveLength(2);
      // Retry prompt must contain the fat-ceiling correction notice
      expect(capturedSystemPrompts[1]).toContain("CRITICAL CORRECTION");
      expect(capturedSystemPrompts[1]).toContain("12");
      // Result must come from the compliant retry suggestion
      expect(result.coachSuggestion.item).toBe("Greek Yogurt");
      // No fat-ceiling warning since retry succeeded
      expect(result.protocolNote).toBeNull();
    });

    test("when retry also exceeds the fat ceiling, a clear protocolNote warning is appended", async () => {
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      // First call — high-fat
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: HIGH_FAT_RESPONSE } }] };
        },
      );
      // Retry — still high-fat
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return {
            choices: [{ message: { content: STILL_HIGH_FAT_RESPONSE } }],
          };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(2);
      expect(result.protocolNote).not.toBeNull();
      expect(result.protocolNote).toContain("GLP-1 fat ceiling");
      expect(result.protocolNote).toContain("12");
    });

    test("when fat_grams is absent, it is treated as unverified and retry is triggered", async () => {
      // Default SWAP_AI_RESPONSE has no fat_grams — treated as unverified, not compliant.
      // Both the initial call and the retry use the default mock (both return no fat_grams).
      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // Two LLM calls should have been made (initial + retry)
      expect(capturedSystemPrompts).toHaveLength(2);
      // Retry prompt must contain the requirement notice (not a correction)
      expect(capturedSystemPrompts[1]).toContain("CRITICAL REQUIREMENT");
      expect(capturedSystemPrompts[1]).toContain("12");
      // After retry also returns no fat_grams, a cannot-verify warning is appended
      expect(result.protocolNote).not.toBeNull();
      expect(result.protocolNote).toContain("unable to verify the fat content");
    });

    test("when fat_grams is absent and retry provides a compliant value, no warning is added", async () => {
      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      // First call — no fat_grams (unverified)
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: SWAP_AI_RESPONSE } }] };
        },
      );
      // Retry call — compliant fat_grams provided
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: LOW_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(2);
      expect(result.coachSuggestion.item).toBe("Greek Yogurt");
      expect(result.protocolNote).toBeNull();
    });

    test("when fat_grams is negative, it is treated as unverified and retry is triggered", async () => {
      const NEGATIVE_FAT_RESPONSE = JSON.stringify({
        coachSuggestion: {
          item: "Steamed Edamame",
          reason: "Plant-based protein",
          quantity: "1",
          unit: "cup",
          fat_grams: -3, // negative — invalid, must be treated as unverified
        },
        savedOption: null,
        alternatives: [],
        protocolNote: null,
      });

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      // Initial call — negative fat_grams (unverified)
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: NEGATIVE_FAT_RESPONSE } }] };
        },
      );
      // Retry — also negative (worst case)
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: NEGATIVE_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // Retry should have been triggered (negative is unverified)
      expect(capturedSystemPrompts).toHaveLength(2);
      // Cannot-verify warning should be present
      expect(result.protocolNote).toContain("unable to verify the fat content");
    });

    test("when fat_grams is negative and retry provides a compliant value, no warning is added", async () => {
      const NEGATIVE_FAT_RESPONSE = JSON.stringify({
        coachSuggestion: {
          item: "Steamed Edamame",
          reason: "Plant-based protein",
          quantity: "1",
          unit: "cup",
          fat_grams: -3,
        },
        savedOption: null,
        alternatives: [],
        protocolNote: null,
      });

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: NEGATIVE_FAT_RESPONSE } }] };
        },
      );
      // Retry — compliant fat_grams
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: LOW_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(2);
      expect(result.coachSuggestion.item).toBe("Greek Yogurt");
      expect(result.protocolNote).toBeNull();
    });

    test("when fat_grams is null (not just absent), it is also treated as unverified", async () => {
      const NULL_FAT_RESPONSE = JSON.stringify({
        coachSuggestion: {
          item: "Cottage Cheese",
          reason: "High protein, low fat",
          quantity: "1",
          unit: "cup",
          fat_grams: null, // explicitly null — must not be treated as compliant
        },
        savedOption: null,
        alternatives: [],
        protocolNote: null,
      });

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();

      // Initial call — null fat_grams
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: NULL_FAT_RESPONSE } }] };
        },
      );
      // Retry — also null fat_grams (worst case)
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: NULL_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // Retry should have been triggered
      expect(capturedSystemPrompts).toHaveLength(2);
      // Cannot-verify warning should be present
      expect(result.protocolNote).toContain("unable to verify the fat content");
    });

    test("when GLP-1 is not active, fat ceiling is not enforced even when fat_grams is high", async () => {
      mockGlp1Context = { isActive: false, resolvedTargets: null };

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: HIGH_FAT_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      // Only one LLM call — no retry without GLP-1
      expect(capturedSystemPrompts).toHaveLength(1);
      expect(result.protocolNote).toBeNull();
    });

    test("when fat_grams is exactly at the ceiling, no retry is triggered", async () => {
      const AT_CEILING_RESPONSE = JSON.stringify({
        coachSuggestion: {
          item: "Almond Milk",
          reason: "Dairy-free option",
          quantity: "1",
          unit: "cup",
          fat_grams: 12, // exactly at ceiling — should not trigger retry
        },
        savedOption: null,
        alternatives: [],
        protocolNote: null,
      });

      const { default: OpenAI } = await import("openai");
      const mockInstance = new (OpenAI as any)();
      mockInstance.chat.completions.create.mockImplementationOnce(
        async (params: any) => {
          const sys = params.messages?.find((m: any) => m.role === "system");
          if (sys?.content) capturedSystemPrompts.push(sys.content);
          return { choices: [{ message: { content: AT_CEILING_RESPONSE } }] };
        },
      );

      const engine = getMealRefinementEngine();
      const result = await engine.refine(BASE_REQUEST);

      expect(capturedSystemPrompts).toHaveLength(1);
      expect(result.protocolNote).toBeNull();
    });
  });

  // ── 5. Result shape ───────────────────────────────────────────────────────
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
