const mockCreate = jest.fn();
const capturedMessages: Array<Array<{ role: string; content: string }>> = [];
const mockScanGeneratedOutput = jest.fn();

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/hubCoupling", () => ({
  ensureHubsRegistered: jest.fn().mockResolvedValue(undefined),
  isValidHubType: jest.fn().mockReturnValue(false),
  detectHubTypeFromProfile: jest.fn().mockResolvedValue(null),
  resolveHubCoupling: jest.fn().mockResolvedValue(null),
  validateMealForHub: jest.fn(),
  hasHardViolations: jest.fn().mockReturnValue(false),
  getRegenerationHint: jest.fn(),
}));

jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(),
  enforceBeforeGenerate: jest.fn().mockReturnValue({
    combined: "HARD SAFETY: exclude peanuts and follow the supplied protocol.",
  }),
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

function queueResponses(...responses: string[]) {
  for (const content of responses) {
    mockCreate.mockImplementationOnce(async (params: any) => {
      capturedMessages.push(params.messages ?? []);
      return { choices: [{ message: { content } }] };
    });
  }
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
    mockCreate.mockReset();
    mockScanGeneratedOutput.mockReset();
    capturedMessages.length = 0;
    mockScanGeneratedOutput.mockReturnValue({ passed: true, violations: [] });
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
});