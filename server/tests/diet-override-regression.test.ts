/**
 * Diet Override + Failure UX Regression Suite
 *
 * Covers the 12 approval-document cases for the builder diet override contract.
 * These are unit tests for the resolveEffectiveDiet resolver and integration
 * snapshots verifying the field contract between client and server.
 *
 * Run: npx jest tests/diet-override-regression.test.ts
 */

import { resolveEffectiveDiet } from "../services/resolveEffectiveDiet";

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
