import { checkIngredientSanity, validateGeneratedIngredientMeasurements } from "../services/calorieEstimator";
import { parseMeasurementNumber } from "../../shared/units";

describe("Ingredient validation integrity", () => {
  test.each([
    "",
    "invalid",
    "to taste",
    "1/0",
    "1,000",
    "0",
    "-1",
    "Infinity",
    "NaN",
  ])("rejects invalid quantity: %s", (quantity) => {
    expect(checkIngredientSanity([{
      ingredients: [{ name: "olive oil", quantity, unit: "cup" }],
    }], 1, "cake")).toBe(false);
  });

  test.each(["1 1/2", "1½", "3/2", "1,5"])(
    "detects excessive oil expressed as %s",
    (quantity) => {
      expect(checkIngredientSanity([{
        ingredients: [{ name: "olive oil", quantity, unit: "cup" }],
      }], 1, "cake")).toBe(false);
    }
  );

  test.each(["1/4", "¼", "0,25", "0.25"])(
    "accepts legitimate oil quantity: %s",
    (quantity) => {
      expect(checkIngredientSanity([{
        ingredients: [{ name: "olive oil", quantity, unit: "cup" }],
      }], 1, "cake")).toBe(true);
    }
  );

  test("rejects overflowing fraction values", () => {
    expect(parseMeasurementNumber("9".repeat(400) + "/1")).toBeNull();
  });

  test("preserves valid Spanish ingredient measurements", () => {
    expect(checkIngredientSanity([{
      ingredients: [{
        name: "claras de huevo",
        quantity: "1/2",
        unit: "taza",
      }],
    }], 1)).toBe(true);
  });
});

describe("Generated ingredient measurement completeness", () => {
  test.each([
    undefined,
    null,
    "",
    " ",
    "handful",
    "serving",
    "unknown",
  ])("rejects missing or unsupported measurement unit: %s", (unit) => {
    expect(checkIngredientSanity([{
      ingredients: [{
        name: "chicken breast",
        quantity: "2",
        unit,
      } as any],
    }])).toBe(false);
  });

  test.each([
    ["chicken breast", "oz"],
    ["pechuga de pollo", "gramos"],
    ["olive oil", "tbsp"],
    ["aceite de oliva", "cucharada"],
    ["large eggs", "each"],
    ["huevos grandes", "unidad"],
    ["protein powder", "scoops"],
  ])("accepts explicit measurement: %s (%s)", (name, unit) => {
    expect(checkIngredientSanity([{
      ingredients: [{ name, quantity: "2", unit }],
    }])).toBe(true);
  });
});

describe("Ingredient measurement schema compatibility", () => {
  test.each([
    { name: "chicken breast", amount: "4", unit: "oz" },
    { name: "pechuga de pollo", amount: "120", unit: "gramos" },
    { name: "olive oil", quantity: "1/2", amount: "0.5", unit: "tbsp" },
    { name: "protein powder", amount: "1 1/2", unit: "scoops" },
  ])("accepts equivalent supported measurement fields: %j", (ingredient) => {
    expect(checkIngredientSanity([{ ingredients: [ingredient as any] }])).toBe(true);
  });

  test.each([
    { name: "chicken breast", quantity: "4", amount: "8", unit: "oz" },
    { name: "chicken breast", quantity: "4", amount: "invalid", unit: "oz" },
    { name: "olive oil", quantity: "1", amount: "0", unit: "tbsp" },
    { name: "chicken breast", unit: "oz" },
    { name: "protein powder", amount: "-1", unit: "scoops" },
  ])("rejects conflicting or invalid measurement fields: %j", (ingredient) => {
    expect(checkIngredientSanity([{ ingredients: [ingredient as any] }])).toBe(false);
  });
});

describe("Generated recipe measurement boundary", () => {
  test.each([
    undefined,
    null,
    [],
    [null],
    [{ name: "", quantity: "2", unit: "oz" }],
    [{ name: "   ", quantity: "2", unit: "oz" }],
    [{ name: "chicken breast", quantity: "invalid", unit: "oz" }],
    [{ name: "chicken breast", quantity: "2", unit: "scoops" }],
    [{ name: "pechuga de pollo", quantity: "2", unit: "scoops" }],
  ].map(ingredients => ({ ingredients })))("rejects incomplete or unsupported generated ingredients: %j", ({ ingredients }) => {
    expect(validateGeneratedIngredientMeasurements(ingredients)).toBe(false);
  });

  test.each([
    [{ name: "chicken breast", quantity: "4", unit: "oz" }],
    [{ name: "pechuga de pollo", amount: "120", unit: "gramos" }],
    [{ name: "protein powder", amount: "1/2", unit: "scoop" }],
    [{ name: "proteína en polvo", amount: "1/2", unit: "scoop" }],
    [{ name: "large eggs", quantity: "2", unit: "each" }],
    [{ name: "huevos grandes", quantity: "2", unit: "unidad" }],
  ].map(ingredients => ({ ingredients })))("accepts valid generated ingredients: %j", ({ ingredients }) => {
    expect(validateGeneratedIngredientMeasurements(ingredients)).toBe(true);
  });
});
