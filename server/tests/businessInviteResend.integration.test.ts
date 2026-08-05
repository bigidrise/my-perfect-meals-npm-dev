/**
 * Integration tests — POST /api/business/invitations/:token/resend
 *
 * These tests directly exercise the DB operations the resend handler performs
 * (same pattern as businessReJoin.integration.test.ts — no HTTP server required).
 *
 * Assertions:
 *   1. After resend, expiresAt advances by ~7 days from the moment of the call
 *      (i.e. the new expiry is always LATER than the old one).
 *   2. The invite token is never modified — the invite link stays the same.
 *   3. The WHERE clause used to look up the invite (status = "pending") does NOT
 *      match an accepted or cancelled invite, so those correctly produce no
 *      result (which the handler maps to a 404).
 *
 * Test isolation: every suite seeds its own business + invitations using
 * random UUIDs/tokens.  All rows are deleted in afterAll.
 */

import { randomBytes, randomUUID } from "crypto";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { businesses, businessInvitations } from "../db/schema/business";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a random invite token (mirrors generateInviteToken in businessRoutes.ts) */
function makeToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Mirrors the WHERE clause the resend handler uses to look up the invite:
 *   token = :token AND businessId = :businessId AND status = "pending"
 *
 * Returns the invite row, or undefined if not found.
 */
