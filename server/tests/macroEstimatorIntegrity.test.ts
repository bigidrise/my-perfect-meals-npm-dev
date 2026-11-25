import { estimateMacros } from "../services/macroEstimator";

describe("Macro estimator measurement integrity", () => {
  it.each([
    ["0.5 cup", 120],
    ["1/2 cup", 120],
    ["½ cup", 120],
    ["0,5 cup", 120],
    ["0,5 taza", 120],
    ["1 1/2 cup", 360],
    ["1/8 cup", 30],
    ["0.125 cup", 30],
    ["100 gramos", 100],
    ["1 kg", 1000],
    ["1 lb", 453.59237]
  ])("preserves measurement %s", (amount, grams) => {
    expect(estimateMacros([
      { name: "rice", amount }
    ])).toEqual({
      kcal: Math.round(130 * grams / 100),
      protein: Math.round(2.7 * grams / 100),
      carbs: Math.round(28 * grams / 100),
      fat: Math.round(0.3 * grams / 100)
    });
  });

  it.each([
    "invalid",
    "1/0 cup",
    "-100 g",
    "0 g",
    "100",
    "100 handful",
    "100 scoop",
    "100 unknown",
    "100 g extra",
    "100 g 200 g"
  ])("rejects invalid measurement %s", amount => {
    expect(estimateMacros([
      { name: "rice", amount }
    ])).toBeNull();
  });

  it("does not report a partial estimate as a complete meal estimate", () => {
    expect(estimateMacros([
      { name: "rice", amount: "100 g" },
      { name: "olive oil", amount: "1 handful" }
    ])).toBeNull();
  });
});
