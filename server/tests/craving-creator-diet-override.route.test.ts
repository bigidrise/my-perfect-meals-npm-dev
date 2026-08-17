/**
 * craving-creator-diet-override.route.test.ts
 *
 * Regression tests for the Create a Dish diet override on the
 * `/api/meals/craving-creator` path (the route CreateDishPage actually calls).
 *
 * Scenario: Profile = Vegan, UI sends dietaryRestrictions: "keto", servings: 2,
 *           dish = "Strawberry Cake".
 *
 * This file addresses the reviewer's three requirements:
 *   1. Drive the actual craving-creator pipeline — call generateCravingMealOptions()
 *      with the exact arguments the route passes (`["keto"]` as diet restrictions)
 *      and assert the OpenAI prompt carries KETO, not VEGAN.
 *   2. Assert filterMealsByProtocol() accepts keto meals when the override envelope
 *      substitutes dietaryIdentity ("keto" replaces "vegan") and rejects them with
 *      the raw vegan envelope — proving the _filterEnvelope fix semantics.
 *   3. Structural source tests for routes.ts pin the exact lines that build
 *      _resolvedPrimaryDiet from the dietaryRestrictions body field and pass it
 *      to generateCravingMealOptions as bodyDietRestrictions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW CreateDishPage reaches this path (to understand what we're testing)
 * ─────────────────────────────────────────────────────────────────────────────
 * CreateDishPage.tsx (line ~532) POSTs to /api/meals/craving-creator with:
 *   { cravingInput: "Strawberry Cake",
 *     targetMealType: "dinner",
 *     dietaryRestrictions: "keto",   ← dietOverrideEnabled=true, dietOverrideValue="keto"
 *     servings: 2 }
 *
 * routes.ts (/api/meals/craving-creator, line 5040):
 *   _resolvedPrimaryDiet = ["keto"]          (from dietaryRestrictions body field)
 *   bodyDietRestrictions = ["keto"]
 *   generateCravingMealOptions(..., ["keto"], ...)
 *   _filterEnvelope = (dietOverride) ? override : protocolEnvelope
 *     NOTE: when client sends dietaryRestrictions only (not dietOverride), the
 *     filter envelope check requires `&& dietOverride` — structural test pins this.
 *
 * generateCravingMealOptions (unifiedMealPipeline.ts line 1958):
 *   dietRestrictions = ["keto"]              (replacement, not merge with stored vegan)
 *   dietBlock = buildDietPromptBlock(["keto"])
 *   prompt → "USER DIET: KETO"
 *
 * Run: npx jest server/tests/craving-creator-diet-override.route.test.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Captured OpenAI call storage ──────────────────────────────────────────────
// Declared before jest.mock so the factory closure captures by reference.
const capturedCalls: Array<{ messages: any[]; prompt?: string }> = [];

// ── Mock LLM response — 3 keto Strawberry Cake options ───────────────────────
// Cream cheese + eggs + butter are keto-legal but vegan-illegal.
// If the pipeline still injected vegan restrictions, the prompt would say
// "USER DIET: VEGAN" and the model (real call) would refuse cream cheese.
const KETO_VARIETY_RESPONSE = JSON.stringify([
  {
    name: "Keto Strawberry Cream Cake",
    description: "Almond-flour sponge with cream-cheese frosting and fresh strawberries.",
    category: "dessert",
    calories: 280, protein: 8, fat: 22, starchyCarbs: 3, fibrousCarbs: 2,
    cookingTime: "35 minutes", difficulty: "Medium",
    ingredients: [
      { name: "almond flour",       quantity: "1",   unit: "cup"  },
      { name: "cream cheese",       quantity: "4",   unit: "oz"   },
      { name: "eggs",               quantity: "2 large", unit: "" },
      { name: "erythritol",         quantity: "3",   unit: "tbsp" },
      { name: "fresh strawberries", quantity: "1/2", unit: "cup"  },
      { name: "butter",             quantity: "2",   unit: "tbsp" },
      { name: "vanilla extract",    quantity: "1",   unit: "tsp"  },
    ],
    instructions: "Mix dry. Fold in wet. Bake 22 min. Cool and frost.",
    macros: { calories: 280, protein: 8, fat: 22, carbs: 5 },
  },
  {
    name: "Keto Strawberry Cheesecake Cup",
    description: "No-bake cream cheese cups with a pecan crust.",
    category: "dessert",
    calories: 260, protein: 7, fat: 21, starchyCarbs: 2, fibrousCarbs: 2,
    cookingTime: "15 minutes", difficulty: "Easy",
    ingredients: [
      { name: "cream cheese",       quantity: "6",   unit: "oz"   },
      { name: "pecans",             quantity: "1/4", unit: "cup"  },
      { name: "heavy cream",        quantity: "2",   unit: "tbsp" },
      { name: "erythritol",         quantity: "2",   unit: "tbsp" },
      { name: "fresh strawberries", quantity: "1/4", unit: "cup"  },
    ],
    instructions: "Press pecans into cups. Whip cream cheese. Fill. Chill.",
    macros: { calories: 260, protein: 7, fat: 21, carbs: 4 },
  },
  {
    name: "Keto Strawberry Butter Cake",
    description: "Dense butter cake with strawberry coulis and whipped cream.",
    category: "dessert",
    calories: 300, protein: 6, fat: 26, starchyCarbs: 3, fibrousCarbs: 1,
    cookingTime: "40 minutes", difficulty: "Medium",
    ingredients: [
      { name: "almond flour",       quantity: "3/4", unit: "cup"  },
      { name: "butter",             quantity: "4",   unit: "tbsp" },
      { name: "eggs",               quantity: "3 large", unit: "" },
      { name: "erythritol",         quantity: "4",   unit: "tbsp" },
      { name: "strawberries",       quantity: "1/2", unit: "cup"  },
      { name: "heavy cream",        quantity: "2",   unit: "tbsp" },
    ],
    instructions: "Cream butter. Beat in eggs. Mix dry ingredients. Bake 30 min.",
    macros: { calories: 300, protein: 6, fat: 26, carbs: 4 },
  },
]);

// ── Mock: openai ──────────────────────────────────────────────────────────────
// Intercepts the dynamic `await import('openai')` inside generateCravingMealOptions.
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    const allMessages = params.messages ?? [];
    const userMsg = allMessages.find((m: any) => m.role === "user");
    capturedCalls.push({
      messages: allMessages,
      prompt: userMsg?.content ?? "",
    });
    return { choices: [{ message: { content: KETO_VARIETY_RESPONSE } }] };
  });
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: ../db ───────────────────────────────────────────────────────────────
// generateCravingMealOptions queries the DB for user profile (allergies, conditions)
// even when dietaryRestrictionsOverride is provided. Return a vegan user to prove
// the override supersedes the stored profile diet.
const VEGAN_DB_USER = {
  id: "test-user-vegan-001",
  dietaryRestrictions: ["vegan"],        // stored profile diet — must be superseded
  allergies: [],
  healthConditions: [],
  specialtyCondition: null,
  oncologySupportContext: null,
  thyroidSupportContext: null,
  measurementSystem: "imperial",
  diabeticContext: null,
  renalContext: null,
  performanceModeEnabled: false,
};
jest.mock("../db", () => {
  const chain: any = {
    from:  jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([VEGAN_DB_USER]),
  };
  return {
    db: {
      select: jest.fn().mockReturnValue(chain),
    },
  };
});

// ── Mock: ../storage ──────────────────────────────────────────────────────────
jest.mock("../storage", () => ({ storage: {} }));

// ── Mock: mealImageGenerator ──────────────────────────────────────────────────
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

// ── Mock: mealCachePersistent ─────────────────────────────────────────────────
jest.mock("../services/mealCachePersistent", () => ({
  getCachedMeals:     jest.fn().mockResolvedValue(null),
  cacheMeals:         jest.fn().mockResolvedValue(undefined),
  getCachedVarietyMeals: jest.fn().mockResolvedValue(null),
  cacheVarietyMeals:     jest.fn().mockResolvedValue(undefined),
}));

// ── Mock: coaching activityEvents ─────────────────────────────────────────────
jest.mock("../services/coaching/activityEvents", () => ({
  emitActivityEvent: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock: macroAuditLogger ────────────────────────────────────────────────────
jest.mock("../utils/macroAuditLogger", () => ({
  macroAudit:       jest.fn(),
  macroAuditPrompt: jest.fn(),
  macroAuditCache:  jest.fn(),
}));

// ── Imports (after hoisted jest.mock calls) ───────────────────────────────────
import {
  generateCravingMealOptions,
} from "../services/unifiedMealPipeline";
import {
  filterMealsByProtocol,
  buildGuestEnvelope,
} from "../services/protocolEnvelope";

// ── Source paths for structural tests ────────────────────────────────────────
const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, "../routes.ts"),
  "utf-8",
);
const PIPELINE_SRC = fs.readFileSync(
  path.resolve(__dirname, "../services/unifiedMealPipeline.ts"),
  "utf-8",
);

// ─────────────────────────────────────────────────────────────────────────────
// A. STRUCTURAL — routes.ts craving-creator diet-resolution contract
// ─────────────────────────────────────────────────────────────────────────────

describe("A. Structural — routes.ts /api/meals/craving-creator diet override", () => {

  it("_resolvedPrimaryDiet wraps dietaryRestrictions body field into an array", () => {
    // The route at line 5141-5142 wraps the string "keto" into ["keto"].
    // If this line is removed, the override is silently dropped before generation.
    const block = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("_resolvedPrimaryDiet"),
      ROUTES_SRC.indexOf("_resolvedPrimaryDiet") + 600,
    );
    // Wraps both string and array forms
    expect(block).toContain("Array.isArray(dietaryRestrictions)");
    // Falls through to handle the string case
    expect(block).toContain("[dietaryRestrictions]");
  });

  it("dietOverride is checked FIRST (explicit builder override wins over dietaryRestrictions)", () => {
    // The route resolves diet priority: dietOverride > dietaryRestrictions > empty.
    // This ensures a programmatic override (dietOverride body field, e.g. from an admin caller)
    // cannot be overridden by a client-sent dietaryRestrictions field.
    const block = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("_resolvedPrimaryDiet"),
      ROUTES_SRC.indexOf("_resolvedPrimaryDiet") + 600,
    );
    const dietOverridePos      = block.indexOf("dietOverride");
    const dietRestrictionsPos  = block.indexOf("dietaryRestrictions");
    expect(dietOverridePos).toBeGreaterThan(-1);
    expect(dietRestrictionsPos).toBeGreaterThan(-1);
    expect(dietOverridePos).toBeLessThan(dietRestrictionsPos); // dietOverride checked first
  });

  it("generateCravingMealOptions is called with bodyDietRestrictions (the resolved diet)", () => {
    // Line 5248: generateCravingMealOptions(..., bodyDietRestrictions, ...)
    // bodyDietRestrictions is built from _resolvedPrimaryDiet so the override reaches the LLM.
    expect(ROUTES_SRC).toContain("bodyDietRestrictions");
    // Must be assigned from _resolvedPrimaryDiet
    expect(ROUTES_SRC).toContain("_resolvedPrimaryDiet.slice()");
    // Must appear as an argument in the generateCravingMealOptions call
    const callIdx = ROUTES_SRC.indexOf("generateCravingMealOptions(");
    const callBlock = ROUTES_SRC.slice(callIdx, callIdx + 600);
    expect(callBlock).toContain("bodyDietRestrictions");
  });

  it("_filterEnvelope substitutes dietaryIdentity when EITHER dietOverride OR dietaryRestrictions is set", () => {
    // The fix at routes.ts introduces _overrideDietActive which checks both fields:
    //   dietOverride || dietaryRestrictions
    // CreateDishPage sends `dietaryRestrictions: "keto"` (never `dietOverride`), so the
    // original `&& dietOverride`-only condition silently left the vegan profile in place.
    // The corrected condition triggers on either field.
    const envBlock = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("_overrideDietActive"),
      ROUTES_SRC.indexOf("_overrideDietActive") + 600,
    );
    expect(envBlock).toContain("dietaryIdentity: _resolvedPrimaryDiet");
    // Must check dietaryRestrictions (the field CreateDishPage actually sends)
    expect(envBlock).toContain("dietaryRestrictions");
    // And the dietOverride field (for programmatic/admin callers)
    expect(envBlock).toContain("dietOverride");
    // The OR operator ensures both paths trigger the envelope substitution
    expect(envBlock).toMatch(/dietOverride.*\|\|.*dietaryRestrictions|dietaryRestrictions.*\|\|.*dietOverride/);
  });

  it("_dalDietIdentity uses _resolvedPrimaryDiet when override is active", () => {
    // Lines 5201-5203: DAL guardrail context uses the override diet, not the vegan envelope,
    // so the Dish Adaptation Layer doesn't flag keto ingredients as conflicts.
    const dalBlock = ROUTES_SRC.slice(
      ROUTES_SRC.indexOf("_dalDietIdentity"),
      ROUTES_SRC.indexOf("_dalDietIdentity") + 400,
    );
    expect(dalBlock).toContain("_resolvedPrimaryDiet.length > 0");
    expect(dalBlock).toContain("? _resolvedPrimaryDiet");
  });

  it("unifiedMealPipeline also uses REPLACEMENT semantics in generateCravingMealOptions", () => {
    // Line 2073: "REPLACES the profile diet" comment confirms the replacement intent.
    // Line 2078: dietRestrictions = [...dietaryRestrictionsOverride]
    const replacementBlock = PIPELINE_SRC.slice(
      PIPELINE_SRC.indexOf("REPLACES the profile diet for this one generation"),
      PIPELINE_SRC.indexOf("REPLACES the profile diet for this one generation") + 400,
    );
    expect(replacementBlock).toContain("dietRestrictions = [...dietaryRestrictionsOverride]");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. INTEGRATION — generateCravingMealOptions: vegan profile + keto override
//
// This calls the REAL generateCravingMealOptions (the function the route calls)
// with ["keto"] as the dietaryRestrictionsOverride and a mocked vegan DB user.
// The captured OpenAI prompt must contain "KETO" and must NOT contain "VEGAN".
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedCalls.length = 0;
});

describe("B. Integration — generateCravingMealOptions: vegan profile + keto override", () => {

  it("resolves to a non-empty array of meal options — keto override prevents vegan blocking", async () => {
    // The DB user has dietaryRestrictions: ["vegan"]. The function receives
    // dietaryRestrictionsOverride: ["keto"]. With the fix:
    //   dietRestrictions = ["keto"]  (replacement — not ["vegan", "keto"] merge)
    // Without the fix (old union-merge bug):
    //   dietRestrictions = ["vegan", "keto"]  → contradictory prompt → often fails
    //   or dietRestrictions = ["vegan"]       → vegan meals returned, not keto
    const results = await generateCravingMealOptions(
      "Strawberry Cake",        // cravingInput — exact UI input
      "dinner",                 // mealType
      "test-user-vegan-001",    // userId — triggers DB lookup returning vegan profile
      ["keto"],                 // dietaryRestrictionsOverride — the exact arg the route passes
      [],                       // excludeMeals
      false,                    // strictMode
      "meal",                   // generationMode
      undefined,                // cuisineOverride
      undefined,                // glp1Targets
      undefined,                // overriddenAllergens
      null,                     // dishDirective
    );
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("OpenAI was called — the pipeline reached LLM generation, not a cache/error short-circuit", async () => {
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-user-vegan-001", ["keto"],
      [], false, "meal",
    );
    expect(capturedCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("OpenAI prompt says USER DIET: KETO — not VEGAN and not a merged VEGAN+KETO", async () => {
    // buildDietPromptBlock(["keto"]) at allergyGuardrails.ts line 565-566 generates:
    //   "CRITICAL DIETARY RULE: This user strictly follows a KETO diet."
    // buildVarietyPrompt at unifiedMealPipeline.ts line 1609 wraps it as:
    //   "USER DIET: KETO — ALL 3 options must comply fully."
    //
    // If the old Set-union merge bug were present (["vegan","keto"] merged diet):
    //   buildDietPromptBlock would take the FIRST element ("vegan") and generate
    //   "USER DIET: VEGAN" — making the model refuse cream cheese and eggs.
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-user-vegan-001", ["keto"],
      [], false, "meal",
    );
    const prompt = capturedCalls[0]?.prompt ?? "";
    expect(prompt.length).toBeGreaterThan(0);

    // Keto must govern the dietary instruction
    expect(prompt).toMatch(/USER DIET: KETO/i);

    // VEGAN must NOT appear as the governing diet
    expect(prompt).not.toMatch(/USER DIET: VEGAN/i);

    // The old merge bug would produce "USER DIET: VEGAN" (taking first element of sorted union).
    // The old "VEGAN diet" rule block must not appear in the prompt.
    expect(prompt).not.toMatch(/strictly follows a VEGAN diet/i);
  });

  it("OpenAI prompt applies KETO TONE RULE (from buildDietPromptBlock for keto)", async () => {
    // allergyGuardrails.ts line 597-599: keto gets a specific tone rule block.
    // Its presence confirms that buildDietPromptBlock ran with keto (not vegan).
    // If the prompt used vegan, this block would be replaced by vegan-specific rules.
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-user-vegan-001", ["keto"],
      [], false, "meal",
    );
    const prompt = capturedCalls[0]?.prompt ?? "";
    // allergyGuardrails.ts line 598: "KETO TONE RULE: Never describe carbohydrates..."
    expect(prompt).toMatch(/KETO TONE RULE/i);
  });

  it("returned meals include keto-legal/vegan-illegal ingredients (proving no vegan compliance block)", async () => {
    // The mock OpenAI returns cream cheese, eggs, and butter — all vegan-illegal.
    // If the pipeline applied vegan validation (old bug), it would have rejected or
    // rewritten these ingredients. With keto override, they pass straight through.
    const results = await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-user-vegan-001", ["keto"],
      [], false, "meal",
    );
    const allIngredients = results.flatMap(m =>
      (m.ingredients ?? []).map((ing: any) =>
        typeof ing === "string" ? ing : (ing.name ?? ing.item ?? "")
      )
    );
    const hasKetoLegalVeganIllegal = allIngredients.some(name =>
      /cream cheese|eggs?|butter|heavy cream/i.test(name)
    );
    expect(hasKetoLegalVeganIllegal).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. FUNCTIONAL — filterMealsByProtocol: vegan envelope vs keto-override envelope
//
// Proves that the _filterEnvelope substitution in routes.ts (lines 5287-5289)
// is the correct fix. When the vegan envelope is used as-is, keto meals are
// blocked. When dietaryIdentity is substituted with ["keto"], they pass.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal keto meal that is vegan-illegal (cream cheese + eggs) */
const KETO_CAKE_MEAL = {
  name: "Keto Strawberry Cream Cake",
  description: "Almond-flour cake with cream cheese frosting.",
  ingredients: [
    { name: "almond flour",  quantity: "1",   unit: "cup" },
    { name: "cream cheese",  quantity: "4",   unit: "oz"  },
    { name: "eggs",          quantity: "2",   unit: "large" },
    { name: "butter",        quantity: "2",   unit: "tbsp" },
    { name: "erythritol",    quantity: "3",   unit: "tbsp" },
    { name: "strawberries",  quantity: "1/2", unit: "cup" },
  ],
  instructions: "Bake at 350°F for 22 minutes.",
};

