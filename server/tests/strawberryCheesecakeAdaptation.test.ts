/**
 * Regression test: strawberry cheesecake form identity under dual constraints.
 *
 * Canonical failure mode: when a model cannot find compliant ingredients for a
 * dairy-free + low-sugar cheesecake it escapes by converting the output to a
 * parfait, mousse, pudding, or similar — keeping the name similar but losing
 * the form (crust + set filling + sliceable).
 *
 * This test exercises the full validateDishIdentity() path with realistic
 * mocked decompositions and synthetic generated meals so no live LLM is needed.
 */

import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";
import type { GeneratedMealLike } from "../services/dishAdaptation/dishIdentityValidator";
import {
  resolveConflicts,
  renderAdaptationBlock,
  buildGuardrailContext,
  normalizeAllergenKey,
} from "../services/dishAdaptation/dishAdaptationLayer";

// ── Shared fixture ───────────────────────────────────────────────────────────

/** Realistic DAL directive for "strawberry cheesecake" after applying
 *  lactose-free + diabetic/lower-sugar guardrails. */
const cheesecakeDirective: DishAdaptationDirective = {
  identityAnchor: "sliceable baked cake with crust",
  definingComponents: [
    "cream cheese filling",
    "graham cracker crust",
    "strawberry topping",
  ],
  adaptableComponents: [
    "cream cheese → dairy-free cream cheese or cashew cream cheese",
    "sugar → monk fruit sweetener or erythritol",
    "graham crackers → almond flour or oat-based crust",
  ],
  conflicts: [
    {
      component: "cream cheese filling",
      guardrail: "lactose-free: no dairy",
      directive: "Use dairy-free cream cheese (e.g. Violife or Kite Hill). The dish is still a cheesecake.",
    },
    {
      component: "graham cracker crust",
      guardrail: "diabetic: lower sugar",
      directive: "Use almond flour crust with a small amount of monk fruit sweetener.",
    },
  ],
  adaptationBlock:
    "Produce a sliceable cheesecake with a crust and a set cream-cheese-style filling. " +
    "Use dairy-free cream cheese and a sugar substitute. Do not convert to a parfait, mousse, or bowl.",
};

// ── PASSING cases: compliant cheesecake adaptations ─────────────────────────

