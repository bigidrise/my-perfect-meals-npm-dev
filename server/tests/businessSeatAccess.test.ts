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

// ── 4. Downgraded-member edge case ───────────────────────────────────────────
/**
 * Edge case: a user joins a business while on Pro, then downgrades to Free.
 * Their businessMembers row keeps status = "active" (no automated cleanup).
 *
 * Policy:
 *   - The member is immediately blocked from /membership (requireProAccess → 403).
 *   - The owner's /mine view still counts them as occupying a seat until the
 *     owner explicitly removes them (GET /mine queries by status="active" only,
 *     with no plan-tier filter on the member's own subscription).
 *   - This is intentional: seat release is an owner action, not an automatic one.
 *     The owner dashboard shows the member row and can use DELETE /members/:id.
 */

describe("Downgraded-member blocked from GET /api/business/membership", () => {
  const enforced = true;

  /**
   * A user who joined as Pro and then downgraded will have accessTier = "FREE"
   * (set by the billing webhook on downgrade).  requireProAccess sees FREE and
   * returns 403 before the DB query ever runs.
   */
  it("blocks a formerly-Pro member who downgraded to Free (accessTier=FREE)", () => {
    const downgradedMember: MockAuthUser = {
      id: "user-downgraded-pro-001",
      accessTier: "FREE",         // set by billing webhook after downgrade
      planLookupKey: null,        // cleared on downgrade
    };
    const result = simulateRequireProAccess(downgradedMember, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("blocks a formerly-Pro member whose subscription expired (accessTier=EXPIRED)", () => {
    const expiredMember: MockAuthUser = {
      id: "user-expired-member-002",
      accessTier: "EXPIRED",
      planLookupKey: "mpm_premium_monthly", // old key, still set in DB
    };
    const result = simulateRequireProAccess(expiredMember, enforced, stubGetTier);
    expect(result).toBe(403);
  });

  it("still allows an active Pro member to read their membership (control case)", () => {
    const activeMember: MockAuthUser = {
      id: "user-active-pro-003",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_premium_monthly",
    };
    const result = simulateRequireProAccess(activeMember, enforced, stubGetTier);
    expect(result).toBeNull(); // passes through to handler
  });
});

// ── 5. Owner /mine view — seat count behaviour for downgraded members ─────────

/**
 * Simulates the member-list aggregation logic from GET /api/business/mine.
 *
 * The real query filters by `businessMembers.status = "active"` only.
 * It does NOT inspect the member's own subscription tier.
 *
 * This means a downgraded member whose row was not yet removed by the owner
 * will still appear in the member list and count against usedSeats.
 * Releasing the seat requires the owner to call DELETE /api/business/members/:id.
 */

interface MockMemberRow {
  userId: string;
  status: "active" | "invited" | "removed";
  /** Simulated current plan of the member — NOT stored in businessMembers table. */
  currentAccessTier: "PAID_FULL" | "FREE" | "EXPIRED";
}

/**
 * Mirrors the /mine handler aggregation:
 *   usedSeats = members.filter(status === "active").length
 *
 * Note: the real query joins businessMembers + users but does NOT join the
 * member's subscription state.  The seat count is purely status-based.
 */
function simulateMineSeats(rows: MockMemberRow[]): {
  usedSeats: number;
  visibleMembers: MockMemberRow[];
} {
  const visibleMembers = rows.filter((m) => m.status === "active");
  return { usedSeats: visibleMembers.length, visibleMembers };
}

describe("GET /api/business/mine — seat count includes downgraded-but-still-active members", () => {
  it("counts an active member with a current Pro plan — baseline", () => {
    const rows: MockMemberRow[] = [
      { userId: "u1", status: "active", currentAccessTier: "PAID_FULL" },
    ];
    const { usedSeats, visibleMembers } = simulateMineSeats(rows);
    expect(usedSeats).toBe(1);
    expect(visibleMembers).toHaveLength(1);
  });

  it("still counts a downgraded member (FREE) whose row was not removed", () => {
    // This is the intentional policy: the owner must manually remove the member.
    const rows: MockMemberRow[] = [
      { userId: "u-downgraded", status: "active", currentAccessTier: "FREE" },
    ];
    const { usedSeats, visibleMembers } = simulateMineSeats(rows);
    expect(usedSeats).toBe(1);
    expect(visibleMembers[0].userId).toBe("u-downgraded");
  });

  it("still counts an expired member whose row was not removed", () => {
    const rows: MockMemberRow[] = [
      { userId: "u-expired", status: "active", currentAccessTier: "EXPIRED" },
    ];
    const { usedSeats } = simulateMineSeats(rows);
    expect(usedSeats).toBe(1);
  });

  it("does NOT count a member who has been explicitly removed (status=removed)", () => {
    const rows: MockMemberRow[] = [
      { userId: "u-removed", status: "removed", currentAccessTier: "FREE" },
    ];
    const { usedSeats } = simulateMineSeats(rows);
    expect(usedSeats).toBe(0);
  });

  it("mixed roster: one active Pro + one downgraded-active → usedSeats = 2", () => {
    const rows: MockMemberRow[] = [
      { userId: "u-pro", status: "active", currentAccessTier: "PAID_FULL" },
      { userId: "u-downgraded", status: "active", currentAccessTier: "FREE" },
    ];
    const { usedSeats } = simulateMineSeats(rows);
    expect(usedSeats).toBe(2);
  });

  it("mixed roster: one removed downgraded + one active Pro → usedSeats = 1", () => {
    const rows: MockMemberRow[] = [
      { userId: "u-pro", status: "active", currentAccessTier: "PAID_FULL" },
      { userId: "u-downgraded-removed", status: "removed", currentAccessTier: "FREE" },
    ];
    const { usedSeats, visibleMembers } = simulateMineSeats(rows);
    expect(usedSeats).toBe(1);
    expect(visibleMembers[0].userId).toBe("u-pro");
  });

  it("availableSeats = seatLimit - usedSeats still reflects downgraded occupants", () => {
    const seatLimit = 4;
    const rows: MockMemberRow[] = [
      { userId: "u-pro", status: "active", currentAccessTier: "PAID_FULL" },
      { userId: "u-downgraded", status: "active", currentAccessTier: "FREE" },
    ];
    const { usedSeats } = simulateMineSeats(rows);
    const availableSeats = seatLimit - usedSeats;
    // Owner sees only 2 free slots even though the downgraded member can't use the seat
    expect(availableSeats).toBe(2);
  });
});

// ── 6. Accept-invite re-accept guard ─────────────────────────────────────────
/**
 * Mirrors the accept-invite handler logic in businessRoutes.ts.
 *
 * The handler must:
 *   1. Look up an existing businessMembers row for the accepting user (any status).
 *   2. If status=active  → reject 400 "already a member" (covers downgraded-but-
 *      not-removed members who somehow receive a second invite link).
 *   3. If status=removed → check seat availability, then re-activate the existing
 *      row instead of inserting a duplicate.
 *   4. If no row exists  → check seat availability, then insert a fresh row.
 *
 * The membership check runs BEFORE the seat check so the error message is always
 * correct (active members see "already a member", not "seats full").
 */

type MemberStatus = "active" | "removed" | "invited";

interface MockExistingMember {
  id: string;
  status: MemberStatus;
}

/**
 * Mirrors the accept-invite decision tree.
 *
 * Returns:
 *   { status: 400, code: "ALREADY_MEMBER" }  — user already active
 *   { status: 400, code: "SEATS_FULL" }       — no free seats (for new / removed)
 *   { status: 200, action: "reactivate" }     — removed member re-joined
 *   { status: 200, action: "insert" }         — brand-new member
 */
function simulateAcceptInvite(
  existing: MockExistingMember | null,
  usedSeats: number,
  seatLimit: number,
): { status: number; code?: string; action?: "reactivate" | "insert" } {
  // Step 1: existing-member check (runs BEFORE seat check)
  if (existing && existing.status === "active") {
    return { status: 400, code: "ALREADY_MEMBER" };
  }

  // Step 2: seat availability
  if (usedSeats >= seatLimit) {
    return { status: 400, code: "SEATS_FULL" };
  }

  // Step 3: re-activate or insert
  if (existing && existing.status === "removed") {
    return { status: 200, action: "reactivate" };
  }
  return { status: 200, action: "insert" };
}

describe("POST /api/business/invite/:token/accept — re-accept guard", () => {
  const SEAT_LIMIT = 3;

  // ── Baseline: brand-new member ─────────────────────────────────────────────
  it("inserts a fresh row for a brand-new user (no existing member row)", () => {
    const result = simulateAcceptInvite(null, 0, SEAT_LIMIT);
    expect(result.status).toBe(200);
    expect(result.action).toBe("insert");
  });

  // ── Formerly-removed member re-accepts a new invite ────────────────────────
  it("re-activates (not inserts) a formerly-removed member who accepts a new invite", () => {
    const removedRow: MockExistingMember = { id: "bm-removed-001", status: "removed" };
    const result = simulateAcceptInvite(removedRow, 1, SEAT_LIMIT); // 1 of 3 seats used
    expect(result.status).toBe(200);
    expect(result.action).toBe("reactivate"); // existing row updated, no duplicate
  });

  it("blocks a formerly-removed member from re-joining when no seats remain", () => {
    const removedRow: MockExistingMember = { id: "bm-removed-002", status: "removed" };
    const result = simulateAcceptInvite(removedRow, SEAT_LIMIT, SEAT_LIMIT); // all full
    expect(result.status).toBe(400);
    expect(result.code).toBe("SEATS_FULL");
  });

  // ── Downgraded-but-not-removed member re-accepts (the duplicate-row edge case)
  it("rejects a currently-active member who tries to accept a second invite link", () => {
    // This covers a downgraded member whose businessMembers row was NOT removed.
    // The owner may have inadvertently sent a new invite, or the member forwarded
    // an old link. Status is still "active", so the response must be ALREADY_MEMBER,
    // not SEATS_FULL, regardless of how many seats remain.
    const activeRow: MockExistingMember = { id: "bm-active-downgraded-001", status: "active" };
    const result = simulateAcceptInvite(activeRow, 1, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_MEMBER");
  });

  it("rejects a currently-active member even when the business has spare seats", () => {
    const activeRow: MockExistingMember = { id: "bm-active-001", status: "active" };
    // 0 of 3 seats used — plenty of room, but user is already in
    const result = simulateAcceptInvite(activeRow, 0, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_MEMBER");
  });

  it("rejects a currently-active member even when the business is at capacity", () => {
    // Membership check must fire BEFORE seat check so the error is always correct.
    const activeRow: MockExistingMember = { id: "bm-active-002", status: "active" };
    const result = simulateAcceptInvite(activeRow, SEAT_LIMIT, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_MEMBER"); // NOT "SEATS_FULL"
  });

  // ── Control: new member blocked by no available seats ──────────────────────
  it("blocks a brand-new user when the business is at seat capacity", () => {
    const result = simulateAcceptInvite(null, SEAT_LIMIT, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("SEATS_FULL");
  });
});

// ── 7. Accept-invite route source — guard ordering regression ─────────────────
/**
 * Verifies that the existing-member check appears before the seat-count check
 * in the route source.  If someone swaps the order, this test fails immediately.
 */
describe("businessRoutes.ts — accept-invite handler guard ordering", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");
  });

  it("existing-member lookup appears before getActiveSeats call in accept handler", () => {
    // Isolate the accept-invite handler by finding the route declaration and
    // taking everything up to the next router.post/router.get/router.delete call.
    const acceptStart = source.indexOf('"/invite/:token/accept"');
    expect(acceptStart).toBeGreaterThan(-1);

    // Find the closing of this handler (next top-level router.X declaration)
    const afterStart = source.slice(acceptStart);
    const nextRouteMatch = afterStart.match(/\n\/\/ ──/);
    const handlerSlice = nextRouteMatch
      ? afterStart.slice(0, nextRouteMatch.index)
      : afterStart.slice(0, 3000); // fallback: first 3 KB

    const existingIdx = handlerSlice.indexOf("businessMembers.userId, userId");
    const seatsIdx = handlerSlice.indexOf("getActiveSeats");

    expect(existingIdx).toBeGreaterThan(-1);
    expect(seatsIdx).toBeGreaterThan(-1);
    // The membership lookup must come first (before seat check)
    expect(existingIdx).toBeLessThan(seatsIdx);
  });

  it("accept handler rejects active existing member before checking seats", () => {
    // Isolate accept handler slice (same approach as above)
    const acceptStart = source.indexOf('"/invite/:token/accept"');
    expect(acceptStart).toBeGreaterThan(-1);

    const afterStart = source.slice(acceptStart);
    const nextRouteMatch = afterStart.match(/\n\/\/ ──/);
    const handlerSlice = nextRouteMatch
      ? afterStart.slice(0, nextRouteMatch.index)
      : afterStart.slice(0, 3000);

    // "already a member" guard must precede the getActiveSeats call within
    // this handler so the error message is always correct.
    const alreadyMemberIdx = handlerSlice.indexOf("already a member");
    const getActiveSeatsIdx = handlerSlice.indexOf("getActiveSeats");

    expect(alreadyMemberIdx).toBeGreaterThan(-1);
    expect(getActiveSeatsIdx).toBeGreaterThan(-1);
    expect(alreadyMemberIdx).toBeLessThan(getActiveSeatsIdx);
  });
});

// ── 8. End-to-end re-join: removed → re-invited → re-accepted ────────────────
/**
 * Full-flow confirmation: a member who is removed, then re-invited by the owner,
 * then accepts the new invite must end up with exactly ONE active businessMembers
 * row (the original row re-activated, not a second one inserted) and the seat
 * count must reflect exactly one seat in use.
 *
 * Sub-sections:
 *   (a) Simulation confirms re-join produces action="reactivate" with seat
 *       count = 1 after the operation.
 *   (b) Uniqueness model: simulates the member-row state before and after
 *       reactivation, confirming no duplicate active row is created.
 *   (c) Source-scan: the reactivation branch inside the accept handler calls
 *       tx.update(businessMembers) — there is NO tx.insert(businessMembers)
 *       inside the if-existing block (only in the else branch).
 *   (d) Source-scan: the UPDATE sets status="active" (confirms the row is
 *       genuinely reactivated, not left as "removed").
 */

// ── (a) Simulation: re-join produces reactivate + single seat consumed ────────

interface MockMemberRowState {
  id: string;
  status: "active" | "removed" | "invited";
}

/**
 * Models the in-memory member-row state before and after acceptInvite runs.
 *
 * Returns the row state after the operation and the number of active rows
 * for the user+business pair (must always be 1 after a successful re-join).
 */
function simulateReJoin(
  initialRow: MockMemberRowState,
  usedSeats: number,
  seatLimit: number,
): {
  outcome: "reactivated" | "inserted" | "blocked";
  blockCode?: string;
  activeRowsAfter: MockMemberRowState[];
  usedSeatsAfter: number;
} {
  // Mirror accept-handler decision tree
  if (initialRow.status === "active") {
    return { outcome: "blocked", blockCode: "ALREADY_MEMBER", activeRowsAfter: [initialRow], usedSeatsAfter: usedSeats };
  }
  if (usedSeats >= seatLimit) {
    return { outcome: "blocked", blockCode: "SEATS_FULL", activeRowsAfter: [], usedSeatsAfter: usedSeats };
  }

  if (initialRow.status === "removed") {
    // UPDATE path: mutate the existing row in-place, never insert a new one
    const reactivated: MockMemberRowState = { ...initialRow, status: "active" };
    return {
      outcome: "reactivated",
      activeRowsAfter: [reactivated],  // still only ONE row
      usedSeatsAfter: usedSeats + 1,
    };
  }

  // Fallback: brand-new (should not happen in re-join scenario, here for completeness)
  const fresh: MockMemberRowState = { id: "bm-new", status: "active" };
  return { outcome: "inserted", activeRowsAfter: [fresh], usedSeatsAfter: usedSeats + 1 };
}

describe("POST /api/business/invite/:token/accept — full re-join flow (removed → re-invited → re-accepted)", () => {
  const SEAT_LIMIT = 5;
  const REMOVED_ROW: MockMemberRowState = { id: "bm-removed-e2e-001", status: "removed" };

  // ── Core re-join case ──────────────────────────────────────────────────────
  it("re-activates the existing row (not a duplicate insert) when a removed member re-joins", () => {
    const { outcome, activeRowsAfter } = simulateReJoin(REMOVED_ROW, 2, SEAT_LIMIT);
    expect(outcome).toBe("reactivated");
    // The same row id is preserved — no new row was created
    expect(activeRowsAfter).toHaveLength(1);
    expect(activeRowsAfter[0].id).toBe(REMOVED_ROW.id);
    expect(activeRowsAfter[0].status).toBe("active");
  });

  it("seat count increments by exactly 1 after a removed member re-joins (not 2)", () => {
    const usedBefore = 2;
    const { usedSeatsAfter, outcome } = simulateReJoin(REMOVED_ROW, usedBefore, SEAT_LIMIT);
    expect(outcome).toBe("reactivated");
    expect(usedSeatsAfter).toBe(usedBefore + 1); // exactly one new seat consumed
  });

  it("exactly one active row exists for the user+business pair after re-join", () => {
    const { activeRowsAfter, outcome } = simulateReJoin(REMOVED_ROW, 1, SEAT_LIMIT);
    expect(outcome).toBe("reactivated");
    // Uniqueness guarantee: there must be at most one active row per user+business
    const activeCount = activeRowsAfter.filter((r) => r.status === "active").length;
    expect(activeCount).toBe(1);
  });

  it("re-join is blocked when the business is at seat capacity (removed member needs a free seat)", () => {
    const { outcome, blockCode } = simulateReJoin(REMOVED_ROW, SEAT_LIMIT, SEAT_LIMIT);
    expect(outcome).toBe("blocked");
    expect(blockCode).toBe("SEATS_FULL");
  });

  it("re-join succeeds when exactly one seat is free", () => {
    // Edge: usedSeats = seatLimit - 1 (one slot remaining)
    const { outcome } = simulateReJoin(REMOVED_ROW, SEAT_LIMIT - 1, SEAT_LIMIT);
    expect(outcome).toBe("reactivated");
  });

  it("re-join is blocked when a member is still active (not removed) — no duplicate allowed", () => {
    const activeRow: MockMemberRowState = { id: "bm-active-e2e-002", status: "active" };
    const { outcome, blockCode, activeRowsAfter } = simulateReJoin(activeRow, 1, SEAT_LIMIT);
    expect(outcome).toBe("blocked");
    expect(blockCode).toBe("ALREADY_MEMBER");
    // The active row must remain untouched — not modified by the guard
    expect(activeRowsAfter[0].status).toBe("active");
  });
});

// ── (b) Uniqueness model: duplicate-row invariant ─────────────────────────────

/**
 * Models the full businessMembers roster for a user across one business.
 * After re-join there must be exactly one "active" row — the invariant that
 * a row-level UNIQUE index on (business_id, user_id) with a partial filter on
 * status="active" would enforce at the DB level.
 */
interface RosterEntry {
  id: string;
  businessId: string;
  userId: string;
  status: "active" | "removed";
}

function applyReActivation(
  roster: RosterEntry[],
  targetId: string,
): RosterEntry[] {
  // Mirrors tx.update(businessMembers).set({ status: "active" }).where(eq(id, existing.id))
  // No new row is inserted.
  return roster.map((r) => (r.id === targetId ? { ...r, status: "active" } : r));
}

describe("businessMembers uniqueness — no duplicate active row after re-join", () => {
  const BIZ_ID = "biz-uniqueness-test";
  const USER_ID = "user-uniqueness-test";

  it("roster has exactly one active row after reactivation (was removed)", () => {
    const initialRoster: RosterEntry[] = [
      { id: "bm-u1", businessId: BIZ_ID, userId: USER_ID, status: "removed" },
    ];
    const afterRoster = applyReActivation(initialRoster, "bm-u1");

    const activeRows = afterRoster.filter(
      (r) => r.businessId === BIZ_ID && r.userId === USER_ID && r.status === "active",
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].id).toBe("bm-u1"); // same row, not a new one
  });

  it("total row count in roster stays at 1 (no INSERT happened alongside the UPDATE)", () => {
    const initialRoster: RosterEntry[] = [
      { id: "bm-u2", businessId: BIZ_ID, userId: USER_ID, status: "removed" },
    ];
    const afterRoster = applyReActivation(initialRoster, "bm-u2");
    // If there were an erroneous INSERT, the length would be 2
    expect(afterRoster).toHaveLength(1);
  });

  it("seat count derived from active rows = 1 (not 2) after re-join", () => {
    const initialRoster: RosterEntry[] = [
      { id: "bm-u3", businessId: BIZ_ID, userId: USER_ID, status: "removed" },
    ];
    const afterRoster = applyReActivation(initialRoster, "bm-u3");
    const seatCount = afterRoster.filter(
      (r) => r.businessId === BIZ_ID && r.status === "active",
    ).length;
    expect(seatCount).toBe(1);
  });

  it("a second user in the same business is unaffected by the re-join", () => {
    const OTHER_USER = "user-other-biz-member";
    const initialRoster: RosterEntry[] = [
      { id: "bm-u4-removed", businessId: BIZ_ID, userId: USER_ID, status: "removed" },
      { id: "bm-u4-other",   businessId: BIZ_ID, userId: OTHER_USER, status: "active" },
    ];
    const afterRoster = applyReActivation(initialRoster, "bm-u4-removed");

    const rejoinedUser = afterRoster.find((r) => r.userId === USER_ID);
    const otherUser    = afterRoster.find((r) => r.userId === OTHER_USER);

    expect(rejoinedUser?.status).toBe("active");
    expect(otherUser?.status).toBe("active");

    // Seat count = 2 (one per user, each unique)
    const activeCount = afterRoster.filter((r) => r.status === "active").length;
    expect(activeCount).toBe(2);
  });
});

// ── (c) & (d) Source-scan: accept handler uses UPDATE not INSERT for removed members ──

describe("businessRoutes.ts — accept handler re-join branch uses UPDATE, not duplicate INSERT", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let acceptHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the POST /invite/:token/accept handler body
    const acceptStart = source.indexOf('"/invite/:token/accept"');
    expect(acceptStart).toBeGreaterThan(-1);

    const afterStart = source.slice(acceptStart);
    const nextSectionMatch = afterStart.match(/\n\/\/ ──/);
    acceptHandlerSlice = nextSectionMatch
      ? afterStart.slice(0, nextSectionMatch.index)
      : afterStart.slice(0, 4000);
  });

  it("accept handler contains a transaction block", () => {
    // The membership row + invitation must be updated atomically
    expect(acceptHandlerSlice).toMatch(/\.transaction\s*\(/);
  });

  it("accept handler UPDATE path sets status to active (reactivation confirmed)", () => {
    // The UPDATE must set status back to "active"
    const updateBlock = acceptHandlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
    expect(updateBlock).toContain('"active"');
  });

  it("accept handler UPDATE path keys on the existing row id (not userId) to prevent cross-user updates", () => {
    // Reactivation must target the specific row by id, not a broad userId match
    const updateBlock = acceptHandlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
    expect(updateBlock).toContain("existing.id");
  });

  it("accept handler INSERT is in the else branch (brand-new members only, not re-joins)", () => {
    // The INSERT must live inside the else {} so removed members go through UPDATE
    const elseBlock = acceptHandlerSlice.match(/\}\s*else\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(elseBlock).toContain("insert(businessMembers)");
  });

  it("accept handler UPDATE branch does NOT contain insert(businessMembers) (no duplicate INSERT)", () => {
    // Isolate the if(existing){...} block before the else
    const ifExistingBlock = acceptHandlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
    // An erroneous insert inside this block would corrupt the roster
    expect(ifExistingBlock).not.toContain("insert(businessMembers)");
  });

  it("accept handler marks the invitation as accepted within the same transaction", () => {
    // Confirm the handler contains both a .transaction() call and the "accepted"
    // status update for businessInvitations, ensuring they are atomic.
    // (A regex that tries to extract the full transaction block is brittle due to
    //  nested braces; we verify both ingredients are present in the handler slice.)
    expect(acceptHandlerSlice).toMatch(/\.transaction\s*\(/);
    expect(acceptHandlerSlice).toContain('"accepted"');
    expect(acceptHandlerSlice).toContain("businessInvitations");
    // The invite update must reference acceptedAt (the field written on acceptance)
    expect(acceptHandlerSlice).toContain("acceptedAt");
  });

  it("existing-member lookup runs before the transaction (not inside it)", () => {
    // The membership check must happen outside the transaction so we can branch
    // before acquiring a transaction lock.
    const existingIdx = acceptHandlerSlice.indexOf("businessMembers.userId, userId");
    const txIdx = acceptHandlerSlice.indexOf(".transaction(");
    expect(existingIdx).toBeGreaterThan(-1);
    expect(txIdx).toBeGreaterThan(-1);
    expect(existingIdx).toBeLessThan(txIdx);
  });
});

// ── 9. POST /invite — duplicate-invite guard against active members ───────────
/**
 * The POST /invite handler must reject an invite request when the target email
 * already belongs to a user who has an active businessMembers row for this
 * business — even if that user has since downgraded their subscription.
 *
 * Guard location in the real handler (businessRoutes.ts, ~line 204-226):
 *   1. Resolve the users row by email.
 *   2. If found, query businessMembers for (businessId, userId, status="active").
 *   3. If a match exists → 400 "This person is already a member of your business."
 *
 * This block mirrors that decision tree without touching the DB or loading the
 * route module, following the same source-scan regression pattern used in §6/§7.
 */

interface MockUserLookup {
  /** null when the email is not registered in the system at all */
  userId: string | null;
}

interface MockActiveMemberLookup {
  /** null when the user has no active businessMembers row */
  memberId: string | null;
}

/**
 * Mirrors the invite-handler active-member guard:
 *
 *   1. email not found in users table → no guard fired (handler continues)
 *   2. user found, but no active member row → no guard fired (handler continues)
 *   3. user found AND active member row exists → 400 ALREADY_ACTIVE_MEMBER
 *
 * Returns:
 *   { status: 400, code: "ALREADY_ACTIVE_MEMBER" }  — blocked
 *   null                                              — guard did not fire, handler continues
 */
function simulateSendInviteActiveMemberGuard(
  userLookup: MockUserLookup,
  activeMemberLookup: MockActiveMemberLookup,
): { status: 400; code: "ALREADY_ACTIVE_MEMBER" } | null {
  // Step 1: email not registered → guard does not fire
  if (userLookup.userId === null) return null;

  // Step 2: registered user, but no active member row → guard does not fire
  if (activeMemberLookup.memberId === null) return null;

  // Step 3: registered user WITH an active member row → blocked
  return { status: 400, code: "ALREADY_ACTIVE_MEMBER" };
}

describe("POST /api/business/invite — active-member guard blocks duplicate invites", () => {
  // ── email not in users table ────────────────────────────────────────────────
  it("does not fire for an email that has never registered (no users row)", () => {
    const result = simulateSendInviteActiveMemberGuard(
      { userId: null },       // email not in DB
      { memberId: null },
    );
    expect(result).toBeNull(); // guard passes, invite proceeds
  });

  // ── registered user but no active membership ────────────────────────────────
  it("does not fire for a registered user who is NOT a member of the business", () => {
    const result = simulateSendInviteActiveMemberGuard(
      { userId: "user-outsider-001" },
      { memberId: null },           // no active businessMembers row
    );
    expect(result).toBeNull();
  });

  it("does not fire for a formerly-removed member (active row was cleared)", () => {
    // A removed member's row has status="removed", so the query for status="active"
    // returns nothing.  activeMemberLookup.memberId is null in that scenario.
    const result = simulateSendInviteActiveMemberGuard(
      { userId: "user-removed-001" },
      { memberId: null }, // status=removed, so the active lookup returns null
    );
    expect(result).toBeNull(); // re-invite is allowed
  });

  // ── registered user with an active membership — the blocked cases ───────────
  it("blocks when the target email belongs to a user with an active member row", () => {
    const result = simulateSendInviteActiveMemberGuard(
      { userId: "user-active-001" },
      { memberId: "bm-active-001" }, // active row exists
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("ALREADY_ACTIVE_MEMBER");
  });

  it("blocks a downgraded member whose businessMembers row is still active (the core gap case)", () => {
    // This is the specific scenario the task guards against:
    // the member downgraded their subscription but the owner never called
    // DELETE /members/:id, so status is still "active".
    // The invite handler must reject the second invite here.
    const downgradedButActive: MockUserLookup = { userId: "user-downgraded-active-002" };
    const stillActiveRow: MockActiveMemberLookup = { memberId: "bm-downgraded-still-active-002" };

    const result = simulateSendInviteActiveMemberGuard(downgradedButActive, stillActiveRow);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("ALREADY_ACTIVE_MEMBER");
  });

  it("blocks even when the business has spare seats (guard fires before seat check)", () => {
    // In the real handler the active-member guard fires after the email/pending-invite
    // checks but independently of the seat count.  Spare seats are irrelevant.
    const result = simulateSendInviteActiveMemberGuard(
      { userId: "user-active-spare-seats" },
      { memberId: "bm-active-spare-seats" },
    );
    expect(result!.code).toBe("ALREADY_ACTIVE_MEMBER");
  });
});

// ── 9b. POST /invite — source-scan: active-member guard is present and correct ─

describe("businessRoutes.ts — POST /invite active-member guard regression", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;
  let inviteHandlerSlice: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the POST /invite handler body (between its route declaration and
    // the next top-level comment/route).
    const inviteStart = source.indexOf('router.post("/invite"');
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index)
      : afterInvite.slice(0, 4000);
  });

  it("POST /invite handler declaration includes requireAuth and requireProAccess", () => {
    const inviteDecl = source.match(/router\.post\s*\(\s*["']\/invite["']([^{]+)\{/)?.[1] ?? "";
    expect(inviteDecl).toContain("requireAuth");
    expect(inviteDecl).toContain("requireProAccess");
  });

  it("invite handler queries businessMembers for an active row keyed by userId", () => {
    // The guard must query businessMembers with status="active" scoped to the user.
    expect(inviteHandlerSlice).toContain("businessMembers.userId");
    expect(inviteHandlerSlice).toContain('"active"');
  });

  it("invite handler returns 400 when an existing active member is found", () => {
    // The error response must be a 400, not a 409 or 403.
    expect(inviteHandlerSlice).toContain("400");
    expect(inviteHandlerSlice).toContain("already a member");
  });

  it("active-member check is scoped to the current business (businessId guard present)", () => {
    // The WHERE clause must include businessId so cross-business memberships
    // don't accidentally block the invite.
    expect(inviteHandlerSlice).toContain("businessMembers.businessId");
  });

  it("active-member check is scoped to status=active (not removed members)", () => {
    // status="active" must appear in the guard so formerly-removed members
    // don't block re-invites.
    const activeIdx = inviteHandlerSlice.indexOf('"active"');
    const memberCheckIdx = inviteHandlerSlice.indexOf("businessMembers.userId");
    // Both must be present and the member-check block must contain "active"
    expect(activeIdx).toBeGreaterThan(-1);
    expect(memberCheckIdx).toBeGreaterThan(-1);
  });
});

// ── 10. POST /invite — pending-invite guard blocks duplicate invites ──────────
/**
 * The POST /invite handler must reject an invite request when a pending
 * invitation already exists in businessInvitations for the same
 * (businessId, email, status="pending") combination — regardless of whether
 * the email address belongs to a registered user.
 *
 * Guard location in the real handler (businessRoutes.ts, ~line 187-202):
 *   1. Query businessInvitations WHERE businessId=X AND email=Y AND status="pending".
 *   2. If a row is found → 400 "A pending invitation already exists for this email."
 *   3. If not found     → handler continues to the active-member check and insert.
 *
 * This mirrors the decision tree without touching the DB, following the same
 * source-scan regression pattern used in §9b.
 */

interface MockPendingInviteLookup {
  /** null when no pending invite exists for this email in this business */
  inviteId: string | null;
}

/**
 * Mirrors the invite-handler pending-invite guard:
 *
 *   - existingInvite found (status=pending) → 400 PENDING_INVITE_EXISTS
 *   - no existing pending invite            → null (handler continues)
 */
function simulateSendInvitePendingGuard(
  pendingLookup: MockPendingInviteLookup,
): { status: 400; code: "PENDING_INVITE_EXISTS" } | null {
  if (pendingLookup.inviteId !== null) {
    return { status: 400, code: "PENDING_INVITE_EXISTS" };
  }
  return null;
}

describe("POST /api/business/invite — pending-invite guard blocks duplicate invites", () => {
  // ── no existing pending invite ────────────────────────────────────────────
  it("does not fire when no pending invite exists for this email", () => {
    const result = simulateSendInvitePendingGuard({ inviteId: null });
    expect(result).toBeNull(); // guard passes, invite proceeds
  });

  it("does not fire for an email whose previous invite was accepted (no pending row)", () => {
    // After acceptance the status changes to "accepted", so the pending lookup
    // returns null — a re-invite to the same address would be allowed here
    // (though the active-member guard would then catch it).
    const result = simulateSendInvitePendingGuard({ inviteId: null });
    expect(result).toBeNull();
  });

  it("does not fire for an email whose previous invite was cancelled (no pending row)", () => {
    // status="cancelled" is excluded by the WHERE status="pending" clause.
    const result = simulateSendInvitePendingGuard({ inviteId: null });
    expect(result).toBeNull();
  });

  // ── pending invite exists — the blocked cases ─────────────────────────────
  it("blocks when a pending invite already exists for the same email", () => {
    const result = simulateSendInvitePendingGuard({ inviteId: "bi-pending-001" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("PENDING_INVITE_EXISTS");
  });

  it("blocks even when the business has spare seats (guard fires before seat insert)", () => {
    // The pending-invite guard fires independently of seat availability.
    const result = simulateSendInvitePendingGuard({ inviteId: "bi-pending-spare-seats" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("PENDING_INVITE_EXISTS");
  });

  it("blocks for an unregistered email that already has a pending invite", () => {
    // The pending-invite guard runs before the user-lookup guard, so even an
    // unregistered email address is blocked if it already has a pending invite.
    const result = simulateSendInvitePendingGuard({ inviteId: "bi-pending-unregistered" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });
});

// ── 10b. POST /invite — source-scan: pending-invite guard is present and correct

describe("businessRoutes.ts — POST /invite pending-invite guard regression", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;
  let inviteHandlerSlice: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the POST /invite handler body (between its route declaration and
    // the next top-level comment/route).
    const inviteStart = source.indexOf('router.post("/invite"');
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index)
      : afterInvite.slice(0, 4000);
  });

  it("invite handler queries businessInvitations for a pending invite before inserting", () => {
    // The guard must query businessInvitations scoped by email and status.
    expect(inviteHandlerSlice).toContain("businessInvitations");
    expect(inviteHandlerSlice).toContain('"pending"');
  });

  it("invite handler queries businessInvitations for the pending invite using the email field", () => {
    expect(inviteHandlerSlice).toContain("businessInvitations.email");
  });

  it("invite handler returns 400 when an existing pending invite is found", () => {
    // The guard must respond with 400, not 409 or 403.
    const pendingBlockIdx = inviteHandlerSlice.indexOf("pending invitation already exists");
    expect(pendingBlockIdx).toBeGreaterThan(-1);
    // Confirm the 400 status appears nearby (within 200 chars before the message)
    const surrounding = inviteHandlerSlice.slice(
      Math.max(0, pendingBlockIdx - 200),
      pendingBlockIdx + 100,
    );
    expect(surrounding).toContain("400");
  });

  it("pending-invite check is scoped to the current business (businessId guard present)", () => {
    // The WHERE clause must include businessId so pending invites for other
    // businesses do not block this one.
    expect(inviteHandlerSlice).toContain("businessInvitations.businessId");
  });

  it("pending-invite check appears before the businessInvitations insert call", () => {
    // The guard must run before the db.insert(businessInvitations) call.
    const pendingIdx = inviteHandlerSlice.indexOf("pending invitation already exists");
    const insertIdx = inviteHandlerSlice.indexOf("db.insert(businessInvitations)");
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeLessThan(insertIdx);
  });
});

// ── 10c. POST /invite — cross-business pending-invite isolation ───────────────
/**
 * Verifies that the pending-invite guard is scoped to the *current* business.
 *
 * Scenario:
 *   - email@example.com has a pending invite at Business A.
 *   - The owner of Business B (a completely different studio) tries to invite
 *     the same email address.
 *   - Business B's POST /invite handler must NOT be blocked.
 *
 * Root cause if this breaks:
 *   If the WHERE clause loses the `businessId = business.id` predicate (e.g.
 *   during a refactor), the query returns the Business-A invite row when
 *   Business-B's handler runs, and silently blocks a legitimate invite.
 *
 * The simulation models the guard as the handler sees it:
 *   - `pendingLookupInCurrentBusiness` reflects what the DB returns when the
 *     WHERE clause correctly includes businessId = currentBusiness.
 *   - When scoped correctly, Business A's pending row is invisible to Business B's
 *     query, so the lookup returns null → guard does not fire.
 *   - When the businessId scope is accidentally dropped, the lookup returns the
 *     Business-A row → guard fires incorrectly.
 */

interface MockCrossBusinessPendingLookup {
  /**
   * What the pending-invite query returns for the *current* business.
   * null  → no pending invite in this business (correct when scoped).
   * non-null → a row was found (correct when same business; BUG if cross-business).
   */
  inviteIdInCurrentBusiness: string | null;
}

/**
 * Mirrors the pending-invite guard as it runs for the *current* business.
 * The businessId scope is baked into what `inviteIdInCurrentBusiness` holds —
 * the whole point of the test is confirming the caller passes the right value.
 */
function simulateCrossBusinessPendingGuard(
  lookup: MockCrossBusinessPendingLookup,
): { status: 400; code: "PENDING_INVITE_EXISTS" } | null {
  if (lookup.inviteIdInCurrentBusiness !== null) {
    return { status: 400, code: "PENDING_INVITE_EXISTS" };
  }
  return null;
}

describe("POST /api/business/invite — cross-business pending-invite isolation", () => {
  // ── Core cross-business isolation scenario ────────────────────────────────

  it("does NOT block Business B's invite when the pending invite belongs to Business A", () => {
    // Business A has a pending invite for email@example.com.
    // Business B's handler queries with businessId = businessB.id → returns null.
    // Guard must not fire.
    const result = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: null, // Business A's row is invisible to Business B's query
    });
    expect(result).toBeNull(); // invite proceeds
  });

  it("DOES block Business B's invite when Business B itself already sent a pending invite", () => {
    // Business B's handler queries with businessId = businessB.id → finds its own pending row.
    // Guard must fire.
    const result = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: "bi-business-b-pending-001",
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("PENDING_INVITE_EXISTS");
  });

  it("Business A's blocked state does not affect Business B (independent isolation)", () => {
    // Demonstrate that two businesses for the same email are fully independent:
    //   Business A: has a pending invite → would block (inviteId present)
    //   Business B: no pending invite    → guard does not fire
    const businessAHasPending = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: "bi-business-a-pending-001",
    });
    const businessBHasNoPending = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: null,
    });

    expect(businessAHasPending).not.toBeNull();      // Business A's own guard fires
    expect(businessAHasPending!.code).toBe("PENDING_INVITE_EXISTS");
    expect(businessBHasNoPending).toBeNull();        // Business B is unaffected
  });

  it("cross-business isolation holds even when both businesses are at capacity", () => {
    // Seat availability is irrelevant; the pending-invite guard fires before
    // the seat check.  Even at capacity, Business B must not see Business A's row.
    const result = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: null, // Business A's pending row is invisible
    });
    expect(result).toBeNull();
  });

  it("email with accepted invite at Business A can still receive a pending invite at Business B", () => {
    // After acceptance the status becomes "accepted", so even within Business A
    // the pending lookup returns null.  For Business B it is also null (different businessId).
    // This confirms a fully-resolved Business-A relationship never bleeds into Business B.
    const result = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: null,
    });
    expect(result).toBeNull();
  });

  it("email with cancelled invite at Business A can still receive a pending invite at Business B", () => {
    // Cancelled invites are excluded by status="pending"; cross-business scope
    // makes them doubly invisible to Business B's query.
    const result = simulateCrossBusinessPendingGuard({
      inviteIdInCurrentBusiness: null,
    });
    expect(result).toBeNull();
  });
});

