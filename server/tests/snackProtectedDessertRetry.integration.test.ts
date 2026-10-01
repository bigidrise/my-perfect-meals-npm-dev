const mockCreate = jest.fn();
const capturedMessages: Array<Array<{ role: string; content: string }>> = [];
const mockScanGeneratedOutput = jest.fn();
const mockLoadGenerationProtocolEnvelope = jest.fn();
let resolveHubCouplingSpy: jest.SpyInstance;
let validateMealForHubSpy: jest.SpyInstance;

jest.mock("../db", () => {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{
      id: "patient", allergies: [], dietaryRestrictions: ["diabetic"],
      healthConditions: [], dislikedFoods: [], avoidedFoods: [],
    }]),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) } };
});

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(),
  loadGenerationProtocolEnvelope: (...args: unknown[]) => mockLoadGenerationProtocolEnvelope(...args),
  enforceBeforeGenerate: jest.fn((envelope: any) => ({
    combined: [
      "HARD SAFETY: exclude peanuts and follow the supplied protocol.",
      envelope?.diabeticGuidance,
    ].filter(Boolean).join("\n"),
  })),
  scanGeneratedOutput: (...args: unknown[]) => mockScanGeneratedOutput(...args),
  filterMealsByProtocol: jest.fn().mockImplementation((meals: unknown[]) => meals),
  buildGuestEnvelope: jest.fn().mockReturnValue({
    dietaryIdentity: [],
    allergies: [],
    avoidances: [],
  }),
  deriveProcedureRules: jest.fn().mockReturnValue([]),
}));

jest.mock("../storage", () => ({ storage: {} }));

import { generateMealUnified } from "../services/unifiedMealPipeline";
import {
  buildDiabetesGenerationAttempt,
  type DiabetesGenerationAttempt,
} from "../services/diabetesGenerationSnapshot";
import { resolveGlucoseState } from "../services/glucoseStateResolver";
import * as hubCoupling from "../services/hubCoupling";
import { diabeticHubModule } from "../services/hubCoupling/hubModules/diabetic";

const SAFE_ENVELOPE = {
  dietaryIdentity: [],
  allergies: ["peanut"],
  avoidances: [],
  procedural: [],
  specialty: null,
  dailyNutritionState: null,
  alphaGalContext: null,
} as any;

const AUTHORITATIVE_CONTEXT = [
  "MY PERFECT MENU SELECTED CONCEPT",
  "Title: Strawberry Cheesecake",
  "Food identity: dessert / sweet / cheesecake / chilled / creamy",
  "HUMAN FOOD CONTEXT v1",
  "Hard allergy exclusions: peanut",
  "Preferred sweeteners: maple syrup",
].join("\n");

function snackResponse(name: string, description: string) {
  return JSON.stringify({
    name,
    description,
    ingredients: [
      { name: "strawberries", quantity: "1/2", unit: "cup" },
      { name: "cream cheese", quantity: "4", unit: "oz" },
      { name: "maple syrup", quantity: "1", unit: "tbsp" },
    ],
    instructions: "1. Mix the filling. 2. Chill until set. 3. Serve.",
    calories: 320,
    protein: 8,
    starchyCarbs: 12,
    fibrousCarbs: 3,
    fat: 21,
    cookingTime: "35 minutes",
    difficulty: "Easy",
  });
}

function diabeticSnackResponse() {
  return JSON.stringify({
    name: "Greek Yogurt Berry Cup",
    description: "Plain Greek yogurt topped with blueberries and chia seeds.",
    ingredients: [
      { name: "plain Greek yogurt", quantity: "3/4", unit: "cup" },
      { name: "blueberries", quantity: "1/4", unit: "cup" },
      { name: "chia seeds", quantity: "1", unit: "tbsp" },
    ],
    instructions: ["Spoon the yogurt into a bowl.", "Top with blueberries and chia seeds."],
    calories: 240,
    protein: 20,
    starchyCarbs: 0,
    fibrousCarbs: 6,
    fat: 8,
    cookingTime: "5 minutes",
    difficulty: "Easy",
  });
}

