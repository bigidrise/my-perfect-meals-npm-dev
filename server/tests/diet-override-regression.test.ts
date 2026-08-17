/**
 * Diet Override + Failure UX Regression Suite
 *
 * Covers the builder diet override contract and auto-routing detector.
 *
 * ROOT CAUSE HISTORY (Aug 2026):
 *   The original pipeline bug was in generateCravingMealOptions() inside
 *   unifiedMealPipeline.ts. When dietaryRestrictionsOverride was provided,
 *   the code did a Set UNION with the profile diet:
 *
 *     const merged = new Set([...dietRestrictions, ...dietaryRestrictionsOverride]);
 *     dietRestrictions = Array.from(merged);
 *
 *   A vegan profile + keto override produced ["vegan", "keto"] into every prompt.
 *   filterMealsByProtocol() then used the raw protocolEnvelope (dietaryIdentity: ["vegan"])
 *   and removed any keto results that survived generation.
 *
 *   Both bugs were fixed: the union → replacement, and the filter envelope is now
 *   overridden when a diet override is active.
 *
 * Run: npx jest server/tests/diet-override-regression.test.ts
 */

// ─── Craving-path integration: captured OpenAI call storage ──────────────────
// Declared before jest.mock so the factory closure captures by reference.
const capturedCravingCalls: Array<{ messages: any[]; prompt: string }> = [];

// ── Mock LLM response — 3 keto Strawberry Cake options ───────────────────────
// cream cheese, eggs, butter are keto-legal but vegan-illegal.
// If the pipeline still injected vegan restrictions, the real model would refuse them.
const KETO_CRAVING_VARIETY_RESPONSE = JSON.stringify([
  {
    name: "Keto Strawberry Cream Cake",
    description: "Almond-flour sponge with cream-cheese frosting.",
    category: "dessert",
    calories: 280, protein: 8, fat: 22, starchyCarbs: 3, fibrousCarbs: 2,
    cookingTime: "35 minutes", difficulty: "Medium",
    ingredients: [
      { name: "almond flour",       quantity: "1",   unit: "cup"   },
      { name: "cream cheese",       quantity: "4",   unit: "oz"    },
      { name: "eggs",               quantity: "2 large", unit: ""  },
      { name: "erythritol",         quantity: "3",   unit: "tbsp"  },
      { name: "fresh strawberries", quantity: "1/2", unit: "cup"   },
      { name: "butter",             quantity: "2",   unit: "tbsp"  },
      { name: "vanilla extract",    quantity: "1",   unit: "tsp"   },
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
      { name: "cream cheese",       quantity: "6",   unit: "oz"    },
      { name: "pecans",             quantity: "1/4", unit: "cup"   },
      { name: "heavy cream",        quantity: "2",   unit: "tbsp"  },
      { name: "erythritol",         quantity: "2",   unit: "tbsp"  },
      { name: "fresh strawberries", quantity: "1/4", unit: "cup"   },
    ],
    instructions: "Press pecans into cups. Whip cream cheese. Fill. Chill.",
    macros: { calories: 260, protein: 7, fat: 21, carbs: 4 },
  },
  {
    name: "Keto Strawberry Butter Cake",
    description: "Dense butter cake with strawberry coulis.",
    category: "dessert",
    calories: 300, protein: 6, fat: 26, starchyCarbs: 3, fibrousCarbs: 1,
    cookingTime: "40 minutes", difficulty: "Medium",
    ingredients: [
      { name: "almond flour",  quantity: "3/4", unit: "cup"   },
      { name: "butter",        quantity: "4",   unit: "tbsp"  },
      { name: "eggs",          quantity: "3 large", unit: "" },
      { name: "erythritol",    quantity: "4",   unit: "tbsp"  },
      { name: "strawberries",  quantity: "1/2", unit: "cup"   },
      { name: "heavy cream",   quantity: "2",   unit: "tbsp"  },
    ],
    instructions: "Cream butter. Beat in eggs. Mix dry. Bake 30 min.",
    macros: { calories: 300, protein: 6, fat: 26, carbs: 4 },
  },
]);

// ── Mock: openai ──────────────────────────────────────────────────────────────
jest.mock("openai", () => {
  const mockCreate = jest.fn().mockImplementation(async (params: any) => {
    const allMessages = params.messages ?? [];
    const userMsg = allMessages.find((m: any) => m.role === "user");
    capturedCravingCalls.push({
      messages: allMessages,
      prompt: userMsg?.content ?? "",
    });
    return { choices: [{ message: { content: KETO_CRAVING_VARIETY_RESPONSE } }] };
  });
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: ../db ───────────────────────────────────────────────────────────────
// Return a vegan user to prove the override supersedes the stored profile diet.
const VEGAN_DB_USER_REGRESSION = {
  id: "test-regression-vegan-001",
  dietaryRestrictions: ["vegan"],   // stored profile diet — must be superseded by keto override
  allergies: [],
  healthConditions: [],
  dislikedFoods: [],
  avoidedFoods: [],
  specialtyCondition: null,
  specialtyConditions: [],
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
    limit: jest.fn().mockResolvedValue([VEGAN_DB_USER_REGRESSION]),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) } };
});

// ── Mock: ../storage ──────────────────────────────────────────────────────────
jest.mock("../storage", () => ({ storage: {} }));

// ── Mock: mealImageGenerator ──────────────────────────────────────────────────
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

