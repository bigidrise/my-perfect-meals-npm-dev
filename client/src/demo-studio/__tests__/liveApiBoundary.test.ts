import { requireAuth } from "../../../../server/middleware/requireAuth";
import { db } from "../../../../server/db";
import { findUserByValidAuthToken } from "../../../../server/services/authTokenService";

jest.mock("../../../../server/db", () => ({ db: { select: jest.fn() } }));
jest.mock("../../../../server/services/authTokenService", () => ({ findUserByValidAuthToken: jest.fn() }));
jest.mock("../../../../server/lib/orgContext", () => ({ loadOrgContext: jest.fn() }));
jest.mock("../../../../server/services/effectiveAccess", () => ({ computeEffectiveAccess: jest.fn() }));

describe("synthetic identity is not live API authentication", () => {
  beforeEach(() => {
    (findUserByValidAuthToken as jest.Mock).mockResolvedValue(null);
  });
  it.each([
    { "x-user-id": "demo-studio-user", "x-demo-mode": "true" },
    { "x-auth-token": "demo-studio-user" },
    { authorization: "Bearer demo-studio-user" },
    { "x-auth-token": "demo@myperfectmeals.invalid" },
  ])("rejects fabricated demo credentials %j", async headers => {
    const req = { method: "GET", path: "/api/user/profile", headers,
      body: { userId: "demo-studio-user", demoMode: true }, query: { userId: "demo-studio-user" },
      session: {}, get: (key: string) => (headers as Record<string, string>)[key.toLowerCase()] } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.authUser).toBeUndefined();
    expect(db.select).not.toHaveBeenCalled();
  });
});
