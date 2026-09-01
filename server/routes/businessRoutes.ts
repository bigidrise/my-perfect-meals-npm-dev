import { Router } from "express";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { db } from "../db";
import { eq, and, ne, sql, isNull, gt, or } from "drizzle-orm";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";
import { users } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireProOrOrgAdmin } from "../middleware/requireProOrOrgAdmin";
import { sendBusinessInviteEmail } from "../services/emailService";
import {
  normalizeEmailIdentity,
  resolveEmailIdentityForEmail,
  resolveEmailIdentityForUser,
} from "../services/emailIdentityService";
import {
  acceptOrganizationalPilotInvitation,
  cancelOrganizationalPilotInvitation,
  createOrganizationalPilotInvitation,
  expireOrganizationalPilotInvitation,
  findOrganizationalPilotInvitation,
  PilotInvitationError,
  resendOrganizationalPilotInvitation,
  type PilotInvitationRole,
} from "../services/organizationalPilotInvitationService";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" as any })
  : null;

const router = Router();

function handlePilotInvitationError(res: any, error: unknown) {
  if (error instanceof PilotInvitationError) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code });
  }
  throw error;
}

router.post("/pilots/:pilotId/invitations", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const populationType = req.body?.populationType;
    const participantRole = req.body?.participantRole as PilotInvitationRole;
    if (populationType !== "professional" && populationType !== "client") {
      return res.status(400).json({ error: "populationType must be professional or client.", code: "INVALID_POPULATION" });
    }
    const allowedRoles = populationType === "professional"
      ? ["nurse", "provider", "coach", "staff"]
      : ["client"];
    if (!allowedRoles.includes(participantRole)) {
      return res.status(400).json({ error: "Invalid role for this participant population.", code: "INVALID_ROLE" });
    }
    const created = await createOrganizationalPilotInvitation({
      businessId: resolved.business.id,
      pilotId: req.params.pilotId,
      invitedByUserId: userId,
      email: req.body?.email,
      populationType,
      participantRole,
      assignedProfessionalUserId: req.body?.assignedProfessionalUserId ?? null,
      participantName: req.body?.participantName ?? null,
    });
    const inviteLink = `${getAppUrl()}${created.inviteLink}`;
    if (req.body?.sendEmail !== false) {
      await sendBusinessInviteEmail({
        to: created.invite.email,
        businessName: resolved.business.name,
        inviterName: "Your organization",
        inviteLink,
        role: participantRole,
        expiresAt: created.invite.expiresAt,
        invitationType: created.invite.invitationType,
        trialDays: null,
        programName: created.pilot.name,
      });
    }
    return res.status(201).json({
      success: true,
      invitationId: created.invite.id,
      participantId: created.participant.id,
      populationType,
      participantRole,
      expiresAt: created.invite.expiresAt,
    });
  } catch (error) {
    try { return handlePilotInvitationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-invite/create] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.delete("/pilot-invitations/:inviteId", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const [invite] = await db.select().from(businessInvitations).where(and(
      eq(businessInvitations.id, req.params.inviteId),
      eq(businessInvitations.businessId, resolved.business.id),
    )).limit(1);
    if (!invite?.organizationalPilotId) return res.status(404).json({ error: "Pilot invitation not found." });
    const cancelled = await cancelOrganizationalPilotInvitation(invite.id, userId);
    return cancelled
      ? res.json({ success: true })
      : res.status(409).json({ error: "Invitation is no longer pending." });
  } catch (error) {
    console.error("[business/pilot-invite/cancel] error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/pilot-invitations/:inviteId/resend", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const resent = await resendOrganizationalPilotInvitation({
      inviteId: req.params.inviteId,
      businessId: resolved.business.id,
      actorUserId: userId,
    });
    const inviteLink = `${getAppUrl()}${resent.invitePath}`;
    await sendBusinessInviteEmail({
      to: resent.invite.email,
      businessName: resolved.business.name,
      inviterName: "Your organization",
      inviteLink,
      role: resent.invite.participantRole ?? resent.invite.role,
      expiresAt: resent.expiresAt,
      invitationType: resent.invite.invitationType,
      trialDays: null,
      programName: resent.invite.programName ?? undefined,
    });
    return res.json({ success: true, expiresAt: resent.expiresAt });
  } catch (error) {
    try { return handlePilotInvitationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-invite/resend] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tier requirement: ALL revenue-generating endpoints in this router require Pro
// or higher via requireProAccess. Free and Essential users are blocked at the
// API level when BILLING_ENFORCED=true. The only exception is
// POST /removal-notice/dismiss — that is a passive member UI action (dismissing
// a banner after being removed) that carries no revenue participation risk.
// ─────────────────────────────────────────────────────────────────────────────

const getAppUrl = () =>
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ||
  "http://localhost:5000";

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * clearRemovalNotice — stamp noticeDismissedAt on every undismissed "removed"
 * businessMembers row for this user+business pair.
 *
 * Call this inside any transaction that reactivates a removed member so the
 * stale removal-notice banner is never shown to an active member, regardless
 * of which code path triggered the reactivation (invite-accept, admin restore,
 * future API endpoints, etc.).
 *
 * The WHERE clause intentionally targets status="removed" rows only — the
 * reactivating row has already been flipped to "active" by the time this
 * runs, so this call covers historical rows from prior removal cycles.
 */
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function clearRemovalNotice(
  tx: DbOrTx,
  userId: string,
  businessId: string,
): Promise<void> {
  await tx
    .update(businessMembers)
    .set({ noticeDismissedAt: new Date() })
    .where(
      and(
        eq(businessMembers.userId, userId),
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.status, "removed"),
        isNull(businessMembers.noticeDismissedAt),
      ),
    );
}

async function getActiveSeats(businessId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.status, "active")));
  return result[0]?.count ?? 0;
}

