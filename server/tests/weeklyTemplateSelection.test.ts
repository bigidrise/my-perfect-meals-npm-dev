import { scoreTemplateForUser, selectWeeklyTemplate, type PlanParams, type Template } from "../services/rulesEngine";

const params: PlanParams = {
  weeks: 1, mealsPerDay: 1, snacksPerDay: 0,
  targets: { calories: 2000, protein: 100 },
  diet: "balanced",
  optimizationTags: ["anti-inflammatory"],
};

function template(slug: string, dietTags: string[]): Template {
  return {
    id: slug, slug, name: slug, type: "breakfast", calories: 300, protein: 20,
    carbs: 30, fat: 10, dietTags, badges: [], allergens: [],
    ingredients: [{ name: "oats", amount: 1, unit: "cup" }],
    steps: [],
  };
}

test("explicit support metadata wins over an otherwise comparable template without claiming nutrient proof", () => {
  const plain = template("plain", ["balanced"]);
  const tagged = template("tagged", ["anti-inflammatory"]);
  expect(scoreTemplateForUser(tagged, params)).toBeGreaterThan(scoreTemplateForUser(plain, params));
  expect(selectWeeklyTemplate([tagged, plain], new Set(), params)).toBe(tagged);
  expect(selectWeeklyTemplate([tagged, plain], new Set(["tagged"]), params)).toBe(plain);
  expect(selectWeeklyTemplate([plain, tagged], new Set(), { ...params, optimizationTags: [] })).toBe(plain);
});