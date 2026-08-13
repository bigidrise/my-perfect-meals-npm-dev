/**
 * prescriptionAdapter.test.ts
 *
 * Unit tests for prescriptionToTargetsOverride().
 *
 * This adapter is the single place where server DailyNutritionPrescription
 * field names (proteinTarget, carbsTarget, fatTarget …) are translated to
 * the MacroTargets display contract (protein_g, carbs_g, fat_g …) consumed
 * by DailyTargetsCard and RemainingMacrosFooter across all 7 builders.
 *
 * The root-cause bug that prompted these tests was a field rename that was
 * invisible to TypeScript because 438 pre-existing errors suppressed the
 * excess-property diagnostic. These tests catch that class of regression
 * even when the compiler is silent.
 */

import { prescriptionToTargetsOverride } from "../prescriptionAdapter";

// ── helpers ───────────────────────────────────────────────────────────────────

function validPrescription(overrides: Record<string, unknown> = {}) {
  return {
    proteinTarget: 180,
    carbsTarget: 200,
    fatTarget: 70,
    starchyCarbsTarget: 80,
    fibrousCarbsTarget: 120,
    source: "performance",
    ...overrides,
  };
}

// ── Field-name mapping ────────────────────────────────────────────────────────

describe("prescriptionToTargetsOverride — field mapping", () => {
  it("maps proteinTarget → protein_g", () => {
    const result = prescriptionToTargetsOverride(validPrescription({ proteinTarget: 175 }));
    expect(result?.protein_g).toBe(175);
  });

  it("maps carbsTarget → carbs_g", () => {
    const result = prescriptionToTargetsOverride(validPrescription({ carbsTarget: 220 }));
    expect(result?.carbs_g).toBe(220);
  });

  it("maps fatTarget → fat_g", () => {
    const result = prescriptionToTargetsOverride(validPrescription({ fatTarget: 65 }));
    expect(result?.fat_g).toBe(65);
  });

  it("maps starchyCarbsTarget → starchyCarbs_g", () => {
    const result = prescriptionToTargetsOverride(validPrescription({ starchyCarbsTarget: 90 }));
    expect(result?.starchyCarbs_g).toBe(90);
  });

  it("maps fibrousCarbsTarget → fibrousCarbs_g", () => {
    const result = prescriptionToTargetsOverride(validPrescription({ fibrousCarbsTarget: 130 }));
    expect(result?.fibrousCarbs_g).toBe(130);
  });

  it("returns the complete MacroTargets shape with all five fields", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({
        proteinTarget: 180,
        carbsTarget: 200,
        fatTarget: 70,
        starchyCarbsTarget: 80,
        fibrousCarbsTarget: 120,
      }),
    );
    expect(result).toEqual({
      protein_g:      180,
      carbs_g:        200,
      fat_g:          70,
      starchyCarbs_g: 80,
      fibrousCarbs_g: 120,
    });
  });

  it("preserves undefined starchyCarbsTarget as undefined (not 0)", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 180,
      carbsTarget: 200,
      fatTarget: 70,
    });
    expect(result?.starchyCarbs_g).toBeUndefined();
  });
});

// ── Null / undefined guards ───────────────────────────────────────────────────

describe("prescriptionToTargetsOverride — null / undefined guards", () => {
  it("returns undefined for null prescription", () => {
    expect(prescriptionToTargetsOverride(null)).toBeUndefined();
  });

  it("returns undefined for undefined prescription", () => {
    expect(prescriptionToTargetsOverride(undefined)).toBeUndefined();
  });
});

// ── Fallback source guard ─────────────────────────────────────────────────────

describe('prescriptionToTargetsOverride — source === "fallback"', () => {
  it('returns undefined when source is "fallback"', () => {
    const result = prescriptionToTargetsOverride(validPrescription({ source: "fallback" }));
    expect(result).toBeUndefined();
  });

  it("returns a value when source is any other string", () => {
    for (const source of ["performance", "procare", "clinical", "regular", undefined]) {
      const result = prescriptionToTargetsOverride(validPrescription({ source }));
      expect(result).toBeDefined();
    }
  });
});

// ── Zero-value guard ──────────────────────────────────────────────────────────

