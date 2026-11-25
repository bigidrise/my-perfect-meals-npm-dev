import { readFileSync } from "node:fs";
import { GLP1_CHEESE_PRODUCT_GUIDANCE, hasMeasuredCheeseQuantity, isGLP1CompositionSensitiveCheese } from "../../shared/glp1CheesePolicy";
import { validateGLP1Meal } from "../services/guardrails/validators/glp1Validator";
import { resolveGLP1MealTargets } from "../services/glp1/resolveGLP1MealTargets";
import { buildGLP1Prompt, buildGLP1ConstraintOverlay, getGLP1IngredientFilter } from "../services/guardrails/prompt/glp1PromptBuilder";
import { validateMealForDiet } from "../services/guardrails";
import { validateIngredientPrecision } from "../services/guardrails/ingredientPrecision";
import { estimateCaloriesFromIngredients, checkIngredientSanity } from "../services/calorieEstimator";
import { toPerServingNutrition } from "../services/humanFoodContext/servingNutrition";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { shoppingCatalogTip, shoppingCatalogPresentation } from "../services/productDiscovery/shoppingCatalogGuidance";
import { resolveProductRulePolicy, DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "../services/productDiscovery/ruleEvidenceRegistry";
import { evaluateProductCandidate } from "../services/productDiscovery/evaluateProductCandidate";
import type { ProductSubjectSnapshot } from "../services/productDiscovery/subjectAuthority";
import type { ProductCandidate } from "../../shared/productCandidateContract";
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { groceryCoachGLP1Issue, groceryCoachGLP1IssueMessage } from "../services/groceryCoachGLP1Verification";

jest.mock("../db", () => ({
  db: new Proxy({}, { get: () => () => { throw new Error("Unexpected database access in offline cheese policy fixture"); } }),
}));

const targets = (ceiling = 12) => resolveGLP1MealTargets({
  dailyCalorieTarget: 1800, dailyProteinTarget: 100, dailyFatTarget: 60,
  glp1Guardrails: { fatMaxG: ceiling, proteinMinG: 20 },
}, { mealType: "breakfast" });

const omelette = (name = "reduced-fat cheddar", fat = 9, quantity = "0.5", unit = "oz") => ({
  name: "Cheese and chicken omelette",
  ingredients: [
    { name: "large egg whites", quantity: "3", unit: "each" },
    { name, quantity, unit },
    { name: "chicken breast", quantity: "2", unit: "oz" },
  ],
  instructions: ["Bake gently until set. Serve with the measured cheese."],
  macros: { calories: 250, protein: 30, carbs: 5, fat },
});

function subject(): ProductSubjectSnapshot {
  return {
    actorUserId: "synthetic", subjectId: "synthetic", subjectKind: "account",
    dateISO: "2026-11-24", status: "resolved", issues: [], fingerprint: "fixture",
    dietaryIdentity: [], allergies: [], explicitAvoidances: [], dislikes: [], preferences: [],
    profileFactors: [], medicalHardLimitNames: [], medicalOptimizationNames: [],
    glp1Active: true, alphaGalActive: false, pregnancyActive: false,
    providerInterventionKeys: [], dailyNutritionAvailable: true,
    clinicalDirectiveAuthority: "shadow_only_not_effective_for_food",
  };
}

function foodContext(): HumanFoodContext {
  return {
    version: "human-food-context.v1", actorUserId: "synthetic", subjectUserId: "synthetic",
    creator: "create_a_dish", dateISO: "2026-11-24", resolvedAt: "2026-11-24T12:00:00.000Z",
    status: "resolved", internalFingerprint: "fixture", gaps: [], notices: [],
    diet: { stored: [], effective: [], source: "unavailable", requestOverride: null },
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [],
      glp1MealAuthorityActive: true },
    flavor: Object.fromEntries(
      ["cuisine", "cuisineIntensity", "heat", "seasoningIntensity", "broadFlavor", "flavorStyle"]
        .map(key => [key, { value: null, available: false, source: "unavailable" }]),
    ),
    sweeteners: { preferred: [], avoided: [] }, authorization: { status: "not_required", waivers: [] },
    nutrition: null, behavior: null,
  } as unknown as HumanFoodContext;
}

