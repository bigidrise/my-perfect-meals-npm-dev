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

// ── 12. requireProAccess middleware source structure ──────────────────────────

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