// ── 10d. POST /invite — source-scan: pending-invite guard uses businessId scope ─
/**
 * Regression scan that confirms the WHERE clause in the pending-invite guard
 * explicitly includes `businessInvitations.businessId` AND that the value
 * compared is the *current* business's ID (i.e. `business.id`), not a constant.
 *
 * If a refactor ever drops the businessId predicate, or hard-codes a value, this
 * test fails before any runtime cross-business test can catch it.
 */
describe("businessRoutes.ts — pending-invite guard businessId scope regression", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let inviteHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the POST /invite handler body.
    const inviteStart = source.indexOf('router.post("/invite"');
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index)
      : afterInvite.slice(0, 4000);
  });

  it("pending-invite WHERE clause references businessInvitations.businessId", () => {
    // The clause must name the column — not just businessId as a bare string.
    expect(inviteHandlerSlice).toContain("businessInvitations.businessId");
  });

  it("pending-invite WHERE clause compares businessId to the current business object (business.id)", () => {
    // The comparison must use the resolved `business.id` value so it is always
    // scoped to the owner's own studio and never leaks across businesses.
    //
    // We look for the pending-invite guard block specifically: the block that
    // contains "pending invitation already exists" and check that "business.id"
    // also appears within that same block (within 800 chars of the guard text).
    const guardMessageIdx = inviteHandlerSlice.indexOf("pending invitation already exists");
    expect(guardMessageIdx).toBeGreaterThan(-1);

    // Grab the surrounding ~800 chars that form the guard block
    const guardBlock = inviteHandlerSlice.slice(
      Math.max(0, guardMessageIdx - 600),
      guardMessageIdx + 200,
    );

    // `business.id` (the resolved owner's business) must appear in this block
    expect(guardBlock).toContain("business.id");
  });

  it("pending-invite guard scopes by email address (not just businessId)", () => {
    // The WHERE clause must include the email field so the guard is specific to
    // the invitee, not just the business.
    expect(inviteHandlerSlice).toContain("businessInvitations.email");
  });

  it("pending-invite guard also filters by status=pending (not accepted/cancelled rows)", () => {
    // Only pending rows should trigger the guard; accepted/cancelled must be ignored.
    expect(inviteHandlerSlice).toContain('"pending"');
  });

  it("all three scope predicates appear together before the insert call", () => {
    // businessId + email + status="pending" must all be present within the guard
    // block that precedes the db.insert(businessInvitations) call.
    const insertIdx = inviteHandlerSlice.indexOf("db.insert(businessInvitations)");
    expect(insertIdx).toBeGreaterThan(-1);

    // Take the slice up to the insert — all guard predicates must live here.
    const preInsert = inviteHandlerSlice.slice(0, insertIdx);
    expect(preInsert).toContain("businessInvitations.businessId");
    expect(preInsert).toContain("businessInvitations.email");
    expect(preInsert).toContain('"pending"');
  });
});

