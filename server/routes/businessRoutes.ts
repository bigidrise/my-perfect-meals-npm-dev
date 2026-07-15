import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";
import { users } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { sendBusinessInviteEmail } from "../services/emailService";

const router = Router();

const getAppUrl = () =>
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
  "http://localhost:5000";

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

async function getActiveSeats(businessId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.status, "active")));
  return result[0]?.count ?? 0;
}

// ── GET /api/business/mine — owner fetches their business dashboard data
router.get("/mine", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) {
      return res.status(404).json({ error: "No business account found." });
    }

    const members = await db
      .select({
        id: businessMembers.id,
        userId: businessMembers.userId,
        role: businessMembers.role,
        status: businessMembers.status,
        joinedAt: businessMembers.joinedAt,
        name: users.username,
        email: users.email,
      })
      .from(businessMembers)
      .leftJoin(users, eq(users.id, businessMembers.userId))
      .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.status, "active")));

    const invitations = await db
      .select()
      .from(businessInvitations)
      .where(and(eq(businessInvitations.businessId, business.id), eq(businessInvitations.status, "pending")));

    const usedSeats = members.length;

    return res.json({
      business,
      members,
      invitations,
      usedSeats,
      availableSeats: business.seatLimit - usedSeats,
    });
  } catch (err) {
    console.error("[business/mine] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/business/membership — member (non-owner) checks if they're in a business
router.get("/membership", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const [membership] = await db
      .select({
        memberId: businessMembers.id,
        role: businessMembers.role,
        status: businessMembers.status,
        joinedAt: businessMembers.joinedAt,
        businessId: businesses.id,
        businessName: businesses.name,
        seatLimit: businesses.seatLimit,
        ownerUserId: businesses.ownerUserId,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(and(eq(businessMembers.userId, userId), eq(businessMembers.status, "active")))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: "Not a member of any business." });
    }

    return res.json({ membership });
  } catch (err) {
    console.error("[business/membership] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/invite — owner sends an invite
router.post("/invite", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { email, role = "staff" } = req.body as { email: string; role?: string };

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required." });
  }

  const validRoles = ["coach", "trainer", "physician", "staff"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) {
      return res.status(403).json({ error: "No business account found." });
    }

    if (business.status !== "active") {
      return res.status(403).json({ error: "Business subscription is not active." });
    }

    const usedSeats = await getActiveSeats(business.id);
    if (usedSeats >= business.seatLimit) {
      return res.status(400).json({
        error: `No seats available. Your plan includes ${business.seatLimit} seats and all are in use.`,
        code: "SEATS_FULL",
      });
    }

    // Check if email already has a pending invite
    const [existingInvite] = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.email, email.toLowerCase()),
          eq(businessInvitations.status, "pending"),
        ),
      )
      .limit(1);

    if (existingInvite) {
      return res.status(400).json({ error: "A pending invitation already exists for this email." });
    }

    // Check if user is already an active member
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(businessMembers)
        .where(
          and(
            eq(businessMembers.businessId, business.id),
            eq(businessMembers.userId, existingUser.id),
            eq(businessMembers.status, "active"),
          ),
        )
        .limit(1);

      if (existingMember) {
        return res.status(400).json({ error: "This person is already a member of your business." });
      }
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(businessInvitations).values({
      businessId: business.id,
      email: email.toLowerCase(),
      token,
      role: role as any,
      status: "pending",
      invitedByUserId: userId,
      expiresAt,
    });

    const [owner] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const inviteLink = `${getAppUrl()}/business/join/${token}`;

    await sendBusinessInviteEmail({
      to: email.toLowerCase(),
      businessName: business.name,
      inviterName: owner?.username || "Your team owner",
      inviteLink,
      role,
      expiresAt,
    });

    console.log(`✅ [business] Invite sent | business=${business.id} | to=${email} | role=${role}`);
    return res.json({ success: true, message: `Invitation sent to ${email}.` });
  } catch (err) {
    console.error("[business/invite] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── DELETE /api/business/members/:memberId — owner removes a member
router.delete("/members/:memberId", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { memberId } = req.params;

  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) {
      return res.status(403).json({ error: "No business account found." });
    }

    const [member] = await db
      .select()
      .from(businessMembers)
      .where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, business.id)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    if (member.role === "owner") {
      return res.status(400).json({ error: "Cannot remove the business owner." });
    }

    await db
      .update(businessMembers)
      .set({ status: "removed" })
      .where(eq(businessMembers.id, memberId));

    console.log(`✅ [business] Member removed | business=${business.id} | member=${memberId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[business/members/remove] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── DELETE /api/business/invitations/:token — owner cancels a pending invite
router.delete("/invitations/:token", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) {
      return res.status(403).json({ error: "No business account found." });
    }

    await db
      .update(businessInvitations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(businessInvitations.token, token),
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.status, "pending"),
        ),
      );

    return res.json({ success: true });
  } catch (err) {
    console.error("[business/invitations/cancel] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/invitations/:token/resend — owner resends an invite
router.post("/invitations/:token/resend", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) {
      return res.status(403).json({ error: "No business account found." });
    }

    const [invite] = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.token, token),
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.status, "pending"),
        ),
      )
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }

    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .update(businessInvitations)
      .set({ expiresAt: newExpiry })
      .where(eq(businessInvitations.id, invite.id));

    const [owner] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const inviteLink = `${getAppUrl()}/business/join/${token}`;

    await sendBusinessInviteEmail({
      to: invite.email,
      businessName: business.name,
      inviterName: owner?.username || "Your team owner",
      inviteLink,
      role: invite.role,
      expiresAt: newExpiry,
    });

    return res.json({ success: true, message: "Invite resent." });
  } catch (err) {
    console.error("[business/invitations/resend] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/business/invite/:token — public: get invite details for accept page
router.get("/invite/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const [invite] = await db
      .select({
        id: businessInvitations.id,
        email: businessInvitations.email,
        role: businessInvitations.role,
        status: businessInvitations.status,
        expiresAt: businessInvitations.expiresAt,
        businessName: businesses.name,
      })
      .from(businessInvitations)
      .innerJoin(businesses, eq(businesses.id, businessInvitations.businessId))
      .where(eq(businessInvitations.token, token))
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found." });
    }

    if (invite.status !== "pending") {
      return res.status(410).json({
        error: invite.status === "accepted" ? "This invitation has already been used." : "This invitation is no longer valid.",
        status: invite.status,
      });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      await db
        .update(businessInvitations)
        .set({ status: "expired" })
        .where(eq(businessInvitations.token, token));
      return res.status(410).json({ error: "This invitation has expired.", status: "expired" });
    }

    return res.json({
      email: invite.email,
      role: invite.role,
      businessName: invite.businessName,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error("[business/invite/get] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/invite/:token/accept — authenticated user accepts invite
router.post("/invite/:token/accept", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const [invite] = await db
      .select()
      .from(businessInvitations)
      .where(and(eq(businessInvitations.token, token), eq(businessInvitations.status, "pending")))
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found or already used." });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      await db.update(businessInvitations).set({ status: "expired" }).where(eq(businessInvitations.token, token));
      return res.status(410).json({ error: "This invitation has expired." });
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, invite.businessId))
      .limit(1);

    if (!business || business.status !== "active") {
      return res.status(403).json({ error: "This business account is no longer active." });
    }

    const usedSeats = await getActiveSeats(business.id);
    if (usedSeats >= business.seatLimit) {
      return res.status(400).json({
        error: "All seats are currently in use. Please contact the business owner.",
        code: "SEATS_FULL",
      });
    }

    // Check not already a member
    const [existing] = await db
      .select()
      .from(businessMembers)
      .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.userId, userId)))
      .limit(1);

    // ── Snapshot personal plan before activating membership ───────────────────
    // We NEVER overwrite the user's Stripe planLookupKey with the business plan.
    // Effective access is computed at runtime from the membership row itself.
    // We only snapshot the personal plan once (idempotent) so it can be restored
    // if the user is ever removed from this or any future business.
    const [currentUser] = await db
      .select({
        planLookupKey: users.planLookupKey,
        personalPlanLookupKey: users.personalPlanLookupKey,
        entitlements: users.entitlements,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (currentUser && currentUser.personalPlanLookupKey === null) {
      await db
        .update(users)
        .set({
          personalPlanLookupKey: currentUser.planLookupKey ?? null,
          personalEntitlements: (currentUser.entitlements ?? []) as any,
          personalSubscriptionStatus: "active",
        } as any)
        .where(eq(users.id, userId));
    }

    if (existing) {
      if (existing.status === "active") {
        return res.status(400).json({ error: "You are already a member of this business." });
      }
      // Re-activate if previously removed
      await db.update(businessMembers).set({ status: "active", joinedAt: new Date() }).where(eq(businessMembers.id, existing.id));
    } else {
      await db.insert(businessMembers).values({
        businessId: business.id,
        userId,
        role: invite.role as any,
        status: "active",
      });
    }

    // Mark invite accepted
    await db
      .update(businessInvitations)
      .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId })
      .where(eq(businessInvitations.id, invite.id));

    // NOTE: Do NOT call updateUserSubscription here. The user's planLookupKey
    // stays as their personal plan. Access tier is computed at runtime by
    // effectiveAccess.ts which checks for an active businessMembers row.

    console.log(`✅ [business] Invite accepted | business=${business.id} | user=${userId} | role=${invite.role}`);
    return res.json({ success: true, businessName: business.name, role: invite.role });
  } catch (err) {
    console.error("[business/invite/accept] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── PATCH /api/business/name — owner renames the business
router.patch("/name", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { name } = req.body as { name: string };

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Business name must be at least 2 characters." });
  }

  try {
    const result = await db
      .update(businesses)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(businesses.ownerUserId, userId));

    return res.json({ success: true });
  } catch (err) {
    console.error("[business/name] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/dev-seed — DEV ONLY: instantly create a test business for the current user
router.post("/dev-seed", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found." });
  }
  const userId = (req as any).authUser?.id as string;
  try {
    // Check if already an owner
    const [existing] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
    if (existing) {
      return res.json({ success: true, message: "Already a business owner.", businessId: existing.id });
    }

    const businessId = randomBytes(12).toString("hex");
    const seatCount = Number((req.body as any).seats) || 4;

    await db.execute(sql`
      INSERT INTO businesses (id, owner_user_id, name, stripe_customer_id, stripe_subscription_id, seat_limit, status, plan, created_at, updated_at)
      VALUES (
        ${businessId}, ${userId}, ${"My Business Team"}, ${"dev_test_customer"}, ${"dev_test_sub"},
        ${seatCount}, ${"active"}, ${"clinical_business_monthly"}, NOW(), NOW()
      )
    `);

    await db.execute(sql`
      INSERT INTO business_members (id, business_id, user_id, role, status, joined_at)
      VALUES (${randomBytes(12).toString("hex")}, ${businessId}, ${userId}, ${"owner"}, ${"active"}, NOW())
    `);

    // NOTE: Do NOT write clinical_business_monthly to the user's planLookupKey.
    // Effective access is computed at runtime from the businessMembers row.

    console.log(`[dev-seed] Created test business ${businessId} for user ${userId}`);
    return res.json({ success: true, businessId, seats: seatCount });
  } catch (err) {
    console.error("[business/dev-seed] error:", err);
    return res.status(500).json({ error: "Seed failed.", detail: String(err) });
  }
});

// ── DELETE /api/business/dev-seed — DEV ONLY: wipe test business for the current user
router.delete("/dev-seed", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found." });
  }
  const userId = (req as any).authUser?.id as string;
  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
    if (!biz) return res.json({ success: true, message: "Nothing to delete." });

    await db.execute(sql`DELETE FROM business_invitations WHERE business_id = ${biz.id}`);
    await db.execute(sql`DELETE FROM business_members WHERE business_id = ${biz.id}`);
    await db.execute(sql`DELETE FROM businesses WHERE id = ${biz.id}`);

    console.log(`[dev-seed] Wiped test business ${biz.id} for user ${userId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[business/dev-seed DELETE] error:", err);
    return res.status(500).json({ error: "Wipe failed.", detail: String(err) });
  }
});

export default router;
