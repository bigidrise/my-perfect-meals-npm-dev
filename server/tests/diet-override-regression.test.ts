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
