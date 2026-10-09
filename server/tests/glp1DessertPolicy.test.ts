import { resolveGLP1MealTargets, getGLP1FatCeiling } from "../services/glp1/resolveGLP1MealTargets";
import { validateGLP1Meal, validateGLP1Snack } from "../services/guardrails/validators/glp1Validator";
import { applyGuardrails, validateMealForDiet } from "../services/guardrails";
import { buildGLP1SnackPrompt, buildGLP1ConstraintOverlay, getGLP1IngredientFilter } from "../services/guardrails/prompt/glp1PromptBuilder";
import { getGLP1SystemPrompt } from "../services/guardrails/rules/glp1Rules";
import { formatCreatorNutrition } from "../services/humanFoodContext/formatCreatorNutrition";
import { toPerServingNutrition } from "../services/humanFoodContext/servingNutrition";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { readFileSync } from "fs";

function targets(fatMaxG = 12, mealType: "snack" | "dinner" = "snack", partialBaseline = false) {
  return resolveGLP1MealTargets({
    dailyCalorieTarget: partialBaseline ? undefined : 1800,
    dailyProteinTarget: 100, dailyFatTarget: 60, dailyCarbsTarget: 180,
    glp1Guardrails: { fatMaxG }, isActive: true,
  }, { mealType });
}

// Synthetic, portion-adjusted recipe. Nutrition is a fixture, not a clinical
// assessment or evidence that the generative model always produces this recipe.
function napoleon(fat = 4) {
  return {
    name: "Mini Creamy Napoleon Mille-feuille",
    ingredients: [
      { name: "thin phyllo pastry", quantity: "10", unit: "g" },
      { name: "butter", quantity: "1", unit: "g" },
      { name: "nonfat Greek yogurt", quantity: "85", unit: "g" },
      { name: "low-fat pastry cream", quantity: "15", unit: "g" },
      { name: "powdered sugar", quantity: "2", unit: "g" },
    ],
    instructions: ["Bake thin phyllo layers. Cool, then layer with yogurt and pastry cream. Dust lightly with sugar."],
    macros: { calories: 170, protein: 12, carbs: 22, fat, addedSugar: 2 },
  };
}

function foodContext(): HumanFoodContext {
  return {
    version: "human-food-context.v1", actorUserId: "synthetic", subjectUserId: "synthetic",
    status: "resolved", notices: [], internalFingerprint: "synthetic-dessert",
    diet: { stored: [], effective: [], source: "unavailable", requestOverride: null },
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    flavor: Object.fromEntries(
      ["cuisine", "cuisineIntensity", "heat", "seasoningIntensity", "broadFlavor", "flavorStyle"]
        .map(key => [key, { value: null, available: false, source: "unavailable" }]),
    ),
    sweeteners: { preferred: [], avoided: [] }, authorization: { status: "not_required", waivers: [] },
    nutrition: null, behavior: null, gaps: [],
  } as unknown as HumanFoodContext;
}