describe("prescriptionToTargetsOverride — zero-value guard", () => {
  it("returns undefined when both proteinTarget and carbsTarget are 0", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ proteinTarget: 0, carbsTarget: 0 }),
    );
    expect(result).toBeUndefined();
  });

  it("returns a value when proteinTarget is 0 but carbsTarget is positive", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ proteinTarget: 0, carbsTarget: 150 }),
    );
    expect(result).toBeDefined();
    expect(result?.carbs_g).toBe(150);
  });

  it("returns a value when carbsTarget is 0 but proteinTarget is positive", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ proteinTarget: 180, carbsTarget: 0 }),
    );
    expect(result).toBeDefined();
    expect(result?.protein_g).toBe(180);
  });

  it("returns undefined for negative proteinTarget and carbsTarget (treated as unresolved)", () => {
    // Negative values fail the > 0 check so both branches return undefined
    const result = prescriptionToTargetsOverride(
      validPrescription({ proteinTarget: -1, carbsTarget: -1 }),
    );
    expect(result).toBeUndefined();
  });
});

// ── DailyStarchIndicator smoke ────────────────────────────────────────────────
//
// DailyStarchIndicator reads starchyCarbs_g from the MacroTargets shape that
// prescriptionToTargetsOverride produces. If starchyCarbsTarget were ever
// renamed on the prescription (or mistyped in the adapter), starchyCarbs_g
// would silently become undefined — no TypeScript error, no visible crash.
// These tests lock down that the value is non-zero when a real prescription
// is in play, and that undefined is only returned when the prescription
// explicitly omits the field (the baseline-fallback case).

describe("DailyStarchIndicator smoke — starchyCarbs_g is non-zero from a resolved prescription", () => {
  it("starchyCarbs_g is truthy (non-zero, non-undefined) for a resolved clinical prescription", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ starchyCarbsTarget: 80, source: "clinical" }),
    );
    expect(result).toBeDefined();
    expect(result!.starchyCarbs_g).toBeDefined();
    expect(result!.starchyCarbs_g).toBeGreaterThan(0);
  });

  it("starchyCarbs_g is truthy for a performance prescription", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ starchyCarbsTarget: 120, source: "performance" }),
    );
    expect(result!.starchyCarbs_g).toBe(120);
  });

  it("starchyCarbs_g is truthy for a procare (professional_override) prescription", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ starchyCarbsTarget: 60, source: "professional_override" }),
    );
    expect(result!.starchyCarbs_g).toBe(60);
  });

  it("starchyCarbs_g is undefined when prescription is absent (baseline fallback path)", () => {
    // When there is no prescription, prescriptionToTargetsOverride returns
    // undefined and DailyStarchIndicator falls back to the strategyOverride /
    // bodyFatSlotDelta baseline — starchyCarbs_g should NOT be zero here,
    // it should simply be absent so callers know to use the baseline.
    const result = prescriptionToTargetsOverride(null);
    expect(result).toBeUndefined();
  });

  it("starchyCarbs_g is undefined when source is fallback (server could not resolve)", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ starchyCarbsTarget: 80, source: "fallback" }),
    );
    // Returns undefined — caller must use baseline, not a stale starchyCarbs_g
    expect(result).toBeUndefined();
  });

  it("starchyCarbs_g is undefined (not 0) when the prescription has no starchyCarbsTarget — never silently zeroed", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 180,
      carbsTarget: 200,
      fatTarget: 70,
      // starchyCarbsTarget intentionally absent
    });
    expect(result).toBeDefined();
    // Must be undefined — not 0 — so DailyStarchIndicator can distinguish
    // "target not set" from "target is zero".
    expect(result!.starchyCarbs_g).toBeUndefined();
  });
});

// ── FibrousCarbs smoke ────────────────────────────────────────────────────────
//
// fibrousCarbs_g has the same field-name-mismatch risk as starchyCarbs_g:
// if fibrousCarbsTarget were renamed on the server-side prescription (or
// mistyped in the adapter), fibrousCarbs_g would silently become undefined
// with no TypeScript error and no visible crash.
//
// These tests specifically exercise the fibrous-carbs-only prescription path
// (starchyCarbsTarget absent) to guarantee the mapping survives a rename.

