import { generateMealFromPrompt } from "../services/universalMealGenerator";
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => ({
    chat: { completions: { create: jest.fn(async () => ({ choices: [{ message: { content:
      "Meal Name: Example\nDescription: Recipe\nIngredients:\n- 3 large eggs\n- 1 1/2 cups flour\nInstructions:\n1. Bake.\nNutrition:\nCalories: 53\nProtein: 1g\nCarbs: 8g\nFat: 3g" } }] })) } },
  })),
}));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/wholeFoodStandard", () => ({
  appendWholeFoodStandardPrompt: (s: string) => s,
  evaluateWholeFoodCandidate: () => ({ shouldBlock: false }),
}));
jest.mock("../services/allergyGuardrails", () => ({
  buildDietPromptBlock: () => "", violatesDietaryConstraints: () => ({ violates: false }), AVOIDANCE_EXPANSION: {},
}));
jest.mock("../services/guardrails/promptPolicyGate", () => ({ getBaselineMacroPrompt: () => "" }));
jest.mock("../services/aiTelemetry", () => ({
  createSession: () => "test", logRawOutput: jest.fn(), tagFallback: jest.fn(),
  closeSession: jest.fn(), recordIngredientParseRate: jest.fn(), buildDebugMetadata: () => null,
}));
beforeAll(() => { process.env.OPENAI_API_KEY = "synthetic-not-a-credential"; });
it("Gatherings draft contains strict quantities and NO AI/default macros", async () => {
  const meal = await generateMealFromPrompt("six servings", "dinner", { skipImage: true }, { gatheringsIngredientNutrition: true });
  expect(meal).not.toHaveProperty("nutrition");
  expect(meal.ingredients[0]).toMatchObject({ amount: 3, unit: "large" });
  expect(meal.ingredients[1]).toMatchObject({ amount: 1.5, unit: "cups" });
});
it("legacy callers keep their original parsing and AI macros", async () => {
  const meal = await generateMealFromPrompt("six servings", "dinner", { skipImage: true });
  expect(meal.nutrition).toEqual({ calories: 53, protein: 1, carbs: 8, fat: 3 });
  expect(meal.ingredients[0]).toMatchObject({ amount: 1, unit: "piece" });
});