describe("GLP-1 dessert composition policy", () => {
  it.each(["Napoleon", "Mille-feuille"])("permits a recognizable smaller-portion %s in General Nutrition and GLP-1", name => {
    const dessert = { ...napoleon(), name: `Mini Creamy ${name}` };
    expect(validateMealForDiet(dessert, "general-nutrition", undefined, true).isValid).toBe(true);
    const result = validateMealForDiet(dessert, "glp1", undefined, true, targets());
    expect(result.isValid).toBe(true);
    expect(result.warnings?.join(" ")).toContain("per-serving nutrition");
    expect(result.warnings?.join(" ")).toContain("added sugar");
  });

  it("rejects a rich portion but allows a proportionally smaller version with the same ingredients", () => {
    const rich = napoleon(12);
    rich.macros.calories = 510;
    rich.macros.protein = 36;
    rich.ingredients = rich.ingredients.map(ingredient => ({
      ...ingredient, quantity: String(Number(ingredient.quantity) * 3),
    }));
    expect(validateGLP1Snack(rich, targets()).isValid).toBe(false);
    const smaller = napoleon(4);
    expect(validateGLP1Snack(smaller, targets()).isValid).toBe(true);
    expect(smaller.name).toBe(rich.name);
    expect(smaller.ingredients.map(i => i.name)).toEqual(rich.ingredients.map(i => i.name));
    expect(Number(smaller.ingredients[0].quantity)).toBe(Number(rich.ingredients[0].quantity) / 3);
  });

  it.each([1, 3, 6])("preserves dessert per-serving nutrition for a %i-serving recipe", servings => {
    const dessert = napoleon();
    const formatted = formatCreatorNutrition({ ...dessert, ...dessert.macros, starchyCarbs: 15 }, servings);
    const portion = toPerServingNutrition({ nutrition: formatted }, servings);
    expect(portion).toMatchObject({ calories: 170, fat: 4, protein: 12, starchyCarbs: 15 });
    expect(validateGLP1Snack({ ...dessert, macros: portion }, targets()).isValid).toBe(true);
  });

  it("preserves the overlay on a non-GLP-1 builder", () => {
    expect(validateMealForDiet(napoleon(), "general-nutrition", undefined, true, targets()).isValid).toBe(true);
    expect(validateMealForDiet(napoleon(10), "general-nutrition", undefined, true, targets()).isValid).toBe(false);
  });

  it("still fails closed on missing or invalid composition evidence", () => {
    expect(validateGLP1Snack({ ...napoleon(), macros: undefined }, targets()).isValid).toBe(false);
    for (const fat of [NaN, Infinity, -1]) {
      expect(validateGLP1Snack(napoleon(fat), targets()).isValid).toBe(false);
    }
  });

  it("keeps actual forbidden preparation and other independent GLP-1 ingredient checks", () => {
    expect(validateGLP1Snack({ ...napoleon(), instructions: ["Deep fry the pastry."] }, targets()).isValid).toBe(false);
    expect(validateGLP1Snack({
      ...napoleon(), ingredients: [{ name: "carbonated soda" }],
    }, targets()).isValid).toBe(false);
  });

  it.each(["milk", "wheat"])("never waives the independent %s allergy", allergy => {
    const context = foodContext();
    context.safety.allergies = [allergy];
    const dessert = napoleon();
    const result = validateHumanFoodCandidate({
      name: dessert.name, ingredients: [...dessert.ingredients, { name: `${allergy} ingredient` }],
      nutrition: dessert.macros,
      evidence: { glp1Compliant: true },
    }, context);
    expect(result.outcome).toBe("blocked");
    expect(result.findings.some(f => f.dimension === "allergy" && f.outcome === "blocked")).toBe(true);
  });

  it("keeps vegan exclusions and active clinician-directed restrictions", () => {
    expect(validateMealForDiet(napoleon(), "vegan", undefined, true, targets()).isValid).toBe(false);
    const context = foodContext();
    context.safety.healthConditions = ["clinician-directed restriction"];
    const result = validateHumanFoodCandidate({
      name: napoleon().name, ingredients: napoleon().ingredients, nutrition: napoleon().macros,
      evidence: { glp1Compliant: true, clinicalDirectivesCompliant: false },
    }, context);
    expect(result.outcome).toBe("blocked");
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "clinical_directive_noncompliant" }));
  });

  it("stops rejecting baking ingredients by name in filtering and prompts", () => {
    expect(getGLP1IngredientFilter(["phyllo pastry", "butter", "cream", "sugar"]))
      .toEqual(["phyllo pastry", "butter", "cream", "sugar"]);
    const base = getGLP1SystemPrompt();
    expect(base).toContain("Napoleon/mille-feuille");
    expect(base.slice(base.indexOf("ABSOLUTELY FORBIDDEN:"))).not.toMatch(/pastries|donuts|cake|ice cream/);
    const prompt = applyGuardrails("Make Napoleon pastry", "glp1", "snack", undefined, undefined, undefined, undefined, targets()).modifiedPrompt;
    expect(prompt).toContain("maximum 4.800000000000001g fat");
    expect(prompt).toContain("preserving their identity");
    expect(buildGLP1ConstraintOverlay("snack", targets())).toContain("Dessert names are not prohibitions");
  });
});

