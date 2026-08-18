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
 *   4. Plant milks (almond milk, oat milk) must NOT trigger a dairy/milk allergy.
 *   5. Plant milks (almond milk) MUST still trigger a tree-nut allergy.
 *
 * Pure unit tests — db is mocked; no network.
 *
 * Run: npx jest server/tests/scanGeneratedOutputAllergenScan.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));

import { scanGeneratedOutput, buildGuestEnvelope } from "../services/protocolEnvelope";
import { getRequestedDishExemptTerms, scanMealsForAllergenViolations } from "../services/allergyGuardrails";

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

// ─────────────────────────────────────────────────────────────────────────────
// Plant-milk false-positive prevention
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Allergen override — category-aware suppression regression tests
// ─────────────────────────────────────────────────────────────────────────────

describe("allergen override — category-aware suppression", () => {
  const realDairyMeal = {
    name: "Cream Sauce Pasta",
    description: "Pasta in heavy cream sauce.",
    ingredients: [
      { name: "pasta" },
      { name: "heavy cream" },
      { name: "butter" },
      { name: "parmesan" },
    ],
    instructions: "Melt butter, add heavy cream, toss with pasta.",
  };

  test("overriding lactose intolerance does NOT suppress a dairy-allergy violation", () => {
    // User has BOTH dairy AND lactose intolerance; they override only lactose intolerance.
    // The dairy allergy must still block the meal.
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["dairy", "lactose intolerance"],
    } as any;
    const result = scanGeneratedOutput(realDairyMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["lactose intolerance"],
    });
    expect(result.passed).toBe(false);
    // At least one dairy-derived violation must survive
    expect(
      result.violations.some(v =>
        ["cream", "heavy cream", "butter", "parmesan", "dairy", "milk"].includes(v.term.toLowerCase()),
      ),
    ).toBe(true);
  });

  test("overriding shellfish suppresses shellfish violations only", () => {
    const shrimpMeal = {
      name: "Shrimp Stir Fry",
      description: "Quick stir fry.",
      ingredients: [{ name: "shrimp" }, { name: "garlic" }],
      instructions: "Stir fry shrimp and garlic.",
    };
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["shellfish", "dairy"],
    } as any;
    // Override shellfish but keep dairy active
    const result = scanGeneratedOutput(shrimpMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    // Shellfish/shrimp is suppressed — no shellfish violation
    expect(
      result.violations.some(v => v.category === "allergy:shellfish"),
    ).toBe(false);
    // No dairy ingredients in this meal — passes overall
    expect(result.passed).toBe(true);
  });

  test("overriding shellfish does NOT suppress dairy violations in the same meal", () => {
    const mixedMeal = {
      name: "Shrimp Cream Pasta",
      description: "Creamy shrimp pasta.",
      ingredients: [
        { name: "shrimp" },
        { name: "heavy cream" },
        { name: "butter" },
      ],
      instructions: "Cook shrimp with heavy cream and butter.",
    };
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["shellfish", "dairy"],
    } as any;
    const result = scanGeneratedOutput(mixedMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    // Shellfish violations suppressed — dairy violations must survive
    expect(result.passed).toBe(false);
    expect(
      result.violations.some(v => v.category === "allergy:dairy"),
    ).toBe(true);
    expect(
      result.violations.every(v => v.category !== "allergy:shellfish"),
    ).toBe(true);
  });
  test("overriding fish does NOT suppress the distinct shellfish allergy (no substring matching)", () => {
    // "fish" is a substring of "shellfish" — a fish override must never unlock shellfish.
    const shrimpMeal2 = {
      name: "Shrimp Stir Fry",
      description: "Quick stir fry.",
      ingredients: [{ name: "shrimp" }, { name: "garlic" }],
      instructions: "Stir fry shrimp and garlic.",
    };
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["fish", "shellfish"],
    } as any;
    const result = scanGeneratedOutput(shrimpMeal2, envelope, {
      generatorName: "test",
      overriddenAllergens: ["fish"],
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category === "allergy:shellfish")).toBe(true);

    // And the fish override DOES suppress actual fish violations
    const salmonMeal = {
      name: "Grilled Salmon",
      description: "Simple grilled fillet.",
      ingredients: [{ name: "salmon" }, { name: "lemon" }],
      instructions: "Grill the salmon.",
    };
    const result2 = scanGeneratedOutput(salmonMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["fish"],
    });
    expect(result2.violations.some(v => v.category === "allergy:fish")).toBe(false);
    expect(result2.passed).toBe(true);
  });

  test("overriding shellfish does NOT suppress the distinct fish allergy", () => {
    const salmonMeal = {
      name: "Grilled Salmon",
      description: "Simple grilled fillet.",
      ingredients: [{ name: "salmon" }, { name: "lemon" }],
      instructions: "Grill the salmon.",
    };
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["fish", "shellfish"],
    } as any;
    const result = scanGeneratedOutput(salmonMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category === "allergy:fish")).toBe(true);
  });

  test("dish adaptation guardrail context: fish override does NOT drop the shellfish allergy", () => {
    const { buildGuardrailContext } = require("../services/dishAdaptation/dishAdaptationLayer");
    const ctx = buildGuardrailContext({
      allergies: ["fish", "shellfish"],
      overriddenAllergens: ["fish"],
    });
    expect(ctx.activeAllergens).toContain("shellfish");
    expect(ctx.activeAllergens).not.toContain("fish");

    const ctx2 = buildGuardrailContext({
      allergies: ["fish", "shellfish"],
      overriddenAllergens: ["shellfish"],
    });
    expect(ctx2.activeAllergens).toContain("fish");
    expect(ctx2.activeAllergens).not.toContain("shellfish");
  });

  test("allergenKeysMatch: exact/alias matches only", () => {
    const { allergenKeysMatch } = require("../services/allergyGuardrails");
    expect(allergenKeysMatch("fish", "shellfish")).toBe(false);
    expect(allergenKeysMatch("shellfish", "fish")).toBe(false);
    expect(allergenKeysMatch("lactose intolerance", "dairy")).toBe(false);
    expect(allergenKeysMatch("shellfish", "Shellfish")).toBe(true);
    expect(allergenKeysMatch("peanut", "peanuts")).toBe(true);
    expect(allergenKeysMatch("milk", "dairy")).toBe(true);
    expect(allergenKeysMatch("tree nut", "tree nuts")).toBe(true);
  });
});