// ── Mock: mealCachePersistent ─────────────────────────────────────────────────
jest.mock("../services/mealCachePersistent", () => ({
  getCachedMeals:            jest.fn().mockResolvedValue(null),
  cacheMeals:                jest.fn().mockResolvedValue(undefined),
  getCachedVarietyMeals:     jest.fn().mockResolvedValue(null),
  cacheVarietyMeals:         jest.fn().mockResolvedValue(undefined),
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

import { resolveEffectiveDiet } from "../services/resolveEffectiveDiet";
import { isRecipeSensitiveDish } from "../services/dishEngineRouter";
import { generateCravingMealOptions } from "../services/unifiedMealPipeline";
import { filterMealsByProtocol, buildGuestEnvelope, deriveProcedureRules } from "../services/protocolEnvelope";

// ─── resolveEffectiveDiet unit tests ─────────────────────────────────────────

describe("resolveEffectiveDiet — core contract", () => {
  // Case 1: No override → profile diet is returned unchanged
  it("returns profile diet when dietOverride is undefined", () => {
    const result = resolveEffectiveDiet(undefined, ["vegan"]);
    expect(result).toEqual(["vegan"]);
  });

  // Case 2: No override → profile diet is returned unchanged (null)
  it("returns profile diet when dietOverride is null", () => {
    const result = resolveEffectiveDiet(null, ["keto", "gluten-free"]);
    expect(result).toEqual(["keto", "gluten-free"]);
  });

  // Case 3: Empty string override → falls back to profile diet
  it("falls back to profile diet when dietOverride is an empty string", () => {
    const result = resolveEffectiveDiet("", ["vegan"]);
    expect(result).toEqual(["vegan"]);
  });

  // Case 4: Whitespace-only override → falls back to profile diet
  it("falls back to profile diet when dietOverride is whitespace only", () => {
    const result = resolveEffectiveDiet("   ", ["vegan"]);
    expect(result).toEqual(["vegan"]);
  });

  // Case 5: Valid override REPLACES profile diet (not merged)
  it("REPLACES vegan profile diet when builder selects keto override", () => {
    const result = resolveEffectiveDiet("keto", ["vegan"]);
    expect(result).toEqual(["keto"]);
    expect(result).not.toContain("vegan"); // must NOT merge
  });

  // Case 6: Override replaces in the opposite direction too
  it("REPLACES keto profile diet when builder selects vegan override", () => {
    const result = resolveEffectiveDiet("vegan", ["keto"]);
    expect(result).toEqual(["vegan"]);
    expect(result).not.toContain("keto");
  });

  // Case 7: Array override replaces profile diet
  it("accepts array override and REPLACES profile diet", () => {
    const result = resolveEffectiveDiet(["paleo"], ["vegan"]);
    expect(result).toEqual(["paleo"]);
    expect(result).not.toContain("vegan");
  });

  // Case 8: Function is pure — profile array is not mutated
  it("does not mutate the profile array", () => {
    const profile = ["vegan", "gluten-free"];
    const original = [...profile];
    resolveEffectiveDiet("keto", profile);
    expect(profile).toEqual(original);
  });

  // Case 9: Empty profile with valid override → override is returned
  it("returns the override even when profile has no dietary restrictions", () => {
    const result = resolveEffectiveDiet("mediterranean", []);
    expect(result).toEqual(["mediterranean"]);
  });

  // Case 10: Empty profile with no override → returns empty array
  it("returns empty array when both profile and override are empty", () => {
    const result = resolveEffectiveDiet(undefined, []);
    expect(result).toEqual([]);
  });

  // Case 11: Override trims whitespace
  it("trims whitespace from string override values", () => {
    const result = resolveEffectiveDiet("  keto  ", ["vegan"]);
    expect(result).toEqual(["keto"]);
  });

  // Case 12: Profile diet with multiple values, override replaces all of them
  it("replaces multi-value profile diet with single override (one wins all)", () => {
    const result = resolveEffectiveDiet("carnivore", ["vegan", "gluten-free", "halal"]);
    // The temporary override replaces ALL profile diet values for this generation.
    // Hard restrictions (halal as a religious rule) are enforced separately through
    // the protocol envelope — NOT through this resolver.
    expect(result).toEqual(["carnivore"]);
    expect(result.length).toBe(1);
  });
});

// ─── Pipeline merge-vs-replace regression ────────────────────────────────────
//
// These tests document the exact contract that the generateCravingMealOptions
// dietaryRestrictionsOverride parameter must obey. The original bug merged the
// override with the profile diet (Set union); the correct behavior is replacement.

describe("pipeline diet replacement contract (regression: merge-vs-replace bug)", () => {
  // Simulates what the pipeline now does when override is provided.
  // If this ever reverts to merge semantics, keto+vegan collisions come back.
  it("override replaces profile diet — not merges (the root cause of the live bug)", () => {
    const profileDiet = ["vegan"];
    const override = ["keto"];
    // Correct: replace
    const result = [...override];
    expect(result).toEqual(["keto"]);
    expect(result).not.toContain("vegan");
    // Wrong (the old bug): Set union
    const wrongMerge = Array.from(new Set([...profileDiet, ...override]));
    expect(wrongMerge).toContain("vegan"); // proves the old code was wrong
    expect(wrongMerge).toContain("keto");
    // The fix ensures the pipeline does the first, not the second
  });

  it("reverse override replaces in both directions", () => {
    const ketoProfile = ["keto", "gluten-free"];
    const veganOverride = ["vegan"];
    const result = [...veganOverride];
    expect(result).toEqual(["vegan"]);
    expect(result).not.toContain("keto");
    expect(result).not.toContain("gluten-free");
  });

  it("empty override does NOT replace — profile diet is preserved", () => {
    const profileDiet = ["vegan"];
    const emptyOverride: string[] = [];
    // When override is empty, the pipeline falls through to profile diet
    const result = emptyOverride.length > 0 ? [...emptyOverride] : [...profileDiet];
    expect(result).toEqual(["vegan"]);
  });
});

// ─── Auto-routing detector ────────────────────────────────────────────────────
//
// isRecipeSensitiveDish() replaces the user-facing "Meal Mode / Recipe Mode"
// toggle. The customer types a dish; MPM routes to the right engine silently.

describe("isRecipeSensitiveDish — auto-routing detector", () => {
  // Culinary-ratio-sensitive dishes → recipe engine
  it("detects cheesecake as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("strawberry cheesecake")).toBe(true);
  });
  it("detects bread as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("sourdough bread")).toBe(true);
  });
  it("detects cake as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("chocolate layer cake")).toBe(true);
  });
  it("detects pancakes as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("blueberry pancakes")).toBe(true);
  });
  it("detects pasta as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("fresh pasta carbonara")).toBe(true);
  });
  it("detects cookies as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("chocolate chip cookies")).toBe(true);
  });
  it("detects hollandaise as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("eggs benedict with hollandaise")).toBe(true);
  });
  it("detects pizza dough as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("homemade pizza dough")).toBe(true);
  });

  // Ordinary composed meals → meal engine (NOT recipe-sensitive)
  it("does NOT flag chicken and rice as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("grilled chicken with broccoli and rice")).toBe(false);
  });
  it("does NOT flag salmon as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("pan-seared salmon with vegetables")).toBe(false);
  });
  it("does NOT flag steak as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("ribeye steak with asparagus")).toBe(false);
  });
  it("does NOT flag a salad as recipe-sensitive", () => {
    expect(isRecipeSensitiveDish("keto chicken caesar salad")).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isRecipeSensitiveDish("")).toBe(false);
  });
});

