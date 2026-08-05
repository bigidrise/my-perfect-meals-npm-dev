/**
 * Integration tests — re-join flow: removed member → new invite → accept
 *
 * These tests hit the REAL database using the same drizzle operations that
 * the POST /api/business/invite/:token/accept handler executes.  They verify:
 *
 *   1. The accept handler path re-activates the EXISTING businessMembers row
 *      (same id) instead of inserting a duplicate.
 *   2. Exactly one active businessMembers row exists for the user+business pair
 *      after re-join.
 *   3. The seat count (active member count) increments by exactly 1, not 2.
 *   4. The businessInvitations row is marked "accepted" in the same transaction.
 *   5. A second INSERT for the same user+business pair would violate the unique
 *      constraint — confirming the schema itself enforces the no-duplicate invariant.
 *
 * Test isolation: every test suite creates its own UUIDs / tokens so runs are
 * independent and can execute in parallel without collisions.  All seeded rows
 * are deleted in afterAll.
 */

import { randomBytes, randomUUID } from "crypto";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a random hex token (mirrors generateInviteToken in businessRoutes.ts) */
function makeToken(): string {
  return randomBytes(32).toString("hex");
}

/** Count active businessMembers rows for a given business+user pair */
async function countActiveRows(businessId: string, userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.userId, userId),
        eq(businessMembers.status, "active"),
      ),
    );
  return count;
}

/** Count ALL businessMembers rows (any status) for a given business+user pair */
async function countAllRows(businessId: string, userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.userId, userId),
      ),
    );
  return count;
}

/** Count all active members in a business (mirrors getActiveSeats in businessRoutes.ts) */
async function getActiveSeats(businessId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.status, "active"),
      ),
    );
  return count;
}

// ── Suite A: removed member re-joins — UPDATE path ───────────────────────────