describe("plant-milk masking — dairy allergy must not block almond/oat milk", () => {
  const almondMilkMeal = {
    name: "Banana Oat Smoothie",
    description: "A plant-based smoothie.",
    ingredients: [
      { name: "banana" },
      { name: "almond milk" },
      { name: "oats" },
    ],
    instructions: "Blend almond milk with banana and oats until smooth.",
  };

  const oatMilkMeal = {
    name: "Oat Milk Latte",
    description: "A coffee drink made with oat milk.",
    ingredients: [
      { name: "espresso" },
      { name: "oat milk" },
    ],
    instructions: "Steam oat milk and pour over espresso.",
  };

  const realDairyMeal = {
    name: "Cream Pasta",
    description: "A classic cream sauce pasta.",
    ingredients: [
      { name: "pasta" },
      { name: "heavy cream" },
      { name: "butter" },
      { name: "parmesan" },
    ],
    instructions: "Melt butter in a pan, add cream and parmesan.",
  };

  test("scanGeneratedOutput: almond milk does NOT trigger dairy allergy", () => {
    const result = scanGeneratedOutput(
      almondMilkMeal,
      envelopeWithAllergies(["dairy"]),
      { generatorName: "test" },
    );
    expect(result.passed).toBe(true);
  });

  test("scanGeneratedOutput: oat milk does NOT trigger dairy allergy", () => {
    const result = scanGeneratedOutput(
      oatMilkMeal,
      envelopeWithAllergies(["dairy"]),
      { generatorName: "test" },
    );
    expect(result.passed).toBe(true);
  });

  test("scanGeneratedOutput: almond milk does NOT trigger milk allergy key", () => {
    const result = scanGeneratedOutput(
      almondMilkMeal,
      envelopeWithAllergies(["milk"]),
      { generatorName: "test" },
    );
    expect(result.passed).toBe(true);
  });

  test("scanGeneratedOutput: real dairy ingredients still fail for dairy allergy", () => {
    const result = scanGeneratedOutput(
      realDairyMeal,
      envelopeWithAllergies(["dairy"]),
      { generatorName: "test" },
    );
    expect(result.passed).toBe(false);
  });

  test("scanGeneratedOutput: almond milk DOES trigger tree-nut allergy", () => {
    // "tree nuts" is the canonical ALLERGEN_EXPANSION key (includes "almond milk" term)
    const result = scanGeneratedOutput(
      almondMilkMeal,
      envelopeWithAllergies(["tree nuts"]),
      { generatorName: "test" },
    );
    expect(result.passed).toBe(false);
    // The "almond" or "almond milk" term should be reported
    expect(
      result.violations.some(v =>
        v.term.toLowerCase().includes("almond"),
      ),
    ).toBe(true);
  });

  test("scanMealsForAllergenViolations: almond milk does NOT trigger dairy allergy", () => {
    const { safe, unsafe } = scanMealsForAllergenViolations(
      [almondMilkMeal],
      ["dairy"],
    );
    expect(safe).toHaveLength(1);
    expect(unsafe).toHaveLength(0);
  });

  test("scanMealsForAllergenViolations: oat milk does NOT trigger dairy allergy", () => {
    const { safe, unsafe } = scanMealsForAllergenViolations(
      [oatMilkMeal],
      ["dairy"],
    );
    expect(safe).toHaveLength(1);
    expect(unsafe).toHaveLength(0);
  });

  test("scanMealsForAllergenViolations: real dairy meal fails for dairy allergy", () => {
    const { safe, unsafe } = scanMealsForAllergenViolations(
      [realDairyMeal],
      ["dairy"],
    );
    expect(safe).toHaveLength(0);
    expect(unsafe).toHaveLength(1);
  });

  test("scanMealsForAllergenViolations: almond milk DOES fail for tree-nut allergy", () => {
    // "tree nuts" is the canonical ALLERGEN_EXPANSION key that includes "almond milk"
    const { safe, unsafe, violations } = scanMealsForAllergenViolations(
      [almondMilkMeal],
      ["tree nuts"],
    );
    expect(safe).toHaveLength(0);
    expect(unsafe).toHaveLength(1);
    expect(
      Array.from(violations).some(v => v.toLowerCase().includes("almond")),
    ).toBe(true);
  });

  test("scanMealsForAllergenViolations: mixed bag — dairy-safe plant-milk meal passes, real-dairy meal fails", () => {
    const { safe, unsafe } = scanMealsForAllergenViolations(
      [almondMilkMeal, oatMilkMeal, realDairyMeal],
      ["dairy"],
    );
    expect(safe).toHaveLength(2);
    expect(unsafe).toHaveLength(1);
  });
});

