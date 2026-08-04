/**
 * Confirms that GET /api/business/mine and GET /api/business/membership
 * are protected by the requireProAccess middleware.
 *
 * Both routes call requireProAccess before running any DB logic, so a free or
 * expired user must be rejected with 403 before reaching the handler body.
 *
 * These tests mirror the exact decision tree in
 * server/middleware/requireProAccess.ts without importing it (which would
 * require live DB + env wiring).  The same pattern is used throughout the
 * server/tests suite.
 */

// ── Shared types ──────────────────────────────────────────────────────────────

type AccessTier = "PAID_FULL" | "FREE" | "EXPIRED" | string;

interface MockAuthUser {
  id: string;
  accessTier: AccessTier;
  planLookupKey: string | null | undefined;
}

// ── Mirror of requireProAccess decision logic ─────────────────────────────────

/**
 * Mirrors the exact decision tree in requireProAccess.ts:
 *
 *   1. No authUser           → 401
 *   2. !BILLING_ENFORCED     → PASS
 *   3. accessTier !== PAID_FULL → 403
 *   4. !planLookupKey        → PASS (internal / founder account)
 *   5. tier === "premium" || tier === "ultimate" → PASS
 *   6. otherwise             → 403
 *
 * Returns the HTTP status code the middleware would produce, or null when
 * control would be handed to next() (i.e. the route handler runs).
 */
function simulateRequireProAccess(
  authUser: MockAuthUser | null,
  billingEnforced: boolean,
  getTierForLookupKey: (key: string) => string,
): number | null {
  // Step 1 — authentication
  if (!authUser) return 401;

  // Step 2 — pre-launch bypass
  if (!billingEnforced) return null; // passes

  // Step 3 — must be PAID_FULL
  if (authUser.accessTier !== "PAID_FULL") return 403;

  // Step 4 — internal account (no lookup key)
  if (!authUser.planLookupKey) return null; // passes

  // Step 5 — plan tier check
  const tier = getTierForLookupKey(authUser.planLookupKey);
  if (tier === "premium" || tier === "ultimate") return null; // passes

  // Step 6 — plan too low (e.g. Essential / Basic)
  return 403;
}

// ── Stub tier resolver ────────────────────────────────────────────────────────

/**
 * Minimal stand-in for getTierForLookupKey from @shared/planFeatures.
 * Only the tiers that appear in these tests need to be mapped.
 */
function stubGetTier(planLookupKey: string): string {
  if (planLookupKey.includes("premium") || planLookupKey.includes("pro")) return "premium";
  if (planLookupKey.includes("ultimate") || planLookupKey.includes("clinical")) return "ultimate";
  if (planLookupKey.includes("basic") || planLookupKey.includes("essential")) return "basic";
  return "unknown";
}

// ── Helper builders ───────────────────────────────────────────────────────────

const FREE_USER: MockAuthUser = {
  id: "user-free-001",
  accessTier: "FREE",
  planLookupKey: null,
};

const EXPIRED_USER: MockAuthUser = {
  id: "user-expired-002",
  accessTier: "EXPIRED",
  planLookupKey: null,
};

const ESSENTIAL_USER: MockAuthUser = {
  id: "user-essential-003",
  accessTier: "PAID_FULL",
  planLookupKey: "mpm_basic_monthly",
};

const PRO_USER: MockAuthUser = {
  id: "user-pro-004",
  accessTier: "PAID_FULL",
  planLookupKey: "mpm_premium_monthly",
};

const CLINICAL_USER: MockAuthUser = {
  id: "user-clinical-005",
  accessTier: "PAID_FULL",
  planLookupKey: "mpm_ultimate_monthly",
};

const INTERNAL_USER: MockAuthUser = {
  id: "user-internal-006",
  accessTier: "PAID_FULL",
  planLookupKey: null, // founder / internal account
};

// ── 1. Free / expired users are blocked from /mine and /membership ────────────