async function findPendingInvite(token: string, businessId: string) {
  const [row] = await db
    .select()
    .from(businessInvitations)
    .where(
      and(
        eq(businessInvitations.token, token),
        eq(businessInvitations.businessId, businessId),
        eq(businessInvitations.status, "pending"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Mirrors the UPDATE the resend handler applies:
 *   SET expiresAt = now + 7 days WHERE id = :id
 *
 * Returns the new expiry date.
 */
async function applyResendUpdate(inviteId: string): Promise<Date> {
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db
    .update(businessInvitations)
    .set({ expiresAt: newExpiry })
    .where(eq(businessInvitations.id, inviteId));
  return newExpiry;
}

// ── Suite A: expiresAt advances and token stays the same ──────────────────────

describe("Integration — resend refreshes expiresAt while keeping the token unchanged", () => {
  const OWNER_USER_ID = `test-resend-owner-${randomUUID()}`;
  let businessId: string;
  let inviteId: string;
  const token = makeToken();
  /** expiresAt recorded right after seeding — used as the "before resend" baseline */
  let originalExpiry: Date;

  beforeAll(async () => {
    // Seed a business
    const [biz] = await db
      .insert(businesses)
      .values({
        name: "Resend Integration Test Biz",
        ownerUserId: OWNER_USER_ID,
        stripeCustomerId: "dev_resend_cust",
        stripeSubscriptionId: "dev_resend_sub",
        seatLimit: 4,
        status: "active",
      })
      .returning({ id: businesses.id });
    businessId = biz.id;

    // Seed a pending client invitation that is already near-expiry so the
    // difference between old and new expiresAt is unambiguous.
    const nearExpiry = new Date(Date.now() + 1 * 60 * 1000); // 1 minute from now
    const [inv] = await db
      .insert(businessInvitations)
      .values({
        businessId,
        email: "resend-client@test.example",
        token,
        role: "staff",
        status: "pending",
        invitedByUserId: OWNER_USER_ID,
        expiresAt: nearExpiry,
        invitationType: "client",
        trialDays: 30,
        programName: "Test Program",
      })
      .returning({ id: businessInvitations.id });
    inviteId = inv.id;
    originalExpiry = nearExpiry;
  }, 30_000);

  afterAll(async () => {
    if (businessId) {
      await db
        .delete(businessInvitations)
        .where(eq(businessInvitations.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
  }, 30_000);

  it("pre-condition: invite is pending with a near-expiry before resend", async () => {
    const invite = await findPendingInvite(token, businessId);
    expect(invite).not.toBeNull();
    expect(invite!.status).toBe("pending");
    // Confirm the original expiry is within ~2 minutes of now (near-expiry seeding)
    const msUntilExpiry = invite!.expiresAt.getTime() - Date.now();
    expect(msUntilExpiry).toBeGreaterThan(0);
    expect(msUntilExpiry).toBeLessThan(2 * 60 * 1000);
  });

  it("handler lookup finds the pending invite by token + businessId + status", async () => {
    const invite = await findPendingInvite(token, businessId);
    expect(invite).not.toBeNull();
    expect(invite!.id).toBe(inviteId);
  });

  it("after applying the resend update, expiresAt is ~7 days later than the original expiry", async () => {
    const beforeUpdate = Date.now();
    const newExpiry = await applyResendUpdate(inviteId);

    // New expiry must be strictly later than the old one
    expect(newExpiry.getTime()).toBeGreaterThan(originalExpiry.getTime());

    // New expiry should be approximately 7 days from the moment the update ran:
    // allow ±5 seconds of clock drift in CI.
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tolerance = 5_000; // 5 seconds
    const elapsed = newExpiry.getTime() - beforeUpdate;
    expect(elapsed).toBeGreaterThanOrEqual(sevenDaysMs - tolerance);
    expect(elapsed).toBeLessThanOrEqual(sevenDaysMs + tolerance);
  });

  it("the updated expiresAt is persisted — DB row reflects the new expiry", async () => {
    const [row] = await db
      .select({ expiresAt: businessInvitations.expiresAt })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, inviteId));

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tolerance = 5_000;
    const elapsed = row.expiresAt.getTime() - Date.now();
    // Should be ~7 days in the future (minus a tiny bit of test execution time)
    expect(elapsed).toBeGreaterThan(sevenDaysMs - tolerance);
    expect(elapsed).toBeLessThanOrEqual(sevenDaysMs + tolerance);
  });

  it("the invite token is unchanged after the resend update (same invite link)", async () => {
    const [row] = await db
      .select({ token: businessInvitations.token })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, inviteId));

    // Token must be identical — resend never regenerates it
    expect(row.token).toBe(token);
  });

  it("the invite status remains 'pending' after the resend update (not re-created)", async () => {
    const [row] = await db
      .select({ status: businessInvitations.status })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, inviteId));

    expect(row.status).toBe("pending");
  });
});

// ── Suite B: non-pending invites are invisible to the resend handler ──────────

describe("Integration — resend lookup returns nothing for accepted or cancelled invites", () => {
  const OWNER_USER_ID = `test-resend-nonpending-owner-${randomUUID()}`;
  let businessId: string;
  const acceptedToken = makeToken();
  const cancelledToken = makeToken();

  beforeAll(async () => {
    const [biz] = await db
      .insert(businesses)
      .values({
        name: "Resend Non-Pending Test Biz",
        ownerUserId: OWNER_USER_ID,
        stripeCustomerId: "dev_resend_np_cust",
        stripeSubscriptionId: "dev_resend_np_sub",
        seatLimit: 4,
        status: "active",
      })
      .returning({ id: businesses.id });
    businessId = biz.id;

    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Seed an accepted invitation
    await db.insert(businessInvitations).values({
      businessId,
      email: "resend-accepted@test.example",
      token: acceptedToken,
      role: "staff",
      status: "accepted",
      invitedByUserId: OWNER_USER_ID,
      expiresAt: farFuture,
      invitationType: "client",
      trialDays: 30,
    });

    // Seed a cancelled invitation
    await db.insert(businessInvitations).values({
      businessId,
      email: "resend-cancelled@test.example",
      token: cancelledToken,
      role: "staff",
      status: "cancelled",
      invitedByUserId: OWNER_USER_ID,
      expiresAt: farFuture,
      invitationType: "client",
      trialDays: 30,
    });
  }, 30_000);

  afterAll(async () => {
    if (businessId) {
      await db
        .delete(businessInvitations)
        .where(eq(businessInvitations.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
  }, 30_000);

  it("the resend WHERE clause finds nothing for an accepted invite — handler would 404", async () => {
    // This mirrors exactly what the handler does: look for status = "pending"
    const invite = await findPendingInvite(acceptedToken, businessId);
    // No row found → handler returns 404 ("Invite not found or already used.")
    expect(invite).toBeNull();
  });

  it("the resend WHERE clause finds nothing for a cancelled invite — handler would 404", async () => {
    const invite = await findPendingInvite(cancelledToken, businessId);
    expect(invite).toBeNull();
  });

  it("the resend WHERE clause also finds nothing for a completely unknown token", async () => {
    const bogusToken = makeToken();
    const invite = await findPendingInvite(bogusToken, businessId);
    expect(invite).toBeNull();
  });
});
