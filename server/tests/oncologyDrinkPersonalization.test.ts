import { adaptHydrationOption, oncologyBeverageCategoryRules, oncologyBeverageViolations, recommendationOncologySymptoms, withOncologyBeverageProof } from "../services/guardrails/prompt/oncologyRecommendationContext";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

function context(symptoms: string[], enabled = true) {
  return { oncologySupportContext: { enabled, symptoms, emphasis: { highProteinNutrientDensity: true }, source: "self" } } as UserProtocolEnvelope;
}
const originalEnv = { node: process.env.NODE_ENV, deployment: process.env.REPLIT_DEPLOYMENT, production: process.env.VITE_IS_PRODUCTION_PROJECT };
beforeEach(() => { process.env.NODE_ENV = "development"; delete process.env.REPLIT_DEPLOYMENT; delete process.env.VITE_IS_PRODUCTION_PROJECT; });
afterAll(() => {
  for (const [key, value] of [["NODE_ENV", originalEnv.node], ["REPLIT_DEPLOYMENT", originalEnv.deployment], ["VITE_IS_PRODUCTION_PROJECT", originalEnv.production]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});

const gentle = { name: "Smooth banana drink", description: "A small manageable drink.", ingredients: [{ name: "banana" }, { name: "water" }], instructions: ["Blend and serve."], activePrepMinutes: 3 };
test("OFF means no active symptoms, no adapted hydration options", () => {
  const option = { title: "Taste", description: "Try a flavor", destinationType: "beverage_creator" };
  expect(recommendationOncologySymptoms(context(["mouth_sensitivity"], false))).toEqual([]);
  expect(adaptHydrationOption(option, context(["mouth_sensitivity"], false))).toBe(option);
});
test("Hydration projects all five existing tolerances without a new dose or target", () => {
  const result = adaptHydrationOption({ description: "Try a flavor" }, context(["mouth_sensitivity", "nausea", "gi_sensitivity", "low_appetite", "fatigue_low_prep"]));
  expect(result.description).toMatch(/Skip citrus/);
  expect(result.description).toMatch(/not greasy/);
  expect(result.description).toMatch(/rough, very high-fiber/);
  expect(result.description).toMatch(/small and manageable/);
  expect(result.description).toMatch(/simple options/);
  expect(result.description).toMatch(/clinician instructions/);
  expect(result.description).not.toMatch(/\d+\s*(ml|mg|liters|ounces)/i);
});
test("category conflicts are replaced only when the relevant symptom is active", () => {
  const rules = "- Rich, indulgent, and satisfying\n- Include ice cream or frozen yogurt base\n- Suggest optional add-ins (chia seeds, flax, etc.)\n- Include topping/garnish suggestions";
  expect(oncologyBeverageCategoryRules(rules, context([]))).toBe(rules);
  const changed = oncologyBeverageCategoryRules(rules, context(["gi_sensitivity", "fatigue_low_prep"]));
  expect(changed).not.toMatch(/Rich, indulgent|Include ice cream|Suggest optional add-ins|Include topping/);
  expect(changed).toMatch(/allerg|Allerg/i);
});
test("mouth sensitivity rejects citrus even after a nominally passing protocol scan", () => {
  const acid = { ...gentle, ingredients: [{ name: "lemon juice" }] };
  expect(withOncologyBeverageProof({ passed: true }, acid, context(["mouth_sensitivity"])).passed).toBe(false);
  expect(withOncologyBeverageProof({ passed: true }, gentle, context(["mouth_sensitivity"])).passed).toBe(true);
  expect(oncologyBeverageViolations({ ...gentle, ingredients: [{ name: "fresh orange" }] }, context(["mouth_sensitivity"]))).not.toEqual([]);
});
test.each(["orange", "lemon", "pineapple"])("the reported acidic ingredient %s cannot survive an active mouth-sensitivity check", ingredient => {
  const drink = { ...gentle, ingredients: [{ name: ingredient }] };
  expect(withOncologyBeverageProof({ passed: true }, drink, context(["mouth_sensitivity"])).passed).toBe(false);
  expect(withOncologyBeverageProof({ passed: true }, drink, context([])).passed).toBe(true);
});
test("nausea/GI reject explicit heavy or rough preparations, not all creamy drinks or fiber", () => {
  expect(oncologyBeverageViolations({ ...gentle, ingredients: [{ name: "heavy whipping cream" }] }, context(["nausea"]))).not.toEqual([]);
  expect(oncologyBeverageViolations({ ...gentle, ingredients: [{ name: "whole chia seeds" }] }, context(["gi_sensitivity"]))).not.toEqual([]);
  expect(oncologyBeverageViolations({ ...gentle, name: "Smooth creamy oat drink", ingredients: [{ name: "well-cooked oatmeal" }] }, context(["gi_sensitivity", "mouth_sensitivity"]))).toEqual([]);
});
test("low appetite rejects explicitly oversized individual servings, not multi-person batches", () => {
  expect(oncologyBeverageViolations({ ...gentle, description: "An oversized single serving" }, context(["low_appetite"]))).not.toEqual([]);
  expect(oncologyBeverageViolations({ ...gentle, servings: 10, description: "Ten small manageable servings" }, context(["low_appetite"]))).toEqual([]);
});
test("fatigue rejects missing or excessive active preparation evidence", () => {
  for (const activePrepMinutes of [undefined, 20, -1, NaN]) {
    expect(oncologyBeverageViolations({ ...gentle, activePrepMinutes }, context(["fatigue_low_prep"]))).not.toEqual([]);
  }
  expect(oncologyBeverageViolations(gentle, context(["fatigue_low_prep"]))).toEqual([]);
});
test("original allergies/diet/clinical failures cannot be relaxed", () => {
  const proof = { passed: false, message: "Allergy and clinician restriction" };
  expect(withOncologyBeverageProof(proof, gentle, context(["nausea"]))).toEqual(proof);
});
test("original hard blocks and forbidden medical claims remain checked, including reasoning", () => {
  expect(oncologyBeverageViolations({ ...gentle, ingredients: [{ name: "honey" }] }, context([]))).not.toEqual([]);
  expect(oncologyBeverageViolations({ ...gentle, reasoning: "This drink cures cancer." }, context([]))).not.toEqual([]);
});
test.each(["production", "test"])("no Production or non-Development behavior changes (%s)", node => {
  process.env.NODE_ENV = node;
  const option = { description: "Original" };
  expect(adaptHydrationOption(option, context(["mouth_sensitivity"]))).toBe(option);
  expect(oncologyBeverageViolations({ ...gentle, ingredients: [{ name: "lemon juice" }] }, context(["mouth_sensitivity"]))).toEqual([]);
});
test("published and Production-project Development runtimes are also excluded", () => {
  delete process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED;
  process.env.REPLIT_DEPLOYMENT = "1";
  expect(recommendationOncologySymptoms(context(["nausea"]))).toEqual([]);
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.VITE_IS_PRODUCTION_PROJECT = "true";
  expect(recommendationOncologySymptoms(context(["nausea"]))).toEqual([]);
});