/**
 * resolveAuthorizedBusiness — resolves the organization the caller is authorized
 * to manage and returns their role within it.
 *
 * "admin_or_owner" — both Organization Owners and Organization Admins may act.
 * "owner_only"     — restricted to the account that owns the Stripe subscription
 *                    (seat purchasing, billing changes, ownership transfer).
 *
 * Returns null when the caller holds no qualifying role in any organization.
 */
type CallerRole = "owner" | "admin";
type Capability = "admin_or_owner" | "owner_only";

async function resolveAuthorizedBusiness(
  userId: string,
  capability: Capability,
): Promise<{ business: typeof businesses.$inferSelect; callerRole: CallerRole } | null> {
  // Owner path — fastest lookup, most common case
  const [ownerBiz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerUserId, userId))
    .limit(1);
  if (ownerBiz) return { business: ownerBiz, callerRole: "owner" };

  // Owner-only actions stop here
  if (capability === "owner_only") return null;

  // Admin-membership path — resolve via businessMembers role
  const [adminMembership] = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.userId, userId),
        eq(businessMembers.role, "admin"),
        eq(businessMembers.status, "active"),
      ),
    )
    .limit(1);

  if (!adminMembership) return null;

  const [adminBiz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, adminMembership.businessId))
    .limit(1);

  if (!adminBiz) return null;
  return { business: adminBiz, callerRole: "admin" };
}