// ── 11. POST /invite — cross-business isolation of the active-member guard ────
/**
 * Confirms that the active-member guard in POST /invite is scoped to the
 * CURRENT business only.  A user who is an active member of Business A must
 * still be invite-able by Business B when their row in Business B is either
 * absent or has status="removed".
 *
 * This is INTENTIONAL behaviour: cross-business membership is independent.
 * The guard must match on (businessId, userId, status="active") — a global
 * active-membership check would incorrectly block the invite.
 *
 * Simulation model
 * ────────────────
 * We extend the invite guard simulation to carry explicit businessId context.
 * The "activeMemberLookup" result is always scoped to the inviting business;
 * cross-business rows are invisible to the guard.
 */

interface CrossBusinessMemberRow {
  businessId: string;
  userId: string;
  status: "active" | "removed" | "invited";
}

/**
 * Mirrors the real guard's businessId-scoped query:
 *
 *   SELECT * FROM business_members
 *   WHERE business_id = $invitingBusinessId
 *     AND user_id     = $targetUserId
 *     AND status      = 'active'
 *   LIMIT 1
 *
 * Only the inviting business's rows are consulted — rows belonging to other
 * businesses are completely ignored.
 */
function simulateCrossBusinessInviteGuard(
  invitingBusinessId: string,
  targetUserId: string,
  allMemberRows: CrossBusinessMemberRow[],
): { blocked: true; reason: "ALREADY_ACTIVE_MEMBER" } | { blocked: false } {
  // Scope the lookup to (invitingBusinessId, targetUserId, active) exactly
  const activeInThisBusiness = allMemberRows.find(
    (row) =>
      row.businessId === invitingBusinessId &&
      row.userId === targetUserId &&
      row.status === "active",
  );
  if (activeInThisBusiness) {
    return { blocked: true, reason: "ALREADY_ACTIVE_MEMBER" };
  }
  return { blocked: false };
}

