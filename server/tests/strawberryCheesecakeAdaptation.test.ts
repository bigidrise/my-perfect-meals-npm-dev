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
