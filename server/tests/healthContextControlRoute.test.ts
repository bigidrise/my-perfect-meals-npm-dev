import express from "express";
import request from "supertest";
import { csrfProtection } from "../lib/csrfProtection";
import { NUTRITION_SUPPORT_OPTIONS } from "../../shared/nutritionSupportOptions";

const mockView = jest.fn();
const mockUserSupport = jest.fn();
const mockLegacyDecision = jest.fn();
const mockLabOff = jest.fn();
const mockSuggestionDecision = jest.fn();
const mockMedicationPast = jest.fn();
const mockLabReview = jest.fn();
const mockEarlierAnti = jest.fn();
const mockReconcile = jest.fn();
const mockSubjectReview = jest.fn();
const mockSubjectHard = jest.fn();
const mockProviderRecord = jest.fn();
const mockProviderEnd = jest.fn();
const mockProviderLegacy = jest.fn();
const mockLegal = jest.fn();
let mockProfessional: { role: string | null; training: boolean } = { role: "physician", training: true };
let mockSourceKind = "legacy_migrated";

jest.mock("../db", () => ({
  db: { select: () => ({
    from: () => ({ where: () => ({ limit: async () => [{
      professionalRole: mockProfessional.role,
      procareTrainingCompleted: mockProfessional.training,
      role: mockProfessional.role, training: mockProfessional.training,
    }] }) }),
  }) },
  pool: { query: jest.fn(async (sql: string) => ({
    rows: sql.includes("SELECT source_kind")
      ? [{ source_kind: mockSourceKind }]
      : [{ id: "00000000-0000-4000-8000-000000000001", care_relationship_id: "00000000-0000-4000-8000-000000000002" }],
  })) },
}));
jest.mock("../services/legalCheck", () => ({
  checkLegalAcceptance: (...args: unknown[]) => mockLegal(...args),
}));
jest.mock("../services/healthProtocols/clinicalDirectiveStorage", () => ({
  recordSubjectClinicalReview: (...args: unknown[]) => mockSubjectReview(...args),
  recordSubjectHardFoodRestriction: (...args: unknown[]) => mockSubjectHard(...args),
  recordProviderFoodDirective: (...args: unknown[]) => mockProviderRecord(...args),
  discontinueProviderFoodDirective: (...args: unknown[]) => mockProviderEnd(...args),
  verifyLegacyClaimAsProviderDirective: (...args: unknown[]) => mockProviderLegacy(...args),
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: () => void) => {
    const id = req.get("x-test-user");
    if (!id) return res.status(401).json({ message: "Authentication required." });
    req.authUser = { id };
    next();
  },
}));
jest.mock("../services/healthProtocols/healthContextControl", () => ({
  readHealthContextView: (...args: unknown[]) => mockView(...args),
  decideLegacySupport: (...args: unknown[]) => mockLegacyDecision(...args),
  markMedicationInformationPast: (...args: unknown[]) => mockMedicationPast(...args),
  decideEarlierAntiPreference: (...args: unknown[]) => mockEarlierAnti(...args),
  reconcileLegacyClaim: (...args: unknown[]) => mockReconcile(...args),
}));
jest.mock("../services/healthProtocols/persistence", () => ({
  setUserNutritionSupport: (...args: unknown[]) => mockUserSupport(...args),
  discontinueLabProtocol: (...args: unknown[]) => mockLabOff(...args),
  decideSystemRecommendation: (...args: unknown[]) => mockSuggestionDecision(...args),
  recordLabDecision: (...args: unknown[]) => mockLabReview(...args),
}));

const validId = "00000000-0000-4000-8000-000000000001";
const testView = {
  shadowOnly: true,
  builder: "anti_inflammatory",
  supports: [
    { protocol: "glp1", status: "needs_confirmation", personalEnabled: false,
      sources: [{ id: validId, kind: "earlier_profile", status: "needs_confirmation" }] },
    ...NUTRITION_SUPPORT_OPTIONS.filter((item) => item.protocol !== "glp1")
      .map(({ protocol }) => ({ protocol, status: "off", personalEnabled: false, sources: [] })),
  ],
};

