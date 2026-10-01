/**
 * Regression coverage for the canonical medical-condition projection. The
 * medicalConditions column is selected independently from healthConditions;
 * only GLP-1 medication keys are promoted into the guidance-layer conditions.
 */
const selectedUser = {
  id: "protocol-user",
  dietaryRestrictions: [],
  allergies: [],
  healthConditions: ["hypertension"],
  medicalConditions: ["glp1", "diabetes-type2"],
  dislikedFoods: [],
  avoidedFoods: [],
  likedFoods: [],
  preferredSweeteners: [],
  avoidSweeteners: [],
  sweetenerPreferences: [],
  cuisinePreference: null,
  cuisineIntensity: null,
  specialtyConditions: [] as string[],
  specialtyCondition: null,
  activeHouseholdProfileId: null,
  selectedMealBuilder: null as string | null,
  alphaGalProfile: null as Record<string, unknown> | null,
  pregnancyStage: null as string | null,
  pregnancyDueDate: null as string | null,
  pregnancySupportContext: null as Record<string, unknown> | null,
  oncologySupportContext: null,
  thyroidMedication: null,
  performanceOverlay: null,
  performanceControlMode: null,
  carbCycleState: null,
  performanceContext: null,
  weeklyTrainingSchedule: null,
  performanceProtocolConfig: null,
  timezone: "UTC",
  measurementSystem: "imperial",
};
const mockPersonalSupports = jest.fn(async () => new Set<string>());
const mockQuery = jest.fn(async () => ({ rows: [] }));
const mockTolerance = jest.fn(async () => ({
  date: "2026-09-26", safetyEscalations: [], nutritionAdaptations: [],
}));
const mockDiabeticContext = jest.fn(async () => ({ latestGlucose: null }));
const mockHouseholdProfile = {
  id: "household-1",
  ownerUserId: "protocol-user",
  displayName: "Household member",
  dietaryRestrictions: [],
  allergies: [],
  healthConditions: ["diabetes"],
  medicalConditions: [],
  dislikedFoods: [],
  avoidedFoods: [],
  likedFoods: [],
  preferredSweeteners: [],
};
let mockUserMissing = false;
let mockUserLoadFailure = false;
let mockSelectCalls = 0;
jest.mock("../services/healthProtocols/developmentFoodSupports", () => ({
  readDevelopmentPersonalFoodSupports: (...args: unknown[]) => mockPersonalSupports(...args),
}));

jest.mock("../db", () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
  db: {
    select: () => {
      mockSelectCalls++;
      return ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            if (mockUserLoadFailure) throw new Error("Database unavailable");
            const tableName = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
            if (tableName === "household_profiles") return [mockHouseholdProfile];
            return mockUserMissing ? [] : [selectedUser];
          },
        }),
      }),
    });
    },
  },
}));

jest.mock("../services/diabeticContextService", () => ({
  getDiabeticContext: (...args: unknown[]) => mockDiabeticContext(...args),
  getGlucoseBasedMealGuidance: jest.fn(() => null),
}));
jest.mock("../services/glp1/resolveDailyMedicationTolerance", () => ({
  resolveDailyMedicationTolerance: (...args: unknown[]) => mockTolerance(...args),
}));

import { buildGuestEnvelope, enforceBeforeGenerate, loadUserProtocolEnvelope, loadGenerationProtocolEnvelope, ProtocolContextUnavailableError, scanGeneratedOutput } from "../services/protocolEnvelope";