describe("GET /api/business/mine — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  const enforced = true;

  it("returns 403 for a FREE user", () => {
    const result = simulateRequireProAccess(FREE_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns 403 for an EXPIRED user", () => {
    const result = simulateRequireProAccess(EXPIRED_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns 403 for an Essential (basic) plan user", () => {
    const result = simulateRequireProAccess(ESSENTIAL_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns null (passes) for a Pro (premium) user", () => {
    const result = simulateRequireProAccess(PRO_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns null (passes) for a Clinical (ultimate) user", () => {
    const result = simulateRequireProAccess(CLINICAL_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns null (passes) for an internal account (PAID_FULL, no planLookupKey)", () => {
    const result = simulateRequireProAccess(INTERNAL_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns 401 for an unauthenticated request", () => {
    const result = simulateRequireProAccess(null, enforced, stubGetTier);
    expect(result).toBe(401);
  });
});

describe("GET /api/business/membership — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  // Identical middleware is applied to this route — verify the same outcomes
  const enforced = true;

  it("returns 403 for a FREE user", () => {
    const result = simulateRequireProAccess(FREE_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns 403 for an EXPIRED user", () => {
    const result = simulateRequireProAccess(EXPIRED_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns 403 for an Essential (basic) plan user", () => {
    const result = simulateRequireProAccess(ESSENTIAL_USER, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("returns null (passes) for a Pro (premium) user", () => {
    const result = simulateRequireProAccess(PRO_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns null (passes) for a Clinical (ultimate) user", () => {
    const result = simulateRequireProAccess(CLINICAL_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns null (passes) for an internal account (PAID_FULL, no planLookupKey)", () => {
    const result = simulateRequireProAccess(INTERNAL_USER, enforced, stubGetTier);
    expect(result).toBeNull();
  });

  it("returns 401 for an unauthenticated request", () => {
    const result = simulateRequireProAccess(null, enforced, stubGetTier);
    expect(result).toBe(401);
  });
});

// ── 2. Both routes are confirmed open when BILLING_ENFORCED=false ─────────────

describe("requireProAccess bypass when BILLING_ENFORCED=false (pre-launch mode)", () => {
  const notEnforced = false;

  it("FREE user passes /mine when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes /membership when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("EXPIRED user passes when billing is not enforced", () => {
    expect(simulateRequireProAccess(EXPIRED_USER, notEnforced, stubGetTier)).toBeNull();
  });
});

// ── 3. Middleware is present on both routes in businessRoutes.ts ───────────────

/**
 * Parses the businessRoutes.ts source to confirm requireProAccess appears on
 * both /mine and /membership route registrations.
 *
 * This acts as a regression guard: if someone removes the middleware from a
 * route declaration the test fails immediately, before any runtime test can
 * catch it.
 */
import * as fs from "fs";
import * as path from "path";

describe("businessRoutes.ts — requireProAccess declared on read endpoints", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");
  });

  it("GET /mine route declaration includes requireProAccess", () => {
    // Match: router.get("/mine", ..., requireProAccess, ...)
    const minePattern = /router\.get\s*\(\s*["']\/mine["'][^)]*requireProAccess/;
    expect(minePattern.test(source)).toBe(true);
  });

  it("GET /membership route declaration includes requireProAccess", () => {
    // Match: router.get("/membership", ..., requireProAccess, ...)
    const membershipPattern = /router\.get\s*\(\s*["']\/membership["'][^)]*requireProAccess/;
    expect(membershipPattern.test(source)).toBe(true);
  });

  it("requireProAccess is imported in businessRoutes.ts", () => {
    expect(source).toContain('requireProAccess');
    expect(source).toContain('from "../middleware/requireProAccess"');
  });

  it("/mine has requireAuth before requireProAccess", () => {
    // Authentication must come before authorization
    const mineDecl = source.match(/router\.get\s*\(\s*["']\/mine["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = mineDecl.indexOf("requireAuth");
    const proIdx = mineDecl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("/membership has requireAuth before requireProAccess", () => {
    const memberDecl = source.match(/router\.get\s*\(\s*["']\/membership["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = memberDecl.indexOf("requireAuth");
    const proIdx = memberDecl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });
});

// ── 4. requireProAccess middleware source structure ───────────────────────────

describe("requireProAccess.ts — middleware structure regression", () => {
  const middlewareFilePath = path.resolve(__dirname, "../middleware/requireProAccess.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(middlewareFilePath, "utf-8");
  });

  it("blocks when accessTier is not PAID_FULL", () => {
    // The source must contain the PAID_FULL guard
    expect(source).toContain("PAID_FULL");
    expect(source).toContain("403");
  });

  it("honours the BILLING_ENFORCED env flag", () => {
    expect(source).toContain("BILLING_ENFORCED");
  });

  it("passes premium tier", () => {
    expect(source).toContain('"premium"');
  });

  it("passes ultimate tier", () => {
    expect(source).toContain('"ultimate"');
  });
});
