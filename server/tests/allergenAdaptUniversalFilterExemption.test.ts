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

// ── Paella / bisque regression — non-adapt mode must still block these ────────

/**
 * Shellfish-free paella: no shellfish ingredients, only "paella" in the name.
 * This isolates "paella" as the sole dish-name–level violation so tests prove
 * the name-term block is what causes rejection — not a stray ingredient.
 */
const shellfishFreePaella = {
  name: "Saffron Paella",
  description: "A classic Spanish rice dish with saffron, vegetables, and chicken.",
  ingredients: [
    { name: "saffron" },
    { name: "arborio rice" },
    { name: "chicken thigh" },
    { name: "bell pepper" },
    { name: "onion" },
  ],
  instructions: "Toast the rice, add saffron stock, simmer until done.",
};

/**
 * Shellfish-free bisque: butternut squash bisque with NO shellfish ingredients.
 * Only "bisque" in the name is a shellfish-expansion term. This is the critical
 * fixture — if tests used a lobster bisque, a "bisque" exemption could silently
 * fail to catch the lobster violation and the test would still pass.
 */
const shellfishFreeBisque = {
  name: "Butternut Squash Bisque",
  description: "A creamy autumn bisque made with roasted squash and vegetable stock.",
  ingredients: [
    { name: "butternut squash" },
    { name: "vegetable stock" },
    { name: "onion" },
    { name: "heavy cream" },
    { name: "nutmeg" },
  ],
  instructions: "Roast squash, blend with stock and cream, season with nutmeg.",
};

/**
 * Envelope for a shellfish-allergic user.
 *
 * "paella" and "bisque" come from ALLERGEN_EXPANSION["shellfish"], but the
 * universal filter (scanForHiddenDietaryViolations) reads from `avoidances`,
 * not `allergies`. In production, buildProtocolEnvelope expands the shellfish
 * allergy and merges the dish-name terms into `avoidances`. We replicate that
 * here so the filter sees the same forbidden list as a real user's envelope.
 */
function shellfishAllergyEnvelope() {
  return {
    ...buildGuestEnvelope(),
    allergies: ["shellfish"],
    // Shellfish-expansion dish names — present in ALLERGEN_EXPANSION["shellfish"]
    // and merged into avoidances by the real envelope builder:
    avoidances: ["paella", "bisque", "cioppino", "gumbo", "jambalaya"],
  } as any;
}

describe("getRequestedDishExemptTerms — empty / unrelated requests", () => {
  test("empty request string returns no exempt terms", () => {
    const terms = getRequestedDishExemptTerms("", ["shellfish"]);
    expect(terms).toHaveLength(0);
  });

  test("unrelated request ('chicken salad') returns no exempt terms", () => {
    const terms = getRequestedDishExemptTerms("chicken salad", ["shellfish"]);
    expect(terms).toHaveLength(0);
  });

  test("'paella' request exempts only 'paella', not lobster/shrimp/crab", () => {
    const terms = getRequestedDishExemptTerms("paella", ["shellfish"]).map((t) =>
      t.toLowerCase(),
    );
    expect(terms).toContain("paella");
    for (const ingredient of ["lobster", "shrimp", "crab", "shellfish"]) {
      expect(terms).not.toContain(ingredient);
    }
  });

  test("'bisque' request exempts only 'bisque', not lobster/shrimp/shellfish", () => {
    const terms = getRequestedDishExemptTerms("bisque", ["shellfish"]).map((t) =>
      t.toLowerCase(),
    );
    expect(terms).toContain("bisque");
    for (const ingredient of ["lobster", "shrimp", "crab", "shellfish"]) {
      expect(terms).not.toContain(ingredient);
    }
  });
});

