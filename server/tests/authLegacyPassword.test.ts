import express from "express";
import session from "express-session";
import request from "supertest";
import bcrypt from "bcryptjs";

jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/emailIdentityService", () => ({
  resolveEmailIdentityForEmail: jest.fn(),
  normalizeEmailIdentity: (email: string) => email.toLowerCase().trim(),
}));
jest.mock("../services/authAttemptTrackingService", () => ({
  authAttemptTracker: { isLocked: jest.fn(), clear: jest.fn(), recordFailure: jest.fn() },
}));
jest.mock("../services/authTokenService", () => ({
  AuthSecurityStateChangedError: class extends Error {},
  rotateAuthToken: jest.fn(),
  revokeAuthToken: jest.fn(),
  findUserByValidAuthToken: jest.fn(),
}));
jest.mock("../services/inviteAutoAccept", () => ({
  autoAcceptPendingInvites: jest.fn(),
  lookupExistingMembership: jest.fn(),
}));
jest.mock("../services/procareActivation", () => ({ selfHealProCareState: jest.fn() }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn(), getClientIp: jest.fn(() => "127.0.0.1") }));
jest.mock("../lib/privilegedMfaPolicy", () => ({ requiresPrivilegedMfa: jest.fn(() => false) }));
jest.mock("../services/emailService", () => ({ sendTrialStartEmail: jest.fn() }));

import authRouter from "../routes/auth.session";
import { db } from "../db";
import { resolveEmailIdentityForEmail } from "../services/emailIdentityService";
import { authAttemptTracker } from "../services/authAttemptTrackingService";
import { rotateAuthToken } from "../services/authTokenService";
import { autoAcceptPendingInvites, lookupExistingMembership } from "../services/inviteAutoAccept";

const app = express();
app.use(express.json());
app.use(session({ secret: "isolated-auth-regression-test", resave: false, saveUninitialized: false }));
app.use(authRouter);
app.get("/test/session", (req, res) => res.json({ userId: req.session.userId ?? null }));

beforeEach(() => {
  jest.clearAllMocks();
  (resolveEmailIdentityForEmail as jest.Mock).mockResolvedValue({
    status: "unique", user: { id: "existing-account" },
  });
  (authAttemptTracker.isLocked as jest.Mock).mockResolvedValue(false);
  (authAttemptTracker.clear as jest.Mock).mockResolvedValue(undefined);
  (rotateAuthToken as jest.Mock).mockResolvedValue({ authToken: "test-token" });
  (autoAcceptPendingInvites as jest.Mock).mockResolvedValue({ accepted: false, membership: null });
  (lookupExistingMembership as jest.Mock).mockResolvedValue(null);
});

it("authenticates a legacy short password normally and establishes a session", async () => {
  const password = "OldPass7!";
  const stored = {
    id: "existing-account", email: "legacy@example.test", username: "legacy",
    password: await bcrypt.hash(password, 10), mfaEnabled: false, authSecurityVersion: 0,
  };
  (db.select as jest.Mock).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [stored] }) }),
  });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login")
    .send({ email: stored.email, password });
  expect(response.status).toBe(200);
  expect(response.body.id).toBe(stored.id);
  expect(authAttemptTracker.clear).toHaveBeenCalled();
  expect(rotateAuthToken).toHaveBeenCalledWith(stored.id, { expectedSecurityVersion: 0 });
  expect((await agent.get("/test/session")).body.userId).toBe(stored.id);
});

it("continues rejecting short passwords for signup and password reset", async () => {
  for (const [route, payload] of [
    ["/api/auth/signup", { email: "new@example.test", password: "OldPass7!" }],
    ["/api/auth/reset-password", { token: "test-token", password: "OldPass7!" }],
  ] as const) {
    const response = await request(app).post(route).send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password must be at least 12 characters");
  }
  expect(db.select).not.toHaveBeenCalled();
});