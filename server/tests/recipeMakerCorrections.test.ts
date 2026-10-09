import { formatCreatorNutrition } from "../services/humanFoodContext/formatCreatorNutrition";
import { toPerServingNutrition } from "../services/humanFoodContext/servingNutrition";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { resolveRecipeMakerIntent, recipeMakerFailure } from "../services/recipeMakerIntent";
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { readFileSync } from "fs";
import { join } from "path";
import { validateMealForDiet } from "../services/guardrails";
import { resolveGLP1MealTargets } from "../services/glp1/resolveGLP1MealTargets";

const context = {
  version: "human-food-context.v1", status: "resolved", notices: [],
  actorUserId: "fixture", subjectUserId: "fixture", internalFingerprint: "fixture",
  diet: { stored: [], effective: [], source: "unavailable", requestOverride: null },
  safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
  flavor: Object.fromEntries(
    ["cuisine", "cuisineIntensity", "heat", "seasoningIntensity", "broadFlavor", "flavorStyle"]
      .map(key => [key, { value: null, available: false, source: "unavailable" }]),
  ),
  sweeteners: { preferred: [], avoided: [] },
  authorization: { status: "not_required", waivers: [] },
  nutrition: {
    remaining: { calories: 800, carbs: 80, fat: 30 },
    activeConstraints: { consumedStarchExhausted: false },
    starch: { consumed: { remainingGrams: 50 } },
  },
  behavior: null, gaps: [],
} as unknown as HumanFoodContext;
const recipe = {
  name: "Oat breakfast", category: "breakfast",
  ingredients: [{ name: "oats", quantity: "30", unit: "g" }],
  instructions: ["Cook the oats in water."],
  calories: 200, protein: 12, carbs: 25, fat: 4,
  starchyCarbs: 20, fibrousCarbs: 5,
  evidence: {
    sourceType: "generated_recipe" as const,
    ingredientEvidence: "structured_generation" as const,
    preparationEvidence: "structured_generation" as const,
    nutritionEvidence: "structured_generation" as const,
  },
};

describe("Recipe Maker nutrition formatting", () => {
  it.each([1, 2, 6])("preserves starch and serving meaning for %i servings", servings => {
    const formatted = { ...recipe, nutrition: formatCreatorNutrition(recipe, servings) };
    expect(formatted.nutrition.starchyCarbs).toBe(20 * servings);
    expect(formatted.nutrition.fibrousCarbs).toBe(5 * servings);
    const perServing = toPerServingNutrition(formatted, servings);
    expect(perServing).toEqual({
      calories: 200, protein: 12, carbs: 25, fat: 4, starchyCarbs: 20,
    });
    expect(validateHumanFoodCandidate(
      { ...formatted, nutrition: perServing }, context,
    ).outcome).toBe("pass");
  });

  it("does not fabricate missing starch evidence", () => {
    const missing = { ...recipe, starchyCarbs: undefined };
    const candidate = {
      ...missing, nutrition: toPerServingNutrition({ nutrition: formatCreatorNutrition(missing, 2) }, 2),
    };
    const validation = validateHumanFoodCandidate(candidate, context);
    expect(validation.outcome).toBe("review_required");
    expect(validation.findings.map(f => f.code)).toContain("starch_evidence_missing");
  });

  it("preserves the same nested-nutrition precedence as initial validation", () => {
    expect(formatCreatorNutrition({
      ...recipe, nutrition: { calories: 150, starchyCarbs: 10 },
    }, 2)).toMatchObject({ calories: 300, starchyCarbs: 20, protein: 24 });
  });

  it.each(["", false, NaN, Infinity, "unverified"])(
    "never turns invalid starch evidence %p into zero", value => {
      expect(formatCreatorNutrition({ ...recipe, starchyCarbs: value }, 2).starchyCarbs)
        .toBeUndefined();
    },
  );

  it("still rejects an exhausted starch allowance and allergies", () => {
    const blocked = validateHumanFoodCandidate(recipe as any, {
      ...context, safety: { ...context.safety, allergies: ["oats"] },
      nutrition: {
        ...context.nutrition!,
        activeConstraints: { ...context.nutrition!.activeConstraints, consumedStarchExhausted: true },
        starch: { consumed: { remainingGrams: 0 } },
      },
    } as unknown as HumanFoodContext);
    expect(blocked.outcome).toBe("blocked");
  });
});