// ── GET /api/business/mine — owner OR admin fetches the organization dashboard data
router.get("/mine", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(404).json({ error: "No business account found." });
    }
    const { business, callerRole } = resolved;

    // Fetch the owner's acquisition source
    const [ownerRow] = await db
      .select({ signupSource: users.signupSource })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const signupSource = ownerRow?.signupSource ?? null;

    const rawMembers = await db
      .select({
        id: businessMembers.id,
        userId: businessMembers.userId,
        role: businessMembers.role,
        status: businessMembers.status,
        joinedAt: businessMembers.joinedAt,
        name: users.username,
        email: users.email,
        planLookupKey: users.planLookupKey,
      })
      .from(businessMembers)
      .leftJoin(users, eq(users.id, businessMembers.userId))
      .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.status, "active")));

    // planLost: true when the member has no paid plan (null planLookupKey) and is not the owner
    // (the owner's subscription is irrelevant — their seat is reserved for business management)
    const members = rawMembers.map(({ planLookupKey, ...m }) => ({
      ...m,
      planLost: m.role !== "owner" && planLookupKey === null,
    }));

    const now = new Date();
    // Only team_member pending invitations count against seat reservations
    const pendingInvitations = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.status, "pending"),
          gt(businessInvitations.expiresAt, now),
          eq(businessInvitations.invitationType, "team_member"),
        ),
      );

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

    // Client invitations — all statuses, newest first, for the dashboard section
    const clientInvitations = await db
      .select({
        id: businessInvitations.id,
        email: businessInvitations.email,
        token: businessInvitations.token,
        programName: businessInvitations.programName,
        trialDays: businessInvitations.trialDays,
        status: businessInvitations.status,
        createdAt: businessInvitations.createdAt,
        expiresAt: businessInvitations.expiresAt,
        acceptedAt: businessInvitations.acceptedAt,
        inviterName: users.username,
      })
      .from(businessInvitations)
      .leftJoin(users, eq(users.id, businessInvitations.invitedByUserId))
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.invitationType, "client"),
        ),
      )
      .orderBy(sql`${businessInvitations.createdAt} DESC`)
      .limit(200);

    const usedSeats = members.length;
    const planLostCount = members.filter((m) => m.planLost).length;

    return res.json({
      business,
      members,
      invitations,
      clientInvitations,
      usedSeats,
      availableSeats: business.seatLimit - usedSeats,
      planLostCount,
      callerRole,
      signupSource,
    });
  } catch (err) {
    console.error("[business/mine] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/business/membership — member (non-owner) checks if they're in a business
router.get("/membership", requireAuth, requireProAccess, async (req, res) => {
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

// ── POST /api/business/invite — owner sends a team member or client invitation
router.post("/invite", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const {
    email,
    role = "staff",
    invitationType = "team_member",
    trialDays,
    programName,
    partnerRecordId,
    sendEmail: shouldSendEmail = true,
  } = req.body as {
    email: string;
    role?: string;
    invitationType?: "team_member" | "client";
    trialDays?: number;
    programName?: string;
    partnerRecordId?: string;
    sendEmail?: boolean;
  };

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required." });
  }

  const isClient = invitationType === "client";

  if (!isClient) {
    const validRoles = ["admin", "coach", "trainer", "physician", "staff"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
  }

  if (isClient) {
    const days = Number(trialDays);
    if (!days || days < 1 || days > 365) {
      return res.status(400).json({ error: "Trial length must be between 1 and 365 days." });
    }
  }

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business } = resolved;
    const invitationIdentity = await resolveEmailIdentityForEmail(email);
    if (invitationIdentity.candidates.length > 1) {
      return res.status(409).json({
        error: "This email address belongs to multiple legacy accounts. Ask an administrator to resolve the account identity before sending an invitation.",
        code: "EMAIL_IDENTITY_REVIEW_REQUIRED",
      });
    }

    if (business.status !== "active") {
      return res.status(403).json({ error: "Business subscription is not active." });
    }

    const now = new Date();

    // Seat check — only for team member invitations (clients don't consume seats)
    if (!isClient) {
      const usedSeats = await getActiveSeats(business.id);
      const [pendingInvCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(businessInvitations)
        .where(
          and(
            eq(businessInvitations.businessId, business.id),
            eq(businessInvitations.status, "pending"),
            gt(businessInvitations.expiresAt, now),
            eq(businessInvitations.invitationType, "team_member"),
          ),
        );
      const occupiedSeats = usedSeats + (pendingInvCount?.count ?? 0);
      if (occupiedSeats >= business.seatLimit) {
        return res.status(400).json({
          error: `No seats available. Your plan includes ${business.seatLimit} seats and all are filled or reserved by pending invitations.`,
          code: "SEATS_FULL",
        });
      }
    }

    // Block duplicate pending invites for same type+email combo
    const [existingInvite] = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.email, email.toLowerCase()),
          eq(businessInvitations.status, "pending"),
          gt(businessInvitations.expiresAt, now),
          eq(businessInvitations.invitationType, invitationType as any),
        ),
      )
      .limit(1);

    if (existingInvite) {
      return res.status(400).json({ error: "A pending invitation already exists for this email." });
    }

    // Expire stale pending invites for this email+type
    await db
      .update(businessInvitations)
      .set({ status: "expired" })
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.email, email.toLowerCase()),
          eq(businessInvitations.status, "pending"),
          eq(businessInvitations.invitationType, invitationType as any),
          sql`${businessInvitations.expiresAt} <= ${now}`,
        ),
      );

    // For team members only: block if already an active member
    if (!isClient) {
      const existingUser = invitationIdentity.status === "unique"
        ? invitationIdentity.user
        : null;

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
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const resolvedTrialDays = isClient ? (Number(trialDays) || 30) : null;

    await db.insert(businessInvitations).values({
      businessId: business.id,
      email: email.toLowerCase(),
      token,
      role: isClient ? "staff" : (role as any),
      status: "pending",
      invitedByUserId: userId,
      expiresAt,
      invitationType: invitationType as any,
      trialDays: resolvedTrialDays,
      programName: isClient ? (programName?.trim() || null) : null,
      partnerRecordId: partnerRecordId ?? null,
    });

    // Stamp policy snapshot for team member invites
    if (!isClient) {
      await db.execute(
        sql`UPDATE business_invitations SET policy_snapshot = ${business.independentClientPolicy} WHERE token = ${token}`
      );
    }

    const [owner] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Team-member invites carry the token through the signup URL so the auth
    // page knows immediately to treat this signup as a business professional
    // and skip consumer nutrition onboarding.  Client invites keep the
    // dedicated join page since they go through a different acceptance flow.
    const inviteLink = isClient
      ? `${getAppUrl()}/business/join/${token}`
      : `${getAppUrl()}/auth?mode=signup&invite=${token}`;

    if (shouldSendEmail) {
      await sendBusinessInviteEmail({
        to: email.toLowerCase(),
        businessName: business.name,
        inviterName: owner?.username || "Your organization",
        inviteLink,
        role,
        expiresAt,
        invitationType: invitationType as any,
        trialDays: resolvedTrialDays,
        programName: isClient ? (programName?.trim() || null) : undefined,
      });
    }

    console.log(`✅ [business] Invite sent | business=${business.id} | to=${email} | type=${invitationType}`);
    return res.json({ success: true, inviteLink, message: `Invitation created for ${email}.` });
  } catch (err) {
    console.error("[business/invite] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── PATCH /api/business/members/:memberId/restore — owner manually reactivates a removed member
//
// This is the "direct API call" reactivation path the task description calls out.
// It mirrors the same notice-clearing contract as the invite-accept path:
//   1. Flip the row back to active (with a fresh joinedAt).
//   2. Call clearRemovalNotice() so any undismissed removal-notice rows — including
//      historical rows from prior removal cycles — are stamped immediately.
// Both steps run inside one transaction so they can never diverge.
router.patch("/members/:memberId/restore", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { memberId } = req.params;

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business } = resolved;

    const [member] = await db
      .select()
      .from(businessMembers)
      .where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, business.id)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    if (member.status !== "removed") {
      return res.status(400).json({ error: "Member is not in a removed state." });
    }

    // Seat check — restoring a removed member consumes a seat.
    const usedSeats = await getActiveSeats(business.id);
    if (usedSeats >= business.seatLimit) {
      return res.status(400).json({
        error: "All seats are currently in use. Free a seat before restoring this member.",
        code: "SEATS_FULL",
      });
    }

    await db.transaction(async (tx) => {
      // Reactivate the row.
      await tx
        .update(businessMembers)
        .set({ status: "active", joinedAt: new Date(), noticeDismissedAt: new Date() })
        .where(eq(businessMembers.id, memberId));

      // Clear any other undismissed removal-notice rows for this user in this business
      // (covers historical rows from prior removal cycles).
      await clearRemovalNotice(tx, member.userId, business.id);
    });

    console.log(`✅ [business] Member restored | business=${business.id} | member=${memberId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[business/members/restore] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── DELETE /api/business/members/:memberId — owner removes a member
router.delete("/members/:memberId", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { memberId } = req.params;

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business, callerRole } = resolved;

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

    // Admins may not remove other admins (or themselves — their own role is also admin).
    // Only the organization owner can remove or demote an admin member.
    if (callerRole === "admin" && member.role === "admin") {
      return res.status(403).json({ error: "Only the organization owner can remove an admin member." });
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
router.delete("/invitations/:token", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business } = resolved;

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
router.post("/invitations/:token/resend", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business } = resolved;

    const [invite] = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.token, token),
          eq(businessInvitations.businessId, business.id),
          or(
            eq(businessInvitations.status, "pending"),
            eq(businessInvitations.status, "expired"),
          ),
        ),
      )
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }

    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const newToken = generateInviteToken();
    await db
      .update(businessInvitations)
      .set({ status: "pending", expiresAt: newExpiry, token: newToken })
      .where(eq(businessInvitations.id, invite.id));

    const [owner] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isClientResend = (invite.invitationType ?? "team_member") === "client";
    const inviteLink = isClientResend
      ? `${getAppUrl()}/business/join/${newToken}`
      : `${getAppUrl()}/auth?mode=signup&invite=${newToken}`;

    await sendBusinessInviteEmail({
      to: invite.email,
      businessName: business.name,
      inviterName: owner?.username || "Your team owner",
      inviteLink,
      role: invite.role,
      expiresAt: newExpiry,
      invitationType: (invite.invitationType ?? "team_member") as any,
      trialDays: invite.trialDays,
      programName: invite.programName,
    });

    return res.json({ success: true, message: "Invite resent.", newToken });
  } catch (err) {
    console.error("[business/invitations/resend] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── PATCH /api/business/policy — owner updates independent_client_policy
router.patch("/policy", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { policy } = req.body as { policy: string };

  const validPolicies = ["org_only", "allowed_with_disclosure", "allowed"];
  if (!policy || !validPolicies.includes(policy)) {
    return res.status(400).json({ error: "Invalid policy value. Must be one of: org_only, allowed_with_disclosure, allowed." });
  }

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business } = resolved;

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
router.patch("/org-policies", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { requireAcademy, requireProfessionalVerification } = req.body as {
    requireAcademy?: boolean;
    requireProfessionalVerification?: boolean;
  };

  if (typeof requireAcademy !== "boolean" && typeof requireProfessionalVerification !== "boolean") {
    return res.status(400).json({ error: "At least one policy flag must be provided." });
  }

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const business = { id: resolved.business.id, organizationId: resolved.business.organizationId };
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
    const pilotInvite = await findOrganizationalPilotInvitation(token);
    if (pilotInvite) {
      if (pilotInvite.status !== "pending") {
        return res.status(pilotInvite.status === "accepted" ? 200 : 410).json({
          alreadyAccepted: pilotInvite.status === "accepted",
          status: pilotInvite.status,
          invitationType: pilotInvite.invitationType,
          populationType: pilotInvite.populationType,
          participantRole: pilotInvite.participantRole,
          email: pilotInvite.email,
          expiresAt: pilotInvite.expiresAt,
          programName: pilotInvite.programName,
        });
      }
      if (new Date() > pilotInvite.expiresAt) {
        await expireOrganizationalPilotInvitation(pilotInvite.id);
        return res.status(410).json({ error: "This invitation has expired.", status: "expired" });
      }
      const [pilotBusiness] = await db.select({ name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, pilotInvite.businessId))
        .limit(1);
      return res.json({
        email: pilotInvite.email,
        role: pilotInvite.participantRole,
        businessName: pilotBusiness?.name ?? pilotInvite.programName,
        expiresAt: pilotInvite.expiresAt,
        invitationType: pilotInvite.invitationType,
        populationType: pilotInvite.populationType,
        participantRole: pilotInvite.participantRole,
        programName: pilotInvite.programName,
        organizationalPilot: true,
      });
    }

    const [invite] = await db
      .select({
        id: businessInvitations.id,
        email: businessInvitations.email,
        role: businessInvitations.role,
        status: businessInvitations.status,
        expiresAt: businessInvitations.expiresAt,
        invitationType: businessInvitations.invitationType,
        trialDays: businessInvitations.trialDays,
        programName: businessInvitations.programName,
        inviterName: users.username,
        businessName: businesses.name,
        independentClientPolicy: businesses.independentClientPolicy,
      })
      .from(businessInvitations)
      .innerJoin(businesses, eq(businesses.id, businessInvitations.businessId))
      .leftJoin(users, eq(users.id, businessInvitations.invitedByUserId))
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
      invitationType: invite.invitationType ?? "team_member",
      trialDays: invite.trialDays,
      programName: invite.programName,
      inviterName: invite.inviterName,
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
    const pilotInvite = await findOrganizationalPilotInvitation(token);
    if (pilotInvite) {
      try {
        const accepted = await acceptOrganizationalPilotInvitation(token, userId);
        if (!accepted) return res.status(404).json({ error: "Invitation not found." });
        const [pilotBusiness] = await db.select({ name: businesses.name })
          .from(businesses).where(eq(businesses.id, pilotInvite.businessId)).limit(1);
        return res.json({
          success: true,
          alreadyAccepted: accepted.alreadyAccepted,
          businessName: pilotBusiness?.name ?? pilotInvite.programName,
          populationType: pilotInvite.populationType,
          participantRole: pilotInvite.participantRole,
          pilotEndAt: accepted.alreadyAccepted ? null : accepted.pilotEndAt,
        });
      } catch (error) {
        try { return handlePilotInvitationError(res, error); } catch (unexpected) { throw unexpected; }
      }
    }

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

    // ── Email-address enforcement ─────────────────────────────────────────────
    // The invitation is tied to a specific email. Verify the authenticated user's
    // email matches before doing anything else — prevents one person from redeeming
    // an invitation meant for another.
    const acceptingIdentity = await resolveEmailIdentityForUser(userId);
    if (acceptingIdentity.candidates.length > 1) {
      return res.status(409).json({
        error: "This email address is linked to multiple legacy accounts. An administrator must review the account before this invitation can be accepted.",
        code: "EMAIL_IDENTITY_REVIEW_REQUIRED",
      });
    }
    if (
      acceptingIdentity.status !== "unique" ||
      normalizeEmailIdentity(acceptingIdentity.user.email) !== normalizeEmailIdentity(invite.email)
    ) {
      return res.status(403).json({
        error: "This invitation was sent to a different email address. Please log in with the email that received the invitation.",
        code: "EMAIL_MISMATCH",
      });
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, invite.businessId))
      .limit(1);

    if (!business || business.status !== "active") {
      return res.status(403).json({ error: "This business account is no longer active." });
    }

    // ── Client invitation path — extend trial, no seat consumed ──────────────
    if (invite.invitationType === "client") {
      const trialDays = invite.trialDays ?? 30;

      // Guard: skip the trial_ends_at write for users who already have an active
      // paid subscription. Their access is governed by Stripe billing, not by
      // trial_ends_at. Writing a future trial_ends_at for them is a no-op now,
      // but when their paid plan eventually lapses (planLookupKey goes null),
      // the stale trial_ends_at timestamp could cause the trial banner to
      // reappear — which would be wrong and confusing.
      const [acceptingUser] = await db
        .select({ planLookupKey: users.planLookupKey })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const hasActivePaidPlan =
        acceptingUser?.planLookupKey != null && acceptingUser.planLookupKey !== "";

      if (!hasActivePaidPlan) {
        // Set trial to MAX(existing end, now + N days).
        // Using COALESCE so NULL trial_ends_at is treated as a past date, not a GREATEST-stopper.
        // This means a brand-new user (7-day default trial) gets exactly 30 days from acceptance,
        // not 7+30. A user already on a longer custom trial keeps their longer end date.
        // Reset trial_reminders_sent to '{}' when the invitation extends the trial
        // by more than 7 days. Without this, reminder milestones from a previous
        // short trial (e.g. "day_6") would block the cron from sending the same
        // milestone before the new, much-later expiry date.
        await db.execute(
          sql`UPDATE users
              SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, '1970-01-01'::timestamptz), NOW() + (${trialDays}::text || ' days')::interval),
                  trial_reminders_sent = CASE WHEN ${trialDays} > 7 THEN '{}'::text[] ELSE trial_reminders_sent END
              WHERE id = ${userId}`
        );
      } else {
        console.log(
          `ℹ️ [business] Client invite accepted by paid subscriber — trial_ends_at write skipped | user=${userId} | planLookupKey=${acceptingUser.planLookupKey}`
        );
      }

      await db
        .update(businessInvitations)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId })
        .where(eq(businessInvitations.id, invite.id));

      const programName = invite.programName || "My Perfect Meals Complimentary Access";
      console.log(`✅ [business] Client invite accepted | business=${business.id} | user=${userId} | days=${trialDays}`);
      return res.json({
        success: true,
        invitationType: "client",
        businessName: business.name,
        programName,
        trialDays,
      });
    }

    // ── Existing membership check (any status) ────────────────────────────────
    // Must run BEFORE the seat-count check so we emit the correct error and
    // never create a duplicate row.  A removed member re-accepting a new invite
    // re-activates their existing row instead of inserting a second one.
    const [existing] = await db
      .select()
      .from(businessMembers)
      .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.userId, userId)))
      .limit(1);

    if (existing && existing.status === "active") {
      // User is already an active member (covers downgraded-but-not-removed members
      // who somehow receive a second invite link — reject cleanly without touching seats).
      return res.status(400).json({ error: "You are already a member of this business." });
    }

    // ── Cross-business duplicate check ────────────────────────────────────────
    // A user may not hold active seats in two businesses simultaneously.
    // Check for any active businessMembers row in a *different* business before
    // activating this membership so seat accounting stays consistent platform-wide.
    const [activeElsewhere] = await db
      .select({ businessId: businessMembers.businessId })
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          ne(businessMembers.businessId, business.id),
        ),
      )
      .limit(1);

    if (activeElsewhere) {
      return res.status(400).json({
        error: "You are already an active member of another business. Leave that business before joining a new one.",
        code: "ALREADY_IN_ANOTHER_BUSINESS",
      });
    }

    // ── Seat availability check ────────────────────────────────────────────────
    // Only needed for brand-new members or removed members re-joining.
    // (Active members are already counted and were rejected above.)
    const usedSeats = await getActiveSeats(business.id);
    if (usedSeats >= business.seatLimit) {
      return res.status(400).json({
        error: "All seats are currently in use. Please contact the business owner.",
        code: "SEATS_FULL",
      });
    }

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

    // Atomically update member row + mark invite accepted so they can never diverge.
    // The partial unique index idx_business_members_one_active_per_user enforces
    // one active seat per user across all businesses at the DB level.  Any concurrent
    // request that races past the application-level pre-check will be rejected here
    // with a 23505 unique-violation, which we map to ALREADY_IN_ANOTHER_BUSINESS.
    try {
      await db.transaction(async (tx) => {
        if (existing) {
          // Re-activate a previously-removed member row — never insert a duplicate.
          // Also set noticeDismissedAt so the stale removal-notice banner is cleared
          // immediately on re-join and never shown to an active member.
          await tx
            .update(businessMembers)
            .set({ status: "active", joinedAt: new Date(), noticeDismissedAt: new Date() })
            .where(eq(businessMembers.id, existing.id));

          // Belt-and-suspenders: dismiss any other undismissed removal-notice rows
          // for this user in this business (historical rows from prior removals).
          // Using the shared clearRemovalNotice helper so any future reactivation
          // path (admin restore, direct API, etc.) gets the same guarantee by
          // calling one function rather than duplicating the WHERE clause.
          await clearRemovalNotice(tx, userId, business.id);
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
    } catch (txErr: any) {
      // PostgreSQL unique-violation code: 23505.
      // The partial index name contains "one_active_per_user" — match on both
      // to avoid swallowing unrelated unique violations (e.g. business_id+user_id).
      const constraintName: string = txErr.constraint_name ?? txErr.constraint ?? "";
      if (txErr.code === "23505" && constraintName.includes("one_active_per_user")) {
        return res.status(400).json({
          error: "You are already an active member of another business. Leave that business before joining a new one.",
          code: "ALREADY_IN_ANOTHER_BUSINESS",
        });
      }
      throw txErr; // re-throw so the outer catch returns 500
    }

    // NOTE: Do NOT call updateUserSubscription here. The user's planLookupKey
    // stays as their personal plan. Access tier is computed at runtime by
    // effectiveAccess.ts which checks for an active businessMembers row.

    // Mark invited team members as professional/business users so they bypass consumer
    // nutrition onboarding and land directly in the correct professional experience.
    // Conditional update — never overwrites an existing professionalRole value.
    await db.execute(
      sql`UPDATE users SET professional_role = 'business' WHERE id = ${userId} AND (professional_role IS NULL OR professional_role = '')`
    );

    console.log(`✅ [business] Invite accepted | business=${business.id} | user=${userId} | role=${invite.role}`);
    return res.json({ success: true, businessName: business.name, role: invite.role });
  } catch (err) {
    console.error("[business/invite/accept] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── PATCH /api/business/name — owner renames the business
router.patch("/name", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { name } = req.body as { name: string };

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Business name must be at least 2 characters." });
  }

  try {
    const resolved = await resolveAuthorizedBusiness(userId, "admin_or_owner");

    if (!resolved) return res.status(403).json({ error: "No business account found." });

    await db
      .update(businesses)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(businesses.id, resolved.business.id));

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
    const seatsResolved = await resolveAuthorizedBusiness(userId, "owner_only");
    if (!seatsResolved) return res.status(404).json({ error: "No business found for this account." });
    const biz = seatsResolved.business;
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

// ── GET /api/business/check-status — lightweight status check for login routing.
// requireAuth only (no requireProAccess) — called before payment is confirmed.
// Returns { exists, status, name } so Auth.tsx can decide where to send the owner.
router.get("/check-status", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    // Check owner path first
    const [business] = await db
      .select({ id: businesses.id, status: businesses.status, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);

    if (business) {
      return res.json({ exists: true, status: business.status, name: business.name, callerRole: "owner" });
    }

    // Check active admin membership so org admins are routed to the dashboard on login
    const [adminMembership] = await db
      .select({ businessId: businessMembers.businessId })
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.role, "admin"),
          eq(businessMembers.status, "active"),
        ),
      )
      .limit(1);

    if (adminMembership) {
      const [adminBiz] = await db
        .select({ id: businesses.id, status: businesses.status, name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, adminMembership.businessId))
        .limit(1);
      if (adminBiz) {
        return res.json({ exists: true, status: adminBiz.status, name: adminBiz.name, callerRole: "admin" });
      }
    }

    return res.json({ exists: false, status: null, name: null });
  } catch (err) {
    console.error("[business/check-status] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/create-org — Self-service org creation for new business accounts.
// Creates a businesses + owner businessMembers row with status=pending_billing.
// The Stripe webhook flips status to active and sets seatLimit after payment succeeds.
// This endpoint intentionally does NOT require requireProAccess — it is the entry point
// before the user has paid. requireAuth only.
router.post("/create-org", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const orgName = ((req.body as any).name || "").trim();
  if (!orgName || orgName.length < 2) {
    return res.status(400).json({ error: "Organization name must be at least 2 characters." });
  }
  if (orgName.length > 80) {
    return res.status(400).json({ error: "Organization name must be 80 characters or fewer." });
  }
  try {
    // Idempotent: return existing record if user is already an owner
    const [existing] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, userId))
      .limit(1);
    if (existing) {
      // Update name if they're changing it
      if (existing.name !== orgName) {
        await db.update(businesses).set({ name: orgName, updatedAt: new Date() }).where(eq(businesses.id, existing.id));
      }
      // Repair: ensure owner membership exists (may be absent if a previous attempt failed mid-write)
      const [ownerMember] = await db
        .select({ id: businessMembers.id })
        .from(businessMembers)
        .where(and(eq(businessMembers.businessId, existing.id), eq(businessMembers.userId, userId)))
        .limit(1);
      if (!ownerMember) {
        await db.insert(businessMembers).values({ businessId: existing.id, userId, role: "owner", status: "active" });
        console.warn(`[business/create-org] repaired missing owner membership | biz=${existing.id} | owner=${userId}`);
      }
      // Repair: ensure professionalRole is set
      await db.update(users).set({ professionalRole: "business" } as any).where(eq(users.id as any, userId));
      return res.json({ businessId: existing.id, created: false });
    }

    // Wrap all three writes in a transaction so partial failures can be retried cleanly.
    // ownerUserId has a UNIQUE constraint — concurrent requests will hit a conflict error;
    // we catch it and re-read the record that the concurrent write produced.
    let newBiz: typeof businesses.$inferSelect;
    try {
      newBiz = await db.transaction(async (tx) => {
        const [biz] = await tx.insert(businesses).values({
          name: orgName,
          ownerUserId: userId,
          plan: "clinical_business_monthly",
          seatLimit: 1, // will be updated by webhook to the purchased seat count
          status: "pending_billing",
        }).returning();

        // Add owner as seat 1 immediately
        await tx.insert(businessMembers).values({
          businessId: biz.id,
          userId,
          role: "owner",
          status: "active",
        });

        // Ensure professionalRole is "business" on the user record
        await tx.update(users).set({ professionalRole: "business" } as any).where(eq(users.id as any, userId));

        return biz;
      });
    } catch (conflictErr: any) {
      // Unique constraint on ownerUserId means a concurrent request already created the org.
      // Re-read and return it rather than surfacing a 500.
      const isUniqueViolation =
        conflictErr?.code === "23505" || // PostgreSQL unique violation
        String(conflictErr?.message).includes("unique");
      if (isUniqueViolation) {
        const [race] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
        if (race) {
          console.warn(`[business/create-org] race resolved | biz=${race.id} | owner=${userId}`);
          return res.json({ businessId: race.id, created: false });
        }
      }
      throw conflictErr;
    }

    console.log(`✅ [business/create-org] org created | id=${newBiz!.id} | owner=${userId} | name="${orgName}"`);
    return res.json({ businessId: newBiz!.id, created: true });
  } catch (err: any) {
    console.error("[business/create-org] error:", err);
    return res.status(500).json({ error: err?.message || "Could not create organization." });
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
router.get("/policy-history", requireAuth, async (req, res) => {
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
router.get("/members/:memberId/clients", requireAuth, async (req, res) => {
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
