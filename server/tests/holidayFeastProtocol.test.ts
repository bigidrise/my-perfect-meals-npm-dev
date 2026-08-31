jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(),
}));

import {
  evaluateHolidayFeastDishes,
  type MealOut,
} from "../services/holidayFeastService";
import {
  buildGuestEnvelope,
  deriveProcedureRules,
} from "../services/protocolEnvelope";

function dish(name: string, ingredients: string[]): MealOut {
  return {
    name,
    course: "mainDishes",
    servings: 4,
    ingredients: ingredients.map((ingredient) => ({ name: ingredient })),
    instructions: ["Cook thoroughly and serve."],
  };
}

describe("Holiday Feast protocol precedence", () => {
  test("removes a dish containing a declared allergen before WFS selection", () => {
    const envelope = {
      ...buildGuestEnvelope(),
      allergies: ["peanuts"],
    };

    const selected = evaluateHolidayFeastDishes(
      [dish("Peanut Chicken", ["chicken breast", "peanut sauce"])],
      envelope,
    );

    expect(selected).toEqual([]);
  });

  test("removes an animal-product dish from a vegan feast", () => {
    const dietaryIdentity = ["vegan"];
    const envelope = {
      ...buildGuestEnvelope(),
      dietaryIdentity,
      procedural: deriveProcedureRules(dietaryIdentity),
    };

    const selected = evaluateHolidayFeastDishes(
      [dish("Butter Roasted Chicken", ["chicken breast", "butter"])],
      envelope,
    );

    expect(selected).toEqual([]);
  });
});