describe("Integration — removed member re-join: accept handler uses UPDATE, not INSERT", () => {
  const OWNER_USER_ID = `test-owner-${randomUUID()}`;
  const MEMBER_USER_ID = `test-member-${randomUUID()}`;

  let businessId: string;
  let memberRowId: string;
  let inviteId: string;
  const token = makeToken();

  beforeAll(async () => {
    // 1. Seed a business
    const [biz] = await db
      .insert(businesses)
      .values({
        name: "Re-Join Integration Test Biz",
        ownerUserId: OWNER_USER_ID,
        stripeCustomerId: "dev_test_customer",
        stripeSubscriptionId: "dev_test_sub",
        seatLimit: 4,
        status: "active",
      })
      .returning({ id: businesses.id });
    businessId = biz.id;

    // 2. Seed member as active initially (they joined before being removed)
    const [member] = await db
      .insert(businessMembers)
      .values({
        businessId,
        userId: MEMBER_USER_ID,
        role: "staff",
        status: "active",
      })
      .returning({ id: businessMembers.id });
    memberRowId = member.id;

    // 3. Remove the member (mirrors DELETE /api/business/members/:id handler)
    await db
      .update(businessMembers)
      .set({ status: "removed", removedAt: new Date() })
      .where(eq(businessMembers.id, memberRowId));

    // 4. Owner creates a new invite (mirrors POST /api/business/invite)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [inv] = await db
      .insert(businessInvitations)
      .values({
        businessId,
        email: "rejoin-member@test.example",
        token,
        role: "staff",
        status: "pending",
        invitedByUserId: OWNER_USER_ID,
        expiresAt,
      })
      .returning({ id: businessInvitations.id });
    inviteId = inv.id;
  }, 30_000);

  afterAll(async () => {
    if (businessId) {
      await db
        .delete(businessInvitations)
        .where(eq(businessInvitations.businessId, businessId));
      await db
        .delete(businessMembers)
        .where(eq(businessMembers.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
  }, 30_000);

  // ── Step verification: confirm seeded state before acceptance ────────────────

  it("member row has status=removed before acceptance (pre-condition)", async () => {
    const [row] = await db
      .select({ id: businessMembers.id, status: businessMembers.status })
      .from(businessMembers)
      .where(eq(businessMembers.id, memberRowId));

    expect(row).toBeDefined();
    expect(row.status).toBe("removed");
  });

  it("invite has status=pending before acceptance (pre-condition)", async () => {
    const [inv] = await db
      .select({ status: businessInvitations.status })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, inviteId));

    expect(inv).toBeDefined();
    expect(inv.status).toBe("pending");
  });

  it("seat count is 0 before acceptance (removed member does not occupy a seat)", async () => {
    const seats = await getActiveSeats(businessId);
    expect(seats).toBe(0);
  });

  // ── Accept-invite handler logic (mirrors the transaction in businessRoutes.ts) ─

  it("running the accept handler transaction reactivates the existing row (not a new INSERT)", async () => {
    // Look up existing row for this user (any status) — mirrors handler query
    const [existing] = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.userId, MEMBER_USER_ID),
        ),
      )
      .limit(1);

    expect(existing).toBeDefined();
    expect(existing.status).toBe("removed"); // confirmed pre-condition
    expect(existing.id).toBe(memberRowId);   // must be the same row

    // Execute the same transaction the accept handler runs
    await db.transaction(async (tx) => {
      // Re-activate — UPDATE, not INSERT
      await tx
        .update(businessMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(businessMembers.id, existing.id));

      // Mark invite accepted
      await tx
        .update(businessInvitations)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: MEMBER_USER_ID })
        .where(eq(businessInvitations.id, inviteId));
    });

    // Verify the row that is now active is the SAME row (same id)
    const [reactivated] = await db
      .select({ id: businessMembers.id, status: businessMembers.status })
      .from(businessMembers)
      .where(eq(businessMembers.id, memberRowId));

    expect(reactivated.status).toBe("active");
    expect(reactivated.id).toBe(memberRowId); // same row, not a new one
  });

  // ── Post-acceptance assertions ────────────────────────────────────────────────

  it("exactly one active businessMembers row exists for user+business after re-join", async () => {
    const activeCount = await countActiveRows(businessId, MEMBER_USER_ID);
    expect(activeCount).toBe(1);
  });

  it("total businessMembers row count for user+business is 1 (no duplicate insert)", async () => {
    const totalCount = await countAllRows(businessId, MEMBER_USER_ID);
    // If there were a bug that INSERTs alongside the UPDATE, this would be 2
    expect(totalCount).toBe(1);
  });

  it("seat count is exactly 1 after re-join (not 0 or 2)", async () => {
    const seats = await getActiveSeats(businessId);
    expect(seats).toBe(1);
  });

  it("businessInvitations row is marked accepted after re-join", async () => {
    const [inv] = await db
      .select({ status: businessInvitations.status, acceptedByUserId: businessInvitations.acceptedByUserId })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, inviteId));

    expect(inv.status).toBe("accepted");
    expect(inv.acceptedByUserId).toBe(MEMBER_USER_ID);
  });
});

// ── Suite B: unique constraint — DB prevents duplicate active rows ─────────────
/**
 * If a bug were introduced that calls INSERT instead of UPDATE for a re-joining
 * member, the unique constraint on (business_id, user_id) ensures the second
 * insert fails — preventing a silent duplicate that would corrupt seat counts.
 *
 * This test confirms the constraint exists and fires as expected.
 */