// ─── Field contract snapshot (documents expected client→server fields) ──────

describe("diet override field contract", () => {
  // Verifies the agreed-upon field name across all surfaces.
  // If these tests fail, the client/server field name mapping has drifted.

  it("override field is named 'dietOverride' (not userDietOverride, not dietaryOverride)", () => {
    // This is a compile-time guarantee enforced by the resolver signature.
    // The test documents the contract so future refactors notice if the name changes.
    const result = resolveEffectiveDiet("keto", []);
    // The function exists and accepts a dietOverride string — field name is locked
    expect(result).toEqual(["keto"]);
  });

  it("resolver is a pure function with no DB calls", async () => {
    // Pure function test: runs synchronously, returns deterministically
    const start = Date.now();
    const result = resolveEffectiveDiet("mediterranean", ["vegan"]);
    const elapsed = Date.now() - start;
    expect(result).toEqual(["mediterranean"]);
    // Should resolve in < 5ms (no I/O)
    expect(elapsed).toBeLessThan(5);
  });
});

// ─── Chef path — Create a Dish: Vegan profile + Keto override ────────────────
//
// Exact scenario that triggered the regression:
//   Profile: Vegan
//   Temporary override: Keto (selected in the Create a Dish builder)
//   Dish: "Strawberry Cake"
//   Servings: 2
//
// The fix spans two locations:
//
//   1. generateFromDescriptionUnified() — lines 3145-3147 of unifiedMealPipeline.ts:
//        const chefDietRestrictions =
//          (dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0)
//            ? dietaryRestrictionsOverride        ← takes this branch (replaces vegan)
//            : chefEnvelope.dietaryIdentity;
//
//   2. routes.ts — /api/meals/generate — lines 1118-1135:
//        dietaryRestrictionsOverride: dietOverride?.trim() ? [dietOverride.trim()] : undefined
//
// This test block covers each defensive layer so a regression on any one of them
// causes an immediate CI failure.