describe("Measured GLP-1 cheese adaptation (offline evidence, not live clinical approval)", () => {
  it.each(["cheddar", "reduced-fat cheddar", "full-fat mozzarella", "parmesan", "brie", "camembert",
    "Swiss cheese", "queso cheddar reducido en grasa", "queso suizo", "queso parmesano", "requesón"])(
    "retains %s and evaluates whole-meal nutrition rather than the cheese name", name => {
      const meal = omelette(name);
      expect(getGLP1IngredientFilter([name])).toEqual([name]);
      expect(validateGLP1Meal(meal, false, targets()).isValid).toBe(true);
      expect(validateMealForDiet(meal, "general-nutrition", undefined, false, targets()).isValid).toBe(true);
      expect(isGLP1CompositionSensitiveCheese(name)).toBe(true);
    },
  );

  it("does not recognize unrelated substrings as cheese", () => {
    expect(isGLP1CompositionSensitiveCheese("Swiss chard")).toBe(false);
    expect(isGLP1CompositionSensitiveCheese("Swiss chard with feta")).toBe(true);
    expect(isGLP1CompositionSensitiveCheese("briefly steamed greens")).toBe(false);
  });

  it.each(["0", "-1", "NaN", "Infinity", "some", "1/0", "2-20", "2 slices"])(
    "never verifies an unmeasured cheese quantity %s", quantity => {
      const result = validateGLP1Meal(omelette("cheddar", 9, quantity), false, targets());
      expect(result.isValid).toBe(false);
      expect(result.violations.join(" ")).toContain("quantity is not measurable");
    },
  );
  it.each(["slice", "each", "serving", "handful", "unknown"])("does not assume cheese weight for %s", unit => {
    expect(hasMeasuredCheeseQuantity({ quantity: "1", unit })).toBe(false);
  });
  it.each([["½", "oz"], ["1/2", "cup"], ["14", "gramos"], ["0,5", "onzas"]])(
    "accepts explicit %s %s without granting nutrition clearance", (quantity, unit) => {
      expect(hasMeasuredCheeseQuantity({ quantity, unit })).toBe(true);
      expect(validateGLP1Meal(omelette("queso cheddar", 20, quantity, unit), false, targets()).isValid).toBe(false);
    },
  );

  it("does not make three ounces a universal approved portion or waive a tighter provider ceiling", () => {
    expect(validateGLP1Meal(omelette("low-fat cheddar", 24, "3"), false, targets()).isValid).toBe(false);
    expect(validateGLP1Meal(omelette("full-fat cheddar", 9), false, targets(8)).isValid).toBe(false);
    expect(validateGLP1Meal({ ...omelette(), macros: { ...omelette().macros, protein: 10 } }, false, targets()).isValid).toBe(false);
    expect(validateGLP1Meal({ ...omelette(), macros: undefined }, false, targets()).isValid).toBe(false);
  });

  it("uses recipe totals divided by actual servings exactly once", () => {
    const total = { calories: 500, protein: 60, fat: 18, carbs: 10 };
    const macros = toPerServingNutrition(total, 2);
    expect(macros).toMatchObject({ calories: 250, protein: 30, fat: 9 });
    const meal = { ...omelette("cheddar", 9, "1"), macros };
    const original = JSON.stringify(meal.ingredients);
    expect(validateGLP1Meal(meal, false, targets()).isValid).toBe(true);
    expect(validateGLP1Meal({ ...meal, macros: total }, false, targets()).isValid).toBe(false);
    expect(JSON.stringify(meal.ingredients)).toBe(original);
  });

  it("does not weaken independent allergies, diets, clinician requirements or preparation blocks", () => {
    const meal = omelette();
    const context = foodContext();
    context.safety.allergies = ["milk"];
    const candidate = { name: meal.name, ingredients: [...meal.ingredients, { name: "milk" }],
      nutrition: meal.macros, evidence: { glp1Compliant: true } };
    expect(validateHumanFoodCandidate(candidate, context).outcome).toBe("blocked");
    expect(validateMealForDiet(meal, "vegan", undefined, false, targets()).isValid).toBe(false);
    context.safety.allergies = [];
    context.safety.healthConditions = ["clinician-directed restriction"];
    expect(validateHumanFoodCandidate({ ...candidate,
      evidence: { glp1Compliant: true, clinicalDirectivesCompliant: false } }, context).outcome).toBe("blocked");
    expect(validateGLP1Meal({ ...meal, instructions: ["Deep fry it."] }, false, targets()).isValid).toBe(false);
    expect(validateGLP1Meal(omelette("blue cheese dressing"), false, targets()).isValid).toBe(false);
  });

  it("gives Builder, stacking, Grocery Coach and both Scan prompts the same portion contract", () => {
    const prompt = buildGLP1Prompt({ mealType: "breakfast", selectedIngredients: ["reduced-fat cheddar"] }, targets());
    expect(prompt).not.toContain("NOT GLP-1 safe");
    expect(prompt).toContain("GLP-1 CHEESE — PORTION AND COMPOSITION");
    expect(buildGLP1ConstraintOverlay("breakfast", targets())).toContain("GLP-1 CHEESE — PORTION AND COMPOSITION");
    const recommendations = readFileSync("server/services/glp1/resolveGLP1GlobalContext.ts", "utf8");
    expect(recommendations).toContain("GLP1_CHEESE_PRODUCT_GUIDANCE,");
    expect(recommendations).not.toContain("buttery preparations, and high-fat cheeses");
    const scan = readFileSync("server/services/ingredientScanService.ts", "utf8");
    expect(scan.match(/\$\{GLP1_CHEESE_PRODUCT_GUIDANCE\}/g)).toHaveLength(2);
    expect(GLP1_CHEESE_PRODUCT_GUIDANCE).toContain("never assume slice weight or cheese volume density");
    expect(GLP1_CHEESE_PRODUCT_GUIDANCE).toContain("missing");
  });
});

