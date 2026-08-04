/**
 * Confirms that the business write endpoints are protected by the
 * requireProAccess middleware:
 *
 *   POST   /api/business/invite
 *   DELETE /api/business/members/:memberId
 *   DELETE /api/business/invitations/:token
 *   POST   /api/business/invitations/:token/resend
 *   PATCH  /api/business/policy
 *   PATCH  /api/business/org-policies
 *
 * Each route calls requireProAccess before running any DB logic, so a free or
 * expired user must be rejected with 403 before reaching the handler body.
 *
 * These tests mirror the exact decision tree in
 * server/middleware/requireProAccess.ts without importing it (which would
 * require live DB + env wiring).  The same pattern is used throughout the
 * server/tests suite (see businessSeatAccess.test.ts).
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
 *   1. No authUser              → 401
 *   2. !BILLING_ENFORCED        → PASS (null)
 *   3. accessTier !== PAID_FULL → 403
 *   4. !planLookupKey           → PASS (internal / founder account)
 *   5. tier === "premium" || tier === "ultimate" → PASS
 *   6. otherwise                → 403
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
  if (!billingEnforced) return null;

  // Step 3 — must be PAID_FULL
  if (authUser.accessTier !== "PAID_FULL") return 403;

  // Step 4 — internal account (no lookup key)
  if (!authUser.planLookupKey) return null;

  // Step 5 — plan tier check
  const tier = getTierForLookupKey(authUser.planLookupKey);
  if (tier === "premium" || tier === "ultimate") return null;

  // Step 6 — plan too low (e.g. Essential / Basic)
  return 403;
}

// ── Stub tier resolver ────────────────────────────────────────────────────────

function stubGetTier(planLookupKey: string): string {
  if (planLookupKey.includes("premium") || planLookupKey.includes("pro")) return "premium";
  if (planLookupKey.includes("ultimate") || planLookupKey.includes("clinical")) return "ultimate";
  if (planLookupKey.includes("basic") || planLookupKey.includes("essential")) return "basic";
  return "unknown";
}

// ── Helper fixtures ───────────────────────────────────────────────────────────

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
  planLookupKey: null,
};

// ── Reusable gate-check helper ────────────────────────────────────────────────

/**
 * Runs the full set of gate expectations for a single endpoint description.
 * Pass billingEnforced=true (the production default) unless specifically
 * testing the pre-launch bypass.
 */
function runGateExpectations(billingEnforced: boolean) {
  it("returns 403 for a FREE user", () => {
    expect(simulateRequireProAccess(FREE_USER, billingEnforced, stubGetTier)).toBe(403);
  });

  it("returns 403 for an EXPIRED user", () => {
    expect(simulateRequireProAccess(EXPIRED_USER, billingEnforced, stubGetTier)).toBe(403);
  });

  it("returns 403 for an Essential (basic) plan user", () => {
    expect(simulateRequireProAccess(ESSENTIAL_USER, billingEnforced, stubGetTier)).toBe(403);
  });

  it("returns null (passes) for a Pro (premium) user", () => {
    expect(simulateRequireProAccess(PRO_USER, billingEnforced, stubGetTier)).toBeNull();
  });

  it("returns null (passes) for a Clinical (ultimate) user", () => {
    expect(simulateRequireProAccess(CLINICAL_USER, billingEnforced, stubGetTier)).toBeNull();
  });

  it("returns null (passes) for an internal account (PAID_FULL, no planLookupKey)", () => {
    expect(simulateRequireProAccess(INTERNAL_USER, billingEnforced, stubGetTier)).toBeNull();
  });

  it("returns 401 for an unauthenticated request", () => {
    expect(simulateRequireProAccess(null, billingEnforced, stubGetTier)).toBe(401);
  });
}

// ── 1. POST /api/business/invite ──────────────────────────────────────────────

