import express from "express";
import request from "supertest";

const mockPairings: any[] = [];
const mockScanGeneratedOutput = jest.fn();
const mockGeneratePairingImages = jest.fn();
const mockChatJson = jest.fn();
const mockEnvelope = {
  userId: "pairings-test-user",
  dietaryIdentity: ["halal"],
  allergies: [],
  medicalHardLimits: [],
  medicalOptimization: [],
  avoidances: [],
  preferences: [],
  procedural: {},
  cuisinePreference: null,
  cuisineIntensity: null,
  diabeticGuidance: null,
  hasDiabetes: false,
  diabeticGlucoseState: null,
  conditionGuidanceBlocks: [],
  glp1DailyTolerance: null,
  thyroidSupport: false,
  thyroidMedication: null,
  thyroidType: null,
  hormoneOptimization: false,
  measurementSystem: "imperial",
  fitnessGoal: null,
  goalType: null,
  goalTarget: null,
  pregnancySupport: false,
  pregnancySupportContext: null,
  carbCycleContext: null,
  performanceNutrition: false,
  performanceContext: null,
  performanceLayer: null,
  dailyNutritionState: null,
  performanceOverlay: "standard",
  performanceControlMode: "self_guided",
  therapeuticSupport: false,
  therapeuticSupportContext: null,
  selectedMealBuilder: null,
  preferredLanguage: null,
  flavorPreference: null,
  heatPreference: null,
  palateSpiceTolerance: null,
  palateSeasoningIntensity: null,
  palateFlavorStyle: null,
  providerInterventions: [],
  interventionPatientSummary: [],
};

jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: jest.fn().mockResolvedValue({ result: "SAFE" }),
}));

jest.mock("../services/pairings/profileContext", () => ({
  loadPairingsProfile: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/pairings/pairingsPersonalization", () => ({
  buildPairingsConstraints: jest.fn().mockReturnValue({ fullConstraintBlock: "" }),
}));

jest.mock("../services/pairings/pairingsImageService", () => ({
  generatePairingImages: (...args: any[]) => mockGeneratePairingImages(...args),
}));

jest.mock("../utils/openaiSafe", () => ({
  chatJson: (...args: any[]) => mockChatJson(...args),
}));

jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue(mockEnvelope),
  enforceBeforeGenerate: jest.fn(() => ({
    combined: "ACTIVE HALAL PROTOCOL: alcoholic beverages are forbidden.",
  })),
  buildGuestEnvelope: jest.fn(),
  scanGeneratedOutput: (...args: any[]) => mockScanGeneratedOutput(...args),
}));

jest.mock("../vite", () => ({ log: jest.fn() }));

const compliantPairing = {
  category: "non-alcoholic",
  name: "Sparkling water",
  explanation: "Its crisp bubbles refresh the palate.",
  alternatives: ["Mineral water"],
  servingTips: "Serve chilled.",
};

const prohibitedPairing = {
  category: "spirits",
  name: "Whiskey",
  explanation: "A distilled alcoholic drink.",
  alternatives: ["Bourbon"],
  servingTips: "Serve neat.",
};

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.authUser = { id: "pairings-test-user" };
    next();
  });
  const router = (await import("../routes/ai-pairings")).default;
  app.use("/api/ai-pairings", router);
  return app;
}

describe("POST /api/ai-pairings protocol output safety", () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    mockPairings.splice(0, mockPairings.length);
    mockEnvelope.allergies.length = 0;
    mockScanGeneratedOutput.mockReset().mockImplementation((output, envelope) => {
      const scannedText = [
        output.name,
        output.description,
        ...(output.ingredients || []),
      ].join(" ");
      const forbiddenAlcohol = envelope.dietaryIdentity.includes("halal")
        && /\b(whiskey|bourbon|alcoholic drink|wine|beer|spirits?)\b/i.test(scannedText);
      return {
        passed: !forbiddenAlcohol,
        violations: forbiddenAlcohol ? [{ term: "alcohol", reason: "Forbidden by active halal protocol" }] : [],
        instructionViolations: [],
        message: forbiddenAlcohol ? "Alcohol conflicts with the active halal protocol." : "No violations.",
      };
    });
    mockGeneratePairingImages.mockReset().mockResolvedValue(new Map());
    mockChatJson.mockReset().mockImplementation(async () => ({ pairings: [...mockPairings] }));
  });

  it("includes the active protocol in the provider prompt and never serves a blocked recommendation", async () => {
    mockPairings.push(prohibitedPairing, compliantPairing);

    const res = await request(app)
      .post("/api/ai-pairings")
      .send({ mode: "pairing", category: "both", input: "grilled vegetables" });

    expect(res.status).toBe(200);
    expect(mockChatJson).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.stringContaining("ACTIVE HALAL PROTOCOL"),
    }));
    expect(mockScanGeneratedOutput).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Whiskey" }),
      mockEnvelope,
      { generatorName: "pairings_ai" },
    );
    expect(res.body.pairings.map((item: any) => item.name)).toEqual(["Sparkling water"]);
    expect(res.body.compositionEvidence).toBe("unverified");
    expect(res.body.compositionNote).toMatch(/not been verified/i);
    expect(JSON.stringify(res.body)).not.toMatch(/whiskey|bourbon/i);
    expect(mockGeneratePairingImages).toHaveBeenCalledWith(
      [{ name: "Sparkling water", category: "non-alcoholic" }],
      "grilled vegetables",
    );
  });

  it("fails closed when every schema-valid recommendation violates the active protocol", async () => {
    mockPairings.push(prohibitedPairing);

    const res = await request(app)
      .post("/api/ai-pairings")
      .send({ mode: "pairing", category: "both", input: "grilled vegetables" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "AI returned no valid pairings" });
    expect(mockGeneratePairingImages).not.toHaveBeenCalled();
  });

  it("does not certify a brand-only pairing for an allergy profile", async () => {
    mockEnvelope.allergies.push("milk");
    const res = await request(app)
      .post("/api/ai-pairings")
      .send({ mode: "pairing", category: "both", input: "grilled vegetables" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/verified pairing ingredients are unavailable/i);
    expect(mockChatJson).not.toHaveBeenCalled();
  });

  it("does not fall back to a guest protocol when the authenticated envelope is unavailable", async () => {
    const { loadUserProtocolEnvelope } = await import("../services/protocolEnvelope");
    (loadUserProtocolEnvelope as jest.Mock).mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/ai-pairings")
      .send({ mode: "pairing", category: "both", input: "grilled vegetables" });
    expect(res.status).toBe(503);
    expect(mockChatJson).not.toHaveBeenCalled();
  });
});