// ── filterMealsByProtocol — PIN override on batch paths (fridge cache/generated) ──
// The fridge-rescue/premade branch (cached AND freshly generated meals) and any
// other batch path filter meals through filterMealsByProtocol. A valid Safety
// PIN override must suppress ONLY the exact authorized allergen; other
// allergies remain enforced, and fish must never unlock shellfish.
import { filterMealsByProtocol } from "../services/protocolEnvelope";

describe("filterMealsByProtocol — overriddenAllergens (fridge cache + generated paths)", () => {
  const shrimpFriedRice = {
    name: "Shrimp Fried Rice",
    description: "Fried rice with shrimp.",
    ingredients: [{ name: "shrimp" }, { name: "rice" }, { name: "egg-free seasoning" }],
    instructions: "Fry everything.",
  };
  const chickenFriedRice = {
    name: "Chicken Fried Rice",
    description: "Fried rice with chicken.",
    ingredients: [{ name: "chicken breast" }, { name: "rice" }],
    instructions: "Fry everything.",
  };
  const butterNoodles = {
    name: "Butter Noodles",
    description: "Noodles with butter.",
    ingredients: [{ name: "noodles" }, { name: "butter" }],
    instructions: "Boil and toss.",
  };

  test("without override, shellfish meal is filtered out", () => {
    const kept = filterMealsByProtocol(
      [shrimpFriedRice, chickenFriedRice],
      envelopeWithAllergies(["shellfish"]),
      { generatorName: "fridge_rescue_cache" },
    );
    expect(kept.map(m => m.name)).toEqual(["Chicken Fried Rice"]);
  });

  test("shellfish override keeps the shrimp meal but still blocks dairy", () => {
    const kept = filterMealsByProtocol(
      [shrimpFriedRice, chickenFriedRice, butterNoodles],
      envelopeWithAllergies(["shellfish", "dairy"]),
      { generatorName: "fridge_rescue_generated", overriddenAllergens: ["shellfish"] },
    );
    expect(kept.map(m => m.name).sort()).toEqual(["Chicken Fried Rice", "Shrimp Fried Rice"]);
  });

  test("fish override does NOT unlock shellfish (exact-key matching)", () => {
    const kept = filterMealsByProtocol(
      [shrimpFriedRice, chickenFriedRice],
      envelopeWithAllergies(["shellfish"]),
      { generatorName: "fridge_rescue_cache", overriddenAllergens: ["fish"] },
    );
    expect(kept.map(m => m.name)).toEqual(["Chicken Fried Rice"]);
  });

  test("shellfish override does NOT unlock fish", () => {
    const salmonBowl = {
      name: "Salmon Bowl",
      description: "Rice bowl with salmon.",
      ingredients: [{ name: "salmon" }, { name: "rice" }],
      instructions: "Assemble.",
    };
    const kept = filterMealsByProtocol(
      [salmonBowl, chickenFriedRice],
      envelopeWithAllergies(["fish"]),
      { generatorName: "fridge_rescue_cache", overriddenAllergens: ["shellfish"] },
    );
    expect(kept.map(m => m.name)).toEqual(["Chicken Fried Rice"]);
  });
});

