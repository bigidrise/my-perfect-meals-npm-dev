jest.mock("../services/mealgenV2", () => ({
  getOnboarding: jest.fn(),
  onboardingHash: jest.fn()
}));

jest.mock("../services/ontology", () => ({
  allergenViolated: jest.fn(() => null),
  banViolated: jest.fn(() => null)
}));

jest.mock("../services/dietRules", () => ({
  validateDietPacks: jest.fn(() => null)
}));

import { generateStrictMeal } from "../services/mealgen_v2";
import { parseMeasurementNumber } from "../../shared/units";

const originalFetch = global.fetch;
const mockFetch = jest.fn();

const request = {
  userId: "strict-measurement-test",
  courseStyle: "lunch",
  ob: {},
  slotsPerDay: 3
};

function mockMeal(ingredient: unknown, overrides = {}) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      name: "Rice and lentil bowl",
      ingredients: [
        ingredient,
        { name: "lentils", amount: "100 g" }
      ],
      instructions: [
        "Prepare the ingredients.",
        "Combine and serve warm."
      ],
      calories: 400,
      protein: 25,
      carbs: 50,
      fats: 10,
      ...overrides
    })
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("Strict MealGen measurement integrity", () => {
  it.each([
    ["0.125", "cup", 0.125],
    ["0.005", "cup", 0.005],
    ["0.249", "cup", 0.249],
    ["1/8", "cup", 0.125],
    ["1 1/2", "cup", 1.5],
    ["0,5", "taza", 0.5]
  ])("preserves structured measurement %s %s", async (quantity, unit, expected) => {
    mockMeal({ name: "rice", quantity, unit });

    const meal = await generateStrictMeal(request);
    const amount = meal.ingredients[0].amount;

    expect(amount).toMatch(/ cup$/);
    expect(parseMeasurementNumber(
      amount.replace(/ cup$/, "")
    )).toBe(expected);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    "0 g",
    "-100 g",
    "1/0 cup",
    "1 handful",
    "100 g extra",
    "100 g 200 g",
    "1 scoop",
    "invalid 100 g"
  ])("rejects malformed measurement %s", async amount => {
    mockMeal({ name: "rice", amount });

    await expect(generateStrictMeal(request)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(
      Number(process.env.MEALGEN_MAX_TRIES || 4)
    );
  });

  it("rejects conflicting quantities", async () => {
    mockMeal({
      name: "rice",
      amount: "100 g",
      quantity: "200",
      unit: "g"
    });

    await expect(generateStrictMeal(request)).rejects.toThrow();
  });

  it("rejects conflicting units", async () => {
    mockMeal({
      name: "rice",
      amount: "100 g",
      unit: "oz"
    });

    await expect(generateStrictMeal(request)).rejects.toThrow();
  });

  it("rejects unavailable calorie evidence when a target exists", async () => {
    mockMeal(
      { name: "rice", amount: "100 g" },
      { calories: undefined }
    );

    await expect(generateStrictMeal({
      ...request,
      ob: { caloriesTarget: 1200 }
    })).rejects.toThrow();
  });

  it("rejects unavailable protein evidence when a target exists", async () => {
    mockMeal(
      { name: "rice", amount: "100 g" },
      { protein: undefined }
    );

    await expect(generateStrictMeal({
      ...request,
      ob: { caloriesTarget: 1200, proteinPerMeal: 25 }
    })).rejects.toThrow();
  });
});

describe("Independent nutritional target enforcement", () => {
  it("rejects missing protein evidence without a calorie target", async () => {
    mockMeal(
      { name: "rice", amount: "100 g" },
      { protein: undefined }
    );

    await expect(generateStrictMeal({
      ...request,
      ob: { proteinPerMeal: 25 }
    })).rejects.toThrow("protein_evidence_missing");
  });

  it("rejects insufficient protein without a calorie target", async () => {
    mockMeal(
      { name: "rice", amount: "100 g" },
      { protein: 10 }
    );

    await expect(generateStrictMeal({
      ...request,
      ob: { proteinPerMeal: 25 }
    })).rejects.toThrow("protein_low");
  });

  it("accepts a meal meeting an independent protein target", async () => {
    mockMeal({ name: "rice", amount: "100 g" });

    const meal = await generateStrictMeal({
      ...request,
      ob: { proteinPerMeal: 25 }
    });

    expect(meal.protein).toBe(25);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts missing optional macros when no targets exist", async () => {
    mockMeal(
      { name: "rice", amount: "100 g" },
      { calories: undefined, protein: undefined }
    );

    const meal = await generateStrictMeal(request);
    expect(meal.calories).toBeUndefined();
    expect(meal.protein).toBeUndefined();
  });
});
