import { readFileSync } from "node:fs";
import { dessertIngredientGrams, dessertQuantity, estimateDessertIngredientNutrition, prepareDessertNutrition } from "../services/dessertNutrition";
import { parseUsdaIngredient, lookupUsdaIngredient, type IngredientComposition } from "../services/productDiscovery/usdaIngredientAdapter";
import { dessertYieldOptions, resolveDessertYield } from "../../shared/dessertYields";
import { dessertFavoritePayload } from "../../client/src/lib/dessertResult";

// Explicit source-shaped fixtures. These are not live endpoint assertions.
const record = (description = "Lemon peel, raw") => ({
  fdcId: 167749, description, dataType: "SR Legacy",
  foodNutrients: [
    { nutrient: { id: 1008, unitName: "kcal" }, amount: 47 },
    { nutrient: { id: 1003, unitName: "g" }, amount: 1.5 },
    { nutrient: { id: 1004, unitName: "g" }, amount: 0.3 },
    { nutrient: { id: 1005, unitName: "g" }, amount: 16 },
  ],
  foodPortions: [{ amount: 1, gramWeight: 2, modifier: "tsp" }],
});
const lemon = () => parseUsdaIngredient(record(), "non_starchy");
describe("Source-backed Dessert nutrition", () => {
  it("preserves genuinely unavailable nutrient data rather than zero filling", () => {
    const food = record();
    food.foodNutrients = food.foodNutrients.filter(row => row.nutrient.id !== 1008);
    expect(parseUsdaIngredient(food).macrosPer100g.calories).toBeNull();
  });
  it("rejects unsupported data types and wrong nutrient units", () => {
    expect(() => parseUsdaIngredient({ ...record(), dataType: "Branded" })).toThrow();
    const food = record();
    food.foodNutrients[0].nutrient.unitName = "kJ";
    expect(parseUsdaIngredient(food).macrosPer100g.calories).toBeNull();
  });
  it.each([["1/2", 0.5], ["1 1/2", 1.5], ["1½", 1.5], ["¼", 0.25], ["0.25", 0.25]])("parses measured quantity %s", (text, expected) => {
    expect(dessertQuantity(String(text))).toBe(expected);
  });
  it.each(["to taste", "a pinch", "1-2", "1/0", "-1", "", "0", "Infinity"])("rejects uncertain quantity %s", amount => {
    expect(dessertQuantity(amount)).toBeNull();
  });
  it("uses the USDA lemon-zest teaspoon weight and supports scaled recipe yields", async () => {
    for (const servings of [1, 6, 12, 24]) {
      const meal = { servings, ingredients: [{ name: "lemon zest", amount: String(servings), unit: "tsp" }] };
      const result = await prepareDessertNutrition(meal, servings, rows => estimateDessertIngredientNutrition(rows, async () => lemon()));
      expect(result.nutrition.calories).toBeCloseTo(0.94 * servings);
      expect(result.perServingNutrition.calories).toBeCloseTo(0.94);
      expect(result.perServingNutrition.starchyCarbs).toBe(0);
      expect((result as any).nutritionProvenance[0].fdcId).toBe(167749);
      expect(dessertFavoritePayload(result).recipeIngredientQuantities).toEqual(meal.ingredients);
    }
  });
  it("does not guess ingredient density or use whole-nut portions for flour", () => {
    expect(dessertIngredientGrams({ name: "lemon zest", amount: "1", unit: "cup" }, lemon())).toEqual(expect.objectContaining({ grams: 96 }));
    const nuts: IngredientComposition = { ...lemon(), portionForm: "ground", portions: [{ amount: 1, grams: 143, measure: "cup, whole" }] };
    expect(dessertIngredientGrams({ name: "almond flour", amount: "1", unit: "cup" }, nuts)).toBeNull();
    expect(dessertIngredientGrams({ name: "zest", amount: "1", unit: "pinch" }, lemon())).toBeNull();
    expect(dessertIngredientGrams({ name: "flour", amount: "1", unit: "cup" }, { ...lemon(), portions: [] })).toBeNull();
    expect(dessertIngredientGrams({ name: "zest", amount: "6", unit: "g" }, lemon())?.grams).toBe(6);
  });
  it("does not substitute zeros for a missing minor-ingredient nutrient", async () => {
    const source = lemon(); source.macrosPer100g.calories = null;
    await expect(estimateDessertIngredientNutrition([{ name: "zest", amount: "1", unit: "tsp" }], async () => source)).rejects.toThrow();
  });
  it("classifies honey carbohydrate as a sugary carbohydrate source, not chemical starch", async () => {
    const source: IngredientComposition = { ...lemon(), description: "Honey", carbSource: "starchy", macrosPer100g: { calories: 304, protein: 0.3, carbs: 82.4, fat: 0 } };
    const [result] = await estimateDessertIngredientNutrition([{ name: "honey", amount: "10", unit: "g" }], async () => source);
    expect(result.nutrition.starchyCarbs).toBeCloseTo(8.24);
    expect(result.provenance?.basis).toBe("per_100g");
  });
  it("rejects unknown major ingredients, unresolved carb-source identity and unavailable sources", async () => {
    const rows = [{ name: "unknown mix", amount: "200", unit: "g" }];
    await expect(estimateDessertIngredientNutrition(rows, async () => null)).rejects.toThrow();
    await expect(estimateDessertIngredientNutrition(rows, async () => ({ ...lemon(), carbSource: "unknown" }))).rejects.toThrow();
    await expect(estimateDessertIngredientNutrition(rows, async () => { throw Error("network"); })).rejects.toThrow();
  });
  it("matches exact generic USDA identities, retains source evidence and caches repeat lookup", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ foods: [{ fdcId: 167749, description: "Lemon peel, raw", dataType: "SR Legacy" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => record() });
    const first = await lookupUsdaIngredient("lemon zest", fetcher);
    const second = await lookupUsdaIngredient("fresh lemon zest", fetcher);
    expect(first?.macrosPer100g.calories).toBe(47);
    expect(second?.fdcId).toBe(first?.fdcId);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain("SR+Legacy%2CFoundation");
  });
  it("has no AI estimation call and keeps original quantities before display normalization", () => {
    const helper = readFileSync("server/services/dessertNutrition.ts", "utf8");
    const route = readFileSync("server/routes/dessert-creator.ts", "utf8");
    expect(helper).not.toContain("chat.completions");
    expect(route.indexOf("ingredients: originalIngredients")).toBeLessThan(route.indexOf("normalizeIngredients(originalIngredients)"));
    expect(route).toContain("Number(personalNutrition.carbs)");
    expect(route).toContain("Number(personalNutrition.fat)");
  });
});
describe("Whole-dessert recipe yields", () => {
  it.each([
    ["Whole 9-inch apple pie", "pie", "pie-9-8"],
    ["9×13-inch brownie pan", "brownies", "brownies-9x13-12"],
    ["Batch of 24 cookies", "cookies", "cookies-24"],
    ["Whole cheesecake", "cheesecake", "cheesecake-9-12"],
    ["Single-serving pudding", "pudding", "individual-1"],
    ["Wedding cake", "cake", "medium-wedding"],
  ])("keeps full-recipe/portion/Favorites counts for %s (fixtures)", async (name, category, key) => {
    const yieldChoice = resolveDessertYield(key, category, key.includes("wedding"))!;
    const fixtureComposition: IngredientComposition = { ...lemon(),
      description: "Explicit synthetic recipe-base composition",
      macrosPer100g: { calories: 200, protein: 10, carbs: 20, fat: 8 }, carbSource: "starchy" };
    const candidate = { name, category, servingSize: yieldChoice.label, servings: yieldChoice.count,
      ingredients: [{ name: "synthetic recipe base", amount: String(100 * yieldChoice.count), unit: "g" }],
      instructions: `Prepare the entire ${yieldChoice.label}. Divide into ${yieldChoice.count} portions.`,
    };
    const result = await prepareDessertNutrition(candidate, yieldChoice.count,
      rows => estimateDessertIngredientNutrition(rows, async () => fixtureComposition));
    expect(result.nutrition.calories).toBe(200 * yieldChoice.count);
    expect(result.perServingNutrition.calories).toBe(200);
    expect(result.ingredients).toEqual(candidate.ingredients);
    expect(result.instructions).toContain(String(yieldChoice.count));
    expect(dessertFavoritePayload(result).servings).toBe(yieldChoice.count);
    expect(dessertFavoritePayload(result).nutrition).toEqual(result.nutrition);
  });
  it.each([
    ["pie", "pie-9-8", 8], ["brownies", "brownies-9x13-12", 12],
    ["cookies", "cookies-24", 24], ["cheesecake", "cheesecake-9-12", 12],
    ["cake", "cake-9-2-12", 12], ["pudding", "individual-1", 1],
    ["bars", "bars-8x8-6", 6], ["muffins", "muffins-24", 24], ["cupcakes", "cupcakes-12", 12],
  ])("resolves %s yield %s", (category, key, count) => {
    expect(resolveDessertYield(key, String(category))?.count).toBe(count);
    expect(dessertYieldOptions(String(category)).some(row => row.value === key)).toBe(true);
  });
  it("preserves exact wedding yields and rejects category-incompatible choices", () => {
    for (const [key, count, tiers] of [["small-wedding", 40, 2], ["medium-wedding", 88, 3], ["large-wedding", 135, 3], ["extra-large-wedding", 200, 4]]) {
      expect(resolveDessertYield(key, "cake", true)).toMatchObject({ count, tiers });
    }
    expect(resolveDessertYield("cookies-24", "pie")).toBeUndefined();
    expect(resolveDessertYield("medium-wedding", "cookies", true)).toBeUndefined();
    expect(resolveDessertYield("single", "cake", true)).toBeUndefined();
    expect(resolveDessertYield("nonsense", "cake")).toBeUndefined();
  });
  it("retains old requests without changing Craving Creator", () => {
    expect(resolveDessertYield("family", "pie")?.count).toBe(6);
    expect(resolveDessertYield("batch", "bars")?.count).toBe(12);
    expect(resolveDessertYield(undefined, "pie")?.count).toBe(8);
    expect(resolveDessertYield(undefined, "cake", true)?.count).toBe(88);
    expect(resolveDessertYield(undefined, "")?.count).toBe(12);
  });
});
