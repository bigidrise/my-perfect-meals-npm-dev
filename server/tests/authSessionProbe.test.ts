import express from "express";
import request from "supertest";
import { registerSessionProbeRoutes } from "../routes/authSessionProbe";
import { db } from "../db";
import { findUserByValidAuthToken } from "../services/authTokenService";

jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/authTokenService", () => ({ findUserByValidAuthToken: jest.fn() }));
jest.mock("../lib/orgContext", () => ({ loadOrgContext: jest.fn().mockResolvedValue(null) }));
jest.mock("../services/effectiveAccess", () => ({
  computeEffectiveAccess: jest.fn().mockResolvedValue({
    planLookupKey: null, entitlements: [], sponsoredByBusinessId: null,
    sponsoredByBusinessName: null, sponsoredProCareAccess: false,
    pilotProCareAccess: false, pilotFullAccess: false,
  }),
}));

const actor = {
  id: "fixture-provider", email: "fixture@example.invalid", username: "Fixture Provider",
  role: "client", professionalRole: "trainer", isProCare: true,
  authSecurityVersion: 7, plan: "free", entitlements: [], planLookupKey: null,
};
let browserSession: any;
const app = express();
app.use((req, _res, next) => { (req as any).session = browserSession; next(); });
const router = express.Router();
registerSessionProbeRoutes(router);
app.use(router);

beforeEach(() => {
  jest.clearAllMocks();
  browserSession = {
    userId: actor.id, authSecurityVersion: 7, mfaVerified: true,
    lastActiveAt: Date.now(), destroy: jest.fn(),
  };
  (db.select as jest.Mock).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [{ ...actor }] }) }),
  });
  (findUserByValidAuthToken as jest.Mock).mockResolvedValue(null);
});

test("Studio-to-Personal session probe accepts the valid browser session without a token", async () => {
  const response = await request(app).get("/api/auth/session");
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ id: actor.id, userId: actor.id, isProCare: true });
  expect(findUserByValidAuthToken).not.toHaveBeenCalled();
  expect(browserSession.destroy).not.toHaveBeenCalled();
  expect(response.body).not.toHaveProperty("authSecurityVersion");
});

test("a stale legacy browser token cannot override the valid cookie session", async () => {
  expect((await request(app).get("/api/auth/session").set("x-auth-token", "stale-fixture-token")).status).toBe(200);
  expect(findUserByValidAuthToken).not.toHaveBeenCalled();
});

test("native bearer authentication remains supported without a browser session", async () => {
  browserSession = {};
  (findUserByValidAuthToken as jest.Mock).mockResolvedValue(actor);
  expect((await request(app).get("/api/auth/session").set("x-auth-token", "fixture-native-token")).status).toBe(200);
  expect(findUserByValidAuthToken).toHaveBeenCalledWith("fixture-native-token");
});

test("anonymous and pending-MFA sessions are not treated as completed logins", async () => {
  browserSession = {};
  expect((await request(app).get("/api/auth/session")).status).toBe(401);
  browserSession = { pendingMfaUserId: actor.id, authSecurityVersion: 7 };
  expect((await request(app).get("/api/auth/session")).status).toBe(401);
  expect(browserSession.pendingMfaUserId).toBe(actor.id);
});

test("changed security state still revokes the browser session", async () => {
  browserSession.authSecurityVersion = 6;
  const response = await request(app).get("/api/auth/session");
  expect(response.status).toBe(401);
  expect(response.body.code).toBe("AUTH_REAUTHENTICATION_REQUIRED");
  expect(browserSession.destroy).toHaveBeenCalled();
});

test("the existing idle timeout remains enforced", async () => {
  browserSession.lastActiveAt = Date.now() - 61 * 60 * 1000;
  const response = await request(app).get("/api/auth/session");
  expect(response.status).toBe(401);
  expect(response.body.code).toBe("SESSION_IDLE_TIMEOUT");
});
