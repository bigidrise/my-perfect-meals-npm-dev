import express from "express";
import request from "supertest";
import { csrfProtection } from "../lib/csrfProtection";

let mockAuthenticated = true, mockAdmin = true, mockMfa = true, mockVersion = 4;
const mockDecide = jest.fn();
const mockRead = jest.fn();
jest.mock("../middleware/requireAuth", () => ({ requireAuth: (req: any, res: any, next: any) => {
  if (!mockAuthenticated) return res.status(401).json({ code: "AUTH_REQUIRED" });
  req.authUser = { id: "fictional-reviewer" }; next();
} }));
jest.mock("../lib/sessionSecurity", () => ({ isMfaVerifiedForUser: () => mockMfa }));
jest.mock("../db", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ isAdmin: mockAdmin, mfaEnabled: mockMfa, version: mockVersion }] }) }) }),
} }));
jest.mock("../services/professionalIdentityDecisionRepository", () => ({ identityDecisionRepository: {}, listProfessionalReviewRequests: jest.fn(), readProfessionalReviewRequest: jest.fn() }));
jest.mock("../services/professionalCredentialReviewRepository", () => ({
  credentialReviewRepository: {}, readCredentialContext: (...args: any[]) => mockRead(...args),
}));
jest.mock("../services/professionalCredentialReviewService", () => ({
  ...jest.requireActual("../services/professionalCredentialReviewService"),
  createCredentialReviewService: () => ({ decide: (...args: any[]) => mockDecide(...args) }),
}));
jest.mock("../services/professionalIdentityReadiness", () => ({ getProfessionalIdentityReadiness: jest.fn() }));
import router from "../routes/professionalIdentityReviewRoutes";

const id = "bff13b2d-7f33-4ff4-8be3-44a5c67c0d21";
const approvalEventId = "bff13b2d-7f33-4ff4-8be3-44a5c67c0d22";
const path = `/api/admin/professional-requests/${id}/credentials`;
const body = {
  revision: 3, reviewedCredentialHash: "a".repeat(64), approvalEventId, decision: "verified",
  verificationBasis: "FICTIONAL FIXTURE: independent authority reference with matching active evidence.",
  checkedAt: "2020-01-01T00:00:00Z", validUntil: "2028-01-01T00:00:00Z", independentVerificationAcknowledged: true,
};
const app = express();
app.use(express.json(), (req: any, _res, next) => {
  req.session = { userId: "fictional-reviewer", authSecurityVersion: 4, csrfToken: "fixture-csrf" }; next();
}, csrfProtection);
app.use("/api/admin/professional-requests", router);
const post = () => request(app).post(path).set("x-requested-with", "XMLHttpRequest").set("x-csrf-token", "fixture-csrf");
const previousEnv = process.env.NODE_ENV, previousDeployment = process.env.REPLIT_DEPLOYMENT;
beforeEach(() => {
  process.env.NODE_ENV = "development"; delete process.env.REPLIT_DEPLOYMENT;
  mockAuthenticated = mockAdmin = mockMfa = true; mockVersion = 4;
  mockDecide.mockReset().mockResolvedValue({ decisionSaved: true });
  mockRead.mockReset().mockResolvedValue({
    request: { id, ownerUserId: "fictional-subject", state: "approved", requestedRole: "physician", professionalCategory: "certified", credentialBody: "Fictional authority", credentialNumber: "SYNTHETIC", revision: 3 },
    account: { id: "fictional-subject", professionalRole: "physician", authSecurityVersion: 7 },
    approval: { id: approvalEventId }, latest: null, required: true, demo: false,
  });
});
afterAll(() => { process.env.NODE_ENV = previousEnv; if (previousDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT; else process.env.REPLIT_DEPLOYMENT = previousDeployment; });
test.each(["authentication", "admin", "mfa", "version"] as const)("%s protection blocks the actual route before its writer", async gate => {
  if (gate === "authentication") mockAuthenticated = false;
  if (gate === "admin") mockAdmin = false;
  if (gate === "mfa") mockMfa = false;
  if (gate === "version") mockVersion = 5;
  expect((await post().send(body)).status).toBe(gate === "authentication" ? 401 : 403);
  expect(mockDecide).not.toHaveBeenCalled();
});
test("actual route uses only server-validated reviewer proof and preserves explicit decision evidence", async () => {
  const result = await post().send(body);
  expect(result.status).toBe(200);
  expect(mockDecide).toHaveBeenCalledWith(id, { id: "fictional-reviewer", securityVersion: 4, mfaVerified: true }, body);
  expect(result.body).toMatchObject({ decisionSaved: true, review: { status: "pending" } });
});
test("cookie-authenticated writer rejects missing CSRF and foreign origins", async () => {
  expect((await request(app).post(path).set("x-requested-with", "XMLHttpRequest").send(body)).status).toBe(403);
  expect((await post().set("origin", "https://foreign.invalid").send(body)).status).toBe(403);
  expect(mockDecide).not.toHaveBeenCalled();
});
test.each([{ reviewerId: "spoof" }, { pilotGrant: true }, { verificationBasis: "" }, { checkedAt: undefined }])("forged/incomplete input is rejected: %p", async fields => {
  expect((await post().send({ ...body, ...fields })).status).toBe(400);
  expect(mockDecide).not.toHaveBeenCalled();
});
test("committed decision remains confirmed when fresh projection fails; it never claims clearance", async () => {
  mockRead.mockRejectedValue(new Error("fixture projection unavailable"));
  const result = await post().send(body);
  expect(result.body).toEqual({ decisionSaved: true, review: null, reviewError: "CREDENTIAL_STATUS_UNAVAILABLE" });
});
test("storage failure never reports an approval or success", async () => {
  mockDecide.mockRejectedValue(new Error("fixture audit unavailable"));
  const result = await post().send(body);
  expect(result.status).toBe(503); expect(result.body.decisionSaved).toBeUndefined();
});
test("query-injected authority is rejected", async () => {
  expect((await request(app).get(path + "?reviewerId=spoof")).status).toBe(400);
});
test("the Development-only route stays closed in Production and deployments", async () => {
  process.env.NODE_ENV = "production"; expect((await post().send(body)).status).toBe(404);
  process.env.NODE_ENV = "development"; process.env.REPLIT_DEPLOYMENT = "true";
  expect((await post().send(body)).status).toBe(404);
  expect(mockDecide).not.toHaveBeenCalled();
});
