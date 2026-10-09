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
  expect(validateHumanFoodResult({ ingredients, nutrition: recipe }, context).valid).toBe(false);
  const nutrition = groceryCoachPerServingMacros(recipe, 3);
  expect(nutrition).toEqual({ calories: 500, protein: 50, carbs: 50, fat: 15, starchyCarbs: 40, fibrousCarbs: 10 });
  expect(validateHumanFoodResult({ ingredients, nutrition }, context)).toEqual({ valid: true, violations: [] });
  expect(recipe.calories).toBe(1500);
});
it("continues to block a real per-serving budget violation", () => {
  const nutrition = groceryCoachPerServingMacros({ ...recipe, calories: 2100 }, 3);
  expect(validateHumanFoodResult({ ingredients, nutrition }, context).violations).toContain("projected_calorie_budget_exceeded");
});
it("does not invent unknown carb categories or change single-serving nutrition", () => {
  expect(groceryCoachPerServingMacros({ ...recipe, starchyCarbs: null, fibrousCarbs: null }, 3))
    .toMatchObject({ starchyCarbs: null, fibrousCarbs: null });
  expect(groceryCoachPerServingMacros(recipe, 1)).toEqual(recipe);
});
