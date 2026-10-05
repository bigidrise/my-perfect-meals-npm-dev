import express from "express";
import request from "supertest";

const mockOpenAICreate = jest.fn();
const mockChoiceResponses: any[] = [];
let mockDefaultResponse: any;
let mockRepairResponse: any;
let mockScanOverride: ((candidate: any) => boolean | undefined) | undefined;
let mockLiquidValidation: ((candidate: any) => boolean) | undefined;
let mockGlp1Active = false;
let mockOncologyContext: any;
let mockGlp1Valid = true;
let mockTransform: ((candidate: any) => any) | undefined;
const mockCapturedPrompts: string[] = [];
const mockScopeResolve = jest.fn();
const mockScopeComplete = jest.fn();
const mockScopeRelease = jest.fn();
const mockCreateHumanFoodRequestScope = jest.fn();
const mockScanGeneratedOutput = jest.fn();
const mockValidateBeverageOutput = jest.fn();
const mockValidateLiquidNutritionOutput = jest.fn();
const mockValidateCreatorHumanFoodResult = jest.fn();
const mockValidateHumanFoodCandidate = jest.fn();
const mockGenerateMealImageUnified = jest.fn();
const mockEnforceSafetyProfile = jest.fn();
const mockResolveGLP1GlobalContext = jest.fn();
const mockValidateMealForDiet = jest.fn();

process.env.OPENAI_API_KEY = "route-test-key";

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

jest.mock("../db", () => {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) } };
});

jest.mock("@shared/schema", () => ({
  users: {
    id: "users.id",
    palateSpiceTolerance: "users.palateSpiceTolerance",
    palateSeasoningIntensity: "users.palateSeasoningIntensity",
    palateFlavorStyle: "users.palateFlavorStyle",
    measurementSystem: "users.measurementSystem",
    healthConditions: "users.healthConditions",
  },
}));

