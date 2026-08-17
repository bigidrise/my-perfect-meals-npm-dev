/**
 * mealImagePromptContract.test.ts
 *
 * Regression suite for the Recipe Ingredient Contract in meal image prompts.
 *
 * Root cause being guarded: loaded dish names ("Niçoise", "Cobb", "Carbonara"…)
 * carry strong learned associations in the image model, so it adds ingredients
 * the recipe never included (e.g. eggs on an egg-free Niçoise). The fix demotes
 * the display name to a label and derives an allow/deny list from the canonical
 * recipe ingredient list at prompt-construction time.
 *
 * Run: npx jest server/tests/mealImagePromptContract.test.ts
 */

import crypto from "crypto";

// mealImageGenerator transitively imports imageLifecycle → @replit/object-storage
// → gaxios (ESM-only), which Jest cannot parse. The prompt/cache-key functions
// under test never touch storage, so stub the lifecycle module out entirely.
jest.mock("../services/imageLifecycle", () => ({
  ingestImageToPermanentStorage: jest.fn(),
}));

import { __testables, buildStableCacheKey, detectDishType } from "../services/mealImageGenerator";

const { buildMealImagePrompt, buildIngredientContract } = __testables;

// Loaded dish names whose traditional versions contain ingredients NOT in the
// test recipe. The prompt must present only the recipe's ingredients and must
// explicitly forbid the traditional/cultural composition.
const LOADED_DISHES: Array<{
  name: string;
  recipe: string[];
  traditionalOnly: string[]; // ingredients the model would add from memory
}> = [
  {
    name: "Classic Tuna Niçoise Salad",
    recipe: ["mixed greens", "tuna", "green beans", "red potatoes", "cherry tomatoes"],
    traditionalOnly: ["egg", "olives", "anchov"],
  },
  {
    name: "Cobb Salad",
    recipe: ["romaine lettuce", "grilled chicken", "avocado", "tomatoes", "chives"],
    traditionalOnly: ["bacon", "egg", "blue cheese"],
  },
  {
    name: "Waldorf Salad",
    recipe: ["apples", "celery", "grapes", "greek yogurt dressing"],
    traditionalOnly: ["walnut", "mayo"],
  },
  {
    name: "Caesar Salad",
    recipe: ["romaine lettuce", "grilled chicken", "parmesan", "light yogurt dressing"],
    traditionalOnly: ["anchov", "crouton"],
  },
  {
    name: "Vegan Carbonara",
    recipe: ["spaghetti", "cashew cream", "smoked tofu", "nutritional yeast", "black pepper"],
    traditionalOnly: ["egg", "guanciale", "pancetta"],
  },
  {
    name: "Dairy-Free Fettuccine Alfredo",
    recipe: ["fettuccine", "cauliflower sauce", "garlic", "olive oil", "nutritional yeast"],
    traditionalOnly: ["cream", "butter"],
  },
  {
    name: "GLP-1 Eggs Benedict Bowl",
    recipe: ["whole grain english muffin", "smoked salmon", "greek yogurt hollandaise", "spinach"],
    traditionalOnly: ["poached egg", "canadian bacon"],
  },
  {
    name: "Shoyu Ramen",
    recipe: ["ramen noodles", "chicken broth", "shredded chicken", "scallions", "bok choy"],
    traditionalOnly: ["soft-boiled egg", "soft boiled egg", "pork belly"],
  },
  {
    name: "Chicken Paella",
    recipe: ["bomba rice", "chicken thighs", "saffron", "bell peppers", "peas"],
    traditionalOnly: ["shrimp", "mussels", "shellfish", "chorizo"],
  },
];