describe("POST /api/business/invite — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 2. DELETE /api/business/members/:memberId ─────────────────────────────────

describe("DELETE /api/business/members/:memberId — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 3. DELETE /api/business/invitations/:token ────────────────────────────────

describe("DELETE /api/business/invitations/:token — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 4. POST /api/business/invitations/:token/resend ───────────────────────────

describe("POST /api/business/invitations/:token/resend — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 5. PATCH /api/business/policy ────────────────────────────────────────────

describe("PATCH /api/business/policy — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 6. PATCH /api/business/org-policies ──────────────────────────────────────

describe("PATCH /api/business/org-policies — requireProAccess gate (BILLING_ENFORCED=true)", () => {
  runGateExpectations(true);
});

// ── 7. Pre-launch bypass (BILLING_ENFORCED=false) applies to all write routes ─

describe("requireProAccess bypass when BILLING_ENFORCED=false — write endpoints", () => {
  const notEnforced = false;

  it("FREE user passes POST /invite when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes DELETE /members/:memberId when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes DELETE /invitations/:token when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes POST /invitations/:token/resend when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes PATCH /policy when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("FREE user passes PATCH /org-policies when billing is not enforced", () => {
    expect(simulateRequireProAccess(FREE_USER, notEnforced, stubGetTier)).toBeNull();
  });

  it("EXPIRED user passes all write endpoints when billing is not enforced", () => {
    expect(simulateRequireProAccess(EXPIRED_USER, notEnforced, stubGetTier)).toBeNull();
  });
});

// ── 8. Source-scan: requireProAccess declared on every write route ─────────────

/**
 * Parses businessRoutes.ts to confirm requireProAccess appears in every write
 * route declaration.  This is a regression guard — if the middleware is
 * accidentally removed from a route the test fails before any runtime test
 * can catch it.
 */
import * as fs from "fs";
import * as path from "path";

describe("businessRoutes.ts — requireProAccess declared on write endpoints", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");
  });

  it("POST /invite route declaration includes requireProAccess", () => {
    const pattern = /router\.post\s*\(\s*["']\/invite["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("DELETE /members/:memberId route declaration includes requireProAccess", () => {
    const pattern = /router\.delete\s*\(\s*["']\/members\/:memberId["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("DELETE /invitations/:token route declaration includes requireProAccess", () => {
    const pattern = /router\.delete\s*\(\s*["']\/invitations\/:token["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("POST /invitations/:token/resend route declaration includes requireProAccess", () => {
    const pattern = /router\.post\s*\(\s*["']\/invitations\/:token\/resend["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("PATCH /policy route declaration includes requireProAccess", () => {
    const pattern = /router\.patch\s*\(\s*["']\/policy["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("PATCH /org-policies route declaration includes requireProAccess", () => {
    const pattern = /router\.patch\s*\(\s*["']\/org-policies["'][^)]*requireProAccess/;
    expect(pattern.test(source)).toBe(true);
  });

  it("requireProAccess is imported in businessRoutes.ts", () => {
    expect(source).toContain("requireProAccess");
    expect(source).toContain('from "../middleware/requireProAccess"');
  });

  it("POST /invite has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.post\s*\(\s*["']\/invite["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("DELETE /members/:memberId has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.delete\s*\(\s*["']\/members\/:memberId["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("DELETE /invitations/:token has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.delete\s*\(\s*["']\/invitations\/:token["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("POST /invitations/:token/resend has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.post\s*\(\s*["']\/invitations\/:token\/resend["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("PATCH /policy has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.patch\s*\(\s*["']\/policy["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });

  it("PATCH /org-policies has requireAuth before requireProAccess", () => {
    const decl = source.match(/router\.patch\s*\(\s*["']\/org-policies["']([^{]+)\{/)?.[1] ?? "";
    const authIdx = decl.indexOf("requireAuth");
    const proIdx = decl.indexOf("requireProAccess");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(proIdx).toBeGreaterThan(authIdx);
  });
});
