import { estimateCaloriesFromIngredients } from "../services/calorieEstimator";
import { dessertQuantity } from "../services/dessertNutrition";
import { perServingNumber } from "../services/humanFoodContext/servingNutrition";

describe("Nutrition calculation integrity", () => {
  test.each([
    ["0,25", 0.25],
    ["1,5", 1.5],
    ["⅛", 0.125],
    ["⅜", 0.375],
    ["⅝", 0.625],
    ["⅞", 0.875],
  ])("supports measured quantity %s consistently", (value, expected) => {
    expect(dessertQuantity(String(value))).toBe(expected);
  });

  test.each(
    [null, undefined, "", " ", false, true, [], {}].map(value => ({ value }))
  )("rejects invalid nutrient data $value", ({ value }) => {
    expect(Number.isFinite(Number(perServingNumber(value, 2)))).toBe(false);
  });

  test.each([0, -1, 1.5, NaN, Infinity])(
    "rejects invalid serving count %p",
    servings => {
      expect(Number.isFinite(Number(perServingNumber(100, servings)))).toBe(false);
    }
  );

  test("preserves genuine zero nutrients", () => {
    expect(perServingNumber(0, 2)).toBe(0);
  });

  test("preserves correct serving arithmetic", () => {
    expect(perServingNumber(125, 2)).toBe(62.5);
  });

  test("includes amount-only ingredients in calorie estimates", () => {
    const amountOnly = [{ name: "olive oil", amount: "1", unit: "tbsp" }];
    const quantityOnly = [{ name: "olive oil", quantity: "1", unit: "tbsp" }];
    expect(estimateCaloriesFromIngredients(amountOnly as any))
      .toBeCloseTo(estimateCaloriesFromIngredients(quantityOnly));
  });
});

describe("Approximate calorie conversion integrity", () => {
  test.each(["scoop", "clove", "whole", "pinch", ""])(
    "does not assume grams for unresolved unit %p",
    unit => {
      expect(estimateCaloriesFromIngredients([
        { name: "olive oil", quantity: "1", unit },
      ])).toBe(0);
    }
  );

  test("converts liters consistently with milliliters", () => {
    const estimate = (quantity: string, unit: string) =>
      estimateCaloriesFromIngredients([
        { name: "milk", quantity, unit },
      ]);

    expect(estimate("1", "l")).toBeCloseTo(
      estimate("1000", "ml")
    );
  });

  test("converts fluid ounces consistently with milliliters", () => {
    const estimate = (quantity: string, unit: string) =>
      estimateCaloriesFromIngredients([
        { name: "milk", quantity, unit },
      ]);

    expect(estimate("1", "fl oz")).toBeCloseTo(
      estimate("29.5735295625", "ml")
    );
  });
});
