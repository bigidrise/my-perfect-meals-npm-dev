import express from "express";
import request from "supertest";
import { emptyMyPerfectMenuPreferences } from "@shared/myPerfectMenu";

const actorId = "00000000-0000-4000-8000-000000000001";
const path = "/api/my-perfect-menu/development/dessert-test";
const body = { ideaType: "snack", snackType: "dessert" };
let mockAuthenticated = true;
let mockDb: any, mockPool: any, mockClient: any, mockPersisted: any;
const mockGenerate = jest.fn();
const mockHumanValidation = jest.fn();
const mockDietValidation = jest.fn();
const mockProtocolScan = jest.fn();
const mockResolveBuilder = jest.fn();
const mockResolveContext = jest.fn();
const mockComplete = jest.fn(), mockRelease = jest.fn(), mockAuth = jest.fn();
const mockClaim = jest.fn();
const mockContext = {
  status: "resolved", notices: [], authorization: { status: "authorized" },
  diet: { effective: ["vegan"] },
  flavor: { cuisine: { available: false, value: null } },
};

jest.mock("../db", () => ({
  get db() { return mockDb; }, get pool() { return mockPool; },
}));
jest.mock("../services/myPerfectMenu/developmentNoSave", () => ({
  ...jest.requireActual("../services/myPerfectMenu/developmentNoSave"),
  createDevelopmentDessertTestClaim: () => () => mockClaim(),
}));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    mockAuth();
    if (!mockAuthenticated) return res.sendStatus(401);
    req.authUser = { id: actorId, role: "client" };
    next();
  },
}));
jest.mock("../utils/openaiSafe", () => ({ chatJson: (...args: any[]) => mockGenerate(...args) }));
jest.mock("../services/myPerfectMenu/builderResolver", () => ({
  resolveMyPerfectMenuBuilderForActor: (...args: any[]) => mockResolveBuilder(...args),
  MyPerfectMenuBuilderError: class extends Error {},
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: () => ({
    resolve: () => mockResolveContext(), executionState: {},
    completeAuthorization: mockComplete, releaseAuthorization: mockRelease,
  }),
}));
jest.mock("../services/humanFoodContext/adapters", () => ({
  buildCreatorHumanFoodPrompt: () => "Synthetic authoritative context",
}));
jest.mock("../services/humanFoodContext/validateHumanFoodResult", () => ({
  validateHumanFoodResult: (...args: any[]) => mockHumanValidation(...args),
}));
jest.mock("../services/guardrails/validators/dietaryRestrictionValidator", () => ({
  validateDietaryRestriction: (...args: any[]) => mockDietValidation(...args),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: async () => ({}),
  enforceBeforeGenerate: () => ({ combined: "Synthetic protocol authority" }),
  scanGeneratedOutput: (...args: any[]) => mockProtocolScan(...args),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: async () => ({}),
  buildGLP1RecommendationBlock: () => "",
}));
jest.mock("../services/allergyGuardrails", () => ({ buildDietPromptBlock: () => "Synthetic diet" }));
jest.mock("../services/glucoseStateResolver", () => ({
  resolveUserGlucoseState: async () => ({ state: "NONE", activePreferences: [], preferencesConfigured: false }),
}));
jest.mock("../services/myPerfectMenu/performanceContext", () => ({
  resolveMyPerfectMenuPerformanceContext: jest.fn(),
}));
jest.mock("../services/myPerfectMenu/performanceAuthorityToken", () => ({
  issuePerformanceAuthorityToken: jest.fn(),
}));

function candidate(format: string) {
  return {
    title: `Berry ${format}`, description: `A berry ${format}.`,
    primaryIngredients: ["strawberries", "coconut yogurt", "almonds"],
    primaryProtein: null, produceItems: ["strawberries"], cuisine: "American",
    dietaryEvidence: [], preparationMethod: "chilled", signature: `berry-${format}-chilled`,
    culinaryIdentity: {
      dishForm: format, preparationStyle: "chilled", texture: "creamy",
      temperature: "chilled", primaryProteinBase: null, majorStarchBase: null,
      flavorFamily: "berry", cuisineEvidence: "American", definingComponents: ["strawberries"],
    },
    foodIdentity: { foodRole: "dessert", polarity: "sweet", formatFamily: format, preparationStyle: "chilled" },
  };
}
const candidates = [candidate("cheesecake"), candidate("cookie"), candidate("pudding_custard")];

