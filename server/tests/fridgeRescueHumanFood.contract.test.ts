import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
} from "../../shared/humanFoodContext";
import {
  getFridgeRescueReleaseStatus,
  toFridgeRescueHumanFoodCandidate,
  validateFridgeRescueMealsWithHumanFood,
} from "../services/fridgeRescueHumanFoodAdapter";

function context(overrides: Partial<HumanFoodContext> = {}): HumanFoodContext {
  const unavailablePreference = {
    value: null,
    source: "unavailable" as const,
    available: false,
  };
  return {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: "resolved",
    creator: "fridge_rescue",
    actorUserId: "actor",
    subjectUserId: "subject",
    generationChainId: "chain",
    correlationId: "correlation",
    resolvedAt: "2026-09-11T00:00:00.000Z",
    expiresAt: "2026-09-11T00:05:00.000Z",
    diet: {
      stored: [],
      effective: [],
      source: "profile",
      requestOverride: null,
      adaptationOutcome: "not_needed",
    },
    flavor: {
      heat: unavailablePreference,
      seasoningIntensity: unavailablePreference,
      broadFlavor: unavailablePreference,
      flavorStyle: unavailablePreference,
      cuisine: unavailablePreference,
      cuisineIntensity: unavailablePreference,
      spiceComplexity: unavailablePreference,
    },
    safety: {
      allergies: [],
      avoidedFoods: [],
      dislikedFoods: [],
      healthConditions: [],
    },
    authorization: {
      status: "none",
      action: null,
      reservationId: null,
      waivers: [],
    },
    nutrition: {
      prescription: { source: "user_default" },
      resolution: { status: "RESOLVED", reasonCodes: [] },
      projectedRemaining: { calories: 900, protein: 100, carbs: 120, fat: 45 },
      activeConstraints: { consumedStarchExhausted: false },
    } as any,
    behavior: null,
    diabetesFoodPreferences: null,
    gaps: [],
    notices: [],
    blockedReasons: [],
    internalFingerprint: "fridge-contract",
    ...overrides,
  };
}

const meals = [
  {
    name: "High-fat chicken skillet",
    description: "Chicken cooked with a rich sauce.",
    ingredients: [{ name: "chicken breast", quantity: "6", unit: "oz" }],
    instructions: "Cook the chicken thoroughly.",
    calories: 510,
    protein: 42,
    carbs: 18,
    fat: 21,
    starchyCarbs: 8,
  },
  {
    name: "Lean chicken bowl",
    description: "Chicken with vegetables.",
    ingredients: [{ name: "chicken breast", quantity: "5", unit: "oz" }, { name: "broccoli" }],
    instructions: "Grill the chicken and steam the broccoli.",
    calories: 380,
    protein: 40,
    carbs: 22,
    fat: 10,
    starchyCarbs: 6,
  },
  {
    name: "Chicken spinach plate",
    description: "Chicken with spinach.",
    ingredients: [{ name: "chicken breast" }, { name: "spinach" }],
    instructions: "Bake the chicken and wilt the spinach.",
    calories: 340,
    protein: 38,
    carbs: 14,
    fat: 9,
    starchyCarbs: 0,
  },
];

describe("Fridge Rescue Human Food consumer contract", () => {
  test("preserves generated nutrition and recipe fields into Human Food validation", () => {
    const candidate = toFridgeRescueHumanFoodCandidate(meals[1], {
      protocolValidated: true,
      glp1Validated: true,
    });
    expect(candidate).toMatchObject({
      name: meals[1].name,
      ingredients: meals[1].ingredients,
      instructions: meals[1].instructions,
      nutrition: {
        calories: 380,
        protein: 40,
        carbs: 22,
        fat: 10,
        starchyCarbs: 6,
      },
      evidence: {
        nutritionEvidence: "structured_generation",
        glp1Compliant: true,
      },
    });
  });

  test("does not report missing verified macros when generated values exist", () => {
    const result = validateFridgeRescueMealsWithHumanFood(
      [meals[1]],
      context(),
      { protocolValidated: true, glp1Validated: true },
    );
    expect(result.rejected).toHaveLength(0);
    expect(result.accepted).toHaveLength(1);
  });

  test("returns two survivors when one of three exceeds the GLP-1 fat ceiling", () => {
    const glp1Survivors = meals.filter((meal) => meal.fat <= 15);
    const result = validateFridgeRescueMealsWithHumanFood(
      glp1Survivors,
      context({ safety: { ...context().safety, healthConditions: ["GLP-1"] } }),
      { protocolValidated: true, glp1Validated: true },
    );
    expect(glp1Survivors).toHaveLength(2);
    expect(result.accepted).toHaveLength(2);
    expect(getFridgeRescueReleaseStatus({
      generatedCount: meals.length,
      glp1ValidatedCount: glp1Survivors.length,
      humanFoodValidatedCount: result.accepted.length,
    })).toBe(200);
  });

  test("fails closed when every surviving meal genuinely violates safety", () => {
    const result = validateFridgeRescueMealsWithHumanFood(
      meals.slice(1),
      context({ safety: { ...context().safety, allergies: ["chicken"] } }),
      { protocolValidated: true, glp1Validated: false },
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
    expect(getFridgeRescueReleaseStatus({
      generatedCount: 2,
      glp1ValidatedCount: 2,
      humanFoodValidatedCount: 0,
    })).toBe(422);
  });

  test("never fabricates nutrition that is absent at generation", () => {
    const candidate = toFridgeRescueHumanFoodCandidate({
      name: "Incomplete meal",
      ingredients: [{ name: "chicken" }],
      instructions: "Cook thoroughly.",
    }, {
      protocolValidated: true,
      glp1Validated: false,
    });
    expect(candidate.nutrition).toEqual({
      calories: undefined,
      protein: undefined,
      carbs: undefined,
      fat: undefined,
      starchyCarbs: undefined,
    });
    expect(candidate.evidence?.nutritionEvidence).toBe("unknown");

    const result = validateFridgeRescueMealsWithHumanFood(
      [{
        name: "Incomplete meal",
        ingredients: [{ name: "chicken" }],
        instructions: "Cook thoroughly.",
      }],
      context(),
      { protocolValidated: true, glp1Validated: false },
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].validation.findings.map((finding) => finding.code))
      .toEqual(expect.arrayContaining([
        "nutrition_evidence_unknown",
        "verified_calories_missing",
        "verified_carbs_missing",
        "verified_fat_missing",
      ]));
  });
});