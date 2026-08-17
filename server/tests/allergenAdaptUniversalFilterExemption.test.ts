/**
 * allergenAdaptUniversalFilterExemption.test.ts
 *
 * Task: shellfish-free gumbo must survive the UNIVERSAL protocol filter
 * (filterMealsByProtocol → scanGeneratedOutput) when the user picked
 * "Make it safe for me" (safetyMode === "ALLERGEN_ADAPT").
 *
 * The Phase 3 scan already applies getRequestedDishExemptTerms; this suite
 * covers the new `exemptDishNameTerms` context threading in the universal
 * filter that runs BEFORE Phase 3:
 *   1. A violation whose term is the requested dish's own name is exempted.
 *   2. Ingredient/derivative violations (shrimp, crab) are NEVER exempted,
 *      even when an exemption set is present.
 *   3. Without an exemption set, behavior is unchanged (violating meal drops).
 *   4. getRequestedDishExemptTerms only ever yields pure dish-name terms —
 *      the set can never contain an ingredient word.
 *
 * Pure unit tests — db is mocked; no network.
 *
 * Run: npx jest server/tests/allergenAdaptUniversalFilterExemption.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));

import {
  filterMealsByProtocol,
  scanGeneratedOutput,
  buildGuestEnvelope,
} from "../services/protocolEnvelope";
import { getRequestedDishExemptTerms } from "../services/allergyGuardrails";

const safeGumbo = {
  name: "Chicken and Andouille Gumbo",
  description: "A rich gumbo with a dark roux, okra, and Cajun seasoning.",
  ingredients: [
    { name: "chicken thigh" },
    { name: "andouille sausage" },
    { name: "okra" },
    { name: "chicken stock" },
  ],
  instructions: "Make a dark roux. Simmer the gumbo and serve over rice.",
};

const leakyGumbo = {
  name: "Chicken Gumbo",
  description: "A hearty gumbo.",
  ingredients: [{ name: "chicken thigh" }, { name: "shrimp" }, { name: "okra" }],
  instructions: "Simmer and serve the gumbo over rice.",
};

/**
 * Envelope whose avoidances produce a "gumbo" violation term in the universal
 * scan — modeling the dish-level block term reaching scanGeneratedOutput.
 * "seafood" additionally expands to shrimp/crab derivative terms.
 */
function envelopeBlockingGumbo() {
  return {
    ...buildGuestEnvelope(),
    allergies: ["shellfish"],
    avoidances: ["gumbo", "seafood"],
  } as any;
}

const exemptSet = new Set(
  getRequestedDishExemptTerms("gumbo", ["shellfish"]).map((t) => t.toLowerCase()),
);

describe("getRequestedDishExemptTerms — exemption set contents", () => {
  test("contains 'gumbo' for a gumbo request with shellfish allergy", () => {
    expect(exemptSet.has("gumbo")).toBe(true);
  });

  test("never contains ingredient/derivative words", () => {
    for (const term of ["shrimp", "crab", "shellfish", "lobster", "shrimp scampi"]) {
      expect(exemptSet.has(term)).toBe(false);
    }
  });

  test("'shrimp gumbo' request exempts only 'gumbo'", () => {
    const terms = getRequestedDishExemptTerms("shrimp gumbo", ["shellfish"]).map((t) =>
      t.toLowerCase(),
    );
    expect(terms).toEqual(["gumbo"]);
  });
});

describe("scanGeneratedOutput — exemptDishNameTerms", () => {
  test("without exemption: gumbo-name violation fails the scan (baseline unchanged)", () => {
    const result = scanGeneratedOutput(safeGumbo, envelopeBlockingGumbo(), {
      generatorName: "test",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.term.toLowerCase() === "gumbo")).toBe(true);
  });

  test("with exemption: shellfish-free gumbo passes", () => {
    const result = scanGeneratedOutput(safeGumbo, envelopeBlockingGumbo(), {
      generatorName: "test",
      exemptDishNameTerms: exemptSet,
    });
    expect(result.passed).toBe(true);
  });

  test("with exemption: shrimp leak still fails", () => {
    const result = scanGeneratedOutput(leakyGumbo, envelopeBlockingGumbo(), {
      generatorName: "test",
      exemptDishNameTerms: exemptSet,
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.term.toLowerCase() === "shrimp")).toBe(true);
    // the exempted dish name must not be among the surviving violations
    expect(result.violations.some((v) => v.term.toLowerCase() === "gumbo")).toBe(false);
  });
});

describe("filterMealsByProtocol — exemptDishNameTerms threading", () => {
  test("keeps the safe adapted gumbo, drops the shrimp-leaking one", () => {
    const kept = filterMealsByProtocol(
      [safeGumbo, leakyGumbo] as any[],
      envelopeBlockingGumbo(),
      { generatorName: "test", exemptDishNameTerms: exemptSet },
    );
    expect(kept.map((m: any) => m.name)).toEqual(["Chicken and Andouille Gumbo"]);
  });

  test("without exemption both gumbos drop (pre-fix behavior preserved for non-adapt callers)", () => {
    const kept = filterMealsByProtocol(
      [safeGumbo, leakyGumbo] as any[],
      envelopeBlockingGumbo(),
      { generatorName: "test" },
    );
    expect(kept).toHaveLength(0);
  });
});