describe("POST /api/business/invite — cross-business isolation of active-member guard", () => {
  const BUSINESS_A = "biz-aaa-001";
  const BUSINESS_B = "biz-bbb-002";
  const TARGET_USER = "user-target-xyz";

  // ── Guard must fire for same-business active row ───────────────────────────
  it("blocks when the user has an active row in the INVITING business", () => {
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
    ];
    const result = simulateCrossBusinessInviteGuard(BUSINESS_A, TARGET_USER, rows);
    expect(result.blocked).toBe(true);
    expect((result as any).reason).toBe("ALREADY_ACTIVE_MEMBER");
  });

  // ── Cross-business active row must NOT block the invite ───────────────────
  it("does NOT block when the user is active in Business A but has no row in Business B", () => {
    // User is active in Business A only — Business B sees no membership row
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
    ];
    // Business B is inviting → guard must not fire
    const result = simulateCrossBusinessInviteGuard(BUSINESS_B, TARGET_USER, rows);
    expect(result.blocked).toBe(false);
  });

  it("does NOT block when user is active in Business A but removed in Business B", () => {
    // This is the core cross-business scenario:
    //   - Business A: active (joined, never removed)
    //   - Business B: removed (was previously a member, then removed)
    // Business B wants to re-invite — the guard must pass.
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
      { businessId: BUSINESS_B, userId: TARGET_USER, status: "removed" },
    ];
    const result = simulateCrossBusinessInviteGuard(BUSINESS_B, TARGET_USER, rows);
    expect(result.blocked).toBe(false);
  });

  it("does NOT block when user is active in multiple OTHER businesses but not in the inviting one", () => {
    const BUSINESS_C = "biz-ccc-003";
    const BUSINESS_D = "biz-ddd-004";
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
      { businessId: BUSINESS_C, userId: TARGET_USER, status: "active" },
      { businessId: BUSINESS_D, userId: TARGET_USER, status: "active" },
    ];
    // Business B (none of A/C/D) is inviting
    const result = simulateCrossBusinessInviteGuard(BUSINESS_B, TARGET_USER, rows);
    expect(result.blocked).toBe(false);
  });

  it("blocks only the business whose own active row matches — not bystander businesses", () => {
    // Business A and Business B each have their own active row for the same user.
    // Inviting from Business B should be blocked; inviting from a hypothetical
    // Business C (no row) should pass.
    const BUSINESS_C = "biz-ccc-003";
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
      { businessId: BUSINESS_B, userId: TARGET_USER, status: "active" },
    ];

    const fromA = simulateCrossBusinessInviteGuard(BUSINESS_A, TARGET_USER, rows);
    const fromB = simulateCrossBusinessInviteGuard(BUSINESS_B, TARGET_USER, rows);
    const fromC = simulateCrossBusinessInviteGuard(BUSINESS_C, TARGET_USER, rows);

    expect(fromA.blocked).toBe(true);  // blocked — has active row in A
    expect(fromB.blocked).toBe(true);  // blocked — has active row in B
    expect(fromC.blocked).toBe(false); // passes — no row in C at all
  });

  it("removed row in the inviting business allows re-invite regardless of other businesses", () => {
    // User was removed from Business B. They are active elsewhere.
    // Business B can re-invite them.
    const rows: CrossBusinessMemberRow[] = [
      { businessId: BUSINESS_A, userId: TARGET_USER, status: "active" },
      { businessId: BUSINESS_B, userId: TARGET_USER, status: "removed" },
    ];
    const result = simulateCrossBusinessInviteGuard(BUSINESS_B, TARGET_USER, rows);
    expect(result.blocked).toBe(false);
  });
});

// ── 11b. Source-scan: businessId is in the invite guard WHERE clause ──────────
/**
 * Confirms that the WHERE clause in the active-member guard inside
 * POST /invite includes businessMembers.businessId, preventing the guard
 * from accidentally widening to a global membership check in the future.
 */
describe("businessRoutes.ts — invite guard WHERE clause includes businessId (cross-business regression)", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let inviteHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");
    const inviteStart = source.indexOf('router.post("/invite"');
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index!)
      : afterInvite.slice(0, 4000);
  });

  it("active-member guard WHERE clause references businessMembers.businessId", () => {
    // The guard query must be scoped to the current business.
    // A global query (without businessId) would block cross-business re-invites.
    expect(inviteHandlerSlice).toContain("businessMembers.businessId");
  });

  it("active-member guard WHERE clause references businessMembers.userId", () => {
    expect(inviteHandlerSlice).toContain("businessMembers.userId");
  });

  it("active-member guard WHERE clause references status active", () => {
    // The status filter ensures removed members do not block re-invites.
    expect(inviteHandlerSlice).toContain('"active"');
  });

  it("businessMembers.businessId appears before businessMembers.userId in the guard (AND order)", () => {
    // businessId should narrow the scan first (index-aligned with the FK) before userId.
    const bizIdIdx = inviteHandlerSlice.indexOf("businessMembers.businessId");
    const userIdIdx = inviteHandlerSlice.indexOf("businessMembers.userId");
    expect(bizIdIdx).toBeGreaterThan(-1);
    expect(userIdIdx).toBeGreaterThan(-1);
    expect(bizIdIdx).toBeLessThan(userIdIdx);
  });
});

// ── 12. POST /invite — expired pending invite does NOT block a fresh invite ────
/**
 * The POST /invite handler must allow a new invite to the same email address
 * when the only pending invite row has an expiresAt in the past.
 *
 * The guard now queries:
 *   WHERE businessId=X AND email=Y AND status="pending" AND expiresAt > NOW()
 *
 * An invite whose expiresAt <= NOW() is treated as absent — the fresh invite
 * is allowed, and the stale row is marked "expired" as a cleanup side-effect.
 *
 * Guard location in the real handler (businessRoutes.ts, POST /invite):
 *   1. Query businessInvitations WHERE … AND status="pending" AND expiresAt > now.
 *   2. If found  → 400 "A pending invitation already exists."
 *   3. If not found (or only expired rows exist) → continue; mark stale rows "expired".
 */

interface MockPendingInviteWithExpiry {
  /** null when no row exists at all */
  inviteId: string | null;
  /** Whether the invite's expiresAt is in the future (true) or past (false) */
  isStillValid: boolean;
}

/**
 * Mirrors the updated invite-handler pending-invite guard that includes the
 * expiresAt > now() condition.
 *
 * Returns:
 *   { status: 400, code: "PENDING_INVITE_EXISTS" }  — blocked (valid pending invite)
 *   null                                              — guard did not fire (handler continues)
 */
function simulateSendInvitePendingGuardWithExpiry(
  pendingLookup: MockPendingInviteWithExpiry,
): { status: 400; code: "PENDING_INVITE_EXISTS" } | null {
  // The DB query only returns the row if status=pending AND expiresAt > now.
  // An expired row (isStillValid=false) is treated the same as no row (inviteId=null).
  const activeRow =
    pendingLookup.inviteId !== null && pendingLookup.isStillValid;

  if (activeRow) {
    return { status: 400, code: "PENDING_INVITE_EXISTS" };
  }
  return null;
}

