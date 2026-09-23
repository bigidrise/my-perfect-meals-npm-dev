import type { OneTouchDirection } from "@shared/oneTouch";

jest.mock("../db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: jest.fn(),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({
  buildCreatorHumanFoodPrompt: jest.fn(() => "HFC requirements"),
}));
jest.mock("../services/humanFoodContext/validateHumanFoodResult", () => ({
  validateHumanFoodResult: jest.fn(() => ({ valid: true, violations: [] })),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({
  validateHumanFoodCandidate: jest.fn(() => ({ outcome: "pass", findings: [] })),
}));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: jest.fn(() => Promise.resolve({ result: "SAFE" })),
}));
jest.mock("../services/allergyGuardrails", () => ({
  buildDietPromptBlock: jest.fn(() => "diet requirements"),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "protocol requirements" })),
  scanGeneratedOutput: jest.fn(() => ({ passed: true })),
}));
jest.mock("../services/oneTouch/directions", () => ({
  validateOneTouchDirectionSafety: jest.fn(() => []),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn(),
  buildGLP1RecommendationBlock: jest.fn(() => "GLP1 requirements"),
}));
jest.mock("../services/guardrails", () => ({
  validateMealForDiet: jest.fn(() => ({ isValid: true })),
}));
jest.mock("../services/guardrails/validators/dietaryRestrictionValidator", () => ({
  validateDietaryRestriction: jest.fn(() => ({ isValid: true, confidence: "high" })),
}));
jest.mock("../services/dishAdaptation/dishIdentityValidator", () => ({
  validateDishIdentity: jest.fn(() => ({ passed: true, catastrophicDeviation: false })),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn(() => Promise.resolve("/images/validated.png")),
  normalizeMealTypeToSourceType: jest.fn(() => "meal"),
}));
jest.mock("../services/oneTouch/menuRecipeGenerator", () => ({
  generateMenuRecipe: jest.fn(),
}));
jest.mock("../services/oneTouch/contextFingerprint", () => ({
  oneTouchContextFingerprint: jest.fn(() => "stable-authority"),
}));

