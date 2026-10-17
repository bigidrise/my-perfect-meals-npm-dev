import {
  CARDIAC_DESSERT_ADAPTATION,
  developmentSnackRepairEnabled,
  matchesIngredientPhrase,
  SnackCompatibilityError,
  validateCardiacSnackIngredients,
} from "../services/snackCompatibilityRepair";
import { validateMealForDiet } from "../services/guardrails";
import { heartFailureBlockedIngredients } from "../services/guardrails/prompt/heartFailurePromptBuilder";

describe("Development snack ingredient identity and clinical provenance", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
  });
  afterEach(() => {
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it.each([
    ["graham cracker", "ham", false],
    ["unsalted butter", "salted butter", false],
    ["smoked ham", "ham", true],
    ["salted butter", "salted butter", true],
    ["low-fat cream cheese", "cream cheese", true],
  ])("identifies %s against %s without substring confusion", (name, term, expected) => {
    expect(matchesIngredientPhrase(name, term)).toBe(expected);
  });

  it.each(["low-fat cream cheese", "cream cheese (low-fat)", "unsalted butter",
    "graham cracker crumbles (no added salt)"])("does not infer clinical approval from %s", name => {
    const result = validateCardiacSnackIngredients([{ name, quantity: "1", unit: "tbsp" }],
      heartFailureBlockedIngredients);
    expect(result.isValid).toBe(false);
    expect(result.issues?.[0]).toMatchObject({
      source: "heart-failure", ruleId: "cardiac:qualified_ingredient_evidence_required",
    });
    expect(result.violations[0]).toContain("1 tbsp");
    expect(result.violations[0]).not.toContain("ingredient: ham");
    expect(result.violations[0]).not.toContain("ingredient: salted butter");
  });

  it("retains real cardiac restrictions and compatible substitute ingredients", () => {
    expect(validateCardiacSnackIngredients([{ name: "smoked ham" }], heartFailureBlockedIngredients)
      .issues?.[0].ruleId).toBe("cardiac:restricted_ingredient");
    expect(validateCardiacSnackIngredients([{ name: "plain nonfat Greek yogurt", quantity: "1", unit: "cup" }],
      heartFailureBlockedIngredients).isValid).toBe(true);
    expect(CARDIAC_DESSERT_ADAPTATION).toContain("allergies/diet");
    expect(CARDIAC_DESSERT_ADAPTATION).toContain("not automatic approvals");
  });

  it("keeps cardiac and GLP-1 source identifiers separate with both protocols active", () => {
    const result = validateMealForDiet({
      name: "Cheesecake",
      ingredients: [{ name: "cream cheese", quantity: "4", unit: "oz" }],
      macros: { calories: 700, protein: 1, fat: 80, carbs: 30 },
    }, "heart-failure", undefined, true, {
      resolvedSnackCalories: 200, maximumToleratedFatGrams: 10, targetProteinGrams: 20,
      minimumProteinFloor: 20, treatmentPhase: "baseline", usedBaseline: true,
    } as any, { developmentSnackRepair: true });
    expect(result.isValid).toBe(false);
    expect(result.issues?.some(issue => issue.source === "heart-failure")).toBe(true);
    expect(result.issues?.some(issue => issue.source === "glp1")).toBe(true);
    const error = new SnackCompatibilityError(result.issues!, 2);
    expect(error.message).toContain("[heart-failure]");
    expect(error.message).toContain("[glp1]");
  });

  it("does not activate for other callers, Production, or published Development", () => {
    const meal = { name: "Graham", ingredients: [{ name: "graham", quantity: "1", unit: "oz" }] };
    expect(validateMealForDiet(meal, "heart-failure", undefined, true).issues).toBeUndefined();
    process.env.NODE_ENV = "production";
    expect(developmentSnackRepairEnabled()).toBe(false);
    expect(validateMealForDiet(meal, "heart-failure", undefined, true, undefined,
      { developmentSnackRepair: true }).issues).toBeUndefined();
    process.env.NODE_ENV = "development";
    process.env.REPLIT_DEPLOYMENT = "1";
    expect(developmentSnackRepairEnabled()).toBe(false);
  });
});
