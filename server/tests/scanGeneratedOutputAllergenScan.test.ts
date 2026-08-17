/**
 * scanGeneratedOutputAllergenScan.test.ts
 *
 * Task: the universal protocol filter must catch allergen derivative leaks
 * itself — not rely on the Phase 3 ALLERGEN_ADAPT scan. scanGeneratedOutput
 * now scans envelope.allergies against ALLERGEN_EXPANSION:
 *   1. Derivative terms (shrimp for shellfish, whey for dairy) fail the scan
 *      even when avoidances/dietaryIdentity would never catch them.
 *   2. overriddenAllergens excludes the overridden allergen's derivatives.
 *   3. exemptDishNameTerms still exempts the requested dish's own name while
 *      derivative terms remain blocked.
 *
 * Pure unit tests — db is mocked; no network.
 *
 * Run: npx jest server/tests/scanGeneratedOutputAllergenScan.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));

import { scanGeneratedOutput, buildGuestEnvelope } from "../services/protocolEnvelope";
import { getRequestedDishExemptTerms } from "../services/allergyGuardrails";

function envelopeWithAllergies(allergies: string[]) {
  return { ...buildGuestEnvelope(), allergies } as any;
}

const shrimpMeal = {
  name: "Garlic Stir Fry",
  description: "A quick stir fry.",
  ingredients: [{ name: "shrimp" }, { name: "garlic" }, { name: "broccoli" }],
  instructions: "Stir fry everything and serve.",
};

const cleanMeal = {
  name: "Chicken Stir Fry",
  description: "A quick stir fry.",
  ingredients: [{ name: "chicken breast" }, { name: "garlic" }, { name: "broccoli" }],
  instructions: "Stir fry everything and serve.",
};

describe("scanGeneratedOutput — allergen derivative scan from envelope.allergies", () => {
  test("shellfish allergy catches shrimp with no avoidances configured", () => {
    const result = scanGeneratedOutput(shrimpMeal, envelopeWithAllergies(["shellfish"]), {
      generatorName: "test",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.term === "shrimp")).toBe(true);
    expect(result.violations.find(v => v.term === "shrimp")?.category).toBe("allergy:shellfish");
  });

  test("dairy allergy catches hidden derivative (whey)", () => {
    const meal = {
      ...cleanMeal,
      ingredients: [...cleanMeal.ingredients, { name: "whey protein" }],
    };
    const result = scanGeneratedOutput(meal, envelopeWithAllergies(["dairy"]), {
      generatorName: "test",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.term === "whey")).toBe(true);
  });

  test("clean meal passes with allergies present", () => {
    const result = scanGeneratedOutput(cleanMeal, envelopeWithAllergies(["shellfish", "dairy"]), {
      generatorName: "test",
    });
    expect(result.passed).toBe(true);
  });

  test("unknown allergen falls back to the literal term", () => {
    const meal = {
      ...cleanMeal,
      ingredients: [...cleanMeal.ingredients, { name: "dragonfruit" }],
    };
    const result = scanGeneratedOutput(meal, envelopeWithAllergies(["dragonfruit"]), {
      generatorName: "test",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.term === "dragonfruit")).toBe(true);
  });

  test("overriddenAllergens suppresses that allergen's derivatives only", () => {
    const result = scanGeneratedOutput(shrimpMeal, envelopeWithAllergies(["shellfish"]), {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    expect(result.passed).toBe(true);

    // A second, non-overridden allergy remains active
    const meal = {
      ...shrimpMeal,
      ingredients: [...shrimpMeal.ingredients, { name: "butter" }],
    };
    const result2 = scanGeneratedOutput(meal, envelopeWithAllergies(["shellfish", "dairy"]), {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    expect(result2.passed).toBe(false);
    expect(result2.violations.some(v => v.term === "butter")).toBe(true);
    expect(result2.violations.some(v => v.term === "shrimp")).toBe(false);
  });

  test("exemptDishNameTerms exempts the dish name but never derivatives", () => {
    const exemptSet = new Set(
      getRequestedDishExemptTerms("gumbo", ["shellfish"]).map(t => t.toLowerCase()),
    );
    const safeGumbo = {
      name: "Chicken and Andouille Gumbo",
      description: "A rich gumbo with a dark roux and okra.",
      ingredients: [{ name: "chicken thigh" }, { name: "okra" }, { name: "chicken stock" }],
      instructions: "Make a dark roux. Simmer the gumbo.",
    };
    const leakyGumbo = {
      ...safeGumbo,
      ingredients: [...safeGumbo.ingredients, { name: "shrimp" }],
    };
    const envelope = envelopeWithAllergies(["shellfish"]);

    // ALLERGEN_EXPANSION.shellfish contains "gumbo" — without the exemption
    // the adapted dish would always fail on its own name.
    expect(
      scanGeneratedOutput(safeGumbo, envelope, { generatorName: "test" }).passed,
    ).toBe(false);
    expect(
      scanGeneratedOutput(safeGumbo, envelope, {
        generatorName: "test",
        exemptDishNameTerms: exemptSet,
      }).passed,
    ).toBe(true);
    expect(
      scanGeneratedOutput(leakyGumbo, envelope, {
        generatorName: "test",
        exemptDishNameTerms: exemptSet,
      }).passed,
    ).toBe(false);
  });
});
