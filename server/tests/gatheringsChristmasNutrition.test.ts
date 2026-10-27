import { christmasGatheringsRecipes } from "./fixtures/gatheringsChristmasRecipes";
import { parseGatheringsIngredient } from "../services/gatheringsIngredientParser";
import { calculateGatheringsNutrition } from "../services/gatheringsNutrition";
import { hasGatheringsNutrition } from "../../shared/gatheringsNutrition";
import type { IngredientComposition } from "../services/productDiscovery/usdaIngredientAdapter";

/** Synthetic source stub ONLY to isolate quantity/coverage failure paths. It is
 * not a USDA record and must never be used to assert corrected recipe calories. */
const otherSource: IngredientComposition = {
  fdcId: 1, description: "Synthetic source for failure-path testing",
  dataType: "synthetic", retrievedAt: "2026-10-27",
  macrosPer100g: { calories: 100, protein: 10, carbs: 15, fat: 0 },
  portions: [
    { amount: 1, grams: 100, measure: "cup" },
    { amount: 1, grams: 10, measure: "tbsp" },
    { amount: 1, grams: 3, measure: "tsp" },
  ],
  carbSource: "unknown",
};
describe("Actual six-serving Christmas ingredient regressions", () => {
  it.each(christmasGatheringsRecipes)("$name preserves every original ingredient and quantity", fixture => {
    const rows = fixture.ingredientLines.map(parseGatheringsIngredient);
    expect(rows.map(row => row.originalText)).toEqual([...fixture.ingredientLines]);
    expect(rows.map(row => row.displayText)).toEqual([...fixture.ingredientLines]);
    expect(rows).toHaveLength(fixture.ingredientLines.length);
    expect(rows[0].amount).toBe(12);
    expect(rows[0].unit).toBe("oz");
  });
  it.each(christmasGatheringsRecipes)("$name never reuses the old AI macros for unknown foods", async fixture => {
    const result = await calculateGatheringsNutrition({
      name: fixture.name,
      ingredients: fixture.ingredientLines.map(parseGatheringsIngredient),
      // Simulate the old AI values remaining on an upstream object.
      nutrition: fixture.reportedPerServing,
    } as any, fixture.servings, async () => null);
    expect(result.nutrition).toBeUndefined();
    expect(result.nutritionResult).toMatchObject({
      status: "needs_review", basis: "whole_recipe", servings: 6,
      reasons: ["ingredient.0.identity_unresolved"],
    });
    expect(hasGatheringsNutrition({ ...result, servings: 6 })).toBe(false);
  });
  it("soup cannot silently drop the unmeasured green onions, even if other sources resolve", async () => {
    const fixture = christmasGatheringsRecipes[0];
    const lookup = jest.fn(async () => otherSource);
    const result = await calculateGatheringsNutrition({
      name: fixture.name, ingredients: fixture.ingredientLines.map(parseGatheringsIngredient),
    }, 6, lookup);
    expect(result.nutritionResult.reasons).toEqual(["ingredient.5.quantity_unresolved"]);
    expect(result.nutrition).toBeUndefined();
    expect(lookup).toHaveBeenCalledTimes(5);
    const onions = parseGatheringsIngredient(fixture.ingredientLines[5]);
    expect(onions.amount).toBeUndefined();
    expect(onions.name).toContain("2 green onions");
  });
  it("cake cannot convert unspecified coconut milk volume with an invented density", async () => {
    const fixture = christmasGatheringsRecipes[1];
    const result = await calculateGatheringsNutrition({
      name: fixture.name, ingredients: fixture.ingredientLines.map(parseGatheringsIngredient),
    }, 6, async name => name === "coconut milk" ? { ...otherSource, portions: [] } : otherSource);
    expect(result.nutritionResult.reasons).toEqual(["ingredient.2.portion_unresolved"]);
    expect(result.nutrition).toBeUndefined();
  });
  it("cake cannot fill in a missing coconut-milk nutrient with zero", async () => {
    const fixture = christmasGatheringsRecipes[1];
    const result = await calculateGatheringsNutrition({
      name: fixture.name, ingredients: fixture.ingredientLines.map(parseGatheringsIngredient),
    }, 6, async name => name === "coconut milk"
      ? { ...otherSource, macrosPer100g: { ...otherSource.macrosPer100g, fat: null } } : otherSource);
    expect(result.nutritionResult.status).toBe("unavailable");
    expect(result.nutritionResult.reasons).toEqual(["ingredient.2.fat_missing"]);
    expect(result.nutrition).toBeUndefined();
  });
});
