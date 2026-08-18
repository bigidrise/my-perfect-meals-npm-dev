/**
 * Clinical adaptation activation + clinical macro gate tests.
 *
 * Regression focus: the clinical adaptation retry path in the create-with-chef
 * generator must activate from the SERVER-AUTHORITATIVE clinicalGenerationContext
 * (resolved by the chef budget resolver from the user's profile), not just the
 * client-selected dietType. A profile-confirmed diabetic using a builder with no
 * diabetic diet type (or another diet) is clinically gated by the route, so the
 * generator must run adaptation retries before the gate ever fires.
 */
import {
  isClinicalAdaptationActive,
  validateClinicalMacros,
} from "../services/clinicalMacroGate";

describe("isClinicalAdaptationActive — server-authoritative activation", () => {
  it("activates diabetic adaptation from server context with NO client dietType", () => {
    const r = isClinicalAdaptationActive("diabetic", undefined, false);
    expect(r.active).toBe(true);
    expect(r.diabeticActive).toBe(true);
    expect(r.glp1Active).toBe(false);
  });

  it("activates diabetic adaptation from server context even when client selected another diet", () => {
    const r = isClinicalAdaptationActive("diabetic", "anti-inflammatory", false);
    expect(r.active).toBe(true);
    expect(r.diabeticActive).toBe(true);
  });

  it("activates GLP-1 adaptation from server context with no client dietType", () => {
    const r = isClinicalAdaptationActive("glp1", null, false);
    expect(r.active).toBe(true);
    expect(r.glp1Active).toBe(true);
    expect(r.diabeticActive).toBe(false);
  });

  it("activates GLP-1 adaptation when server-resolved glp1Targets are present", () => {
    const r = isClinicalAdaptationActive("standard", undefined, true);
    expect(r.active).toBe(true);
    expect(r.glp1Active).toBe(true);
  });

  it("still honors client dietType as an activation source", () => {
    expect(isClinicalAdaptationActive(undefined, "diabetic", false).diabeticActive).toBe(true);
    expect(isClinicalAdaptationActive(undefined, "glp1", false).glp1Active).toBe(true);
  });

  it("is inactive for standard context with no clinical diet or targets", () => {
    const r = isClinicalAdaptationActive("standard", "beachbody", false);
    expect(r.active).toBe(false);
    expect(r.diabeticActive).toBe(false);
    expect(r.glp1Active).toBe(false);
  });
});

describe("validateClinicalMacros — route gate stays fail-closed", () => {
  it("passes a compliant adapted meal (final compliant case)", () => {
    // Diabetic ceiling 35g, adapted gumbo comes in at 30g carbs → ships
    expect(validateClinicalMacros("diabetic", 35, 999, 30, 12)).toEqual({ passed: true });
  });

  it("passes within the 10g carb rounding tolerance", () => {
    expect(validateClinicalMacros("diabetic", 35, 999, 44, 12)).toEqual({ passed: true });
  });

  it("rejects a non-compliant meal after retries are exhausted (exhausted-gate case)", () => {
    const r = validateClinicalMacros("diabetic", 35, 999, 78, 12);
    expect(r.passed).toBe(false);
    if (r.passed === false) expect(r.reason).toBe("diabetic_carb_ceiling_exceeded");
  });

  it("rejects unknown carbs for diabetic users (fail-closed on missing nutrition)", () => {
    const r = validateClinicalMacros("diabetic", 35, 999, null, 12);
    expect(r.passed).toBe(false);
    if (r.passed === false) expect(r.reason).toBe("diabetic_unknown_carbs");
  });

  it("rejects GLP-1 fat ceiling violations beyond the 5g tolerance", () => {
    const r = validateClinicalMacros("glp1", 999, 15, 40, 25);
    expect(r.passed).toBe(false);
    if (r.passed === false) expect(r.reason).toBe("glp1_fat_ceiling_exceeded");
  });

  it("does not gate non-clinical contexts", () => {
    expect(validateClinicalMacros("standard", 35, 15, 200, 90)).toEqual({ passed: true });
  });
});