describe("protocol envelope medicalConditions projection", () => {
  it("reserves guest authority for genuinely anonymous generation", async () => {
    mockSelectCalls = 0;
    expect((await loadGenerationProtocolEnvelope(null)).userId).toBe("guest");
    expect(mockSelectCalls).toBe(0);
  });
  it("uses the authenticated envelope and does not erase known allergies", async () => {
    selectedUser.allergies = ["peanut"];
    try {
      const envelope = await loadGenerationProtocolEnvelope("protocol-user");
      expect(envelope.userId).toBe("protocol-user");
      expect(envelope.allergies).toContain("peanut");
    } finally { selectedUser.allergies = []; }
  });
  it.each(["missing", "database failure"])("fails closed on authenticated %s", async (scenario) => {
    mockUserMissing = scenario === "missing";
    mockUserLoadFailure = scenario === "database failure";
    try {
      await expect(loadGenerationProtocolEnvelope("protocol-user")).rejects.toBeInstanceOf(ProtocolContextUnavailableError);
      await expect(loadGenerationProtocolEnvelope("protocol-user")).rejects.toMatchObject({
        status: 503, code: "PROTOCOL_CONTEXT_UNRESOLVED",
      });
    } finally { mockUserMissing = false; mockUserLoadFailure = false; }
  });
  it("does not generate when required diabetes or GLP-1 tolerance reads fail", async () => {
    selectedUser.healthConditions = ["diabetes"];
    mockDiabeticContext.mockRejectedValueOnce(new Error("glucose unavailable"));
    expect(await loadUserProtocolEnvelope("protocol-user")).toBeNull();
    await expect(loadGenerationProtocolEnvelope("protocol-user")).resolves.toMatchObject({
      userId: "protocol-user",
    });
    selectedUser.healthConditions = [];
    mockTolerance.mockRejectedValueOnce(new Error("tolerance unavailable"));
    await expect(loadGenerationProtocolEnvelope("protocol-user")).rejects.toBeInstanceOf(ProtocolContextUnavailableError);
  });
  it("keeps household diabetic guidance qualitative and does not read the owner's glucose", async () => {
    selectedUser.activeHouseholdProfileId = "household-1";
    selectedUser.healthConditions = [];
    mockDiabeticContext.mockClear();

    const envelope = await loadUserProtocolEnvelope("protocol-user", "household-1");

    expect(envelope?.hasDiabetes).toBe(true);
    expect(envelope?.diabeticGlucoseState).toBeNull();
    expect(envelope?.diabeticGuidance).toBeNull();
    expect(mockDiabeticContext).not.toHaveBeenCalled();
  });
  it("uses an explicitly authorized personal subject despite an active household profile", async () => {
    selectedUser.activeHouseholdProfileId = "household-1";
    selectedUser.healthConditions = ["diabetes"];
    mockHouseholdProfile.healthConditions = [];
    mockDiabeticContext.mockClear();

    const envelope = await loadUserProtocolEnvelope(
      "protocol-user",
      undefined,
      { personalSubject: true },
    );

    expect(envelope?.hasDiabetes).toBe(true);
    expect(mockDiabeticContext).toHaveBeenCalledWith("protocol-user");
  });
  it("does not promote ambiguous legacy GLP-1 into an Anti-Inflammatory envelope in Development", async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    selectedUser.medicalConditions = ["glp1"];
    selectedUser.specialtyConditions = [];
    selectedUser.healthConditions = [];
    selectedUser.selectedMealBuilder = "anti_inflammatory";
    try {
      const envelope = await loadUserProtocolEnvelope("protocol-user");
      expect(envelope?.selectedMealBuilder).toBe("anti_inflammatory");
      expect(JSON.stringify(envelope?.conditionGuidanceBlocks ?? [])).not.toMatch(/GLP-1 MEDICATION PROTOCOL/i);
      expect(mockQuery).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
  it("does not add saved personal anti-inflammatory guidance while frozen, but preserves Builder guidance", async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    selectedUser.medicalConditions = [];
    selectedUser.healthConditions = [];
    selectedUser.specialtyConditions = [];
    selectedUser.selectedMealBuilder = null;
    mockPersonalSupports.mockImplementation(() =>
      jest.requireActual("../services/healthProtocols/developmentFoodSupports")
        .readDevelopmentPersonalFoodSupports("protocol-user"));
    try {
      const standard = await loadUserProtocolEnvelope("protocol-user");
      expect((standard?.conditionGuidanceBlocks ?? []).join("\n")).not.toMatch(/ANTI-INFLAMMATORY/i);
      selectedUser.selectedMealBuilder = "anti_inflammatory";
      const builder = await loadUserProtocolEnvelope("protocol-user");
      expect(builder?.selectedMealBuilder).toBe("anti_inflammatory");
      // Builder guidance comes from the established diet guardrails, not a personal envelope block.
      const { getSystemPromptForDiet } = jest.requireActual("../services/guardrails");
      expect(getSystemPromptForDiet("anti-inflammatory"))
        .toMatch(/ANTI-INFLAMMATORY/i);
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
  it("blocks an obvious animal ingredient under vegan identity, not just hidden derivatives", () => {
    const envelope = buildGuestEnvelope();
    envelope.dietaryIdentity = ["vegan"];
    expect(scanGeneratedOutput({ name: "Lunch", ingredients: ["chicken breast"] }, envelope).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Lunch", ingredients: ["lentils", "carrots"] }, envelope).passed).toBe(true);
  });

  it.each([
    { diet: "vegetarian", blocked: "chicken breast", allowed: "eggs" },
    { diet: "pescatarian", blocked: "beef steak", allowed: "salmon" },
  ])("rejects direct $diet conflicts without blocking its allowed foods", ({ diet, blocked, allowed }) => {
    const envelope = buildGuestEnvelope();
    envelope.dietaryIdentity = [diet];
    expect(scanGeneratedOutput({ name: "Lunch", ingredients: [blocked] }, envelope).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Lunch", ingredients: [allowed] }, envelope).passed).toBe(true);
  });
  afterEach(() => {
    selectedUser.medicalConditions = ["glp1", "diabetes-type2"];
    selectedUser.healthConditions = ["hypertension"];
    selectedUser.activeHouseholdProfileId = null;
    selectedUser.selectedMealBuilder = null;
    mockHouseholdProfile.healthConditions = ["diabetes"];
    selectedUser.specialtyConditions = [];
    selectedUser.alphaGalProfile = null;
    selectedUser.pregnancyStage = null;
    selectedUser.pregnancySupportContext = null;
    mockPersonalSupports.mockReset();
    mockPersonalSupports.mockResolvedValue(new Set());
    mockTolerance.mockClear();
    mockDiabeticContext.mockClear();
  });
  it("promotes GLP-1 medication keys but keeps non-GLP-1 routing flags out", async () => {
    const envelope = await loadUserProtocolEnvelope("protocol-user");

    expect(envelope).not.toBeNull();
    const guidanceText = JSON.stringify(envelope?.conditionGuidanceBlocks);
    expect(guidanceText).toMatch(/GLP-1 MEDICATION PROTOCOL/i);
    expect(guidanceText).not.toMatch(/diabetes-type2/);
  });

  it("adds explicitly active personal anti-inflammatory and GLP-1 guidance once without changing the builder", async () => {
    selectedUser.medicalConditions = [];
    mockPersonalSupports.mockResolvedValue(new Set(["anti_inflammatory", "glp1"]));
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    const guidance = (envelope?.conditionGuidanceBlocks ?? []).join("\n");
    expect(guidance).toMatch(/ANTI-INFLAMMATORY/i);
    expect(guidance).toMatch(/GLP-1 NUTRITION SUPPORT/i);
    expect(guidance).not.toMatch(/user is on semaglutide|GLP-1 side effects/i);
    expect((guidance.match(/GLP-1 NUTRITION SUPPORT/g) ?? [])).toHaveLength(1);
    const actualPrompt = enforceBeforeGenerate(envelope!, { generatorName: "phase2c_test_creator" }).combined;
    expect(actualPrompt).toMatch(/ANTI-INFLAMMATORY/i);
    expect(actualPrompt).toMatch(/GLP-1 NUTRITION SUPPORT/i);
    expect(actualPrompt).not.toMatch(/user is on semaglutide|GLP-1 side effects/i);
    expect(envelope?.selectedMealBuilder).toBeNull();
    expect(mockPersonalSupports).toHaveBeenCalledWith("protocol-user");
  });

  it("does not duplicate GLP-1 guidance when a legacy source is also active", async () => {
    mockPersonalSupports.mockResolvedValue(new Set(["glp1"]));
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    expect((envelope?.conditionGuidanceBlocks ?? []).join("\n").match(/GLP-1 MEDICATION PROTOCOL/g)).toHaveLength(1);
  });
  it("does not add personal GLP-1 medication claims when support is off", async () => {
    selectedUser.medicalConditions = [];
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    const prompt = enforceBeforeGenerate(envelope!, { generatorName: "phase2c_test_creator" }).combined;
    expect(prompt).not.toMatch(/GLP-1 MEDICATION PROTOCOL|GLP-1 NUTRITION SUPPORT/i);
  });

  it("carries active cardiac and renal guidance into the generation prompt", async () => {
    selectedUser.medicalConditions = [];
    selectedUser.healthConditions = ["kidney disease", "heart disease"];
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    const prompt = enforceBeforeGenerate(envelope!, { generatorName: "phase2c_test_creator" }).combined;
    expect(prompt).toMatch(/kidney|renal/i);
    expect(prompt).toMatch(/cardiac|heart/i);
  });

  it("leaves native Builders to apply their own protocols instead of adding a second personal block", async () => {
    selectedUser.medicalConditions = [];
    selectedUser.selectedMealBuilder = "anti_inflammatory";
    mockPersonalSupports.mockResolvedValue(new Set(["anti_inflammatory"]));
    const anti = await loadUserProtocolEnvelope("protocol-user");
    expect((anti?.conditionGuidanceBlocks ?? []).join("\n")).not.toMatch(/ANTI-INFLAMMATORY/);
    expect(enforceBeforeGenerate(anti!, { generatorName: "phase2c_test_creator" }).combined).not.toMatch(/ANTI-INFLAMMATORY SUPPORT.*ANTI-INFLAMMATORY SUPPORT/s);
    selectedUser.selectedMealBuilder = "glp1";
    mockPersonalSupports.mockResolvedValue(new Set(["glp1"]));
    const glp1 = await loadUserProtocolEnvelope("protocol-user");
    expect((glp1?.conditionGuidanceBlocks ?? []).join("\n")).not.toMatch(/GLP-1 MEDICATION PROTOCOL/);
    expect(enforceBeforeGenerate(glp1!, { generatorName: "phase2c_test_creator" }).combined).not.toMatch(/GLP-1 MEDICATION PROTOCOL.*GLP-1 MEDICATION PROTOCOL/s);
  });

  it.each(["liver-disease", "liver-support"])("passes saved %s through to the correct meal guidance", async (condition) => {
    selectedUser.medicalConditions = [];
    selectedUser.specialtyConditions = [condition];
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    const guidance = (envelope?.conditionGuidanceBlocks ?? []).join("\n");
    expect(guidance).toMatch(/liver/i);
    if (condition === "liver-disease") expect(guidance).toMatch(/NO RAW SHELLFISH/i);
    else expect(guidance).not.toMatch(/NO RAW SHELLFISH/i);
    const prompt = enforceBeforeGenerate(envelope!, { generatorName: "phase2c_test_creator" }).combined;
    expect(prompt).toMatch(/liver/i);
    if (condition === "liver-disease") expect(prompt).toMatch(/NO RAW SHELLFISH/i);
    else expect(prompt).not.toMatch(/NO RAW SHELLFISH/i);
  });

  it("passes a saved Alpha-gal allergy and completed profile into hard-limit meal guidance", async () => {
    selectedUser.medicalConditions = [];
    selectedUser.specialtyConditions = ["alpha-gal-syndrome"];
    selectedUser.alphaGalProfile = {
      profileComplete: true, dairyTolerance: "no", gelatinRestriction: "yes",
      severeReactionHistory: "no", diagnosisStatus: "diagnosed",
    };
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    expect((envelope?.conditionGuidanceBlocks ?? []).join("\n")).toMatch(/ALPHA-GAL SYNDROME/i);
    expect(envelope?.alphaGalContext?.dairyTolerance).toBe("no");
    expect(scanGeneratedOutput({ name: "Beef dinner", ingredients: ["beef", "roasted carrots"] }, envelope!).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Gelatin dessert", ingredients: ["gelatin", "berries"] }, envelope!).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Cream sauce", ingredients: ["cream", "rice"] }, envelope!).passed).toBe(false);
  });

  it("passes a saved pregnancy stage and selection into meal guidance", async () => {
    selectedUser.medicalConditions = [];
    selectedUser.specialtyConditions = ["pregnancy-support"];
    selectedUser.pregnancyStage = "trimester-1";
    selectedUser.pregnancySupportContext = { symptoms: [], trackingMode: "manual", isBreastfeeding: false };
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    expect((envelope?.conditionGuidanceBlocks ?? []).join("\n")).toMatch(/PREGNANCY/i);
    expect(scanGeneratedOutput({ name: "Raw tuna plate", ingredients: ["raw tuna", "rice"] }, envelope!).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Unnamed food" }, envelope!).passed).toBe(false);
  });

  it("rejects known thyroid hard violations through the common post-generation scan", async () => {
    selectedUser.medicalConditions = [];
    selectedUser.specialtyConditions = ["thyroid-support"];
    const envelope = await loadUserProtocolEnvelope("protocol-user");
    expect(scanGeneratedOutput({ name: "Thyroid cleanse", ingredients: ["kelp powder", "rice"] }, envelope!).passed).toBe(false);
    expect(scanGeneratedOutput({ name: "Salmon rice", ingredients: ["salmon", "rice"] }, envelope!).passed).toBe(true);
  });
});