/** Isolated route wiring: synthetic middleware fixtures, no DB or live session. */
import express from "express";
import request from "supertest";
import pilotRoutes from "../routes/businessPilotActivationRoutes";
import { issueBusinessPilotLink } from "../services/businessPilotActivationService";

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