describe("buildIngredientContract", () => {
  it("derives the allow-list verbatim from the recipe ingredients", () => {
    const contract = buildIngredientContract("Classic Tuna Niçoise Salad", [
      "mixed greens", "tuna", "green beans", "red potatoes", "cherry tomatoes",
    ]);
    expect(contract).toContain(
      "REQUIRED VISIBLE INGREDIENTS: mixed greens, tuna, green beans, red potatoes, cherry tomatoes"
    );
    expect(contract).toContain("UNAUTHORIZED INGREDIENTS");
    // v8 contract: scoped to filling/composition, NOT dish form
    expect(contract).toContain('Do NOT add ingredients traditionally associated with "Classic Tuna Niçoise Salad"');
    expect(contract).toContain("The ingredient list above is the only authority");
    // Must NOT contain the old "dish name is a label only" phrasing that caused form collapse
    expect(contract).not.toContain("The dish name is a label only");
    expect(contract).not.toContain("does NOT define what appears in the image");
  });

  it("returns an empty contract when the ingredient list is empty (no protection possible)", () => {
    expect(buildIngredientContract("Mystery Meal", [])).toBe("");
    expect(buildIngredientContract("Mystery Meal", ["", "  "])).toBe("");
  });

  it("includes EVERY recipe ingredient — no cap — so the deny clause never contradicts the recipe", () => {
    const many = Array.from({ length: 20 }, (_, i) => `ingredient${i}`);
    const contract = buildIngredientContract("Big Dish", many);
    // All 20 canonical ingredients must be authorized; a partial list would
    // declare real recipe ingredients "unauthorized".
    for (const ing of many) {
      expect(contract).toContain(ing);
    }
    expect(contract).toContain(`REQUIRED VISIBLE INGREDIENTS: ${many.join(", ")}`);
  });
});

