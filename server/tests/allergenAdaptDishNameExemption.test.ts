/**
 * allergenAdaptDishNameExemption.test.ts
 *
 * Confirms the ALLERGEN_ADAPT post-scan does not condemn an adapted dish for
 * its own name — while every ingredient/derivative term stays fully scanned.
 *
 * Coverage:
 *   1. getRequestedDishExemptTerms exempts "gumbo" only when gumbo was requested.
 *   2. Ingredient words ("shrimp") are NEVER exemptable, even when they appear
 *      in the requested dish ("shrimp gumbo").
 *   3. A shellfish-free chicken/andouille gumbo passes the scan.
 *   4. A gumbo that leaks a shellfish derivative (shrimp stock in instructions)
 *      still fails the scan.
 *   5. Allergen-bearing preparations like "frangipane" (almond filling) are
 *      never exempt — a tree-nut scan still flags frangipane components.
 *   6. Non-requested dish names ("paella") still flag when gumbo was requested.
 *
 * Pure unit tests — no DB or network. The scan mirror is applied exactly as in
 * routes.ts Phase 3: exempt terms are removed from the term list BEFORE scanning.
 *
 * Run: npx jest server/tests/allergenAdaptDishNameExemption.test.ts --runInBand
 */

import {
  buildForbiddenTermsFromAllergens,
  getRequestedDishExemptTerms,
  ADAPTABLE_DISH_NAME_TERMS,
  ALLERGEN_EXPANSION,
} from "../services/allergyGuardrails";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mirrors routes.ts Phase 3 scan with the requested-dish exemption applied. */
function runAdaptScan(
  meals: Array<{ name: string; ingredients: string[]; instructions?: string; description?: string }>,
  allergens: string[],
  requestedDish: string,
): { safe: typeof meals; violations: Set<string> } {
  const exempt = new Set(
    getRequestedDishExemptTerms(requestedDish, allergens).map(t => t.toLowerCase()),
  );
  const forbiddenTerms = buildForbiddenTermsFromAllergens(allergens)
    .filter(t => !exempt.has(t.toLowerCase()));
  const forbiddenRegexes = forbiddenTerms.map(
    t => new RegExp(`\\b${escapeRegex(t)}\\b`, "i"),
  );
  const violations = new Set<string>();
  const safe = meals.filter(meal => {
    const mealText = [
      meal.name || "",
      meal.ingredients.join(" "),
      meal.instructions || "",
      meal.description || "",
    ].join(" ");
    const hit = forbiddenTerms.filter((_, idx) => forbiddenRegexes[idx].test(mealText));
    if (hit.length > 0) {
      hit.forEach(v => violations.add(v));
      return false;
    }
    return true;
  });
  return { safe, violations };
}

const safeGumbo = {
  name: "Classic Chicken and Sausage Gumbo",
  description: "A traditional gumbo with a rich roux, okra, and Cajun seasoning.",
  ingredients: ["chicken breast", "andouille sausage", "flour", "okra", "chicken stock", "cajun seasoning"],
  instructions: "Make a dark roux. Simmer the gumbo with okra and serve over rice.",
};

const leakyGumbo = {
  name: "Chicken Gumbo",
  description: "A hearty gumbo.",
  ingredients: ["chicken thigh", "okra", "flour"],
  instructions: "Simmer in shrimp stock for depth, then serve the gumbo over rice.",
};

describe("getRequestedDishExemptTerms", () => {
  test("exempts 'gumbo' for a gumbo request with shellfish allergy", () => {
    expect(getRequestedDishExemptTerms("gumbo", ["shellfish"])).toEqual(["gumbo"]);
  });

  test("exempts only the dish name for 'shrimp gumbo' — never the ingredient word", () => {
    const exempt = getRequestedDishExemptTerms("shrimp gumbo", ["shellfish"]);
    expect(exempt).toContain("gumbo");
    expect(exempt).not.toContain("shrimp");
  });

  test("returns nothing when the requested dish is unrelated", () => {
    expect(getRequestedDishExemptTerms("chicken alfredo", ["shellfish"])).toEqual([]);
  });

  test("returns nothing for empty input", () => {
    expect(getRequestedDishExemptTerms("", ["shellfish"])).toEqual([]);
    expect(getRequestedDishExemptTerms("gumbo", [])).toEqual([]);
  });

  test("never exempts allergen-bearing preparations (frangipane, marzipan, gambas, scampi, surimi)", () => {
    for (const dish of ["frangipane tart", "marzipan cake", "gambas al ajillo", "shrimp scampi", "surimi salad"]) {
      const exempt = [
        ...getRequestedDishExemptTerms(dish, ["tree nuts"]),
        ...getRequestedDishExemptTerms(dish, ["shellfish"]),
      ];
      expect(exempt).toEqual([]);
    }
  });

  test("exempts 'pad thai' for a peanut-allergic pad thai request", () => {
    expect(getRequestedDishExemptTerms("pad thai", ["peanuts"])).toContain("pad thai");
  });
});

describe("ADAPTABLE_DISH_NAME_TERMS inclusion rules", () => {
  // Ingredient words that must never appear inside an adaptable dish-name term.
  const allergenWords = [
    "shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop",
    "squid", "octopus", "seafood", "shellfish", "peanut", "almond", "cashew",
    "walnut", "pecan", "pistachio", "hazelnut", "nut",
  ];

  test("every adaptable term exists in some allergen expansion list", () => {
    const allExpansionTerms = new Set(
      Object.values(ALLERGEN_EXPANSION).flat().map(t => t.toLowerCase()),
    );
    for (const term of ADAPTABLE_DISH_NAME_TERMS) {
      expect(allExpansionTerms.has(term)).toBe(true);
    }
  });

  test("no adaptable term embeds an allergen ingredient word", () => {
    for (const term of ADAPTABLE_DISH_NAME_TERMS) {
      for (const w of allergenWords) {
        expect(new RegExp(`\\b${w}`, "i").test(term)).toBe(false);
      }
    }
  });
});

describe("Phase 3 scan with requested-dish exemption", () => {
  test("shellfish-free gumbo passes when gumbo was requested", () => {
    const { safe, violations } = runAdaptScan([safeGumbo], ["shellfish"], "gumbo");
    expect(safe).toHaveLength(1);
    expect(violations.size).toBe(0);
  });

  test("gumbo with shrimp stock in instructions still fails", () => {
    const { safe, violations } = runAdaptScan([leakyGumbo], ["shellfish"], "gumbo");
    expect(safe).toHaveLength(0);
    expect(violations.has("shrimp")).toBe(true);
  });

  test("frangipane component still fails a tree-nut scan even when requested", () => {
    const tart = {
      name: "Pear Tart",
      description: "A pear tart with a sweet filling.",
      ingredients: ["pears", "frangipane", "pastry crust"],
      instructions: "Spread the frangipane in the crust and top with pears.",
    };
    const { safe, violations } = runAdaptScan([tart], ["tree nuts"], "frangipane pear tart");
    expect(safe).toHaveLength(0);
    expect(violations.has("frangipane")).toBe(true);
  });

  test("a paella-named option still fails when the user requested gumbo", () => {
    const paella = { ...safeGumbo, name: "Chicken Paella", description: "A paella-style rice dish." };
    const { safe } = runAdaptScan([paella], ["shellfish"], "gumbo");
    expect(safe).toHaveLength(0);
  });

  test("without exemption, the dish's own name would wrongly flag (regression guard)", () => {
    const { safe } = runAdaptScan([safeGumbo], ["shellfish"], "");
    expect(safe).toHaveLength(0); // proves the exemption is what makes the happy path work
  });
});
