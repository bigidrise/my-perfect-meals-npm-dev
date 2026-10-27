import { christmasSmokeGatheringsRecipes } from "./fixtures/gatheringsChristmasRecipes";
import { gatheringsReviewedUsda } from "./fixtures/gatheringsReviewedUsda";
import { parseGatheringsIngredient } from "../services/gatheringsIngredientParser";
import { calculateGatheringsNutrition, createGatheringsLookup } from "../services/gatheringsNutrition";
import { dessertIngredientGrams } from "../services/dessertNutrition";
import { lookupUsdaIngredient } from "../services/productDiscovery/usdaIngredientAdapter";
import { hasGatheringsNutrition } from "../../shared/gatheringsNutrition";

jest.mock("../services/productDiscovery/usdaIngredientAdapter", () => ({ lookupUsdaIngredient: jest.fn() }));
const adapter = jest.mocked(lookupUsdaIngredient);
const mapped = [
  ["1 tsp sesame oil", 171016, 4.5],
  ["1 tbsp finely chopped green onions", 170005, 6],
  ["2 tbsp miso paste", 172442, 34],
  ["1 tbsp sesame oil", 171016, 13.6],
  ["1/4 cup green onions, finely chopped", 170005, 25],
  ["1/2 tsp ground ginger", 170926, 0.9],
  ["1/4 tsp ground nutmeg", 171326, 0.55],
] as const;

beforeEach(() => {
  adapter.mockReset();
  adapter.mockImplementation(async name => gatheringsReviewedUsda.find(row => row.description === name) ?? null);
});

it.each(christmasSmokeGatheringsRecipes)("$name preserves the actual smoke-test quantities and preparation", fixture => {
  const rows = fixture.ingredientLines.map(parseGatheringsIngredient);
  expect(rows).toHaveLength(fixture.ingredientLines.length);
  expect(rows.map(row => row.originalText)).toEqual([...fixture.ingredientLines]);
  expect(rows.every(row => !row.parseIssue)).toBe(true);
  expect(rows.reduce((n, row) => n + Number(row.amount == null), 0)).toBe(0);
});

it.each(mapped)("%s resolves to the reviewed source and its real portion weight", async (line, fdcId, grams) => {
  expect(christmasSmokeGatheringsRecipes.some(fixture =>
    (fixture.ingredientLines as readonly string[]).includes(line))).toBe(true);
  const ingredient = parseGatheringsIngredient(line);
  const original = { ...ingredient };
  const lookup = createGatheringsLookup();
  const source = await lookup.lookup(ingredient.name);
  expect(source?.fdcId).toBe(fdcId);
  expect(dessertIngredientGrams({
    name: ingredient.name, amount: String(ingredient.amount), unit: ingredient.unit!,
  }, source! )?.grams).toBeCloseTo(grams);
  const result = await calculateGatheringsNutrition({ ingredients: [ingredient] }, 6, lookup.lookup);
  expect(result.nutritionResult.status).toBe("available");
  expect(result.nutritionResult.sources[0]).toMatchObject({ ingredientIndex: 0, fdcId, grams });
  expect(result.nutrition?.calories).toBeCloseTo(source!.macrosPer100g.calories! * grams / 100);
  expect(hasGatheringsNutrition({ ingredients: [ingredient], servings: 6, ...result })).toBe(true);
  expect(ingredient).toEqual(original);
});

it.each(christmasSmokeGatheringsRecipes)("$name still withholds all macros when its first ingredient is unresolved", async fixture => {
  const recipe = { name: fixture.name, ingredients: fixture.ingredientLines.map(parseGatheringsIngredient) };
  const result = await calculateGatheringsNutrition(recipe, 6, createGatheringsLookup().lookup);
  expect(result.nutrition).toBeUndefined();
  expect(result.nutritionResult).toMatchObject({
    status: "needs_review", reasons: ["ingredient.0.identity_unresolved"], sources: [],
  });
  expect(hasGatheringsNutrition({ ...recipe, ...result, servings: 6 })).toBe(false);
});

it.each([
  "sashimi-grade salmon", "bone-in ham", "coconut milk", "rehydrated wakame seaweed",
  "Japanese sweet potatoes, peeled and cubed",
  "Japanese sweet potatoes (satsumaimo), peeled and cubed",
  "toasted sesame oil", "white miso paste", "ground fresh ginger", "toasted walnuts, chopped",
  "thinly sliced green onions", "green onion tops, finely chopped",
])("%s is not guessed, stripped or mapped to a different formulation or preparation", async name => {
  expect(await createGatheringsLookup().lookup(name)).toBeNull();
  expect(adapter).toHaveBeenCalledWith(name, expect.any(Function));
});

it("keeps complete coverage mandatory even after supported ingredients have been calculated", async () => {
  const ingredients = ["1 tsp sesame oil", "1/2 cup coconut milk"].map(parseGatheringsIngredient);
  const result = await calculateGatheringsNutrition({ ingredients }, 6, createGatheringsLookup().lookup);
  expect(result.nutritionResult.sources).toHaveLength(1);
  expect(result.nutritionResult.reasons).toEqual(["ingredient.1.identity_unresolved"]);
  expect(result.nutrition).toBeUndefined();
  expect(hasGatheringsNutrition({ ingredients, servings: 6, ...result })).toBe(false);
});

it("does not invent a chopped portion if the record only supplies whole portions", async () => {
  const source = gatheringsReviewedUsda.find(row => row.fdcId === 170005)!;
  adapter.mockResolvedValue({ ...source, portions: [{ amount: 1, grams: 100, measure: "cup, whole" }] });
  const result = await calculateGatheringsNutrition({
    ingredients: [parseGatheringsIngredient("1 tbsp finely chopped green onions")],
  }, 6, createGatheringsLookup().lookup);
  expect(result.nutritionResult.reasons).toEqual(["ingredient.0.portion_unresolved"]);
  expect(result.nutrition).toBeUndefined();
});

it.each(["fdcId", "description", "dataType"])("rejects a changed reviewed record %s", async field => {
  const source = gatheringsReviewedUsda.find(row => row.fdcId === 172442)!;
  adapter.mockResolvedValue({ ...source, [field]: field === "fdcId" ? 999 : "Unreviewed replacement" });
  expect(await createGatheringsLookup().lookup("miso paste")).toBeNull();
});

it("does not mutate adapter-cached sources or change another generator's conversion", async () => {
  const source = gatheringsReviewedUsda.find(row => row.fdcId === 170005)!;
  const before = JSON.stringify(source);
  const row = { name: "green onions", amount: "0.25", unit: "cup" };
  expect(dessertIngredientGrams(row, source)).toBeNull();
  const scoped = await createGatheringsLookup().lookup("green onions, finely chopped");
  expect(dessertIngredientGrams(row, scoped!)?.grams).toBe(25);
  expect(dessertIngredientGrams(row, source)).toBeNull();
  expect(JSON.stringify(source)).toBe(before);
});

it("does not add these aliases to the shared USDA adapter used by other generators", async () => {
  const actual = jest.requireActual<typeof import("../services/productDiscovery/usdaIngredientAdapter")>(
    "../services/productDiscovery/usdaIngredientAdapter",
  );
  const fetcher = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ foods: [{ fdcId: 170926, description: "Spices, ginger, ground", dataType: "SR Legacy" }] }),
  });
  expect(await actual.lookupUsdaIngredient("ground ginger", fetcher)).toBeNull();
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("query")).toBe("ground ginger");
});