import { db } from "../db";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { loadUserProtocolEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { validateDiabeticMeal } from "../services/guardrails/validators/diabeticValidator";
import { validateMealForDiet } from "../services/guardrails";
import { validateDietaryRestriction } from "../services/guardrails/validators/dietaryRestrictionValidator";
import { validateOneTouchDirectionSafety } from "../services/oneTouch/directions";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { generateMenuRecipe } from "../services/oneTouch/menuRecipeGenerator";
import { oneTouchContextFingerprint } from "../services/oneTouch/contextFingerprint";
import {
  completeMenuRecipe, type MenuRecipeCompletionInput,
} from "../services/oneTouch/menuRecipeCompletion";

const concept: OneTouchDirection = {
  title: "Tomato Lentil Stew",
  description: "A warming tomato and lentil stew.",
  primaryIngredients: ["lentils", "tomatoes"],
  primaryProtein: "lentils",
  produceItems: ["tomatoes"],
  cuisine: "Mediterranean",
  dietaryEvidence: [],
  preparationMethod: "simmered",
  signature: "tomato-lentil-stew",
  culinaryIdentity: {
    dishForm: "stew", preparationStyle: "simmered", temperature: "hot",
    primaryProteinBase: "lentils", majorStarchBase: null,
    flavorFamily: "savory tomato", cuisineEvidence: "Mediterranean",
    definingComponents: ["lentils", "tomatoes"],
  },
  occasion: "lunch",
};
const draft = {
  name: "Tomato Lentil Stew",
  description: "Lentils and tomatoes simmered into a stew.",
  ingredients: [
    { name: "lentils", quantity: "1/2", unit: "cup" },
    { name: "tomatoes", quantity: "1", unit: "cup" },
  ],
  instructions: "Simmer the lentils with tomatoes until cooked and tender.",
  calories: 300, protein: 20, starchyCarbs: 25, fibrousCarbs: 10, fat: 5,
  cookingTime: "30 minutes",
};
const carnivoreConcept: OneTouchDirection = {
  ...concept,
  title: "Beef and Egg Skillet",
  description: "A cooked beef and egg skillet.",
  primaryIngredients: ["beef", "eggs"],
  primaryProtein: "beef",
  produceItems: [],
  signature: "beef-and-egg-skillet",
  culinaryIdentity: {
    ...concept.culinaryIdentity,
    dishForm: "skillet",
    primaryProteinBase: "beef",
    definingComponents: ["beef", "eggs"],
  },
};
const carnivoreDraft = {
  ...draft,
  name: "Beef and Egg Skillet",
  description: "Cooked beef and eggs served hot.",
  ingredients: [
    { name: "beef", quantity: "1/2", unit: "lb" },
    { name: "eggs", quantity: "2", unit: "whole" },
  ],
  instructions: "Cook the beef, then add eggs and cook through.",
};
const context = {
  status: "resolved", internalFingerprint: "volatile", nutrition: null,
  gaps: [],
  diabetesFoodPreferences: null, diet: { effective: [] },
  safety: { healthConditions: [], allergies: [], avoidedFoods: [], dislikedFoods: [] },
};
const envelope = {
  dietaryIdentity: [], hasDiabetes: false, medicalHardLimits: [], medicalOptimization: [],
  glp1DailyTolerance: null, diabeticGlucoseState: null,
};
const input: MenuRecipeCompletionInput = {
  actorUserId: "user-1", subject: { kind: "account", id: "user-1" },
  approvedConcept: concept, servings: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
    resolve: async () => context,
    executionState: { rejectedCandidateSignatures: [] },
  }));
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(envelope);
  (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({ isActive: false, resolvedTargets: null });
  (generateMenuRecipe as jest.Mock).mockResolvedValue(draft);
  (oneTouchContextFingerprint as jest.Mock).mockReturnValue("stable-authority");
  (validateHumanFoodResult as jest.Mock).mockReturnValue({ valid: true, violations: [] });
  (validateHumanFoodCandidate as jest.Mock).mockImplementation((candidate, currentContext, options) => {
    if (options.evidenceMode !== "exact") return { outcome: "review_required" };
    const requirements = candidate.evidence.requirementEvidence ?? {};
    const active = currentContext.diet.effective.map((value: string) =>
      `dietary_identity:${value.toLowerCase().replace(/[_-]+/g, " ")}`);
    const missing = active.filter((key: string) => requirements[key]?.status !== "pass");
    return {
      outcome: missing.length ? "review_required" : "pass",
      findings: missing.map((key: string) => ({ code: `requirement_evidence_required:${key}` })),
    };
  });
  (scanGeneratedOutput as jest.Mock).mockReturnValue({ passed: true });
  (validateOneTouchDirectionSafety as jest.Mock).mockReturnValue([]);
  (enforceSafetyProfile as jest.Mock).mockResolvedValue({ result: "SAFE" });
  (validateMealForDiet as jest.Mock).mockReturnValue({ isValid: true });
  (validateDietaryRestriction as jest.Mock).mockReturnValue({ isValid: true, confidence: "high" });
  (generateMealImageUnified as jest.Mock).mockResolvedValue("/images/validated.png");
});

