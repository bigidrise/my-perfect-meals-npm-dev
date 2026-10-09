// Model output is controlled; generation, normalization, clinical validation,
// preparation checks, and bounded adaptation use their real implementations.
// No account lookup, persisted recipe, image generation, or external API call.
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({ chat: { completions: { create: mockCreate } } })),
}));
jest.mock("../db", () => ({
  db: { execute: jest.fn(async () => ({ rows: [] })), select: jest.fn() },
  pool: { query: jest.fn(), on: jest.fn() },
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(() => { throw new Error("Images are outside this text-generation contract."); }),
  normalizeMealTypeToSourceType: jest.fn(() => "meal"),
}));

import { generateCravingMealOptions } from "../services/unifiedMealPipeline";
import { resolveGLP1MealTargets } from "../services/glp1/resolveGLP1MealTargets";

function options(dish: string, fat = 4, instructions = ["Bake pastry layers. Cool, then layer with the lighter cream filling."]) {
  const portionScale = fat / 4;
  return ["Classic", "Berry", "Vanilla"].map(flavor => ({
    name: `${flavor} Mini ${dish}`,
    description: `A recognizable layered ${dish} with a lighter filling.`,
    ingredients: [
      { name: "thin phyllo pastry", quantity: "10", unit: "g" },
      { name: "butter", quantity: "1", unit: "g" },
      { name: "nonfat Greek yogurt", quantity: "85", unit: "g" },
      { name: "low-fat pastry cream", quantity: "15", unit: "g" },
      { name: "powdered sugar", quantity: "2", unit: "g" },
    ].map(ingredient => ({ ...ingredient, quantity: String(Number(ingredient.quantity) * portionScale) })),
    instructions, calories: 170 * portionScale, protein: 12 * portionScale, fat, carbs: 22 * portionScale,
    starchyCarbs: 15 * portionScale, fibrousCarbs: 2 * portionScale, addedSugar: 2 * portionScale, cookingTime: "20 minutes",
  }));
}
const response = (recipes: ReturnType<typeof options>) => ({
  choices: [{ message: { content: JSON.stringify({ options: recipes }) } }],
});
const targets = () => resolveGLP1MealTargets({
  dailyCalorieTarget: 1800, dailyProteinTarget: 100, dailyFatTarget: 60,
  glp1Guardrails: { fatMaxG: 12 },
}, { mealType: "snack" });

beforeEach(() => mockCreate.mockReset());

describe("Recipe Maker real generation pipeline with controlled model output", () => {
  it.each(["Napoleon", "Mille-feuille"])("returns recognizable %s in General Nutrition", async dish => {
    mockCreate.mockResolvedValue(response(options(dish)));
    const result = await generateCravingMealOptions(dish, "snack", undefined, [], undefined, false, "recipe");
    expect(result).toHaveLength(3);
    expect(result.every(meal => meal.name.includes(dish))).toBe(true);
  });

  it.each(["Napoleon", "Mille-feuille"])("returns recognizable adapted %s with GLP-1 active", async dish => {
    mockCreate.mockResolvedValue(response(options(dish)));
    const result = await generateCravingMealOptions(dish, "snack", undefined, [], undefined, false, "recipe", undefined, targets());
    expect(result).toHaveLength(3);
    expect(result.every(meal => meal.name.includes(dish))).toBe(true);
    expect(mockCreate.mock.calls.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(mockCreate.mock.calls[0][0])).toContain("layered pastry and filling");
  });

  it("recovers a richer portion through one bounded identity-preserving adaptation", async () => {
    mockCreate.mockResolvedValueOnce(response(options("Napoleon", 12)))
      .mockResolvedValueOnce(response(options("Napoleon", 4)));
    const result = await generateCravingMealOptions("Napoleon", "snack", undefined, [], undefined, false, "recipe", undefined, targets());
    expect(result).toHaveLength(3);
    expect(result.every(meal => meal.name.includes("Napoleon"))).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mockCreate.mock.calls[1][0])).toContain("keeping it recognizable");
  });

  it("does not promise a result when both attempts exceed the actual clinical allowance", async () => {
    mockCreate.mockResolvedValue(response(options("Napoleon", 12)));
    await expect(generateCravingMealOptions("Napoleon", "snack", undefined, [], undefined, false, "recipe", undefined, targets()))
      .rejects.toMatchObject({ code: "glp1_compliance_retry_exhausted" });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("passes actual preparation evidence through both initial and retry safety checks", async () => {
    mockCreate.mockResolvedValue(response(options("Napoleon", 4, ["Deep fry the pastry layers."])));
    await expect(generateCravingMealOptions("Napoleon", "snack", undefined, [], undefined, false, "recipe", undefined, targets()))
      .rejects.toMatchObject({ code: "glp1_compliance_retry_exhausted" });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