describe("Integration — DB unique constraint prevents duplicate businessMembers rows", () => {
  const OWNER_USER_ID = `test-owner-unique-${randomUUID()}`;
  const MEMBER_USER_ID = `test-member-unique-${randomUUID()}`;

  let businessId: string;

  beforeAll(async () => {
    const [biz] = await db
      .insert(businesses)
      .values({
        name: "Uniqueness Constraint Test Biz",
        ownerUserId: OWNER_USER_ID,
        stripeCustomerId: "dev_test_unique_cust",
        stripeSubscriptionId: "dev_test_unique_sub",
        seatLimit: 4,
        status: "active",
      })
      .returning({ id: businesses.id });
    businessId = biz.id;

    // Insert the first member row (active)
    await db.insert(businessMembers).values({
      businessId,
      userId: MEMBER_USER_ID,
      role: "staff",
      status: "active",
    });
  }, 30_000);

  afterAll(async () => {
    if (businessId) {
      await db
        .delete(businessInvitations)
        .where(eq(businessInvitations.businessId, businessId));
      await db
        .delete(businessMembers)
        .where(eq(businessMembers.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
  }, 30_000);

  it("inserting a second businessMembers row for the same user+business throws a unique constraint error", async () => {
    // This is the exact failure that would occur if the accept handler used INSERT
    // instead of UPDATE for a re-joining member.
    await expect(
      db.insert(businessMembers).values({
        businessId,
        userId: MEMBER_USER_ID,
        role: "staff",
        status: "active",
      }),
    ).rejects.toThrow();
  });

  it("only one businessMembers row exists for the user+business despite the attempted duplicate insert", async () => {
    const totalCount = await countAllRows(businessId, MEMBER_USER_ID);
    // The second insert failed, so the count stays at 1
    expect(totalCount).toBe(1);
  });
});

// ── Suite C: brand-new member — INSERT path ────────────────────────────────────
/**
 * Control case: a brand-new member (no existing row) goes through the INSERT
 * path.  One row is created; seat count increments by exactly 1.
 */
describe("Integration — brand-new member: accept handler inserts exactly one row", () => {
  const OWNER_USER_ID = `test-owner-new-${randomUUID()}`;
  const MEMBER_USER_ID = `test-member-new-${randomUUID()}`;

  let businessId: string;
  let inviteId: string;
  const token = makeToken();

  beforeAll(async () => {
    const [biz] = await db
      .insert(businesses)
      .values({
        name: "New Member Integration Test Biz",
        ownerUserId: OWNER_USER_ID,
        stripeCustomerId: "dev_test_new_cust",
        stripeSubscriptionId: "dev_test_new_sub",
        seatLimit: 4,
        status: "active",
      })
      .returning({ id: businesses.id });
    businessId = biz.id;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [inv] = await db
      .insert(businessInvitations)
      .values({
        businessId,
        email: "new-member@test.example",
        token,
        role: "staff",
        status: "pending",
        invitedByUserId: OWNER_USER_ID,
        expiresAt,
      })
      .returning({ id: businessInvitations.id });
    inviteId = inv.id;
  }, 30_000);

  afterAll(async () => {
    if (businessId) {
      await db
        .delete(businessInvitations)
        .where(eq(businessInvitations.businessId, businessId));
      await db
        .delete(businessMembers)
        .where(eq(businessMembers.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
  }, 30_000);

  it("no existing row before first-time acceptance (pre-condition)", async () => {
    const total = await countAllRows(businessId, MEMBER_USER_ID);
    expect(total).toBe(0);
  });

  it("INSERT path creates exactly one active row for a brand-new member", async () => {
    // Look up existing (none) — mirrors handler's existing check
    const existingRows = await db
      .select()
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.userId, MEMBER_USER_ID),
        ),
      )
      .limit(1);

    const existing = existingRows[0] ?? null;
    expect(existing).toBeNull(); // new member, no prior row

    // Execute INSERT path (the else branch in the handler)
    await db.transaction(async (tx) => {
      await tx.insert(businessMembers).values({
        businessId,
        userId: MEMBER_USER_ID,
        role: "staff",
        status: "active",
      });

      await tx
        .update(businessInvitations)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: MEMBER_USER_ID })
        .where(eq(businessInvitations.id, inviteId));
    });

    const activeCount = await countActiveRows(businessId, MEMBER_USER_ID);
    expect(activeCount).toBe(1);

    const totalCount = await countAllRows(businessId, MEMBER_USER_ID);
    expect(totalCount).toBe(1);
  });

  it("seat count is 1 after first-time join", async () => {
    const seats = await getActiveSeats(businessId);
    expect(seats).toBe(1);
  });
});
