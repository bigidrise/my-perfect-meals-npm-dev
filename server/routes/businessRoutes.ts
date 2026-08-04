import { Router } from "express";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { db } from "../db";
import { eq, and, sql, isNull } from "drizzle-orm";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";
import { users } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { sendBusinessInviteEmail } from "../services/emailService";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" as any })
  : null;

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
router.get("/mine", requireAuth, requireProAccess, async (req, res) => {
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

    const pendingInvitations = await db
      .select()
      .from(businessInvitations)
      .where(and(eq(businessInvitations.businessId, business.id), eq(businessInvitations.status, "pending")));

    // Auto-heal: if a pending invite's email already belongs to an active member
    // (happens when the accept transaction partially failed), mark it accepted now.
    const memberEmails = new Set(members.map((m) => m.email?.toLowerCase()).filter(Boolean));
    const stuckInviteIds = pendingInvitations
      .filter((inv) => memberEmails.has(inv.email?.toLowerCase()))
      .map((inv) => inv.id);

    if (stuckInviteIds.length > 0) {
      for (const id of stuckInviteIds) {
        await db
          .update(businessInvitations)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(eq(businessInvitations.id, id));
      }
    }

    const invitations = pendingInvitations.filter((inv) => !stuckInviteIds.includes(inv.id));

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
        independentClientPolicy: businesses.independentClientPolicy,
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
router.post("/invite", requireAuth, requireProAccess, async (req, res) => {
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
    const [pendingInvCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(businessInvitations)
      .where(and(eq(businessInvitations.businessId, business.id), eq(businessInvitations.status, "pending")));
    const occupiedSeats = usedSeats + (pendingInvCount?.count ?? 0);
    if (occupiedSeats >= business.seatLimit) {
      return res.status(400).json({
        error: `No seats available. Your plan includes ${business.seatLimit} seats and all are filled or reserved by pending invitations.`,
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

    // Stamp the current policy at time of invite (raw SQL — column added via boot migration)
    await db.execute(
      sql`UPDATE business_invitations SET policy_snapshot = ${business.independentClientPolicy} WHERE token = ${token}`
    );

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
router.delete("/members/:memberId", requireAuth, requireProAccess, async (req, res) => {
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
      .set({ status: "removed", removedAt: new Date() })
      .where(eq(businessMembers.id, memberId));

    console.log(`✅ [business] Member removed | business=${business.id} | member=${memberId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[business/members/remove] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/removal-notice/dismiss — member acknowledges their removal notice
// Sets noticeDismissedAt on the most recent undismissed removed membership row.
// Tied to the specific removal event so a future re-removal generates a fresh notice.
router.post("/removal-notice/dismiss", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    await db
      .update(businessMembers)
      .set({ noticeDismissedAt: new Date() })
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "removed"),
          isNull(businessMembers.noticeDismissedAt)
        )
      );
    return res.json({ success: true });
  } catch (err) {
    console.error("[business/removal-notice/dismiss] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── DELETE /api/business/invitations/:token — owner cancels a pending invite
router.delete("/invitations/:token", requireAuth, requireProAccess, async (req, res) => {
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
router.post("/invitations/:token/resend", requireAuth, requireProAccess, async (req, res) => {
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

// ── PATCH /api/business/policy — owner updates independent_client_policy
router.patch("/policy", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { policy } = req.body as { policy: string };

  const validPolicies = ["org_only", "allowed_with_disclosure", "allowed"];
  if (!policy || !validPolicies.includes(policy)) {
    return res.status(400).json({ error: "Invalid policy value. Must be one of: org_only, allowed_with_disclosure, allowed." });
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

    const oldPolicy = business.independentClientPolicy;

    await db
      .update(businesses)
      .set({ independentClientPolicy: policy as any, updatedAt: new Date() })
      .where(eq(businesses.id, business.id));

    await db.execute(
      sql`INSERT INTO business_policy_history (business_id, changed_by_user_id, old_policy, new_policy) VALUES (${business.id}, ${userId}, ${oldPolicy}, ${policy})`
    );

    console.log(`✅ [business] Policy updated | business=${business.id} | ${oldPolicy} → ${policy}`);
    return res.json({ success: true, policy });
  } catch (err) {
    console.error("[business/policy] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── PATCH /api/business/org-policies — owner updates org-level policy flags
router.patch("/org-policies", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { requireAcademy, requireProfessionalVerification } = req.body as {
    requireAcademy?: boolean;
    requireProfessionalVerification?: boolean;
  };

  if (typeof requireAcademy !== "boolean" && typeof requireProfessionalVerification !== "boolean") {
    return res.status(400).json({ error: "At least one policy flag must be provided." });
  }

  try {
    const { businesses } = await import("../db/schema/business");
    const [business] = await db
      .select({ id: businesses.id, organizationId: businesses.organizationId })
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (!business) return res.status(403).json({ error: "No business account found." });
    if (!business.organizationId) return res.status(400).json({ error: "Business has no linked organization." });

    const { organizations } = await import("../db/schema/organizations");
    const [org] = await db
      .select({ featureFlags: organizations.featureFlags })
      .from(organizations)
      .where(eq(organizations.id, business.organizationId))
      .limit(1);

    if (!org) return res.status(404).json({ error: "Organization not found." });

    const merged = {
      ...(org.featureFlags as Record<string, unknown>),
      ...(typeof requireAcademy === "boolean" ? { requireAcademy } : {}),
      ...(typeof requireProfessionalVerification === "boolean" ? { requireProfessionalVerification } : {}),
    };

    await db
      .update(organizations)
      .set({ featureFlags: merged as any, updatedAt: new Date() })
      .where(eq(organizations.id, business.organizationId));

    const { clearOrgCache } = await import("../lib/orgContext");
    clearOrgCache(business.organizationId);

    console.log(`✅ [business] Org policies updated | org=${business.organizationId} | ${JSON.stringify(merged)}`);
    return res.json({ success: true, featureFlags: merged });
  } catch (err) {
    console.error("[business/org-policies] error:", err);
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
        independentClientPolicy: businesses.independentClientPolicy,
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
      independentClientPolicy: invite.independentClientPolicy,
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

    if (existing && existing.status === "active") {
      return res.status(400).json({ error: "You are already a member of this business." });
    }

    // Atomically update member row + mark invite accepted so they can never diverge
    await db.transaction(async (tx) => {
      if (existing) {
        // Re-activate if previously removed
        await tx.update(businessMembers).set({ status: "active", joinedAt: new Date() }).where(eq(businessMembers.id, existing.id));
      } else {
        await tx.insert(businessMembers).values({
          businessId: business.id,
          userId,
          role: invite.role as any,
          status: "active",
        });
      }

      await tx
        .update(businessInvitations)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId })
        .where(eq(businessInvitations.id, invite.id));
    });

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
router.patch("/name", requireAuth, requireProAccess, async (req, res) => {
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

// ── POST /api/business/seats — owner updates seat count (syncs Stripe subscription quantity)
router.post("/seats", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  if (!userId) return res.status(401).json({ error: "Not authenticated." });

  const newSeats = Number((req.body as any).seats);
  if (!Number.isInteger(newSeats) || newSeats < 1 || newSeats > 250) {
    return res.status(400).json({ error: "Seat count must be between 1 and 250." });
  }

  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
    if (!biz) return res.status(404).json({ error: "No business found for this account." });
    if (biz.status !== "active") return res.status(400).json({ error: "Business subscription is not active." });

    const activeSeats = await getActiveSeats(biz.id);
    if (newSeats < activeSeats) {
      return res.status(400).json({
        error: `Cannot reduce to ${newSeats} seat${newSeats !== 1 ? "s" : ""}. You have ${activeSeats} active member${activeSeats !== 1 ? "s" : ""} using seats. Remove members first.`,
      });
    }

    // Update Stripe subscription quantity if we have a live subscription ID
    if (stripe && biz.stripeSubscriptionId && !biz.stripeSubscriptionId.startsWith("dev_")) {
      const subscription = await stripe.subscriptions.retrieve(biz.stripeSubscriptionId);
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) return res.status(500).json({ error: "Could not locate subscription item on Stripe." });

      await stripe.subscriptions.update(biz.stripeSubscriptionId, {
        items: [{ id: itemId, quantity: newSeats }],
        proration_behavior: "always_invoice",
      });
      console.log(`✅ [business/seats] Stripe quantity updated → ${newSeats} | biz=${biz.id} | owner=${userId}`);
    }

    // Sync local seatLimit
    await db.update(businesses).set({ seatLimit: newSeats, updatedAt: new Date() }).where(eq(businesses.id, biz.id));
    console.log(`✅ [business/seats] local seatLimit updated → ${newSeats} | biz=${biz.id}`);

    return res.json({ success: true, seatLimit: newSeats });
  } catch (err: any) {
    console.error("[business/seats] error:", err);
    return res.status(500).json({ error: err?.message || "Server error." });
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

// ── GET /api/business/policy-history — owner views policy change log
router.get("/policy-history", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);
    if (!business) {
      return res.status(403).json({ error: "No business account found." });
    }
    const history = await db.execute(sql`
      SELECT
        bph.id,
        bph.old_policy,
        bph.new_policy,
        bph.changed_at,
        u.username AS changed_by_name,
        u.email    AS changed_by_email
      FROM business_policy_history bph
      LEFT JOIN users u ON u.id::text = bph.changed_by_user_id
      WHERE bph.business_id = ${business.id}
      ORDER BY bph.changed_at DESC
      LIMIT 20
    `);
    return res.json({ history: history.rows });
  } catch (err) {
    console.error("[business/policy-history] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/business/members/:memberId/clients — owner views a member's client accounting
router.get("/members/:memberId/clients", requireAuth, requireProAccess, async (req, res) => {
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
      .select({
        id: businessMembers.id,
        userId: businessMembers.userId,
        role: businessMembers.role,
        status: businessMembers.status,
        name: users.username,
        email: users.email,
      })
      .from(businessMembers)
      .leftJoin(users, eq(users.id, businessMembers.userId))
      .where(
        and(
          eq(businessMembers.id, memberId),
          eq(businessMembers.businessId, business.id),
          eq(businessMembers.status, "active")
        )
      )
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Member not found in this organization." });
    }

    const policy = business.independentClientPolicy ?? "allowed_with_disclosure";

    // Count via studio memberships — no ownership stamp exists yet, all are unclassified
    const studioResult = await db.execute(sql`
      SELECT COUNT(sm.id)::int AS count
      FROM studio_memberships sm
      INNER JOIN studios s ON s.id = sm.studio_id
      WHERE s.owner_user_id = ${member.userId}
        AND sm.status = 'active'
    `);

    // Count via direct care team links — also unclassified
    const careResult = await db.execute(sql`
      SELECT COUNT(id)::int AS count
      FROM client_links
      WHERE pro_user_id = ${member.userId}
        AND active = true
    `);

    const studioCount = Number((studioResult.rows[0] as any)?.count ?? 0);
    const careCount = Number((careResult.rows[0] as any)?.count ?? 0);
    const unknownClientCount = studioCount + careCount;

    // Compliance is deterministic only once ownership stamping exists.
    // With no stamps, zero clients = compliant; any unclassified clients = indeterminate.
    const compliance: "compliant" | "unknown" | "violation" =
      unknownClientCount === 0 ? "compliant" : "unknown";

    return res.json({
      member: {
        id: member.id,
        name: member.name || member.email || "Unknown",
        email: member.email || "",
        role: member.role,
        seatStatus: member.status,
      },
      policy,
      organizationClients: {
        count: 0,
        clients: [],
      },
      personalClients: {
        count: 0,
        identitiesVisible: false,
      },
      unknownClientCount,
      compliance,
    });
  } catch (err) {
    console.error("[business/members/clients] error:", err);
    return res.status(500).json({ error: "Server error." });
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