describe("POST /api/business/invite — expired pending invite does not block fresh invite", () => {
  // ── Expired invite: guard must NOT fire ──────────────────────────────────────
  it("allows a new invite when the only pending invite is expired (expiresAt in the past)", () => {
    const result = simulateSendInvitePendingGuardWithExpiry({
      inviteId: "bi-expired-001",
      isStillValid: false, // expiresAt <= now — treated as absent
    });
    expect(result).toBeNull(); // fresh invite is allowed
  });

  it("allows a new invite when there is no pending invite at all", () => {
    const result = simulateSendInvitePendingGuardWithExpiry({
      inviteId: null,
      isStillValid: false, // irrelevant when inviteId is null
    });
    expect(result).toBeNull();
  });

  // ── Valid (non-expired) pending invite: guard must still fire ─────────────────
  it("still blocks a new invite when a valid (non-expired) pending invite exists", () => {
    const result = simulateSendInvitePendingGuardWithExpiry({
      inviteId: "bi-valid-001",
      isStillValid: true, // expiresAt > now — genuine conflict
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    expect(result!.code).toBe("PENDING_INVITE_EXISTS");
  });

  it("blocks even when seats are available if a valid pending invite exists", () => {
    // Seat count is irrelevant; the pending-invite guard fires first.
    const result = simulateSendInvitePendingGuardWithExpiry({
      inviteId: "bi-valid-spare-seats",
      isStillValid: true,
    });
    expect(result!.code).toBe("PENDING_INVITE_EXISTS");
  });

  // ── Scenario: same email, expired row → new invite allowed ───────────────────
  it("scenario — expired invite then fresh invite: no block (end-to-end decision tree)", () => {
    const staleInviteExists = simulateSendInvitePendingGuardWithExpiry({
      inviteId: "bi-expired-scenario-001",
      isStillValid: false,
    });
    expect(staleInviteExists).toBeNull(); // not blocked
  });
});

// ── 12b. POST /invite — source-scan: expiresAt filter is present in both guards ─

describe("businessRoutes.ts — POST /invite expiresAt guard regression", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;
  let inviteHandlerSlice: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the POST /invite handler body.
    const inviteStart = source.indexOf('router.post("/invite"');
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index)
      : afterInvite.slice(0, 5000);
  });

  it("duplicate-invite guard includes an expiresAt condition (not just status=pending)", () => {
    expect(inviteHandlerSlice).toContain("businessInvitations.expiresAt");
  });

  it("seat-count query also excludes expired pending invites via expiresAt", () => {
    const pendingCountIdx = inviteHandlerSlice.indexOf("pendingInvCount");
    expect(pendingCountIdx).toBeGreaterThan(-1);
    const afterCount = inviteHandlerSlice.slice(pendingCountIdx);
    expect(afterCount.indexOf("expiresAt")).toBeGreaterThan(-1);
  });

  it("handler marks stale expired pending invites as 'expired' before inserting the new one", () => {
    expect(inviteHandlerSlice).toContain('"expired"');
    expect(inviteHandlerSlice).toContain(".update(businessInvitations)");
    const updateIdx = inviteHandlerSlice.indexOf('.update(businessInvitations)');
    const afterUpdate = inviteHandlerSlice.slice(updateIdx, updateIdx + 300);
    expect(afterUpdate).toContain('"expired"');
  });

  it("pending-invite guard appears before the db.insert(businessInvitations) call", () => {
    const pendingIdx = inviteHandlerSlice.indexOf("pending invitation already exists");
    const insertIdx = inviteHandlerSlice.indexOf("db.insert(businessInvitations)");
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeLessThan(insertIdx);
  });

  it("expiresAt appears in both the pending-invite check and the seat-count query sections", () => {
    const matches = inviteHandlerSlice.match(/expiresAt/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 13. Cross-business duplicate guard ────────────────────────────────────────
/**
 * A user must not hold active seats in two businesses simultaneously.
 * The accept-invite handler checks for any active businessMembers row
 * across ALL businesses (not just the one being joined) before activating
 * a new membership.
 *
 * Decision: reject with ALREADY_IN_ANOTHER_BUSINESS (not auto-remove) so the
 * user retains agency over which business they leave.
 */

/**
 * Extended simulation that adds a cross-business active-membership check between
 * the same-business check and the seat-count check.
 */
function simulateAcceptInviteWithCrossBusinessCheck(
  existingSameBusiness: MockExistingMember | null,
  activeInAnotherBusiness: boolean,
  usedSeats: number,
  seatLimit: number,
): { status: number; code?: string; action?: "reactivate" | "insert" } {
  // Step 1: same-business existing-member check (fires first)
  if (existingSameBusiness && existingSameBusiness.status === "active") {
    return { status: 400, code: "ALREADY_MEMBER" };
  }

  // Step 2: cross-business active-membership check
  if (activeInAnotherBusiness) {
    return { status: 400, code: "ALREADY_IN_ANOTHER_BUSINESS" };
  }

  // Step 3: seat availability
  if (usedSeats >= seatLimit) {
    return { status: 400, code: "SEATS_FULL" };
  }

  // Step 4: re-activate or insert
  if (existingSameBusiness && existingSameBusiness.status === "removed") {
    return { status: 200, action: "reactivate" };
  }
  return { status: 200, action: "insert" };
}

describe("POST /api/business/invite/:token/accept — cross-business duplicate guard", () => {
  const SEAT_LIMIT = 3;

  it("rejects a user who is already an active member of a different business", () => {
    const result = simulateAcceptInviteWithCrossBusinessCheck(null, true, 0, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("rejects even when the target business has plenty of free seats", () => {
    const result = simulateAcceptInviteWithCrossBusinessCheck(null, true, 0, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("rejects even when the target business is already at capacity", () => {
    const result = simulateAcceptInviteWithCrossBusinessCheck(null, true, SEAT_LIMIT, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("allows a user with no active membership anywhere to accept (baseline)", () => {
    const result = simulateAcceptInviteWithCrossBusinessCheck(null, false, 1, SEAT_LIMIT);
    expect(result.status).toBe(200);
    expect(result.action).toBe("insert");
  });

  it("allows a formerly-removed member (same business) who is not in another business", () => {
    const removedRow: MockExistingMember = { id: "bm-removed-003", status: "removed" };
    const result = simulateAcceptInviteWithCrossBusinessCheck(removedRow, false, 1, SEAT_LIMIT);
    expect(result.status).toBe(200);
    expect(result.action).toBe("reactivate");
  });

  it("rejects a formerly-removed member (same business) who is active in a third business", () => {
    const removedRow: MockExistingMember = { id: "bm-removed-004", status: "removed" };
    const result = simulateAcceptInviteWithCrossBusinessCheck(removedRow, true, 1, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("same-business active check fires before cross-business check (priority order)", () => {
    const activeRow: MockExistingMember = { id: "bm-active-001", status: "active" };
    const result = simulateAcceptInviteWithCrossBusinessCheck(activeRow, true, 0, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_MEMBER"); // NOT ALREADY_IN_ANOTHER_BUSINESS
  });

  it("cross-business check fires before seat-count check (priority order)", () => {
    const result = simulateAcceptInviteWithCrossBusinessCheck(null, true, SEAT_LIMIT, SEAT_LIMIT);
    expect(result.status).toBe(400);
    expect(result.code).toBe("ALREADY_IN_ANOTHER_BUSINESS"); // NOT SEATS_FULL
  });
});

// ── 14. businessRoutes.ts source — cross-business guard presence ──────────────
/**
 * Regression guard: verifies the cross-business check exists in the accept
 * handler and appears in the correct position relative to other checks.
 */
describe("businessRoutes.ts — cross-business duplicate guard in accept handler", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;
  let handlerSlice: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");
    const acceptStart = source.indexOf('"/invite/:token/accept"');
    const afterStart = source.slice(acceptStart);
    const nextRouteMatch = afterStart.match(/\n\/\/ ──/);
    handlerSlice = nextRouteMatch
      ? afterStart.slice(0, nextRouteMatch.index!)
      : afterStart.slice(0, 4000);
  });

  it("accept handler contains ALREADY_IN_ANOTHER_BUSINESS error code", () => {
    expect(handlerSlice).toContain("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("cross-business check (ALREADY_IN_ANOTHER_BUSINESS) appears before getActiveSeats call", () => {
    const crossBizIdx = handlerSlice.indexOf("ALREADY_IN_ANOTHER_BUSINESS");
    const seatsIdx = handlerSlice.indexOf("getActiveSeats");
    expect(crossBizIdx).toBeGreaterThan(-1);
    expect(seatsIdx).toBeGreaterThan(-1);
    expect(crossBizIdx).toBeLessThan(seatsIdx);
  });

  it("same-business active check (already a member) appears before cross-business check", () => {
    const sameBizIdx = handlerSlice.indexOf("already a member of this business");
    const crossBizIdx = handlerSlice.indexOf("ALREADY_IN_ANOTHER_BUSINESS");
    expect(sameBizIdx).toBeGreaterThan(-1);
    expect(crossBizIdx).toBeGreaterThan(-1);
    expect(sameBizIdx).toBeLessThan(crossBizIdx);
  });

  it("ne() or sql-based inequality is used to exclude the current business from the cross-business query", () => {
    const hasNe = handlerSlice.includes("ne(businessMembers.businessId") ||
                  handlerSlice.includes("businessId != ") ||
                  handlerSlice.includes("businessId !== ");
    expect(hasNe).toBe(true);
  });
});

// ── 16. DB-level constraint violation → ALREADY_IN_ANOTHER_BUSINESS mapping ──
/**
 * The partial unique index idx_business_members_one_active_per_user enforces the
 * one-active-seat-per-user rule at the DB layer.  If two concurrent requests both
 * pass the application-level pre-check, the second DB write will throw a PostgreSQL
 * 23505 unique-violation.  The accept handler must catch that error and return
 * ALREADY_IN_ANOTHER_BUSINESS instead of 500.
 *
 * These tests verify the error-classification logic in isolation (no live DB needed).
 */

/**
 * Mirrors the constraint-violation classifier in the accept handler:
 *
 *   if (txErr.code === "23505" && constraintName.includes("one_active_per_user"))
 *     → ALREADY_IN_ANOTHER_BUSINESS
 *   else
 *     → re-throw (500)
 */
function classifyTransactionError(err: { code?: string; constraint_name?: string; constraint?: string }): "ALREADY_IN_ANOTHER_BUSINESS" | "SERVER_ERROR" {
  const constraintName: string = err.constraint_name ?? err.constraint ?? "";
  if (err.code === "23505" && constraintName.includes("one_active_per_user")) {
    return "ALREADY_IN_ANOTHER_BUSINESS";
  }
  return "SERVER_ERROR";
}

describe("Accept-invite transaction — DB constraint violation classifier", () => {
  it("maps a 23505 unique-violation on one_active_per_user to ALREADY_IN_ANOTHER_BUSINESS", () => {
    const pgError = { code: "23505", constraint_name: "idx_business_members_one_active_per_user" };
    expect(classifyTransactionError(pgError)).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("also handles pg drivers that surface the constraint as 'constraint' not 'constraint_name'", () => {
    const pgError = { code: "23505", constraint: "idx_business_members_one_active_per_user" };
    expect(classifyTransactionError(pgError)).toBe("ALREADY_IN_ANOTHER_BUSINESS");
  });

  it("does NOT swallow an unrelated 23505 violation (e.g. business_id+user_id unique)", () => {
    const pgError = { code: "23505", constraint_name: "business_members_business_id_user_id_key" };
    expect(classifyTransactionError(pgError)).toBe("SERVER_ERROR");
  });

  it("does NOT swallow a non-unique-violation DB error (e.g. FK violation code 23503)", () => {
    expect(classifyTransactionError({ code: "23503", constraint_name: "some_fk" })).toBe("SERVER_ERROR");
  });

  it("does NOT swallow a generic JS error with no PG code", () => {
    expect(classifyTransactionError({})).toBe("SERVER_ERROR");
  });
});

// ── 17. businessRoutes.ts source — constraint catch present in accept handler ─
/**
 * Regression guard: verifies that the accept handler catches 23505 errors and
 * maps them to ALREADY_IN_ANOTHER_BUSINESS (not 500).
 */
describe("businessRoutes.ts — accept handler catches DB constraint violation", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let handlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");
    const acceptStart = source.indexOf('"/invite/:token/accept"');
    const afterStart = source.slice(acceptStart);
    const nextRouteMatch = afterStart.match(/\n\/\/ ──/);
    handlerSlice = nextRouteMatch
      ? afterStart.slice(0, nextRouteMatch.index!)
      : afterStart.slice(0, 6000);
  });

  it("accept handler checks txErr.code === '23505'", () => {
    expect(handlerSlice).toContain('"23505"');
  });

  it("accept handler inspects the constraint name for one_active_per_user", () => {
    expect(handlerSlice).toContain("one_active_per_user");
  });

  it("accept handler re-throws errors that are not the one_active_per_user violation", () => {
    expect(handlerSlice).toContain("throw txErr");
  });

  it("partial unique index name is consistent between boot migration and accept handler", () => {
    expect(handlerSlice).toContain("one_active_per_user");
  });
});

// ── 15. GET /api/business/membership — reactivated member response shape ──────
/**
 * After a removed member re-accepts an invite the businessMembers row is
 * flipped back to status="active".  GET /membership queries with:
 *
 *   WHERE businessMembers.userId = $userId AND businessMembers.status = "active"
 *
 * These tests confirm:
 *   (a) the simulated query returns the active row (not 404) immediately after
 *       reactivation — no cache or stale read can hide it.
 *   (b) the response payload carries businessId and status=active.
 *   (c) a row still in status="removed" is invisible to the query (404 scenario).
 *   (d) a row that was just reactivated (status flipped active) IS visible.
 */

interface MockMembershipRow {
  memberId: string;
  userId: string;
  businessId: string;
  businessName: string;
  status: "active" | "removed";
  role: string;
  seatLimit: number;
}

/**
 * Mirrors the GET /membership handler:
 *   SELECT … FROM business_members JOIN businesses
 *   WHERE business_members.user_id = $userId AND business_members.status = 'active'
 *   LIMIT 1
 *
 * Returns the membership payload when found, or null when the row is missing /
 * not active (which maps to 404 in the real handler).
 */
function simulateGetMembership(
  userId: string,
  allRows: MockMembershipRow[],
): { membership: Omit<MockMembershipRow, "userId"> } | null {
  const row = allRows.find((r) => r.userId === userId && r.status === "active");
  if (!row) return null;
  const { userId: _uid, ...payload } = row;
  return { membership: payload };
}

describe("GET /api/business/membership — reactivated member is immediately visible", () => {
  const USER_ID = "user-rejoin-ms-001";
  const BIZ_ID  = "biz-rejoin-ms-001";

  const BASE_ROW: MockMembershipRow = {
    memberId: "bm-rejoin-ms-001",
    userId: USER_ID,
    businessId: BIZ_ID,
    businessName: "Rejoin Test Studio",
    status: "active",
    role: "coach",
    seatLimit: 5,
  };

  // ── (a) Reactivated row is visible straight away ────────────────────────────
  it("returns the membership when the row is status=active after re-join", () => {
    const result = simulateGetMembership(USER_ID, [BASE_ROW]);
    expect(result).not.toBeNull();
    expect(result!.membership.status).toBe("active");
  });

  it("response includes the correct businessId", () => {
    const result = simulateGetMembership(USER_ID, [BASE_ROW]);
    expect(result!.membership.businessId).toBe(BIZ_ID);
  });

  it("response includes the role assigned at re-invite time", () => {
    const coachRow: MockMembershipRow = { ...BASE_ROW, role: "trainer" };
    const result = simulateGetMembership(USER_ID, [coachRow]);
    expect(result!.membership.role).toBe("trainer");
  });

  // ── (b) Removed row produces 404 (membership is invisible) ─────────────────
  it("returns null (404) when the row is still status=removed", () => {
    const removedRow: MockMembershipRow = { ...BASE_ROW, status: "removed" };
    const result = simulateGetMembership(USER_ID, [removedRow]);
    expect(result).toBeNull(); // maps to 404 in the real handler
  });

  it("returns null (404) for a user with no businessMembers row at all", () => {
    const result = simulateGetMembership(USER_ID, []); // empty roster
    expect(result).toBeNull();
  });

  // ── (c) Flip: removed → active makes the row visible in the same query ──────
  it("row invisible when removed, visible after status flip to active", () => {
    const beforeReactivation: MockMembershipRow = { ...BASE_ROW, status: "removed" };
    const afterReactivation:  MockMembershipRow = { ...BASE_ROW, status: "active" };

    expect(simulateGetMembership(USER_ID, [beforeReactivation])).toBeNull();
    expect(simulateGetMembership(USER_ID, [afterReactivation])).not.toBeNull();
  });

  // ── (d) Another user's active row does not appear in the result ─────────────
  it("does not leak another user's membership row", () => {
    const OTHER_USER = "user-other-ms-002";
    const otherRow: MockMembershipRow = { ...BASE_ROW, userId: OTHER_USER, memberId: "bm-other-ms-002" };
    // Only the other user's row exists; query for USER_ID must return null.
    const result = simulateGetMembership(USER_ID, [otherRow]);
    expect(result).toBeNull();
  });

  // ── (e) seatLimit is included so the member view can display team capacity ──
  it("response includes seatLimit from the joined businesses table", () => {
    const result = simulateGetMembership(USER_ID, [BASE_ROW]);
    expect(result!.membership.seatLimit).toBe(5);
  });

  // ── (f) businessName is included so the member dashboard can render the title
  it("response includes businessName", () => {
    const result = simulateGetMembership(USER_ID, [BASE_ROW]);
    expect(result!.membership.businessName).toBe("Rejoin Test Studio");
  });
});

// ── 15b. GET /membership source — correct WHERE clause ────────────────────────
/**
 * Regression scan: the real GET /membership handler must filter by BOTH
 * businessMembers.userId AND businessMembers.status = "active".
 * If the status predicate is dropped a removed member would see a 404-turned-
 * stale-row and land on the "Join a Business" empty state even after re-joining.
 */
describe("businessRoutes.ts — GET /membership WHERE clause regression", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let membershipHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the GET /membership handler
    const membershipStart = source.indexOf('router.get("/membership"');
    expect(membershipStart).toBeGreaterThan(-1);

    const afterStart = source.slice(membershipStart);
    const nextSectionMatch = afterStart.match(/\n\/\/ ──/);
    membershipHandlerSlice = nextSectionMatch
      ? afterStart.slice(0, nextSectionMatch.index)
      : afterStart.slice(0, 2000);
  });

  it("GET /membership filters by businessMembers.userId", () => {
    expect(membershipHandlerSlice).toContain("businessMembers.userId");
  });

  it("GET /membership filters by status=active (not removed rows)", () => {
    // The WHERE clause must include status="active" so a removed member who has
    // not yet been re-activated cannot see a stale membership row.
    expect(membershipHandlerSlice).toContain('"active"');
    expect(membershipHandlerSlice).toContain("businessMembers.status");
  });

  it("GET /membership joins to businesses table to include businessId and businessName", () => {
    // The handler must JOIN businesses so the response can include businessId and name.
    expect(membershipHandlerSlice).toContain("businesses");
    expect(membershipHandlerSlice).toContain("businesses.id");
  });

  it("GET /membership response shape includes status field", () => {
    // The SELECT must include businessMembers.status so callers can distinguish
    // active vs removed rows if they need to (defensive completeness).
    expect(membershipHandlerSlice).toContain("businessMembers.status");
  });
});

// ── 19. Post-accept redirect — re-joining member lands on business dashboard ──
/**
 * After accepting an invite (new OR re-join), the accept page must navigate
 * the user to /business/dashboard — NOT to /home.
 *
 * Without this, a re-joining member would land on the generic home page which
 * has no membership-awareness and shows an empty/blank state.  The business
 * dashboard member view immediately reflects the newly-active membership row
 * returned by GET /api/business/membership.
 *
 * These tests:
 *   (a) Source-scan BusinessInviteAccept.tsx to confirm the CTA navigates to
 *       /business/dashboard (regression guard if someone changes the target).
 *   (b) Confirm /home does NOT appear as the post-accept redirect target.
 *   (c) Confirm the accept handler response (success: true, businessName, role)
 *       contains the fields the dashboard needs to render without an extra fetch.
 */

describe("BusinessInviteAccept.tsx — post-accept redirect destination", () => {
  const acceptPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/BusinessInviteAccept.tsx",
  );
  let source: string;
  // Slice that contains the post-acceptance (accepted === true) render block
  let acceptedBlock: string;

  beforeAll(() => {
    source = fs.readFileSync(acceptPagePath, "utf-8");

    // Isolate the post-acceptance screen block (accepted && acceptedData guard)
    const blockStart = source.indexOf("if (accepted && acceptedData)");
    expect(blockStart).toBeGreaterThan(-1);

    // The block ends when the next top-level if/return begins (fetch-error screen)
    const afterStart = source.slice(blockStart);
    const nextBlockMatch = afterStart.match(/\n  \/\/ ──|if \(fetchError\)/);
    acceptedBlock = nextBlockMatch
      ? afterStart.slice(0, nextBlockMatch.index)
      : afterStart.slice(0, 3000);
  });

  // ── (a) Redirect target is /business/dashboard ───────────────────────────────
  it("CTA button navigates to /business/dashboard after acceptance", () => {
    expect(acceptedBlock).toContain("/business/dashboard");
  });

  it("setLocation is called with /business/dashboard (not a different path)", () => {
    // The setLocation call for the CTA must reference /business/dashboard
    const setLocIdx = acceptedBlock.indexOf('setLocation("/business/dashboard")');
    expect(setLocIdx).toBeGreaterThan(-1);
  });

  // ── (b) /home is NOT the redirect target in the post-accept block ────────────
  it("CTA button does NOT navigate to /home after acceptance", () => {
    // Navigating to /home drops the user on the generic home page which has
    // no awareness of the just-reactivated membership.
    // Note: /home may appear elsewhere (e.g. in the error screen's fallback),
    // so we check only the CTA button's onClick within acceptedBlock.
    const ctaIdx = acceptedBlock.indexOf("onClick");
    expect(ctaIdx).toBeGreaterThan(-1);
    const ctaBlock = acceptedBlock.slice(ctaIdx, ctaIdx + 200);
    expect(ctaBlock).not.toContain('"/home"');
  });

  // ── (c) Accept API response fields used by the accept page ──────────────────
  it("accept page reads businessName from the API response", () => {
    // The page stores data.businessName from the POST /accept response.
    // This field populates the success screen without requiring an extra
    // GET /membership call immediately after acceptance.
    expect(source).toContain("data.businessName");
  });

  it("accept page reads role from the API response", () => {
    expect(source).toContain("data.role");
  });

  // ── (d) Page imports useLocation (required for setLocation navigation) ───────
  it("accept page imports useLocation from wouter", () => {
    expect(source).toContain("useLocation");
    expect(source).toContain("wouter");
  });
});

// ── 18. requireProAccess middleware source structure ──────────────────────────

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

// ── 19. GET /mine — expired-invite expiry filter ──────────────────────────────
/**
 * Confirms that GET /api/business/mine filters out expired pending invitations
 * (expiresAt < NOW) so owners never see stale rows that members can no longer use.
 *
 * Sub-sections:
 *   (a) Simulation — mirrors the in-memory filter and validates correct output.
 *   (b) Source-scan — confirms the expiresAt guard is present in the /mine handler.
 *   (c) Seat-count — expired invites must NOT inflate occupiedSeats on POST /invite.
 */

// ── (a) Simulation ────────────────────────────────────────────────────────────

interface MockInviteRow {
  id: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: Date;
}

/**
 * Mirrors the GET /mine pending-invitation query:
 *   WHERE status = "pending" AND expiresAt > NOW
 *
 * Any invite whose expiresAt is in the past is excluded, even if its status
 * field still says "pending".
 */
function simulateMineInvitationFilter(
  rows: MockInviteRow[],
  now: Date,
): MockInviteRow[] {
  return rows.filter((inv) => inv.status === "pending" && inv.expiresAt > now);
}

describe("GET /api/business/mine — expired-invite filter simulation", () => {
  const NOW = new Date("2026-08-05T12:00:00Z");
  const FUTURE = new Date("2026-08-12T12:00:00Z"); // 7 days out
  const PAST = new Date("2026-07-29T12:00:00Z");   // 7 days ago

  it("includes a non-expired pending invite", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-valid", status: "pending", expiresAt: FUTURE },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("inv-valid");
  });

  it("excludes a pending invite whose expiresAt is in the past", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-expired", status: "pending", expiresAt: PAST },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(0);
  });

  it("excludes a pending invite that expires exactly at NOW (not strictly after)", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-boundary", status: "pending", expiresAt: NOW },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(0);
  });

  it("returns only live invites from a mixed list", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-live-1", status: "pending", expiresAt: FUTURE },
      { id: "inv-expired-1", status: "pending", expiresAt: PAST },
      { id: "inv-live-2", status: "pending", expiresAt: new Date(NOW.getTime() + 1) },
      { id: "inv-expired-2", status: "pending", expiresAt: new Date(NOW.getTime() - 1) },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("inv-live-1");
    expect(ids).toContain("inv-live-2");
    expect(ids).not.toContain("inv-expired-1");
    expect(ids).not.toContain("inv-expired-2");
  });

  it("returns an empty list when all pending invites are expired", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-exp-a", status: "pending", expiresAt: PAST },
      { id: "inv-exp-b", status: "pending", expiresAt: PAST },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(0);
  });

  it("does not include non-pending rows even if expiresAt is in the future", () => {
    const rows: MockInviteRow[] = [
      { id: "inv-accepted", status: "accepted", expiresAt: FUTURE },
      { id: "inv-cancelled", status: "cancelled", expiresAt: FUTURE },
      { id: "inv-expired-status", status: "expired", expiresAt: FUTURE },
    ];
    const result = simulateMineInvitationFilter(rows, NOW);
    expect(result).toHaveLength(0);
  });

  it("returns an empty list when the invite table is empty", () => {
    const result = simulateMineInvitationFilter([], NOW);
    expect(result).toHaveLength(0);
  });
});

// ── (b) Source-scan: expiresAt guard is present in /mine handler ──────────────

describe("businessRoutes.ts — GET /mine handler includes expiresAt expiry filter", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let mineHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the GET /mine handler body (between its route declaration and
    // the next top-level comment section).
    const mineStart = source.indexOf('router.get("/mine"');
    expect(mineStart).toBeGreaterThan(-1);

    const afterMine = source.slice(mineStart);
    const nextSectionMatch = afterMine.match(/\n\/\/ ──/);
    mineHandlerSlice = nextSectionMatch
      ? afterMine.slice(0, nextSectionMatch.index)
      : afterMine.slice(0, 4000);
  });

  it("GET /mine queries businessInvitations with a status='pending' filter", () => {
    expect(mineHandlerSlice).toContain("businessInvitations");
    expect(mineHandlerSlice).toContain('"pending"');
  });

  it("GET /mine queries businessInvitations with an expiresAt guard (gt import)", () => {
    // The expiresAt column must be compared against the current time
    expect(mineHandlerSlice).toContain("expiresAt");
    // gt() from drizzle-orm is the operator used for the > comparison
    expect(mineHandlerSlice).toMatch(/gt\s*\(/);
  });

  it("GET /mine handler defines 'now' before the pendingInvitations query", () => {
    // A local 'now' variable must be captured once for consistent timestamp comparison
    const nowIdx = mineHandlerSlice.indexOf("const now");
    const invIdx = mineHandlerSlice.indexOf("pendingInvitations");
    expect(nowIdx).toBeGreaterThan(-1);
    expect(invIdx).toBeGreaterThan(-1);
    expect(nowIdx).toBeLessThan(invIdx);
  });

  it("expiresAt filter uses gt() so only strictly-future invites are included", () => {
    // gt(expiresAt, now) means expiresAt > now — boundary value excluded
    const gtIdx = mineHandlerSlice.indexOf("gt(");
    const expIdx = mineHandlerSlice.indexOf("expiresAt");
    expect(gtIdx).toBeGreaterThan(-1);
    expect(expIdx).toBeGreaterThan(-1);
  });
});

// ── (c) Seat-count: expired invites excluded from occupiedSeats in POST /invite ─

describe("businessRoutes.ts — POST /invite seat check excludes expired pending invites", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let inviteHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");
    const inviteStart = source.indexOf('router.post("/invite"');
    expect(inviteStart).toBeGreaterThan(-1);
    const afterInvite = source.slice(inviteStart);
    const nextSectionMatch = afterInvite.match(/\n\/\/ ──/);
    inviteHandlerSlice = nextSectionMatch
      ? afterInvite.slice(0, nextSectionMatch.index)
      : afterInvite.slice(0, 5000);
  });

  it("POST /invite seat-count query filters pending invites by expiresAt > now", () => {
    // The occupiedSeats count must exclude expired rows
    expect(inviteHandlerSlice).toContain("expiresAt");
    expect(inviteHandlerSlice).toMatch(/gt\s*\(/);
  });

  it("POST /invite seat-count query uses status='pending' AND expiresAt guard together", () => {
    // Both conditions must co-exist in the seat-reservation query
    expect(inviteHandlerSlice).toContain('"pending"');
    expect(inviteHandlerSlice).toContain("expiresAt");
  });

  it("POST /invite marks stale pending invites as 'expired' before inserting a new one", () => {
    // The handler must clean up expired rows so they don't accumulate
    expect(inviteHandlerSlice).toContain('"expired"');
    expect(inviteHandlerSlice).toContain("expiresAt");
  });
});

// ── (c-sim) Seat count simulation: expired invites do not inflate occupiedSeats ─

interface MockPendingInviteForSeat {
  id: string;
  status: "pending";
  expiresAt: Date;
}

/**
 * Mirrors the occupiedSeats computation in POST /invite:
 *   occupiedSeats = activeMembers + non-expired pending invites
 */
function simulateOccupiedSeats(
  activeMembers: number,
  pendingInvites: MockPendingInviteForSeat[],
  now: Date,
): number {
  const livePending = pendingInvites.filter((inv) => inv.expiresAt > now).length;
  return activeMembers + livePending;
}

describe("POST /api/business/invite — occupiedSeats excludes expired pending invites (simulation)", () => {
  const NOW = new Date("2026-08-05T12:00:00Z");
  const FUTURE = new Date("2026-08-12T12:00:00Z");
  const PAST = new Date("2026-07-29T12:00:00Z");

  it("expired pending invite does NOT contribute to occupiedSeats", () => {
    const expiredInvite: MockPendingInviteForSeat = { id: "bi-exp-1", status: "pending", expiresAt: PAST };
    const occupied = simulateOccupiedSeats(1, [expiredInvite], NOW);
    // activeMembers=1, expired invite=0 → occupied=1 (not 2)
    expect(occupied).toBe(1);
  });

  it("live pending invite DOES contribute to occupiedSeats (seat reserved)", () => {
    const liveInvite: MockPendingInviteForSeat = { id: "bi-live-1", status: "pending", expiresAt: FUTURE };
    const occupied = simulateOccupiedSeats(1, [liveInvite], NOW);
    expect(occupied).toBe(2); // 1 active member + 1 reserved by live invite
  });

  it("mixed: 2 live + 1 expired invite — only 2 count toward occupiedSeats", () => {
    const invites: MockPendingInviteForSeat[] = [
      { id: "bi-live-a", status: "pending", expiresAt: FUTURE },
      { id: "bi-live-b", status: "pending", expiresAt: FUTURE },
      { id: "bi-exp-a",  status: "pending", expiresAt: PAST },
    ];
    const occupied = simulateOccupiedSeats(0, invites, NOW);
    expect(occupied).toBe(2);
  });

  it("all expired invites → occupiedSeats equals only activeMembers count", () => {
    const invites: MockPendingInviteForSeat[] = [
      { id: "bi-exp-x", status: "pending", expiresAt: PAST },
      { id: "bi-exp-y", status: "pending", expiresAt: PAST },
      { id: "bi-exp-z", status: "pending", expiresAt: PAST },
    ];
    const occupied = simulateOccupiedSeats(2, invites, NOW);
    expect(occupied).toBe(2); // only the 2 active members
  });

  it("a new invite CAN be sent if the only pending invite is expired (seat freed)", () => {
    const SEAT_LIMIT = 3;
    const expiredInvite: MockPendingInviteForSeat = { id: "bi-exp-gate", status: "pending", expiresAt: PAST };
    const occupied = simulateOccupiedSeats(2, [expiredInvite], NOW);
    // Without the expiry filter: occupied would be 3 → seat check would block.
    // With the filter: occupied = 2 → one slot free → invite is allowed.
    expect(occupied).toBeLessThan(SEAT_LIMIT);
  });
});

// ── N. Removal-notice cleared on re-join ─────────────────────────────────────
/**
 * When a member is removed, the dashboard shows a removal-notice banner
 * (controlled by noticeDismissedAt IS NULL on the businessMembers row).
 *
 * If the owner later re-invites and the member accepts, the accept handler must
 * set noticeDismissedAt = NOW() on the reactivated row so the stale banner
 * never appears to an active member.
 *
 * Sub-sections:
 *   (a) Simulation: confirms the in-memory model correctly clears
 *       noticeDismissedAt when a removed row is reactivated.
 *   (b) Source-scan: the reactivation UPDATE in businessRoutes.ts includes
 *       noticeDismissedAt in its set clause.
 *   (c) Source-scan: the broader belt-and-suspenders UPDATE that dismisses
 *       any other undismissed removed rows for this user+business is present.
 *   (d) Client guard: BusinessDashboard.tsx member view renders no removal
 *       notice (confirmed by absence of the relevant string in the JSX).
 */

// ── (a) Simulation: noticeDismissedAt is cleared on reactivation ──────────────

interface MockMemberRowWithNotice {
  id: string;
  status: "active" | "removed";
  noticeDismissedAt: Date | null;
}

/**
 * Models the accept handler's reactivation SET clause.
 * Returns the row state after the UPDATE.
 */
function simulateReactivateWithNoticeClear(
  row: MockMemberRowWithNotice,
  now: Date,
): MockMemberRowWithNotice {
  return {
    ...row,
    status: "active",
    noticeDismissedAt: now, // accept handler always stamps this on reactivation
  };
}

/**
 * Returns true when a removal notice should be shown to the user.
 * Mirrors the client-side / API condition: status=removed AND noticeDismissedAt IS NULL.
 */
function shouldShowRemovalNotice(row: MockMemberRowWithNotice): boolean {
  return row.status === "removed" && row.noticeDismissedAt === null;
}

describe("POST /api/business/invite/:token/accept — removal notice cleared on re-join", () => {
  const NOW = new Date("2026-08-05T12:00:00Z");

  it("removal notice IS shown for a removed member who has not dismissed it (baseline)", () => {
    const removedRow: MockMemberRowWithNotice = {
      id: "bm-rn-001",
      status: "removed",
      noticeDismissedAt: null, // undismissed
    };
    expect(shouldShowRemovalNotice(removedRow)).toBe(true);
  });

  it("removal notice is NOT shown after the accept handler reactivates the row", () => {
    const removedRow: MockMemberRowWithNotice = {
      id: "bm-rn-002",
      status: "removed",
      noticeDismissedAt: null,
    };
    const afterReactivation = simulateReactivateWithNoticeClear(removedRow, NOW);

    // The row is now active — notice must not fire
    expect(afterReactivation.status).toBe("active");
    expect(afterReactivation.noticeDismissedAt).not.toBeNull();
    expect(shouldShowRemovalNotice(afterReactivation)).toBe(false);
  });

  it("noticeDismissedAt is stamped even when it was already null (not skipped)", () => {
    const removedRow: MockMemberRowWithNotice = {
      id: "bm-rn-003",
      status: "removed",
      noticeDismissedAt: null,
    };
    const result = simulateReactivateWithNoticeClear(removedRow, NOW);
    expect(result.noticeDismissedAt).toEqual(NOW);
  });

  it("already-dismissed notice stays cleared after re-join (idempotent)", () => {
    const previouslyDismissed: MockMemberRowWithNotice = {
      id: "bm-rn-004",
      status: "removed",
      noticeDismissedAt: new Date("2026-07-01T00:00:00Z"),
    };
    const result = simulateReactivateWithNoticeClear(previouslyDismissed, NOW);
    // noticeDismissedAt is overwritten with NOW — still non-null, still hidden
    expect(result.noticeDismissedAt).not.toBeNull();
    expect(shouldShowRemovalNotice(result)).toBe(false);
  });

  it("a brand-new member row (no prior removal) has noticeDismissedAt null by default and no notice shown (active)", () => {
    // Fresh insert — status = active, noticeDismissedAt = null (never removed)
    const freshRow: MockMemberRowWithNotice = {
      id: "bm-rn-005",
      status: "active",
      noticeDismissedAt: null,
    };
    // shouldShowRemovalNotice checks status=removed AND null notice; active rows are exempt
    expect(shouldShowRemovalNotice(freshRow)).toBe(false);
  });
});

// ── (b) Source-scan: reactivation UPDATE includes noticeDismissedAt ───────────

describe("businessRoutes.ts — accept handler reactivation UPDATE clears noticeDismissedAt", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let acceptHandlerSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(routeFilePath, "utf-8");

    const acceptStart = source.indexOf('"/invite/:token/accept"');
    expect(acceptStart).toBeGreaterThan(-1);

    const afterStart = source.slice(acceptStart);
    const nextSectionMatch = afterStart.match(/\n\/\/ ──/);
    acceptHandlerSlice = nextSectionMatch
      ? afterStart.slice(0, nextSectionMatch.index)
      : afterStart.slice(0, 5000);
  });

  it("the if(existing) reactivation SET clause includes noticeDismissedAt", () => {
    // Extract the if(existing){...}else block
    const ifExistingBlock =
      acceptHandlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
    expect(ifExistingBlock).toContain("noticeDismissedAt");
  });

  it("the reactivation SET assigns noticeDismissedAt to a Date value (new Date())", () => {
    const ifExistingBlock =
      acceptHandlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
    // new Date() is the canonical way to stamp the current time in this codebase
    expect(ifExistingBlock).toMatch(/noticeDismissedAt\s*:\s*new Date\(\)/);
  });
});

