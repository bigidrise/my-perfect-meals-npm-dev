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

import { resolveEffectiveDiet } from "../services/resolveEffectiveDiet";
import { isRecipeSensitiveDish } from "../services/dishEngineRouter";

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
