const mockLoadProtocolEnvelope = jest.fn();
const mockScanGeneratedOutput = jest.fn();
const mockGenerateTemplates = jest.fn();

jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: (...args: any[]) => mockLoadProtocolEnvelope(...args),
  scanGeneratedOutput: (...args: any[]) => mockScanGeneratedOutput(...args),
}));
jest.mock("../services/weeklyMealPlanningServiceA", () => ({
  weeklyMealPlanningServiceA: { generate: (...args: any[]) => mockGenerateTemplates(...args) },
}));
jest.mock("../services/nutritionDayService", () => ({
  getUserTimezone: jest.fn(async () => "UTC"),
}));
jest.mock("../services/humanFoodContext/resolveHumanFoodContext", () => ({
  resolveHumanFoodContext: jest.fn(async () => ({
    status: "ready",
    diet: { effective: [] },
    safety: { healthConditions: [], allergies: [] },
    foodsIEnjoy: { explicit: [] },
    internalFingerprint: "test-context",
  })),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({
  validateHumanFoodCandidate: jest.fn(() => ({ outcome: "pass", findings: [] })),
}));
jest.mock("../services/humanFoodContext/requestExecutionState", () => ({
  createHumanFoodRequestExecutionState: jest.fn(() => ({})),
}));
jest.mock("../services/rulesEngine", () => ({
  enforceWeeklyCaps: jest.fn(() => ({ withinCaps: true })),
  meetsVariety: jest.fn(() => ({ ok: true })),
}));
jest.mock("../services/guardrails", () => ({
  validateMealForDiet: jest.fn(() => ({ isValid: true })),
}));

import {
  generateCanonicalWeeklyMealPlan,
  regenerateCanonicalWeeklyDay,
} from "../services/canonicalWeeklyMealPlanning";

const activeVeganEnvelope = {
  dietaryIdentity: ["vegan"],
  allergies: [],
  avoidances: [],
  medicalHardLimits: [],
  medicalOptimization: [],
  procedural: {
    forbiddenInstructions: [],
    requiredInstructionNotes: [],
    preparationRules: [],
    storageRules: [],
    equipmentRules: [],
    crossContaminationRules: [],
  },
};

function templateMeal(ingredient: string) {
  return {
    id: "meal-1",
    name: "Test breakfast",
    description: "A simple breakfast.",
    type: "breakfast",
    ingredients: [{ name: ingredient, amount: "1", unit: "serving" }],
    steps: ["Prepare and serve."],
    calories: 300,
    protein: 20,
    carbs: 30,
    fat: 10,
  };
}

function sourceFor(meal: ReturnType<typeof templateMeal>) {
  return {
    plan: [{
      days: Array.from({ length: 7 }, () => ({ meals: [meal] })),
    }],
    meta: { planType: "curated-templates" },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadProtocolEnvelope.mockResolvedValue(activeVeganEnvelope);
  mockScanGeneratedOutput.mockImplementation((meal, envelope) => {
    const hasAnimalFood = meal.ingredients.some((ingredient: any) =>
      /chicken|beef|fish|egg|dairy|cheese/i.test(typeof ingredient === "string" ? ingredient : ingredient.name),
    );
    return {
      passed: !(envelope.dietaryIdentity.includes("vegan") && hasAnimalFood),
      violations: [],
      instructionViolations: [],
      message: "vegan dietary identity",
    };
  });
  mockGenerateTemplates.mockImplementation(async () => sourceFor(templateMeal("chicken breast")));
});

describe("canonical weekly meal protocol scan", () => {
  test("rejects an unsafe selected template before a generated week can be returned", async () => {
    await expect(generateCanonicalWeeklyMealPlan({
      userId: "nutrition-subject-1",
      weeks: 1,
      mealsPerDay: 1,
      startDateISO: "2024-01-07",
    })).rejects.toMatchObject({
      code: "PROTOCOL_MEAL_REJECTED",
    });

    expect(mockLoadProtocolEnvelope).toHaveBeenCalledTimes(1);
    expect(mockLoadProtocolEnvelope).toHaveBeenCalledWith("nutrition-subject-1");
    expect(mockScanGeneratedOutput).toHaveBeenCalledWith(
      expect.objectContaining({ ingredients: [{ name: "chicken breast", amount: "1", unit: "serving" }] }),
      activeVeganEnvelope,
      expect.objectContaining({ generatorName: "weekly_meal_plan" }),
    );
  });

  test("allows a compliant selected template through day regeneration", async () => {
    mockGenerateTemplates.mockImplementation(async () => sourceFor(templateMeal("firm tofu")));
    const days = Array.from({ length: 7 }, (_, day) => ({
      date: `2024-01-${String(7 + day).padStart(2, "0")}`,
      meals: [templateMeal("firm tofu")],
    }));

    const result = await regenerateCanonicalWeeklyDay({
      userId: "nutrition-subject-1",
      existingPlan: { days },
      dayIndex: 0,
    });

    expect(result.plan.days[0].meals[0].name).toBe("Test breakfast");
    expect(mockLoadProtocolEnvelope).toHaveBeenCalledTimes(1);
    expect(mockLoadProtocolEnvelope).toHaveBeenCalledWith("nutrition-subject-1");
    expect(mockScanGeneratedOutput).toHaveBeenCalledTimes(1);
  });

  test("fails closed with a typed limitation when selected template lacks ingredient evidence", async () => {
    mockGenerateTemplates.mockImplementation(async () => sourceFor({
      ...templateMeal(""),
      ingredients: [{ name: "Fresh seasonal ingredients", amount: "1", unit: "portion" }],
    }));

    await expect(generateCanonicalWeeklyMealPlan({
      userId: "nutrition-subject-1",
      weeks: 1,
      mealsPerDay: 1,
      startDateISO: "2024-01-07",
    })).rejects.toMatchObject({
      code: "PROTOCOL_INGREDIENT_EVIDENCE_MISSING",
      message: expect.stringContaining("no usable ingredient evidence"),
    });
    expect(mockScanGeneratedOutput).not.toHaveBeenCalled();
  });
});