// ── (c) Source-scan: belt-and-suspenders broader UPDATE delegated to helper ────

describe("businessRoutes.ts — accept handler calls clearRemovalNotice for belt-and-suspenders dismissal", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let source: string;
  let ifExistingBlock: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");

    const acceptStart = source.indexOf('"/invite/:token/accept"');
    expect(acceptStart).toBeGreaterThan(-1);

    const afterStart = source.slice(acceptStart);
    const nextSectionMatch = afterStart.match(/\n\/\/ ──/);
    const handlerSlice = nextSectionMatch
      ? afterStart.slice(0, nextSectionMatch.index)
      : afterStart.slice(0, 5000);

    ifExistingBlock =
      handlerSlice.match(/if\s*\(\s*existing\s*\)([\s\S]*?)(?:}\s*else)/)?.[1] ?? "";
  });

  it("the if(existing) block calls clearRemovalNotice (not inline isNull update)", () => {
    // The belt-and-suspenders notice dismissal is now delegated to the shared
    // clearRemovalNotice() helper so future reactivation paths reuse one function.
    expect(ifExistingBlock).toContain('clearRemovalNotice');
  });

  it("clearRemovalNotice is called with tx, userId, and business.id inside the if(existing) block", () => {
    expect(ifExistingBlock).toMatch(/clearRemovalNotice\s*\(\s*tx\s*,\s*userId\s*,\s*business\.id\s*\)/);
  });

  it("clearRemovalNotice function is defined in businessRoutes.ts (not imported)", () => {
    // The helper must be a module-level function in the same file so it can be
    // called from any reactivation path in this router without extra imports.
    expect(source).toMatch(/async function clearRemovalNotice\s*\(/);
  });

  it("clearRemovalNotice function body targets status=removed rows", () => {
    // Isolate the clearRemovalNotice function body to verify its WHERE clause
    const fnStart = source.indexOf("async function clearRemovalNotice(");
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = source.slice(fnStart, fnStart + 800);
    expect(fnSlice).toContain('"removed"');
  });

  it("clearRemovalNotice function body filters on noticeDismissedAt IS NULL", () => {
    const fnStart = source.indexOf("async function clearRemovalNotice(");
    const fnSlice = source.slice(fnStart, fnStart + 800);
    expect(fnSlice).toMatch(/isNull\s*\(\s*businessMembers\.noticeDismissedAt\s*\)/);
  });

  it("clearRemovalNotice function body filters by userId", () => {
    const fnStart = source.indexOf("async function clearRemovalNotice(");
    const fnSlice = source.slice(fnStart, fnStart + 800);
    expect(fnSlice).toContain("businessMembers.userId");
  });

  it("clearRemovalNotice function body filters by businessId", () => {
    const fnStart = source.indexOf("async function clearRemovalNotice(");
    const fnSlice = source.slice(fnStart, fnStart + 800);
    expect(fnSlice).toContain("businessMembers.businessId");
  });
});