describe("Product evidence and shopping continuity", () => {
  it("provides a portion-aware tip without inventing a portion or rewriting the original request", () => {
    const input = { originalName: "reduced-fat cheddar", requirements: [] };
    const original = JSON.stringify(input);
    expect(shoppingCatalogTip(input, subject())).toContain("Keep the recipe's cheese type and measured amount");
    expect(shoppingCatalogTip(input, subject())).toContain("Missing amounts or label facts remain unverified");
    expect(JSON.stringify(input)).toBe(original);
    expect(shoppingCatalogTip(input, { ...subject(), glp1Active: false })).not.toContain("whole meal");
  });

  it("does not turn unknown GLP-1 product authority into compatible low-fat cheese", () => {
    const { context, unresolved } = resolveProductRulePolicy(subject(), DEVELOPMENT_CATALOG_IDENTITY_POLICY, "2026-11-24T12:00:00Z");
    expect(unresolved).toContainEqual(expect.objectContaining({ id: "clinical:glp1" }));
    expect(context.policyStatus).toBe("unresolved");
    const candidate = {
      identity: { key: "fixture", name: "Low-fat cheddar", brand: "Fixture", variant: "cheddar",
        match: "exact_variant", provenance: { source: "manufacturer", sourceRecordId: "fixture",
          identityKey: "fixture", exactVariantMatch: true, observedAt: context.evaluatedAt } },
      facts: [],
    } as ProductCandidate;
    expect(evaluateProductCandidate(candidate, context, []).status).toBe("needs_verification");
    expect(shoppingCatalogPresentation(candidate, { status: "rejected" } as any,
      { eligible: false }, { originalName: "cheddar", requirements: [] }).shoppingDisplay).toBe("hidden");
  });
});

