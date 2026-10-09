import { FOOD_EXECUTION_CONTEXT, type HumanFoodContext, type HumanFoodCreator } from "../../shared/humanFoodContext";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import { buildChefMacroGoalNotice } from "../services/humanFoodContext/chefCandidateValidation";
import { resolveGLP1MealTargets } from "../services/glp1/resolveGLP1MealTargets";
import { validateGLP1Meal } from "../services/guardrails/validators/glp1Validator";
import { buildGuestEnvelope, enforceBeforeGenerate } from "../services/protocolEnvelope";

const preference = { value: null, source: "unavailable", available: false };
function context(creator: HumanFoodCreator = "recipe_maker"): HumanFoodContext {
  return {
    version: "human-food-context.v1", status: "resolved", creator,
    executionContext: FOOD_EXECUTION_CONTEXT[creator],
    actorUserId: "actor", subjectUserId: "subject", generationChainId: "chain",
    correlationId: "test", resolvedAt: "2026-10-09T00:00:00Z",
    expiresAt: "2026-10-09T00:15:00Z", internalFingerprint: "test",
    diet: { stored: [], effective: [], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
    flavor: Object.fromEntries(["heat", "seasoningIntensity", "broadFlavor", "flavorStyle", "cuisine", "cuisineIntensity", "spiceComplexity"].map(key => [key, preference])),
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    authorization: { status: "none", action: null, reservationId: null, waivers: [] },
    nutrition: {
      date: "2026-10-09",
      prescription: { source: "user_default", caloriesTarget: 500, proteinTarget: 50, carbsTarget: 50, fatTarget: 10, starchyCarbsTarget: 50, fibrousCarbsTarget: 10 },
      consumed: { calories: 500, protein: 50, carbs: 50, fat: 10, starchyCarbs: 50, fibrousCarbs: 10 },
      planned: { calories: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0 },
      projectedRemaining: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      activeConstraints: { consumedStarchExhausted: true, projectedStarchConflict: true, generationContext: "standard" },
      starch: { consumed: { remainingGrams: 0, mealsRemaining: 0, exhausted: true } },
    },
    behavior: null, diabetesFoodPreferences: null, gaps: [], notices: [], blockedReasons: [],
  } as unknown as HumanFoodContext;
}
function recipe(name = "Napoleon pastry", ingredients = ["puff pastry", "vanilla custard"]) {
  return {
    name, ingredients,
    nutrition: { calories: 600, protein: 25, carbs: 80, fat: 20, starchyCarbs: 60, fibrousCarbs: 10 },
    evidence: { sourceType: "generated_recipe" as const, ingredientEvidence: "structured_generation" as const, nutritionEvidence: "structured_generation" as const, preparationEvidence: "structured_generation" as const, dishIdentityPreserved: true },
  };
}

describe("daily macro goals never grant permission to generate food", () => {
  it.each([false, true])("keeps carb-cycle allocation nonblocking on refeed=%s", isRefeedDay => {
    const envelope = buildGuestEnvelope();
    envelope.carbCycleContext = { carbBudgetG: isRefeedDay ? 100 : 0, isRefeedDay } as NonNullable<typeof envelope.carbCycleContext>;
    const prompt = enforceBeforeGenerate(envelope).layers.performanceIntent;
    expect(prompt).toContain("not a recipe ceiling or floor");
    expect(prompt).not.toContain("HARD CONSTRAINT");
    expect(prompt).not.toContain("at or below");
  });
  it.each(Object.keys(FOOD_EXECUTION_CONTEXT) as HumanFoodCreator[])("%s permits daily overages with honest nutrition", creator => {
    const ctx = context(creator);
    const meal = recipe();
    const original = JSON.stringify({ ctx, meal });
    expect(validateHumanFoodResult(meal, ctx)).toEqual({ valid: true, violations: [] });
    expect(validateHumanFoodCandidate(meal, ctx).outcome).toBe("pass");
    expect(JSON.stringify({ ctx, meal })).toBe(original);
    expect(buildHumanFoodPromptBlock(ctx)).not.toMatch(/STRICT starchy|Do not exceed.*starchy|avoid adding another starchy/);
  });
  it.each(["lasagna", "cheesecake", "Napoleon pastry", "high-carbohydrate shake"])("preserves %s above daily targets", name => {
    const meal = recipe(name);
    expect(validateHumanFoodResult(meal, context()).valid).toBe(true);
    expect(meal.name).toBe(name);
    expect(meal.nutrition.starchyCarbs).toBe(60);
  });
  it("shows a 10g projected starch overage against a 50g target without changing the original or consumption", () => {
    const ctx = context("weekly_meal_plan");
    ctx.nutrition!.consumed.starchyCarbs = 0;
    const before = JSON.stringify(ctx);
    const notice = buildChefMacroGoalNotice(recipe(), ctx);
    expect(notice?.projections).toContainEqual(expect.objectContaining({ macro: "starchyCarbs", target: 50, projected: 60, overage: 10 }));
    expect(notice?.message).toContain("Keep the original meal");
    expect(JSON.stringify(ctx)).toBe(before);
  });
  it.each([null, undefined, "", "  ", false, -1, NaN, Infinity])("never fabricates calorie zero from %s", calories => {
    const meal = { ...recipe(), nutrition: { ...recipe().nutrition, calories } };
    expect(validateHumanFoodResult(meal, context()).violations).toContain("verified_calories_missing");
  });
  it("checks nutrition even when standalone has no daily context", () => {
    const ctx = context();
    ctx.nutrition = null;
    expect(validateHumanFoodCandidate({ ...recipe(), nutrition: undefined }, ctx).outcome).toBe("review_required");
    expect(validateHumanFoodResult(recipe(), ctx).valid).toBe(true);
  });
  it("still blocks shellfish and allows a recognizable shellfish-free seafood salad", () => {
    const ctx = context();
    ctx.safety.allergies = ["shellfish"];
    expect(validateHumanFoodCandidate(recipe("seafood salad", ["shrimp", "lettuce"]), ctx).outcome).toBe("blocked");
    expect(validateHumanFoodCandidate(recipe("seafood salad", ["cod", "lettuce"]), ctx).outcome).toBe("pass");
  });
  it("retains an independently failed clinical directive proof", () => {
    const meal = recipe();
    const ctx = context();
    ctx.safety.healthConditions = ["clinician-directed restriction"];
    expect(validateHumanFoodCandidate({ ...meal, evidence: { ...meal.evidence, clinicalDirectivesCompliant: false } }, ctx).outcome).toBe("blocked");
  });
  it.each(["vegan", "keto"])("retains explicit %s ingredient/evidence requirements", diet => {
    const ctx = context();
    ctx.diet.effective = [diet];
    const outcome = validateHumanFoodCandidate(recipe("cheesecake", ["cream cheese", "egg", "sugar"]), ctx);
    expect(outcome.outcome).not.toBe("pass");
    expect(outcome.findings.some(finding => finding.dimension === "dietary_identity")).toBe(true);
  });
});

describe("daily-derived targets cannot masquerade as GLP-1 restrictions", () => {
  it("does not tighten independent fat tolerability because daily fat is exhausted", () => {
    const user = { dailyCalorieTarget: 1600, dailyProteinTarget: 100, dailyFatTarget: 50, glp1Guardrails: { fatMaxG: 15, proteinMinG: 25 } };
    const full = resolveGLP1MealTargets(user, { mealType: "lunch", remainingMacros: { fat: 50 } });
    const exhausted = resolveGLP1MealTargets(user, { mealType: "lunch", remainingMacros: { fat: 1 } });
    expect(full.maximumToleratedFatGrams).toBe(15);
    expect(exhausted.maximumToleratedFatGrams).toBe(15);
    const valid = validateGLP1Meal({
      name: "Poached cod salad", ingredients: [{ name: "cod" }, { name: "lettuce" }], instructions: "Poach cod and serve with lettuce.",
      macros: { calories: 1500, protein: 40, fat: 10, carbs: 40 },
    }, false, exhausted);
    expect(valid.violations.some(violation => /Calories/.test(violation))).toBe(false);
    const unsafe = validateGLP1Meal({
      name: "Poached cod salad", ingredients: [{ name: "cod" }, { name: "lettuce" }], instructions: "Poach cod.",
      macros: { calories: 400, protein: 40, fat: 30, carbs: 10 },
    }, false, exhausted);
    expect(unsafe.isValid).toBe(false);
  });
});
