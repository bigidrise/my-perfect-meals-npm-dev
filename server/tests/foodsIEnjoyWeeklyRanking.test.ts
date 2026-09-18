import { scoreTemplateForUser, fitsBaseSafety, type PlanParams, type Template } from "../services/rulesEngine";

const base: Template = {
  id: "safe", slug: "safe", name: "Mango Chicken Salad", type: "lunch",
  calories: 400, protein: 35, carbs: 50, fat: 12, dietTags: ["balanced"], badges: [],
  allergens: [], vegetables: 2, ingredients: [{ name: "mango", amount: 1, unit: "cup" }],
  steps: [], cuisine: "international",
};
const unsafe: Template = {
  ...base, id: "unsafe", slug: "unsafe", name: "Mango Peanut Salad",
  allergens: ["peanut"], ingredients: [{ name: "mango", amount: 1, unit: "cup" }, { name: "peanut", amount: 1, unit: "tbsp" }],
};

const params: PlanParams = {
  weeks: 1, mealsPerDay: 3, snacksPerDay: 0,
  targets: { calories: 2000, protein: 140 },
  userAllergens: ["peanut"],
  preferredFoods: ["mango"],
};

describe("Foods I Enjoy weekly ranking", () => {
  it("ranks an enjoyed food among already-safe candidates", () => {
    expect(fitsBaseSafety(base, params)).toBe(true);
    expect(scoreTemplateForUser(base, params)).toBeGreaterThan(scoreTemplateForUser({ ...base, name: "Chicken Salad", ingredients: [{ name: "chicken", amount: 1, unit: "cup" }] }, params));
  });

  it("cannot make an unsafe candidate eligible", () => {
    expect(fitsBaseSafety(unsafe, params)).toBe(false);
    expect(scoreTemplateForUser(unsafe, params)).toBeGreaterThan(scoreTemplateForUser(base, { ...params, preferredFoods: [] }));
    // The source pool must filter safety before applying this soft score.
    expect([base, unsafe].filter((candidate) => fitsBaseSafety(candidate, params))).toEqual([base]);
  });
});