/**
 * profileWeightUnit.test.ts
 *
 * Tests the shared parseWeightToKg() function used by PUT /api/users/profile.
 * Because the route calls this function directly, testing it is equivalent to
 * testing the production conversion path — any regression in weightUnit.ts
 * will be caught here.
 *
 * Verifies:
 *   1. weight: 134, weightUnit: "lb" → 61 kg  (the regression case)
 *   2. weight: 70,  weightUnit: "kg" → 70 kg
 *   3. weight: 180, weightUnit absent → rejected (WEIGHT_UNIT_REQUIRED)
 *   4. weight: 350, weightUnit: "lb" → 159 kg  (high-but-valid lb value)
 *   5. weight: 350, weightUnit: "kg" → rejected (> 300 kg ceiling)
 *   6. Invalid weightUnit string → WEIGHT_UNIT_INVALID
 *   7. Non-positive weight → WEIGHT_VALUE_INVALID
 *   8. weight: 0 → WEIGHT_VALUE_INVALID
 */

import { parseWeightToKg } from "../lib/weightUnit";

describe("parseWeightToKg — production weight-unit conversion", () => {
  it("converts 134 lb → 61 kg  [regression: lbs were silently stored in kg column]", () => {
    const result = parseWeightToKg(134, "lb");
    expect(result).toEqual({ ok: true, weightKg: 61 });
  });

  it("passes through 70 kg unchanged", () => {
    const result = parseWeightToKg(70, "kg");
    expect(result).toEqual({ ok: true, weightKg: 70 });
  });

  it("rejects missing weightUnit — no silent unit assumption allowed", () => {
    const result = parseWeightToKg(180, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEIGHT_UNIT_REQUIRED");
      expect(result.status).toBe(400);
    }
  });

  it("rejects null weightUnit", () => {
    const result = parseWeightToKg(70, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEIGHT_UNIT_REQUIRED");
  });

  it("rejects empty-string weightUnit", () => {
    const result = parseWeightToKg(70, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEIGHT_UNIT_REQUIRED");
  });

  it("accepts 350 lb and converts to 159 kg (valid high value)", () => {
    const result = parseWeightToKg(350, "lb");
    // 350 / 2.20462 ≈ 158.76 → rounds to 159
    expect(result).toEqual({ ok: true, weightKg: 159 });
  });

  it("rejects 350 kg — exceeds 300 kg physiological ceiling", () => {
    const result = parseWeightToKg(350, "kg");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEIGHT_OUT_OF_RANGE");
      expect(result.status).toBe(400);
    }
  });

  it("rejects an unsupported weightUnit string", () => {
    const result = parseWeightToKg(70, "stone");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEIGHT_UNIT_INVALID");
      expect(result.status).toBe(400);
    }
  });

  it("rejects a negative weight", () => {
    const result = parseWeightToKg(-5, "kg");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEIGHT_VALUE_INVALID");
      expect(result.status).toBe(400);
    }
  });

  it("rejects weight: 0", () => {
    const result = parseWeightToKg(0, "kg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEIGHT_VALUE_INVALID");
  });

  it("accepts case-insensitive unit strings: 'LB' and 'KG'", () => {
    expect(parseWeightToKg(134, "LB")).toEqual({ ok: true, weightKg: 61 });
    expect(parseWeightToKg(70, "KG")).toEqual({ ok: true, weightKg: 70 });
  });
});
