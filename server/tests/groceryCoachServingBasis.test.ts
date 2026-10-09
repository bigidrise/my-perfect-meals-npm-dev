import { groceryCoachPerServingMacros } from "../../shared/groceryCoachCarbs";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import type { HumanFoodContext } from "../../shared/humanFoodContext";

jest.mock("../services/glycemicProduceValidator", () => ({ validateGlycemicProduce: jest.fn() }));

const context = {
  authorization: { status: "not_required" },
  safety: { allergies: [], avoidedFoods: [] },
  nutrition: {
    prescription: { source: "macro_calculator" },
    remaining: { calories: 600, carbs: 60, fat: 20 },
    activeConstraints: { consumedStarchExhausted: false },
  },
} as unknown as HumanFoodContext;
const recipe = { calories: 1500, protein: 150, carbs: 150, fat: 45, starchyCarbs: 120, fibrousCarbs: 30 };
const ingredients = [{ name: "chicken" }, { name: "broccoli" }];

it("compares one serving with the personal budget instead of rejecting a compliant shared recipe", () => {
  expect(validateHumanFoodResult({ ingredients, nutrition: recipe }, context).valid).toBe(true);
  const nutrition = groceryCoachPerServingMacros(recipe, 3);
  expect(nutrition).toEqual({ calories: 500, protein: 50, carbs: 50, fat: 15, starchyCarbs: 40, fibrousCarbs: 10 });
  expect(validateHumanFoodResult({ ingredients, nutrition }, context)).toEqual({ valid: true, violations: [] });
  expect(recipe.calories).toBe(1500);
});
it("allows an ordinary calorie overage without changing the recipe nutrition", () => {
  const nutrition = groceryCoachPerServingMacros({ ...recipe, calories: 2100 }, 3);
  expect(nutrition.calories).toBe(700);
  expect(validateHumanFoodResult({ ingredients, nutrition }, context).valid).toBe(true);
});
it("allows single-serving ordinary calorie, fat, and total-carb overages for every creator", () => {
  for (const creator of ["grocery_coach", "create_a_dish", "fridge_rescue", "weekly_meal_plan", "dessert_creator", "beverage_creator", "my_perfect_menu"]) {
    expect(validateHumanFoodResult({ ingredients, nutrition: recipe }, {
      ...context, creator,
      nutrition: { ...context.nutrition!, projectedRemaining: { calories: 0, carbs: 0, fat: 0 } },
    } as HumanFoodContext)).toEqual({ valid: true, violations: [] });
  }
});
it("continues to reject actual starch overages and exhausted starch", () => {
  const starchContext = {
    ...context,
    nutrition: { ...context.nutrition!, starch: { consumed: { remainingGrams: 15 } } },
  } as HumanFoodContext;
  expect(validateHumanFoodResult({ ingredients, nutrition: { ...recipe, starchyCarbs: 16 } }, starchContext).violations)
    .toContain("starchy_carb_budget_exceeded");
  expect(validateHumanFoodResult({ ingredients, nutrition: { ...recipe, starchyCarbs: 15 } }, starchContext).valid)
    .toBe(true);
  expect(validateHumanFoodResult({ ingredients, nutrition: { ...recipe, starchyCarbs: null } }, starchContext).violations)
    .toContain("verified_starchy_carbs_missing");
  expect(validateHumanFoodResult({ ingredients, nutrition: recipe }, {
    ...context, nutrition: { ...context.nutrition!, activeConstraints: { consumedStarchExhausted: true } },
  } as HumanFoodContext).violations).toContain("consumed_starch_budget_exhausted");
});
it("still rejects allergy conflicts and missing nutrition evidence", () => {
  expect(validateHumanFoodResult({ ingredients, nutrition: recipe }, {
    ...context, safety: { ...context.safety, allergies: ["chicken"] },
  }).violations).toContain("forbidden_ingredient:chicken");
  expect(validateHumanFoodResult({ ingredients, nutrition: {} }, context).violations)
    .toEqual(expect.arrayContaining(["verified_calories_missing", "verified_carbs_missing", "verified_fat_missing"]));
});
it("does not invent unknown carb categories or change single-serving nutrition", () => {
  expect(groceryCoachPerServingMacros({ ...recipe, starchyCarbs: null, fibrousCarbs: null }, 3))
    .toMatchObject({ starchyCarbs: null, fibrousCarbs: null });
  expect(groceryCoachPerServingMacros(recipe, 1)).toEqual(recipe);
});
