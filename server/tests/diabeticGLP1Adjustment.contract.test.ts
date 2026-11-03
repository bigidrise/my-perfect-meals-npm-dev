// No account lookup or model/provider calls: exercise the real existing rules.
jest.mock("../db", () => ({
  db: {}, pool: { query: jest.fn(() => { throw new Error("Unexpected database call"); }) },
}));
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => { throw new Error("Paid generation forbidden"); }),
}));
import { applyGuardrails, validateMealForDiet } from "../services/guardrails";
import { resolveGLP1MealTargets } from "../services/glp1/resolveGLP1MealTargets";

const resolve = (appetiteLevel: "normal" | "suppressed") => resolveGLP1MealTargets({
  dailyCalorieTarget: 2000, dailyProteinTarget: 120, appetiteLevel,
  glp1Guardrails: { proteinMinG: 30, fatMaxG: 12 },
}, { mealType: "lunch" });

describe("existing Diabetic + GLP-1 adjustment integration", () => {
  it("adjusts meal energy for suppressed appetite without scaling away the protein floor", () => {
    const normal = resolve("normal");
    const suppressed = resolve("suppressed");
    expect(suppressed.resolvedMealCalories).toBeLessThan(normal.resolvedMealCalories);
    expect(suppressed.targetProteinGrams).toBeGreaterThanOrEqual(30);
    expect(suppressed.targetProteinGrams).toBe(normal.targetProteinGrams);
  });
  it("adds personalized GLP-1 protein guidance to the diabetic prompt without replacing its base", () => {
    const targets = resolve("normal");
    // Diabetic conditioning itself is owned by hubCoupling, not the legacy
    // diabetic branch in applyGuardrails.
    const prompt = applyGuardrails("Create a diabetes-appropriate lunch.", "diabetic", "lunch", undefined, undefined, "targeted", 120, targets).modifiedPrompt;
    expect(prompt.toLowerCase()).toContain("diabet");
    expect(prompt).toContain("GLP-1");
    expect(prompt).toContain(String(targets.targetProteinGrams));
  });
  it("does not let personalized GLP-1 targets bypass diabetic carbohydrate validation", () => {
    const meal = {
      name: "Chicken and rice", ingredients: [
        { name: "chicken breast", quantity: 120, unit: "g" },
        { name: "white rice", quantity: 300, unit: "g" },
      ],
      instructions: ["Steam the rice and cook the chicken."],
      macros: { calories: 500, protein: 40, carbs: 90, fat: 5 },
    };
    const result = validateMealForDiet(meal as any, "diabetic", undefined, false, resolve("normal"));
    expect(result.isValid).toBe(false);
    expect(result.violations.join(" ").toLowerCase()).toMatch(/carb|starch|diabet|white rice/);
  });
});
