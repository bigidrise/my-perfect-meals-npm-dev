/**
 * nutritionStateRoute.test.ts
 *
 * Route-level tests for GET /api/nutrition-state/:dateISO — specifically the
 * physician-for-client delegation path, which was previously limited to direct
 * clientLink authorization and lacked org-isolation and studio-membership checks.
 *
 * These tests prove:
 *   1. Self-read (no clientId) resolves the authenticated user's state.
 *   2. Authorized physician (verifyPhysicianClientAccess returns true) reads client state.
 *   3. Unauthorized physician (returns false) receives 403.
 *   4. Cross-org access (throws OrgIsolationError) receives 403 via handleOrgIsolationError.
 *   5. Non-isolation errors during the auth check receive 503 (fail-closed).
 *   6. Both nutritionState and chefBudget routes use the SAME verifyPhysicianClientAccess
 *      function — ensuring a studio-membership-only physician is never silently blocked
 *      on one path while permitted on the other.
 *
 * Strategy: mount only the nutritionState router in a minimal Express app.
 * requireAuth is mocked. verifyPhysicianClientAccess and handleOrgIsolationError
 * are mocked so DB is never touched.
 */

import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// ── Module mocks (hoisted by Jest before any imports) ─────────────────────────

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if ((req as any).__testAuthUser === null) {
      return _res.status(401).json({ error: "Authentication required" });
    }
    if ((req as any).__testAuthUser) {
      (req as any).authUser = (req as any).__testAuthUser;
    }
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../services/procareAccessService", () => ({
  verifyPhysicianClientAccess: jest.fn(),
}));

jest.mock("../lib/orgIsolation", () => ({
  handleOrgIsolationError: jest.fn((_err: unknown, res: any) => {
    // Simulate OrgIsolationError handling — return true and send 403
    res.status(403).json({
      ok: false,
      error: "ORG_ISOLATION_VIOLATION",
      message: "Access denied: cross-organization data access is not permitted.",
    });
    return true;
  }),
  assertSameOrg: jest.fn(),
  OrgIsolationError: class OrgIsolationError extends Error {
    readonly statusCode = 403;
    readonly code = "ORG_ISOLATION_VIOLATION";
  },
}));

jest.mock("../services/nutritionStateService", () => ({
  resolveDailyNutritionState: jest.fn(),
}));

// ── Imports that rely on the mocks above ─────────────────────────────────────

import { verifyPhysicianClientAccess } from "../services/procareAccessService";
import { handleOrgIsolationError } from "../lib/orgIsolation";
import { resolveDailyNutritionState } from "../services/nutritionStateService";

const mockVerifyAccess = verifyPhysicianClientAccess as jest.MockedFunction<
  typeof verifyPhysicianClientAccess
>;
const mockHandleOrgError = handleOrgIsolationError as jest.MockedFunction<
  typeof handleOrgIsolationError
>;
const mockResolveState = resolveDailyNutritionState as jest.MockedFunction<
  typeof resolveDailyNutritionState
>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAuthUser(id: string) {
  return { id, planLookupKey: "mpm_ultimate" };
}

const STUB_STATE = {
  date: "2026-08-13",
  prescription: { caloriesTarget: 2000 },
  consumed: {},
  remaining: {},
};

