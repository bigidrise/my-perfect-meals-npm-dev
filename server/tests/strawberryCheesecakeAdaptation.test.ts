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
