import express from "express";
import request from "supertest";
import { csrfProtection } from "../lib/csrfProtection";

const mockView = jest.fn();
const mockUserSupport = jest.fn();
const mockLegacyDecision = jest.fn();
const mockLabOff = jest.fn();
const mockSuggestionDecision = jest.fn();
const mockMedicationPast = jest.fn();
const mockLabReview = jest.fn();
const mockEarlierAnti = jest.fn();

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
    { protocol: "anti_inflammatory", status: "off", personalEnabled: false, sources: [] },
    { protocol: "renal", status: "off", personalEnabled: false, sources: [] },
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
  });
  const asSubject = (r: request.Test) => r.set("x-test-user", "subject");
  const withCsrf = (r: request.Test) =>
    asSubject(r).set("Origin", "http://localhost:5000").set("x-csrf-token", "csrf-test");

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

  it("rejects client-supplied source/subject, unknown protocols and unconfirmed non-overlay activation", async () => {
    const url = "/api/health-context/support/glp1";
    expect((await withCsrf(request(app).put(url))
      .send({ enabled: true, source: "provider" })).status).toBe(400);
    expect((await withCsrf(request(app).put(url))
      .send({ enabled: true, subjectUserId: "other" })).status).toBe(400);
    expect((await withCsrf(request(app).put("/api/health-context/support/unknown"))
      .send({ enabled: true })).status).toBe(400);
    expect((await withCsrf(request(app).put("/api/health-context/support/renal"))
      .send({ enabled: true })).status).toBe(409);
    expect((await withCsrf(request(app).put("/api/health-context/support/renal"))
      .send({ enabled: false })).status).toBe(409);
    expect((await withCsrf(request(app).put("/api/health-context/support/renal"))
      .send({ enabled: true })).status).toBe(409);
    expect(mockUserSupport).not.toHaveBeenCalled();
  });

  it("changes only the authenticated subject's personal overlay; Builder is untouched", async () => {
    const response = await withCsrf(request(app).put("/api/health-context/support/glp1"))
      .send({ enabled: true });
    expect(response.status).toBe(200);
    expect(mockUserSupport).toHaveBeenCalledWith({
      actorUserId: "subject", subjectUserId: "subject", protocol: "glp1", enabled: true,
    });
    expect(response.body.builder).toBe("anti_inflammatory");
    expect(response.body.message).toContain("future support");
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