describe("Menu-owned one-recipe completion (not connected to the manual Creators)", () => {
  it.each([1, 2, 10])("generates one candidate, scales %i servings, and validates the exact return", async (servings) => {
    const result = await completeMenuRecipe({ ...input, servings });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(generateMenuRecipe).toHaveBeenCalledTimes(1);
    expect(result.card.ingredients[0].quantity).toBe(String(0.5 * servings));
    expect(result.card.nutrition).toMatchObject({
      calories: 300 * servings, carbs: 35 * servings, protein: 20 * servings,
    });
    expect(result.card.servingSize).toBe(`${servings} servings`);
    expect(result.card.nutritionSource).toBe("model_estimate");
    const candidates = (validateHumanFoodCandidate as jest.Mock).mock.calls.map(([candidate]) => candidate);
    expect(candidates).toHaveLength(2);
    expect(candidates[1].ingredients).toEqual(result.card.ingredients);
    expect(candidates[1].nutrition).toMatchObject({ calories: 300, carbs: 35, protein: 20 });
    expect(generateMealImageUnified).toHaveBeenCalledTimes(1);
    expect((generateMealImageUnified as jest.Mock).mock.invocationCallOrder[0])
      .toBeGreaterThan((validateHumanFoodCandidate as jest.Mock).mock.invocationCallOrder[1]);
  });

  it("rejects an account subject other than the actor before generation", async () => {
    expect(await completeMenuRecipe({
      ...input, subject: { kind: "account", id: "another-account" },
    })).toMatchObject({ ok: false, code: "unauthorized_subject" });
    expect(generateMenuRecipe).not.toHaveBeenCalled();
  });

  it("does not skip nutrition or diabetes authority when a resolver reports a gap", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({
        ...context, status: "resolved_with_gaps",
        gaps: ["daily_nutrition_state", "diabetes.glucose_food_preferences"],
      }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "unresolved_authority",
    });
    expect(generateMenuRecipe).not.toHaveBeenCalled();
  });

  it("does not borrow owner clinical authority for a household subject", async () => {
    (db.select as jest.Mock).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [{ activeHouseholdProfileId: "household-1" }] }) }),
    }).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [{ id: "household-1" }] }) }),
    });
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({ ...context, nutrition: { remaining: { calories: 1000 } } }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    expect(await completeMenuRecipe({
      ...input, subject: { kind: "household", id: "household-1" },
    })).toMatchObject({ ok: false, code: "unresolved_authority" });
    expect(resolveGLP1GlobalContext).not.toHaveBeenCalled();
    expect(generateMenuRecipe).not.toHaveBeenCalled();
  });

  it("rejects an unowned household before resolving the owner's food context", async () => {
    (db.select as jest.Mock).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [{ activeHouseholdProfileId: "another-household" }] }) }),
    }).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    expect(await completeMenuRecipe({
      ...input, subject: { kind: "household", id: "another-household" },
    })).toMatchObject({ ok: false, code: "unauthorized_subject" });
    expect(createHumanFoodRequestScope).not.toHaveBeenCalled();
  });

  it("supports an active owned household without resolving the actor's GLP-1 targets", async () => {
    (db.select as jest.Mock).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [{ activeHouseholdProfileId: "household-1" }] }) }),
    }).mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [{ id: "household-1" }] }) }),
    });
    expect(await completeMenuRecipe({
      ...input, subject: { kind: "household", id: "household-1" },
    })).toMatchObject({ ok: true });
    expect(loadUserProtocolEnvelope).toHaveBeenCalledWith("user-1", "household-1");
    expect(resolveGLP1GlobalContext).not.toHaveBeenCalled();
  });

  it("rejects an unsafe concept and an advisory pre-generation decision", async () => {
    (validateOneTouchDirectionSafety as jest.Mock).mockReturnValueOnce(["forbidden_ingredient:peanut"]);
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "concept_rejected" });
    expect(generateMenuRecipe).not.toHaveBeenCalled();
    (enforceSafetyProfile as jest.Mock).mockResolvedValueOnce({ result: "ADVISORY" });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "diet_hfc_rejected" });
    expect(generateMenuRecipe).not.toHaveBeenCalled();
  });

  it("rejects an avoidance discovered in the complete recipe", async () => {
    (validateHumanFoodResult as jest.Mock).mockReturnValueOnce({
      valid: false, violations: ["forbidden_ingredient:mushroom"],
    });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "diet_hfc_rejected" });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("uses the current diabetes state and one-serving carbs, including 10-serving requests", async () => {
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({
      ...envelope, hasDiabetes: true, diabeticGlucoseState: "high-risk",
    });
    expect(await completeMenuRecipe({ ...input, servings: 10 })).toMatchObject({
      ok: false, code: "diabetes_rejected",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects a high-risk 20g meal and a blocked diabetic ingredient even below the macro limit", async () => {
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({
      ...envelope, hasDiabetes: true, diabeticGlucoseState: "high-risk",
    });
    (generateMenuRecipe as jest.Mock).mockResolvedValueOnce({
      ...draft, starchyCarbs: 10, fibrousCarbs: 10,
    });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "diabetes_rejected" });
    (generateMenuRecipe as jest.Mock).mockResolvedValue({
      ...draft, starchyCarbs: 5, fibrousCarbs: 5,
      ingredients: [...draft.ingredients, { name: "sugar", quantity: "1", unit: "tsp" }],
    });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "diabetes_rejected" });
    expect(validateDiabeticMeal({
      name: draft.name, ingredients: [{ name: "sugar" }], macros: { carbs: 10 },
    }, { glucoseState: "high-risk" }).isValid).toBe(false);
  });

  it("never converts a protocol text scan into positive keto composition evidence", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({ ...context, diet: { effective: ["keto"] } }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "requirement_evidence_unsupported",
    });
    expect(validateHumanFoodCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: expect.objectContaining({
          requirementEvidence: expect.objectContaining({
            "dietary_identity:keto": { status: "review_required", source: "none" },
          }),
        }),
      }), expect.anything(), expect.objectContaining({ evidenceMode: "exact" }),
    );
  });

  it("does not let a vegan PASS mask unsupported keto or Mediterranean", async () => {
    for (const unsupported of ["keto", "mediterranean"]) {
      (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
        resolve: async () => ({ ...context, diet: { effective: ["vegan", unsupported] } }),
        executionState: { rejectedCandidateSignatures: [] },
      }));
      expect(await completeMenuRecipe(input)).toMatchObject({
        ok: false, code: "requirement_evidence_unsupported",
      });
      const candidate = (validateHumanFoodCandidate as jest.Mock).mock.lastCall?.[0];
      expect(candidate.evidence.requirementEvidence).toMatchObject({
        "dietary_identity:vegan": { status: "pass", source: "ingredient_classifier" },
        [`dietary_identity:${unsupported}`]: { status: "review_required", source: "none" },
      });
      expect(candidate.evidence.dietaryIdentityCompliant).toBeUndefined();
      expect(generateMealImageUnified).not.toHaveBeenCalled();
    }
  });

  it("derives independent diabetes proof from resolved authority, including after scaling", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({
        ...context, diet: { effective: ["vegan", "diabetic"] },
        safety: { ...context.safety, healthConditions: ["diabetes"] },
      }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({
      ...envelope, hasDiabetes: true, diabeticGlucoseState: "elevated",
    });
    (generateMenuRecipe as jest.Mock).mockResolvedValue({ ...draft, starchyCarbs: 5, fibrousCarbs: 5 });
    expect(await completeMenuRecipe({ ...input, servings: 4 })).toMatchObject({ ok: true });
    const checked = (validateHumanFoodCandidate as jest.Mock).mock.calls.map(([candidate]) => candidate);
    expect(checked).toHaveLength(2);
    for (const candidate of checked) {
      expect(candidate.evidence.requirementEvidence).toMatchObject({
        "dietary_identity:vegan": { status: "pass", source: "ingredient_classifier" },
        "dietary_identity:diabetic": {
          status: "pass", source: "diabetes_authority", nutritionBasis: "model_estimate",
        },
        "clinical:diabetes": {
          status: "pass", source: "diabetes_authority", nutritionBasis: "model_estimate",
        },
      });
      expect(candidate.nutrition.carbs).toBe(10);
      expect(candidate.evidence.nutritionEvidence).toBe("structured_generation");
    }
    expect(validateDiabeticMeal({ name: draft.name, ingredients: [{ name: "sugar" }],
      macros: { carbs: 10 } }, { glucoseState: "high-risk" }).isValid).toBe(false);
  });

  it("does not borrow diabetes proof when the subject's authority is absent", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({ ...context, diet: { effective: ["diabetic"] } }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "unresolved_authority" });
    expect(validateHumanFoodCandidate).not.toHaveBeenCalled();
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({
      ...envelope, hasDiabetes: true, diabeticGlucoseState: null,
    });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "unresolved_authority" });
  });

  it("creates GLP-1 evidence from resolved targets, then rejects a final-payload failure", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({
        ...context, diet: { effective: ["vegetarian", "glp1"] },
        safety: { ...context.safety, healthConditions: ["GLP-1"] },
      }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({
      isActive: true, resolvedTargets: { targetProteinGrams: 30, maximumToleratedFatGrams: 10 },
    });
    (validateMealForDiet as jest.Mock).mockReturnValue({ isValid: true });
    expect(await completeMenuRecipe({ ...input, servings: 3 })).toMatchObject({ ok: true });
    const checked = (validateHumanFoodCandidate as jest.Mock).mock.calls.map(([candidate]) => candidate);
    expect(checked).toHaveLength(2);
    expect(checked[1].evidence.requirementEvidence).toMatchObject({
      "dietary_identity:vegetarian": { status: "pass", source: "ingredient_classifier" },
      "dietary_identity:glp1": {
        status: "pass", source: "glp1_authority", nutritionBasis: "model_estimate",
      },
      "clinical:glp1": { status: "pass", source: "glp1_authority" },
    });
    expect((validateMealForDiet as jest.Mock).mock.calls.slice(0, 2).map(([meal]) => meal.macros.carbs))
      .toEqual([35, 35]);
    (validateMealForDiet as jest.Mock).mockClear()
      .mockReturnValueOnce({ isValid: true })
      .mockReturnValueOnce({ isValid: false });
    (generateMealImageUnified as jest.Mock).mockClear();
    expect(await completeMenuRecipe({ ...input, servings: 3 }))
      .toMatchObject({ ok: false, code: "glp1_rejected" });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("keeps a broad Snack culinary occasion separate from the existing lunch clinical slot", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({
        ...context, diet: { effective: ["vegetarian", "glp1"] },
        safety: { ...context.safety, healthConditions: ["GLP-1"] },
      }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({
      isActive: true, resolvedTargets: { targetProteinGrams: 30, maximumToleratedFatGrams: 10 },
    });
    expect(await completeMenuRecipe({
      ...input, approvedConcept: { ...concept, occasion: "snack" },
      contextCreator: "craving_creator", clinicalMealSlot: "lunch",
    })).toMatchObject({ ok: true });
    expect((createHumanFoodRequestScope as jest.Mock).mock.calls[0][0].creator).toBe("craving_creator");
    expect((resolveGLP1GlobalContext as jest.Mock).mock.calls.map((call) => call[2]))
      .toEqual(["lunch", "lunch"]);
    expect((validateMealForDiet as jest.Mock).mock.calls.map((call) => call[3]))
      .toEqual([false, false]);
    expect((validateHumanFoodCandidate as jest.Mock).mock.calls[0][0].category).toBe("snack");
  });

  it("supplies positive carnivore evidence only from the shared classifier on both payloads", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({ ...context, diet: { effective: ["carnivore"] } }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    (generateMenuRecipe as jest.Mock).mockResolvedValue(carnivoreDraft);
    const result = await completeMenuRecipe({ ...input, approvedConcept: carnivoreConcept, servings: 4 });
    expect(result.ok).toBe(true);
    const candidates = (validateHumanFoodCandidate as jest.Mock).mock.calls.map(([value]) => value);
    expect(candidates.map((value) => value.evidence.requirementEvidence["dietary_identity:carnivore"]))
      .toEqual(Array(2).fill({
        status: "pass", source: "ingredient_classifier", nutritionBasis: "not_applicable",
      }));
    expect((validateDietaryRestriction as jest.Mock).mock.calls).toHaveLength(2);
    expect((validateDietaryRestriction as jest.Mock).mock.calls[1][0].ingredients[0].quantity).toBe("2");
    expect(generateMenuRecipe).toHaveBeenCalledTimes(1);
  });

  it("rejects a late scaled-payload diet contradiction rather than patching the flag", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({ ...context, diet: { effective: ["carnivore"] } }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    (validateDietaryRestriction as jest.Mock)
      .mockReturnValueOnce({ isValid: true, confidence: "high" })
      .mockReturnValueOnce({ isValid: false, confidence: "high" });
    (generateMenuRecipe as jest.Mock).mockResolvedValue(carnivoreDraft);
    expect(await completeMenuRecipe({ ...input, approvedConcept: carnivoreConcept, servings: 4 })).toMatchObject({
      ok: false, code: "diet_hfc_rejected",
    });
    expect(generateMenuRecipe).toHaveBeenCalledTimes(1);
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("fails closed if active GLP-1 targets are absent or the completed recipe fails validation", async () => {
    (resolveGLP1GlobalContext as jest.Mock).mockResolvedValueOnce({
      isActive: true, resolvedTargets: null,
    });
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "unresolved_authority",
    });
    (resolveGLP1GlobalContext as jest.Mock).mockResolvedValue({
      isActive: true, resolvedTargets: { targetProteinGrams: 30, maximumToleratedFatGrams: 10 },
    });
    (validateMealForDiet as jest.Mock).mockReturnValue({ isValid: false });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "glp1_rejected" });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("does not assert unsupported clinical evidence", async () => {
    (createHumanFoodRequestScope as jest.Mock).mockImplementation(() => ({
      resolve: async () => ({
        ...context, safety: { ...context.safety, healthConditions: ["kidney disease"] },
      }),
      executionState: { rejectedCandidateSignatures: [] },
    }));
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "protocol_clinical_rejected",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects a specialty directive present only in the protocol envelope", async () => {
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({
      ...envelope, medicalHardLimits: ["renal sodium and potassium limits"],
    });
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "protocol_clinical_rejected",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects invalid model nutrition and never invents missing values", async () => {
    (generateMenuRecipe as jest.Mock).mockResolvedValue({ ...draft, calories: Number.NaN });
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "nutrition_evidence_invalid",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects unscalable ingredient quantities instead of returning false recipe totals", async () => {
    (generateMenuRecipe as jest.Mock).mockResolvedValue({
      ...draft, ingredients: [{ ...draft.ingredients[0], quantity: "a little" }, draft.ingredients[1]],
    });
    expect(await completeMenuRecipe({ ...input, servings: 2 })).toMatchObject({
      ok: false, code: "serving_finalization_failed",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("fails closed on a new unsafe ingredient or instruction", async () => {
    (scanGeneratedOutput as jest.Mock).mockReturnValue({ passed: false });
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "protocol_scan_rejected",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("does not accept a candidate that lost the primary food identity", async () => {
    (generateMenuRecipe as jest.Mock).mockResolvedValue({
      ...draft, ingredients: [{ name: "salmon", quantity: "2", unit: "oz" }],
    });
    expect(await completeMenuRecipe(input)).toMatchObject({ ok: false, code: "identity_mismatch" });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects failed final validation, including after serving formatting", async () => {
    (validateHumanFoodCandidate as jest.Mock).mockReturnValueOnce({ outcome: "pass" })
      .mockReturnValueOnce({ outcome: "review_required" });
    expect(await completeMenuRecipe({ ...input, servings: 2 })).toMatchObject({
      ok: false, code: "final_validation_rejected",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("rejects changing authority before image generation", async () => {
    (oneTouchContextFingerprint as jest.Mock)
      .mockReturnValueOnce("before").mockReturnValueOnce("after");
    expect(await completeMenuRecipe(input)).toMatchObject({
      ok: false, code: "unresolved_authority",
    });
    expect(generateMealImageUnified).not.toHaveBeenCalled();
  });

  it("returns a safe card when its optional image fails", async () => {
    (generateMealImageUnified as jest.Mock).mockRejectedValue(new Error("image unavailable"));
    const result = await completeMenuRecipe(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.card.imageUrl).toBeUndefined();
  });
});