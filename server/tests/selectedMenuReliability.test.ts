import type { OneTouchDirection } from "@shared/oneTouch";
import type { HumanFoodContext } from "@shared/humanFoodContext";
import type { SelectedConceptHandoff } from "../services/oneTouch/selectedConceptHandoff";

// No database, paid generation or image transport is available to these tests.
jest.mock("../db", () => ({
  db: new Proxy({}, { get() { throw new Error("Unexpected database access in synthetic Menu test"); } }),
}));
jest.mock("../services/unifiedMealPipeline", () => ({ generateCravingMealOptions: jest.fn() }));
jest.mock("../services/myPerfectMenu/culinaryConceptEngine", () => ({
  generateCulinaryConcepts: jest.fn(() => { throw new Error("Unexpected concept generation"); }),
}));
jest.mock("../services/dishAdaptation/dishAdaptationLayer", () => ({
  buildGuardrailContext: jest.fn(() => ({})),
  getDishAdaptationDirective: jest.fn(async () => null),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(async () => "/synthetic-meal.jpg"),
  normalizeMealTypeToSourceType: jest.fn(() => "meal"),
}));
jest.mock("../services/safetyProfileService", () => {
  const actual = jest.requireActual("../services/safetyProfileService");
  return { ...actual, enforceSafetyProfile: jest.fn(async (_id, intent) =>
    actual.enforceSafetyProfileSync({
      userId: "synthetic", allergies: [], dietaryRestrictions: [],
      healthConditions: [], avoidIngredients: [],
    }, intent)) };
});

import { generateCravingMealOptions } from "../services/unifiedMealPipeline";
import { completeSelectedConcept } from "../services/oneTouch/selectedConceptHandoff";
import { getDishAdaptationDirective } from "../services/dishAdaptation/dishAdaptationLayer";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import * as protocol from "../services/protocolEnvelope";
import * as finalValidation from "../services/humanFoodContext/finalValidation";
import * as humanFood from "../services/humanFoodContext/validateHumanFoodResult";
import * as dietGuards from "../services/guardrails";
import * as diabetesGuards from "../services/guardrails/validators/diabeticValidator";

