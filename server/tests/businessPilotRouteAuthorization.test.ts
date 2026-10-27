/** Isolated route wiring: synthetic middleware fixtures, no DB or live session. */
import express from "express";
import request from "supertest";
import pilotRoutes from "../routes/businessPilotActivationRoutes";
import { issueBusinessPilotLink, activateBusinessPilotLink } from "../services/businessPilotActivationService";
import { ensureCanonicalWorkspaceForBusiness } from "../services/organizationWorkspaceService";
import { unifiedBusinessPilotDevelopmentEnabled } from "../services/businessPilotActivationPolicy";

jest.mock("../db", () => ({ db: { execute: jest.fn(async () => ({ rows: [] })) } }));
jest.mock("../services/organizationWorkspaceService", () => ({
  ensureCanonicalWorkspaceForBusiness: jest.fn(),
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const role = req.get("x-test-role");
    if (!role) return res.status(401).json({ code: "AUTH_REQUIRED" });
    req.authUser = { id: "synthetic-test-user", isAdmin: true, isFounder: role === "founder" };
    next();
  },
}));
jest.mock("../middleware/requireMfa", () => ({
  requireMfa: (req: any, res: any, next: any) => {
    if (req.get("x-test-mfa") !== "verified") return res.status(403).json({ code: "MFA_REQUIRED" });
    next();
  },
}));
jest.mock("../services/businessPilotActivationPolicy", () => ({
  ...jest.requireActual("../services/businessPilotActivationPolicy"),
  businessPilotActivationEnabled: () => true,
  unifiedBusinessPilotDevelopmentEnabled: jest.fn(() => false),
}));
jest.mock("../services/businessPilotActivationService", () => ({
  issueBusinessPilotLink: jest.fn(),
  inspectBusinessPilotLink: jest.fn(),
  activateBusinessPilotLink: jest.fn(),
  getBusinessPilotActivation: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/business/pilot-activation", pilotRoutes);

test("anonymous issuance is rejected by existing authentication middleware", async () => {
  const response = await request(app).post("/api/business/pilot-activation/issue").send({});
  expect(response.status).toBe(401);
  expect(response.body.code).toBe("AUTH_REQUIRED");
  expect(issueBusinessPilotLink).not.toHaveBeenCalled();
});

test("founder issuance cannot skip the existing MFA middleware", async () => {
  const response = await request(app).post("/api/business/pilot-activation/issue")
    .set("x-test-role", "founder").send({});
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("MFA_REQUIRED");
  expect(issueBusinessPilotLink).not.toHaveBeenCalled();
});

test("MFA-verified admin without founder identity is still rejected", async () => {
  const response = await request(app).post("/api/business/pilot-activation/issue")
    .set("x-test-role", "admin").set("x-test-mfa", "verified").send({});
  expect(response.status).toBe(403);
  expect(response.body.error).toBe("Founder authorization required.");
  expect(issueBusinessPilotLink).not.toHaveBeenCalled();
});

test("ordinary authentication alone cannot claim an invitation or bypass MFA", async () => {
  const anonymous = await request(app).post("/api/business/pilot-activation/claim").send({});
  expect(anonymous.status).toBe(401);
  const noMfa = await request(app).post("/api/business/pilot-activation/claim")
    .set("x-test-role", "participant").send({});
  expect(noMfa.status).toBe(403);
  expect(activateBusinessPilotLink).not.toHaveBeenCalled();
});

test("partial canonical provisioning retries the same activation and business", async () => {
  (unifiedBusinessPilotDevelopmentEnabled as jest.Mock).mockReturnValue(true);
  const grant = { authorizationId: "grant", businessId: "business", startedAt: new Date(),
    endsAt: new Date(Date.now() + 86400000), alreadyActivated: true };
  (activateBusinessPilotLink as jest.Mock).mockResolvedValue(grant);
  (ensureCanonicalWorkspaceForBusiness as jest.Mock).mockRejectedValueOnce(new Error("fixture failure"))
    .mockResolvedValueOnce({ organizationId: "organization", locationId: "location" });
  const claim = () => request(app).post("/api/business/pilot-activation/claim")
    .set("x-test-role", "participant").set("x-test-mfa", "verified")
    .send({ token: "synthetic-not-an-invitation", businessId: "business" });
  expect((await claim()).status).toBe(503);
  const recovered = await claim();
  expect(recovered.status).toBe(200);
  expect(recovered.body).toMatchObject({ businessId: "business", organizationId: "organization", alreadyActivated: true });
  expect(recovered.body.endsAt).toBe(grant.endsAt.toISOString());
  expect(ensureCanonicalWorkspaceForBusiness).toHaveBeenNthCalledWith(1, "business");
  expect(ensureCanonicalWorkspaceForBusiness).toHaveBeenNthCalledWith(2, "business");
  (unifiedBusinessPilotDevelopmentEnabled as jest.Mock).mockReturnValue(false);
});