function chefResponse(
  name = "Chicken and Broccoli Bowl",
  starchyCarbs = 0,
  fibrousCarbs = 6,
) {
  return JSON.stringify({
    name,
    description: "A prepared chicken and broccoli bowl.",
    ingredients: [
      { name: "chicken breast", quantity: "5", unit: "oz" },
      { name: "broccoli", quantity: "1", unit: "cup" },
    ],
    instructions: ["Cook the chicken thoroughly.", "Steam the broccoli and serve."],
    calories: 320, protein: 36, starchyCarbs, fibrousCarbs, fat: 10,
    cookingTime: "20 minutes", difficulty: "Easy",
  });
}

function beverageResponse() {
  return JSON.stringify({
    name: "Berry Protein Shake",
    description: "A creamy protein shake with blueberries.",
    ingredients: [
      { name: "unsweetened Greek yogurt", amount: "3/4", unit: "cup" },
      { name: "whey protein powder", amount: "1", unit: "scoop" },
      { name: "blueberries", amount: "1/4", unit: "cup" },
    ],
    instructions: "Blend until smooth.",
    nutrition: {
      calories: 250,
      protein: 28,
      carbs: 14,
      fat: 5,
      starchyCarbs: 0,
      fibrousCarbs: 4,
    },
    reasoning: "Protein-forward and low in added sugars.",
  });
}

function queueResponses(...responses: string[]) {
  for (const content of responses) {
    mockCreate.mockImplementationOnce(async (params: any) => {
      capturedMessages.push(params.messages ?? []);
      return { choices: [{ message: { content } }] };
    });
  }
}

function diabetesAttempt(value: number): DiabetesGenerationAttempt {
  const resolvedAt = new Date("2026-10-01T21:43:00.000Z");
  const readingRecordedAt = "2026-10-01T21:42:00.000Z";
  const glucose = resolveGlucoseState({
    valueMgdl: value, context: "PRE_MEAL", recordedAt: readingRecordedAt,
  }, null, resolvedAt);
  return buildDiabetesGenerationAttempt("patient", {
    glucose,
    settings: null,
    profile: { type: "T2D", hypoHistory: false },
    readingRecordedAt,
  }, resolvedAt);
}

async function generateSelectedCheesecake() {
  return generateMealUnified({
    type: "snack-creator",
    mealType: "snack",
    input: "Strawberry Cheesecake",
    protocolEnvelope: SAFE_ENVELOPE,
    generationContext: AUTHORITATIVE_CONTEXT,
    safetyAlreadyChecked: true,
  });
}