describe("Non-adapt mode: paella and bisque are stripped by the universal filter", () => {
  test("shellfish-free paella is dropped in non-adapt mode — 'paella' name term is the violation", () => {
    // The fixture has zero shellfish ingredients: only 'paella' in the name
    // triggers the block. This proves the dish-name term guard is working.
    const result = scanGeneratedOutput(shellfishFreePaella, shellfishAllergyEnvelope(), {
      generatorName: "craving_creator",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.term.toLowerCase() === "paella")).toBe(true);
  });

  test("shellfish-free bisque is dropped in non-adapt mode — 'bisque' name term is the violation", () => {
    // The fixture has zero shellfish ingredients: only 'bisque' in the name
    // triggers the block. Proves the name-term is what causes rejection, not
    // an ingredient leak that would pass even if the exemption were wrong.
    const result = scanGeneratedOutput(shellfishFreeBisque, shellfishAllergyEnvelope(), {
      generatorName: "craving_creator",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.term.toLowerCase() === "bisque")).toBe(true);
  });

  test("filterMealsByProtocol drops both shellfish-free paella and bisque without exemption", () => {
    const kept = filterMealsByProtocol(
      [shellfishFreePaella, shellfishFreeBisque] as any[],
      shellfishAllergyEnvelope(),
      { generatorName: "craving_creator" },
    );
    expect(kept).toHaveLength(0);
  });
});

describe("Route-level exemption gate: production guard on safetyMode === ALLERGEN_ADAPT", () => {
  /**
   * These tests verify the load-bearing guard in routes.ts:
   *
   *   if (safetyMode === "ALLERGEN_ADAPT" && allergies.length > 0) {
   *     _adaptExemptTerms = new Set(getRequestedDishExemptTerms(...))
   *   }
   *   filterMealsByProtocol(..., { exemptDishNameTerms: _adaptExemptTerms })
   *
   * We test the two independently-observable production functions:
   *   1. getRequestedDishExemptTerms — proves the exemption CAN be built
   *   2. filterMealsByProtocol — proves what happens without it (non-adapt path)
   *
   * Together they demonstrate that the safetyMode guard is the only thing
   * separating adapt (meal passes) from non-adapt (meal blocked).
   */

  // Paella exemption set — what the route builds in ALLERGEN_ADAPT mode
  const paellaExemptSet = new Set(
    getRequestedDishExemptTerms("paella", ["shellfish"]).map((t) => t.toLowerCase()),
  );

  // Bisque exemption set — what the route builds in ALLERGEN_ADAPT mode
  const bisqueExemptSet = new Set(
    getRequestedDishExemptTerms("bisque", ["shellfish"]).map((t) => t.toLowerCase()),
  );

  test("getRequestedDishExemptTerms returns 'paella' — proves adapt mode CAN exempt it", () => {
    // This shows the function works for paella; the safetyMode guard in routes.ts
    // is the only reason it is NOT called in non-adapt mode.
    expect(paellaExemptSet.has("paella")).toBe(true);
  });

  test("getRequestedDishExemptTerms returns 'bisque' — proves adapt mode CAN exempt it", () => {
    expect(bisqueExemptSet.has("bisque")).toBe(true);
  });

  test("non-adapt path: filterMealsByProtocol with undefined exemption drops shellfish-free paella", () => {
    // exemptDishNameTerms: undefined is exactly what routes.ts supplies when
    // safetyMode !== 'ALLERGEN_ADAPT' (the if-block is never entered).
    const kept = filterMealsByProtocol(
      [shellfishFreePaella] as any[],
      shellfishAllergyEnvelope(),
      { generatorName: "craving_creator", exemptDishNameTerms: undefined },
    );
    expect(kept).toHaveLength(0);
  });

  test("non-adapt path: filterMealsByProtocol with undefined exemption drops shellfish-free bisque", () => {
    const kept = filterMealsByProtocol(
      [shellfishFreeBisque] as any[],
      shellfishAllergyEnvelope(),
      { generatorName: "craving_creator", exemptDishNameTerms: undefined },
    );
    expect(kept).toHaveLength(0);
  });

  test("adapt path: filterMealsByProtocol WITH paella exemption keeps shellfish-free paella", () => {
    // This proves the exemption set is exactly what enables the adapted dish to
    // survive the universal filter — i.e. it is a necessary and sufficient gate.
    const kept = filterMealsByProtocol(
      [shellfishFreePaella] as any[],
      shellfishAllergyEnvelope(),
      { generatorName: "craving_creator", exemptDishNameTerms: paellaExemptSet },
    );
    expect(kept).toHaveLength(1);
  });

  test("adapt path: filterMealsByProtocol WITH bisque exemption keeps shellfish-free bisque", () => {
    const kept = filterMealsByProtocol(
      [shellfishFreeBisque] as any[],
      shellfishAllergyEnvelope(),
      { generatorName: "craving_creator", exemptDishNameTerms: bisqueExemptSet },
    );
    expect(kept).toHaveLength(1);
  });
});