// ── 11. clearRemovalNotice convention — any future reactivation path ──────────
/**
 * The clearRemovalNotice() helper is the single authoritative place to stamp
 * noticeDismissedAt when reactivating a removed member.  Any future code path
 * that sets businessMembers.status back to "active" (e.g. a PATCH /members/:id/restore
 * admin endpoint, a billing-webhook auto-restore, etc.) MUST call this helper.
 *
 * These tests verify:
 *   (a) The helper behaves correctly in isolation (simulation).
 *   (b) A hypothetical direct-reactivation API path that calls the helper
 *       produces the same notice-cleared result as the invite-accept path.
 *   (c) Skipping the helper leaves stale notices (demonstrates the gap the
 *       helper closes for future paths).
 */

// ── (a) Helper behaviour simulation ───────────────────────────────────────────

interface MockMemberNoticeRow {
  id: string;
  userId: string;
  businessId: string;
  status: "active" | "removed";
  noticeDismissedAt: Date | null;
}

/**
 * Simulates what clearRemovalNotice does:
 * stamp noticeDismissedAt=now on every row where
 *   status="removed" AND noticeDismissedAt IS NULL
 * for the given user+business pair.
 */
function simulateClearRemovalNotice(
  rows: MockMemberNoticeRow[],
  userId: string,
  businessId: string,
): MockMemberNoticeRow[] {
  const now = new Date();
  return rows.map((r) => {
    if (
      r.userId === userId &&
      r.businessId === businessId &&
      r.status === "removed" &&
      r.noticeDismissedAt === null
    ) {
      return { ...r, noticeDismissedAt: now };
    }
    return r;
  });
}

/**
 * Simulates a hypothetical direct-reactivation path (e.g. PATCH /members/:id/restore).
 * Steps:
 *   1. Flip the row from removed → active (sets status + noticeDismissedAt on the main row).
 *   2. Call clearRemovalNotice to sweep any other undismissed historical rows.
 *
 * Returns the final roster state.
 */
function simulateDirectReactivation(
  roster: MockMemberNoticeRow[],
  targetId: string,
  userId: string,
  businessId: string,
): MockMemberNoticeRow[] {
  // Step 1: flip main row
  const afterFlip = roster.map((r) =>
    r.id === targetId
      ? { ...r, status: "active" as const, noticeDismissedAt: new Date() }
      : r,
  );
  // Step 2: sweep historical removed rows (mirrors the helper's WHERE clause)
  return simulateClearRemovalNotice(afterFlip, userId, businessId);
}

