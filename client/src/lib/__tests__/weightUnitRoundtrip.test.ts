/**
 * Regression: MacroCalculator weight-unit round-trip stability
 *
 * Context: users.weight is stored in KG (schema canonical; the POST
 * /api/biometrics/weight route always converts lb→kg before writing).
 * The MacroCalculator previously read users.weight and treated it as LBS,
 * then synced it back as lbs — causing the biometrics route to divide by
 * 2.20462 again, decaying the stored weight on every calculator visit:
 *
 *   134 lb → stored as 61 kg → read as 61 lb → stored as 28 kg → …
 *
 * The fix: MacroCalculator reads users.weight as kg, derives weightLbs
 * from it (kg × 2.20462). The sync step then posts the correct lbs value,
 * the server converts back to the same kg, and the value is stable.
 */

/** Mirrors the biometrics route conversion: lb→kg stored in users.weight */
function biometricsSaveWeightKg(valueLb: number): number {
  return Math.round(valueLb / 2.20462);
}

/** Mirrors the FIXED MacroCalculator read: users.weight (kg) → weightLbs */
function macroCalcReadFixed(storedKg: number): { weightLbs: number; weightKg: number } {
  return {
    weightKg: Math.round(storedKg * 10) / 10,
    weightLbs: Math.round(storedKg * 2.20462),
  };
}

/** Mirrors the BUGGY MacroCalculator read: users.weight treated as lbs */
function macroCalcReadBuggy(storedValue: number): { weightLbs: number; weightKg: number } {
  return {
    weightLbs: storedValue,
    weightKg: Math.round((storedValue / 2.205) * 10) / 10,
  };
}

// ─── Imperial round-trip ──────────────────────────────────────────────────────

describe("MacroCalculator weight-unit round-trip — imperial", () => {
  // Starting condition: user enters 134 lb, biometrics route stores 61 kg.
  const storedKgAfterFirstSave = biometricsSaveWeightKg(134); // 61

  test("biometrics route stores 134 lb as 61 kg", () => {
    expect(storedKgAfterFirstSave).toBe(61);
  });

  test("FIXED read: users.weight=61 (kg) → displays 134 lbs", () => {
    const { weightLbs } = macroCalcReadFixed(storedKgAfterFirstSave);
    // Allow ±1 for rounding: 61 × 2.20462 = 134.48 → 134
    expect(weightLbs).toBeCloseTo(134, 0);
  });

  test("FIXED sync: posting 134 lb returns to the same 61 kg — no decay", () => {
    const { weightLbs } = macroCalcReadFixed(storedKgAfterFirstSave);
    const afterSync = biometricsSaveWeightKg(weightLbs);
    expect(afterSync).toBe(storedKgAfterFirstSave); // 61 → 61, stable
  });

  test("FIXED: three consecutive sync cycles remain stable at 61 kg", () => {
    let stored = storedKgAfterFirstSave; // 61
    for (let i = 0; i < 3; i++) {
      const { weightLbs } = macroCalcReadFixed(stored);
      stored = biometricsSaveWeightKg(weightLbs);
    }
    expect(stored).toBe(61);
  });

  test("BUGGY read: users.weight=61 (kg) treated as 61 lb → decays to 28 kg", () => {
    const { weightLbs } = macroCalcReadBuggy(storedKgAfterFirstSave); // 61 treated as lbs
    const afterBuggySync = biometricsSaveWeightKg(weightLbs); // Math.round(61/2.20462) = 28
    expect(afterBuggySync).toBe(28); // confirms the defect
  });

  test("BUGGY: decay chain 134 lb → 61 kg → 28 kg → 13 kg", () => {
    const chain: number[] = [biometricsSaveWeightKg(134)]; // [61]
    for (let i = 0; i < 2; i++) {
      const { weightLbs } = macroCalcReadBuggy(chain[chain.length - 1]);
      chain.push(biometricsSaveWeightKg(weightLbs));
    }
    expect(chain).toEqual([61, 28, 13]);
  });
});

// ─── Metric round-trip ────────────────────────────────────────────────────────

describe("MacroCalculator weight-unit round-trip — metric", () => {
  // Metric user stores weight directly in kg (no conversion needed).
  // The biometrics route for kg: Math.round(value) — value already in kg.
  function biometricsSaveKgDirect(valueKg: number): number {
    return Math.round(valueKg);
  }

  const storedKg = 70; // user enters 70 kg

  test("FIXED read: users.weight=70 (kg) → weightKg=70, weightLbs=154", () => {
    const { weightKg, weightLbs } = macroCalcReadFixed(storedKg);
    expect(weightKg).toBe(70);
    expect(weightLbs).toBeCloseTo(154, 0); // 70 × 2.20462 = 154.32 → 154
  });

  test("FIXED sync (posting lbs): 154 lb → 70 kg — stable", () => {
    const { weightLbs } = macroCalcReadFixed(storedKg);
    const afterSync = biometricsSaveWeightKg(weightLbs); // Math.round(154/2.20462) = 70
    expect(afterSync).toBe(storedKg);
  });

  test("BUGGY read: users.weight=70 (kg) treated as 70 lb → decays to 32 kg", () => {
    const { weightLbs } = macroCalcReadBuggy(storedKg); // 70 treated as lbs
    const afterBuggySync = biometricsSaveWeightKg(weightLbs); // Math.round(70/2.20462) = 32
    expect(afterBuggySync).toBe(32);
  });
});

// ─── Real-world Monica reproduction ──────────────────────────────────────────

describe("Monica account reproduction", () => {
  test("134 lb → biometrics stores 61 kg", () => {
    expect(biometricsSaveWeightKg(134)).toBe(61);
  });

  test("BUGGY: 61 kg read as 61 lb → biometrics stores 28 kg", () => {
    const { weightLbs } = macroCalcReadBuggy(61);
    expect(biometricsSaveWeightKg(weightLbs)).toBe(28);
  });

  test("BUGGY: 28 kg read as 28 lb → biometrics stores 13 kg", () => {
    const { weightLbs } = macroCalcReadBuggy(28);
    expect(biometricsSaveWeightKg(weightLbs)).toBe(13);
  });

  test("FIXED: 61 kg read as 134 lb → biometrics stores 61 kg — stable", () => {
    const { weightLbs } = macroCalcReadFixed(61);
    expect(weightLbs).toBeCloseTo(134, 0);
    expect(biometricsSaveWeightKg(weightLbs)).toBe(61);
  });
});