describe("Grocery Coach's final GLP-1 invariant", () => {
  const recipe = () => ({
    meal: { servings: 2 }, macros: { calories: 500, fat: 18, protein: 60 },
    shoppingList: [{ item: "cheddar", quantity: "1", unit: "oz" }], ownedIngredients: [],
  });
  it("checks complete-recipe totals per serving without modifying purchased or owned quantities", () => {
    const result = recipe();
    const before = JSON.stringify(result);
    expect(groceryCoachGLP1Issue(result, targets())).toBeNull();
    expect(JSON.stringify(result)).toBe(before);
    expect(groceryCoachGLP1Issue({ ...result, meal: { servings: 1 } }, targets())).toBe("fat_allowance");
  });
  it("requires measured cheese already owned as well as cheese on the shopping list", () => {
    expect(groceryCoachGLP1Issue({ ...recipe(), shoppingList: [],
      ownedIngredients: [{ item: "queso cheddar", quantity: "1", unit: "slice" }] }, targets())).toBe("ingredient_measurement");
    expect(groceryCoachGLP1Issue({ ...recipe(), shoppingList: [],
      ownedIngredients: [{ item: "queso cheddar", quantity: "1", unit: "onzas" }] }, targets())).toBeNull();
  });
  it("cannot approve NaN nutrition, invalid serving counts, or unmeasured cheese after a retry", () => {
    expect(groceryCoachGLP1Issue({ ...recipe(), macros: { calories: 500, fat: NaN, protein: 60 } }, targets())).toBe("nutrition_evidence");
    expect(groceryCoachGLP1Issue({ ...recipe(), meal: { servings: 0 } }, targets())).toBe("nutrition_evidence");
    expect(groceryCoachGLP1Issue({ ...recipe(), shoppingList: [{ item: "cheddar", quantity: "", unit: "" }] }, targets())).toBe("ingredient_measurement");
    expect(groceryCoachGLP1Issue(recipe(), null)).toBeNull();
    expect(groceryCoachGLP1IssueMessage("ingredient_measurement", "es-MX")).toContain("cantidad de queso");
  });
});

describe("Bounded egg measurement repair", () => {
  it.each([
    ["large egg whites", "3", "each"], ["claras de huevo grandes", "3", "unidades"],
    ["liquid egg whites", "100", "g"], ["egg whites", "1/2", "cup"],
    ["claras de huevo líquidas", "100", "gramos"], ["large eggs", "2", "each"],
  ])("accepts %s measured as %s %s", (name, quantity, unit) => {
    const ingredient = { name, quantity, unit };
    expect(validateIngredientPrecision([ingredient]).isValid).toBe(true);
    expect(checkIngredientSanity([{ ingredients: [ingredient] }])).toBe(true);
  });
  it.each(["egg whites", "eggs", "claras de huevo"])("still requires a size for counted %s", name => {
    expect(validateIngredientPrecision([{ name, quantity: "2", unit: "each" }]).isValid).toBe(false);
  });
  it("does not count powders, replacers, noodles, or non-eggs as fresh eggs", () => {
    for (const name of ["egg replacer", "egg white powder", "egg noodles", "chicken breast"]) {
      expect(validateIngredientPrecision([{ name, quantity: "2", unit: "each" }]).isValid).toBe(false);
    }
    for (const quantity of ["2000", "NaN", "2 dozen", "1/0"]) {
      expect(checkIngredientSanity([{ ingredients: [{ name: "egg whites", quantity, unit: "g" }] }])).toBe(false);
    }
  });
  it("uses count-aware whole eggs and fractional liquid whites only as a plausibility estimate", () => {
    expect(estimateCaloriesFromIngredients([{ name: "large eggs", quantity: "2", unit: "each" }])).toBeCloseTo(155);
    const en = estimateCaloriesFromIngredients([{ name: "liquid egg whites", quantity: "1/2", unit: "cup" }]);
    const es = estimateCaloriesFromIngredients([{ name: "claras de huevo líquidas", quantity: "1/2", unit: "taza" }]);
    expect(en).toBeCloseTo(62.4);
    expect(es).toBeCloseTo(en);
  });
});