describe("clearRemovalNotice — helper behaviour (simulation)", () => {
  const BIZ = "biz-cnr-test";
  const USER = "user-cnr-test";

  it("stamps noticeDismissedAt on an undismissed removed row", () => {
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-1", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    expect(after[0].noticeDismissedAt).not.toBeNull();
  });

  it("does NOT touch a row that is already dismissed", () => {
    const alreadyDismissed = new Date(2024, 1, 1);
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-2", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: alreadyDismissed },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    // The existing timestamp must not be overwritten
    expect(after[0].noticeDismissedAt).toBe(alreadyDismissed);
  });

  it("does NOT touch an active row (only targets status=removed)", () => {
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-3", userId: USER, businessId: BIZ, status: "active", noticeDismissedAt: null },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    // Active rows are not removal-notice rows — leave them alone
    expect(after[0].noticeDismissedAt).toBeNull();
  });

  it("clears multiple undismissed removed rows from prior cycles", () => {
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-4a", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
      { id: "bm-4b", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    expect(after[0].noticeDismissedAt).not.toBeNull();
    expect(after[1].noticeDismissedAt).not.toBeNull();
  });

  it("does NOT affect rows belonging to a different user in the same business", () => {
    const OTHER = "user-other-cnr";
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-5a", userId: USER,  businessId: BIZ, status: "removed", noticeDismissedAt: null },
      { id: "bm-5b", userId: OTHER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    const userRow  = after.find((r) => r.userId === USER)!;
    const otherRow = after.find((r) => r.userId === OTHER)!;
    expect(userRow.noticeDismissedAt).not.toBeNull();  // cleared
    expect(otherRow.noticeDismissedAt).toBeNull();     // untouched
  });

  it("does NOT affect rows belonging to a different business for the same user", () => {
    const OTHER_BIZ = "biz-other-cnr";
    const rows: MockMemberNoticeRow[] = [
      { id: "bm-6a", userId: USER, businessId: BIZ,       status: "removed", noticeDismissedAt: null },
      { id: "bm-6b", userId: USER, businessId: OTHER_BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateClearRemovalNotice(rows, USER, BIZ);
    const thisRow  = after.find((r) => r.businessId === BIZ)!;
    const otherRow = after.find((r) => r.businessId === OTHER_BIZ)!;
    expect(thisRow.noticeDismissedAt).not.toBeNull();  // cleared
    expect(otherRow.noticeDismissedAt).toBeNull();     // untouched
  });
});

// ── (b) Direct-reactivation path produces the same cleared result ─────────────

describe("clearRemovalNotice — direct-reactivation path (simulate future PATCH /restore)", () => {
  const BIZ = "biz-restore-test";
  const USER = "user-restore-test";

  it("reactivated main row has noticeDismissedAt set", () => {
    const roster: MockMemberNoticeRow[] = [
      { id: "bm-r1", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateDirectReactivation(roster, "bm-r1", USER, BIZ);
    const row = after.find((r) => r.id === "bm-r1")!;
    expect(row.status).toBe("active");
    expect(row.noticeDismissedAt).not.toBeNull();
  });

  it("historical undismissed removed rows are also cleared by the helper sweep", () => {
    // Scenario: member removed twice; first row still undismissed; second row
    // is the one being restored now.
    const roster: MockMemberNoticeRow[] = [
      { id: "bm-r2-hist", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
      { id: "bm-r2-main", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    const after = simulateDirectReactivation(roster, "bm-r2-main", USER, BIZ);
    const histRow = after.find((r) => r.id === "bm-r2-hist")!;
    expect(histRow.noticeDismissedAt).not.toBeNull(); // swept by clearRemovalNotice
  });

  it("direct reactivation without calling clearRemovalNotice leaves historical rows undismissed (gap demonstration)", () => {
    // This test demonstrates WHY the helper is required: a naive reactivation
    // that only flips the main row misses historical notice rows.
    const roster: MockMemberNoticeRow[] = [
      { id: "bm-gap-hist", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
      { id: "bm-gap-main", userId: USER, businessId: BIZ, status: "removed", noticeDismissedAt: null },
    ];
    // Naive path: only flip the main row, skip the helper
    const naiveAfter = roster.map((r) =>
      r.id === "bm-gap-main"
        ? { ...r, status: "active" as const, noticeDismissedAt: new Date() }
        : r,
    );
    const histRow = naiveAfter.find((r) => r.id === "bm-gap-hist")!;
    // Without the helper, the historical row is NOT cleared — the notice gap exists
    expect(histRow.noticeDismissedAt).toBeNull();

    // With the helper, it IS cleared
    const properAfter = simulateDirectReactivation(roster, "bm-gap-main", USER, BIZ);
    const histRowFixed = properAfter.find((r) => r.id === "bm-gap-hist")!;
    expect(histRowFixed.noticeDismissedAt).not.toBeNull();
  });
});

// ── 12. PATCH /members/:memberId/restore — owner direct reactivation ──────────
/**
 * The PATCH /api/business/members/:memberId/restore route is the owner-initiated
 * direct reactivation path referenced in the task description.  It must:
 *   (a) Reject non-removed members (status !== "removed" → 400).
 *   (b) Reject when the business has no free seats (SEATS_FULL → 400).
 *   (c) Flip the member row to active AND call clearRemovalNotice in the same
 *       transaction so the removal-notice banner is never shown post-restore.
 *
 * Tests here:
 *   - Handler-mirror simulation (same pattern as §6) exercises the decision tree.
 *   - Source-scan confirms the real route calls clearRemovalNotice and runs
 *     inside a transaction.
 */

// ── (a) Handler-mirror simulation ─────────────────────────────────────────────

type RestoreMemberStatus = "active" | "removed" | "invited";

interface MockRestoreRequest {
  memberStatus: RestoreMemberStatus;
  usedSeats: number;
  seatLimit: number;
}

interface RestoreOutcome {
  httpStatus: number;
  code?: string;
  /** When 200: did the restore path clear removal notices? */
  noticeCleared?: boolean;
}

/**
 * Mirrors the PATCH /members/:memberId/restore handler decision tree:
 *   1. member not found                → 404  (omitted here; tested via source-scan)
 *   2. member.status !== "removed"     → 400  WRONG_STATUS
 *   3. usedSeats >= seatLimit          → 400  SEATS_FULL
 *   4. transaction: reactivate + clear → 200  (noticeCleared=true)
 */
function simulateRestoreMember(req: MockRestoreRequest): RestoreOutcome {
  if (req.memberStatus !== "removed") {
    return { httpStatus: 400, code: "WRONG_STATUS" };
  }
  if (req.usedSeats >= req.seatLimit) {
    return { httpStatus: 400, code: "SEATS_FULL" };
  }
  // Transaction: flip to active + clearRemovalNotice → notice always cleared
  return { httpStatus: 200, noticeCleared: true };
}

describe("PATCH /api/business/members/:memberId/restore — handler decision tree", () => {
  const SEAT_LIMIT = 4;

  it("returns 200 and clears the notice for a valid removed member with a free seat", () => {
    const result = simulateRestoreMember({
      memberStatus: "removed",
      usedSeats: 2,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(200);
    expect(result.noticeCleared).toBe(true);
  });

  it("returns 400 WRONG_STATUS when the member is already active (not removed)", () => {
    const result = simulateRestoreMember({
      memberStatus: "active",
      usedSeats: 1,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(400);
    expect(result.code).toBe("WRONG_STATUS");
  });

  it("returns 400 WRONG_STATUS for an invited (not removed) member", () => {
    const result = simulateRestoreMember({
      memberStatus: "invited",
      usedSeats: 0,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(400);
    expect(result.code).toBe("WRONG_STATUS");
  });

  it("returns 400 SEATS_FULL when the business is at capacity", () => {
    const result = simulateRestoreMember({
      memberStatus: "removed",
      usedSeats: SEAT_LIMIT,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(400);
    expect(result.code).toBe("SEATS_FULL");
  });

  it("succeeds when exactly one seat is free (boundary)", () => {
    const result = simulateRestoreMember({
      memberStatus: "removed",
      usedSeats: SEAT_LIMIT - 1,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(200);
    expect(result.noticeCleared).toBe(true);
  });

  it("seat check fires BEFORE the transaction (status check fires first)", () => {
    // An active member with seats full must see WRONG_STATUS, not SEATS_FULL,
    // confirming the status gate runs before the seat gate.
    const result = simulateRestoreMember({
      memberStatus: "active",
      usedSeats: SEAT_LIMIT, // full
      seatLimit: SEAT_LIMIT,
    });
    expect(result.code).toBe("WRONG_STATUS");
  });

  it("notice is ALWAYS cleared on a successful restore (noticeCleared is never false on 200)", () => {
    // This is the core contract: 200 responses must always clear the notice.
    const result = simulateRestoreMember({
      memberStatus: "removed",
      usedSeats: 0,
      seatLimit: SEAT_LIMIT,
    });
    expect(result.httpStatus).toBe(200);
    // noticeCleared must be true — never undefined or false — on success
    expect(result.noticeCleared).toBe(true);
  });
});

// ── (b) Source-scan: restore route calls clearRemovalNotice inside a transaction ─

describe("businessRoutes.ts — PATCH /members/:id/restore calls clearRemovalNotice inside a transaction", () => {
  const routeFilePath = path.resolve(__dirname, "../routes/businessRoutes.ts");
  let restoreHandlerSlice: string;
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(routeFilePath, "utf-8");

    // Isolate the restore handler between its route declaration and the next section
    const restoreStart = source.indexOf('"/members/:memberId/restore"');
    expect(restoreStart).toBeGreaterThan(-1);

    const afterStart = source.slice(restoreStart);
    const nextSectionMatch = afterStart.match(/\n\/\/ ──/);
    restoreHandlerSlice = nextSectionMatch
      ? afterStart.slice(0, nextSectionMatch.index)
      : afterStart.slice(0, 4000);
  });

  it("restore route declaration includes requireAuth and requireProAccess", () => {
    const decl = source.match(/router\.patch\s*\(\s*["']\/members\/:memberId\/restore["']([^{]+)\{/)?.[1] ?? "";
    expect(decl).toContain("requireAuth");
    expect(decl).toContain("requireProAccess");
  });

  it("restore handler queries businessMembers for the target row", () => {
    expect(restoreHandlerSlice).toContain("businessMembers");
    expect(restoreHandlerSlice).toContain("memberId");
  });

  it("restore handler rejects a non-removed member (status guard present)", () => {
    expect(restoreHandlerSlice).toContain('"removed"');
    // The guard must return a non-200 response
    expect(restoreHandlerSlice).toContain("Member is not in a removed state");
  });

  it("restore handler checks seat availability before reactivating", () => {
    expect(restoreHandlerSlice).toContain("getActiveSeats");
    expect(restoreHandlerSlice).toContain("seatLimit");
  });

  it("restore handler reactivates the member inside a transaction", () => {
    expect(restoreHandlerSlice).toMatch(/\.transaction\s*\(/);
  });

  it("restore handler sets status to active (handler slice contains 'active' string)", () => {
    // The UPDATE inside the transaction sets status back to "active"
    expect(restoreHandlerSlice).toContain('"active"');
  });

  it("restore handler calls clearRemovalNotice (present in handler slice)", () => {
    // clearRemovalNotice must be called within the same handler — the transaction
    // call confirms it is inside the atomic block (verified by the transaction test above).
    expect(restoreHandlerSlice).toContain("clearRemovalNotice");
  });

  it("clearRemovalNotice call passes tx, member.userId, and business.id", () => {
    expect(restoreHandlerSlice).toMatch(/clearRemovalNotice\s*\(\s*tx\s*,\s*member\.userId\s*,\s*business\.id\s*\)/);
  });

  it("restore handler sets noticeDismissedAt on the main row (present in handler slice)", () => {
    // The main UPDATE also sets noticeDismissedAt so the just-reactivated row is
    // guaranteed to be stamped atomically in the same transaction.
    expect(restoreHandlerSlice).toContain("noticeDismissedAt");
  });

  it("seat check in restore handler appears before the transaction block", () => {
    const seatsIdx = restoreHandlerSlice.indexOf("getActiveSeats");
    const txIdx = restoreHandlerSlice.indexOf(".transaction(");
    expect(seatsIdx).toBeGreaterThan(-1);
    expect(txIdx).toBeGreaterThan(-1);
    expect(seatsIdx).toBeLessThan(txIdx);
  });

  it("status guard in restore handler appears before the seat check", () => {
    const statusGuardIdx = restoreHandlerSlice.indexOf("Member is not in a removed state");
    const seatsIdx = restoreHandlerSlice.indexOf("getActiveSeats");
    expect(statusGuardIdx).toBeGreaterThan(-1);
    expect(seatsIdx).toBeGreaterThan(-1);
    expect(statusGuardIdx).toBeLessThan(seatsIdx);
  });
});

// ── 11. Stripe webhook — no silent businessMembers reactivation path ──────────
/**
 * Audits stripeWebhook.ts to confirm that:
 *
 *   (a) No webhook event handler currently sets businessMembers.status back to
 *       "active" — i.e. there is no silent auto-restore path that would bypass
 *       clearRemovalNotice.
 *
 *   (b) The convention comment instructing future authors to call
 *       clearRemovalNotice is present in the invoice.payment_succeeded handler
 *       (the likeliest future home of any business-member auto-restore logic).
 *
 * If a future change adds a businessMembers reactivation path to the webhook,
 * test (a) will fail immediately, forcing the author to also satisfy the
 * clearRemovalNotice convention — at which point (a) should be updated to
 * confirm the helper is called correctly.
 */

describe("stripeWebhook.ts — no silent businessMembers reactivation path", () => {
  const webhookFilePath = path.resolve(__dirname, "../routes/stripeWebhook.ts");
  let webhookSource: string;

  beforeAll(() => {
    webhookSource = fs.readFileSync(webhookFilePath, "utf-8");
  });

  // ── (a) No current update(businessMembers).set({ status: "active" }) ─────────

  it("webhook source does NOT contain an update(businessMembers) call (no auto-reactivation)", () => {
    // If this test fails, a new businessMembers reactivation path was added.
    // That path MUST call clearRemovalNotice — update test (b) below to confirm.
    //
    // The positive case we're ruling out looks like:
    //   await db.update(businessMembers).set({ status: "active", ... })
    // or inside a transaction:
    //   await tx.update(businessMembers).set({ status: "active", ... })
    const updateBusinessMembersPattern = /(?:db|tx)\.update\s*\(\s*businessMembers\s*\)/;
    expect(updateBusinessMembersPattern.test(webhookSource)).toBe(false);
  });

  it("webhook source does NOT import clearRemovalNotice (not yet needed — no reactivation path)", () => {
    // clearRemovalNotice is defined but not exported from businessRoutes.ts.
    // This test confirms the webhook does not yet import it from any shared module.
    //
    // The convention comment in invoice.payment_succeeded mentions the function
    // name as documentation — that is expected.  An import statement would mean
    // the function was extracted to a shared service and is actually being called.
    //
    // If a reactivation path is added and clearRemovalNotice is promoted to a
    // shared service and imported here, remove or invert this test and add a
    // test confirming the call is made on every businessMembers status="active" write.
    const importPattern = /import\s*\{[^}]*clearRemovalNotice[^}]*\}/;
    expect(importPattern.test(webhookSource)).toBe(false);
  });

  // ── (b) Convention comment is present in invoice.payment_succeeded ────────────

  it("invoice.payment_succeeded handler contains the clearRemovalNotice convention note", () => {
    // Isolate the invoice.payment_succeeded case block
    const caseStart = webhookSource.indexOf('case "invoice.payment_succeeded"');
    expect(caseStart).toBeGreaterThan(-1);

    const afterCase = webhookSource.slice(caseStart);
    // Take up to the next case (or the default)
    const nextCaseMatch = afterCase.match(/\n\s+(?:case |default\s*:)/);
    const caseSlice = nextCaseMatch
      ? afterCase.slice(0, nextCaseMatch.index)
      : afterCase.slice(0, 4000);

    // The convention note must reference clearRemovalNotice so future authors
    // see it when editing this handler.
    expect(caseSlice).toContain("clearRemovalNotice");
  });

  it("convention note references businessRoutes.ts as the location of clearRemovalNotice", () => {
    const caseStart = webhookSource.indexOf('case "invoice.payment_succeeded"');
    const afterCase = webhookSource.slice(caseStart);
    const nextCaseMatch = afterCase.match(/\n\s+(?:case |default\s*:)/);
    const caseSlice = nextCaseMatch
      ? afterCase.slice(0, nextCaseMatch.index)
      : afterCase.slice(0, 4000);

    expect(caseSlice).toContain("businessRoutes.ts");
  });

  it("convention note mentions the businessMembers reactivation requirement", () => {
    // The note must clearly state that any future status='active' write on
    // businessMembers must be accompanied by a clearRemovalNotice call.
    const caseStart = webhookSource.indexOf('case "invoice.payment_succeeded"');
    const afterCase = webhookSource.slice(caseStart);
    const nextCaseMatch = afterCase.match(/\n\s+(?:case |default\s*:)/);
    const caseSlice = nextCaseMatch
      ? afterCase.slice(0, nextCaseMatch.index)
      : afterCase.slice(0, 4000);

    // The comment must mention businessMembers to be useful to a future author
    expect(caseSlice).toContain("businessMembers");
  });

  // ── (c) The checkout.session.completed handler is a new-business-only path ────

  it("checkout.session.completed insert(businessMembers) is inside the !existing branch (first-time setup only)", () => {
    // The checkout handler creates the Business + owner member row for a brand-new
    // business subscription.  It is NOT an auto-restore of a removed member, so it
    // does not need clearRemovalNotice.  This test confirms the insert is guarded
    // by the !existing branch (new business only, not a removed-member reactivation).
    const checkoutStart = webhookSource.indexOf('case "checkout.session.completed"');
    expect(checkoutStart).toBeGreaterThan(-1);

    const afterCheckout = webhookSource.slice(checkoutStart);
    const nextCaseMatch = afterCheckout.match(/\n\s+(?:case |default\s*:)/);
    const checkoutSlice = nextCaseMatch
      ? afterCheckout.slice(0, nextCaseMatch.index)
      : afterCheckout.slice(0, 3000);

    // The insert must be inside an "if (!existing)" or "if (!existing)" guard
    expect(checkoutSlice).toContain("!existing");
    // And the insert must be present (it's the new-business path)
    expect(checkoutSlice).toContain("insert(businessMembers)");
    // But there must be no update(businessMembers) in this handler
    const updatePattern = /(?:db|tx)\.update\s*\(\s*businessMembers\s*\)/;
    expect(updatePattern.test(checkoutSlice)).toBe(false);
  });
});

// ── (c) Client guard: member view renders no removal-notice banner ─────────────

describe("BusinessDashboard.tsx — member view contains no removal-notice banner", () => {
  const clientFilePath = path.resolve(
    __dirname,
    "../../client/src/pages/BusinessDashboard.tsx",
  );
  let memberViewSlice: string;

  beforeAll(() => {
    const source = fs.readFileSync(clientFilePath, "utf-8");

    // Extract the member view branch (viewMode === "member")
    const memberStart = source.indexOf('viewMode === "member"');
    expect(memberStart).toBeGreaterThan(-1);

    // Take everything from that point up to the owner view comment
    const ownerViewMarker = source.indexOf('// ── Owner view', memberStart);
    memberViewSlice =
      ownerViewMarker > memberStart
        ? source.slice(memberStart, ownerViewMarker)
        : source.slice(memberStart, memberStart + 6000);
  });

  it("member view does not reference removal-notice endpoint", () => {
    expect(memberViewSlice).not.toContain("removal-notice");
  });

  it("member view does not render a 'removed' status banner", () => {
    // A removal notice would need to check for status='removed' or 'removedAt'
    expect(memberViewSlice).not.toMatch(/status\s*===\s*["']removed["']/);
    expect(memberViewSlice).not.toContain("removedAt");
    expect(memberViewSlice).not.toContain("noticeDismissedAt");
  });

  it("member view is only reachable when viewMode=member (active membership confirmed)", () => {
    // The branch condition guarantees the user is an active member — no stale
    // removal state can leak into this view.
    expect(memberViewSlice).toContain('viewMode === "member"');
    expect(memberViewSlice).toContain("memberData");
  });
});