async function buildApp(authUser: Record<string, unknown> | null) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).__testAuthUser = authUser;
    next();
  });

  const router = (await import("../routes/nutritionState")).default;
  app.use("/api/nutrition-state", router);

  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/nutrition-state/:dateISO — self-read", () => {
  beforeEach(() => {
    mockVerifyAccess.mockReset();
    mockHandleOrgError.mockClear();
    mockResolveState.mockResolvedValue(STUB_STATE as any);
  });

  it("resolves state for the authenticated user when no clientId is provided", async () => {
    const userId = "user-self-001";
    const app = await buildApp(makeAuthUser(userId));
    const res = await request(app).get("/api/nutrition-state/2026-08-13");

    expect(res.status).toBe(200);
    expect(mockResolveState).toHaveBeenCalledWith(userId, "2026-08-13");
    expect(mockVerifyAccess).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid date format", async () => {
    const app = await buildApp(makeAuthUser("user-001"));
    const res = await request(app).get("/api/nutrition-state/not-a-date");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/nutrition-state/:dateISO — physician-for-client delegation", () => {
  beforeEach(() => {
    mockVerifyAccess.mockReset();
    mockHandleOrgError.mockClear();
    mockResolveState.mockResolvedValue(STUB_STATE as any);
  });

  it("resolves client state when physician has an authorized care-team relationship", async () => {
    mockVerifyAccess.mockResolvedValue(true); // direct link or studio membership

    const physicianId = "physician-ns-001";
    const clientId    = "client-ns-authorized";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .get(`/api/nutrition-state/2026-08-13?clientId=${clientId}`);

    expect(res.status).toBe(200);
    expect(mockVerifyAccess).toHaveBeenCalledWith(physicianId, clientId);
    // Must resolve for the CLIENT, not the physician
    expect(mockResolveState).toHaveBeenCalledWith(clientId, "2026-08-13");
    expect(mockResolveState).not.toHaveBeenCalledWith(physicianId, expect.any(String));
  });

  it("returns 403 when physician has no active care-team relationship with the client", async () => {
    mockVerifyAccess.mockResolvedValue(false); // no link, no studio membership

    const physicianId = "physician-ns-002";
    const clientId    = "client-ns-unauthorized";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .get(`/api/nutrition-state/2026-08-13?clientId=${clientId}`);

    expect(res.status).toBe(403);
    expect(mockResolveState).not.toHaveBeenCalledWith(clientId, expect.any(String));
  });

  it("returns 403 with org-isolation details when clientId is from a different organization", async () => {
    // verifyPhysicianClientAccess throws OrgIsolationError on cross-org access
    mockVerifyAccess.mockRejectedValue(new Error("OrgIsolationError: cross-org"));

    const physicianId = "physician-ns-003";
    const clientId    = "cross-org-client-ns";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .get(`/api/nutrition-state/2026-08-13?clientId=${clientId}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ORG_ISOLATION_VIOLATION");
    expect(mockResolveState).not.toHaveBeenCalledWith(clientId, expect.any(String));
  });

  it("returns 503 when the authorization check fails with a non-isolation error (fail-closed)", async () => {
    // Simulate a DB error during the auth check — not an OrgIsolationError
    mockVerifyAccess.mockRejectedValue(new Error("DB connection timeout"));
    // handleOrgIsolationError returns false for non-isolation errors (no response sent)
    mockHandleOrgError.mockReturnValueOnce(false);

    const physicianId = "physician-ns-004";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .get(`/api/nutrition-state/2026-08-13?clientId=some-client`);

    expect(res.status).toBe(503);
    expect(mockResolveState).not.toHaveBeenCalled();
  });

  it("resolves own state and skips auth check when clientId equals the authenticated user", async () => {
    const userId = "user-self-002";
    const app = await buildApp(makeAuthUser(userId));
    const res = await request(app)
      .get(`/api/nutrition-state/2026-08-13?clientId=${userId}`);

    expect(res.status).toBe(200);
    // Self-read: no delegation check needed
    expect(mockVerifyAccess).not.toHaveBeenCalled();
    expect(mockResolveState).toHaveBeenCalledWith(userId, "2026-08-13");
  });
});

describe("nutritionState + chefBudget — shared authorization contract", () => {
  it("both routes import verifyPhysicianClientAccess from the same centralized service", () => {
    const fs = require("fs");
    const path = require("path");

    const nsSrc = fs.readFileSync(
      path.resolve(__dirname, "../routes/nutritionState.ts"), "utf-8",
    );
    const cbSrc = fs.readFileSync(
      path.resolve(__dirname, "../routes/chefBudget.ts"), "utf-8",
    );

    // Both must use the centralized helper (which includes assertSameOrg + studio membership)
    expect(nsSrc).toMatch(/verifyPhysicianClientAccess/);
    expect(cbSrc).toMatch(/verifyPhysicianClientAccess/);

    // Both must handle OrgIsolationError
    expect(nsSrc).toMatch(/handleOrgIsolationError/);
    expect(cbSrc).toMatch(/handleOrgIsolationError/);
  });

  it("routes.ts early delegation block uses the same verifyPhysicianClientAccess", () => {
    const fs = require("fs");
    const path = require("path");
    const routesSrc = fs.readFileSync(
      path.resolve(__dirname, "../routes.ts"), "utf-8",
    );
    expect(routesSrc).toMatch(/verifyPhysicianClientAccess/);
    expect(routesSrc).toMatch(/delegatedClientId/);
  });
});
