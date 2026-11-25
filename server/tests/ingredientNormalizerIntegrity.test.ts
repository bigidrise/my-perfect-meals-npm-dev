import { normalizeIngredient } from "../services/ingredientNormalizer";
import { parseMeasurementNumber } from "../../shared/units";

describe("Ingredient normalization integrity", () => {
  test.each(["1 1/4", "1¼", "1,25", "1.25"])(
    "preserves quantity expression %s",
    (amount) => {
      const result = normalizeIngredient({
        name: "spinach", amount, unit: "oz",
      });
      expect(result.unit).toBe("oz");
      expect(parseMeasurementNumber(result.amount)).toBeCloseTo(1.25, 5);
    }
  );

  test.each([
    ["chicken broth", 500, "ml"],
    ["chicken broth", 0.5, "l"],
    ["caldo de pollo", 500, "ml"],
    ["vegetable broth", 500, "ml"],
  ])("preserves liquid volume for %s", (name, amount, unit) => {
    const result = normalizeIngredient({ name, amount, unit });
    const factors: Record<string, number> = {
      "fl oz": 29.5735295625,
      cup: 236.5882365,
      ml: 1,
      l: 1000,
    };
    expect(Object.keys(factors)).toContain(result.unit);
    const quantity = parseMeasurementNumber(result.amount);
    expect(quantity).not.toBeNull();
    expect(Math.abs(quantity! * factors[result.unit] - 500))
      .toBeLessThan(2);
  });

  test.each([
    ["salt", 0.26],
    ["spinach", 7],
    ["whole-grain spaghetti", 7],
  ])("preserves positive mass for %s", (name, amount) => {
    const result = normalizeIngredient({ name, amount, unit: "g" });
    const factors: Record<string, number> = {
      oz: 28.349523125,
      lb: 453.59237,
      g: 1,
      kg: 1000,
    };
    expect(Object.keys(factors)).toContain(result.unit);
    const quantity = parseMeasurementNumber(result.amount);
    expect(quantity).not.toBeNull();
    expect(quantity!).toBeGreaterThan(0);
    expect(Math.abs(quantity! * factors[result.unit] - amount))
      .toBeLessThan(amount * 0.01);
  });

  test("preserves kilogram protein mass", () => {
    const result = normalizeIngredient({
      name: "chicken breast", amount: 1, unit: "kg",
    });
    expect(result.unit).toBe("lb");
    expect(parseMeasurementNumber(result.amount)).toBeCloseTo(2.20462, 2);
  });
});

describe("Supplement measurement integrity", () => {
  test.each([
    ["protein powder", 30, "g"],
    ["creatine", 5, "g"],
    ["pre-workout", 10, "g"],
    ["proteína en polvo", 30, "g"],
    ["creatina", 5, "g"],
  ])("never invents scoop quantities for %s", (name, amount, unit) => {
    const result = normalizeIngredient({ name, amount, unit });
    expect(result.unit).toBe("g");
    expect(parseMeasurementNumber(result.amount)).toBe(amount);
  });

  test.each(["1/2", "1", "1 1/2", "2 1/2"])(
    "preserves explicit scoop quantity %s",
    (amount) => {
      const result = normalizeIngredient({
        name: "protein powder", amount, unit: "scoops",
      });
      expect(parseMeasurementNumber(result.amount))
        .toBe(parseMeasurementNumber(amount));
      expect(["scoop", "scoops"]).toContain(result.unit);
    }
  );
});

describe("Explicit egg count preservation", () => {
  test.each([
    ["large eggs", "2", "each", "each"],
    ["large eggs", "2", "pieces", "pieces"],
    ["egg whites", "3", "large", "large"],
    ["large egg yolks", "2", "count", "count"],
    ["huevos grandes", "2", "unidades", "each"],
    ["claras de huevo grandes", "3", "unidad", "each"],
    ["yemas de huevo grandes", "2", "unidades", "each"],
  ])("preserves %s measured as %s %s", (name, amount, unit, expectedUnit) => {
    const normalized = normalizeIngredient({ name, amount, unit });
    expect(normalized.amount).toBe(amount);
    expect(normalized.unit).toBe(expectedUnit);
  });
});