describe("FibrousCarbs smoke — fibrousCarbs_g is non-zero from a fibrous-carbs-only prescription", () => {
  it("fibrousCarbs_g is truthy (non-zero, non-undefined) for a clinical/anti-inflammatory prescription with only fibrousCarbsTarget set", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 60,
      fibrousCarbsTarget: 100,
      // starchyCarbsTarget intentionally absent — fibrous-carbs-only prescription
      source: "clinical",
    });
    expect(result).toBeDefined();
    expect(result!.fibrousCarbs_g).toBeDefined();
    expect(result!.fibrousCarbs_g).toBeGreaterThan(0);
  });

  it("fibrousCarbs_g carries the exact value from fibrousCarbsTarget", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 60,
      fibrousCarbsTarget: 115,
      source: "clinical",
    });
    expect(result!.fibrousCarbs_g).toBe(115);
  });

  it("fibrousCarbs_g is truthy for a performance prescription with only fibrousCarbsTarget", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 200,
      carbsTarget: 250,
      fatTarget: 75,
      fibrousCarbsTarget: 140,
      source: "performance",
    });
    expect(result!.fibrousCarbs_g).toBe(140);
    // starchyCarbs_g must be undefined, not 0, when absent
    expect(result!.starchyCarbs_g).toBeUndefined();
  });

  it("fibrousCarbs_g is undefined (not 0) when fibrousCarbsTarget is absent — never silently zeroed", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 180,
      carbsTarget: 200,
      fatTarget: 70,
      // fibrousCarbsTarget intentionally absent
    });
    expect(result).toBeDefined();
    // Must be undefined — not 0 — so consumers can distinguish
    // "fibrous target not set" from "fibrous target is zero".
    expect(result!.fibrousCarbs_g).toBeUndefined();
  });

  it("fibrousCarbs_g is undefined when source is fallback (server could not resolve)", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ fibrousCarbsTarget: 100, source: "fallback" }),
    );
    // The whole override is undefined — caller must use baseline
    expect(result).toBeUndefined();
  });
});

// ── Fat smoke ─────────────────────────────────────────────────────────────────
//
// fat_g has the same field-name-mismatch risk as starchyCarbs_g and
// fibrousCarbs_g: if fatTarget were ever renamed on the server-side
// prescription (or mistyped in the adapter), fat_g would silently become
// undefined — no TypeScript error, no visible crash, just every builder
// displaying zero fat.
//
// These tests specifically exercise a fat-only prescription shape
// (starchyCarbsTarget and fibrousCarbsTarget absent) to guarantee the
// fatTarget → fat_g mapping survives a rename.

describe("Fat smoke — fat_g is non-zero when only fatTarget is present", () => {
  it("fat_g is truthy (non-zero, non-undefined) when fatTarget is set alongside protein and carbs only", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 65,
      // starchyCarbsTarget and fibrousCarbsTarget intentionally absent
    });
    expect(result).toBeDefined();
    expect(result!.fat_g).toBeDefined();
    expect(result!.fat_g).toBeGreaterThan(0);
  });

  it("fat_g carries the exact value from fatTarget", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 55,
    });
    expect(result!.fat_g).toBe(55);
  });

  it("fat_g is truthy for a clinical prescription with only fatTarget (no starchy/fibrous carbs)", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 140,
      carbsTarget: 160,
      fatTarget: 80,
      source: "clinical",
    });
    expect(result!.fat_g).toBe(80);
    expect(result!.starchyCarbs_g).toBeUndefined();
    expect(result!.fibrousCarbs_g).toBeUndefined();
  });

  it("fat_g is truthy for a performance prescription with only fatTarget", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 200,
      carbsTarget: 250,
      fatTarget: 90,
      source: "performance",
    });
    expect(result!.fat_g).toBe(90);
  });

  it("fat_g is undefined (not 0) when fatTarget is absent — never silently zeroed", () => {
    // Build a prescription-like object without fatTarget to confirm the adapter
    // does not substitute 0 when the field is missing.
    const result = prescriptionToTargetsOverride(
      // Cast needed because fatTarget is required in PrescriptionLike; this
      // simulates a future rename where the field disappears at runtime.
      { proteinTarget: 180, carbsTarget: 200 } as Parameters<
        typeof prescriptionToTargetsOverride
      >[0],
    );
    // If fatTarget is absent, fat_g must be undefined — not 0 — so callers
    // can distinguish "target not set" from "target is zero".
    if (result !== undefined) {
      expect(result.fat_g).toBeUndefined();
    }
    // If the zero-value guard fires (both protein and carbs must be > 0 so
    // this branch won't fire here), result could be undefined — that's fine too.
  });

  it("fat_g is undefined when prescription is null (baseline fallback path)", () => {
    const result = prescriptionToTargetsOverride(null);
    expect(result).toBeUndefined();
    // fat_g is not accessible — the whole result is undefined, not an object
    // with fat_g: 0.
  });

  it("fat_g is undefined when source is fallback (server could not resolve)", () => {
    const result = prescriptionToTargetsOverride(
      validPrescription({ fatTarget: 70, source: "fallback" }),
    );
    // The whole override is undefined — caller must use baseline
    expect(result).toBeUndefined();
  });
});