const names = [
  "Beef sirloin", "broccoli", "bell peppers", "snow peas",
  "Szechuan peppercorns", "soy sauce", "garlic", "ginger",
];
function idea(): OneTouchDirection {
  return {
    title: "Szechuan Beef", description: "Stir-fried beef and crisp vegetables.",
    primaryIngredients: [...names], primaryProtein: "beef",
    produceItems: ["broccoli", "bell peppers", "snow peas"],
    cuisine: "Chinese", preparationMethod: "Stir-fried", signature: "szechuan-beef-stir-fry",
    dietaryEvidence: [], occasion: "lunch",
    culinaryIdentity: {
      dishForm: "stir-fry", preparationStyle: "stir-fried", temperature: "hot",
      primaryProteinBase: "beef", majorStarchBase: null, flavorFamily: "savory",
      cuisineEvidence: "Chinese", definingComponents: ["beef", "peppercorns"],
    },
  };
}
function request(creator: SelectedConceptHandoff["creator"] = "create_a_dish"): SelectedConceptHandoff {
  const preference = { value: null, source: "unavailable", available: false };
  const concept = idea();
  if (creator === "craving_creator") concept.occasion = "snack";
  return {
    actorUserId: "synthetic", creator, concept, servings: 1, cuisine: "Chinese",
    context: {
      version: "test", status: "resolved", creator, actorUserId: "synthetic", subjectUserId: "synthetic",
      diet: { stored: [], effective: [], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
      flavor: {
        heat: preference, seasoningIntensity: preference, broadFlavor: preference,
        flavorStyle: preference, cuisine: { value: "Chinese", source: "request", available: true },
        cuisineIntensity: preference, spiceComplexity: preference,
      },
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
      authorization: { status: "none", action: null, reservationId: null, waivers: [] },
      nutrition: null, behavior: null, diabetesFoodPreferences: null,
      gaps: [], notices: [], blockedReasons: [],
    } as unknown as HumanFoodContext,
    envelope: {
      userId: "synthetic", dietaryIdentity: [], allergies: [], medicalHardLimits: [],
      medicalOptimization: [], avoidances: [], preferences: [], hasDiabetes: false,
      procedural: protocol.deriveProcedureRules([]),
      conditionGuidanceBlocks: [], diabeticGuidance: null, diabeticGlucoseState: null,
      preferredLanguage: null, glp1DailyTolerance: null,
      preparationRules: [], storageRules: [], equipmentRules: [],
      instructionConstraints: [], crossContaminationRules: [],
      performanceOverlay: "standard", performanceControlMode: "self_guided",
      cuisinePreference: "Chinese", cuisineIntensity: null,
    } as SelectedConceptHandoff["envelope"],
    glp1: {
      isActive: false, activationSources: [], performanceActive: false,
      resolvedTargets: null, dailyNutritionState: null, compositionNote: "",
    },
    overriddenDietaryIdentities: [],
  };
}
function recipe(ingredients = names, name = "Szechuan Beef",
  description = "Tender beef stir-fried with chili-garlic sauce and crisp vegetables.") {
  return {
    name, description, ingredients: ingredients.map(name => ({ name, quantity: "1", unit: "oz" })),
    instructions: ["Slice the beef and vegetables.", "Stir-fry with the seasonings."],
    calories: 400, protein: 35, carbs: 15, fat: 20, starchyCarbs: 0, fibrousCarbs: 15,
    evidence: { cuisine: "Chinese" },
    imageUrl: "",
  };
}
const generation = jest.mocked(generateCravingMealOptions);
const replace = (index: number, value: string) => names.map((name, i) => index === i ? value : name);

describe("selected Menu reliability with real identity and final safety validators", () => {
  let warning: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    generation.mockResolvedValue([recipe()]);
    jest.mocked(getDishAdaptationDirective).mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["create_a_dish", "craving_creator"] as const)(
    "%s accepts the corrected recipe through real post-generation safety and serving checks", async creator => {
      const scan = jest.spyOn(protocol, "scanGeneratedOutput");
      const food = jest.spyOn(humanFood, "validateHumanFoodResult");
      const final = jest.spyOn(finalValidation, "validateHumanFoodCandidate");
      const input = request(creator);
      input.servings = 3;
      const result = await completeSelectedConcept(input);
      expect(result).toMatchObject({ ok: true, meal: {
        calories: 1200, protein: 105, carbs: 45, fat: 60, servingSize: "3 servings",
      } });
      if (result.ok) expect((result.meal.ingredients as any[]).every(i => i.quantity === "3")).toBe(true);
      expect(scan.mock.results.some(r => r.value?.passed)).toBe(true);
      expect(food.mock.results.every(r => r.value?.valid)).toBe(true);
      expect(final.mock.results.length).toBeGreaterThan(0);
      expect(final.mock.results.every(r => r.value?.outcome === "pass")).toBe(true);
      expect(generation).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { ingredients: names },
    { ingredients: ["thinly sliced beef top sirloin", "chopped broccoli", "red bell pepper", "snow pea",
      "crushed Sichuan peppercorns", "gluten-free soy sauce", "minced garlic", "grated ginger"] },
  ])("accepts exact and reviewed equivalent names: $ingredients", async ({ ingredients }) => {
    generation.mockResolvedValue([recipe(ingredients)]);
    expect(await completeSelectedConcept(request())).toMatchObject({ ok: true });
  });

  it("preserves the Low Carb authority and request choices", async () => {
    const input = request();
    input.context.diet.stored = input.context.diet.effective = ["low carb"];
    input.envelope.dietaryIdentity = ["low carb"];
    expect(await completeSelectedConcept(input)).toMatchObject({ ok: true });
    expect(generation.mock.calls[0][3]).toEqual(["low carb"]);
  });

  it("accepts the Sichuan title spelling without changing the selected dish", async () => {
    generation.mockResolvedValue([recipe(replace(4, "Sichuan peppercorns"), "Sichuan Beef")]);
    expect(await completeSelectedConcept(request())).toMatchObject({ ok: true });
  });

  it("accepts three correctly named equivalents without spending a corrective generation", async () => {
    generation.mockResolvedValue(Array.from({ length: 3 }, () => recipe(replace(4, "Sichuan peppercorns"))));
    expect(await completeSelectedConcept(request())).toMatchObject({ ok: true });
    expect(generation).toHaveBeenCalledTimes(1);
  });

  it("preserves a matching candidate while rejecting only the invalid siblings", async () => {
    generation.mockResolvedValue([
      recipe(replace(0, "beef flank steak")),
      recipe(replace(4, "Sichuan peppercorns")),
      recipe(names.filter((_, i) => i !== 3)),
    ]);
    const result = await completeSelectedConcept(request());
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect((result.meal.ingredients as any[]).map(i => i.name)).toEqual(replace(4, "Sichuan peppercorns"));
    expect(generation).toHaveBeenCalledTimes(1);
  });

  it.each(["create_a_dish", "craving_creator"] as const)(
    "%s keeps the same fixed commitment on initial and corrective generations", async creator => {
      generation.mockResolvedValueOnce([recipe(names.filter((_, i) => i !== 3))])
        .mockResolvedValueOnce([recipe()]);
      expect(await completeSelectedConcept(request(creator))).toMatchObject({ ok: true });
      expect(generation).toHaveBeenCalledTimes(2);
      for (const [prompt] of generation.mock.calls) {
        expect(prompt).toContain("[CREATE A DISH — HARD CULINARY INTENT]");
        expect(prompt).toContain(names.join(", "));
        expect(prompt).toContain("prepared using Stir-fried");
        expect(prompt).toContain("Do not omit or silently substitute");
        expect(prompt).toContain("All allergy, avoidance, dietary and clinical protections take precedence");
      }
      expect(generation.mock.calls[1][0]).toContain("SELECTED DISH IDENTITY REPAIR");
    },
  );

  it.each([
    [replace(0, "beef flank steak"), [0]],
    [replace(0, "beef sirloin tip"), [0]],
    [replace(4, "black peppercorns"), [4]],
    [replace(5, "tamari"), [5]],
    [replace(5, "soy-free sauce"), [5]],
    [names.filter((_, i) => i !== 3), [3]],
  ] as const)("still rejects actual omissions or unapproved substitutions: %j", async (ingredients, missing) => {
    generation.mockResolvedValue([recipe([...ingredients])]);
    expect(await completeSelectedConcept(request())).toEqual({ ok: false, code: "identity_mismatch" });
    expect(generation).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      reason: "ingredient_evidence_failure", missingIngredientPositions: missing,
    }));
  });

  it.each(["Soup", "Stew", "Wrap", "Bowl"])(
    "rejects a genuine %s transformation even when DAL is unavailable", async form => {
      generation.mockResolvedValue([recipe(names, `Szechuan Beef ${form}`, `A ${form.toLowerCase()} of beef.`)]);
      expect(await completeSelectedConcept(request())).toEqual({ ok: false, code: "identity_mismatch" });
      expect(warning).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason: "dish_form_failure" }));
    },
  );

  it("retains dish adaptation protections while using the selected concept's form", async () => {
    jest.mocked(getDishAdaptationDirective).mockResolvedValue({
      identityAnchor: "Beef", definingComponents: ["beef"], adaptableComponents: [],
      conflicts: [], adaptationBlock: "Preserve all safety protections.", dishForm: "stew",
    });
    expect(await completeSelectedConcept(request())).toMatchObject({ ok: true });
  });

  it("reports combined failures separately", async () => {
    generation.mockResolvedValue([recipe(names.slice(1), "Szechuan Beef Soup", "A soup of beef.")]);
    expect(await completeSelectedConcept(request())).toEqual({ ok: false, code: "identity_mismatch" });
    expect(warning).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      reason: "combined_identity_failure", missingIngredientPositions: [0], formMismatch: true,
    }));
  });

  it("reports empty upstream arrays for both attempts without inventing missing foods", async () => {
    generation.mockResolvedValue([]);
    expect(await completeSelectedConcept(request())).toEqual({ ok: false, code: "identity_mismatch" });
    expect(warning.mock.calls.map(call => call[1])).toEqual([
      { phase: "initial", reason: "empty_upstream_candidates", candidateCount: 0 },
      { phase: "repair", reason: "empty_upstream_candidates", candidateCount: 0 },
    ]);
  });

  it("logs structured comparison diagnostics in Production mode without food or profile contents", async () => {
    const prior = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      generation.mockResolvedValue([recipe(names.slice(1))]);
      await completeSelectedConcept(request());
      expect(warning).toHaveBeenCalled();
      const diagnostic = warning.mock.calls.filter(call => call[0] === "[CreatorMenu] identity candidate rejected");
      expect(diagnostic).toHaveLength(2);
      const log = JSON.stringify(diagnostic);
      for (const text of [...names, "synthetic", "Chinese", "Szechuan Beef"]) expect(log).not.toContain(text);
      expect(diagnostic[0][1]).toEqual({
        reason: "ingredient_evidence_failure", phase: "initial", candidateIndex: 0,
        semanticIdentityFailed: false, formMismatch: false, catastrophicDeviation: false,
        missingIngredientPositions: [0],
      });
    } finally { process.env.NODE_ENV = prior; }
  });

  it.each(["allergy", "avoidance", "diet"] as const)(
    "a reviewed ingredient alias cannot bypass a real %s final check", async protection => {
      const input = request();
      if (protection === "allergy") {
        input.context.safety.allergies = input.envelope.allergies = ["shellfish"];
      } else if (protection === "avoidance") {
        input.context.safety.avoidedFoods = input.envelope.avoidances = ["shrimp"];
      } else {
        input.context.diet.effective = input.envelope.dietaryIdentity = ["vegetarian"];
      }
      generation.mockResolvedValue([recipe([...replace(4, "Sichuan peppercorns"), "shrimp"])]);
      // The vegetarian concept can be blocked before generation; either way
      // the unsafe recipe must never be returned.
      const result = await completeSelectedConcept(input);
      expect(result.ok).toBe(false);
      if (protection !== "diet") expect(result).toMatchObject({ code: "final_validation_rejected" });
    },
  );

  it("does not force a promised ingredient through a safety-profile rejection", async () => {
    jest.mocked(enforceSafetyProfile).mockResolvedValueOnce({ result: "BLOCKED" } as any);
    expect(await completeSelectedConcept(request())).toEqual({ ok: false, code: "concept_rejected" });
    expect(generation).not.toHaveBeenCalled();
  });

  it.each(["diabetes", "glp1"] as const)("retains the actual %s numeric validator", async condition => {
    const input = request();
    generation.mockResolvedValue([{
      ...recipe(replace(4, "Sichuan peppercorns")), carbs: 200, starchyCarbs: 200, fat: 100,
    }]);
    const spy = condition === "diabetes"
      ? jest.spyOn(diabetesGuards, "validateDiabeticMeal")
      : jest.spyOn(dietGuards, "validateMealForDiet");
    if (condition === "diabetes") {
      input.envelope.hasDiabetes = true;
      input.diabetesAttempt = {
        subjectId: "synthetic", context: { latestGlucose: { state: "high-risk" } },
        snapshot: {},
      } as any;
    } else {
      input.glp1.isActive = true;
      input.glp1.resolvedTargets = {
        resolvedMealCalories: 400, resolvedMealProteinG: 30, resolvedMealCarbsG: 25,
        resolvedMealFatG: 12,
      } as any;
    }
    expect(await completeSelectedConcept(input)).toEqual({ ok: false, code: "final_validation_rejected" });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.results.some(r => r.value?.isValid === false)).toBe(true);
  });

  it("keeps unsupported clinical authority fail-closed before generation", async () => {
    const input = request();
    input.context.safety.healthConditions = ["kidney disease"];
    expect(await completeSelectedConcept(input)).toEqual({ ok: false, code: "final_validation_rejected" });
    expect(generation).not.toHaveBeenCalled();
  });

  it("does not make a genuinely different dish pass the shared identity gate", () => {
    const result = validateDishIdentity("Szechuan Beef",
      recipe(["chicken", "noodles"], "Chicken Noodle Soup", "Chicken soup."), {
        identityAnchor: "Szechuan Beef", definingComponents: ["beef"], adaptableComponents: [],
        conflicts: [], adaptationBlock: "", dishForm: "stir-fry",
      });
    expect(result.passed).toBe(false);
    expect(result.catastrophicDeviation).toBe(true);
  });
});
