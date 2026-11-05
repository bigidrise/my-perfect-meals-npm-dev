/**
 * chef-path-diet-override.integration.test.ts
 *
 * Integration tests for the Create a Dish chef path with a diet override active.
 * Scenario: Profile = Vegan, override = Keto, dish = "Strawberry Cake", 2 servings.
 *
 * This file addresses the reviewer's requirement: the tests must drive the REAL
 * generateFromDescriptionUnified() function with mocked external boundaries
 * (OpenAI, DB) and assert that the actual chefDietRestrictions selection and
 * compliance-loop behavior are correct — not just reconstruct the logic inline.
 *
 * Sections
 * ──────────
 * A. STRUCTURAL — reads unifiedMealPipeline.ts and routes.ts source to pin
 *    the exact ternary / log / compliance-loop code that implements the fix.
 *    These tests fail immediately when the fix is reverted.
 *
 * B. INTEGRATION — calls generateFromDescriptionUnified() with:
 *      • a vegan protocol envelope (chefEnvelope.dietaryIdentity = ["vegan"])
 *      • dietaryRestrictionsOverride = ["keto"]
 *    and asserts:
 *      1. The function resolves to success (not blocked as a vegan violation)
 *      2. The OpenAI call was made — the pipeline did not short-circuit
 *      3. The captured prompt does NOT contain "vegan" appended to "keto"
 *         (i.e., no Set-union merge that would have produced both)
 *      4. The vegetable-strategy block is absent (recipe-sensitive gate works)
 *
 * Run: npx jest server/tests/chef-path-diet-override.integration.test.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Captured OpenAI call storage ───────────────────────────────────────────────
// Declared before jest.mock so the factory closure captures by reference.
const capturedCalls: Array<{ messages: any[]; maxTokens: number }> = [];
const mockRecipeResponses: string[] = [];

// ── Stable mock LLM response — keto strawberry cake ───────────────────────────
// Cream cheese + eggs are keto-legal but vegan-illegal.
// If the pipeline still applied vegan validation after a keto override, the
// compliance loop (line 3598-3646) would trigger a re-generation hint and
// eventually set dietaryComplianceVerified = false — making the bug visible.
const KETO_CAKE_RESPONSE = JSON.stringify({
  name: "Keto Strawberry Cream Cake",
  description:
    "A rich almond-flour cake layered with cream cheese frosting and fresh strawberries.",
  ingredients: [
    { name: "almond flour",       quantity: "1",   unit: "cup"  },
    { name: "cream cheese",       quantity: "4",   unit: "oz"   }, // vegan-illegal
    { name: "eggs",               quantity: "2",   unit: "large" }, // vegan-illegal
    { name: "erythritol",         quantity: "3",   unit: "tbsp" },
    { name: "fresh strawberries", quantity: "1/2", unit: "cup"  },
    { name: "butter",             quantity: "2",   unit: "tbsp" }, // vegan-illegal
    { name: "vanilla extract",    quantity: "1",   unit: "tsp"  },
  ],
  instructions:
    "1. Preheat oven to 350°F. 2. Mix almond flour, erythritol, eggs, and melted butter. " +
    "3. Pour batter into greased pan. 4. Bake 22 minutes. 5. Cool then frost with whipped cream cheese. " +
    "6. Top with fresh strawberries.",
  calories:    280,
  protein:       8,
  starchyCarbs:  4,
  fibrousCarbs:  2,
  fat:          24,
  cookingTime: "35 minutes",
  difficulty:  "Medium",
});

// ── Mock: openai ───────────────────────────────────────────────────────────────
// Intercepts the dynamic `const OpenAI = (await import('openai')).default` on
// line 3224 of unifiedMealPipeline.ts.  Returns KETO_CAKE_RESPONSE and records
// every message array so tests can inspect prompt content.
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    capturedCalls.push({
      messages:  params.messages ?? [],
      maxTokens: params.max_tokens ?? 0,
    });
    return { choices: [{ message: { content: mockRecipeResponses.shift() ?? KETO_CAKE_RESPONSE } }] };
  });

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));

  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: ../db ────────────────────────────────────────────────────────────────
// generateFromDescriptionUnified makes two DB selects:
//   1. Thyroid-support check (line 3178)
//   2. Oncology-support check (line 3200)
// Both receive a drizzle builder chain ending in .limit(1).
// Returning [] satisfies the destructuring `const [row] = await query`.
jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const chain: any = {
        from:  () => chain,
        where: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
      };
      return chain;
    }),
  },
}));

// ── Mock: protocolEnvelope ─────────────────────────────────────────────────────
// Returns a vegan envelope so the test proves the OVERRIDE supersedes the
// profile diet (chefEnvelope.dietaryIdentity = ["vegan"]).
//
// enforceBeforeGenerate is DYNAMIC — it inspects the envelope it receives and
// returns a diet-specific protocol block.  After the Bug #2 fix, the pipeline
// calls enforceBeforeGenerate with _effectiveChefEnvelope (which has
// dietaryIdentity: ["keto"] when an override is active), so the mock must
// return a keto block — not a vegan one — for the prompt assertions to be
// meaningful.  If the fix is reverted, enforceBeforeGenerate is called with the
// raw vegan envelope and the prompt will contain "Dietary identity: vegan".
const VEGAN_ENVELOPE = {
  dietaryIdentity:   ["vegan"],
  allergies:         [],
  medicalConditions: [],
  medicalHardLimits: [],
  avoidances:        [],
  procedural:        { forbiddenInstructions: [], preparationRules: [], storageRules: [], equipmentRules: [], requiredInstructionNotes: [], crossContaminationRules: [] },
  measurementSystem: "imperial" as const,
  cuisinePreference: undefined,
};
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue(VEGAN_ENVELOPE),
  loadGenerationProtocolEnvelope: jest.fn().mockResolvedValue(VEGAN_ENVELOPE),
  // Dynamic mock: returns protocol block text that reflects the ACTUAL diet identity
  // in the envelope passed to it.  This allows the prompt assertion tests to
  // distinguish "keto override reached enforceBeforeGenerate" from "vegan profile did".
  enforceBeforeGenerate: jest.fn().mockImplementation((envelope: any) => {
    const diet = (envelope?.dietaryIdentity ?? [])[0] ?? "none";
    return {
      combined: diet === "keto"
        ? `Dietary identity: keto\nHigh-fat, low-carb diet required. No sugar, no grains.`
        : diet === "vegan"
        ? `Dietary identity: vegan\nPlant-based foods only. No dairy, no eggs, no meat.`
        : `Dietary identity: ${diet}`,
      warnings: [],
    };
  }),
  scanGeneratedOutput: jest.fn().mockReturnValue({
    passed: true,
    violations: [],
    instructionViolations: [],
    message: "",
  }),
  filterMealsByProtocol: jest.fn().mockImplementation((meals: any[]) => meals),
  buildGuestEnvelope: jest.fn().mockReturnValue({
    dietaryIdentity: [], allergies: [], medicalConditions: [],
    measurementSystem: "imperial",
  }),
  buildMealComplianceBundle: jest.fn().mockReturnValue(""),
  buildComplianceSection: jest.fn().mockReturnValue(""),
}));

// ── Mock: hubCoupling ──────────────────────────────────────────────────────────
jest.mock("../services/hubCoupling", () => ({
  ensureHubsRegistered:    jest.fn().mockResolvedValue(undefined),
  resolveHubCoupling:      jest.fn().mockResolvedValue(null),
  detectHubTypeFromProfile: jest.fn().mockResolvedValue(null),
  isValidHubType:          jest.fn().mockReturnValue(false),
  validateMealForHub:      jest.fn().mockReturnValue({ valid: true }),
  hasHardViolations:       jest.fn().mockReturnValue(false),
  getRegenerationHint:     jest.fn().mockReturnValue(""),
}));

// ── Mock: behavioralMemoryService ─────────────────────────────────────────────
jest.mock("../services/behavioralMemoryService", () => ({
  derivePreferenceProfile:           jest.fn().mockResolvedValue(null),
  buildBehavioralMemoryPromptSection: jest.fn().mockReturnValue(""),
}));

// ── Mock: oncology support ────────────────────────────────────────────────────
jest.mock("../services/guardrails/prompt/oncologySupportPromptBuilder", () => ({
  isOncologySupportEnabled: jest.fn().mockReturnValue(false),
  buildOncologySupportPrompt: jest.fn().mockReturnValue(""),
}));

// ── Mock: mealImageGenerator ──────────────────────────────────────────────────
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

// ── Mock: safetyProfileService ────────────────────────────────────────────────
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile:          jest.fn().mockResolvedValue(null),
  loadSafetyProfile:             jest.fn().mockResolvedValue({ allergies: [], restrictions: [] }),
  validateGeneratedMeal:         jest.fn().mockReturnValue({ safe: true, violations: [] }),
  extractSafetyProfileFromUser:  jest.fn().mockReturnValue({ allergies: [], restrictions: [] }),
}));

// ── Mock: macroAuditLogger ────────────────────────────────────────────────────
jest.mock("../utils/macroAuditLogger", () => ({
  macroAudit:      jest.fn(),
  macroAuditPrompt: jest.fn(),
  macroAuditCache:  jest.fn(),
}));

// ── Mock: coaching activityEvents (avoid side-effect DB writes) ───────────────
jest.mock("../services/coaching/activityEvents", () => ({
  emitActivityEvent: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock: mealCachePersistent (avoid DB cache reads/writes) ─────────────────
jest.mock("../services/mealCachePersistent", () => ({
  getCachedMeals: jest.fn().mockResolvedValue(null),
  cacheMeals:     jest.fn().mockResolvedValue(undefined),
}));

// ── Imports (after jest.mock hoisting) ────────────────────────────────────────
import { generateFromDescriptionUnified, generateMealUnified, type MealGenerationRequest } from "../services/unifiedMealPipeline";
import { scanGeneratedOutput } from "../services/protocolEnvelope";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { buildChefMacroGoalNotice } from "../services/humanFoodContext/chefCandidateValidation";

// ── Source paths for structural tests ─────────────────────────────────────────
const PIPELINE_SRC = fs.readFileSync(
  path.resolve(__dirname, "../services/unifiedMealPipeline.ts"),
  "utf-8",
);
const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, "../routes.ts"),
  "utf-8",
);

// ─────────────────────────────────────────────────────────────────────────────
// A. STRUCTURAL — pipeline source pins the fix contract
// ─────────────────────────────────────────────────────────────────────────────

describe("A. Structural — unifiedMealPipeline.ts diet override contract", () => {
  it("chefDietRestrictions uses REPLACEMENT ternary, not Set union", () => {
    // The fix replaces the Set-union merge with a ternary that REPLACES profile diet.
    // Key tokens that must co-exist in the ternary block.
    const ternaryStart = PIPELINE_SRC.indexOf("const chefDietRestrictions");
    expect(ternaryStart).toBeGreaterThan(-1);
    const ternaryBlock = PIPELINE_SRC.slice(ternaryStart, ternaryStart + 400);
    // Must contain: dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0
    expect(ternaryBlock).toContain("dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0");
  });

  it("override branch selects dietaryRestrictionsOverride (not chefEnvelope.dietaryIdentity)", () => {
    // The truthy branch of the ternary must be: ? dietaryRestrictionsOverride
    // Lines 3145-3147 of the production source.
    const ternaryStart = PIPELINE_SRC.indexOf("const chefDietRestrictions");
    const ternaryBlock = PIPELINE_SRC.slice(ternaryStart, ternaryStart + 400);
    expect(ternaryBlock).toContain("? dietaryRestrictionsOverride");
    expect(ternaryBlock).toContain(": chefEnvelope.dietaryIdentity");
  });

  it("log message confirms replacement semantics (not merge)", () => {
    // The log at line 3149 says 'replaces' — if the merge bug reappears the log
    // would change too (or the ternary block would move), making this test fail.
    expect(PIPELINE_SRC).toContain("replaces profile diet");
  });

  it("compliance loop reads chefDietRestrictions — not the raw envelope", () => {
    // Line 3597: getPrimaryDiet(chefDietRestrictions) — not getPrimaryDiet(chefEnvelope.dietaryIdentity)
    // A regression that reverts to the envelope directly would break this assertion.
    expect(PIPELINE_SRC).toMatch(/getPrimaryDiet\s*\(\s*chefDietRestrictions\s*\)/);
  });

  it("compliance loop only activates for vegan/vegetarian/pescatarian — keto override skips it", () => {
    // Line 3598: the guard is includes(['vegan','vegetarian','pescatarian'])
    // When chefDietRestrictions = ["keto"], chefPrimaryDiet = "keto", so the guard is false.
    // This means a keto override is NEVER subjected to vegan compliance validation.
    expect(PIPELINE_SRC).toContain("'vegan', 'vegetarian', 'pescatarian'");
    // Keto does NOT appear in that list — absence is the correctness guarantee.
    const complianceGuard = PIPELINE_SRC.slice(
      PIPELINE_SRC.indexOf("'vegan', 'vegetarian', 'pescatarian'"),
      PIPELINE_SRC.indexOf("'vegan', 'vegetarian', 'pescatarian'") + 80,
    );
    expect(complianceGuard).not.toContain("keto");
  });

  it("vegetable strategy is suppressed when isRecipeSensitiveDish returns true", () => {
    // Lines 3093-3094: vegetableStrategyGuidance = '' when isRecipeModeDish is true.
    // Strawberry Cake is recipe-sensitive → no spinach injection.
    expect(PIPELINE_SRC).toMatch(
      /vegetableStrategyGuidance\s*=\s*\(.*!isRecipeModeDish.*\)\s*\?.*:\s*['"]{2}/,
    );
  });
});

describe("A. Structural — routes.ts diet override construction", () => {
  it("route builds dietaryRestrictionsOverride from dietOverride field (not from effectiveDietType)", () => {
    // The route must check dietOverride FIRST (the explicit client selection)
    // before falling back to the computed effectiveDietType.
    // routes.ts line 1123-1132: dietaryRestrictionsOverride IIFE returns [src].
    expect(ROUTES_SRC).toContain("dietaryRestrictionsOverride");
    // The array wrapping — the IIFE body must contain `return [src]`
    expect(ROUTES_SRC).toContain("return [src]");
    // dietOverride must be the primary source (checked before effectiveDietType)
    const overrideBlock = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("dietaryRestrictionsOverride: (()"),
      ROUTES_SRC.indexOf("dietaryRestrictionsOverride: (()") + 400,
    );
    expect(overrideBlock).toContain("dietOverride");
  });

  it("dietaryRestrictionsOverride is passed to generateMealUnified / generateFromDescriptionUnified", () => {
    // The parameter must reach the pipeline — absence would silently break all overrides.
    expect(ROUTES_SRC).toContain("dietaryRestrictionsOverride");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. INTEGRATION — calls the real generateFromDescriptionUnified()
//
// Profile: vegan (chefEnvelope.dietaryIdentity = ["vegan"])
// Override: keto  (dietaryRestrictionsOverride = ["keto"])
// Dish:     "Strawberry Cake"
// Servings: 2
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedCalls.length = 0;
  mockRecipeResponses.length = 0;
});
describe("Create With Chef ordinary fat guidance and hard-rule repair before images", () => {
  const context = (fat = 13): HumanFoodContext => Object.freeze({
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [] },
    authorization: { status: "none", waivers: [] },
    nutrition: {
      date: "2026-10-08",
      prescription: { source: "user_default", fatTarget: 48, proteinTarget: 100 },
      consumed: { fat: 35, protein: 70 },
      planned: { fat: 0, protein: 0 },
      projectedRemaining: { calories: 500, carbs: 40, fat },
      activeConstraints: { consumedStarchExhausted: false },
    },
  }) as unknown as HumanFoodContext;
  const recipe = (fat: unknown) => JSON.stringify({
    ...JSON.parse(KETO_CAKE_RESPONSE),
    name: "Grilled Chicken Tacos",
    ingredients: [
      { name: "chicken breast", quantity: "5", unit: "oz" },
      { name: "cabbage", quantity: "1", unit: "cup" },
      { name: "olive oil", quantity: "1", unit: "tsp" },
    ],
    fat,
  });
  const request = (foodContext = context()): MealGenerationRequest => ({
    type: "create-with-chef",
    mealType: "dinner",
    input: "Tacos.",
    userId: "test-user-vegan-001",
    servings: 1,
    skipImage: false,
    safetyAlreadyChecked: true,
    dietaryRestrictionsOverride: ["keto"],
    remainingMacros: { calories: 500, carbs: 40, fat: 4, protein: 10 },
    builderMode: "STRICT",
    chefFoodContext: foodContext,
  });
  beforeEach(() => (generateMealImageUnified as jest.Mock).mockClear());

  it("keeps a requested over-fat dinner without shrinking it or retrying an ordinary goal", async () => {
    const foodContext = context();
    const snapshot = JSON.stringify(foodContext);
    mockRecipeResponses.push(recipe(24));
    const result = await generateMealUnified({ ...request(foodContext), dietType: "low-carb" });
    expect(result.success).toBe(true);
    expect(result.meal?.fat).toBe(24);
    expect(result.meal?.name).toBe("Grilled Chicken Tacos");
    expect(result.chefPersonFedValidated).toBe(true);
    expect(capturedCalls).toHaveLength(1);
    const prompt = capturedCalls[0].messages.map(message => message.content).join("\n");
    expect(prompt).not.toContain("Hard ceiling — no exceptions");
    expect(JSON.stringify(foodContext)).toBe(snapshot);
    expect(generateMealImageUnified).toHaveBeenCalledTimes(1);
  });

  it("allows ordinary total carbohydrate overages when no actual starch or clinical limit fails", async () => {
    const tooManyCarbs = JSON.stringify({ ...JSON.parse(recipe(24)), starchyCarbs: 45 });
    mockRecipeResponses.push(tooManyCarbs, tooManyCarbs);
    const result = await generateMealUnified(request());
    expect(result.success).toBe(true);
    expect(result.foodProfileViolations).toBeUndefined();
    expect(capturedCalls).toHaveLength(1);
    expect(generateMealImageUnified).toHaveBeenCalledTimes(1);
    expect(result.chefPersonFedValidated).toBe(true);
  });

  it("allows an ordinary fat overage even when the clamped remaining value is zero", async () => {
    mockRecipeResponses.push(recipe(22));
    const result = await generateMealUnified(request(context(0)));
    expect(result.success).toBe(true);
    expect(result.meal?.fat).toBe(22);
    expect(capturedCalls).toHaveLength(1);
  });

  it("preserves an explicitly requested upper fat limit", async () => {
    mockRecipeResponses.push(recipe(24), recipe(24));
    const result = await generateMealUnified({
      ...request(), macroTargets: { fat_g: 13, relationships: { fat_g: "at_most" } },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("requested meal macros");
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("forecasts a 9g overage from actual recipe totals without changing consumption or targets", () => {
    const foodContext = context();
    const before = JSON.stringify(foodContext);
    const notice = buildChefMacroGoalNotice({ fat: 22, protein: 8 }, foodContext);
    expect(notice?.basis).toBe("planned_forecast");
    expect(notice?.projections[0]).toMatchObject({
      macro: "fat", target: 48, before: 35, recipe: 22, projected: 57, overage: 9,
    });
    expect(notice?.message).toContain("9g over");
    expect(JSON.stringify(foodContext)).toBe(before);
  });

  it("includes an existing overage rather than subtracting from a clamped zero", () => {
    const foodContext = context(0);
    foodContext.nutrition!.consumed.fat = 60;
    const notice = buildChefMacroGoalNotice({ fat: 22, protein: 8 }, foodContext);
    expect(notice?.projections[0].overage).toBe(34);
  });

  it("forecasts the person-fed portion rather than counting every serving in a recipe", () => {
    const notice = buildChefMacroGoalNotice({ fat: 44, protein: 16 }, context(), 2);
    expect(notice?.projections[0]).toMatchObject({ recipe: 22, projected: 57, overage: 9 });
  });

  it("tracks a protein overage without treating it as a maximum", () => {
    const notice = buildChefMacroGoalNotice({ fat: 5, protein: 40 }, context());
    expect(notice?.projections).toEqual([
      expect.objectContaining({ macro: "protein", projected: 110, overage: 10 }),
    ]);
  });

  it.each([0, 13])("preserves a verified %jg fat value without adding the legacy 15g default", async fat => {
    mockRecipeResponses.push(recipe(fat));
    const result = await generateMealUnified(request());
    expect(result.success).toBe(true);
    expect(result.meal?.fat).toBe(fat);
    expect(capturedCalls).toHaveLength(1);
  });

  it.each([undefined, null, "", -1])("does not certify unavailable/invalid fat as zero: %j", async fat => {
    mockRecipeResponses.push(recipe(fat), recipe(fat));
    const result = await generateMealUnified(request());
    expect(result.success).toBe(false);
    expect(result.foodProfileViolations).toContain("verified_fat_missing");
    expect(result.error).toContain("couldn't verify");
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("retains the ingredient exclusions during numeric repair", async () => {
    const foodContext = {
      ...context(),
      safety: { allergies: ["chicken"], avoidedFoods: [], dislikedFoods: [] },
    } as HumanFoodContext;
    mockRecipeResponses.push(recipe(10), recipe(10));
    const result = await generateMealUnified(request(foodContext));
    expect(result.success).toBe(false);
    expect(result.foodProfileViolations).toContain("forbidden_ingredient:chicken");
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("checks per-serving provider nutrition rather than multiplying by requested servings", async () => {
    mockRecipeResponses.push(JSON.stringify({
      ...JSON.parse(recipe(10)),
      ingredients: [
        { name: "chicken breast", quantity: "15", unit: "oz" },
        { name: "cabbage", quantity: "3", unit: "cup" },
        { name: "olive oil", quantity: "1", unit: "tbsp" },
      ],
    }));
    const result = await generateMealUnified({ ...request(), servings: 3 });
    expect(result.success).toBe(true);
    expect(result.meal?.fat).toBe(10);
  });
});

describe("Create With Chef requested-macro handoff", () => {
  const recipe = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    ...JSON.parse(KETO_CAKE_RESPONSE),
    protein: 30,
    starchyCarbs: 20,
    fibrousCarbs: 5,
    ...overrides,
  });
  const chefRequest = (macroTargets?: MealGenerationRequest["macroTargets"]): MealGenerationRequest => ({
    type: "create-with-chef",
    mealType: "breakfast",
    input: "Strawberry Cake",
    userId: "test-user-vegan-001",
    servings: 2,
    skipImage: true,
    safetyAlreadyChecked: true,
    dietaryRestrictionsOverride: ["keto"],
    macroTargets,
  });
  const prompt = () => capturedCalls[0]?.messages.map(message => message.content).join("\n") ?? "";

  afterEach(() => {
    (scanGeneratedOutput as jest.Mock).mockReturnValue({
      passed: true, violations: [], instructionViolations: [], message: "",
    });
  });

  it.each([
    [{ protein_g: 30 }, "protein: approximately 30g"],
    [{ carbs_g: 25 }, "TOTAL carbohydrates: approximately 25g"],
    [{ protein_g: 30, carbs_g: 25 }, "TOTAL carbohydrates: approximately 25g"],
  ])("forwards structured targets through the real unified dispatch: %j", async (targets, instruction) => {
    mockRecipeResponses.push(recipe());
    const result = await generateMealUnified(chefRequest(targets));
    expect(result.success).toBe(true);
    expect(prompt()).toContain(instruction);
    expect(prompt()).toContain("PER SERVING");
    if ("protein_g" in targets) expect(prompt()).toContain("protein: approximately 30g");
  });

  it("preserves remainingMacros and authoritative context separately from the requested target", async () => {
    const remainingMacros = Object.freeze({ protein: 99, carbs: 88, fat: 50, calories: 500 });
    const targets = Object.freeze({ protein_g: 30, carbs_g: 25 });
    const request = {
      ...chefRequest(targets),
      remainingMacros,
      generationContext: "HUMAN FOOD CONTEXT: preserve saved avoidances and authoritative daily nutrition.",
    };
    mockRecipeResponses.push(recipe());
    expect((await generateMealUnified(request)).success).toBe(true);
    expect(request.remainingMacros).toBe(remainingMacros);
    expect(request.remainingMacros).toEqual({ protein: 99, carbs: 88, fat: 50, calories: 500 });
    expect(targets).toEqual({ protein_g: 30, carbs_g: 25 });
    expect(prompt()).toContain("protein: approximately 30g");
    expect(prompt()).toContain(request.generationContext);
    expect(prompt()).toContain("Dietary identity: keto");
    expect(ROUTES_SRC).toContain("remainingMacros: effectiveRemainingMacros || undefined");
    expect(ROUTES_SRC).toContain("effectiveRemainingMacros = chefBudget.remainingMacros");
  });

  it("retains an at-most limit and rejects an over-limit recipe after bounded retries", async () => {
    mockRecipeResponses.push(recipe({ fibrousCarbs: 11 }), recipe({ fibrousCarbs: 11 }));
    const result = await generateMealUnified(chefRequest({
      carbs_g: 30, relationships: { carbs_g: "at_most" },
    }));
    expect(prompt()).toContain("TOTAL carbohydrates: at most 30g (upper limit; never exceed)");
    expect(result.success).toBe(false);
    expect(result.error).toContain("31g per serving");
    expect(capturedCalls).toHaveLength(2);
  });

  it("retains an at-least protein minimum", async () => {
    mockRecipeResponses.push(recipe({ protein: 40 }));
    const result = await generateMealUnified(chefRequest({
      protein_g: 40, relationships: { protein_g: "at_least" },
    }));
    expect(result.success).toBe(true);
    expect(prompt()).toContain("protein: at least 40g (minimum)");
  });

  it("retries a missed request inside the existing loop and accepts a matching candidate", async () => {
    mockRecipeResponses.push(recipe({ protein: 10 }), recipe({ protein: 30 }));
    const result = await generateMealUnified(chefRequest({ protein_g: 30 }));
    expect(result.success).toBe(true);
    expect(result.meal?.protein).toBe(30);
    expect(capturedCalls).toHaveLength(2);
    expect(capturedCalls[1].messages.map(message => message.content).join("\n"))
      .toContain("REQUESTED MEAL MACROS NOT MET");
  });

  it("does not treat starchy carbohydrate alone as total carbohydrate", async () => {
    mockRecipeResponses.push(recipe({ starchyCarbs: 25, fibrousCarbs: 15 }),
      recipe({ starchyCarbs: 25, fibrousCarbs: 15 }));
    const result = await generateMealUnified(chefRequest({ carbs_g: 25 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("TOTAL carbohydrates is 40g");
  });

  it("does not bypass an existing protocol rejection even when macros match", async () => {
    (scanGeneratedOutput as jest.Mock).mockReturnValue({
      passed: false, violations: ["saved allergy"], instructionViolations: [], message: "Saved allergy conflict.",
    });
    mockRecipeResponses.push(recipe(), recipe());
    const result = await generateMealUnified(chefRequest({ protein_g: 30, carbs_g: 25 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("Saved allergy conflict");
  });

  it("preserves the server-authoritative zero-starch gate", async () => {
    mockRecipeResponses.push(recipe(), recipe());
    const result = await generateMealUnified({
      ...chefRequest({ protein_g: 30, carbs_g: 25 }),
      starchContext: { forceFiberBased: true, isZeroStarchDay: true } as any,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("STARCH HARD VIOLATION");
  });

  it("checks per-serving values without multiplying the request by recipe servings", async () => {
    mockRecipeResponses.push(recipe());
    const result = await generateMealUnified({ ...chefRequest({ protein_g: 30, carbs_g: 25 }), servings: 3 });
    expect(result.success).toBe(true);
    expect(result.meal?.protein).toBe(30);
    expect(prompt()).toMatch(/3\s*serving/i);
  });

  it("preserves a legitimate zero rather than replacing it with the legacy fat default", async () => {
    mockRecipeResponses.push(recipe({ fat: 0 }));
    const result = await generateMealUnified(chefRequest({
      fat_g: 0, relationships: { fat_g: "at_most" },
    }));
    expect(result.success).toBe(true);
    expect(result.meal?.fat).toBe(0);
  });

  it("does not fabricate a target match from missing provider protein", async () => {
    const missing = JSON.parse(recipe());
    delete missing.protein;
    mockRecipeResponses.push(JSON.stringify(missing), JSON.stringify(missing));
    const result = await generateMealUnified(chefRequest({ protein_g: 25 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("valid returned nutrition value");
  });

  it("carries and checks targets on the beverage early-return path", async () => {
    mockRecipeResponses.push(recipe({ name: "Berry Protein Shake" }));
    const result = await generateMealUnified({
      ...chefRequest({ protein_g: 999 }), input: "Make me a protein shake",
    });
    expect(prompt()).toContain("protein: approximately 999g");
    expect(result.success).toBe(false);
    expect(result.error).toContain("The beverage could not meet your requested meal macros");
  });

  it("rejects a deterministic fallback that misses the requested target", async () => {
    mockRecipeResponses.push("invalid provider JSON");
    const result = await generateMealUnified(chefRequest({ protein_g: 999 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("The fallback could not meet your requested meal macros");
  });

  it("leaves the prompt unchanged when explicit targets are absent or empty", async () => {
    await generateMealUnified(chefRequest());
    const previousPrompt = prompt();
    capturedCalls.length = 0;
    await generateMealUnified(chefRequest({}));
    expect(prompt()).toBe(previousPrompt);
    expect(prompt()).not.toContain("EXPLICIT REQUESTED PER-MEAL MACROS");
  });

  it("does not forward Chef-only constraints to Snack Creator", async () => {
    const request = { ...chefRequest(), type: "snack-creator" as const };
    const previous = await generateMealUnified(request);
    capturedCalls.length = 0;
    const withTargets = await generateMealUnified({
      ...request, macroTargets: { protein_g: 999, carbs_g: 999 },
    });
    expect(withTargets.success).toBe(previous.success);
    expect(withTargets.error).toBe(previous.error);
    expect(withTargets.meal?.protein).toBe(previous.meal?.protein);
    expect(prompt()).not.toContain("EXPLICIT REQUESTED PER-MEAL MACROS");
  });

  it("keeps legacy creators remapped onto Chef outside this handoff", () => {
    const construction = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("const generationRequest ="),
      ROUTES_SRC.indexOf("const result = await generateMealUnified(generationRequest)"),
    );
    expect(construction).toMatch(/macroTargets:\s*stage2dHumanFoodTypes\.has\(type\)\s*&&\s*type !== "create-with-chef"\s*\?\s*undefined\s*:\s*macroTargets/);
  });
});

describe("B. Integration — generateFromDescriptionUnified: vegan profile + keto override", () => {

  it("resolves to success — keto override prevents vegan compliance blocking the cake", async () => {
    // The LLM returns cream cheese + eggs (vegan-illegal, keto-legal).
    // If chefDietRestrictions were still ["vegan"] (the bug), the compliance loop would
    // run validateDietaryRestriction({ ingredients: [cream cheese, eggs] }, "vegan")
    // which returns isValid=false — triggering re-generation hints or dietaryComplianceVerified=false.
    // With the fix, chefDietRestrictions = ["keto"], chefPrimaryDiet = "keto",
    // the compliance guard `['vegan','vegetarian','pescatarian'].includes("keto")` is false,
    // so the vegan loop NEVER runs — the cake is accepted on the first attempt.
    const result = await generateFromDescriptionUnified(
      "Strawberry Cake",           // description
      "dinner",                    // mealType
      "test-user-vegan-001",       // userId  (triggers protocolEnvelope mock)
      undefined,                   // dietType
      undefined,                   // starchContext
      undefined,                   // nutritionStrategy
      false,                       // strictMode
      true,                        // skipImage — avoids DALL-E call
      undefined,                   // explicitOverride
      undefined,                   // diversityContext
      undefined,                   // dietPhase
      undefined,                   // remainingMacros
      undefined,                   // builderMode
      undefined,                   // performanceSessionContext
      undefined,                   // generationContext
      undefined,                   // glp1Targets
      undefined,                   // preferredLanguage
      ["keto"],                    // dietaryRestrictionsOverride ← override under test
      2,                           // servings
    );

    expect(result.success).toBe(true);
    expect(result.source).toBe("ai");
    expect(result.meal).toBeDefined();
    expect(result.meal?.instructions).toEqual([
      "Preheat oven to 350°F.",
      "Mix almond flour, erythritol, eggs, and melted butter.",
      "Pour batter into greased pan.",
      "Bake 22 minutes.",
      "Cool then frost with whipped cream cheese.",
      "Top with fresh strawberries.",
    ]);
  });

  it("OpenAI was called — the function reached the LLM, not a cache/error short-circuit", async () => {
    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    expect(capturedCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("prompt sent to OpenAI specifies 2 servings for the Strawberry Cake", async () => {
    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    const userMsg = capturedCalls[0]?.messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    // The prompt template embeds the serving count: "for 2 serving(s)"
    expect(userMsg.content).toMatch(/2\s*serving/i);
  });

  it("delivers arbitrary canonical HFC guidance to the final Create With Chef prompt", async () => {
    const hfcBlock = [
      "HUMAN FOOD CONTEXT v1",
      "OPTIONAL FOOD INCLUSION PRIORITIES:",
      "- Fiber-Rich Foods: use when natural; omission is valid.",
    ].join("\n");

    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, hfcBlock,
      undefined, undefined,
      ["keto"], 2,
    );

    const prompt = capturedCalls[0]?.messages.map((message: any) => message.content).join("\n");
    expect(prompt).toContain("=== AUTHORITATIVE REQUEST AND HUMAN FOOD CONTEXT ===");
    expect(prompt).toContain(hfcBlock);
  });

  it("prompt does NOT carry [vegan, keto] merged diet — only keto override governs", async () => {
    // If the old union-merge bug reappeared, the prompt would contain something like:
    //   "DIET: [vegan, keto]" or "vegan AND keto" or show both diets together.
    // With the fix, chefDietRestrictions = ["keto"] only.
    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    const userMsg = capturedCalls[0]?.messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    const prompt: string = userMsg.content;

    // The prompt must contain the Strawberry Cake request
    expect(prompt).toContain("Strawberry Cake");

    // The prompt must NOT contain the union-merge artifact
    expect(prompt).not.toMatch(/vegan.*keto|keto.*vegan/i);

    // The keto compliance loop must NOT have added a "vegan-FORBIDDEN" regeneration hint.
    const allUserMessages = capturedCalls[0]?.messages.filter((m: any) => m.role === "user");
    expect(allUserMessages.length).toBe(1);
  });

  it("chefProtocolBlock in the prompt comes from the KETO effective envelope — not the raw vegan profile", async () => {
    // Bug #2 fix (unifiedMealPipeline.ts): before calling enforceBeforeGenerate,
    // the pipeline now builds _effectiveChefEnvelope with dietaryIdentity: ["keto"].
    // The dynamic mock returns "Dietary identity: keto" for a keto envelope and
    // "Dietary identity: vegan" for a vegan envelope — making the assertion meaningful.
    // If the fix is reverted, enforceBeforeGenerate is called with the raw vegan
    // envelope → mock returns "Dietary identity: vegan" → prompt assertion fails.
    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    const userMsg = capturedCalls[0]?.messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    const prompt: string = userMsg.content;

    // The protocol block must reflect the KETO diet identity
    expect(prompt).toMatch(/Dietary identity: keto/i);

    // The vegan identity block must NOT appear — it was in the raw envelope but
    // the fix passes the effective envelope to enforceBeforeGenerate instead.
    expect(prompt).not.toMatch(/Dietary identity: vegan/i);
    expect(prompt).not.toContain("Plant-based foods only");
  });

  it("returned meal has no vegan compliance badge — keto override suppresses it", async () => {
    // dietaryComplianceVerified is set to true only when vegan/vegetarian/pescatarian
    // compliance validation passes. For a keto override, the compliance loop never
    // runs, so dietaryComplianceVerified stays undefined → badge is not set.
    const result = await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined, undefined,
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    // dietaryComplianceVerified = true would mean the vegan validation loop ran
    // and passed — which is wrong when the override is keto.
    expect(result.meal?.dietaryComplianceVerified).not.toBe(true);
  });

  it("vegetable strategy block is absent from the prompt (Strawberry Cake is recipe-sensitive)", async () => {
    // generateFromDescriptionUnified lines 3093-3094:
    //   const isRecipeModeDish = isRecipeSensitiveDish(description);
    //   const vegetableStrategyGuidance = (!strictMode && nutritionStrategy && !isRecipeModeDish) ? ... : '';
    //
    // Even if a nutritionStrategy were provided, isRecipeModeDish = true for
    // "Strawberry Cake" → vegetableStrategyGuidance = '' → no vegetables injected.
    // We pass a non-null nutritionStrategy to make this gate observable.
    const dummyStrategy = {
      vegetableApproach: "standard",
      proteinType: "mixed",
    } as any;

    await generateFromDescriptionUnified(
      "Strawberry Cake", "dinner", "test-user-vegan-001",
      undefined, undefined,
      dummyStrategy,     // nutritionStrategy — would produce veg guidance if not gated
      false, true, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined,
      ["keto"], 2,
    );

    const userMsg = capturedCalls[0]?.messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    const prompt: string = userMsg.content;

    // buildVegetableStrategyPrompt emits a "high-volume" vegetables phrase
    // (line 91/107/132 of promptBuilder.ts: "high-volume, low-energy vegetables" or
    // "Fill volume with high-volume vegetables").  This phrase is unique to that
    // function and does NOT appear in the measurement block or the base prompt.
    // Its absence proves the vegetable injection gate fired correctly.
    expect(prompt).not.toMatch(/high-volume.*vegetable|Fill volume with high-volume/i);
  });
});
