import { readFileSync } from "node:fs";
import {
  prepareDessertNutrition, dessertNutritionDiscrepancies,
  normalizeDessertRecipeNutrition, DESSERT_NUTRIENTS, type DessertIngredient,
} from "../services/dessertNutrition";
import {
  dessertFavoritePayload, dessertRecipeServings, dessertFailureCopy,
} from "../../client/src/lib/dessertResult";
import { formatCreatorNutrition } from "../services/humanFoodContext/formatCreatorNutrition";

// Explicit synthetic ingredient-composition fixtures, not clinical assessments.
const foods = {
  "almond flour": { calories: 600, protein: 21, carbs: 20, fat: 54, starchyCarbs: 0 },
  "coconut oil": { calories: 892, protein: 0, carbs: 0, fat: 100, starchyCarbs: 0 },
  "honey": { calories: 304, protein: 0.3, carbs: 82, fat: 0, starchyCarbs: 82 },
  "cinnamon": { calories: 247, protein: 4, carbs: 81, fat: 1.2, starchyCarbs: 0 },
  "apple": { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, starchyCarbs: 0.1 },
  "cocoa": { calories: 228, protein: 20, carbs: 58, fat: 14, starchyCarbs: 7 },
};
const estimate = async (rows: DessertIngredient[]) => rows.map((row, ingredientIndex) => {
  const grams = Number(row.amount);
  const food = foods[row.name as keyof typeof foods];
  return {
    ingredientIndex, amount: row.amount, unit: row.unit, grams,
    nutrition: Object.fromEntries(DESSERT_NUTRIENTS.map((key) =>
      [key, food[key] * grams / 100])) as typeof food,
  };
});
function recipe(name: string, servings: number, names = ["almond flour", "coconut oil", "honey", "cinnamon"]) {
  return {
    name, servings,
    ingredients: names.map((name) => ({ name, amount: String(10 * servings), unit: "g" })),
    // Reproduces the logged failure class: absent per-serving starch, bad totals.
    nutrition: { calories: "incorrect", protein: 999, carbs: 999, fat: 999 },
    perServingNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

describe("Dessert ingredient-derived nutrition", () => {
  it.each([1, 6, 12, 24])("repairs Greek No-Bake Cinnamon Almond Bars for %i servings using quantities", async (servings) => {
    const original = recipe("Greek No-Bake Cinnamon Almond Bars", servings);
    expect(dessertNutritionDiscrepancies(original, servings)).toContain("perServingNutrition.starchyCarbs");
    const result = await prepareDessertNutrition(original, servings, estimate);
    expect(dessertNutritionDiscrepancies(result, servings)).toEqual([]);
    expect(result.nutrition.calories).toBeCloseTo((600 + 892 + 304 + 247) * 0.1 * servings);
    expect(result.perServingNutrition.calories).toBeCloseTo(204.3);
    expect(result.servings).toBe(servings);
    expect(result.ingredients).toEqual(original.ingredients);
    expect((result as any).recipeIngredientQuantities).toEqual(original.ingredients);
    expect(original.nutrition.calories).toBe("incorrect");
    for (const key of DESSERT_NUTRIENTS) {
      expect(result.nutrition[key]).toBeCloseTo(result.perServingNutrition[key] * servings);
    }
  });
  it.each([
    ["Whole apple pie", 6, ["apple", "almond flour", "coconut oil", "cinnamon"]],
    ["Pan of brownies", 12, ["cocoa", "almond flour", "coconut oil", "honey"]],
  ] as const)("handles %s without changing the recipe yield", async (name, servings, names) => {
    const result = await prepareDessertNutrition(recipe(name, servings, [...names]), servings, estimate);
    expect(dessertNutritionDiscrepancies(result, servings)).toEqual([]);
    expect(dessertFavoritePayload(result).servings).toBe(servings);
    expect(dessertFavoritePayload(result).nutrition).toEqual(result.nutrition);
  });
  it("does not relabel an incorrectly generated serving count", async () => {
    const estimator = jest.fn(estimate);
    await expect(prepareDessertNutrition(recipe("Bars", 1), 12, estimator)).rejects.toThrow();
    expect(estimator).not.toHaveBeenCalled();
  });
  it.each([undefined, null, "25", NaN, Infinity, -1])("rejects unknown or malformed ingredient nutrition: %s", async (bad) => {
    await expect(prepareDessertNutrition(recipe("Bars", 6), 6, async (rows) => {
      const entries = await estimate(rows);
      entries[0].nutrition.calories = bad as number;
      return entries;
    })).rejects.toThrow("could not be verified");
  });
  it.each(["omitted", "duplicated", "changed quantity", "unknown weight", "excess starch"])("rejects %s ingredient evidence", async (failure) => {
    await expect(prepareDessertNutrition(recipe("Bars", 6), 6, async (rows) => {
      const entries = await estimate(rows);
      if (failure === "omitted") entries.pop();
      if (failure === "duplicated") entries[1] = entries[0];
      if (failure === "changed quantity") entries[0].amount = "1";
      if (failure === "unknown weight") entries[0].grams = NaN;
      if (failure === "excess starch") entries[0].nutrition.starchyCarbs = 9999;
      return entries;
    })).rejects.toThrow();
  });
  it("accepts explicit genuine nutrient zeros, without filling missing fields", async () => {
    const result = await prepareDessertNutrition(recipe("Oil", 1, ["coconut oil"]), 1, estimate);
    expect(result.nutrition.protein).toBe(0);
    expect(result.nutrition.starchyCarbs).toBe(0);
  });
  it("scales with actual ingredient quantity, not old macro values", async () => {
    const input = recipe("Bars", 6);
    const first = await prepareDessertNutrition(input, 6, estimate);
    input.ingredients[0].amount = "120";
    const second = await prepareDessertNutrition(input, 6, estimate);
    expect(second.nutrition.calories - first.nutrition.calories).toBeCloseTo(360);
    expect(second.nutrition.protein - first.nutrition.protein).toBeCloseTo(12.6);
  });
});

describe("Dessert presentation and preserved safety boundaries", () => {
  it.each([1, 6, 12])("preserves %i servings in Favorites and card instructions", (servings) => {
    expect(dessertFavoritePayload({ servings, totalSlices: 2 }).servings).toBe(servings);
    expect(dessertRecipeServings({ servings })).toBe(servings);
  });
  it("retains old cake slice counts only when recipe servings are absent", () => {
    expect(dessertFavoritePayload({ totalSlices: 8 }).servings).toBe(8);
  });
  it("distinguishes nutrition, access, network, and dietary errors without raw details", () => {
    const data = { findings: [{ code: "final_nutrition_invalid" }], message: "internal stack trace" };
    expect(dessertFailureCopy(422, data).message).toContain("nutrition");
    expect(dessertFailureCopy(422, data).message).not.toContain("internal");
    expect(dessertFailureCopy(422, { code: "DESSERT_NUTRITION_UNVERIFIED" }).message).toContain("nutrition");
    expect(dessertFailureCopy(403).message).toContain("account access");
    expect(dessertFailureCopy(401).message).toContain("Sign in");
    expect(dessertFailureCopy().message).toContain("connection");
    expect(dessertFailureCopy(422).message).toContain("safety");
  });
  it("retains final numeric validation and allergy/diet gates in the actual route", () => {
    const source = readFileSync("server/routes/dessert-creator.ts", "utf8");
    expect(source).toContain("enforceSafetyProfile");
    expect(source).toContain("scanGeneratedOutput");
    expect(source).toContain("validateHumanFoodCandidate");
    expect(source).toContain("Math.abs(nutrition[key] - perServing[key] * serving.count) <= 1");
    expect(source).toContain('typeof value === "number" && Number.isFinite(value)');
    expect(source.indexOf("enforceSafetyProfile")).toBeLessThan(source.indexOf("meal = normalizeDessertRecipeNutrition"));
    expect(source.indexOf("meal = normalizeDessertRecipeNutrition")).toBeLessThan(source.indexOf("const finalDessertEnforcement"));
    expect(source).toContain("repaired = normalizeDessertRecipeNutrition");
    expect(source).not.toContain("estimateDessertIngredientNutrition");
    expect(source).toContain("starchyCarbs: Number(personalNutrition.starchyCarbs)");
    const page = readFileSync("client/src/pages/CravingDessertCreator.tsx", "utf8");
    expect(page).toContain("mealData={dessertFavoritePayload(generatedDessert)}");
    expect(page).toContain("isAllergyRelatedError(errorMsg)");
    expect(page).toContain("data?.safetyBlocked || data?.safetyAmbiguous");
  });
});

describe("Dessert canonical whole-recipe estimates", () => {
  const wholeRecipe = (servings: number) => ({
    name: "Recipe fixture", servings,
    ingredients: [{ name: "USDA-unidentified recipe ingredient", amount: "200", unit: "g" }],
    nutrition: { calories: 1200, protein: 60, carbs: 120, fat: 80, starchyCarbs: 30 },
    perServingNutrition: { calories: 9999, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0 },
  });
  it.each([1, 6, 12, 24])("derives %i portions without lookup, changing ingredients, or double-scaling", (servings) => {
    const original = wholeRecipe(servings);
    const result = normalizeDessertRecipeNutrition(original, servings);
    expect(result.nutrition).toEqual(original.nutrition);
    expect(result.ingredients).toEqual(original.ingredients);
    expect(result.recipeIngredientQuantities).toEqual(original.ingredients);
    for (const key of DESSERT_NUTRIENTS) {
      expect(result.perServingNutrition[key]).toBeCloseTo(original.nutrition[key] / servings);
      expect(formatCreatorNutrition({ nutrition: result.perServingNutrition }, servings)[key])
        .toBeCloseTo(original.nutrition[key]);
    }
    expect(normalizeDessertRecipeNutrition(result, servings)).toEqual(result);
    expect(dessertFavoritePayload(result).servings).toBe(servings);
  });
  it.each([undefined, null, "1200", NaN, Infinity, -1])("does not invent missing or invalid totals: %s", (value) => {
    const recipe: any = wholeRecipe(12);
    recipe.nutrition.calories = value;
    expect(() => normalizeDessertRecipeNutrition(recipe, 12)).toThrow();
  });
  it.each(DESSERT_NUTRIENTS)("requires a complete estimate, including %s", (key) => {
    const recipe: any = wholeRecipe(12);
    delete recipe.nutrition[key];
    expect(() => normalizeDessertRecipeNutrition(recipe, 12)).toThrow();
  });
  it("does not fix a contradictory yield by relabeling it", () => {
    expect(() => normalizeDessertRecipeNutrition(wholeRecipe(1), 12)).toThrow();
    expect(() => normalizeDessertRecipeNutrition(wholeRecipe(12), 0)).toThrow();
  });
  it("rejects inconsistent carbohydrate allocations", () => {
    const recipe = wholeRecipe(12); recipe.nutrition.starchyCarbs = 121;
    expect(() => normalizeDessertRecipeNutrition(recipe, 12)).toThrow();
  });
  it.each(["", "a pinch", "-1", "Infinity"])("retains the measured-ingredient safeguard for amount %s", (amount) => {
    const recipe = wholeRecipe(12); recipe.ingredients[0].amount = amount;
    expect(() => normalizeDessertRecipeNutrition(recipe, 12)).toThrow();
  });
  it("rejects unnamed ingredients instead of allowing a display fallback", () => {
    const recipe = wholeRecipe(12); recipe.ingredients[0].name = "";
    expect(() => normalizeDessertRecipeNutrition(recipe, 12)).toThrow();
  });
  it("does not claim that generated estimates are verified USDA evidence", () => {
    const result = normalizeDessertRecipeNutrition({
      ...wholeRecipe(12), nutritionProvenance: [{ source: "USDA FoodData Central" }],
    }, 12);
    expect(result).not.toHaveProperty("nutritionProvenance");
    expect(dessertFailureCopy(422, { code: "DESSERT_NUTRITION_UNVERIFIED" }).suggestedActions.join(" ")).not.toContain("grams");
  });
});