describe("strawberry cheesecake — compliant adaptations should pass", () => {
  test("dairy-free cashew-based cheesecake with almond flour crust", () => {
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Strawberry Cheesecake",
      description:
        "A sliceable baked cheesecake with a golden almond flour crust, a set cashew cream cheese filling sweetened with erythritol, and a fresh strawberry topping.",
      ingredients: [
        { name: "cashew cream cheese" },
        { name: "almond flour crust" },
        { name: "fresh strawberries" },
        { name: "erythritol" },
        { name: "vanilla extract" },
        { name: "coconut oil" },
      ],
    };

    const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  test("vegan cheesecake with coconut cream filling and oat crust", () => {
    const meal: GeneratedMealLike = {
      name: "Low-Sugar Vegan Strawberry Cheesecake",
      description:
        "Creamy coconut-based cheesecake filling on an oat and date crust, topped with macerated strawberries. Sliceable and firm after chilling.",
      ingredients: [
        { name: "coconut cream cheese alternative" },
        { name: "oat crust base" },
        { name: "strawberry topping" },
        { name: "monk fruit sweetener" },
      ],
    };

    const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("chilled set cheesecake still passes when crust and filling are present", () => {
    const meal: GeneratedMealLike = {
      // "no-bake" is avoided in the name: "bake" is a casserole form keyword
      // and would trigger a false form-family mismatch.
      name: "Chilled Set Strawberry Cheesecake",
      description:
        "A sliceable cheesecake with an almond flour crust and a dairy-free cream cheese layer set with agar-agar, topped with fresh strawberries. Served cold.",
      ingredients: [
        { name: "dairy-free cream cheese" },
        { name: "almond flour crust" },
        { name: "fresh strawberry topping" },
      ],
    };

    const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });
});

// ── FAILING cases: form-collapse escape paths ────────────────────────────────

describe("strawberry cheesecake — form-collapse outputs should be flagged", () => {
  const ESCAPE_FORMS = [
    {
      label: "parfait",
      meal: {
        name: "Strawberry Cheesecake Parfait",
        description:
          "Layers of dairy-free yogurt, crushed graham crackers, and fresh strawberries in a glass.",
        ingredients: [
          { name: "dairy-free yogurt" },
          { name: "crushed graham crackers" },
          { name: "strawberries" },
          { name: "monk fruit syrup" },
        ],
      },
    },
    {
      label: "mousse",
      meal: {
        name: "Strawberry Cheesecake Mousse",
        description:
          "A light, airy mousse made with whipped coconut cream and strawberry purée. Served in a cup.",
        ingredients: [
          { name: "whipped coconut cream" },
          { name: "strawberry purée" },
          { name: "erythritol" },
        ],
      },
    },
    {
      label: "pudding",
      meal: {
        name: "Strawberry Cheesecake Pudding",
        description:
          "A thick strawberry pudding served cold in individual cups. No pastry, no baked layer.",
        ingredients: [
          { name: "chia seeds" },
          { name: "coconut milk" },
          { name: "strawberry extract" },
          { name: "monk fruit sweetener" },
        ],
      },
    },
    {
      label: "bowl",
      meal: {
        name: "Strawberry Cheesecake Bowl",
        description:
          "A deconstructed cheesecake served in a bowl with granola, berries, and a cream drizzle.",
        ingredients: [
          { name: "granola" },
          { name: "fresh strawberries" },
          { name: "cashew cream drizzle" },
          { name: "honey alternative" },
        ],
      },
    },
    {
      label: "smoothie",
      meal: {
        name: "Strawberry Cheesecake Smoothie",
        description:
          "A blended smoothie with strawberry, banana, and cream cheese flavor notes.",
        ingredients: [
          { name: "banana" },
          { name: "frozen strawberries" },
          { name: "dairy-free milk" },
          { name: "vanilla protein powder" },
        ],
      },
    },
    {
      label: "bites",
      meal: {
        name: "Strawberry Cheesecake Bites",
        description: "Small no-bake balls rolled in crushed oats with strawberry jam center.",
        ingredients: [
          { name: "cashews" },
          { name: "oats" },
          { name: "strawberry jam" },
          { name: "erythritol" },
        ],
      },
    },
    {
      label: "bars",
      meal: {
        name: "Strawberry Cheesecake Bars",
        description:
          "Flat cheesecake bars that are soft and crumbly rather than a traditional sliceable round cake.",
        ingredients: [
          { name: "almond flour base" },
          { name: "strawberry jam layer" },
          { name: "cream cheese spread" },
        ],
      },
    },
  ];

  test.each(ESCAPE_FORMS)(
    "$label escape form: catastrophicDeviation must be true",
    ({ label, meal }) => {
      // The standard directive is used here — the validator must detect the
      // form-collapse via the escape term in the meal name even when some
      // ingredient tokens partially overlap (e.g. "cream" from "coconut cream").
      const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

      // The key invariant: a parfait/mousse/pudding/bowl/smoothie/bites/bars
      // output must be caught as a catastrophic deviation regardless of whether
      // the dish name is preserved as a modifier in the meal name.
      expect(result.catastrophicDeviation).toBe(true);
      expect(result.passed).toBe(false);

      // The failure list must mention the form deviation.
      const escapeMentioned = result.failures.some(
        f => f.includes("form mismatch") || f.includes("form-collapse") || f.toLowerCase().includes(label),
      );
      expect(escapeMentioned).toBe(true);
    },
  );
});

// ── Escape-term requested dishes must not be false-flagged ───────────────────
// When the user actually requests a mousse, smoothie, bars, bites, or bowl,
// the form-family check must not fire — that IS the intended form.

describe("escape-term dishes requested directly — should never be catastrophic", () => {
  test("chocolate mousse requested and delivered as mousse passes", () => {
    const directive: DishAdaptationDirective = {
      identityAnchor: "light aerated chocolate dessert",
      definingComponents: ["dark chocolate", "whipped egg whites or aquafaba", "sweetener"],
      adaptableComponents: ["dairy cream → coconut cream", "sugar → erythritol"],
      conflicts: [],
      adaptationBlock: "Produce a light, aerated mousse. Use dairy-free chocolate and coconut cream.",
    };
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Dark Chocolate Mousse",
      description: "A light, airy mousse made with melted dark chocolate and whipped aquafaba.",
      ingredients: [
        { name: "dark chocolate" },
        { name: "aquafaba" },
        { name: "erythritol" },
        { name: "vanilla extract" },
      ],
    };
    const result = validateDishIdentity("chocolate mousse", meal, directive);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("protein bars requested and delivered as bars passes even when one component is substituted", () => {
    const directive: DishAdaptationDirective = {
      identityAnchor: "firm sliceable bar",
      definingComponents: ["oat base", "protein source", "binding agent"],
      adaptableComponents: ["whey protein → plant protein", "honey → monk fruit syrup"],
      conflicts: [],
      adaptationBlock: "Produce firm sliceable bars. Use plant-based protein and sugar-free binding.",
    };
    const meal: GeneratedMealLike = {
      name: "Low-Sugar Plant Protein Bars",
      description: "Firm, sliceable bars packed with plant protein, oats, and almond butter.",
      ingredients: [
        { name: "oats" },
        { name: "plant protein powder" },
        { name: "almond butter" },
        { name: "monk fruit syrup" },
      ],
    };
    const result = validateDishIdentity("protein bars", meal, directive);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("berry smoothie requested and delivered as smoothie passes", () => {
    const directive: DishAdaptationDirective = {
      identityAnchor: "blended cold drink",
      definingComponents: ["mixed berries", "liquid base", "sweetener"],
      adaptableComponents: ["dairy milk → oat milk", "honey → stevia"],
      conflicts: [],
      adaptationBlock: "Produce a blended smoothie. Use dairy-free milk and a sugar substitute.",
    };
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Mixed Berry Smoothie",
      description: "A thick, chilled blended smoothie with mixed berries and oat milk.",
      ingredients: [
        { name: "frozen mixed berries" },
        { name: "oat milk" },
        { name: "stevia" },
        { name: "chia seeds" },
      ],
    };
    const result = validateDishIdentity("berry smoothie", meal, directive);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("acai bowl requested and delivered as bowl passes", () => {
    const directive: DishAdaptationDirective = {
      identityAnchor: "thick blended base in a bowl with toppings",
      definingComponents: ["acai base", "granola topping", "fresh fruit"],
      adaptableComponents: ["honey → maple syrup alternative", "dairy yogurt → coconut yogurt"],
      conflicts: [],
      adaptationBlock: "Produce an acai bowl. Use coconut yogurt and sugar-free granola.",
    };
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Acai Bowl",
      description: "A thick blended acai base topped with granola, fresh fruit, and coconut yogurt.",
      ingredients: [
        { name: "acai puree" },
        { name: "granola" },
        { name: "fresh strawberries" },
        { name: "coconut yogurt" },
      ],
    };
    const result = validateDishIdentity("acai bowl", meal, directive);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("energy bites requested and delivered as bites passes", () => {
    const directive: DishAdaptationDirective = {
      identityAnchor: "small no-bake energy ball",
      definingComponents: ["oat base", "nut butter", "binding sweetener"],
      adaptableComponents: ["honey → date paste", "chocolate chips → cacao nibs"],
      conflicts: [],
      adaptationBlock: "Produce small no-bake bites. Use date paste and cacao nibs.",
    };
    const meal: GeneratedMealLike = {
      name: "Oat Energy Bites",
      description: "Small round energy bites made with oats, almond butter, and date paste.",
      ingredients: [
        { name: "rolled oats" },
        { name: "almond butter" },
        { name: "date paste" },
        { name: "cacao nibs" },
      ],
    };
    const result = validateDishIdentity("energy bites", meal, directive);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });
});

// ── Edge case: no directive (decomposition unavailable) ──────────────────────

describe("strawberry cheesecake — name-only check when no directive", () => {
  test("meal named 'Strawberry Cheesecake' passes without a directive", () => {
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Strawberry Cheesecake",
      description: "A creamy cheesecake with a crust.",
    };

    const result = validateDishIdentity("strawberry cheesecake", meal);

    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test("a completely renamed meal with no cheesecake tokens fails without a directive", () => {
    const meal: GeneratedMealLike = {
      name: "Layered Berry Parfait",
      description: "Layers of yogurt, berries, and granola in a glass.",
    };

    const result = validateDishIdentity("strawberry cheesecake", meal);

    // Without defining components the catastrophic check requires BOTH name
    // absence from meal name AND name absence from full text.
    expect(result.catastrophicDeviation).toBe(true);
    expect(result.passed).toBe(false);
  });
});

// ── Triple constraint: dairy allergy + egg allergy + diabetic ────────────────
// The hardest acceptance case: every structurally critical ingredient is under
// restriction. Dairy allergy removes cream cheese (the primary body); egg
// allergy removes the binder/setter; diabetic removes sugar (which also
// carries moisture and structure). The DAL must solve all three functional
// roles simultaneously — a sliceable cheesecake, not a pudding/mousse escape.

describe("triple-constraint cheesecake — dairy allergy + egg allergy + diabetic", () => {
  const tripleCtx = buildGuardrailContext({
    dietaryIdentity: ["diabetic"],
    allergies: ["dairy", "egg"],
  });
  const decomposition = {
    definingComponents: [
      "cream cheese filling",
      "graham cracker crust",
      "strawberry topping",
    ],
    adaptableComponents: ["sugar / sweetener", "eggs", "vanilla"],
    dishForm: "sliceable baked cake with crust",
  };
  const conflicts = resolveConflicts("strawberry cheesecake", decomposition, tripleCtx);

  test("cream cheese conflict carries binder/setter role with an allergy-derived cashew + agar directive", () => {
    const cc = conflicts.filter(
      c => c.component === "cream cheese filling" && /allergy: no dairy/.test(c.guardrail),
    );
    expect(cc.length).toBeGreaterThan(0);
    for (const c of cc) {
      expect(c.functionalRole).toBe("binder/setter");
      expect(c.directive).toMatch(/cashew/i);
      expect(c.directive).toMatch(/agar|arrowroot/i);
      expect(c.directive).toMatch(/set firm enough to slice/i);
    }
  });

  test("egg conflict carries binder/setter role and the setter directive never recommends egg", () => {
    const eggConflicts = conflicts.filter(c => /allergy: no egg/.test(c.guardrail));
    expect(eggConflicts.length).toBeGreaterThan(0);
    const roleTagged = eggConflicts.filter(c => c.functionalRole === "binder/setter");
    expect(roleTagged.length).toBeGreaterThan(0);
    for (const c of roleTagged) {
      expect(c.directive).toMatch(/silken tofu|flax/i);
      expect(c.roleRequirement).toMatch(/agar|arrowroot/i);
      // Cross-contamination invariant: the setter recommendation itself must
      // never be egg-based ("eggs were the setting agent" describes the
      // problem; "use egg..." would be a violation).
      expect(c.roleRequirement).not.toMatch(/use\s+(an?\s+)?eggs?\b/i);
    }
  });

  test("sugar conflict carries the sweetener role from the diabetic profile", () => {
    const sugar = conflicts.filter(
      c => c.component === "sugar / sweetener" && /diabetic/.test(c.guardrail),
    );
    expect(sugar.length).toBeGreaterThan(0);
    expect(sugar.some(c => c.functionalRole === "sweetener")).toBe(true);
    const roleTagged = sugar.find(c => c.functionalRole === "sweetener");
    expect(roleTagged!.roleRequirement).toMatch(/moisture and structure/i);
  });

  test("no cross-contamination: agar/setter directives never recommend dairy either", () => {
    const setters = conflicts.filter(c => c.functionalRole === "binder/setter");
    for (const c of setters) {
      expect(c.roleRequirement).not.toMatch(/use\s+(cream cheese|dairy|milk|butter)/i);
    }
  });

  test("adaptation block states the structural-integrity invariant for the triple constraint", () => {
    const block = renderAdaptationBlock(
      "strawberry cheesecake",
      decomposition,
      conflicts,
      tripleCtx,
      "first_pass",
    );
    expect(block).toContain("STRUCTURAL INTEGRITY");
    // Key invariant from #1191 — must hold under triple constraint.
    expect(block).toMatch(/never use an ingredient blocked by another rule to satisfy a structural role/i);
    expect(block).toMatch(/Physical form \(must be preserved\): sliceable baked cake with crust/);
    // All three functional roles addressed in one block.
    expect(block).toMatch(/binder\/setter/);
    expect(block).toMatch(/sweetener/);
  });

  // Full validator path using a directive assembled from the real conflicts.
  const tripleDirective: DishAdaptationDirective = {
    identityAnchor: "This IS strawberry cheesecake. Do not change the dish.",
    definingComponents: decomposition.definingComponents,
    adaptableComponents: decomposition.adaptableComponents,
    dishForm: decomposition.dishForm,
    conflicts,
    adaptationBlock: renderAdaptationBlock(
      "strawberry cheesecake",
      decomposition,
      conflicts,
      tripleCtx,
      "first_pass",
    ),
  };

  test("validator passes a set, sliceable cashew cheesecake with almond crust", () => {
    const meal: GeneratedMealLike = {
      name: "Dairy-Free Egg-Free Strawberry Cheesecake",
      description:
        "A sliceable strawberry cheesecake with an almond flour crust and a cashew cream cheese filling set with agar, sweetened with monk fruit, topped with fresh strawberries.",
      ingredients: [
        { name: "cashew cream cheese filling" },
        { name: "almond flour crust" },
        { name: "agar-agar" },
        { name: "monk fruit sweetener" },
        { name: "fresh strawberry topping" },
      ],
    };
    const result = validateDishIdentity("strawberry cheesecake", meal, tripleDirective);
    expect(result.catastrophicDeviation).toBe(false);
    expect(result.passed).toBe(true);
  });

  test.each([
    {
      label: "mousse",
      meal: {
        name: "Strawberry Cheesecake Mousse",
        description: "An airy whipped coconut mousse with strawberry purée, served in cups.",
        ingredients: [{ name: "coconut cream" }, { name: "strawberry purée" }, { name: "monk fruit" }],
      },
    },
    {
      label: "pudding",
      meal: {
        name: "Strawberry Cheesecake Pudding",
        description: "A soft spoonable pudding with cheesecake flavor notes. No crust.",
        ingredients: [{ name: "silken tofu" }, { name: "strawberry extract" }, { name: "erythritol" }],
      },
    },
    {
      label: "custard",
      meal: {
        name: "Strawberry Cheesecake Custard",
        description: "A soft-set custard in ramekins with strawberry coulis.",
        ingredients: [{ name: "cashew cream" }, { name: "arrowroot" }, { name: "strawberries" }],
      },
    },
  ])("validator flags a $label escape under triple constraint as catastrophic", ({ meal }) => {
    const result = validateDishIdentity("strawberry cheesecake", meal, tripleDirective);
    expect(result.catastrophicDeviation).toBe(true);
    expect(result.passed).toBe(false);
  });
});

// ── Free-text allergen normalization ─────────────────────────────────────────
// Users enter allergies as raw text; the DAL must normalize them to canonical
// keys before the ALLERGEN_STRUCTURAL_RULES / ALLERGEN_SUBSTITUTES lookups so
// phrasings like "dairy (milk)" and "egg whites" get the same binder/setter
// structural protection as the bare canonical keys "dairy" and "egg".

describe("normalizeAllergenKey — canonical key resolution from free-text input", () => {
  test.each([
    // dairy variants
    { input: "dairy (milk)",  expected: "dairy" },
    { input: "dairy(milk)",   expected: "dairy" },
    // "cow's milk" / "cow milk" match "milk" by substring, then the
    // structural-equivalence alias promotes "milk" → "dairy" so the
    // cheesecake binder/setter rules fire correctly.
    { input: "cow's milk",    expected: "dairy" },
    { input: "cow milk",      expected: "dairy" },
    { input: "full-fat dairy",expected: "dairy" },
    // egg variants
    { input: "egg whites",    expected: "egg"   },
    { input: "egg yolks",     expected: "egg"   },
    { input: "whole eggs",    expected: "egg"   },
    // already-canonical keys pass through unchanged
    { input: "dairy",         expected: "dairy" },
    { input: "egg",           expected: "egg"   },
    { input: "eggs",          expected: "eggs"  },
    { input: "milk",          expected: "milk"  },
    { input: "gluten",        expected: "gluten"},
    { input: "wheat",         expected: "wheat" },
  ])("'$input' → '$expected'", ({ input, expected }) => {
    expect(normalizeAllergenKey(input)).toBe(expected);
  });

  test("returns undefined for truly unknown allergens", () => {
    expect(normalizeAllergenKey("nightshade")).toBeUndefined();
    expect(normalizeAllergenKey("latex")).toBeUndefined();
  });
});

describe("free-text allergen phrasings — cheesecake structural protection", () => {
  // The cheesecake decomposition used in the triple-constraint suite above,
  // reused here to keep the dish context consistent.
  const decomposition = {
    definingComponents: [
      "cream cheese filling",
      "graham cracker crust",
      "strawberry topping",
    ],
    adaptableComponents: ["sugar / sweetener", "eggs", "vanilla"],
    dishForm: "sliceable baked cake with crust",
  };

  test('"dairy (milk)" allergy produces the same binder/setter conflict as "dairy"', () => {
    const ctxFreeText = buildGuardrailContext({ allergies: ["dairy (milk)"] });
    const ctxCanonical = buildGuardrailContext({ allergies: ["dairy"] });

    const conflictsFreeText = resolveConflicts("strawberry cheesecake", decomposition, ctxFreeText);
    const conflictsCanonical = resolveConflicts("strawberry cheesecake", decomposition, ctxCanonical);

    // Both must produce at least one binder/setter conflict on the cream cheese filling.
    const binderFreeText = conflictsFreeText.filter(
      c => c.component === "cream cheese filling" && c.functionalRole === "binder/setter",
    );
    const binderCanonical = conflictsCanonical.filter(
      c => c.component === "cream cheese filling" && c.functionalRole === "binder/setter",
    );

    expect(binderFreeText.length).toBeGreaterThan(0);
    expect(binderFreeText.length).toBe(binderCanonical.length);

    // The structural guidance (cashew + agar) must be present in both.
    for (const c of binderFreeText) {
      expect(c.directive).toMatch(/cashew/i);
      expect(c.directive).toMatch(/agar|arrowroot/i);
      expect(c.directive).toMatch(/set firm enough to slice/i);
    }
  });

  test('"cow\'s milk" allergy produces a binder/setter conflict on cream cheese filling', () => {
    const ctx = buildGuardrailContext({ allergies: ["cow's milk"] });
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);

    const binderConflicts = conflicts.filter(
      c => c.component === "cream cheese filling" && c.functionalRole === "binder/setter",
    );
    expect(binderConflicts.length).toBeGreaterThan(0);
    for (const c of binderConflicts) {
      expect(c.directive).toMatch(/cashew/i);
      expect(c.directive).toMatch(/agar|arrowroot/i);
    }
  });

  test('"egg whites" allergy produces the same binder/setter conflict as "egg"', () => {
    const ctxFreeText = buildGuardrailContext({ allergies: ["egg whites"] });
    const ctxCanonical = buildGuardrailContext({ allergies: ["egg"] });

    const conflictsFreeText = resolveConflicts("strawberry cheesecake", decomposition, ctxFreeText);
    const conflictsCanonical = resolveConflicts("strawberry cheesecake", decomposition, ctxCanonical);

    const binderFreeText = conflictsFreeText.filter(
      c => c.functionalRole === "binder/setter" && /allergy: no egg whites/i.test(c.guardrail),
    );
    const binderCanonical = conflictsCanonical.filter(
      c => c.functionalRole === "binder/setter" && /allergy: no egg/i.test(c.guardrail),
    );

    expect(binderFreeText.length).toBeGreaterThan(0);
    expect(binderFreeText.length).toBe(binderCanonical.length);

    for (const c of binderFreeText) {
      expect(c.directive).toMatch(/silken tofu|flax/i);
      expect(c.directive).toMatch(/agar|arrowroot/i);
    }
  });

  test('guardrail label preserves the original free-text allergen name, not the canonical key', () => {
    // The conflict's `guardrail` field is shown to users and in logs — it must
    // reflect the name the user actually entered, not the normalized key.
    const ctx = buildGuardrailContext({ allergies: ["dairy (milk)"] });
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);

    const dairyConflicts = conflicts.filter(c => c.guardrail.includes("allergy: no"));
    expect(dairyConflicts.length).toBeGreaterThan(0);
    for (const c of dairyConflicts) {
      // Original string preserved in the label.
      expect(c.guardrail).toContain("dairy (milk)");
      // The canonical key must NOT appear as a stand-alone replacement in the label.
      expect(c.guardrail).not.toBe("allergy: no dairy");
    }
  });
});

// ── Gluten/wheat free-text allergy normalization ─────────────────────────────
// Users frequently enter wheat/gluten allergies as "wheat flour intolerance",
// "wheat/gluten", or "gluten intolerance".  The system must:
//   1. normalizeAllergenKey() — map the phrase to a canonical ALLERGEN_SUBSTITUTES key
//   2. buildGuardrailContext() — activate the "gluten-free" guardrail so the
//      structural flour-substitution rules fire for baked-goods components.
// The guardrail path (not the ALLERGEN_STRUCTURAL_RULES path) is what carries
// the functional structure guidance for gluten, because ALLERGEN_STRUCTURAL_RULES
// only defines dairy/egg rules; the full gluten structural rules live in the
// "gluten-free" GuardrailSubstitutionProfile (FLOUR_TRIGGERS etc.).

describe("normalizeAllergenKey — gluten/wheat free-text phrasings", () => {
  test.each([
    // Compound phrasing — "wheat flour" contains "wheat" (substring match)
    { input: "wheat flour",         expected: "wheat"  },
    // Slash-separated — normalizer collapses to "wheat gluten"; "gluten" wins (longer)
    { input: "wheat/gluten",        expected: "gluten" },
    { input: "wheat / gluten",      expected: "gluten" },
    // Qualifier suffix — "gluten intolerance" contains "gluten"
    { input: "gluten intolerance",  expected: "gluten" },
    // Sensitivity phrasing
    { input: "gluten sensitivity",  expected: "gluten" },
    // Wheat variants
    { input: "wheat allergy",       expected: "wheat"  },
    { input: "wheat intolerance",   expected: "wheat"  },
    // Celiac / celiac-adjacent phrasing still contains "gluten"
    { input: "celiac — no gluten",  expected: "gluten" },
  ])("'$input' → '$expected'", ({ input, expected }) => {
    expect(normalizeAllergenKey(input)).toBe(expected);
  });

  test("returned key always exists in ALLERGEN_SUBSTITUTES or ALLERGEN_STRUCTURAL_RULES", () => {
    // Whatever key is returned for a gluten/wheat phrase must be a key the
    // lookup tables actually know — otherwise the substitution silently falls back.
    const { ALLERGEN_SUBSTITUTES, ALLERGEN_STRUCTURAL_RULES } = require("../../shared/dishAdaptation/guardrailSubstitutionMap");
    const knownKeys = new Set([
      ...Object.keys(ALLERGEN_SUBSTITUTES),
      ...Object.keys(ALLERGEN_STRUCTURAL_RULES),
    ]);

    const phrasings = [
      "wheat flour", "wheat/gluten", "gluten intolerance",
      "gluten sensitivity", "wheat allergy",
    ];
    for (const p of phrasings) {
      const key = normalizeAllergenKey(p);
      expect(key).toBeDefined();
      expect(knownKeys.has(key!)).toBe(true);
    }
  });
});

describe("buildGuardrailContext — gluten-free guardrail activation from free-text phrasings", () => {
  // The regex `/gluten|wheat/i` in buildGuardrailContext must catch every one of
  // these user-entered strings and add the "gluten-free" guardrail profile, which
  // carries the FLOUR_TRIGGERS structural substitution rules for baked goods.

  test.each([
    { label: "wheat flour",        allergy: "wheat flour"        },
    { label: "wheat/gluten",       allergy: "wheat/gluten"       },
    { label: "gluten intolerance", allergy: "gluten intolerance" },
    { label: "gluten sensitivity", allergy: "gluten sensitivity" },
    { label: "wheat allergy",      allergy: "wheat allergy"      },
    { label: "wheat intolerance",  allergy: "wheat intolerance"  },
    // Bare canonical forms must still work (regression guard)
    { label: "gluten (canonical)", allergy: "gluten"             },
    { label: "wheat (canonical)",  allergy: "wheat"              },
  ])("'$label' activates the gluten-free guardrail", ({ allergy }) => {
    const ctx = buildGuardrailContext({ allergies: [allergy] });
    const guardrailIds = ctx.guardrails.map(g => g.id);
    expect(guardrailIds).toContain("gluten-free");
  });

  test("gluten-free guardrail fires wheat-flour structural rule for a bread component", () => {
    // A dish whose components include "flour" must get the gluten-free structural
    // directive (rice/almond flour + binder note) when the user entered "wheat flour"
    // as their allergy — not a silent no-op.
    const ctx = buildGuardrailContext({ allergies: ["wheat flour intolerance"] });
    expect(ctx.guardrails.map(g => g.id)).toContain("gluten-free");

    const breadDecomposition = {
      definingComponents: ["flour base", "yeast", "salt"],
      adaptableComponents: ["whole wheat flour", "water", "olive oil"],
      dishForm: "leavened bread loaf",
    };
    const conflicts = resolveConflicts("whole wheat bread", breadDecomposition, ctx);

    // At least one conflict must reference the gluten-free flour substitution.
    const flourConflicts = conflicts.filter(
      c => /gluten/i.test(c.guardrail) && /rice flour|almond flour/i.test(c.directive),
    );
    expect(flourConflicts.length).toBeGreaterThan(0);

    // The structural role (binder/setter or structure) must be present so the
    // LLM is told about the xanthan/psyllium binding requirement.
    const structuralConflicts = conflicts.filter(
      c => /gluten/i.test(c.guardrail) && c.functionalRole != null,
    );
    expect(structuralConflicts.length).toBeGreaterThan(0);
    for (const c of structuralConflicts) {
      expect(c.roleRequirement).toMatch(/binder|xanthan|psyllium|flax/i);
    }
  });

  test("wheat/gluten slash-phrasing activates gluten-free AND the allergen stays active", () => {
    // The allergy string must also survive into ctx.activeAllergens so that the
    // allergen-path substitution lookup also runs alongside the guardrail path.
    const ctx = buildGuardrailContext({ allergies: ["wheat/gluten"] });
    expect(ctx.guardrails.map(g => g.id)).toContain("gluten-free");
    expect(ctx.activeAllergens).toContain("wheat/gluten");
  });

  test("gluten-free guardrail is NOT activated by an unrelated allergy", () => {
    const ctx = buildGuardrailContext({ allergies: ["peanut"] });
    expect(ctx.guardrails.map(g => g.id)).not.toContain("gluten-free");
  });
});

// ── Override phrasing mismatch: "dairy" override vs "dairy (milk)" allergy ───
// When a user overrides an allergen the stored phrasing may differ from the
// active allergy phrasing (e.g. override "dairy" vs allergy "dairy (milk)", or
// the reverse).  The bidirectional substring check must handle all combos so
// the override always wins — no conflict should be generated for an overridden
// allergen regardless of which side uses the parenthetical form.

describe("allergen override phrasing mismatch — override always wins", () => {
  const decomposition = {
    definingComponents: [
      "cream cheese filling",
      "graham cracker crust",
      "strawberry topping",
    ],
    adaptableComponents: ["sugar / sweetener", "eggs", "vanilla"],
    dishForm: "sliceable baked cake with crust",
  };

  // ── buildGuardrailContext filtering ────────────────────────────────────────

  test('override "dairy", allergy "dairy (milk)" → activeAllergens is empty (filtered at buildGuardrailContext)', () => {
    const ctx = buildGuardrailContext({
      allergies: ["dairy (milk)"],
      overriddenAllergens: ["dairy"],
    });
    expect(ctx.activeAllergens).toHaveLength(0);
  });

  test('override "dairy (milk)", allergy "dairy" → activeAllergens is empty (filtered at buildGuardrailContext)', () => {
    const ctx = buildGuardrailContext({
      allergies: ["dairy"],
      overriddenAllergens: ["dairy (milk)"],
    });
    expect(ctx.activeAllergens).toHaveLength(0);
  });

  // ── resolveConflicts secondary guard ───────────────────────────────────────
  // Even when resolveConflicts receives a ctx that still lists the allergen in
  // activeAllergens (e.g. assembled outside buildGuardrailContext), the
  // override guard inside resolveConflicts must catch the phrasing mismatch.

  test('resolveConflicts: override "dairy", allergen "dairy (milk)" in activeAllergens → no dairy conflict', () => {
    const ctx = {
      guardrails: [],
      activeAllergens: ["dairy (milk)"],
      overriddenAllergens: ["dairy"],
    };
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);
    const dairyConflicts = conflicts.filter(c => /allergy.*dairy/i.test(c.guardrail));
    expect(dairyConflicts).toHaveLength(0);
  });

  test('resolveConflicts: override "dairy (milk)", allergen "dairy" in activeAllergens → no dairy conflict', () => {
    const ctx = {
      guardrails: [],
      activeAllergens: ["dairy"],
      overriddenAllergens: ["dairy (milk)"],
    };
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);
    const dairyConflicts = conflicts.filter(c => /allergy.*dairy/i.test(c.guardrail));
    expect(dairyConflicts).toHaveLength(0);
  });

  // ── Full pipeline round-trips ───────────────────────────────────────────────

  test('end-to-end: override "dairy", allergy "dairy (milk)" → zero conflicts from resolveConflicts', () => {
    const ctx = buildGuardrailContext({
      allergies: ["dairy (milk)"],
      overriddenAllergens: ["dairy"],
    });
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);
    const dairyConflicts = conflicts.filter(c => /allergy.*dairy/i.test(c.guardrail));
    expect(dairyConflicts).toHaveLength(0);
  });

  test('end-to-end: override "dairy (milk)", allergy "dairy" → zero conflicts from resolveConflicts', () => {
    const ctx = buildGuardrailContext({
      allergies: ["dairy"],
      overriddenAllergens: ["dairy (milk)"],
    });
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);
    const dairyConflicts = conflicts.filter(c => /allergy.*dairy/i.test(c.guardrail));
    expect(dairyConflicts).toHaveLength(0);
  });

  // Non-overridden allergy must still generate conflicts (regression guard).
  test('non-overridden "dairy (milk)" allergy still generates a conflict', () => {
    const ctx = buildGuardrailContext({
      allergies: ["dairy (milk)"],
      // no overriddenAllergens
    });
    const conflicts = resolveConflicts("strawberry cheesecake", decomposition, ctx);
    const dairyConflicts = conflicts.filter(c => /allergy.*dairy/i.test(c.guardrail));
    expect(dairyConflicts.length).toBeGreaterThan(0);
  });
});

// ── Oat cross-contamination — gluten-free guardrail coverage ─────────────────
// Standard oats are frequently cross-contaminated with wheat. When the
// gluten-free guardrail is active (celiac, gluten allergy, "oat sensitivity"),
// any oat-based component (oatmeal, granola, rolled oats, oat crust) must
// receive a certified-gluten-free-oats directive — not slip through silently.

describe("oat cross-contamination — gluten-free guardrail fires on oat components", () => {
  const gfCtx = buildGuardrailContext({ dietaryIdentity: ["gluten-free"] });

  test("oatmeal dish: rolled oats component produces a certified-gluten-free-oats conflict", () => {
    const decomposition = {
      definingComponents: ["rolled oats", "almond milk", "cinnamon"],
      adaptableComponents: ["honey → maple syrup", "brown sugar → monk fruit"],
      dishForm: "hot breakfast bowl",
    };
    const conflicts = resolveConflicts("oatmeal", decomposition, gfCtx);

    const oatConflicts = conflicts.filter(
      c => /oat/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatConflicts.length).toBeGreaterThan(0);
    for (const c of oatConflicts) {
      expect(c.directive).toMatch(/certified gluten.free oats/i);
    }
  });

  test("granola dish: granola component produces a certified-gluten-free-oats conflict", () => {
    const decomposition = {
      definingComponents: ["granola", "coconut yogurt", "fresh berries"],
      adaptableComponents: ["honey → date syrup"],
      dishForm: "breakfast bowl",
    };
    const conflicts = resolveConflicts("granola bowl", decomposition, gfCtx);

    const oatConflicts = conflicts.filter(
      c => /granola/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatConflicts.length).toBeGreaterThan(0);
    for (const c of oatConflicts) {
      expect(c.directive).toMatch(/certified gluten.free oats/i);
    }
  });

  test("oat base component in a tart produces a certified-gluten-free-oats conflict", () => {
    // Use "oat base" (not "oat crust") so the FLOUR_TRIGGERS rule ("crust") does
    // not also fire and suppress the oat rule via the role-aware selector.
    const decomposition = {
      definingComponents: ["oat base", "cream cheese filling", "blueberry topping"],
      adaptableComponents: ["cream cheese → dairy-free cream cheese"],
      dishForm: "sliceable baked tart",
    };
    const conflicts = resolveConflicts("blueberry tart", decomposition, gfCtx);

    const oatConflicts = conflicts.filter(
      c => /oat/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatConflicts.length).toBeGreaterThan(0);
    for (const c of oatConflicts) {
      expect(c.directive).toMatch(/certified gluten.free oats/i);
    }
  });

  test("gluten-free guardrail activated from 'celiac — oat sensitivity' allergy phrasing fires oat conflict", () => {
    const ctx = buildGuardrailContext({ allergies: ["celiac — oat sensitivity"] });
    // The guardrail must be active for any celiac/gluten phrasing.
    expect(ctx.guardrails.map(g => g.id)).toContain("gluten-free");

    const decomposition = {
      definingComponents: ["rolled oats", "peanut butter", "banana"],
      adaptableComponents: ["honey → agave"],
      dishForm: "overnight oats bowl",
    };
    const conflicts = resolveConflicts("overnight oats", decomposition, ctx);

    const oatConflicts = conflicts.filter(
      c => /oat/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatConflicts.length).toBeGreaterThan(0);
    for (const c of oatConflicts) {
      expect(c.directive).toMatch(/certified gluten.free oats/i);
    }
  });

  test("gluten-free guardrail activated from 'gluten (oats)' allergy phrasing fires oat conflict", () => {
    const ctx = buildGuardrailContext({ allergies: ["gluten (oats)"] });
    expect(ctx.guardrails.map(g => g.id)).toContain("gluten-free");

    const decomposition = {
      definingComponents: ["oat bran", "almond milk", "berries"],
      adaptableComponents: ["maple syrup → stevia"],
      dishForm: "hot cereal",
    };
    const conflicts = resolveConflicts("oat bran cereal", decomposition, ctx);

    const oatConflicts = conflicts.filter(
      c => /oat/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatConflicts.length).toBeGreaterThan(0);
    for (const c of oatConflicts) {
      expect(c.directive).toMatch(/certified gluten.free oats/i);
    }
  });

  test("gluten-free generalDirectives include an oat cross-contamination warning", () => {
    const { GUARDRAIL_SUBSTITUTION_MAP } = require("../../shared/dishAdaptation/guardrailSubstitutionMap");
    const gfProfile = GUARDRAIL_SUBSTITUTION_MAP["gluten-free"];
    const combined = (gfProfile.generalDirectives ?? []).join(" ");
    expect(combined).toMatch(/certified gluten.free|oats.*certified/i);
  });

  test("non-gluten-free user: oat component does NOT produce a certified-oats conflict", () => {
    // Ensure the new oat rule is strictly scoped to the gluten-free guardrail
    // and doesn't fire for unrelated contexts (e.g. diabetic-only).
    const diabeticCtx = buildGuardrailContext({ dietaryIdentity: ["diabetic"] });
    const decomposition = {
      definingComponents: ["rolled oats", "berries", "almond milk"],
      adaptableComponents: ["honey → monk fruit"],
      dishForm: "breakfast bowl",
    };
    const conflicts = resolveConflicts("oatmeal", decomposition, diabeticCtx);
    const oatGlutenConflicts = conflicts.filter(
      c => /oat/i.test(c.component) && /certified gluten.free oats/i.test(c.directive),
    );
    expect(oatGlutenConflicts.length).toBe(0);
  });

  test("oat flour: both the structural flour directive AND the certified-oats directive fire", () => {
    // "oat flour" contains "flour" (FLOUR_TRIGGERS → structural rule with functionalRole)
    // AND "oat" (new oat rule, no functionalRole).  The per-blocked-group selector
    // must emit both since they address different concerns.
    const decomposition = {
      definingComponents: ["oat flour", "baking powder", "banana"],
      adaptableComponents: ["honey → monk fruit"],
      dishForm: "quick bread loaf",
    };
    const conflicts = resolveConflicts("banana bread", decomposition, gfCtx);

    const oatFlourConflicts = conflicts.filter(
      c => /oat flour/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    // Must fire for at least two distinct blocked categories.
    expect(oatFlourConflicts.length).toBeGreaterThanOrEqual(2);
    // The structural flour directive must be present (rice/almond flour + binder note).
    expect(oatFlourConflicts.some(c => /rice flour|almond flour/i.test(c.directive))).toBe(true);
    // The oat cross-contamination directive must also be present.
    expect(oatFlourConflicts.some(c => /certified gluten.free oats/i.test(c.directive))).toBe(true);
  });

  test("oat crust: both the structural crust directive AND the certified-oats directive fire", () => {
    // "oat crust" contains "crust" (FLOUR_TRIGGERS → structural rule with functionalRole)
    // AND "oat" (new oat rule, no functionalRole).  Both must fire independently.
    const decomposition = {
      definingComponents: ["oat crust", "lemon cream filling", "fresh raspberries"],
      adaptableComponents: ["butter → coconut oil"],
      dishForm: "sliceable tart",
    };
    const conflicts = resolveConflicts("lemon tart", decomposition, gfCtx);

    const oatCrustConflicts = conflicts.filter(
      c => /oat crust/i.test(c.component) && /gluten/i.test(c.guardrail),
    );
    expect(oatCrustConflicts.length).toBeGreaterThanOrEqual(2);
    expect(oatCrustConflicts.some(c => /rice flour|almond flour/i.test(c.directive))).toBe(true);
    expect(oatCrustConflicts.some(c => /certified gluten.free oats/i.test(c.directive))).toBe(true);
  });

  test("bare 'oat' allergy does NOT activate the gluten-free guardrail", () => {
    // Safety regression: a user whose only restriction is an oat allergy must
    // NOT receive a gluten-free guardrail — that guardrail tells them to use
    // "certified gluten-free oats" as a substitute, which still contains oats.
    // The gluten-free guardrail is only for gluten/wheat/celiac restrictions.
    const ctx = buildGuardrailContext({ allergies: ["oat"] });
    expect(ctx.guardrails.map(g => g.id)).not.toContain("gluten-free");
  });

  test("bare 'oat allergy' does NOT activate the gluten-free guardrail", () => {
    const ctx = buildGuardrailContext({ allergies: ["oat allergy"] });
    expect(ctx.guardrails.map(g => g.id)).not.toContain("gluten-free");
  });

  test("bare 'oat sensitivity' does NOT activate the gluten-free guardrail", () => {
    const ctx = buildGuardrailContext({ allergies: ["oat sensitivity"] });
    expect(ctx.guardrails.map(g => g.id)).not.toContain("gluten-free");
  });
});

// ── Score assertions ─────────────────────────────────────────────────────────

describe("strawberry cheesecake — score correctness", () => {
  test("perfect match scores 1.0", () => {
    const meal: GeneratedMealLike = {
      name: "Strawberry Cheesecake",
      description: "Classic cheesecake with cream cheese filling on a graham cracker crust topped with fresh strawberries.",
      ingredients: [
        { name: "cream cheese filling" },
        { name: "graham cracker crust" },
        { name: "strawberry topping" },
      ],
    };

    const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

    expect(result.score).toBe(1.0);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  test("name match but missing crust lowers score below 1.0", () => {
    const meal: GeneratedMealLike = {
      // No mention of "crust", "cracker", or "graham" anywhere so the
      // graham cracker crust defining component is genuinely absent.
      name: "Strawberry Cheesecake",
      description: "A light cheesecake filling topped with strawberries. No base layer.",
      ingredients: [
        { name: "dairy-free cream cheese" },
        { name: "fresh strawberries" },
      ],
    };

    const result = validateDishIdentity("strawberry cheesecake", meal, cheesecakeDirective);

    // Name matches fully (score 1.0 on name), but crust component is absent
    // (component score < 1.0), so combined score < 1.0.
    expect(result.score).toBeLessThan(1.0);
    // Not catastrophic (name matches + two of three components present)
    expect(result.catastrophicDeviation).toBe(false);
  });
});