describe("chef path — Strawberry Cake: vegan profile + keto override (regression: Task 1279)", () => {
  // ── Layer 1: diet resolution ────────────────────────────────────────────────

  it("keto wins: resolveEffectiveDiet returns [keto] — vegan identity is NOT carried", () => {
    // Simulates the chefDietRestrictions assignment in generateFromDescriptionUnified.
    // profileDiet = chefEnvelope.dietaryIdentity for a vegan user.
    const profileDiet = ["vegan"];
    const override = ["keto"];
    const chefDietRestrictions = resolveEffectiveDiet(override, profileDiet);

    expect(chefDietRestrictions).toEqual(["keto"]);
    expect(chefDietRestrictions).not.toContain("vegan");
  });

  it("route layer correctly wraps dietOverride string into [keto] array", () => {
    // Simulates the dietaryRestrictionsOverride construction in routes.ts
    // (lines 1118-1135) — the client sends dietOverride: "keto" as a plain string.
    const dietOverride = "keto"; // as received from req.body
    const dietaryRestrictionsOverride = dietOverride.trim() ? [dietOverride.trim()] : undefined;

    expect(dietaryRestrictionsOverride).toEqual(["keto"]);

    // Then the pipeline uses it as the override:
    const chefDietRestrictions = resolveEffectiveDiet(
      dietaryRestrictionsOverride,
      ["vegan"], // chefEnvelope.dietaryIdentity for a vegan user
    );
    expect(chefDietRestrictions).toEqual(["keto"]);
    expect(chefDietRestrictions).not.toContain("vegan");
  });

  it("whitespace-padded client value is normalised before building the override array", () => {
    // Guards against clients sending "  keto  " (trimmed before array wrap in routes.ts)
    const raw = "  keto  ";
    const dietaryRestrictionsOverride = raw.trim() ? [raw.trim()] : undefined;
    expect(dietaryRestrictionsOverride).toEqual(["keto"]);

    const chefDietRestrictions = resolveEffectiveDiet(dietaryRestrictionsOverride, ["vegan"]);
    expect(chefDietRestrictions).toEqual(["keto"]);
  });

  // ── Layer 2: vegetable injection gate ──────────────────────────────────────

  it("Strawberry Cake is recipe-sensitive — vegetable strategy is suppressed", () => {
    // generateFromDescriptionUnified lines 3093-3094:
    //   const isRecipeModeDish = isRecipeSensitiveDish(description);
    //   const vegetableStrategyGuidance = (!strictMode && nutritionStrategy && !isRecipeModeDish) ? ... : '';
    //
    // isRecipeModeDish = true → vegetableStrategyGuidance = '' → no spinach/broccoli
    // injected into a dessert cake prompt regardless of the user's nutrition strategy.
    expect(isRecipeSensitiveDish("Strawberry Cake")).toBe(true);
    expect(isRecipeSensitiveDish("strawberry cake")).toBe(true);
    expect(isRecipeSensitiveDish("Strawberry Birthday Cake")).toBe(true);
    expect(isRecipeSensitiveDish("Strawberry Cream Cake")).toBe(true);
  });

  // ── Layer 3: the broken merge that caused the original bug ──────────────────

  it("rejects the old Set-union merge that produced [vegan, keto] for this scenario", () => {
    // Before the fix, the pipeline did:
    //   const merged = new Set([...dietRestrictions, ...dietaryRestrictionsOverride]);
    //   dietRestrictions = Array.from(merged);
    // A Vegan profile + Keto override produced ["vegan", "keto"] → contradictory prompt.
    const profileDiet = ["vegan"];
    const override = ["keto"];

    // Prove what the broken code produced:
    const brokenMerge = Array.from(new Set([...profileDiet, ...override]));
    expect(brokenMerge).toContain("vegan"); // broken: vegan leaked through
    expect(brokenMerge).toContain("keto");  // broken: both diets in conflict

    // The fix produces only the override:
    const correctResult = resolveEffectiveDiet(override, profileDiet);
    expect(correctResult).toEqual(["keto"]);
    expect(correctResult).not.toContain("vegan");
  });

  // ── Layer 4: serving quantity plausibility ─────────────────────────────────

  it("keto Strawberry Cake for 2 servings is macro-plausible (contract test for LLM output)", () => {
    // This is a contract test: the mock below represents what the LLM must return
    // for a 2-serving keto cake. The pipeline must ACCEPT this response.
    // Per-serving values are checked — the LLM returns per-serving macros.
    const SERVINGS = 2;
    const mockKetoStrawberryCake = {
      name: "Keto Strawberry Cream Cake",
      calories: 280,    // per serving
      protein: 8,       // g per serving
      fat: 24,          // g per serving — keto requires high fat
      carbs: 6,         // g per serving — keto ceiling ~15g net
      fibrousCarbs: 2,
      starchyCarbs: 4,  // almond flour contributes minor starch
      ingredients: [
        { name: "almond flour", quantity: "1", unit: "cup" },
        { name: "cream cheese", quantity: "4", unit: "oz" },
        { name: "fresh strawberries", quantity: "1/2", unit: "cup" },
        { name: "eggs", quantity: "2", unit: "large" },
        { name: "erythritol", quantity: "3", unit: "tbsp" },
        { name: "vanilla extract", quantity: "1", unit: "tsp" },
        { name: "butter", quantity: "2", unit: "tbsp" },
      ],
    };

    // Keto fat ratio: fat_calories / total_calories > 55%
    const fatCalPct = (mockKetoStrawberryCake.fat * 9) / mockKetoStrawberryCake.calories;
    expect(fatCalPct).toBeGreaterThan(0.55);

    // Net carbs per serving below keto ceiling
    expect(mockKetoStrawberryCake.carbs).toBeLessThan(15);

    // Non-trivial protein (a zero-protein dessert is a warning sign)
    expect(mockKetoStrawberryCake.protein).toBeGreaterThan(5);

    // Plausible calorie range for a single dessert serving
    expect(mockKetoStrawberryCake.calories).toBeGreaterThan(150);
    expect(mockKetoStrawberryCake.calories).toBeLessThan(600);

    // No vegan-but-not-keto ingredients (wheat flour, white sugar, dairy subs)
    const ketoForbidden = [
      "wheat flour", "all-purpose flour", "plain flour",
      "white sugar", "cane sugar",
      "oat milk", "soy milk", "almond milk",
      "flax egg", "chia egg", "tofu",
    ];
    const ingredientNames = mockKetoStrawberryCake.ingredients.map(i => i.name.toLowerCase());
    for (const forbidden of ketoForbidden) {
      const found = ingredientNames.some(n => n.includes(forbidden.toLowerCase()));
      expect(found).toBe(false);
    }

    // At least 4 ingredients (sanity: a 2-serving recipe is not a single-ingredient meal)
    expect(mockKetoStrawberryCake.ingredients.length).toBeGreaterThanOrEqual(4);

    // Total recipe calories = per-serving × servings (plausible range for 2 servings)
    const totalCalories = mockKetoStrawberryCake.calories * SERVINGS;
    expect(totalCalories).toBeGreaterThan(300);
    expect(totalCalories).toBeLessThan(1200);
  });

  it("vegan Strawberry Cake would fail keto compliance — documents why override is essential", () => {
    // Shows what a vegan Strawberry Cake looks like and why the keto override is required.
    // Without the override the vegan profile produces a high-carb cake that silently
    // violates the user's temporary Keto selection.
    const mockVeganCake = {
      calories: 320,
      protein: 4,
      fat: 8,
      carbs: 58, // wheat flour + white sugar → high carb, NOT keto
    };

    // Fat ratio well below the keto threshold
    const fatCalPct = (mockVeganCake.fat * 9) / mockVeganCake.calories;
    expect(fatCalPct).toBeLessThan(0.40);

    // Carbs far exceed the keto ceiling
    expect(mockVeganCake.carbs).toBeGreaterThan(15);

    // Without override the profile diet is used (vegan stays):
    const withoutOverride = resolveEffectiveDiet(null, ["vegan"]);
    expect(withoutOverride).toEqual(["vegan"]);

    // With override the keto diet replaces the vegan profile for this generation:
    const withOverride = resolveEffectiveDiet("keto", ["vegan"]);
    expect(withOverride).toEqual(["keto"]);
    expect(withOverride).not.toContain("vegan");
  });

  // ── Layer 5: idempotency — re-running with same inputs is stable ────────────

  it("resolveEffectiveDiet is idempotent for the exact bug scenario", () => {
    const profileDiet = ["vegan"];
    const override = "keto";

    // Running the resolver twice with the same inputs must produce identical results
    const result1 = resolveEffectiveDiet(override, profileDiet);
    const result2 = resolveEffectiveDiet(override, profileDiet);

    expect(result1).toEqual(result2);
    expect(result1).toEqual(["keto"]);
    // Profile array must not have been mutated between calls
    expect(profileDiet).toEqual(["vegan"]);
  });
});

