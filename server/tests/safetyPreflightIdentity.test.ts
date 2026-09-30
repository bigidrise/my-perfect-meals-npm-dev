import express from "express";
import session from "express-session";
import request from "supertest";
import safetyRouter from "../routes/safetyRoutes";
import { db } from "../db";
import { findUserByValidAuthToken } from "../services/authTokenService";
import { enforceSafetyProfile, enforceSafetyProfileSync } from "../services/safetyProfileService";

jest.mock("../db", () => ({ db: { select: jest.fn() } }));
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
jest.mock("../services/safetyPinService", () => ({}));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: jest.fn(),
  enforceSafetyProfileSync: jest.fn(),
}));

const user = {
  id: "subject-a",
  email: "subject-a@example.invalid",
  username: "Subject A",
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
};

const tokenLookup = findUserByValidAuthToken as jest.MockedFunction<
  typeof findUserByValidAuthToken
>;
const safetyCheck = enforceSafetyProfile as jest.MockedFunction<typeof enforceSafetyProfile>;
const guestCheck = enforceSafetyProfileSync as jest.MockedFunction<typeof enforceSafetyProfileSync>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: "test-only-session-secret",
    resave: false,
    saveUninitialized: false,
  }));
  app.post("/test/session", (req, res) => {
    (req.session as any).userId = user.id;
    (req.session as any).authSecurityVersion = req.body.securityVersion ?? user.authSecurityVersion;
    if (req.body.lastActiveAt) (req.session as any).lastActiveAt = req.body.lastActiveAt;
    res.json({ ok: true });
  });
  app.use("/api", safetyRouter);
  return app;
}

function mockSessionUser() {
  (db.select as jest.Mock).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [user],
      }),
    }),
  });
}

describe("shared safety preflight identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionUser();
    safetyCheck.mockResolvedValue({
      result: "SAFE",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: [],
      message: "Safe for this user",
    } as any);
    guestCheck.mockReturnValue({
      result: "BLOCKED",
      blockedTerms: ["shrimp"],
      blockedCategories: ["shellfish"],
      ambiguousTerms: [],
      message: "Guest shellfish allergy",
    } as any);
  });

  it.each(["create-dish", "craving-creator", "snack-creator", "beverage_creator"])(
    "resolves a browser session for the shared %s preflight, not body-supplied identity",
    async (builderId) => {
      const agent = request.agent(makeApp());
      await agent.post("/test/session").send({}).expect(200);
      const response = await agent.post("/api/safety-check")
        .set("x-safety-auth-intent", "authenticated")
        .send({ input: "gumbo", builderId, guestAllergies: ["peanuts"], userId: "other-user" })
        .expect(200);

      expect(response.body.message).toBe("Safe for this user");
      expect(safetyCheck).toHaveBeenCalledWith(
        user.id,
        { kind: "food_intent", requestedDish: "gumbo" },
        builderId,
        expect.objectContaining({ safetyMode: "STRICT" }),
      );
      expect(guestCheck).not.toHaveBeenCalled();
      expect(tokenLookup).not.toHaveBeenCalled();
    },
  );

  it("uses a valid native bearer when no session exists", async () => {
    tokenLookup.mockResolvedValue(user as any);
    const response = await request(makeApp())
      .post("/api/safety-check")
      .set("x-auth-token", "valid-native-token")
      .send({ input: "gumbo" })
      .expect(200);

    expect(response.body.message).toBe("Safe for this user");
    expect(safetyCheck).toHaveBeenCalledWith(user.id, expect.anything(), "preflight", expect.anything());
    expect(guestCheck).not.toHaveBeenCalled();
  });

  it("keeps real guests and their optional allergy list on the guest path", async () => {
    const app = makeApp();
    const anonymous = await request(app).post("/api/safety-check").send({ input: "gumbo" }).expect(200);
    expect(anonymous.body.message).toBe("No safety profile configured");

    const allergic = await request(app).post("/api/safety-check")
      .send({ input: "shrimp gumbo", guestAllergies: ["shellfish"] })
      .expect(200);
    expect(allergic.body.result).toBe("BLOCKED");
    expect(guestCheck).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "guest", allergies: ["shellfish"] }),
      { kind: "food_intent", requestedDish: "shrimp gumbo" },
    );
    expect(safetyCheck).not.toHaveBeenCalled();
  });

  it("does not downgrade an invalid or expired browser session to a guest", async () => {
    const agent = request.agent(makeApp());
    await agent.post("/test/session").send({ securityVersion: 2 }).expect(200);
    await agent.post("/api/safety-check")
      .set("x-safety-auth-intent", "authenticated")
      .send({ input: "gumbo" })
      .expect(401);
    // A destroyed or expired server session still has a browser that expects
    // authentication; its explicit intent must not turn into allergy-free SAFE.
    await agent.post("/api/safety-check")
      .set("x-safety-auth-intent", "authenticated")
      .send({ input: "gumbo" })
      .expect(401);
    expect(safetyCheck).not.toHaveBeenCalled();
    expect(guestCheck).not.toHaveBeenCalled();
  });

  it("applies the authenticated session idle-time rule at preflight", async () => {
    const agent = request.agent(makeApp());
    await agent.post("/test/session")
      .send({ lastActiveAt: Date.now() - 2 * 60 * 60 * 1000 })
      .expect(200);
    const response = await agent.post("/api/safety-check")
      .set("x-safety-auth-intent", "authenticated")
      .send({ input: "gumbo" })
      .expect(401);
    expect(response.body.code).toBe("SESSION_IDLE_TIMEOUT");
    expect(safetyCheck).not.toHaveBeenCalled();
    expect(guestCheck).not.toHaveBeenCalled();
  });

  it("rejects an expired bearer instead of treating it as a guest", async () => {
    tokenLookup.mockResolvedValue(null);
    await request(makeApp())
      .post("/api/safety-check")
      .set("x-auth-token", "expired-native-token")
      .send({ input: "gumbo" })
      .expect(401);
    expect(safetyCheck).not.toHaveBeenCalled();
    expect(guestCheck).not.toHaveBeenCalled();
  });
});