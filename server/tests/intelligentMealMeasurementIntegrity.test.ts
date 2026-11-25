jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../storage", () => ({
  storage: { getUser: jest.fn() }
}));

jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn()
}));

import OpenAI from "openai";
import { storage } from "../storage";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { generateIntelligentMeal } from "../services/intelligentMealGenerator";
import { parseMeasurementNumber } from "../../shared/units";

const create = jest.fn();

const request = {
  userId: "measurement-test-user",
  description: "Lentil salad",
  mode: "generate" as const
};

function mockMeal(ingredients: unknown) {
  create.mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          meal: {
            name: "Lentil salad",
            description: "Lentil salad",
            ingredients,
            instructions: "Combine cooked lentils.",
            calories: 300,
            protein: 20,
            carbs: 40,
            fat: 5
          }
        })
      }
    }]
  });
}

beforeAll(() => {
  process.env.OPENAI_API_KEY ||= "test-placeholder";
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
    chat: { completions: { create } }
  }));
});

beforeEach(() => {
  jest.clearAllMocks();
  create.mockReset();
  (storage.getUser as jest.Mock).mockResolvedValue({
    preferredLanguage: "en"
  });
  (generateMealImageUnified as jest.Mock).mockResolvedValue(
    "/images/test-meal.jpg"
  );
});

describe("Intelligent meal measurement integrity", () => {
  it.each([
    ["0.125", "cup", 0.125],
    ["0.005", "cup", 0.005],
    ["0.249", "cup", 0.249],
    ["1/8", "cup", 0.125],
    ["1 1/2", "cup", 1.5],
    ["0,5", "taza", 0.5]
  ])("preserves quantity %s %s", async (quantity, unit, expected) => {
    mockMeal([{ name: "lentils", quantity, unit }]);

    const result = await generateIntelligentMeal(request);
    const ingredient = result.meal?.ingredients[0];

    expect(ingredient?.name).toBe("lentils");
    expect(typeof ingredient?.quantity).toBe("string");
    expect(parseMeasurementNumber(ingredient?.quantity)).toBe(expected);
    expect(ingredient?.unit).toBe("cup");
    expect(generateMealImageUnified).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing ingredients", undefined],
    ["empty ingredients", []],
    ["missing quantity", [{ name: "lentils", unit: "cup" }]],
    ["missing unit", [{ name: "lentils", quantity: "1" }]],
    ["invalid quantity", [{ name: "lentils", quantity: "invalid", unit: "cup" }]],
    ["zero quantity", [{ name: "lentils", quantity: "0", unit: "cup" }]],
    ["negative quantity", [{ name: "lentils", quantity: "-1", unit: "cup" }]],
    ["invalid fraction", [{ name: "lentils", quantity: "1/0", unit: "cup" }]],
    ["unsupported unit", [{ name: "lentils", quantity: "1", unit: "handful" }]],
    ["conflicting quantities", [{ name: "lentils", quantity: "1", amount: "2", unit: "cup" }]],
    ["conflicting units", [{ name: "lentils", amount: "1 cup", unit: "oz" }]]
  ])("rejects %s before image generation", async (_label, ingredients) => {
    mockMeal(ingredients);

    const result = await generateIntelligentMeal(request);

    expect(result.meal).toBeUndefined();
    expect(generateMealImageUnified).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns an English fallback when generation fails", async () => {
    create.mockRejectedValue(new Error("Mock generation failure"));

    const result = await generateIntelligentMeal(request);

    expect(result.meal).toBeUndefined();
    expect(result.conversationalResponse).toMatch(/trouble|unable|could not/i);
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("returns a Spanish fallback when generation fails", async () => {
    (storage.getUser as jest.Mock).mockResolvedValue({
      preferredLanguage: "es"
    });

    create.mockRejectedValue(new Error("Mock generation failure"));

    const result = await generateIntelligentMeal(request);

    expect(result.meal).toBeUndefined();
    expect(result.conversationalResponse).toMatch(/problemas|dificultad|pudimos|puedo/i);
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });
});