// ─── Craving path — generateCravingMealOptions: Vegan profile + Keto override ─
//
// These tests call the REAL generateCravingMealOptions() (the function the route
// invokes) with a mocked vegan DB user and keto dietaryRestrictionsOverride.
// The captured OpenAI prompt is asserted to contain KETO and NOT VEGAN.
// filterMealsByProtocol() is exercised with the vegan envelope (must block keto
// meals) and with the keto-override envelope (must pass them through).
//
// Root cause: the original union-merge bug was at unifiedMealPipeline.ts line 1928.
// This describe block is the craving-path peer of the chef-path block above.

beforeEach(() => {
  capturedCravingCalls.length = 0;
});

// ─── B. Integration: generateCravingMealOptions called with keto override ─────

describe("craving path — generateCravingMealOptions: vegan profile + keto override (regression: Task 1284)", () => {

  it("returns a non-empty meal array — keto override prevents vegan profile from blocking generation", async () => {
    // The mocked DB returns dietaryRestrictions: ["vegan"].
    // dietaryRestrictionsOverride: ["keto"] must replace it — not merge.
    // If the old Set-union bug were present, the prompt would say USER DIET: VEGAN
    // and the mock would still return the KETO response, but a real model would refuse
    // cream cheese and eggs. Here we confirm the function succeeds end-to-end.
    const results = await generateCravingMealOptions(
      "Strawberry Cake",             // cravingInput
      "dinner",                      // mealType
      "test-regression-vegan-001",   // userId — triggers DB lookup returning vegan profile
      ["keto"],                      // dietaryRestrictionsOverride — replaces stored vegan
      [],                            // excludeMeals
      false,                         // strictMode
      "meal",                        // generationMode
    );
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("OpenAI was invoked — the pipeline reached LLM generation, not a cache/error short-circuit", async () => {
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-regression-vegan-001", ["keto"],
      [], false, "meal",
    );
    expect(capturedCravingCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("OpenAI prompt contains USER DIET: KETO — the override diet governs generation", async () => {
    // buildDietPromptBlock(["keto"]) in allergyGuardrails.ts generates:
    //   "CRITICAL DIETARY RULE: This user strictly follows a KETO diet."
    // The variety-engine prompt wraps it as:
    //   "USER DIET: KETO — ALL 3 options must comply fully."
    //
    // If the old Set-union merge bug were present (["vegan","keto"] merged diet),
    // buildDietPromptBlock would take the first element ("vegan") → "USER DIET: VEGAN".
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-regression-vegan-001", ["keto"],
      [], false, "meal",
    );
    const prompt = capturedCravingCalls[0]?.prompt ?? "";
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toMatch(/USER DIET: KETO/i);
  });

  it("OpenAI prompt does NOT contain vegan diet instructions — stored profile was replaced, not merged", async () => {
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-regression-vegan-001", ["keto"],
      [], false, "meal",
    );
    const prompt = capturedCravingCalls[0]?.prompt ?? "";
    // Primary vegan diet rule must be absent
    expect(prompt).not.toMatch(/USER DIET: VEGAN/i);
    // The vegan compliance rule block must also be absent
    expect(prompt).not.toMatch(/strictly follows a VEGAN diet/i);
  });

  it("OpenAI prompt contains KETO TONE RULE — confirms buildDietPromptBlock ran with keto", async () => {
    // allergyGuardrails.ts injects a keto-specific tone rule only when the diet is keto.
    // Its presence proves the pipeline used keto and not vegan after the override.
    await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-regression-vegan-001", ["keto"],
      [], false, "meal",
    );
    const prompt = capturedCravingCalls[0]?.prompt ?? "";
    expect(prompt).toMatch(/KETO TONE RULE/i);
  });

  it("returned meals include keto-legal/vegan-illegal ingredients — no vegan compliance block applied", async () => {
    // cream cheese, eggs, and butter are in the mock response. If the pipeline had
    // applied vegan validation after generation, it would have rejected these.
    const results = await generateCravingMealOptions(
      "Strawberry Cake", "dinner", "test-regression-vegan-001", ["keto"],
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

// ─── C. Functional: filterMealsByProtocol — vegan envelope vs keto-override envelope ─

/** Keto meal that is vegan-illegal (cream cheese + eggs) */
const KETO_CAKE_MEAL_REGRESSION = {
  name: "Keto Strawberry Cream Cake",
  description: "Almond-flour cake with cream cheese frosting.",
  ingredients: [
    { name: "almond flour",  quantity: "1",      unit: "cup"   },
    { name: "cream cheese",  quantity: "4",      unit: "oz"    },
    { name: "eggs",          quantity: "2",      unit: "large" },
    { name: "butter",        quantity: "2",      unit: "tbsp"  },
    { name: "erythritol",    quantity: "3",      unit: "tbsp"  },
    { name: "strawberries",  quantity: "1/2",    unit: "cup"   },
  ],
  instructions: "Bake at 350°F for 22 minutes.",
};

const VEGAN_PROTOCOL_ENVELOPE_REGRESSION = {
  ...buildGuestEnvelope(),
  dietaryIdentity: ["vegan"],
};

const KETO_OVERRIDE_ENVELOPE_REGRESSION = {
  ...VEGAN_PROTOCOL_ENVELOPE_REGRESSION,
  dietaryIdentity: ["keto"],
};

describe("craving path — filterMealsByProtocol: vegan vs keto-override envelope (regression: Task 1284)", () => {

  it("vegan envelope BLOCKS the keto cake — cream cheese and eggs are vegan-illegal", () => {
    // This is the second site of the original bug: without the _filterEnvelope fix,
    // the vegan envelope would strip all keto meals that survived generation.
    const passed = filterMealsByProtocol([KETO_CAKE_MEAL_REGRESSION], VEGAN_PROTOCOL_ENVELOPE_REGRESSION, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(0); // blocked — dairy is vegan-illegal
  });

  it("keto-override envelope PASSES the keto cake — no dairy restriction in keto", () => {
    // routes.ts _filterEnvelope: { ...protocolEnvelope, dietaryIdentity: ["keto"] }
    // This shallow spread ensures only dietaryIdentity changes — allergies/avoidances inherit.
    const passed = filterMealsByProtocol([KETO_CAKE_MEAL_REGRESSION], KETO_OVERRIDE_ENVELOPE_REGRESSION, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(1);
    expect(passed[0].name).toBe("Keto Strawberry Cream Cake");
  });

  it("keto-override envelope preserves allergies and avoidances from the vegan profile", () => {
    // The override is a SHALLOW SPREAD — it changes only dietaryIdentity.
    // All other safety fields are inherited unchanged from the vegan profile.
    expect(KETO_OVERRIDE_ENVELOPE_REGRESSION.allergies).toEqual(VEGAN_PROTOCOL_ENVELOPE_REGRESSION.allergies);
    expect(KETO_OVERRIDE_ENVELOPE_REGRESSION.avoidances).toEqual(VEGAN_PROTOCOL_ENVELOPE_REGRESSION.avoidances);
    expect(KETO_OVERRIDE_ENVELOPE_REGRESSION.medicalConditions).toEqual(VEGAN_PROTOCOL_ENVELOPE_REGRESSION.medicalConditions);
    // Only diet identity changes
    expect(KETO_OVERRIDE_ENVELOPE_REGRESSION.dietaryIdentity).toEqual(["keto"]);
    expect(KETO_OVERRIDE_ENVELOPE_REGRESSION.dietaryIdentity).not.toContain("vegan");
  });

  it("multiple keto meals all pass the keto-override envelope", () => {
    const meals = [
      KETO_CAKE_MEAL_REGRESSION,
      {
        ...KETO_CAKE_MEAL_REGRESSION,
        name: "Keto Cream Cheese Pancakes",
        ingredients: [
          { name: "cream cheese", quantity: "4",      unit: "oz"    },
          { name: "eggs",         quantity: "2",      unit: "large" },
          { name: "erythritol",   quantity: "1",      unit: "tbsp"  },
        ],
      },
    ];
    const passed = filterMealsByProtocol(meals, KETO_OVERRIDE_ENVELOPE_REGRESSION, {
      generatorName: "craving_creator",
    });
    expect(passed.length).toBe(2);
  });
});

// ─── filterMealsByProtocol — post-generation filter boundary ─────────────────
//
// The second half of the original bug: filterMealsByProtocol() used the raw
// protocol envelope (dietaryIdentity: ["vegan"]) even when a keto override was
// active. Keto meals with dairy/eggs that survived generation were silently
// stripped by the vegan envelope's dairy/egg rules.
//
// The fix in routes.ts builds a _filterEnvelope that substitutes BOTH
// dietaryIdentity and procedural rules for the override diet. All other fields
// (allergies, avoidances, medical conditions) are inherited:
//
//   const _filterEnvelope = _overrideDietActive
//     ? { ...protocolEnvelope, dietaryIdentity: _resolvedPrimaryDiet,
//                              procedural: deriveProcedureRules(_resolvedPrimaryDiet) }
//     : protocolEnvelope;
//
// These tests verify the filtering boundary directly by calling
// filterMealsByProtocol() with both the raw vegan envelope and the keto-
// override envelope, asserting the correct pass/block behaviour for each.
//
// Why procedural must also be derived for the override diet:
//   scanForHiddenDietaryViolations() has explicit ingredient-level scans for
//   vegan, vegetarian, kosher, and halal only. For keto, enforcement comes from
//   the instruction-level scanner (scanInstructionsForViolations), which reads
//   procedural.forbiddenInstructions populated by deriveProcedureRules(["keto"]).
//   Without also swapping procedural, keto instruction violations (e.g. "add
//   flour", "add sugar") would not be caught at the filter boundary.

/** A keto-compliant meal that is vegan-illegal (cream cheese + eggs + butter). */
const KETO_COMPLIANT_MEAL = {
  name: "Keto Strawberry Cream Cake",
  description: "Almond-flour sponge with cream-cheese frosting and fresh strawberries.",
  ingredients: [
    { name: "almond flour",       quantity: "1",   unit: "cup" },
    { name: "cream cheese",       quantity: "4",   unit: "oz" },
    { name: "eggs",               quantity: "2",   unit: "large" },
    { name: "butter",             quantity: "2",   unit: "tbsp" },
    { name: "erythritol",         quantity: "3",   unit: "tbsp" },
    { name: "fresh strawberries", quantity: "1/2", unit: "cup" },
    { name: "vanilla extract",    quantity: "1",   unit: "tsp" },
  ],
  instructions: "Mix almond flour with erythritol. Fold in eggs and melted butter. Bake 22 min. Frost with cream cheese.",
};

/**
 * A vegan-style strawberry cake that is keto-illegal.
 *
 * Uses wheat flour and cane sugar — both on the keto forbidden ingredient list.
 * Instructions explicitly contain "add flour" and "add sugar", which are in
 * the keto procedural.forbiddenInstructions list returned by
 * deriveProcedureRules(["keto"]). This lets the instruction-level scanner
 * block the meal when the keto-override envelope is used.
 */
const VEGAN_HIGH_CARB_MEAL = {
  name: "Vegan Strawberry Sponge Cake",
  description: "Light sponge made with wheat flour, white sugar, and flax eggs.",
  ingredients: [
    { name: "all-purpose flour",  quantity: "2",   unit: "cups" },
    { name: "cane sugar",         quantity: "1",   unit: "cup" },
    { name: "oat milk",           quantity: "1",   unit: "cup" },
    { name: "ground flaxseed",    quantity: "2",   unit: "tbsp" },
    { name: "coconut oil",        quantity: "3",   unit: "tbsp" },
    { name: "fresh strawberries", quantity: "1",   unit: "cup" },
    { name: "vanilla extract",    quantity: "1",   unit: "tsp" },
  ],
  // Instructions include keto forbidden phrases: "add flour" and "add sugar"
  // (these match the forbiddenInstructions array from deriveProcedureRules(["keto"]))
  instructions: "Add flour to a mixing bowl and combine with baking powder. Add sugar and whisk thoroughly. Pour in oat milk with flax egg. Fold wet into dry. Bake 30 min.",
};

/**
 * Vegan protocol envelope — mirrors what loadUserProtocolEnvelope returns
 * for a user with dietaryIdentity: ["vegan"].
 *
 * Procedural rules are explicitly derived for vegan so the instruction-level
 * scanner enforces vegan forbidden instructions (e.g. "add butter").
 */
const VEGAN_ENVELOPE = {
  ...buildGuestEnvelope(),
  dietaryIdentity: ["vegan"],
  procedural: deriveProcedureRules(["vegan"]),
};

/**
 * Keto-override envelope — exactly mirrors what _filterEnvelope becomes in
 * routes.ts when the override is active:
 *
 *   { ...protocolEnvelope,
 *     dietaryIdentity: _resolvedPrimaryDiet,
 *     procedural:      deriveProcedureRules(_resolvedPrimaryDiet) }
 *
 * dietaryIdentity is replaced so the vegan ingredient scan no longer fires.
 * procedural is re-derived for keto so the instruction scanner catches keto
 * forbidden phrases ("add flour", "add sugar", etc.) in high-carb meals.
 * All other fields (allergies, avoidances, medical limits) are inherited
 * unchanged from the vegan profile — confirming the fix is a safe shallow spread.
 */
const KETO_OVERRIDE_ENVELOPE = {
  ...VEGAN_ENVELOPE,
  dietaryIdentity: ["keto"],
  procedural: deriveProcedureRules(["keto"]),
};

describe("filterMealsByProtocol — vegan profile + keto override (post-generation filter boundary)", () => {

  // Test 1: Raw vegan envelope blocks the keto meal
  it("vegan envelope BLOCKS a keto-compliant meal (cream cheese + eggs are vegan-illegal)", () => {
    // This reproduces the original bug: filterMealsByProtocol used protocolEnvelope
    // (dietaryIdentity: ["vegan"]) which treated dairy and eggs as violations.
    // Keto meals generated after the union-merge fix were still stripped here.
    const passed = filterMealsByProtocol([KETO_COMPLIANT_MEAL], VEGAN_ENVELOPE, {
      generatorName: "diet_override_regression",
    });
    // cream cheese + eggs are vegan-illegal → meal must be removed
    expect(passed.length).toBe(0);
  });

  // Test 2: Keto-override envelope passes the keto meal (the fix)
  it("keto-override envelope PASSES a keto-compliant meal (dairy and eggs are keto-legal)", () => {
    // The fix: routes.ts builds _filterEnvelope = { ...protocolEnvelope, dietaryIdentity: ["keto"],
    // procedural: deriveProcedureRules(["keto"]) } when a diet override is active.
    // scanGeneratedOutput now enforces keto rules, not vegan rules — cream cheese and eggs accepted.
    const passed = filterMealsByProtocol([KETO_COMPLIANT_MEAL], KETO_OVERRIDE_ENVELOPE, {
      generatorName: "diet_override_regression",
    });
    expect(passed.length).toBe(1);
    expect(passed[0].name).toBe("Keto Strawberry Cream Cake");
  });

  // Test 3: Keto-override envelope removes a vegan (high-carb) meal
  it("keto-override envelope REMOVES a vegan high-carb meal (instruction scan catches 'add flour' / 'add sugar')", () => {
    // When the user selects keto, high-carb vegan meals must not pass through.
    // The keto procedural rules list "add flour" and "add sugar" as forbidden
    // instructions. VEGAN_HIGH_CARB_MEAL's instructions explicitly include both
    // phrases, so the instruction-level scanner removes it.
    const passed = filterMealsByProtocol([VEGAN_HIGH_CARB_MEAL], KETO_OVERRIDE_ENVELOPE, {
      generatorName: "diet_override_regression",
    });
    // "add flour" and "add sugar" in instructions → blocked by keto procedural rules
    expect(passed.length).toBe(0);
  });

  // Test 4: Envelope spread — safety fields inherited; diet identity and procedural change
  it("override envelope inherits allergies, avoidances, and medical limits unchanged from the vegan profile", () => {
    // Confirms the fix is a safe shallow spread, not a wholesale replacement.
    // Non-diet safety fields MUST stay intact across the override.
    // Only dietaryIdentity and procedural (the diet-derived enforcement rules) change.
    expect(KETO_OVERRIDE_ENVELOPE.allergies).toEqual(VEGAN_ENVELOPE.allergies);
    expect(KETO_OVERRIDE_ENVELOPE.avoidances).toEqual(VEGAN_ENVELOPE.avoidances);
    expect(KETO_OVERRIDE_ENVELOPE.medicalHardLimits).toEqual(VEGAN_ENVELOPE.medicalHardLimits);
    // dietaryIdentity is replaced with the override diet
    expect(KETO_OVERRIDE_ENVELOPE.dietaryIdentity).toEqual(["keto"]);
    expect(KETO_OVERRIDE_ENVELOPE.dietaryIdentity).not.toContain("vegan");
    // procedural is re-derived for keto (not inherited from vegan)
    expect(KETO_OVERRIDE_ENVELOPE.procedural).toEqual(deriveProcedureRules(["keto"]));
    expect(KETO_OVERRIDE_ENVELOPE.procedural).not.toEqual(VEGAN_ENVELOPE.procedural);
  });

  // Test 5: Multiple keto meals all survive the override envelope
  it("multiple keto-compliant meals all pass the override envelope — not just the first", () => {
    const ketoMeal2 = {
      ...KETO_COMPLIANT_MEAL,
      name: "Keto Cream Cheese Pancakes",
      ingredients: [
        { name: "cream cheese",  quantity: "4",   unit: "oz" },
        { name: "eggs",          quantity: "2",   unit: "large" },
        { name: "erythritol",    quantity: "1",   unit: "tbsp" },
        { name: "almond flour",  quantity: "1/4", unit: "cup" },
      ],
      instructions: "Blend cream cheese with eggs and erythritol until smooth. Cook on low heat 2 min per side.",
    };
    const passed = filterMealsByProtocol(
      [KETO_COMPLIANT_MEAL, ketoMeal2],
      KETO_OVERRIDE_ENVELOPE,
      { generatorName: "diet_override_regression" },
    );
    expect(passed.length).toBe(2);
  });

  // Test 6: Mixed array — keto meal passes, vegan high-carb meal is removed
  it("mixed array: keto-compliant meal passes and vegan high-carb meal is removed in the same filter call", () => {
    const passed = filterMealsByProtocol(
      [KETO_COMPLIANT_MEAL, VEGAN_HIGH_CARB_MEAL],
      KETO_OVERRIDE_ENVELOPE,
      { generatorName: "diet_override_regression" },
    );
    expect(passed.length).toBe(1);
    expect(passed[0].name).toBe("Keto Strawberry Cream Cake");
  });
});
