jest.mock("../db", () => ({
  pool: { query: jest.fn(() => { throw new Error("Real database access forbidden in final-scan fixtures"); }) },
  db: {},
}));
import { buildGuestEnvelope, scanGeneratedOutput, filterMealsByProtocol } from "../services/protocolEnvelope";
import { filterSavedGroceriesForCompliance, type SavedGroceryItemSlim } from "../services/savedGroceryCompliance";

const safe = { name: "Baked chicken", ingredients: [{ name: "chicken breast" }, { name: "broccoli" }, { name: "olive oil" }], instructions: ["Bake."] };
const unsafe = { ...safe, ingredients: [{ name: "chicken breast" }, { name: "canola oil" }] };

test.each(["general_nutrition", "diabetic", "glp1"])(
  "%s: final scan rejects the actual blocked oil and permits the safe substitution", program => {
    const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true,
      medicalHardLimits: program === "diabetic" ? ["diabetes"] : program === "glp1" ? ["glp1"] : [] };
    expect(scanGeneratedOutput(unsafe, envelope).passed).toBe(false);
    expect(scanGeneratedOutput(safe, envelope).passed).toBe(true);
    expect(scanGeneratedOutput(unsafe, { ...envelope, personalAntiInflammatorySupport: false }).passed).toBe(true);
    expect(envelope.medicalHardLimits).toEqual(program === "general_nutrition" ? [] : [program === "diabetic" ? "diabetes" : "glp1"]);
  },
);
test.each(["cache", "template", "AI", "ingredient-swap", "restaurant", "beverage", "fridge-rescue"])(
  "%s results use the same final ingredient rejection, not a prompt-only pass", source => {
    const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true };
    expect(filterMealsByProtocol([unsafe, safe], envelope, { generatorName: source })).toEqual([safe]);
    expect(filterMealsByProtocol([unsafe, safe], { ...envelope, personalAntiInflammatorySupport: false })).toEqual([unsafe, safe]);
  },
);
test("allergies and dietary identity remain non-waivable by optional support", () => {
  const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true, allergies: ["peanuts"], dietaryIdentity: ["vegan"] };
  expect(scanGeneratedOutput({ name: "Bowl", ingredients: ["peanut", "chicken breast", "olive oil"] }, envelope).passed).toBe(false);
  expect(scanGeneratedOutput({ name: "Plant bowl", ingredients: ["broccoli", "chickpeas", "olive oil"] }, envelope).passed).toBe(true);
});

const product = (ingredients?: string[]): SavedGroceryItemSlim => ({
  id: "synthetic-product", productName: "Fixture product", productKey: "fixture",
  brand: null, category: null, nutritionJson: { calories: 200, protein: 20, carbs: 10, fat: 25 },
  ingredients,
});
test("saved grocery recommendations are revalidated without deleting saved products", () => {
  const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true };
  const oilProduct = product(["chicken breast", "canola oil"]);
  expect(filterSavedGroceriesForCompliance([oilProduct], envelope).excluded).toHaveLength(1);
  expect(filterSavedGroceriesForCompliance([product(["chicken breast", "olive oil"])], envelope).compliant).toHaveLength(1);
  expect(filterSavedGroceriesForCompliance([product()], envelope).excluded[0].exclusionCategory).toBe("evidence_missing");
  expect(filterSavedGroceriesForCompliance([oilProduct], { ...envelope, personalAntiInflammatorySupport: false }).compliant).toHaveLength(1);
  expect(oilProduct.ingredients).toEqual(["chicken breast", "canola oil"]);
});
test("GLP-1 ceilings still reject an otherwise Anti-Inflammatory-safe saved product", () => {
  const envelope = { ...buildGuestEnvelope(), personalAntiInflammatorySupport: true };
  const result = filterSavedGroceriesForCompliance([product(["chicken breast", "olive oil"])], envelope, {
    glp1Targets: { maximumToleratedFatGrams: 10, resolvedMealCalories: 350 },
  });
  expect(result.compliant).toHaveLength(0);
  expect(result.excluded[0].exclusionReason).toMatch(/fat|GLP/i);
});