jest.mock("drizzle-orm", () => ({ eq: jest.fn(() => ({})) }));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: mockEnforceSafetyProfile,
}));
jest.mock("../services/promptBuilder", () => ({ buildPalateSection: jest.fn(() => "") }));
jest.mock("../services/allergyGuardrails", () => ({
  resolveDietCategoryStrategy: jest.fn((_restrictions: string[], category: string) => ({
    conflictLevel: "none",
    effectiveCategory: category,
    requestedCategory: category,
    coachingBlock: "",
  })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  scanGeneratedOutput: mockScanGeneratedOutput,
  buildMealComplianceBundle: jest.fn(() => ({ complianceSection: null, dietClassification: null })),
}));
jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({
  getActiveNutritionContext: jest.fn(async () => ({
    envelope: {
      dietaryIdentity: [],
      allergies: [],
      avoidances: [],
      healthConditions: [],
      oncologySupportContext: mockOncologyContext,
    },
    combinedBlock: "",
    builder: null,
  })),
}));
jest.mock("../services/behavioralMemoryService", () => ({
  derivePreferenceProfile: jest.fn(async () => null),
  buildBehavioralMemoryPromptSection: jest.fn(() => ""),
}));
jest.mock("../services/creatorSystems/resolveCreatorSystemForUser", () => ({
  resolveCreatorSystemForUser: jest.fn(async () => ({ enabled: true })),
}));
jest.mock("../services/creatorSystems/applyCreatorTransformation", () => ({
  applyCreatorTransformation: jest.fn(async (candidate: any) =>
    mockTransform ? mockTransform(candidate) : candidate,
  ),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: mockGenerateMealImageUnified,
}));
jest.mock("../services/coaching/activityEvents", () => ({
  emitActivityEvent: jest.fn(async () => undefined),
}));
jest.mock("../services/guardrails/beverageMedicalRules", () => ({
  buildBeveragePromptBlocks: jest.fn(() => "BEVERAGE MEDICAL RULES"),
  containsAlcoholContent: jest.fn((candidate: any) =>
    /rum|vodka|tequila|whiskey|alcohol/i.test(
      `${candidate?.name ?? ""} ${(candidate?.ingredients ?? []).map((item: any) => item.name ?? item).join(" ")} ${candidate?.instructions ?? ""}`,
    ),
  ),
  validateBeverageOutput: mockValidateBeverageOutput,
  attemptBeverageAutoFix: jest.fn(() => null),
}));
jest.mock("../services/ace/buildAcePromptBlock", () => ({
  buildAcePromptBlock: jest.fn(async () => null),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: mockResolveGLP1GlobalContext,
}));
jest.mock("../utils/languageInstruction", () => ({ getLanguageInstruction: jest.fn(() => "") }));
jest.mock("../services/dishAdaptation/dishAdaptationLayer", () => ({
  getDishAdaptationDirective: jest.fn(async () => null),
  buildGuardrailContext: jest.fn(() => ({})),
}));
jest.mock("../services/dishAdaptation/dishIdentityValidator", () => ({
  validateDishIdentity: jest.fn(() => ({ catastrophicDeviation: false })),
}));
jest.mock("../services/beverageTitle", () => ({
  BEVERAGE_DIET_FIT_EXPLANATION_INSTRUCTION: "Explain dietary fit.",
  ensureBeverageDietTitle: jest.fn((name: string) => name),
}));
jest.mock("../services/beverageAlternativeSupport", () => ({
  buildBeverageAlternativePrompt: jest.fn(({ originalPrompt }: any) => originalPrompt),
  getBeverageRejectionKind: jest.fn(() => "other"),
  getKnownBeverageProtocolName: jest.fn(() => null),
  shouldOfferBeverageAlternatives: jest.fn(() => false),
}));
jest.mock("../services/hydration/hydrationHandoffService", () => ({
  verifyHydrationHandoff: jest.fn(() => null),
}));
jest.mock("../services/hydration/hydrationDay", () => ({
  resolveHydrationDay: jest.fn(async () => ({ localDate: "2025-01-01" })),
}));
jest.mock("../services/hydration/liquidNutritionProtocolService", () => ({
  getCurrentLiquidNutritionProtocol: jest.fn(async () => null),
}));
jest.mock("../services/hydration/hydrationContextService", () => ({
  buildHydrationConsideredForYou: jest.fn(() => null),
  buildLiquidNutritionPromptBlock: jest.fn(() => "LIQUID NUTRITION RULES"),
  validateLiquidNutritionOutput: mockValidateLiquidNutritionOutput,
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: mockCreateHumanFoodRequestScope,
}));
jest.mock("../services/humanFoodContext/adapters", () => ({
  buildCreatorHumanFoodPrompt: jest.fn(() => "AUTHORIZED FOOD CONTEXT"),
  validateCreatorHumanFoodResult: mockValidateCreatorHumanFoodResult,
}));
jest.mock("../services/humanFoodContext/requestDiet", () => ({
  resolveRequestDietOverride: jest.fn(() => null),
}));
jest.mock("../services/humanFoodContext/requestExecutionState", () => ({
  recordRejectedHumanFoodCandidate: jest.fn(),
  buildRejectedCandidatePrompt: jest.fn(() => "Rejected candidates must not be repeated."),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({
  validateHumanFoodCandidate: mockValidateHumanFoodCandidate,
}));
jest.mock("../services/guardrails", () => ({
  validateMealForDiet: mockValidateMealForDiet,
}));

import beverageCreatorRouter from "../routes/beverage-creator";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { validateMealForDiet } from "../services/guardrails";
import { validateCreatorHumanFoodResult } from "../services/humanFoodContext/adapters";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { validateLiquidNutritionOutput } from "../services/hydration/hydrationContextService";
import { validateBeverageOutput } from "../services/guardrails/beverageMedicalRules";
import { scanGeneratedOutput } from "../services/protocolEnvelope";

const USER_ID = "beverage-three-choice-test-user";

function makeCandidate(
  name: string,
  ingredientNames: string[],
  servings: number,
  servingSize: string,
  instructions = "Shake with ice and serve.",
) {
  const perServingNutrition = {
    calories: 120,
    protein: 3,
    carbs: 18,
    starchyCarbs: 0,
    fat: 2,
  };
  return {
    name,
    category: "mocktail",
    description: `${name} beverage.`,
    ingredients: ingredientNames.map((ingredient) => ({
      name: ingredient,
      amount: "1",
      unit: "oz",
    })),
    instructions,
    nutrition: Object.fromEntries(
      Object.entries(perServingNutrition).map(([key, value]) => [key, value * servings]),
    ),
    perServingNutrition,
    servings,
    servingSize,
    reasoning: "A balanced, refreshing drink.",
    imageUrl: "",
  };
}

function servingsFromPrompt(prompt: string): { count: number; label: string } {
  const count = Number(prompt.match(/Number of servings: (\d+)/)?.[1] ?? 1);
  const label =
    count === 2 ? "2 drinks" :
    count === 5 ? "Pitcher (4–6 drinks)" :
    count === 10 ? "Party Batch (8–12 drinks)" :
    "1 drink";
  return { count, label };
}

function mockResponseForPrompt(prompt: string) {
  mockCapturedPrompts.push(prompt);
  if (prompt.includes("Repair this rejected beverage")) {
    const { count, label } = servingsFromPrompt(prompt);
    if (typeof mockRepairResponse === "function") return mockRepairResponse(prompt, count, label);
    return mockRepairResponse ?? makeCandidate("Repaired Citrus Choice", ["lime juice", "mint"], count, label);
  }
  const slot = Number(prompt.match(/BEVERAGE CHOICE (\d+)/)?.[1] ?? 0);
  const configured = slot > 0 ? mockChoiceResponses[slot - 1] : mockDefaultResponse;
  const { count, label } = servingsFromPrompt(prompt);
  if (typeof configured === "function") return configured(prompt, count, label);
  return configured ?? makeCandidate("Citrus Choice", ["lime juice", "mint"], count, label);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.id = "beverage-three-choice-correlation";
    req.authUser = { id: USER_ID };
    next();
  });
  app.use("/api/beverage-creator", beverageCreatorRouter);
  return app;
}

