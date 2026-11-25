jest.mock("../storage", () => ({ storage: {} }));
jest.mock("../services/allergyGuardrails", () => ({
  buildForbiddenIngredients: () => [], buildSafetyGuardrails: () => "",
  scanForViolations: () => [], validateMealSafety: () => ({ safe: true }),
  logSafetyEnforcement: jest.fn(),
}));

import { generateMealV2 } from "../services/mealgenV2";

const base = {
  name: "Lentil bowl", ingredients: [{ name: "lentils", quantity: 1, unit: "cup", notes: "canned, drained" }],
  instructions: "Fold lentils into the salad.", calories: 300, protein: 15, carbs: 40, fat: 5,
};
const opts = { userId: "synthetic-owner", courseStyle: "Lunch" as const, onboarding: {}, includeImage: false };
const completion = (meal: any) => ({ ok: true, json: async () => ({ meals: [meal] }) });

describe("MealGen V2 shared preparation gate with offline HTTP", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("preserves the normalized quantity, nutrition and canned-form notes", async () => {
    global.fetch = jest.fn().mockResolvedValue(completion(base));
    const meal = await generateMealV2(opts);
    expect(meal.ingredients[0]).toMatchObject({ name: expect.stringContaining("canned"), amount: "1 cup" });
    expect(meal.calories).toBe(300);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the existing retry to replace dried-as-canned output with a coherent recipe", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(completion({ ...base, ingredients: [{ name: "dried lentils", quantity: 1, unit: "cup" }] }))
      .mockResolvedValueOnce(completion(base));
    const meal = await generateMealV2(opts);
    expect(meal.ingredients[0].name).toContain("canned");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).cravingInput).toContain("cooking method");
  });

  it("fails closed at the existing four-retry limit without unlimited model calls", async () => {
    global.fetch = jest.fn().mockResolvedValue(completion({
      ...base, ingredients: [{ name: "lentils", quantity: 1, unit: "cup" }],
    }));
    await expect(generateMealV2(opts)).rejects.toMatchObject({ name: "MealRecipeValidationError" });
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });
});

describe("MealGen V2 measurement integrity", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it.each([
    ["0,5", "cup", "0.5"],
    ["0.125", "cup", "0.125"],
    ["0.005", "cup", "0.005"],
    ["0.249", "cup", "0.249"],
    ["1/8", "cup", "0.125"],
    ["1 1/2", "cup", "1.5"],
    ["0,5", "taza", "0.5"],
  ])("preserves quantity %s %s", async (quantity, unit, expected) => {
    global.fetch = jest.fn().mockResolvedValue(completion({
      ...base,
      ingredients: [{ name: "lentils", quantity, unit, notes: "canned, drained" }],
    }));
    const meal = await generateMealV2(opts);
    const { parseMeasurementNumber } = await import("../../shared/units");
    const amount = meal.ingredients[0].amount;
    expect(parseMeasurementNumber(amount.replace(/\s+(cup|cups|taza|tazas)$/, ""))).toBe(Number(expected));
  });

  it.each([
    { quantity: "invalid", unit: "cup" },
    { quantity: "1/0", unit: "cup" },
    { quantity: 0, unit: "cup" },
    { quantity: -1, unit: "cup" },
    { quantity: 1, unit: "" },
    { quantity: 1, unit: "handful" },
    { unit: "cup" },
    { quantity: 1, amount: 2, unit: "cup" },
  ])("rejects unverifiable measurements: %j", async (measurement) => {
    global.fetch = jest.fn().mockResolvedValue(completion({
      ...base,
      ingredients: [{ name: "lentils", notes: "canned, drained", ...measurement }],
    }));
    await expect(generateMealV2(opts)).rejects.toMatchObject({
      name: "MealRecipeValidationError",
    });
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });
});