describe("GLP-1 snack-fat ownership", () => {
  it("uses 12g → 4.8g once, and accepts 4g rather than enforcing 2g", () => {
    const t = targets();
    expect(t.maximumToleratedFatGrams).toBeCloseTo(4.8);
    expect(getGLP1FatCeiling(t, true)).toBeCloseTo(4.8);
    expect(validateGLP1Snack(napoleon(4), t).isValid).toBe(true);
    expect(validateGLP1Snack(napoleon(4.9), t).isValid).toBe(false);
    expect(buildGLP1SnackPrompt("Napoleon", t)).toContain(`maximum ${getGLP1FatCeiling(t, true)}g fat`);
  });

  it.each([2, 4, 12, 25])("retains configured %ig ceilings and existing snack caps", ceiling => {
    const t = targets(ceiling);
    expect(getGLP1FatCeiling(t, true)).toBeCloseTo(Math.min(ceiling * 0.4, 8));
    expect(getGLP1FatCeiling(t, true)).toBeLessThanOrEqual(ceiling);
    expect(validateGLP1Snack(napoleon(getGLP1FatCeiling(t, true) + 0.1), t).isValid).toBe(false);
  });

  it("does not round a configured allowance upward", () => {
    const t = targets(4);
    expect(getGLP1FatCeiling(t, true)).toBeCloseTo(1.6);
    expect(validateGLP1Snack(napoleon(1.7), t).isValid).toBe(false);
  });

  it("does not discard explicit allowances when another macro uses a baseline", () => {
    const snack = targets(4, "snack", true);
    expect(snack.usedBaseline).toBe(true);
    expect(getGLP1FatCeiling(snack, true)).toBeCloseTo(1.6);
    expect(validateGLP1Snack(napoleon(2), snack).isValid).toBe(false);
    const meal = targets(4, "dinner", true);
    expect(validateGLP1Meal(napoleon(5), false, meal).isValid).toBe(false);
  });

  it("retains existing missing-target defaults without overriding a tighter provider allowance", () => {
    const t = resolveGLP1MealTargets({ glp1Guardrails: { fatMaxG: 4 } }, { mealType: "snack" });
    expect(t.maximumToleratedFatGrams).toBeCloseTo(1.6);
    expect(getGLP1FatCeiling(t, true)).toBeCloseTo(1.6);
    expect(getGLP1FatCeiling(undefined, true)).toBe(5);
    expect(resolveGLP1MealTargets({}, { mealType: "snack" }).maximumToleratedFatGrams).toBe(5);
    expect(getGLP1FatCeiling(resolveGLP1MealTargets({}, { mealType: "dinner" }))).toBe(12);
  });

  it("allocates meal-resolved targets once when a shared plan validates a snack", () => {
    const t = targets(12, "dinner");
    expect(getGLP1FatCeiling(t, true)).toBeCloseTo(4.8);
    expect(getGLP1FatCeiling(t, false)).toBe(12);
    expect(validateGLP1Snack(napoleon(4), t).isValid).toBe(true);
  });

  it("rejects corrupt allowance evidence rather than silently disabling validation", () => {
    expect(() => getGLP1FatCeiling({ ...targets(), maximumToleratedFatGrams: NaN }, true)).toThrow();
  });

  it("uses the same allowance in initial generation and bounded retry prompts", () => {
    const source = readFileSync("server/services/unifiedMealPipeline.ts", "utf8");
    expect(source).toContain('getGLP1FatCeiling(t, validMealType === "snack")');
    expect(source).toContain('getGLP1FatCeiling(glp1Targets!, validMealType === "snack")');
    expect(source).toContain("getGLP1FatCeiling(glp1Targets, true)");
    expect(source).not.toContain("maximumToleratedFatGrams * 0.4");
  });
});