describe("My Perfect Menu Development-only no-save endpoint", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockClaim.mockImplementation(
      jest.requireActual("../services/myPerfectMenu/developmentNoSave").createDevelopmentDessertTestClaim(),
    );
    mockAuthenticated = true;
    mockPersisted = {
      preferences: emptyMyPerfectMenuPreferences(),
      meals: [{ id: "existing-meal" }], board: [{ id: "existing-board-item" }],
      clinicalProfile: { unchanged: true },
    };
    const chain: any = {
      from: () => chain, where: () => chain, limit: () => chain, for: () => chain,
      then: (resolve: any) => Promise.resolve([{
        id: actorId, firstName: "Synthetic", nickname: null, activeHouseholdProfileId: null,
        value: mockPersisted.preferences,
      }]).then(resolve),
    };
    mockDb = {
      select: jest.fn(() => chain), insert: jest.fn(), delete: jest.fn(),
      update: jest.fn(() => ({ set: (values: any) => ({ where: async () => {
        mockPersisted.preferences = values.myPerfectMenuPreferences;
      } }) })),
      transaction: jest.fn(async (fn: any) => fn(mockDb)),
    };
    mockClient = { query: jest.fn(async () => ({ rows: [] })), release: jest.fn() };
    mockPool = { query: jest.fn(), connect: jest.fn(async () => mockClient) };
    mockGenerate.mockReset().mockResolvedValue({ concepts: candidates });
    mockHumanValidation.mockReset().mockReturnValue({ violations: [] });
    mockDietValidation.mockReset().mockReturnValue({ isValid: true });
    mockProtocolScan.mockReset().mockReturnValue({ passed: true, violations: [] });
    mockResolveBuilder.mockReset().mockResolvedValue({
      key: "general_nutrition", namespace: "generalNutrition", route: "/general-nutrition-builder/build",
    });
    mockResolveContext.mockReset().mockResolvedValue(mockContext);
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockRelease.mockReset().mockResolvedValue(undefined);
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use("/api/my-perfect-menu", require("../routes/myPerfectMenu").default);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  function assertNoSave(snapshot: string) {
    expect(JSON.stringify(mockPersisted)).toBe(snapshot);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  }

  it("runs the actual concept engine and all validators without saving any result", async () => {
    const snapshot = JSON.stringify(mockPersisted);
    const response = await request(app).post(path).send(body).expect(200);
    expect(response.body).toMatchObject({
      noSave: true, saved: false, acceptedCount: 3, generationRounds: 1, blockedWriteCount: 0,
    });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockHumanValidation).toHaveBeenCalledTimes(3);
    expect(mockDietValidation).toHaveBeenCalledTimes(3);
    expect(mockProtocolScan).toHaveBeenCalledTimes(3);
    expect(response.body).not.toHaveProperty("concepts");
    expect(response.body).not.toHaveProperty("subject");
    assertNoSave(snapshot);
    expect(mockClient.query.mock.calls.map(([sql]: any[]) => sql)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
  });

  it.each(["development", "production"])(
    "%s normal route repairs dessert metadata and signature collisions before saving three governed choices",
    async mode => {
      process.env.NODE_ENV = mode;
      mockResolveBuilder.mockResolvedValue({
        key: "anti_inflammatory", namespace: "antiInflammatory", route: "/anti-inflammatory-builder",
      });
      const description = "Complete original dessert evidence. ".repeat(10);
      mockGenerate.mockResolvedValue({
        concepts: candidates.map(item => ({ ...item, signature: "shared berry dessert", description })),
      });
      const response = await request(app).post("/api/my-perfect-menu/concepts")
        .send({ ...body, requestedBuilderKey: "anti_inflammatory" }).expect(200);
      expect(response.body.concepts).toHaveLength(3);
      expect(response.body.builder.key).toBe("anti_inflammatory");
      expect(response.body.concepts.map((item: { foodIdentity: { formatFamily: string } }) =>
        item.foodIdentity.formatFamily)).toEqual(["cheesecake", "cookie", "pudding_custard"]);
      for (const item of response.body.concepts) {
        expect(item.validationDescription).toBe(description.trim());
        expect(item.description.length).toBeLessThanOrEqual(180);
      }
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockHumanValidation).toHaveBeenCalledTimes(3);
      expect(mockDietValidation).toHaveBeenCalledTimes(3);
      expect(mockProtocolScan).toHaveBeenCalledTimes(3);
      expect(mockDietValidation.mock.calls.every(([meal]) =>
        meal.description === description.trim())).toBe(true);
      expect(mockPersisted.preferences.categories.snack).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockComplete).toHaveBeenCalledTimes(1);
      expect(mockClaim).not.toHaveBeenCalled();
      expect(mockPool.connect).not.toHaveBeenCalled();
      if (mode === "production") {
        expect(console.info).not.toHaveBeenCalled();
      }
    },
  );

  it("Production normal route fails closed on protocol rejection and preserves saved choices", async () => {
    process.env.NODE_ENV = "production";
    mockProtocolScan.mockReturnValue({
      passed: false, violations: [{ code: "synthetic_restriction" }],
    });
    const snapshot = JSON.stringify(mockPersisted);
    const response = await request(app).post("/api/my-perfect-menu/concepts").send(body).expect(422);
    expect(response.body.code).toBe("CONCEPT_REPAIR_EXHAUSTED");
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(mockProtocolScan).toHaveBeenCalled();
    expect(mockPool.connect).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    assertNoSave(snapshot);
  });

  it.each([["production", undefined], ["development", "1"], ["test", undefined]])(
    "returns 404 before authentication or generation outside unpublished Development: %s %s", async (mode, deployment) => {
      process.env.NODE_ENV = mode;
      if (deployment) process.env.REPLIT_DEPLOYMENT = deployment;
      await request(app).post(path).send(body).expect(404);
      expect(mockAuth).not.toHaveBeenCalled();
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockPool.connect).not.toHaveBeenCalled();
    },
  );
  it("requires real authentication before any context or provider access", async () => {
    mockAuthenticated = false;
    await request(app).post(path).send(body).expect(401);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockResolveContext).not.toHaveBeenCalled();
    expect(mockPool.connect).not.toHaveBeenCalled();
  });
  it("does not authorize an unrelated subject", async () => {
    await request(app).post(path).send({
      ...body, subjectUserId: "00000000-0000-4000-8000-000000000002",
    }).expect(404);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockResolveContext).not.toHaveBeenCalled();
  });
  it("is limited to the approved dessert action", async () => {
    await request(app).post(path).send({ ideaType: "dinner" }).expect(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("cannot silently run a second live generation invocation", async () => {
    await request(app).post(path).send(body).expect(200);
    const response = await request(app).post(path).send(body).expect(429);
    expect(response.body.code).toBe("DEVELOPMENT_DESSERT_TEST_ALREADY_USED");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
  it.each(["allergy", "diet", "clinical"])("preserves %s rejection and leaves all existing state intact", async kind => {
    const snapshot = JSON.stringify(mockPersisted);
    if (kind === "allergy") mockHumanValidation.mockReturnValue({ violations: ["forbidden_ingredient:synthetic"] });
    if (kind === "diet") mockDietValidation.mockReturnValue({ isValid: false, blockedIngredients: ["synthetic"] });
    if (kind === "clinical") mockProtocolScan.mockReturnValue({ passed: false, violations: [{ code: "SYNTHETIC_RESTRICTION" }] });
    const response = await request(app).post(path).send(body).expect(422);
    expect(response.body).toMatchObject({ saved: false, acceptedCount: 0, generationRounds: 3 });
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    assertNoSave(snapshot);
  });
  it("retains the five-round limit and never saves a partial set", async () => {
    const snapshot = JSON.stringify(mockPersisted);
    mockGenerate.mockResolvedValue({ concepts: candidates.slice(0, 2) });
    const response = await request(app).post(path).send(body).expect(422);
    expect(response.body).toMatchObject({ saved: false, acceptedCount: 2, generationRounds: 5 });
    expect(mockGenerate).toHaveBeenCalledTimes(5);
    assertNoSave(snapshot);
  });
  it("preserves historical duplicate filtering", async () => {
    mockPersisted.preferences.categories.snack = candidates.map((item, index) => ({
      ...item, id: `old-choice-${index}`, ideaType: "snack", snackType: "dessert",
    }));
    const snapshot = JSON.stringify(mockPersisted);
    const response = await request(app).post(path).send(body).expect(422);
    expect(response.body.rejectionCategories.repetition_rejection).toBeGreaterThan(0);
    assertNoSave(snapshot);
  });
  it("recovers display length but still rejects genuine metadata errors", async () => {
    mockGenerate.mockResolvedValue({ concepts: candidates.map(item => ({
      ...item, description: "A dessert. " + "Retained original evidence. ".repeat(12),
    })) });
    const response = await request(app).post(path).send(body).expect(200);
    expect(response.body).toMatchObject({ acceptedCount: 3, displayDescriptionRecoveryCount: 3 });
    expect(mockProtocolScan.mock.calls.every(([meal]) => meal.description.length > 180)).toBe(true);
  });
  it("rejects invalid ingredient evidence without persisting anything", async () => {
    const snapshot = JSON.stringify(mockPersisted);
    mockGenerate.mockResolvedValue({ concepts: [{ ...candidates[0], primaryIngredients: [] }] });
    const response = await request(app).post(path).send(body).expect(422);
    expect(response.body.rejectionCategories.schema_metadata_failure).toBeGreaterThan(0);
    expect(response.body.schemaIssues["primaryIngredients:too_small"]).toBeGreaterThan(0);
    assertNoSave(snapshot);
  });
  it("keeps the ordinary saving endpoint and its provider prompt unchanged", async () => {
    await request(app).post(path).send(body).expect(200);
    const dryRequest = mockGenerate.mock.calls[0][0];
    await request(app).post("/api/my-perfect-menu/concepts").send(body).expect(200);
    expect(mockGenerate.mock.calls[1][0]).toEqual(dryRequest);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockPersisted.preferences.categories.snack).toHaveLength(3);
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });
});