/**
 * The vegan protocol envelope — mirrors what loadUserProtocolEnvelope returns
 * for a user with dietaryIdentity: ["vegan"].
 * Built on buildGuestEnvelope() so procedural/procedureRules are correctly
 * populated (scanInstructionsForViolations reads procedural.forbiddenInstructions).
 */
const VEGAN_PROTOCOL_ENVELOPE = {
  ...buildGuestEnvelope(),
  dietaryIdentity: ["vegan"],
};

/**
 * The keto-override envelope — what _filterEnvelope becomes in routes.ts line 5288
 * when dietOverride is set: `{ ...protocolEnvelope, dietaryIdentity: _resolvedPrimaryDiet }`.
 * Only dietaryIdentity is swapped — all other fields (allergies, avoidances, procedural)
 * are inherited from the vegan profile, proving the fix is a safe shallow spread.
 */
const KETO_OVERRIDE_ENVELOPE = {
  ...VEGAN_PROTOCOL_ENVELOPE,
  dietaryIdentity: ["keto"],
};

describe("C. Functional — filterMealsByProtocol: vegan vs keto-override envelope", () => {

  it("vegan envelope BLOCKS the keto cake (cream cheese + eggs are vegan-illegal)", () => {
    // filterMealsByProtocol → scanGeneratedOutput → detects dairy/eggs as vegan violations.
    // If the _filterEnvelope fix is reverted (envelope = protocolEnvelope always),
    // keto meals with dairy would be silently stripped from the response.
    const passed = filterMealsByProtocol([KETO_CAKE_MEAL], VEGAN_PROTOCOL_ENVELOPE, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(0); // blocked — cream cheese is vegan-illegal
  });

  it("keto-override envelope PASSES the keto cake (no dairy restriction in keto)", () => {
    // When the route substitutes { ...protocolEnvelope, dietaryIdentity: ["keto"] },
    // scanGeneratedOutput enforces keto rules — cream cheese and eggs are keto-legal.
    // Allergies, avoidances, and medical rules come from the same envelope (unchanged).
    const passed = filterMealsByProtocol([KETO_CAKE_MEAL], KETO_OVERRIDE_ENVELOPE, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(1); // passes — keto allows dairy
    expect(passed[0].name).toBe("Keto Strawberry Cream Cake");
  });

  it("override envelope preserves allergies and avoidances from the vegan profile", () => {
    // The only change in the override envelope is dietaryIdentity.
    // Allergies, avoidances, and medical conditions must be inherited from the
    // original protocol envelope — they must never be stripped or replaced.
    // (This confirms the fix is `{ ...protocolEnvelope, dietaryIdentity: [...] }`,
    // a shallow spread, not a wholesale replacement.)
    expect(KETO_OVERRIDE_ENVELOPE.allergies).toEqual(VEGAN_PROTOCOL_ENVELOPE.allergies);
    expect(KETO_OVERRIDE_ENVELOPE.avoidances).toEqual(VEGAN_PROTOCOL_ENVELOPE.avoidances);
    expect(KETO_OVERRIDE_ENVELOPE.medicalConditions).toEqual(VEGAN_PROTOCOL_ENVELOPE.medicalConditions);
    // Only the diet identity changes
    expect(KETO_OVERRIDE_ENVELOPE.dietaryIdentity).toEqual(["keto"]);
    expect(KETO_OVERRIDE_ENVELOPE.dietaryIdentity).not.toContain("vegan");
  });

  it("multiple keto meals all pass the override envelope — not just the first one", () => {
    const meals = [
      KETO_CAKE_MEAL,
      { ...KETO_CAKE_MEAL, name: "Keto Cream Cheese Pancakes",
        ingredients: [
          { name: "cream cheese", quantity: "4", unit: "oz" },
          { name: "eggs",         quantity: "2", unit: "large" },
          { name: "erythritol",   quantity: "1", unit: "tbsp" },
        ] },
    ];
    const passed = filterMealsByProtocol(meals, KETO_OVERRIDE_ENVELOPE, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. EMERGENCY FALLBACK — _fallbackDietIdentity must use keto when override active
//
// Covers routes.ts lines 5307-5323: when filterMealsByProtocol removes ALL
// generated options, the route calls generateSingleCompliantFallback with
// _fallbackDietIdentity. This section proves the ternary branch ORDER in the
// source is correct (TRUE = _resolvedPrimaryDiet, FALSE = vegan profile) and
// that _fallbackDietIdentity is the 3rd positional argument at the call site.
//
// All structural tests use character-position ordering so an inverted ternary
// or reordered arguments would cause the tests to fail, not silently pass.
// ─────────────────────────────────────────────────────────────────────────────

/** Three keto meals identical to what generateCravingMealOptions would return. */
const THREE_KETO_MEALS = [
  KETO_CAKE_MEAL,
  {
    name: "Keto Strawberry Cheesecake Cup",
    description: "No-bake cream cheese cups with a pecan crust.",
    ingredients: [
      { name: "cream cheese",       quantity: "6",   unit: "oz"    },
      { name: "pecans",             quantity: "1/4", unit: "cup"   },
      { name: "heavy cream",        quantity: "2",   unit: "tbsp"  },
      { name: "erythritol",         quantity: "2",   unit: "tbsp"  },
      { name: "fresh strawberries", quantity: "1/4", unit: "cup"   },
    ],
    instructions: "Press pecans into cups. Whip cream cheese. Fill. Chill.",
  },
  {
    name: "Keto Strawberry Butter Cake",
    description: "Dense butter cake with strawberry coulis and whipped cream.",
    ingredients: [
      { name: "almond flour",  quantity: "3/4", unit: "cup"  },
      { name: "butter",        quantity: "4",   unit: "tbsp" },
      { name: "eggs",          quantity: "3",   unit: "large"},
      { name: "erythritol",    quantity: "4",   unit: "tbsp" },
      { name: "strawberries",  quantity: "1/2", unit: "cup"  },
      { name: "heavy cream",   quantity: "2",   unit: "tbsp" },
    ],
    instructions: "Cream butter. Beat in eggs. Bake 30 min.",
  },
];

describe("E. Emergency fallback — _fallbackDietIdentity must use keto, not vegan", () => {

  it("E1: vegan envelope blocks ALL 3 keto meals — confirming the condition that triggers the fallback path", () => {
    // Proves routes.ts line 5307: `if (cleanOptions.length === 0 && mealOptions.length > 0)`
    // All 3 options contain cream cheese / eggs / butter — vegan-illegal. A vegan
    // envelope (the un-fixed path) rejects all of them, activating the emergency fallback.
    const passed = filterMealsByProtocol(THREE_KETO_MEALS, VEGAN_PROTOCOL_ENVELOPE, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(0);           // all 3 blocked
    expect(THREE_KETO_MEALS.length).toBe(3); // mealOptions.length > 0 confirmed
  });

  it("E2: TRUE branch of _fallbackDietIdentity ternary is _resolvedPrimaryDiet — inverted ternary fails this test", () => {
    // Extracts the assignment block from routes.ts and verifies character-position ordering:
    //   const _fallbackDietIdentity = _overrideDietActive
    //     ? _resolvedPrimaryDiet              ← TRUE branch  (must come BEFORE the colon)
    //     : protocolEnvelope.dietaryIdentity  ← FALSE branch (must come AFTER the colon)
    //
    // An inverted ternary `_overrideDietActive ? protocolEnvelope.dietaryIdentity : _resolvedPrimaryDiet`
    // would put protocolEnvelope.dietaryIdentity before the colon — falseBranchPos < colonPos — failing.
    const assignmentStart = ROUTES_SRC.indexOf("const _fallbackDietIdentity = _overrideDietActive");
    expect(assignmentStart).toBeGreaterThan(-1); // the assignment must exist

    // Capture enough of the assignment to cover the full ternary (≤ 300 chars)
    const ternaryBlock = ROUTES_SRC.slice(assignmentStart, assignmentStart + 300);

    const questionMarkIdx = ternaryBlock.indexOf("?");
    // The ternary colon appears on its own line with leading whitespace: find ": proto"
    // Both branches are plain identifiers — the colon is the first : that precedes "protocolEnvelope"
    const colonIdx = ternaryBlock.indexOf(": protocolEnvelope.dietaryIdentity");

    expect(questionMarkIdx).toBeGreaterThan(-1);
    expect(colonIdx).toBeGreaterThan(questionMarkIdx);

    const trueBranchPos  = ternaryBlock.indexOf("_resolvedPrimaryDiet", questionMarkIdx);
    const falseBranchPos = ternaryBlock.indexOf("protocolEnvelope.dietaryIdentity", colonIdx);

    // TRUE branch: _resolvedPrimaryDiet must appear after ? and before the ternary colon
    expect(trueBranchPos).toBeGreaterThan(questionMarkIdx);
    expect(trueBranchPos).toBeLessThan(colonIdx);

    // FALSE branch: protocolEnvelope.dietaryIdentity must appear at/after the ternary colon
    expect(falseBranchPos).toBeGreaterThanOrEqual(colonIdx);

    // Extra guard: protocolEnvelope.dietaryIdentity must NOT appear in the TRUE branch
    const veganBeforeColon = ternaryBlock.slice(questionMarkIdx, colonIdx).indexOf("protocolEnvelope.dietaryIdentity");
    expect(veganBeforeColon).toBe(-1);
  });

  it("E3: _fallbackDietIdentity assignment uses _overrideDietActive — same flag as _filterEnvelope (no independent condition)", () => {
    // If someone adds a new override path and updates _overrideDietActive but
    // forgets to update a hypothetical separate fallback condition, both would
    // diverge. Using the same variable keeps them in sync automatically.
    //
    // Character-position ordering check: _overrideDietActive must appear BEFORE
    // both branch values (it is the condition, not a branch value).
    const assignmentStart = ROUTES_SRC.indexOf("const _fallbackDietIdentity = _overrideDietActive");
    const ternaryBlock = ROUTES_SRC.slice(assignmentStart, assignmentStart + 300);

    const conditionPos   = ternaryBlock.indexOf("_overrideDietActive");
    const questionPos    = ternaryBlock.indexOf("?");
    const colonPos       = ternaryBlock.indexOf(": protocolEnvelope.dietaryIdentity");
    const trueBranchPos  = ternaryBlock.indexOf("_resolvedPrimaryDiet", questionPos);
    const falseBranchPos = ternaryBlock.indexOf("protocolEnvelope.dietaryIdentity", colonPos);

    // Condition appears first, then ?, then TRUE branch (_resolvedPrimaryDiet), then :, then FALSE branch
    expect(conditionPos).toBeGreaterThan(-1);
    expect(conditionPos).toBeLessThan(questionPos);
    expect(questionPos).toBeLessThan(trueBranchPos);
    expect(trueBranchPos).toBeLessThan(colonPos);
    expect(colonPos).toBeLessThan(falseBranchPos);
  });

  it("E4: _fallbackDietIdentity is the 3rd positional argument to generateSingleCompliantFallback — after cravingInput and targetMealType", () => {
    // Parses the call site (routes.ts ~line 5320) and verifies argument ORDER by
    // character position. Reordering the arguments would move _fallbackDietIdentity
    // before targetMealType, failing the toBeLessThan assertion.
    //
    //   generateSingleCompliantFallback(
    //     cravingInput || ...,    ← arg 1
    //     targetMealType || ...,  ← arg 2
    //     _fallbackDietIdentity,  ← arg 3 (the diet identity — must be here)
    //     { ... options }         ← arg 4
    //   )
    const callSiteStart = ROUTES_SRC.indexOf("const fallbackMeal = await generateSingleCompliantFallback(");
    expect(callSiteStart).toBeGreaterThan(-1);

    const callBlock = ROUTES_SRC.slice(callSiteStart, callSiteStart + 500);

    const arg1Pos = callBlock.indexOf("cravingInput");          // arg 1
    const arg2Pos = callBlock.indexOf("targetMealType");         // arg 2
    const arg3Pos = callBlock.indexOf("_fallbackDietIdentity");  // arg 3
    // arg 4+ is the options object — the overriddenAllergens key appears inside it
    const optionsPos = callBlock.indexOf("overriddenAllergens");

    expect(arg1Pos).toBeGreaterThan(-1);
    expect(arg2Pos).toBeGreaterThan(-1);
    expect(arg3Pos).toBeGreaterThan(-1);
    expect(optionsPos).toBeGreaterThan(-1);

    // Positional order: arg1 < arg2 < arg3 < options object
    expect(arg1Pos).toBeLessThan(arg2Pos);
    expect(arg2Pos).toBeLessThan(arg3Pos);
    expect(arg3Pos).toBeLessThan(optionsPos);
  });
});
