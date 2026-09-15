import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { findUserByValidAuthToken } from "../services/authTokenService";

jest.mock("../db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("../services/authTokenService", () => ({
  findUserByValidAuthToken: jest.fn(),
}));

jest.mock("../lib/orgContext", () => ({
  loadOrgContext: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/effectiveAccess", () => ({
  computeEffectiveAccess: jest.fn().mockResolvedValue({
    planLookupKey: null,
    entitlements: [],
    sponsoredByBusinessId: null,
    sponsoredByBusinessName: null,
    sponsoredProCareAccess: false,
    pilotProCareAccess: false,
    pilotProCareGrantId: null,
    pilotProCareEndsAt: null,
    pilotFullAccess: false,
    pilotParticipantId: null,
    pilotProgramName: null,
    pilotFullAccessEndsAt: null,
  }),
}));

const tokenLookup = findUserByValidAuthToken as jest.MockedFunction<
  typeof findUserByValidAuthToken
>;

const user = {
  id: "user-a",
  email: "user-a@example.com",
  username: "User A",
  role: "client",
  professionalRole: null,
  plan: "free",
  entitlements: [],
  planLookupKey: null,
  selectedMealBuilder: null,
  isAdmin: false,
  isFounder: false,
  isTester: false,
  isSandbox: false,
  authSecurityVersion: 3,
  organizationId: null,
  authTokenCreatedAt: new Date("2026-01-01T00:00:00Z"),
  authTokenMfaVerifiedAt: null,
};

function mockSessionUser(result: unknown[]) {
  (db.select as jest.Mock).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => result,
      }),
    }),
  });
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
}

describe("authentication credential precedence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a valid cookie session even when an old bearer token is present", async () => {
    mockSessionUser([user]);
    tokenLookup.mockResolvedValue(null);
    const req = {
      method: "GET",
      path: "/api/user/profile",
      headers: { "x-auth-token": "stale-browser-token" },
      session: { userId: user.id, authSecurityVersion: user.authSecurityVersion },
    } as any;
    const res = response();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(tokenLookup).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.authUser.id).toBe(user.id);
  });

  it("rejects an invalid token when no cookie session is present", async () => {
    tokenLookup.mockResolvedValue(null);
    const req = {
      method: "GET",
      path: "/api/user/profile",
      headers: { "x-auth-token": "invalid-token" },
      session: {},
    } as any;
    const res = response();

    await requireAuth(req, res, jest.fn());

    expect(tokenLookup).toHaveBeenCalledWith("invalid-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  });

  it("continues to support a valid native bearer token", async () => {
    tokenLookup.mockResolvedValue(user as any);
    const req = {
      method: "GET",
      path: "/api/user/profile",
      headers: { "x-auth-token": "native-token" },
      session: {},
    } as any;
    const res = response();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(tokenLookup).toHaveBeenCalledWith("native-token");
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authUser.id).toBe(user.id);
  });
});