async function postBeverage(body: Record<string, unknown>) {
  return request(buildApp())
    .post("/api/beverage-creator")
    .send({ beverageCategory: "mocktail", flavorFamily: "citrus", ...body });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockChoiceResponses.splice(0);
  mockCapturedPrompts.splice(0);
  mockDefaultResponse = undefined;
  mockRepairResponse = undefined;
  mockScanOverride = undefined;
  mockLiquidValidation = undefined;
  mockGlp1Active = false;
  mockOncologyContext = undefined;
  mockGlp1Valid = true;
  mockTransform = undefined;

  mockScopeResolve.mockResolvedValue({
    status: "resolved",
    notices: [],
    internalFingerprint: "test-context-fingerprint",
    safety: { healthConditions: [] },
    flavor: {
      cuisine: { available: false, value: null },
      cuisineIntensity: { available: false, value: null },
      heat: { available: false, value: null },
      seasoningIntensity: { available: false, value: null },
      broadFlavor: { available: false, value: null },
      flavorStyle: { available: false, value: null },
    },
  });
  mockScopeComplete.mockResolvedValue(undefined);
  mockScopeRelease.mockResolvedValue(undefined);
  mockCreateHumanFoodRequestScope.mockReturnValue({
    executionState: {},
    resolve: mockScopeResolve,
    completeAuthorization: mockScopeComplete,
    releaseAuthorization: mockScopeRelease,
  });
  mockEnforceSafetyProfile.mockResolvedValue({ result: "PASS" });
  mockResolveGLP1GlobalContext.mockImplementation(async () =>
    mockGlp1Active
      ? {
          isActive: true,
          resolvedTargets: {
            treatmentPhase: "unknown",
            appetiteLevel: "normal",
            resolvedSnackCalories: 180,
            maximumToleratedFatGrams: 8,
            targetFatGrams: 5,
            minimumProteinFloor: 10,
            targetProteinGrams: 15,
          },
        }
      : { isActive: false, resolvedTargets: null },
  );
  mockScanGeneratedOutput.mockImplementation((candidate: any) => {
    const forced = mockScanOverride?.(candidate);
    const alcoholInInstructions = /rum|vodka|tequila|whiskey|alcohol/i.test(
      String(candidate?.instructions ?? ""),
    );
    const passed = forced ?? !alcoholInInstructions;
    return {
      passed,
      message: passed ? "" : "Alcohol is prohibited.",
      violations: passed ? [] : [{ message: "Alcohol is prohibited." }],
      instructionViolations: passed ? [] : ["alcohol in instructions"],
    };
  });
  mockValidateBeverageOutput.mockReturnValue({ passed: true, violations: [], retryHint: "" });
  mockValidateLiquidNutritionOutput.mockImplementation((candidate: any) =>
    mockLiquidValidation?.(candidate) === false
      ? { passed: false, message: "Conflicts with active liquid nutrition instructions." }
      : { passed: true },
  );
  mockValidateCreatorHumanFoodResult.mockReturnValue({ valid: true, violations: [] });
  mockValidateHumanFoodCandidate.mockImplementation((candidate: any) => {
    const repairable = candidate?.needsFinalRepair === true;
    return {
      outcome: repairable ? "repairable" : "pass",
      findings: [],
      repairInstructions: repairable ? ["Repair the final recipe structure."] : [],
      candidateSignature: String(candidate?.name ?? "candidate"),
    };
  });
  mockValidateMealForDiet.mockImplementation(() => ({
    isValid: mockGlp1Valid,
    violations: mockGlp1Valid ? [] : ["fat exceeds patient limit"],
  }));
  mockGenerateMealImageUnified.mockImplementation(async (name: string) => `image:${name}`);
  mockOpenAICreate.mockImplementation(async ({ messages }: any) => {
    const prompt = messages?.map((message: any) => message.content).join("\n") ?? "";
    return { choices: [{ message: { content: JSON.stringify(mockResponseForPrompt(prompt)) } }] };
  });
}

