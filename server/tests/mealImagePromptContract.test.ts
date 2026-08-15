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

import { __testables, buildStableCacheKey } from "../services/mealImageGenerator";

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
    expect(contract).toContain('Do NOT depict the traditional or cultural composition of "Classic Tuna Niçoise Salad"');
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

        // Display name present as a label, not as culinary truth
        expect(prompt).toContain(`DISPLAY NAME: ${dish.name}`);
        expect(prompt).toContain("IMAGE SUBJECT: A dish composed ONLY from the authorized recipe ingredients");

        // Allow-list is the recipe, verbatim
        expect(prompt).toContain(`REQUIRED VISIBLE INGREDIENTS: ${dish.recipe.join(", ")}`);

        // Deny clause references the loaded name explicitly
        expect(prompt).toContain(`Do NOT depict the traditional or cultural composition of "${dish.name}"`);
        expect(prompt).toContain("The recipe contract above is the only authority");

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

  it("empty ingredient list falls back to legacy name-driven prompt (no false contract)", () => {
    const prompt = buildMealImagePrompt("Classic Tuna Niçoise Salad", []);
    expect(prompt).not.toContain("REQUIRED VISIBLE INGREDIENTS");
    expect(prompt).not.toContain("UNAUTHORIZED INGREDIENTS");
    expect(prompt).toContain("must clearly look like Classic Tuna Niçoise Salad");
  });

  it("contract applies for all sourceType anchors", () => {
    for (const st of ["meal", "beverage", "snack", "dessert"] as const) {
      const prompt = buildMealImagePrompt("Vegan Carbonara", ["spaghetti", "cashew cream"], st);
      expect(prompt).toContain("REQUIRED VISIBLE INGREDIENTS: spaghetti, cashew cream");
      expect(prompt).toContain("UNAUTHORIZED INGREDIENTS");
    }
  });
});

describe("buildStableCacheKey — v6 cache flush + full-list hashing", () => {
  it("uses the v6 version tag so all pre-contract cached prompts are invalidated", () => {
    const key = buildStableCacheKey("Tuna Salad", ["tuna", "greens"], "meal");
    const expectedV6 = crypto
      .createHash("sha256")
      .update(`tuna salad|greens,tuna|meal|v6`)
      .digest("hex")
      .substring(0, 32);
    const oldV4 = crypto
      .createHash("sha256")
      .update(`tuna salad|greens,tuna|meal|v4`)
      .digest("hex")
      .substring(0, 32);
    expect(key).toBe(expectedV6);
    expect(key).not.toBe(oldV4);
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