describe("DEV-only health-context routes", () => {
  let app: express.Express;
  const oldEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = "development";
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { userId: "subject", csrfToken: "csrf-test" };
      next();
    });
    app.use(csrfProtection); // same centrally registered middleware as the app
    app.use("/api/health-context", require("../routes/healthContextControl").default());
  });
  afterAll(() => { process.env.NODE_ENV = oldEnv; });
  beforeEach(() => {
    jest.clearAllMocks();
    mockView.mockResolvedValue(testView);
    mockUserSupport.mockResolvedValue({});
    mockLegacyDecision.mockResolvedValue(testView);
    mockLabOff.mockResolvedValue({});
    mockSuggestionDecision.mockResolvedValue({});
    mockMedicationPast.mockResolvedValue(testView);
    mockLabReview.mockResolvedValue({});
    mockEarlierAnti.mockResolvedValue(testView);
    mockReconcile.mockResolvedValue(testView);
    mockSubjectReview.mockResolvedValue(undefined);
    mockSubjectHard.mockResolvedValue(validId);
    mockProviderRecord.mockResolvedValue(validId);
    mockProviderEnd.mockResolvedValue(undefined);
    mockProviderLegacy.mockResolvedValue({ providerSourceId: validId, directiveId: validId });
    mockLegal.mockResolvedValue({ allAccepted: true });
    mockProfessional = { role: "physician", training: true };
    mockSourceKind = "legacy_migrated";
  });
  const asSubject = (r: request.Test) => r.set("x-test-user", "subject");
  const withCsrf = (r: request.Test) =>
    asSubject(r).set("Origin", "http://localhost:5000").set("x-csrf-token", "csrf-test");

  it("keeps legacy review explicit and requires a typed rule for hard restrictions", async () => {
    const url = `/api/health-context/source/${validId}/review`;
    expect((await withCsrf(request(app).post(url))
      .send({ decision: "current_hard_restriction" })).status).toBe(400);
    expect(mockReconcile).not.toHaveBeenCalled();
    expect((await withCsrf(request(app).post(url))
      .send({ decision: "unresolved" })).status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", sourceId: validId, decision: "unresolved",
    });
    expect((await withCsrf(request(app).post(url))
      .send({ decision: "current_hard_restriction",
        rule: { kind: "avoid_ingredient", ingredientKey: "peanut" } })).status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", sourceId: validId,
      decision: "current_hard_restriction", rule: { kind: "avoid_ingredient", ingredientKey: "peanut" },
    });
  });

  it("does not permit subject review of a provider-owned source", async () => {
    mockSourceKind = "provider";
    const response = await withCsrf(request(app).post(`/api/health-context/source/${validId}/review`))
      .send({ decision: "history_only" });
    expect(response.status).toBe(403);
    expect(mockSubjectReview).not.toHaveBeenCalled();
    expect(mockProviderEnd).not.toHaveBeenCalled();
  });

  it("requires physician role, completed training, and current legal consent for provider writes", async () => {
    const url = "/api/health-context/provider/patient/directive";
    const payload = {
      sourceId: validId, membershipId: "00000000-0000-4000-8000-000000000002",
      rule: { kind: "avoid_ingredient", ingredientKey: "peanut" },
      effectiveAt: new Date().toISOString(),
    };
    mockProfessional = { role: "trainer", training: true };
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(403);
    mockProfessional = { role: "physician", training: false };
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(403);
    mockProfessional.training = true;
    mockLegal.mockResolvedValue({ allAccepted: false });
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(403);
    expect(mockProviderRecord).not.toHaveBeenCalled();
    mockLegal.mockResolvedValue({ allAccepted: true });
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(200);
    expect(mockProviderRecord).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "subject", subjectUserId: "patient", sourceId: validId,
      membershipId: payload.membershipId, rule: payload.rule,
    }));
  });

  it("keeps provider verification of a legacy claim separate from patient review and checks its authorization", async () => {
    const url = `/api/health-context/provider/patient/legacy/${validId}/verify`;
    const payload = {
      membershipId: "00000000-0000-4000-8000-000000000002",
      rule: { kind: "avoid_ingredient", ingredientKey: "peanut" },
      effectiveAt: new Date().toISOString(),
    };
    expect((await withCsrf(request(app).post(url)).send({
      ...payload, rule: { kind: "nutrient_bound", nutrient: "sodium", comparator: "at_most",
        amount: 200, unit: "g", scope: "per_day" },
    })).status).toBe(400);
    mockProfessional.role = "trainer";
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(403);
    expect(mockProviderLegacy).not.toHaveBeenCalled();
    mockProfessional.role = "physician";
    expect((await withCsrf(request(app).post(url)).send(payload)).status).toBe(200);
    expect(mockProviderLegacy).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "subject", subjectUserId: "patient",
      legacySourceId: validId, membershipId: payload.membershipId, rule: payload.rule,
    }));
  });

  it("requires authentication for the private read and returns no private evidence fields", async () => {
    expect((await request(app).get("/api/health-context")).status).toBe(401);
    const response = await asSubject(request(app).get("/api/health-context"));
    expect(response.status).toBe(200);
    expect(response.body.builder).toBe("anti_inflammatory");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(mockView).toHaveBeenCalledWith("subject");
  });

  it("rejects missing CSRF token, untrusted origin, and unauthenticated writes", async () => {
    const path = "/api/health-context/support/glp1";
    expect((await asSubject(request(app).put(path))
      .set("Origin", "http://localhost:5000").send({ enabled: true })).status).toBe(403);
    expect((await asSubject(request(app).put(path))
      .set("Origin", "http://localhost:5000").set("x-auth-token", "dummy")
      .send({ enabled: true })).status).toBe(403);
    expect((await asSubject(request(app).put(path))
      .set("Origin", "https://attacker.invalid").set("x-csrf-token", "csrf-test")
      .send({ enabled: true })).status).toBe(403);
    expect((await request(app).put(path).set("Origin", "http://localhost:5000")
      .set("x-csrf-token", "csrf-test").send({ enabled: true })).status).toBe(401);
    expect(mockUserSupport).not.toHaveBeenCalled();
  });

  it("rejects client-supplied source/subject, unknown protocols and unreviewed clinical activation", async () => {
    const url = "/api/health-context/support/glp1";
    expect((await withCsrf(request(app).put(url))
      .send({ enabled: true, source: "provider" })).status).toBe(400);
    expect((await withCsrf(request(app).put(url))
      .send({ enabled: true, subjectUserId: "other" })).status).toBe(400);
    expect((await withCsrf(request(app).put("/api/health-context/support/unknown"))
      .send({ enabled: true })).status).toBe(400);
    expect((await withCsrf(request(app).put("/api/health-context/support/liver_disease"))
      .send({ enabled: true })).status).toBe(409);
    expect((await withCsrf(request(app).put("/api/health-context/support/pregnancy_support"))
      .send({ enabled: false })).status).toBe(409);
    expect(mockUserSupport).not.toHaveBeenCalled();
  });

  it.each([
    "diabetes", "cardiac", "renal", "liver_support", "thyroid",
    "hormone_optimization", "menopause", "perimenopause", "metabolic_recovery",
    "oncology", "performance",
  ])("does not create a new personal %s support preference", async (protocol) => {
    const response = await withCsrf(request(app).put(`/api/health-context/support/${protocol}`))
      .send({ enabled: true });
    expect(response.status).toBe(409);
    expect(mockUserSupport).not.toHaveBeenCalled();
  });

  it("allows an explicit anti-inflammatory personal choice without changing a clinical source", async () => {
    const response = await withCsrf(request(app).put("/api/health-context/support/anti_inflammatory"))
      .send({ enabled: true });
    expect(response.status).toBe(200);
    expect(mockUserSupport).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject",
      protocol: "anti_inflammatory", enabled: true,
    });
  });

  it.each(NUTRITION_SUPPORT_OPTIONS.map(({ protocol }) => protocol))(
    "allows a personal %s preference without changing any clinical source or Builder",
    async (protocol) => {
      const response = await withCsrf(request(app).put(`/api/health-context/support/${protocol}`))
        .send({ enabled: true });
      expect(response.status).toBe(200);
      expect(mockUserSupport).toHaveBeenCalledWith({
        actorUserId: "subject", subjectUserId: "subject", protocol, enabled: true,
      });
      expect(response.body.builder).toBe("anti_inflammatory");
    },
  );

  it("changes only the authenticated subject's personal overlay; Builder is untouched", async () => {
    const response = await withCsrf(request(app).put("/api/health-context/support/glp1"))
      .send({ enabled: true });
    expect(response.status).toBe(200);
    expect(mockUserSupport).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", protocol: "glp1", enabled: true,
    });
    expect(response.body.builder).toBe("anti_inflammatory");
    expect(response.body.message).toContain("Development meal guidance");
  });

  it("turns off only personal GLP-1 support while a care-team source remains visible", async () => {
    const withCareTeam = {
      ...testView,
      supports: [
        { protocol: "glp1", status: "active", personalEnabled: true,
          sources: [
            { id: "personal", kind: "you", status: "active" },
            { id: "care", kind: "care_team", status: "active" },
          ] },
        ...testView.supports.filter((item) => item.protocol !== "glp1"),
      ],
    };
    mockView.mockResolvedValueOnce(withCareTeam).mockResolvedValueOnce({
      ...withCareTeam,
      supports: [
        { protocol: "glp1", status: "active", personalEnabled: false,
          sources: [
            { id: "personal", kind: "you", status: "off" },
            { id: "care", kind: "care_team", status: "active" },
          ] },
        ...testView.supports.filter((item) => item.protocol !== "glp1"),
      ],
    });
    const response = await withCsrf(request(app).put("/api/health-context/support/glp1"))
      .send({ enabled: false });
    expect(response.status).toBe(200);
    expect(mockUserSupport).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", protocol: "glp1", enabled: false,
    });
    expect(response.body.supports[0].sources[1]).toEqual({
      id: "care", kind: "care_team", status: "active",
    });
    expect(response.body.message).toContain("Another current source");
  });

  it("lets an older personal clinical source turn off, but never reactivate as a simple preference", async () => {
    mockView.mockResolvedValue({
      ...testView,
      supports: [
        ...testView.supports,
        { protocol: "pregnancy_support", status: "active", personalEnabled: true,
          sources: [{ id: "older-personal", kind: "you", status: "active" }] },
      ],
    });
    const path = "/api/health-context/support/pregnancy_support";
    expect((await withCsrf(request(app).put(path)).send({ enabled: true })).status).toBe(409);
    expect(mockUserSupport).not.toHaveBeenCalled();
    expect((await withCsrf(request(app).put(path)).send({ enabled: false })).status).toBe(200);
    expect(mockUserSupport).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", protocol: "pregnancy_support", enabled: false,
    });
  });

  it("scopes earlier-profile decisions to authenticated subject with strict boolean input", async () => {
    const url = `/api/health-context/earlier-profile/${validId}/decision`;
    expect((await withCsrf(request(app).post(url))
      .send({ current: true, source: "provider" })).status).toBe(400);
    const accepted = await withCsrf(request(app).post(url)).send({ current: true });
    expect(accepted.status).toBe(200);
    expect(mockLegacyDecision).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject",
      sourceId: validId, current: true,
    });
    expect((await withCsrf(request(app).post(url)).send({ current: false })).status).toBe(200);
  });

  it("allows only the subject to mark medication information past, not invent current use", async () => {
    const path = `/api/health-context/medication/${validId}/past`;
    expect((await withCsrf(request(app).post(path))
      .send({ currentMedicationUse: true })).status).toBe(400);
    const result = await withCsrf(request(app).post(path)).send({});
    expect(result.status).toBe(200);
    expect(mockMedicationPast).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", sourceId: validId,
    });
  });

  it("reviews only an existing lab decision owned by the authenticated subject", async () => {
    const url = "/api/health-context/lab-recommendation/42/review";
    expect((await withCsrf(request(app).post(url))
      .send({ source: "lab", status: "accepted" })).status).toBe(400);
    const result = await withCsrf(request(app).post(url)).send({});
    expect(result.status).toBe(200);
    expect(mockLabReview).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", recommendationId: 42,
    });
  });

  it("requires the authenticated subject and strict confirmation for the live Anti-Inflammatory preference", async () => {
    const url = "/api/health-context/earlier-anti-preference/decision";
    expect((await withCsrf(request(app).post(url))
      .send({ current: true, source: "provider" })).status).toBe(400);
    const result = await withCsrf(request(app).post(url)).send({ current: true });
    expect(result.status).toBe(200);
    expect(mockEarlierAnti).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", current: true,
    });
  });

  it("returns 404 when the DEV-only route is reached outside development", async () => {
    process.env.NODE_ENV = "production";
    try {
      const result = await asSubject(request(app).get("/api/health-context"));
      expect(result.status).toBe(404);
      expect(mockView).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = "development";
    }
  });
});