describe("buildMealImagePrompt — recipe contract outranks dish name", () => {
  for (const dish of LOADED_DISHES) {
    it(`${dish.name}: prompt lists only recipe ingredients and forbids the traditional composition`, () => {
      for (const sourceType of ["meal", undefined] as const) {
        const prompt = buildMealImagePrompt(dish.name, dish.recipe, sourceType as any);

        // Display name present as a label
        expect(prompt).toContain(`DISPLAY NAME: ${dish.name}`);

        // v8 three-contract structure
        expect(prompt).toContain("CONTRACT 1: DISH IDENTITY");
        expect(prompt).toContain("CONTRACT 2: INGREDIENT AUTHORIZATION");
        expect(prompt).toContain("CONTRACT 3: PRESENTATION");

        // Allow-list is the recipe, verbatim
        expect(prompt).toContain(`REQUIRED VISIBLE INGREDIENTS: ${dish.recipe.join(", ")}`);

        // Deny clause references the loaded name explicitly (new scoped language)
        expect(prompt).toContain(`Do NOT add ingredients traditionally associated with "${dish.name}"`);
        expect(prompt).toContain("The ingredient list above is the only authority");

        // Must NOT contain the old phrasing that told the model to ignore dish form
        expect(prompt).not.toContain("The dish name is a label only");
        expect(prompt).not.toContain("does NOT define what appears in the image");

        // Contract 1 must contain structural identity (not just generic text)
        // This is the fix for taco→salad form collapse
        expect(prompt).toContain("This image MUST show:");

        // No traditional-only ingredient leaks into the prompt text
        const lower = prompt.toLowerCase();
        for (const forbidden of dish.traditionalOnly) {
          // Allow the dish NAME to contain the word (e.g. "Eggs Benedict") —
          // but the ingredient sections must not.
          const withoutName = lower.split(dish.name.toLowerCase()).join("");
          expect(withoutName).not.toContain(forbidden.toLowerCase());
        }
      }
    });
  }

  it("empty ingredient list falls back to name-driven prompt (no false contract)", () => {
    const prompt = buildMealImagePrompt("Classic Tuna Niçoise Salad", []);
    expect(prompt).not.toContain("REQUIRED VISIBLE INGREDIENTS");
    expect(prompt).not.toContain("UNAUTHORIZED INGREDIENTS");
    // No-contract path still names the dish so the model knows what to generate
    expect(prompt).toContain("Classic Tuna Niçoise Salad");
    // But structural identity (Contract 1) is ALWAYS present even without ingredients
    expect(prompt).toContain("CONTRACT 1: DISH IDENTITY");
    expect(prompt).toContain("This image MUST show:");
  });

  it("contract applies for all sourceType anchors", () => {
    for (const st of ["meal", "beverage", "snack", "dessert"] as const) {
      const prompt = buildMealImagePrompt("Vegan Carbonara", ["spaghetti", "cashew cream"], st);
      expect(prompt).toContain("REQUIRED VISIBLE INGREDIENTS: spaghetti, cashew cream");
      expect(prompt).toContain("UNAUTHORIZED INGREDIENTS");
      // Three-contract structure present in all anchors
      expect(prompt).toContain("CONTRACT 1: DISH IDENTITY");
      expect(prompt).toContain("CONTRACT 2: INGREDIENT AUTHORIZATION");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL IDENTITY REGRESSION SUITE
//
// Root cause being guarded: the old "dish name is a label only" instruction
// suppressed the structural form anchor along with traditional ingredients,
// causing tacos → salad / pasta form collapse.
//
// These tests verify:
//   1. detectDishType() returns dish-specific structural identity (not generic text)
//   2. buildMealImagePrompt() embeds that identity in CONTRACT 1
//   3. The structural identity is specific enough to anchor dish form
// ─────────────────────────────────────────────────────────────────────────────

describe("detectDishType — structural identity taxonomy", () => {
  // mustNotBePositive: terms that must NOT appear EXCEPT in a "NOT a X" denial clause.
  // We check that identity.includes(term) is false OR the only occurrence is in "not a X".
  // In practice we just check mustContain and trust the text is correctly scoped.
  const CASES: Array<{ name: string; mustContain: string[] }> = [
    {
      name: "Black Bean and Roasted Veggie Tacos",
      mustContain: ["tortilla", "taco", "not a salad", "not a bowl"],
    },
    {
      name: "Spicy Jackfruit Tacos",
      mustContain: ["tortilla", "taco", "not a salad"],
    },
    {
      name: "Chicken Burrito",
      mustContain: ["rolled", "seam-side down", "not a taco"],
    },
    {
      name: "Cheese Quesadilla",
      mustContain: ["wedges", "melted filling", "not a taco"],
    },
    {
      name: "Spaghetti Bolognese",
      mustContain: ["noodles", "sauce", "not a salad", "not a stir-fry"],
    },
    {
      name: "Cheesecake",
      mustContain: ["creamy filling", "crust", "not a cookie", "not a brownie"],
    },
    {
      name: "Tomato Bisque",
      mustContain: ["bowl", "soup", "not a plate", "not a salad"],
    },
    {
      name: "Margherita Pizza",
      mustContain: ["flat", "round", "crust", "toppings", "not a calzone"],
    },
    {
      name: "Turkey Club Sandwich",
      mustContain: ["bread", "sliced in half", "cross-section", "not a taco"],
    },
    {
      name: "Classic Cheeseburger",
      mustContain: ["bun", "patty", "not a wrap", "not a sandwich with sliced bread"],
    },
  ];

  for (const c of CASES) {
    it(`"${c.name}" has dish-specific structural identity`, () => {
      const dish = detectDishType(c.name);
      const identity = dish.structuralIdentity.toLowerCase();
      for (const term of c.mustContain) {
        expect(identity).toContain(term.toLowerCase());
      }
    });
  }

  it("structural identity is never the generic 'filled handheld food' for tacos", () => {
    const taco = detectDishType("Fish Tacos");
    expect(taco.structuralIdentity).not.toContain("filled handheld food with visible ingredients inside");
    expect(taco.structuralIdentity.toLowerCase()).toContain("tortilla");
  });
});

describe("buildMealImagePrompt — structural identity in CONTRACT 1", () => {
  it("taco prompt contains tortilla language in Contract 1, not just 'handheld food'", () => {
    const prompt = buildMealImagePrompt(
      "Black Bean and Roasted Veggie Tacos",
      ["black beans", "corn tortillas", "roasted bell pepper", "zucchini", "red onion", "feta"],
      "meal"
    );
    // Contract 1 must name tortilla shells specifically
    expect(prompt).toContain("tortilla");
    // Must not use the old vague language that caused form collapse
    expect(prompt).not.toContain("filled handheld food with visible ingredients inside");
    // Must not tell the model to ignore the dish name
    expect(prompt).not.toContain("The dish name is a label only");
    // Must anchor the form
    expect(prompt).toContain("MANDATORY — cannot be overridden");
  });

  it("pasta prompt anchors noodle-in-sauce form and prohibits salad/stir-fry confusion", () => {
    const prompt = buildMealImagePrompt(
      "Tofu and Bell Pepper Noodles",
      ["soba noodles", "tofu", "bell pepper", "sesame sauce"],
      "meal"
    );
    expect(prompt).toContain("noodles");
    expect(prompt).toContain("NOT a salad");
    expect(prompt).toContain("NOT a stir-fry");
  });

  it("soup prompt anchors bowl-of-liquid form and prohibits plate confusion", () => {
    const prompt = buildMealImagePrompt(
      "Roasted Tomato Soup",
      ["tomatoes", "vegetable broth", "olive oil", "basil"],
      "meal"
    );
    expect(prompt).toContain("bowl");
    expect(prompt).toContain("NOT a plate");
  });
});

describe("buildStableCacheKey — v8 cache flush + full-list hashing", () => {
  it("produces a stable 32-char hex key and differs across names, ingredients, and source types", () => {
    const key = buildStableCacheKey("Tuna Salad", ["tuna", "greens"], "meal");
    // 32-char hex
    expect(/^[0-9a-f]{32}$/.test(key)).toBe(true);
    // Deterministic across multiple calls
    expect(buildStableCacheKey("Tuna Salad", ["tuna", "greens"], "meal")).toBe(key);
    // Case/whitespace/order stable
    expect(buildStableCacheKey("tuna salad ", ["Greens", "TUNA"], "meal")).toBe(key);
    // Different name → different key
    expect(buildStableCacheKey("Tuna Sandwich", ["tuna", "greens"], "meal")).not.toBe(key);
    // Different ingredient → different key
    expect(buildStableCacheKey("Tuna Salad", ["tuna", "greens", "olives"], "meal")).not.toBe(key);
    // Different source type → different key
    expect(buildStableCacheKey("Tuna Salad", ["tuna", "greens"], "snack")).not.toBe(key);
  });

  it("recipes with the same first five ingredients but different later ingredients get DIFFERENT keys", () => {
    const base = ["greens", "tuna", "green beans", "potatoes", "tomatoes"];
    const withOlives = [...base, "olives"];
    const withCapers = [...base, "capers"];
    const keyBase = buildStableCacheKey("Niçoise", base, "meal");
    const keyOlives = buildStableCacheKey("Niçoise", withOlives, "meal");
    const keyCapers = buildStableCacheKey("Niçoise", withCapers, "meal");
    expect(keyOlives).not.toBe(keyBase);
    expect(keyCapers).not.toBe(keyBase);
    expect(keyOlives).not.toBe(keyCapers);
  });

  it("hashes every ingredient of a long recipe — differences past ingredient 12 change the key", () => {
    const many = Array.from({ length: 15 }, (_, i) => `ingredient${i}`);
    const variant = [...many.slice(0, 14), "different-last-ingredient"];
    expect(buildStableCacheKey("Big Dish", many, "meal"))
      .not.toBe(buildStableCacheKey("Big Dish", variant, "meal"));
  });

  it("ingredient order does not change the key (sorted normalization)", () => {
    const a = buildStableCacheKey("Dish", ["tuna", "greens", "olives"], "meal");
    const b = buildStableCacheKey("Dish", ["olives", "tuna", "greens"], "meal");
    expect(a).toBe(b);
  });
});
