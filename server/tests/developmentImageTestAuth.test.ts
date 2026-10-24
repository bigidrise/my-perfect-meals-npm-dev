const mockRead = jest.fn();
const mockToken = jest.fn();
jest.mock("../db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mockRead }) }) }) } }));
jest.mock("../lib/accessTier", () => ({ resolveAccessTier: () => "free" }));
jest.mock("../lib/orgContext", () => ({ loadOrgContext: async () => ({}) }));
jest.mock("../services/effectiveAccess", () => ({ computeEffectiveAccess: async () => { throw new Error("fixture-no-entitlement-service"); } }));
jest.mock("../services/authTokenService", () => ({ findUserByValidAuthToken: mockToken }));
import { requireAuth } from "../middleware/requireAuth";
import { developmentImageTestScope } from "../services/images/developmentImageTestScope";

const runId = "f0000000-0000-4000-8000-000000000001";
const userId = "f0000000-0000-4000-8000-000000000002";
const subject = { id: userId, email: `image-test+${runId}@example.invalid`, isSandbox: true,
  authSecurityVersion: 0, role: "client", entitlements: [] };
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: "development", IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare",
    DEVELOPMENT_IMAGE_TEST_ENABLED: "approved-single-image", DEVELOPMENT_IMAGE_TEST_RUN_ID: runId, DEVELOPMENT_IMAGE_TEST_USER_ID: userId };
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockRead.mockResolvedValue([subject]);
  mockToken.mockResolvedValue(subject);
});
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });
const response = () => { const res: any = { status: jest.fn(), json: jest.fn() }; res.status.mockReturnValue(res); return res; };
it.each(["session", "token"])("binds all downstream work, including inline and prewarm images, after %s authentication", async mode => {
  const req: any = { method: "POST", path: "/api/ai/generate", headers: {},
    ...(mode === "session" ? { session: { userId, authSecurityVersion: 0 } } : { headers: { "x-auth-token": "synthetic-token" } }) };
  let downstream: Promise<string | undefined> | undefined;
  const next = jest.fn(() => { downstream = Promise.resolve().then(() => developmentImageTestScope()?.config.userId); });
  await requireAuth(req, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(await downstream).toBe(userId);
  expect(developmentImageTestScope()).toBeUndefined();
});
it("does not bypass revoked browser sessions", async () => {
  const res = response();
  const next = jest.fn();
  await requireAuth({ method: "POST", path: "/api/ai/generate", headers: {},
    session: { userId, authSecurityVersion: 99 } } as any, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
it.each([{ rows: [] }, { rows: [{ ...subject, email: "real-user@example.com" }] },
  { rows: [{ ...subject, isSandbox: false }] }])("does not scope missing or non-synthetic authenticated identities", async ({ rows }) => {
  mockRead.mockResolvedValueOnce(rows);
  const res = response();
  const next = jest.fn();
  await requireAuth({ method: "POST", path: "/api/ai/generate", headers: {},
    session: { userId, authSecurityVersion: 0 } } as any, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});
it("leaves ordinary authenticated users outside the test scope", async () => {
  mockRead.mockResolvedValueOnce([{ ...subject, id: "other-user", isSandbox: false }]);
  const next = jest.fn(() => expect(developmentImageTestScope()).toBeUndefined());
  await requireAuth({ method: "POST", path: "/api/ai/generate", headers: {},
    session: { userId: "other-user", authSecurityVersion: 0 } } as any, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
});