describe("My Perfect Menu protected dessert retry boundary", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    hubCoupling.registerHub(diabeticHubModule);
    resolveHubCouplingSpy = jest.spyOn(hubCoupling, "resolveHubCoupling");
    validateMealForHubSpy = jest.spyOn(hubCoupling, "validateMealForHub");
    mockCreate.mockReset();
    mockScanGeneratedOutput.mockReset();
    mockLoadGenerationProtocolEnvelope.mockReset();
    capturedMessages.length = 0;
    mockScanGeneratedOutput.mockReturnValue({ passed: true, violations: [] });
    mockLoadGenerationProtocolEnvelope.mockImplementation(async (_userId, attempt) => ({
      ...SAFE_ENVELOPE,
      hasDiabetes: Boolean(attempt),
      diabeticGlucoseState: attempt?.context.latestGlucose?.state ?? null,
      diabeticGuidance: attempt?.context.latestGlucose
        ? `Frozen generation reading: ${attempt.context.latestGlucose.value} mg/dL`
        : null,
    }));
  });

  it("repairs an unrelated first result while preserving identity, context, and governance", async () => {
    queueResponses(
      snackResponse("Greek Yogurt Berry Cup", "A chilled yogurt cup with fresh fruit."),
      snackResponse("Strawberry Cheesecake", "A recognizable chilled cheesecake with a creamy filling."),
    );

    const result = await generateSelectedCheesecake();

    expect(result.success).toBe(true);
    expect(result.meal?.name).toContain("Cheesecake");
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const initialPrompt = capturedMessages[0].map((message) => message.content).join("\n");
    expect(initialPrompt).toContain(AUTHORITATIVE_CONTEXT);
    expect(initialPrompt).toContain("PROTECTED RECOGNIZABLE IDENTITY: cheesecake");
    expect(initialPrompt).toContain("HARD SAFETY: exclude peanuts");

    const retryPrompt = capturedMessages[1].map((message) => message.content).join("\n");
    expect(retryPrompt).toContain(AUTHORITATIVE_CONTEXT);
    expect(retryPrompt).toContain("FOOD IDENTITY VIOLATION");
    expect(retryPrompt).toContain("preserve recognizable cheesecake identity");
  });

  it("returns an explicit failure after identity retries instead of a generic fallback", async () => {
    queueResponses(
      snackResponse("Greek Yogurt Berry Cup", "A chilled yogurt cup with fresh fruit."),
      snackResponse("Cinnamon Berry Parfait", "A layered parfait with berries."),
    );

    const result = await generateSelectedCheesecake();

    expect(result).toMatchObject({
      success: false,
      source: "error",
    });
    expect(result.error).toContain("preserve the requested cheesecake identity");
    expect(result.meal).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("keeps protocol safety authoritative even when dessert identity is preserved", async () => {
    queueResponses(
      snackResponse("Strawberry Cheesecake", "A recognizable chilled cheesecake with a creamy filling."),
      snackResponse("Strawberry Cheesecake", "A recognizable chilled cheesecake with a creamy filling."),
    );
    mockScanGeneratedOutput.mockReturnValue({
      passed: false,
      message: "Allergy violation: peanut",
      violations: [{ code: "allergy", message: "peanut" }],
    });

    const result = await generateSelectedCheesecake();

    expect(result).toMatchObject({
      success: false,
      source: "error",
      error: "Allergy violation: peanut",
    });
    expect(result.meal).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockScanGeneratedOutput).toHaveBeenCalledTimes(2);
  });

  it("does not let a soft saved dessert redefine an unrelated explicit snack request", async () => {
    const contextWithSavedBrownie = [
      "HUMAN FOOD CONTEXT v1",
      "Soft Foods I Enjoy hints: brownie",
      "OPTIONAL FOOD INCLUSION PRIORITIES:",
      "- Fiber-Rich Foods: use when natural; omission is valid.",
    ].join("\n");
    queueResponses(
      snackResponse("Cinnamon Apple Slices", "Crisp apple slices with cinnamon."),
    );

    const result = await generateMealUnified({
      type: "snack-creator",
      mealType: "snack",
      input: "Cinnamon apple slices",
      protocolEnvelope: SAFE_ENVELOPE,
      generationContext: contextWithSavedBrownie,
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    const prompt = capturedMessages[0].map((message) => message.content).join("\n");
    expect(prompt).toContain(contextWithSavedBrownie);
    expect(prompt).not.toContain("PROTECTED RECOGNIZABLE IDENTITY: brownie");
  });

  it("uses the pre-frozen 100 reading rather than an older 80 for snack prompt, validation, and returned provenance", async () => {
    const older = diabetesAttempt(80);
    const frozen = diabetesAttempt(100);
    queueResponses(diabeticSnackResponse());

    const result = await generateMealUnified({
      type: "snack-creator",
      mealType: "snack",
      input: "Greek yogurt and berries",
      userId: "patient",
      dietType: "diabetic",
      diabetesAttempt: frozen,
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(mockLoadGenerationProtocolEnvelope).toHaveBeenCalledWith("patient", frozen);
    expect(resolveHubCouplingSpy).toHaveBeenCalledWith("diabetic", "patient", "snack", frozen);
    expect(resolveHubCouplingSpy.mock.calls.every((call) => call[3] === frozen)).toBe(true);
    const prompt = capturedMessages[0].map((message) => message.content).join("\n");
    expect(prompt).toContain("100 mg/dL");
    expect(prompt).not.toContain("80 mg/dL");
    expect(validateMealForHubSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Greek Yogurt Berry Cup" }),
      "diabetic",
      expect.objectContaining({
        customRules: expect.objectContaining({ glucoseState: frozen.context.latestGlucose?.state }),
      }),
    );
    expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
    expect(result.meal?.diabeticMemory).not.toEqual(older.snapshot);
  });

  it("keeps household diabetic generation qualitative without owner glucose reads or provenance", async () => {
    queueResponses(chefResponse());
    const householdEnvelope = {
      ...SAFE_ENVELOPE,
      hasDiabetes: true,
      diabeticGlucoseState: null,
      diabeticGuidance: "Follow general diabetes-aware food guidance without numeric glucose context.",
    };

    const result = await generateMealUnified({
      type: "create-with-chef",
      mealType: "lunch",
      input: "Chicken and broccoli bowl",
      userId: "owner",
      dietType: "diabetic",
      protocolEnvelope: householdEnvelope as any,
      diabetesSubjectScope: "household",
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(mockLoadGenerationProtocolEnvelope).not.toHaveBeenCalled();
    expect(resolveHubCouplingSpy).not.toHaveBeenCalled();
    expect(validateMealForHubSpy).not.toHaveBeenCalled();
    expect(result.meal?.diabeticMemory).toBeUndefined();
  });

  it("keeps authorized personal diabetic generation explicitly scoped away from the active household overlay", async () => {
    const frozen = diabetesAttempt(100);
    queueResponses(chefResponse());

    const result = await generateMealUnified({
      type: "create-with-chef",
      mealType: "lunch",
      input: "Chicken and broccoli bowl",
      userId: "patient",
      dietType: "diabetic",
      diabetesAttempt: frozen,
      diabetesSubjectScope: "personal",
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(mockLoadGenerationProtocolEnvelope).toHaveBeenCalledWith(
      "patient",
      frozen,
      { personalSubject: true },
    );
    expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
  });

  it.each(["create-with-chef", "premade"] as const)(
    "preserves the pre-frozen diabetes attempt through %s generation and final validation",
    async (type) => {
      const older = diabetesAttempt(80);
      const frozen = diabetesAttempt(100);
      queueResponses(chefResponse());

      const result = await generateMealUnified({
        type,
        mealType: "lunch",
        input: type === "premade" ? ["chicken breast", "broccoli"] : "Chicken and broccoli bowl",
        userId: "patient",
        dietType: "diabetic",
        clinicalGenerationContext: "diabetic",
        diabetesAttempt: frozen,
        safetyAlreadyChecked: true,
      });

      expect(result.success).toBe(true);
      expect(mockLoadGenerationProtocolEnvelope).toHaveBeenCalledWith("patient", frozen);
      expect(resolveHubCouplingSpy).toHaveBeenCalledWith("diabetic", "patient", "lunch", frozen);
      expect(resolveHubCouplingSpy.mock.calls.every((call) => call[3] === frozen)).toBe(true);
      const prompt = capturedMessages.map((messages) => messages.map((message) => message.content).join("\n")).join("\n");
      expect(prompt).toContain("100 mg/dL");
      expect(prompt).not.toContain("80 mg/dL");
      expect(validateMealForHubSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Chicken and Broccoli Bowl" }),
        "diabetic",
        expect.objectContaining({
          customRules: expect.objectContaining({ glucoseState: frozen.context.latestGlucose?.state }),
        }),
      );
      expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
      expect(result.meal?.diabeticMemory).not.toEqual(older.snapshot);
    },
  );

  it("keeps the same frozen context through Create With Chef's clinical retry and stamps only the accepted result", async () => {
    const frozen = diabetesAttempt(130);
    queueResponses(
      chefResponse("Chicken and Broccoli Bowl", 0, 90),
      chefResponse(),
    );

    const result = await generateMealUnified({
      type: "create-with-chef",
      mealType: "lunch",
      input: "Chicken and broccoli bowl",
      userId: "patient",
      dietType: "diabetic",
      clinicalGenerationContext: "diabetic",
      diabetesAttempt: frozen,
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(frozen.snapshot.bglBucket).toBe("elevated");
    expect(frozen.context.latestGlucose?.state).toBe("high-risk");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(capturedMessages).toHaveLength(2);
    for (const messages of capturedMessages) {
      const prompt = messages.map((message) => message.content).join("\n");
      expect(prompt).toContain("130 mg/dL");
      expect(prompt).not.toContain("80 mg/dL");
    }
    expect(resolveHubCouplingSpy.mock.calls.every((call) => call[3] === frozen)).toBe(true);
    expect(validateMealForHubSpy).toHaveBeenCalledWith(
      expect.any(Object),
      "diabetic",
      expect.objectContaining({
        customRules: expect.objectContaining({ glucoseState: "high-risk" }),
      }),
    );
    expect(result.meal?.fibrousCarbs).toBe(6);
    expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
  });

  it("keeps the frozen reading in Create With Chef's beverage prompt and validated result", async () => {
    const older = diabetesAttempt(80);
    const frozen = diabetesAttempt(100);
    queueResponses(beverageResponse());

    const result = await generateMealUnified({
      type: "create-with-chef",
      mealType: "snack",
      input: "protein shake",
      userId: "patient",
      dietType: "diabetic",
      diabetesAttempt: frozen,
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(result.meal?.mealType).toBe("beverages");
    expect(mockLoadGenerationProtocolEnvelope).toHaveBeenCalledWith("patient", frozen);
    const prompt = capturedMessages[0].map((message) => message.content).join("\n");
    expect(prompt).toContain("100 mg/dL");
    expect(prompt).not.toContain("80 mg/dL");
    expect(resolveHubCouplingSpy.mock.calls.every((call) => call[3] === frozen)).toBe(true);
    expect(validateMealForHubSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Berry Protein Shake" }),
      "diabetic",
      expect.objectContaining({
        customRules: expect.objectContaining({ glucoseState: frozen.context.latestGlucose?.state }),
      }),
    );
    expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
    expect(result.meal?.diabeticMemory).not.toEqual(older.snapshot);
  });

  it("validates a deterministic Chef fallback with the same attempt before attaching its stamp", async () => {
    const older = diabetesAttempt(80);
    const frozen = diabetesAttempt(100);
    mockCreate.mockImplementation(async (params: any) => {
      capturedMessages.push(params.messages ?? []);
      throw new Error("provider unavailable");
    });

    const result = await generateMealUnified({
      type: "create-with-chef",
      mealType: "lunch",
      input: "Chicken and broccoli bowl",
      userId: "patient",
      dietType: "diabetic",
      clinicalGenerationContext: "diabetic",
      diabetesAttempt: frozen,
      safetyAlreadyChecked: true,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("fallback");
    expect(mockLoadGenerationProtocolEnvelope).toHaveBeenCalledWith("patient", frozen);
    expect(resolveHubCouplingSpy.mock.calls.every((call) => call[3] === frozen)).toBe(true);
    expect(validateMealForHubSpy).toHaveBeenCalledWith(
      expect.any(Object),
      "diabetic",
      expect.objectContaining({
        customRules: expect.objectContaining({ glucoseState: frozen.context.latestGlucose?.state }),
      }),
    );
    expect(result.meal?.diabeticMemory).toEqual(frozen.snapshot);
    expect(result.meal?.diabeticMemory).not.toEqual(older.snapshot);
  });
});