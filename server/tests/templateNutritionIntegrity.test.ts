import {
  getDeterministicFallback,
  templateToMeal,
} from "../services/templateMatcher";
import type { MealTemplate } from "../../shared/catalog/_types";

function template(grams: number, ingredientId = "chicken_breast"): MealTemplate {
  return {
    id: "nutrition-integrity-fixture",
    name: "Nutrition integrity fixture",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [{ ingredientId, grams }],
    imageKey: "fixture",
    tags: [],
  };
}

describe("Template nutrition integrity", () => {
  test("100g chicken uses existing ingredient catalog nutrition", () => {
    const meal = templateToMeal(template(100));
    expect(meal.calories).toBeCloseTo(165);
    expect(meal.protein).toBeCloseTo(31);
    expect(meal.carbs).toBe(0);
    expect(meal.fat).toBeCloseTo(3.6);
  });

  test("doubling ingredient weight doubles nutrition", () => {
    const first = templateToMeal(template(100));
    const second = templateToMeal(template(200));
    expect(second.calories).toBeCloseTo(first.calories * 2);
    expect(second.protein).toBeCloseTo(first.protein * 2);
    expect(second.fat).toBeCloseTo(first.fat * 2);
  });

  test("missing ingredient nutrition cannot produce fabricated macros", () => {
    expect(() =>
      templateToMeal(template(100, "unknown_fixture_ingredient"))
    ).toThrow();
  });

  test.each([0, -100, NaN, Infinity])(
    "rejects invalid ingredient weight %s",
    grams => {
      expect(() => templateToMeal(template(grams))).toThrow();
    }
  );

  test("fallback does not mutate the user's ingredient selection", () => {
    const ingredients = ["rice", "chicken", "broccoli"];
    const original = [...ingredients];
    try {
      getDeterministicFallback("dinner", ingredients);
    } catch {
      // An unsupported fallback may legitimately be rejected.
    }
    expect(ingredients).toEqual(original);
  });
});


describe("Fridge Rescue deterministic carbohydrate integrity", () => {
  const calculate = (meal: MealTemplate) =>
    require("../services/templateMatcher")
      .calculateTemplateCarbohydrateSplit(meal);

  test("zero-carb chicken has zero in both carbohydrate categories", () => {
    expect(calculate(template(100))).toEqual({
      starchyCarbs: 0,
      fibrousCarbs: 0,
    });
  });

  test("100g broccoli uses its catalog carbohydrate content", () => {
    expect(calculate(template(100, "broccoli"))).toEqual({
      starchyCarbs: 0,
      fibrousCarbs: 7.2,
    });
  });

  test("50g spinach preserves fractional carbohydrate content", () => {
    expect(calculate(template(50, "spinach"))).toEqual({
      starchyCarbs: 0,
      fibrousCarbs: 1.8,
    });
  });

  test("mixed ingredients use weight-based carbohydrate totals", () => {
    const meal = template(100);
    meal.ingredients.push(
      { ingredientId: "broccoli", grams: 50 },
      { ingredientId: "spinach", grams: 100 },
    );

    const result = calculate(meal);
    expect(result.starchyCarbs).toBe(0);
    expect(result.fibrousCarbs).toBeCloseTo(7.2, 10);
  });

  test.each(["eggs", "egg_whites", "greek_yogurt", "avocado"])(
    "rejects unsupported two-category allocation for %s",
    ingredientId => {
      expect(() => calculate(template(100, ingredientId))).toThrow(
        expect.objectContaining({
          code: "TEMPLATE_NUTRITION_UNVERIFIED",
        }),
      );
    }
  );

  test("rejects missing ingredient nutrition", () => {
    expect(() => calculate(template(100, "unknown_fixture_ingredient")))
      .toThrow(expect.objectContaining({
        code: "TEMPLATE_NUTRITION_UNVERIFIED",
      }));
  });
});


describe("Fridge Rescue fallback ingredient relevance", () => {
  const matches = (meal: MealTemplate, available: string[]) =>
    require("../services/templateMatcher")
      .templateUsesAvailableIngredients(meal, available);

  test.each([
    ["chicken breast"],
    ["Chicken Breast"],
    ["chicken_breast"],
    ["chicken breasts"],
    ["pechuga de pollo"],
    ["pechugas de pollo"],
  ])("recognizes exact ingredient identity: %s", ingredient => {
    expect(matches(template(100), [ingredient])).toBe(true);
  });

  test.each([
    "chicken thigh",
    "chicken breast substitute",
    "chicken breast sauce",
    "chicken",
    "salmon",
  ])("rejects unsupported substitution: %s", ingredient => {
    expect(matches(template(100), [ingredient])).toBe(false);
  });

  test("rejects empty ingredient availability", () => {
    expect(matches(template(100), [])).toBe(false);
  });

  test("rejects a template containing an unavailable ingredient", () => {
    const meal = template(100);
    meal.ingredients.push({ ingredientId: "broccoli", grams: 100 });

    expect(matches(meal, ["chicken breast"])).toBe(false);
  });

  test("accepts all required ingredients with additional available foods", () => {
    const meal = template(100);
    meal.ingredients.push({ ingredientId: "broccoli", grams: 100 });

    expect(matches(meal, [
      "pechuga de pollo", "broccoli", "salmon",
    ])).toBe(true);
  });

  test("rejects an unrelated deterministic fallback", () => {
    expect(() =>
      getDeterministicFallback("dinner", ["unlisted_fixture_food"], true)
    ).toThrow(expect.objectContaining({
      code: "TEMPLATE_NUTRITION_UNVERIFIED",
    }));
  });
});