describe("Recipe Maker culinary occasion", () => {
  function client(category: string, dishName = "Mille-feuille (Napoleon)", confidence = "high") {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ dishName, foodCategory: category, confidence }) } }],
    });
    return { create, openai: { chat: { completions: { create } } } as any };
  }

  it.each(["Mille-feuille", "Napoleon", "Chocolate cake"])(
    "uses a dessert/snack occasion, not dinner, for %s", async name => {
      const mock = client("dessert", name);
      const intent = await resolveRecipeMakerIntent(mock.openai, name);
      expect(intent).toMatchObject({ dishName: name, foodCategory: "dessert", targetMealType: "snack", generationMode: "recipe" });
      expect(mock.create.mock.calls[0][0].response_format.type).toBe("json_schema");
    },
  );

  it.each(["breakfast", "lunch", "dinner", "snack"])("retains the %s occasion", async category => {
    const mock = client(category, "Requested food");
    expect((await resolveRecipeMakerIntent(mock.openai, "Requested food")).targetMealType).toBe(category);
  });

  it("fails safely on uncertain categories or model failures", async () => {
    const uncertain = client("unknown", "Unclear food", "low");
    await expect(resolveRecipeMakerIntent(uncertain.openai, "Unclear input"))
      .rejects.toMatchObject({ status: 400, code: "recipe_category_unresolved" });
    uncertain.create.mockRejectedValue(new Error("provider unavailable"));
    await expect(resolveRecipeMakerIntent(uncertain.openai, "Unclear input"))
      .rejects.toMatchObject({ status: 503, code: "recipe_category_unavailable" });
  });
});

describe("Recipe Maker bounded recovery and errors", () => {
  it("keeps compliant desserts within GLP-1 limits without bypassing pastry restrictions", () => {
    const targets = resolveGLP1MealTargets({
      dailyCalorieTarget: 1800, dailyProteinTarget: 100,
      dailyFatTarget: 60, dailyCarbsTarget: 180, isActive: true,
    }, { mealType: "snack" });
    const dessert = {
      name: "Mini Berry Yogurt Dessert",
      ingredients: [
        { name: "nonfat Greek yogurt" },
        { name: "berries" },
      ],
      macros: {
        calories: targets.resolvedSnackCalories * 0.8,
        protein: targets.targetProteinGrams + 2,
        fat: targets.maximumToleratedFatGrams * 0.25,
        carbs: 18,
      },
    };
    expect(validateMealForDiet(dessert as any, "glp1", undefined, true, targets).violations).toEqual([]);
    const highFat = {
      ...dessert,
      macros: { ...dessert.macros, fat: targets.maximumToleratedFatGrams + 10 },
    };
    expect(validateMealForDiet(highFat as any, "glp1", undefined, true, targets).isValid).toBe(false);
    const pastry = {
      ...dessert,
      name: "Mini Mille-feuille",
      ingredients: [...dessert.ingredients, { name: "thin phyllo pastry" }],
    };
    const pastryResult = validateMealForDiet(pastry as any, "glp1", undefined, true, targets);
    expect(pastryResult.isValid).toBe(false);
    expect(pastryResult.violations.join(" ")).toMatch(/pastry/i);
  });

  it("explains the actual failed GLP-1 requirement without quoting the image", () => {
    const result = recipeMakerFailure({
      reasonCode: "glp1_compliance_retry_exhausted",
      violations: ["Fat exceeds the tolerated fat ceiling"],
      message: "Here's a meal idea based on the image: " + "pastry ".repeat(200),
      retryable: true,
    }, 422);
    expect(result.error).toContain("fat limit");
    expect(result.error).not.toContain("Here's a meal idea");
    expect(result.error.length).toBeLessThan(200);
    expect(result.retryable).toBe(true);
  });

  it("preserves missing-evidence reason codes without bypassing validation", () => {
    const result = recipeMakerFailure({
      code: "HUMAN_FOOD_FINAL_REVIEW_REQUIRED",
      findings: [{ code: "starch_evidence_missing" }],
    }, 409);
    expect(result.error).toContain("verified starch information");
    expect(result.reasonCodes).toEqual(["starch_evidence_missing"]);
  });

  it("names an actual blocked ingredient rule without exposing the image description", () => {
    const result = recipeMakerFailure({
      reasonCode: "glp1_compliance_retry_exhausted",
      violations: ['Blocked GLP-1 ingredient: "thin phyllo pastry" (matches "pastry")'],
    }, 422);
    expect(result.error).toContain('"pastry"');
    expect(result.error).toContain("ingredient rules");
  });

  it("keeps generation exhaustion generic when no actual violation is known", () => {
    const result = recipeMakerFailure({
      reasonCode: "constraint_conflict", message: "A very long private image description",
    }, 422);
    expect(result.error).toContain("today's food requirements");
    expect(result.error).not.toContain("GLP-1");
  });

  it("retains the bounded, identity-preserving GLP-1 retry and safe validation", () => {
    const source = readFileSync(join(__dirname, "../services/unifiedMealPipeline.ts"), "utf8");
    const block = source.slice(source.indexOf("// ── GLP-1 post-generation validation — fail closed", source.indexOf("export async function generateCravingMealOptions")));
    expect(block).toContain("await attempt(true, transformHint)");
    expect(block).toContain("keeping it recognizable");
    expect(block).toContain("throw new GLP1ComplianceRetryExhaustedError");
    expect(block).toContain('"glp1", undefined, isSnackRetry, glp1Targets!');
    expect(source).toContain('validMealType === "snack" ? t.resolvedSnackCalories : t.resolvedMealCalories');
    expect(source).not.toContain('"Apple Pie" → "Spiced Apple Protein Bowl"');
  });
});