// ── PIN override never suppresses independent avoidances / dietary rules ─────
describe("scanGeneratedOutput — override does not relax avoidances", () => {
  test("shellfish override still blocks shrimp via an independent seafood avoidance", () => {
    const envelope = {
      ...envelopeWithAllergies(["shellfish"]),
      avoidances: ["seafood"],
    };
    const result = scanGeneratedOutput(shrimpMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    expect(result.passed).toBe(false);
    expect(result.violations.every(v => !v.category.startsWith("allergy:"))).toBe(true);
  });

  test("fish override does not suppress seafood-avoidance fish terms", () => {
    const salmonMeal = {
      name: "Salmon Bowl",
      description: "Rice bowl with salmon.",
      ingredients: [{ name: "salmon" }, { name: "rice" }],
      instructions: "Assemble.",
    };
    const envelope = {
      ...envelopeWithAllergies(["fish"]),
      avoidances: ["seafood"],
    };
    const result = scanGeneratedOutput(salmonMeal, envelope, {
      generatorName: "test",
      overriddenAllergens: ["fish"],
    });
    expect(result.passed).toBe(false);
  });

  test("shellfish override with no other constraints still passes (control)", () => {
    const result = scanGeneratedOutput(shrimpMeal, envelopeWithAllergies(["shellfish"]), {
      generatorName: "test",
      overriddenAllergens: ["shellfish"],
    });
    expect(result.passed).toBe(true);
  });
});
