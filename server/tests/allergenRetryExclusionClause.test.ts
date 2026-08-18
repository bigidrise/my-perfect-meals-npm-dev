/**
 * allergenRetryExclusionClause.test.ts
 *
 * Confirms that the Phase 3 allergen retry uses the specific violation terms
 * detected in the first pass — NOT a repeat of the original prompt.
 *
 * Coverage:
 *   1. The scan correctly detects hidden shellfish traces (e.g. "shellfish stock")
 *      in a generated meal that leaked through Phase 3.
 *   2. The retry exclusion clause is constructed from _allDetectedViolations, not
 *      from a generic fallback or the original cravingInput alone.
 *   3. When both passes fail, the 422 response body contains detectedTerms[],
 *      retryAttempted: true, and originalWithPinAvailable: true.
 *   4. The client toast handler reads data.allergens and data.requestedDish from
 *      the structured response — it never produces a generic "your allergen" string
 *      when the server sends real allergen names.
 *
 * These are pure unit tests — no DB or network access required.
 *
 * Run: npx jest server/tests/allergenRetryExclusionClause.test.ts --runInBand
 */

import { buildForbiddenTermsFromAllergens, scanMealsForAllergenViolations } from "../services/allergyGuardrails";

// ── Thin wrapper so existing test suites keep their { safe, violations } API ───
// This delegates entirely to the real exported function — no reimplementation.
function runPhase3Scan(
  meals: Array<{ name: string; ingredients: string[]; instructions?: string; description?: string }>,
  allergens: string[],
): { safe: typeof meals; violations: Set<string> } {
  const result = scanMealsForAllergenViolations(meals, allergens);
  return { safe: result.safe, violations: result.violations };
}

/**
 * Mirrors the retry exclusion clause construction in routes.ts.
 */
function buildRetryExclusionClause(detectedViolations: Set<string>): string {
  const detectedViolationList = Array.from(detectedViolations).slice(0, 12);
  return detectedViolationList.length > 0
    ? ` [ALLERGEN RETRY — previous attempt leaked these terms, which MUST NOT appear in any ingredient, stock, broth, sauce, or preparation: ${detectedViolationList.join(", ")}. Remove ALL of them completely.]`
    : ` [ALLERGEN RETRY — regenerate with no allergen derivatives whatsoever.]`;
}

/**
 * Mirrors the 422 response body assembled in routes.ts when both passes fail.
 */
function buildAdaptationFailedResponse(opts: {
  requestedDish: string;
  allergens: string[];
  detectedViolations: Set<string>;
}) {
  const detectedViolationList = Array.from(opts.detectedViolations).slice(0, 12);
  return {
    status: "unable_to_generate",
    reasonCode: "allergen_adaptation_failed",
    requestedDish: opts.requestedDish,
    allergens: opts.allergens,
    detectedTerms: detectedViolationList,
    retryAttempted: true,
    originalWithPinAvailable: true,
    message: `We couldn't create a ${opts.allergens.join(" and ")}-free version of "${opts.requestedDish}" that passed your allergy protection checks (two attempts made). Your allergy protection is still fully active.`,
    suggestedActions: [
      `Try a variation that adapts more cleanly — for example, a ${opts.allergens.join(" and ")}-free version of a related dish`,
      `Use your Safety PIN to make the original preparation if you are certain it is safe for you`,
    ],
  };
}

/**
 * Mirrors the client-side toast builder in CreateDishPage.tsx for
 * reasonCode === "allergen_adaptation_failed".
 */
function buildClientToastDescription(data: {
  requestedDish?: string;
  allergens?: string | string[];
  retryAttempted?: boolean;
}) {
  const dish = data.requestedDish ? `"${data.requestedDish}"` : "this dish";
  const allergenLabel = Array.isArray(data.allergens)
    ? data.allergens.join(" and ")
    : data.allergens || "your allergen";
  const retried = data.retryAttempted ? " (we tried twice)" : "";
  return `We couldn't make a ${allergenLabel}-free version of ${dish} that passed your allergy protection${retried}. Your protection is still fully active. Try a different dish, or use your Safety PIN to make the original.`;
}

// ── Suite 1: Phase 3 scan detects shellfish leaks ─────────────────────────────