describe("beverage creator three-choice route", () => {
  test("active mouth sensitivity rejects acidic generation/repair and OFF stops applying stored symptoms", async () => {
    const originalNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.VITE_IS_PRODUCTION_PROJECT;
    try {
      mockOncologyContext = { enabled: true, symptoms: ["mouth_sensitivity"], emphasis: { highProteinNutrientDensity: true }, source: "self" };
      const safe = (_prompt: string, count: number, label: string) => makeCandidate("Gentle Banana Drink", ["banana", "water"], count, label);
      mockRepairResponse = makeCandidate("Gentle Banana Repair", ["banana", "water"], 1, "1 drink");
      mockDefaultResponse = safe;
      mockChoiceResponses.push(
        (_prompt: string, count: number, label: string) => makeCandidate("Acidic First Attempt", ["lemon juice"], count, label),
        (_prompt: string, count: number, label: string) => makeCandidate("Gentle Pear Drink", ["pear", "water"], count, label),
        (_prompt: string, count: number, label: string) => makeCandidate("Gentle Oat Drink", ["well-cooked oatmeal", "water"], count, label),
      );
      const active = await postBeverage({ choiceCount: 3 });
      expect(active.status).toBe(200);
      // Slot one deliberately remains invalid through its bounded retries.
      // Return the two verified choices, never pad with the acidic candidate.
      expect(active.body.choices).toHaveLength(2);
      expect(JSON.stringify(active.body.choices)).not.toMatch(/lemon juice/);
      expect(mockCapturedPrompts.join("\n")).toMatch(/Mouth sensitivity|mouth sensitivity/);

      mockOncologyContext.enabled = false;
      mockChoiceResponses.length = 0;
      mockChoiceResponses.push(
        (_prompt: string, count: number, label: string) => makeCandidate("Ordinary Lemon Drink", ["lemon juice", "water"], count, label),
        (_prompt: string, count: number, label: string) => makeCandidate("Ordinary Lime Drink", ["lime juice", "water"], count, label),
        (_prompt: string, count: number, label: string) => makeCandidate("Ordinary Orange Drink", ["orange juice", "water"], count, label),
      );
      mockDefaultResponse = (_prompt: string, count: number, label: string) => makeCandidate("Ordinary Lemon Drink", ["lemon juice"], count, label);
      const off = await postBeverage({ choiceCount: 3 });
      expect(off.status).toBe(200);
      expect(JSON.stringify(off.body.choices)).toMatch(/lemon juice/);
    } finally { process.env.NODE_ENV = originalNode; }
  });
  test("fatigue rechecks active preparation evidence through the actual route retry loop", async () => {
    const originalNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.VITE_IS_PRODUCTION_PROJECT;
    try {
      mockOncologyContext = { enabled: true, symptoms: ["fatigue_low_prep"], emphasis: { highProteinNutrientDensity: true }, source: "self" };
      const easy = (_prompt: string, count: number, label: string) => ({ ...makeCandidate("Easy Banana Drink", ["banana", "water"], count, label), activePrepMinutes: 3 });
      mockDefaultResponse = easy;
      mockRepairResponse = easy("", 1, "1 drink");
      mockChoiceResponses.push(
        (_prompt: string, count: number, label: string) => ({ ...makeCandidate("Complex First Attempt", ["banana", "water"], count, label), activePrepMinutes: 25 }),
        (_prompt: string, count: number, label: string) => ({ ...makeCandidate("Easy Pear Drink", ["pear", "water"], count, label), activePrepMinutes: 3 }),
        (_prompt: string, count: number, label: string) => ({ ...makeCandidate("Easy Oat Drink", ["well-cooked oatmeal", "water"], count, label), activePrepMinutes: 3 }),
      );
      const response = await postBeverage({ choiceCount: 3 });
      expect(response.status).toBe(200);
      expect(response.body.choices).toHaveLength(2);
      expect(response.body.choices.some((choice: any) => choice.name === "Complex First Attempt")).toBe(false);
      expect(response.body.choices.every((choice: any) => choice.activePrepMinutes === 3)).toBe(true);
      expect(mockCapturedPrompts.join("\n")).toMatch(/active preparation|activePrepMinutes/);
    } finally { process.env.NODE_ENV = originalNode; }
  });
  test("choiceCount 3 returns three independently validated, materially different drinks", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("Lime Mint Cooler", ["lime juice", "mint", "soda water"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Pineapple Ginger Fizz", ["pineapple juice", "ginger", "soda water"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Cranberry Basil Spritz", ["cranberry juice", "basil", "soda water"], count, label),
    );

    const response = await postBeverage({
      choiceCount: 3,
      overrideToken: "safety-override-token",
      advisoryOverrideToken: "advisory-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.choices).toHaveLength(3);
    expect(response.body.requestedChoiceCount).toBe(3);
    expect(new Set(response.body.choices.map((choice: any) => choice.name)).size).toBe(3);
    expect(mockCapturedPrompts.filter((prompt) => /BEVERAGE CHOICE \d+ OF UP TO 3/.test(prompt))).toHaveLength(3);
    expect(mockScanGeneratedOutput).toHaveBeenCalled();
    // Each accepted candidate is checked in the generation pass and again by
    // the final universal validator (including its post-enforcement recheck).
    expect(mockValidateBeverageOutput).toHaveBeenCalledTimes(9);
    expect(mockValidateCreatorHumanFoodResult).toHaveBeenCalledTimes(3);
    expect(mockValidateHumanFoodCandidate).toHaveBeenCalled();
    expect(mockCreateHumanFoodRequestScope).toHaveBeenCalledTimes(1);
    expect(mockScopeResolve).toHaveBeenCalledTimes(1);
    expect(mockScopeComplete).toHaveBeenCalledTimes(1);
    expect(mockScopeRelease).toHaveBeenCalledTimes(1);
    expect(enforceSafetyProfile).toHaveBeenCalledTimes(1);
    expect(enforceSafetyProfile).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Object),
      "beverage-creator",
      expect.objectContaining({ overrideToken: "safety-override-token" }),
    );
  });

  test.each([
    ["single", 1, "1 drink"],
    ["two", 2, "2 drinks"],
    ["pitcher", 5, "Pitcher (4–6 drinks)"],
    ["party", 10, "Party Batch (8–12 drinks)"],
  ])("keeps per-serving and total nutrition scaling for %s servings", async (servingSize, count, label) => {
    mockChoiceResponses.push(
      (_prompt: string, servings: number, servingLabel: string) => makeCandidate("Lime Mint Cooler", ["lime juice", "mint"], servings, servingLabel),
      (_prompt: string, servings: number, servingLabel: string) => makeCandidate("Ginger Citrus Fizz", ["ginger", "orange juice"], servings, servingLabel),
      (_prompt: string, servings: number, servingLabel: string) => makeCandidate("Berry Soda Cooler", ["berry juice", "soda water"], servings, servingLabel),
    );

    const response = await postBeverage({ choiceCount: 3, servingSize });

    expect(response.status).toBe(200);
    expect(response.body.choices).toHaveLength(3);
    for (const choice of response.body.choices) {
      expect(choice.servings).toBe(count);
      expect(choice.servingSize).toBe(label);
      for (const key of ["calories", "protein", "carbs", "starchyCarbs", "fat"]) {
        expect(choice.nutrition[key]).toBe(choice.perServingNutrition[key] * count);
      }
    }
  });

  test("filters renamed duplicates by ingredient identity and returns the distinct survivors", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("Mint Lime Cooler", ["lime juice", "mint", "soda water"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Fresh Lime & Mint Fizz", ["mint", "soda water", "lime juice"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Pineapple Ginger Fizz", ["pineapple juice", "ginger", "soda water"], count, label),
    );

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(200);
    expect(response.body.choices).toHaveLength(2);
    expect(response.body.choiceNotice).toContain("Only 2 distinct beverages");
    expect(response.body.choices.map((choice: any) => choice.name)).toEqual([
      "Mint Lime Cooler",
      "Pineapple Ginger Fizz",
    ]);
  });

  test("incidental stirring and citrus garnishes do not make renamed copies distinct", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => ({
        ...makeCandidate("Mint Lime Cooler", ["lime juice", "mint", "soda water"], count, label),
        instructions: "Shake with ice and serve.",
      }),
      (_prompt: string, count: number, label: string) => ({
        ...makeCandidate("Fresh Mint Cooler", ["lime juice", "mint", "soda water", "lime wedge"], count, label),
        instructions: "Shake with ice, stir before serving, and add the lime wedge.",
      }),
      (_prompt: string, count: number, label: string) => ({
        ...makeCandidate("Lime Mint Sparkler", ["lime juice", "mint", "soda water", "lemon twist"], count, label),
        instructions: "Shake with ice, stir, and serve with the lemon twist.",
      }),
    );
    const response = await postBeverage({ choiceCount: 3 });
    expect(response.status).toBe(200);
    expect(response.body.choices).toHaveLength(1);
    expect(response.body.choices[0].name).toBe("Mint Lime Cooler");
    expect(response.body.choiceNotice).toContain("Only 1 distinct beverage");
  });

  test("returns one surviving choice after other candidates fail", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("Citrus Mint Cooler", ["lime juice", "mint"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Unsafe Rum Splash", ["lime juice", "mint"], count, label, "Add rum, then shake."),
      (_prompt: string, count: number, label: string) => makeCandidate("Unsafe Vodka Cooler", ["lime juice", "mint"], count, label, "Finish with vodka."),
    );

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(200);
    expect(response.body.choices).toHaveLength(1);
    expect(response.body.choiceNotice).toContain("Only 1 distinct beverage");
  });

  test("protects total rejection, including alcohol mentioned only in instructions", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("Citrus Cooler", ["lime juice", "mint"], count, label, "Add one shot of rum, then shake."),
      (_prompt: string, count: number, label: string) => makeCandidate("Mint Fizz", ["lime juice", "mint"], count, label, "Float vodka on top."),
      (_prompt: string, count: number, label: string) => makeCandidate("Lime Soda", ["lime juice", "mint"], count, label, "Stir in whiskey before serving."),
    );

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("PROTOCOL_VIOLATION");
    expect(response.body.alternatives).toBeUndefined();
    expect(response.body.choices).toBeUndefined();
    expect(mockScanGeneratedOutput).toHaveBeenCalled();
    expect(
      mockScanGeneratedOutput.mock.calls.some(([candidate]) =>
        !/rum|vodka|tequila|whiskey|alcohol/i.test(
          candidate.ingredients.map((ingredient: any) => ingredient.name).join(" "),
        ) && /rum|vodka|tequila|whiskey|alcohol/i.test(candidate.instructions),
      ),
    ).toBe(true);
  });

  test.each([
    ["default", {}],
    ["choiceCount 1", { choiceCount: 1 }],
  ])("%s retains the original single-beverage response shape", async (_label, extraBody) => {
    mockDefaultResponse = (_prompt: string, count: number, label: string) =>
      makeCandidate("Single Citrus Cooler", ["lime juice", "mint"], count, label);

    const response = await postBeverage(extraBody);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Single Citrus Cooler");
    expect(response.body.choices).toBeUndefined();
    expect(response.body.requestedChoiceCount).toBeUndefined();
  });

  test("uses the repaired and transformed accepted recipe for the final image", async () => {
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => ({
        ...makeCandidate("Needs Repair Citrus Draft", ["lime juice", "mint"], count, label),
        needsFinalRepair: true,
      }),
      (_prompt: string, count: number, label: string) => makeCandidate("Ginger Orange Fizz", ["ginger", "orange juice"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Berry Soda Cooler", ["berry juice", "soda water"], count, label),
    );
    mockRepairResponse = (_prompt: string, count: number, label: string) =>
      makeCandidate("Repaired Citrus Choice", ["lime juice", "mint"], count, label);
    mockTransform = (candidate: any) =>
      candidate.name === "Repaired Citrus Choice"
        ? {
            ...candidate,
            name: "Final Transformed Citrus",
            ingredients: [{ name: "fresh ginger", amount: "1", unit: "oz" }, { name: "lime juice", amount: "1", unit: "oz" }],
          }
        : candidate;

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].name).toBe("Final Transformed Citrus");
    expect(generateMealImageUnified).toHaveBeenCalledWith(
      "Final Transformed Citrus",
      ["fresh ginger", "lime juice"],
      "beverage",
    );
    expect(mockCapturedPrompts.some((prompt) => prompt.includes("Repair this rejected beverage"))).toBe(true);
  });

  test("enforces patient-specific GLP-1 targets instead of accepting prompt-only compliance", async () => {
    mockGlp1Active = true;
    mockGlp1Valid = false;
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("GLP-1 Citrus Cooler", ["lime juice", "mint"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("GLP-1 Ginger Fizz", ["ginger", "orange juice"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("GLP-1 Berry Cooler", ["berry juice", "soda water"], count, label),
    );

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("PROTOCOL_VIOLATION");
    expect(mockResolveGLP1GlobalContext).toHaveBeenCalledTimes(1);
    expect(validateMealForDiet).toHaveBeenCalled();
    expect(mockCapturedPrompts[0]).toContain("GLP-1 PATIENT-SPECIFIC BEVERAGE TARGETS");
  });

  test("rejects a candidate that conflicts with active liquid-nutrition instructions", async () => {
    const { getCurrentLiquidNutritionProtocol } = await import("../services/hydration/liquidNutritionProtocolService");
    const liquidProtocol = { status: "active", handoffAllowed: true };
    (getCurrentLiquidNutritionProtocol as jest.Mock).mockResolvedValue(liquidProtocol);
    mockLiquidValidation = (candidate) => !candidate.ingredients.some((item: any) => item.name === "added sugar");
    mockChoiceResponses.push(
      (_prompt: string, count: number, label: string) => makeCandidate("Sweet Citrus Cooler", ["lime juice", "added sugar"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Sweet Ginger Fizz", ["ginger", "added sugar"], count, label),
      (_prompt: string, count: number, label: string) => makeCandidate("Sweet Berry Cooler", ["berry juice", "added sugar"], count, label),
    );

    const response = await postBeverage({ choiceCount: 3 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("LIQUID_NUTRITION_CONFLICT");
    expect(validateLiquidNutritionOutput).toHaveBeenCalled();
  });
});