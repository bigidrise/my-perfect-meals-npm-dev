import { parseGatheringsIngredient } from "../services/gatheringsIngredientParser";
import { calculateGatheringsNutrition, createGatheringsLookup, GATHERINGS_USDA_BUDGET } from "../services/gatheringsNutrition";
import { lookupUsdaIngredient } from "../services/productDiscovery/usdaIngredientAdapter";
import { hasGatheringsNutrition } from "../../shared/gatheringsNutrition";

jest.mock("../services/productDiscovery/usdaIngredientAdapter", () => ({
  lookupUsdaIngredient: jest.fn(),
}));
const adapter = jest.mocked(lookupUsdaIngredient);
const composition = (macros = { calories: 100, protein: 5, carbs: 15, fat: 2.2222222222 }) => ({
  fdcId: 123, description: "Pinned composition fixture", dataType: "SR Legacy",
  retrievedAt: "2026-10-27", macrosPer100g: macros,
  portions: [{ amount: 1, grams: 50, measure: "large" }, { amount: 1, grams: 120, measure: "cup" }],
  carbSource: "unknown" as const,
});
const recipe = (lines: string[], name = "Baked dish") => ({
  name, ingredients: lines.map(parseGatheringsIngredient), instructions: ["Bake and serve."],
});

describe("strict quantities", () => {
  it.each([
    ["3 large eggs", 3, "large"], ["1 1/2 cups flour", 1.5, "cups"],
    ["1½ cup flour", 1.5, "cup"], ["½ cup flour", 0.5, "cup"],
    ["20 g ginger", 20, "g"], ["6 ounces potatoes", 6, "ounces"],
    ["8 fl oz broth", 8, "fl oz"], ["2 fluid ounces broth", 2, "fl oz"],
    ["1/2 tbsp olive oil", 0.5, "tbsp"],
  ])("%s retains its real quantity", (line, amount, unit) => {
    expect(parseGatheringsIngredient(line)).toMatchObject({ amount, unit });
  });
  it.each(["2 eggs", "1-2 cups flour", "a little oil", "1/0 cup flour", "salt to taste"])(
    "%s stays unresolved, never one piece", line => {
      const parsed = parseGatheringsIngredient(line);
      expect(parsed.amount).toBeUndefined();
      expect(parsed.name).toBe(line);
    });
});

describe("ingredient-backed recipe totals", () => {
  it("adds exact mass and USDA portions before dividing once; ignores AI values", async () => {
    const input = { ...recipe(["300 g apples", "3 large eggs"]), nutrition: { calories: 53 } };
    const calculated = await calculateGatheringsNutrition(input, 6, async () => composition());
    expect(calculated.nutrition?.calories).toBeCloseTo(450);
    expect(calculated.nutrition?.protein).toBeCloseTo(22.5);
    expect(calculated.nutritionResult.sources.map(s => s.grams)).toEqual([300, 150]);
    expect(calculated.nutritionResult.status).toBe("available");
    expect(calculated.nutrition!.calories / 6).toBe(75);
    expect(hasGatheringsNutrition({ ...input, ...calculated, servings: 6 })).toBe(true);
    expect(hasGatheringsNutrition({ ...input, ...calculated, servings: 3 })).toBe(false);
  });
  it("six-serving latke regression: unknown frying retention never reports 53 calories", async () => {
    // Synthetic fixture, NOT the user's unavailable historical ingredient list.
    const lookup = jest.fn();
    const result = await calculateGatheringsNutrition(recipe([
      "24 oz potatoes", "3 large eggs", "1/2 cup flour", "4 tbsp olive oil",
      "300 g apples", "10 g ginger",
    ], "Golden Potato Latkes with Apple-Ginger Compote"), 6, lookup);
    expect(result.nutrition).toBeUndefined();
    expect(result.nutritionResult).toMatchObject({ status: "needs_review", reasons: ["frying_fat_retention_unknown"] });
    expect(lookup).not.toHaveBeenCalled();
  });
  it.each([
    [null, "needs_review"],
    [composition({ calories: 100, protein: 5, carbs: null as any, fat: 2 }), "unavailable"],
  ])("missing composition never becomes zero", async (source, status) => {
    const result = await calculateGatheringsNutrition(recipe(["100 g apples"]), 6, async () => source);
    expect(result.nutrition).toBeUndefined();
    expect(result.nutritionResult.status).toBe(status);
  });
  it("source failures are unavailable", async () => {
    const result = await calculateGatheringsNutrition(recipe(["100 g apples"]), 6, async () => { throw Error("offline"); });
    expect(result.nutritionResult.status).toBe("unavailable");
  });
  it("incorporated oil is counted completely and disclosed", async () => {
    const result = await calculateGatheringsNutrition(recipe(["10 g olive oil"]), 6,
      async () => composition({ calories: 884, protein: 0, carbs: 0, fat: 100 }));
    expect(result.nutrition?.calories).toBeCloseTo(88.4);
    expect(result.nutrition?.fat).toBe(10);
    expect(result.nutritionResult.assumptions[0]).toContain("incorporated");
  });
  it("unexplained energy differences require review", async () => {
    const result = await calculateGatheringsNutrition(recipe(["100 g apples"]), 1,
      async () => composition({ calories: 900, protein: 0, carbs: 0, fat: 0 }));
    expect(result.nutrition).toBeUndefined();
    expect(result.nutritionResult.reasons).toContain("energy_macro_difference_requires_review");
  });
  it("unknown carb categories do not fabricate starch or erase known total carbs", async () => {
    const result = await calculateGatheringsNutrition(recipe(["100 g apples"]), 1, async () => composition());
    expect(result.nutrition?.carbs).toBe(15);
    expect(result.nutrition).not.toHaveProperty("starchyCarbs");
  });
});

describe("bounded reuse of the existing USDA adapter", () => {
  beforeEach(() => adapter.mockReset());
  it("maps explicit identities locally and deduplicates within a gathering", async () => {
    adapter.mockResolvedValue(composition());
    const budget = createGatheringsLookup();
    await budget.lookup("potatoes");
    await budget.lookup("potatoes");
    expect(adapter.mock.calls[0][0]).toBe("Potatoes, flesh and skin, raw");
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(budget.metrics.cacheReuses).toBe(1);
  });
  it("caps distinct lookups", async () => {
    adapter.mockResolvedValue(null);
    const budget = createGatheringsLookup();
    for (let i = 0; i < GATHERINGS_USDA_BUDGET.lookups; i++) await budget.lookup(`unknown ${i}`);
    await expect(budget.lookup("extra")).rejects.toThrow("budget");
  });
  it("caps total source HTTP requests", async () => {
    adapter.mockImplementation(async (_, fetcher) => {
      await fetcher!("https://example.invalid");
      return null;
    });
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const budget = createGatheringsLookup(fetcher);
    budget.metrics.httpRequests = GATHERINGS_USDA_BUDGET.httpRequests;
    await expect(budget.lookup("apple")).rejects.toThrow("budget");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("times out even when a transport ignores cancellation", async () => {
    jest.useFakeTimers();
    adapter.mockImplementation(async (_, fetcher) => { await fetcher!("https://example.invalid"); return null; });
    const budget = createGatheringsLookup(jest.fn(() => new Promise(() => {})) as any);
    const pending = expect(budget.lookup("apple")).rejects.toThrow("timeout");
    await jest.advanceTimersByTimeAsync(GATHERINGS_USDA_BUDGET.fetchMs);
    await pending;
    expect(budget.metrics.sourceMs).toBe(GATHERINGS_USDA_BUDGET.fetchMs);
    jest.useRealTimers();
  });
});