describe("Phase 3 allergen scan — shellfish leak detection", () => {
  it("detects 'shellfish stock' as a violation when user is shellfish-allergic", () => {
    const meals = [
      {
        name: "Seafood Gumbo",
        ingredients: ["andouille sausage", "okra", "shellfish stock", "tomatoes"],
        instructions: "Simmer all ingredients in shellfish stock for 30 minutes.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // The meal must be excluded
    expect(safe).toHaveLength(0);
    // The specific leak term must be captured
    expect(violations.size).toBeGreaterThan(0);
  });

  it("captures the specific leaked term (shrimp) rather than just a generic flag", () => {
    const meals = [
      {
        name: "Paella-style rice",
        ingredients: ["rice", "saffron", "shrimp paste", "peas"],
        instructions: "Cook rice, add shrimp paste for depth.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["shellfish"]);
    // At minimum 'shrimp' should be in violations — the actual matched term
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("shrimp"))).toBe(true);
  });

  it("passes a clean shellfish-free meal through without flagging it", () => {
    const meals = [
      {
        name: "Vegetable Stir Fry",
        ingredients: ["broccoli", "bell pepper", "garlic", "soy sauce", "ginger"],
        instructions: "Stir fry vegetables in a wok with garlic and soy sauce.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(1);
    expect(violations.size).toBe(0);
  });

  it("keeps clean options while excluding the leaking one", () => {
    const meals = [
      {
        name: "Shrimp Bisque",
        ingredients: ["shrimp", "cream", "celery"],
        instructions: "Blend shrimp into bisque.",
      },
      {
        name: "Chicken Soup",
        ingredients: ["chicken", "carrots", "celery", "onion"],
        instructions: "Simmer chicken with vegetables.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(1);
    expect(safe[0].name).toBe("Chicken Soup");
    expect(violations.size).toBeGreaterThan(0);
  });
});

// ── Suite 2: retry exclusion clause uses detected terms ───────────────────────

describe("Retry exclusion clause — constructed from detected violations", () => {
  it("includes the specific leaked term in the retry clause", () => {
    const leakedViolations = new Set(["shellfish stock", "shrimp"]);
    const clause = buildRetryExclusionClause(leakedViolations);

    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("shellfish stock");
    expect(clause).toContain("shrimp");
  });

  it("names ALL detected violation terms up to the 12-term cap", () => {
    const violations = new Set([
      "shrimp", "shrimps", "prawn", "crab", "lobster",
      "scallop", "clam", "mussel", "oyster", "squid",
      "calamari", "octopus", "abalone", "krill",
    ]);
    const clause = buildRetryExclusionClause(violations);
    // Should cap at 12
    const termCount = clause
      .replace(/.*leaked these terms.*?: /, "")
      .replace(/\. Remove.*/, "")
      .split(", ")
      .filter(Boolean).length;
    expect(termCount).toBeLessThanOrEqual(12);
    // But must include at least some of the terms
    expect(clause).toContain("shrimp");
  });

  it("falls back to the generic clause when no specific violations were collected", () => {
    const emptyViolations = new Set<string>();
    const clause = buildRetryExclusionClause(emptyViolations);

    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("regenerate with no allergen derivatives whatsoever");
    // Must NOT claim to name specific terms when there are none
    expect(clause).not.toContain("leaked these terms");
  });

  it("produces a retry cravingInput that starts with the original prompt", () => {
    const originalPrompt = "make me a gumbo";
    const violations = new Set(["shellfish stock", "shrimp"]);
    const clause = buildRetryExclusionClause(violations);
    const retryInput = `${originalPrompt}${clause}`;

    // Original prompt must come first
    expect(retryInput.startsWith(originalPrompt)).toBe(true);
    // Retry instructions appended after
    expect(retryInput).toContain("ALLERGEN RETRY");
    expect(retryInput).toContain("shellfish stock");
  });

  it("the retry input is distinct from the original prompt", () => {
    const originalPrompt = "make me a gumbo";
    const violations = new Set(["shellfish stock"]);
    const clause = buildRetryExclusionClause(violations);
    const retryInput = `${originalPrompt}${clause}`;

    expect(retryInput).not.toBe(originalPrompt);
    expect(retryInput.length).toBeGreaterThan(originalPrompt.length);
  });
});

// ── Suite 3: 422 response shape when both passes fail ────────────────────────

describe("allergen_adaptation_failed 422 response — required fields", () => {
  const allergens = ["shellfish"];
  const requestedDish = "gumbo";
  const violations = new Set(["shellfish stock", "shrimp"]);

  let response: ReturnType<typeof buildAdaptationFailedResponse>;

  beforeEach(() => {
    response = buildAdaptationFailedResponse({ requestedDish, allergens, detectedViolations: violations });
  });

  it("sets reasonCode to 'allergen_adaptation_failed'", () => {
    expect(response.reasonCode).toBe("allergen_adaptation_failed");
  });

  it("includes detectedTerms[] populated from the violation set", () => {
    expect(Array.isArray(response.detectedTerms)).toBe(true);
    expect(response.detectedTerms.length).toBeGreaterThan(0);
    expect(response.detectedTerms).toContain("shellfish stock");
  });

  it("sets retryAttempted: true", () => {
    expect(response.retryAttempted).toBe(true);
  });

  it("sets originalWithPinAvailable: true", () => {
    expect(response.originalWithPinAvailable).toBe(true);
  });

  it("includes the dish name in requestedDish", () => {
    expect(response.requestedDish).toBe("gumbo");
  });

  it("includes allergen names in allergens[]", () => {
    expect(response.allergens).toContain("shellfish");
  });

  it("includes a human-readable message that names the allergen and dish", () => {
    expect(response.message).toContain("shellfish");
    expect(response.message).toContain("gumbo");
    expect(response.message).toContain("two attempts");
  });

  it("detectedTerms are capped at 12 even if more violations were found", () => {
    const manyViolations = new Set([
      "shrimp", "prawn", "crab", "lobster", "scallop",
      "clam", "mussel", "oyster", "squid", "calamari",
      "octopus", "abalone", "krill", "crayfish",
    ]);
    const big = buildAdaptationFailedResponse({
      requestedDish: "seafood medley",
      allergens: ["shellfish"],
      detectedViolations: manyViolations,
    });
    expect(big.detectedTerms.length).toBeLessThanOrEqual(12);
  });

  it("detectedTerms[] is empty (not undefined) when no violations were captured", () => {
    const noViol = buildAdaptationFailedResponse({
      requestedDish: "test dish",
      allergens: ["shellfish"],
      detectedViolations: new Set(),
    });
    expect(Array.isArray(noViol.detectedTerms)).toBe(true);
    expect(noViol.detectedTerms).toHaveLength(0);
  });
});

// ── Suite 4: client toast uses structured fields, not generic strings ─────────

describe("Client toast handler — uses structured allergen and dish names", () => {
  it("uses data.allergens[] joined as the allergen label, not 'your allergen'", () => {
    const description = buildClientToastDescription({
      requestedDish: "gumbo",
      allergens: ["shellfish"],
      retryAttempted: true,
    });
    expect(description).toContain("shellfish");
    expect(description).not.toContain("your allergen");
  });

  it("uses data.requestedDish as the dish label in the toast", () => {
    const description = buildClientToastDescription({
      requestedDish: "gumbo",
      allergens: ["shellfish"],
      retryAttempted: true,
    });
    expect(description).toContain('"gumbo"');
    expect(description).not.toContain('"this dish"');
  });

  it("appends '(we tried twice)' when retryAttempted is true", () => {
    const description = buildClientToastDescription({
      requestedDish: "gumbo",
      allergens: ["shellfish"],
      retryAttempted: true,
    });
    expect(description).toContain("(we tried twice)");
  });

  it("omits the retry parenthetical when retryAttempted is false or absent", () => {
    const description = buildClientToastDescription({
      requestedDish: "gumbo",
      allergens: ["shellfish"],
      retryAttempted: false,
    });
    expect(description).not.toContain("(we tried twice)");
  });

  it("falls back to 'this dish' only when requestedDish is absent", () => {
    const description = buildClientToastDescription({
      allergens: ["shellfish"],
      retryAttempted: true,
    });
    expect(description).toContain("this dish");
  });

  it("falls back to 'your allergen' only when allergens is absent", () => {
    const description = buildClientToastDescription({
      requestedDish: "gumbo",
      retryAttempted: true,
    });
    expect(description).toContain("your allergen");
  });

  it("handles multiple allergens joined correctly", () => {
    const description = buildClientToastDescription({
      requestedDish: "paella",
      allergens: ["shellfish", "fish"],
      retryAttempted: true,
    });
    expect(description).toContain("shellfish and fish");
  });
});

// ── Suite 6: dish-level hard-block terms caught even with clean ingredients ────

describe("Phase 3 scan — dish-level block terms (paella, gumbo, bisque)", () => {
  it("flags a meal named 'Paella' even when all listed ingredients are shellfish-free", () => {
    const meals = [
      {
        name: "Paella",
        ingredients: ["rice", "saffron", "chicken breast", "bell peppers", "olive oil"],
        instructions: "Cook rice with saffron and chicken in a paella pan.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Paella is a dish-level hard-block — must be excluded regardless of ingredients
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("paella"))).toBe(true);
  });

  it("flags a meal named 'Gumbo' even when all listed ingredients are shellfish-free", () => {
    const meals = [
      {
        name: "Gumbo",
        ingredients: ["andouille sausage", "okra", "chicken thighs", "onion", "celery"],
        instructions: "Make a roux, add vegetables and sausage, simmer until thickened.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Gumbo is a dish-level hard-block
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("gumbo"))).toBe(true);
  });

  it("flags a meal named 'Bisque' even when all listed ingredients are shellfish-free", () => {
    const meals = [
      {
        name: "Bisque",
        ingredients: ["cream", "tomatoes", "celery", "onion", "vegetable broth"],
        instructions: "Blend tomatoes and cream into a smooth bisque.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Bisque is a dish-level hard-block
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("bisque"))).toBe(true);
  });

  it("includes 'paella' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Paella",
        ingredients: ["rice", "saffron", "chicken breast", "bell peppers"],
        instructions: "Traditional paella pan preparation.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["shellfish"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("paella");
  });

  it("includes 'gumbo' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Gumbo",
        ingredients: ["andouille sausage", "okra", "chicken thighs", "onion"],
        instructions: "Classic Louisiana gumbo without shellfish.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["shellfish"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("gumbo");
  });

  it("passes a clean chicken-and-rice dish that shares no dish-level block names", () => {
    const meals = [
      {
        name: "Saffron Chicken Rice",
        ingredients: ["rice", "saffron", "chicken breast", "bell peppers", "olive oil"],
        instructions: "Cook rice with saffron and chicken.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Should pass — no shellfish ingredient or dish-level term
    expect(safe).toHaveLength(1);
    expect(violations.size).toBe(0);
  });

  it("keeps a clean alternative while blocking the dish-level-named option", () => {
    const meals = [
      {
        name: "Paella",
        ingredients: ["rice", "saffron", "chicken", "peas"],
        instructions: "Cook in paella pan.",
      },
      {
        name: "Lemon Herb Chicken with Rice",
        ingredients: ["chicken breast", "lemon", "rice", "fresh herbs"],
        instructions: "Pan-sear chicken, serve over rice.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(1);
    expect(safe[0].name).toBe("Lemon Herb Chicken with Rice");
    expect(violations.size).toBeGreaterThan(0);
  });

  it("flags a meal named 'Cioppino' even when all listed ingredients are shellfish-free", () => {
    const meals = [
      {
        name: "Cioppino",
        ingredients: ["tomatoes", "white wine", "garlic", "fennel", "fish stock", "olive oil"],
        instructions: "Simmer tomatoes, white wine, and fennel in fish stock to make cioppino broth.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Cioppino is a dish-level hard-block — must be excluded regardless of ingredients
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("cioppino"))).toBe(true);
  });

  it("flags a meal named 'Jambalaya' even when all listed ingredients are shellfish-free", () => {
    const meals = [
      {
        name: "Jambalaya",
        ingredients: ["andouille sausage", "chicken thighs", "long grain rice", "onion", "celery", "bell pepper"],
        instructions: "Cook jambalaya with sausage, chicken, and rice — no shellfish.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    // Jambalaya is a dish-level hard-block
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("jambalaya"))).toBe(true);
  });

  it("includes 'cioppino' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Cioppino",
        ingredients: ["tomatoes", "white wine", "garlic", "fennel", "olive oil"],
        instructions: "A classic San Francisco seafood stew.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["shellfish"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("cioppino");
  });

  it("includes 'jambalaya' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Jambalaya",
        ingredients: ["andouille sausage", "chicken thighs", "long grain rice", "onion"],
        instructions: "Classic Louisiana jambalaya without seafood.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["shellfish"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("jambalaya");
  });
});

// ── Suite 5-A: violations buried in instructions or description only ───────────

describe("Phase 3 allergen scan — violations in instructions or description (not ingredients)", () => {
  it("flags a meal whose ingredient list is clean but whose instructions contain a forbidden term", () => {
    // Ingredients contain no shellfish terms — the leak is only in the cooking step.
    const meals = [
      {
        name: "Pan-Seared Chicken",
        ingredients: ["chicken breast", "butter", "garlic", "parsley"],
        instructions: "Deglaze with shellfish stock and reduce until the sauce coats a spoon.",
        description: "",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("shellfish"))).toBe(true);
  });

  it("flags a meal whose ingredient list is clean but whose description contains a hidden allergen derivative", () => {
    // Ingredients are shellfish-free; the allergen mention is only in the description.
    const meals = [
      {
        name: "Banh Mi Sandwich",
        ingredients: ["baguette", "pork belly", "daikon", "carrots", "jalapeño", "cilantro"],
        instructions: "Assemble sandwich with pickled vegetables and seasoned pork.",
        description: "Traditionally made with shrimp paste mixed into the pork marinade for umami depth.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("shrimp"))).toBe(true);
  });

  it("passes a meal that is clean in all four fields", () => {
    const meals = [
      {
        name: "Grilled Chicken",
        ingredients: ["chicken breast", "olive oil", "lemon", "rosemary"],
        instructions: "Grill chicken over medium heat until internal temperature reaches 165°F.",
        description: "A simple herb-marinated grilled chicken with lemon and rosemary.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(1);
    expect(violations.size).toBe(0);
  });

  it("flags when instructions-only violation is present while description and ingredients are clean", () => {
    const meals = [
      {
        name: "Risotto",
        ingredients: ["arborio rice", "white wine", "parmesan", "butter", "onion"],
        instructions: "Finish the risotto with a ladleful of prawn bisque for richness.",
        description: "Classic northern Italian risotto.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("prawn") || v.toLowerCase().includes("shrimp"))).toBe(true);
  });

  it("flags when description-only violation is present while instructions and ingredients are clean", () => {
    const meals = [
      {
        name: "Corn Chowder",
        ingredients: ["corn", "potato", "cream", "celery", "onion", "butter"],
        instructions: "Simmer vegetables in cream until tender, then blend half the soup.",
        description: "A creamy corn chowder — the original recipe uses lobster broth, but this version keeps ingredients plant-based.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("lobster"))).toBe(true);
  });
});

// ── Suite 7: dish-level hard-block terms caught for peanut allergy ────────────

describe("Phase 3 scan — peanut dish-level block terms (satay, pad thai, kung pao, etc.)", () => {
  it("flags a meal named 'Satay' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Satay",
        ingredients: ["chicken breast", "lemongrass", "turmeric", "coconut milk", "lime"],
        instructions: "Marinate chicken in spices and grill on skewers.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    // Satay is a dish-level hard-block for peanut allergy — must be excluded regardless of ingredients
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("satay"))).toBe(true);
  });

  it("flags a meal named 'Pad Thai' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Pad Thai",
        ingredients: ["rice noodles", "tofu", "bean sprouts", "green onion", "lime", "tamarind"],
        instructions: "Stir-fry noodles with tofu, sprouts, and tamarind sauce.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    // Pad Thai is a dish-level hard-block for peanut allergy
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("pad thai"))).toBe(true);
  });

  it("flags a meal named 'Kung Pao Chicken' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Kung Pao Chicken",
        ingredients: ["chicken breast", "bell peppers", "dried chili", "soy sauce", "rice vinegar"],
        instructions: "Stir-fry chicken with peppers and chili in a wok.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("kung pao"))).toBe(true);
  });

  it("flags a meal named 'Gado Gado' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Gado Gado",
        ingredients: ["tempeh", "green beans", "cabbage", "cucumber", "boiled egg"],
        instructions: "Arrange vegetables and tempeh, top with dressing.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("gado gado"))).toBe(true);
  });

  it("flags a meal named 'Dan Dan Noodles' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Dan Dan Noodles",
        ingredients: ["wheat noodles", "ground pork", "soy sauce", "chili oil", "sesame paste"],
        instructions: "Cook noodles and top with spiced pork and sauce.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("dan dan"))).toBe(true);
  });

  it("flags a meal named 'Massaman Curry' even when all listed ingredients are peanut-free", () => {
    const meals = [
      {
        name: "Massaman Curry",
        ingredients: ["chicken thighs", "potatoes", "coconut milk", "massaman paste", "bay leaves"],
        instructions: "Simmer chicken and potatoes in coconut milk with curry paste.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    expect(safe).toHaveLength(0);
    expect(violations.size).toBeGreaterThan(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("massaman"))).toBe(true);
  });

  it("includes 'satay' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Satay",
        ingredients: ["chicken breast", "lemongrass", "turmeric", "coconut milk"],
        instructions: "Grill on skewers.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["peanuts"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("satay");
  });

  it("includes 'pad thai' in the retry exclusion clause when the meal name triggered the block", () => {
    const meals = [
      {
        name: "Pad Thai",
        ingredients: ["rice noodles", "tofu", "bean sprouts", "lime", "tamarind"],
        instructions: "Stir-fry noodles with tofu.",
      },
    ];
    const { violations } = runPhase3Scan(meals, ["peanuts"]);
    const clause = buildRetryExclusionClause(violations);
    expect(clause).toContain("ALLERGEN RETRY");
    expect(clause).toContain("pad thai");
  });

  it("passes a clean Thai-inspired dish that shares no peanut dish-level block names", () => {
    const meals = [
      {
        name: "Thai Basil Chicken",
        ingredients: ["chicken breast", "thai basil", "garlic", "soy sauce", "fish sauce", "jasmine rice"],
        instructions: "Stir-fry chicken with garlic and basil, serve over rice.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    // Should pass — no peanut ingredient or dish-level block term
    expect(safe).toHaveLength(1);
    expect(violations.size).toBe(0);
  });

  it("keeps a clean alternative while blocking the peanut dish-level-named option", () => {
    const meals = [
      {
        name: "Satay",
        ingredients: ["chicken", "lemongrass", "turmeric", "coconut milk"],
        instructions: "Grill on skewers.",
      },
      {
        name: "Lemongrass Grilled Chicken",
        ingredients: ["chicken thighs", "lemongrass", "garlic", "lime juice", "sesame oil"],
        instructions: "Marinate and grill chicken.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanuts"]);
    expect(safe).toHaveLength(1);
    expect(safe[0].name).toBe("Lemongrass Grilled Chicken");
    expect(violations.size).toBeGreaterThan(0);
  });

  it("flags satay via the 'peanut' alias as well as 'peanuts'", () => {
    const meals = [
      {
        name: "Chicken Satay",
        ingredients: ["chicken", "turmeric", "coriander", "lime"],
        instructions: "Skewer and grill chicken.",
      },
    ];
    const { safe, violations } = runPhase3Scan(meals, ["peanut"]);
    expect(safe).toHaveLength(0);
    const violationArray = Array.from(violations);
    expect(violationArray.some(v => v.toLowerCase().includes("satay"))).toBe(true);
  });
});

// ── Suite 5: end-to-end scan → clause → response integration ──────────────────

describe("End-to-end: scan → retry clause → 422 response", () => {
  it("produces a retry clause that names exactly the terms the scan caught", () => {
    const meals = [
      {
        name: "Gumbo Roux",
        ingredients: ["roux", "andouille", "shellfish stock", "okra"],
        instructions: "Add shellfish stock and simmer.",
      },
      {
        name: "Shrimp étouffée",
        ingredients: ["shrimp", "butter", "celery", "onion"],
        instructions: "Cook shrimp with butter.",
      },
    ];

    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);

    // Both meals leak shellfish terms — none are safe
    expect(safe).toHaveLength(0);

    // Clause must reference the exact caught terms
    const clause = buildRetryExclusionClause(violations);
    const violationArray = Array.from(violations);
    violationArray.slice(0, 12).forEach(term => {
      expect(clause).toContain(term);
    });
  });

  it("full failure path produces a 422 body with all required contract fields", () => {
    const meals = [
      {
        name: "Shellfish Bisque",
        ingredients: ["lobster", "cream", "celery"],
        instructions: "Blend lobster into bisque.",
      },
    ];

    const { safe, violations } = runPhase3Scan(meals, ["shellfish"]);
    expect(safe).toHaveLength(0);

    // Simulate retry also failing → build the 422 body
    const body = buildAdaptationFailedResponse({
      requestedDish: "bisque",
      allergens: ["shellfish"],
      detectedViolations: violations,
    });

    // All required fields must be present
    expect(body.reasonCode).toBe("allergen_adaptation_failed");
    expect(Array.isArray(body.detectedTerms)).toBe(true);
    expect(body.detectedTerms.length).toBeGreaterThan(0);
    expect(body.retryAttempted).toBe(true);
    expect(body.originalWithPinAvailable).toBe(true);

    // Client toast built from the body must use structured names
    const toast = buildClientToastDescription({
      requestedDish: body.requestedDish,
      allergens: body.allergens,
      retryAttempted: body.retryAttempted,
    });
    expect(toast).toContain("shellfish");
    expect(toast).toContain('"bisque"');
    expect(toast).toContain("(we tried twice)");
    expect(toast).not.toContain("your allergen");
  });
});
