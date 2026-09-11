import { Router } from "express";
import { randomBytes, randomUUID } from "crypto";
import Stripe from "stripe";
import { db } from "../db";
import { eq, and, ne, sql, isNull, gt, or, inArray } from "drizzle-orm";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";
import { users } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireProOrOrgAdmin } from "../middleware/requireProOrOrgAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
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
import {
  claimPilotAuthorization,
  createApprovedPilotAuthorization,
  getClaimedChampionSetup,
  getOrganizationWorkspaceOptions,
  inspectPilotAuthorizationToken,
  PilotAuthorizationError,
  updateClaimedChampionSetup,
} from "../services/organizationalPilotAuthorizationService";
import organizationWorkspaceRouter from "./organizationWorkspaceRoutes";
import {
  ensureCanonicalWorkspaceForBusiness,
  resolveActiveWorkspace,
  WorkspaceContextError,
} from "../services/organizationWorkspaceService";
import {
  locationMemberships,
  organizationMemberships,
} from "../db/schema/workspaces";
import { organizationalPilotParticipants, organizationalPilots } from "../db/schema/pilotProgram";
import {
  MAX_ORGANIZATION_INVITATION_BATCH,
  reviewOrganizationInvitationRecipients,
} from "../services/organizationInvitationBatchService";
import { activateProCareClient, ActivationError } from "../services/procareActivation";
import { assertStripeBillingOwnership } from "../services/stripeRuntimePolicy";
import { loadOrgContext } from "../lib/orgContext";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" as any })
  : null;

const router = Router();

router.use("/workspace", organizationWorkspaceRouter);
const CLIENT_TRIAL_DURATIONS = [7, 14, 30] as const;
const ORGANIZATION_INVITE_SEND_WINDOW_MS = 60 * 1000;
const ORGANIZATION_INVITE_SEND_LIMIT = 20;
const ORGANIZATION_RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const INVITATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATIENT_ENROLLMENT_APP_URL = "https://app.myperfectmeals.ai";

function isFlatOrganization(business: Pick<typeof businesses.$inferSelect, "plan">): boolean {
  return business.plan === "clinical_business_monthly";
}

function isAllowedClientTrialDuration(value: number): boolean {
  return CLIENT_TRIAL_DURATIONS.includes(value as (typeof CLIENT_TRIAL_DURATIONS)[number]);
}

function handlePilotInvitationError(res: any, error: unknown) {
  if (error instanceof PilotInvitationError) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code });
  }
  throw error;
}

function handlePilotAuthorizationError(res: any, error: unknown) {
  if (error instanceof PilotAuthorizationError) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code });
  }
  throw error;
}

router.post("/pilot-authorizations", requireAuth, requireAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const created = await createApprovedPilotAuthorization({
      organizationName: req.body?.organizationName ?? "",
      championEmail: req.body?.championEmail ?? "",
      professionalCapacity: Number(req.body?.professionalCapacity),
      clientCapacity: Number(req.body?.clientCapacity),
      durationDays: Number(req.body?.durationDays ?? 30),
      approvedByUserId: userId,
    });
    const claimLink = `${getAppUrl()}/auth?pilotAuthorization=${created.rawToken}`;
    const emailSent = req.body?.sendEmail === false
      ? false
      : await sendBusinessInviteEmail({
          to: created.authorization.championEmail,
          businessName: created.authorization.organizationName,
          inviterName: "My Perfect Meals",
          inviteLink: claimLink,
          role: "Pilot Champion",
          expiresAt: created.authorization.claimTokenExpiresAt!,
          invitationType: "team_member",
          trialDays: null,
          programName: `${created.authorization.durationDays}-Day Organizational Pilot`,
        });
    return res.status(201).json({
      authorizationId: created.authorization.id,
      organizationName: created.authorization.organizationName,
      status: created.authorization.status,
      expiresAt: created.authorization.claimTokenExpiresAt,
      emailSent,
      ...(process.env.NODE_ENV !== "production" && req.body?.sendEmail === false ? { claimLink } : {}),
    });
  } catch (error) {
    try { return handlePilotAuthorizationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-authorization/create] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.get("/pilot-authorizations/claim/:token", async (req, res) => {
  try {
    const authorization = await inspectPilotAuthorizationToken(req.params.token);
    if (!authorization) return res.status(404).json({ error: "Authorization not found." });
    if (authorization.status !== "approved" && authorization.status !== "claimed") {
      return res.status(410).json({ error: "Authorization is no longer available.", status: authorization.status });
    }
    if (authorization.claimTokenExpiresAt && authorization.claimTokenExpiresAt <= new Date()) {
      return res.status(410).json({ error: "Authorization has expired.", status: "expired" });
    }
    return res.json({
      organizationName: authorization.organizationName,
      championEmail: authorization.championEmail,
      status: authorization.status,
      professionalCapacity: authorization.professionalCapacity,
      clientCapacity: authorization.clientCapacity,
      durationDays: authorization.durationDays,
      expiresAt: authorization.claimTokenExpiresAt,
    });
  } catch (error) {
    console.error("[business/pilot-authorization/inspect] error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/pilot-authorizations/claim", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const claimed = await claimPilotAuthorization({
      userId,
      rawToken: typeof req.body?.token === "string" ? req.body.token : undefined,
      authorizationId: typeof req.body?.authorizationId === "string" ? req.body.authorizationId : undefined,
    });
    return res.json({
      success: true,
      alreadyClaimed: claimed.alreadyClaimed,
      businessId: claimed.business?.id ?? null,
      organizationName: claimed.business?.name ?? claimed.authorization.organizationName,
      pilotId: claimed.pilot?.id ?? null,
      pilotStatus: claimed.pilot?.status ?? "preparing",
      setupPath: "/business/setup?pilot=1",
    });
  } catch (error) {
    try { return handlePilotAuthorizationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-authorization/claim] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.get("/workspaces", requireAuth, async (req, res) => {
  try {
    const workspaces = await getOrganizationWorkspaceOptions((req as any).authUser?.id as string);
    return res.json({ workspaces });
  } catch (error) {
    console.error("[business/workspaces] error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.get("/pilot-setup", requireAuth, async (req, res) => {
  try {
    return res.json(await getClaimedChampionSetup((req as any).authUser?.id as string));
  } catch (error) {
    try { return handlePilotAuthorizationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-setup/get] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.patch("/pilot-setup", requireAuth, async (req, res) => {
  try {
    const setup = await updateClaimedChampionSetup(
      (req as any).authUser?.id as string,
      typeof req.body?.name === "string" ? req.body.name : "",
    );
    return res.json({ success: true, setup });
  } catch (error) {
    try { return handlePilotAuthorizationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-setup/update] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.post("/pilots/:pilotId/invitations", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const populationType = req.body?.populationType;
    const participantRole = req.body?.participantRole as PilotInvitationRole;
    if (populationType !== "professional" && populationType !== "client") {
      return res.status(400).json({ error: "populationType must be professional or client.", code: "INVALID_POPULATION" });
    }
    const allowedRoles = populationType === "professional"
      ? ["nurse", "provider", "coach", "staff"]
      : ["client"];
    if (participantRole === "champion") {
      return res.status(403).json({
        error: "Pilot Champion access requires an exact-user organizational authorization.",
        code: "CHAMPION_AUTHORIZATION_REQUIRED",
      });
    }
    if (!allowedRoles.includes(participantRole)) {
      return res.status(400).json({ error: "Invalid role for this participant population.", code: "INVALID_ROLE" });
    }
    const trialDays = Number(req.body?.trialDays);
    if (!isAllowedClientTrialDuration(trialDays)) {
      return res.status(400).json({ error: "Complimentary access must be 7, 14, or 30 days.", code: "INVALID_ACCESS_DURATION" });
    }
    const created = await createOrganizationalPilotInvitation({
      businessId: resolved.business.id,
      locationId: resolved.locationId,
      pilotId: req.params.pilotId,
      invitedByUserId: userId,
      email: req.body?.email,
      populationType,
      participantRole,
      assignedProfessionalUserId: req.body?.assignedProfessionalUserId ?? null,
      participantName: req.body?.participantName ?? null,
      trialDays,
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
        trialDays,
        programName: created.pilot.name,
        recipientName: req.body?.participantName ?? undefined,
      });
    }
    return res.status(201).json({
      success: true,
      invitationId: created.invite.id,
      participantId: created.participant.id,
      populationType,
      participantRole,
      trialDays,
      expiresAt: created.invite.expiresAt,
      ...(req.body?.sendEmail === false ? { inviteLink } : {}),
    });
  } catch (error) {
    try { return handlePilotInvitationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-invite/create] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

async function buildPilotInvitationBatchReview(req: any) {
  const resolved = await resolveDashboardBusiness(req, "admin_or_owner");
  const populationType = req.body?.populationType;
  if (populationType !== "professional" && populationType !== "client") {
    throw new PilotInvitationError(
      "populationType must be professional or client.",
      "INVALID_POPULATION",
    );
  }
  const participantRole = req.body?.participantRole as PilotInvitationRole;
  const allowedRoles = populationType === "professional"
    ? ["nurse", "provider", "coach", "staff"]
    : ["client"];
  if (!allowedRoles.includes(participantRole)) {
    throw new PilotInvitationError(
      "Invalid role for this participant population.",
      "INVALID_ROLE",
    );
  }
  const trialDays = Number(req.body?.trialDays);
  if (!isAllowedClientTrialDuration(trialDays)) {
    throw new PilotInvitationError(
      "Complimentary access must be 7, 14, or 30 days.",
      "INVALID_ACCESS_DURATION",
    );
  }

  const [pilot] = await db.select().from(organizationalPilots).where(and(
    eq(organizationalPilots.id, req.params.pilotId),
    eq(organizationalPilots.businessId, resolved.business.id),
  )).limit(1);
  if (!pilot || !["preparing", "active"].includes(pilot.status)) {
    throw new PilotInvitationError(
      "Organizational pilot not found or unavailable.",
      "PILOT_NOT_AVAILABLE",
      404,
    );
  }

  let initial;
  try {
    initial = reviewOrganizationInvitationRecipients(req.body?.recipients);
  } catch (error) {
    throw new PilotInvitationError(
      error instanceof Error ? error.message : "Invalid recipients.",
      "INVALID_RECIPIENTS",
    );
  }
  const candidateEmails = initial.valid.map((recipient) => recipient.email);
  const existingEmails = new Set<string>();
  const existingMemberEmails = new Set<string>();
  if (candidateEmails.length > 0) {
    const existingParticipants = await db.select({
      email: organizationalPilotParticipants.normalizedEmail,
    }).from(organizationalPilotParticipants).where(and(
      eq(organizationalPilotParticipants.pilotId, pilot.id),
      inArray(organizationalPilotParticipants.normalizedEmail, candidateEmails),
      inArray(organizationalPilotParticipants.status, ["pending", "active"]),
    ));
    existingParticipants.forEach((participant) => existingEmails.add(participant.email));
    if (populationType === "professional") {
      const activeMembers = await db.select({ email: users.email })
        .from(businessMembers)
        .innerJoin(users, eq(users.id, businessMembers.userId))
        .where(and(
          eq(businessMembers.businessId, resolved.business.id),
          eq(businessMembers.status, "active"),
        ));
      activeMembers.forEach((member) => {
        if (member.email && candidateEmails.includes(normalizeEmailIdentity(member.email))) {
          existingMemberEmails.add(member.email);
        }
      });
    }
  }
  const review = reviewOrganizationInvitationRecipients(
    req.body?.recipients,
    existingEmails,
    existingMemberEmails,
  );
  const [reserved] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(organizationalPilotParticipants).where(and(
    eq(organizationalPilotParticipants.pilotId, pilot.id),
    eq(organizationalPilotParticipants.populationType, populationType),
    inArray(organizationalPilotParticipants.status, ["pending", "active"]),
  ));
  const capacity = populationType === "professional"
    ? pilot.professionalCapacity
    : pilot.clientCapacity;
  const availableCapacity = Math.max(0, capacity - Number(reserved?.count ?? 0));

  return {
    resolved,
    pilot,
    populationType,
    participantRole,
    trialDays,
    review,
    capacity,
    availableCapacity,
    overCapacity: Math.max(0, review.valid.length - availableCapacity),
  };
}

router.post("/pilots/:pilotId/invitations/batch-review", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  try {
    const result = await buildPilotInvitationBatchReview(req);
    return res.json({
      ...result.review,
      capacity: result.capacity,
      availableCapacity: result.availableCapacity,
      overCapacity: result.overCapacity,
      maxBatchSize: MAX_ORGANIZATION_INVITATION_BATCH,
    });
  } catch (error) {
    try { return handlePilotInvitationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-invite/batch-review] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.post("/pilots/:pilotId/invitations/batch-send", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const result = await buildPilotInvitationBatchReview(req);
    if (
      result.review.invalid.length > 0
      || result.review.duplicates.length > 0
      || result.review.existingMembers.length > 0
    ) {
      return res.status(409).json({
        error: "Recipients changed or require review. Review the batch again before sending.",
        code: "BATCH_REVIEW_REQUIRED",
        ...result.review,
      });
    }
    if (result.overCapacity > 0) {
      return res.status(409).json({
        error: `This batch exceeds available ${result.populationType} capacity by ${result.overCapacity}.`,
        code: "BATCH_CAPACITY_EXCEEDED",
        availableCapacity: result.availableCapacity,
        requested: result.review.valid.length,
      });
    }

    const sent: Array<{ email: string; invitationId: string; emailQueued: boolean }> = [];
    const failed: Array<{ email: string; error: string; code?: string }> = [];
    for (const recipient of result.review.valid) {
      try {
        const created = await createOrganizationalPilotInvitation({
          businessId: result.resolved.business.id,
          locationId: result.resolved.locationId,
          pilotId: result.pilot.id,
          invitedByUserId: userId,
          email: recipient.email,
          populationType: result.populationType,
          participantRole: result.participantRole,
          participantName: recipient.displayName,
          assignedProfessionalUserId: req.body?.assignedProfessionalUserId ?? null,
          trialDays: result.trialDays,
        });
        const inviteLink = `${getAppUrl()}${created.inviteLink}`;
        const emailResult = await sendBusinessInviteEmail({
          to: recipient.email,
          businessName: result.resolved.business.name,
          inviterName: "Your organization",
          inviteLink,
          role: result.participantRole,
          expiresAt: created.invite.expiresAt,
          invitationType: created.invite.invitationType,
          trialDays: result.trialDays,
          programName: created.pilot.name,
          recipientName: recipient.displayName,
        });
        sent.push({
          email: recipient.email,
          invitationId: created.invite.id,
          emailQueued: Boolean(emailResult),
        });
      } catch (error) {
        failed.push({
          email: recipient.email,
          error: error instanceof Error ? error.message : "Could not create invitation.",
          ...(error instanceof PilotInvitationError ? { code: error.code } : {}),
        });
      }
    }
    return res.status(failed.length > 0 ? 207 : 201).json({
      success: failed.length === 0,
      sent,
      failed,
      counts: { requested: result.review.valid.length, sent: sent.length, failed: failed.length },
    });
  } catch (error) {
    try { return handlePilotInvitationError(res, error); } catch (unexpected) {
      console.error("[business/pilot-invite/batch-send] error:", unexpected);
      return res.status(500).json({ error: "Server error." });
    }
  }
});

router.delete("/pilot-invitations/:inviteId", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const [invite] = await db.select().from(businessInvitations).where(and(
      eq(businessInvitations.id, req.params.inviteId),
      eq(businessInvitations.businessId, resolved.business.id),
      eq(businessInvitations.locationId, resolved.locationId),
    )).limit(1);
    if (!invite?.organizationalPilotId) return res.status(404).json({ error: "Pilot invitation not found." });
    const cancelled = await cancelOrganizationalPilotInvitation(invite.id, userId);
    return cancelled
      ? res.json({ success: true })
      : res.status(409).json({ error: "Invitation is no longer pending." });
  } catch (error) {
    const workspaceError = sendDashboardWorkspaceError(res, error);
    if (workspaceError) return workspaceError;
    console.error("[business/pilot-invite/cancel] error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/pilot-invitations/:inviteId/resend", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");
    if (!resolved) return res.status(403).json({ error: "No business account found." });
    const [selectedInvite] = await db.select({ id: businessInvitations.id }).from(businessInvitations).where(and(
      eq(businessInvitations.id, req.params.inviteId),
      eq(businessInvitations.businessId, resolved.business.id),
      eq(businessInvitations.locationId, resolved.locationId),
    )).limit(1);
    if (!selectedInvite) return res.status(404).json({ error: "Pilot invitation not found." });
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
      trialDays: resent.invite.trialDays,
      programName: resent.invite.programName ?? undefined,
    });
    return res.json({ success: true, expiresAt: resent.expiresAt });
  } catch (error) {
    const workspaceError = sendDashboardWorkspaceError(res, error);
    if (workspaceError) return workspaceError;
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
 * Dashboard authorization capabilities.
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

async function resolveSelectedBusiness(req: any): Promise<{
  business: typeof businesses.$inferSelect;
  organizationId: string;
  locationId: string;
  locationName: string;
  organizationRole: string;
  locationRole: string;
}> {
  const userId = req.authUser?.id as string;
  const sessionSelection =
    typeof req.session?.activeOrganizationId === "string"
    && typeof req.session?.activeLocationId === "string"
      ? {
          organizationId: req.session.activeOrganizationId,
          locationId: req.session.activeLocationId,
        }
      : null;
  const context = await resolveActiveWorkspace(userId, sessionSelection);
  const matches = await db
    .select()
    .from(businesses)
    .where(eq(businesses.organizationId, context.organizationId));
  if (matches.length !== 1) {
    throw new WorkspaceContextError(
      "The selected Organization does not have one canonical Business account.",
      "INVALID_WORKSPACE_SELECTION",
      409,
    );
  }
  return {
    business: matches[0],
    organizationId: context.organizationId,
    locationId: context.locationId,
    locationName: context.locationName,
    organizationRole: context.organizationRole,
    locationRole: context.locationRole,
  };
}

async function resolveDashboardBusiness(
  req: any,
  capability: Capability,
) {
  const selected = await resolveSelectedBusiness(req);
  const callerRole: CallerRole =
    selected.organizationRole === "owner" ? "owner" : "admin";
  if (
    !["owner", "admin"].includes(selected.organizationRole)
    || (capability === "owner_only" && callerRole !== "owner")
  ) {
    throw new WorkspaceContextError(
      "This workspace role cannot manage the Organization Dashboard.",
      "INVALID_WORKSPACE_SELECTION",
      403,
    );
  }
  return { ...selected, callerRole };
}

function sendDashboardWorkspaceError(res: any, error: unknown) {
  if (error instanceof WorkspaceContextError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  return null;
}

// ── GET /api/business/mine — owner OR admin fetches the organization dashboard data
router.get("/mine", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) {
      return res.status(404).json({ error: "No business account found." });
    }
    const { business, callerRole, organizationId, locationId, locationName } = resolved;

    // Fetch the owner's acquisition source
    const [ownerRow] = await db
      .select({ signupSource: users.signupSource })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const signupSource = ownerRow?.signupSource ?? null;

    const rawMembers = await db
      .select({
        id: locationMemberships.id,
        userId: locationMemberships.userId,
        role: locationMemberships.role,
        status: locationMemberships.status,
        joinedAt: locationMemberships.createdAt,
        name: users.username,
        email: users.email,
        planLookupKey: users.planLookupKey,
      })
      .from(locationMemberships)
      .leftJoin(users, eq(users.id, locationMemberships.userId))
      .where(and(
        eq(locationMemberships.locationId, locationId),
        eq(locationMemberships.status, "active"),
      ))
      .orderBy(sql`lower(coalesce(${users.username}, ${users.email}))`);

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
          eq(businessInvitations.locationId, locationId),
          or(
            eq(businessInvitations.status, "pending"),
            eq(businessInvitations.status, "delivery_failed"),
          ),
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
          eq(businessInvitations.locationId, locationId),
          eq(businessInvitations.invitationType, "client"),
        ),
      )
      .orderBy(sql`${businessInvitations.createdAt} DESC`)
      .limit(200);

    const clients = await db
      .select({
        id: users.id,
        name: users.username,
        email: users.email,
        status: businessInvitations.status,
        joinedAt: businessInvitations.acceptedAt,
      })
      .from(businessInvitations)
      .innerJoin(users, eq(users.id, businessInvitations.acceptedByUserId))
      .where(and(
        eq(businessInvitations.businessId, business.id),
        eq(businessInvitations.locationId, locationId),
        eq(businessInvitations.invitationType, "client"),
        eq(businessInvitations.status, "accepted"),
      ))
      .orderBy(sql`lower(coalesce(${users.username}, ${users.email}))`);

    const { organizations } = await import("../db/schema/organizations");
    const [selectedOrganization] = await db
      .select({ featureFlags: organizations.featureFlags })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    const usedSeats = members.length;
    const planLostCount = members.filter((m) => m.planLost).length;
    const [pilot] = await db.select({
      id: organizationalPilots.id,
      status: organizationalPilots.status,
      professionalCapacity: organizationalPilots.professionalCapacity,
      clientCapacity: organizationalPilots.clientCapacity,
      durationDays: organizationalPilots.durationDays,
      pilotStartAt: organizationalPilots.pilotStartAt,
      pilotEndAt: organizationalPilots.pilotEndAt,
    }).from(organizationalPilots)
      .where(eq(organizationalPilots.businessId, business.id))
      .limit(1);

    return res.json({
      business,
      workspace: { organizationId, locationId, locationName },
      pilot: pilot ?? null,
      members,
      invitations,
      clientInvitations,
      clients,
      organizationPolicies: {
        requireAcademy: selectedOrganization?.featureFlags?.requireAcademy !== false,
        requireProfessionalVerification:
          selectedOrganization?.featureFlags?.requireProfessionalVerification !== false,
      },
      usedSeats,
      availableSeats: business.seatLimit - usedSeats,
      planLostCount,
      callerRole,
      signupSource,
    });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
    console.error("[business/mine] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/business/membership — member (non-owner) checks if they're in a business
router.get("/membership", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const resolved = await resolveSelectedBusiness(req);
    const membership = {
      memberId: resolved.locationId,
      role: resolved.locationRole,
      status: "active",
      joinedAt: null,
      businessId: resolved.business.id,
      businessName: resolved.business.name,
      seatLimit: resolved.business.seatLimit,
      ownerUserId: resolved.business.ownerUserId,
      independentClientPolicy: resolved.business.independentClientPolicy,
      locationId: resolved.locationId,
    };

    return res.json({ membership });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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
    recipientName,
    sendEmail: shouldSendEmail = true,
  } = req.body as {
    email: string;
    role?: string;
    invitationType?: "team_member" | "client";
    trialDays?: number;
    programName?: string;
    partnerRecordId?: string;
    recipientName?: string;
    sendEmail?: boolean;
  };

  const normalizedEmail = typeof email === "string" ? normalizeEmailIdentity(email) : "";
  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !INVITATION_EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return res.status(400).json({ error: "Valid email required." });
  }

  const isClient = invitationType === "client";

  if (!isClient) {
    const validRoles = ["admin", "coach", "trainer", "physician", "nurse", "staff"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
  }

  if (isClient) {
    const days = Number(trialDays);
    if (!isAllowedClientTrialDuration(days)) {
      return res.status(400).json({
        error: "Complimentary access must be 7, 14, or 30 days.",
        code: "INVALID_CLIENT_TRIAL_DURATION",
      });
    }
  }

  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business, locationId } = resolved;
    const invitationIdentity = await resolveEmailIdentityForEmail(normalizedEmail);
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

    // The ordinary organization plan is flat: professional invitations are not
    // purchased seats. Leave seat accounting in place for legacy products.
    if (!isClient && !isFlatOrganization(business)) {
      const usedSeats = await getActiveSeats(business.id);
      const [pendingInvCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(businessInvitations)
        .where(
          and(
            eq(businessInvitations.businessId, business.id),
            eq(businessInvitations.locationId, locationId),
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

    // DB-backed owner throttle (not a commercial cap): protects recipients and
    // works across app instances without changing the invitation schema.
    if (shouldSendEmail) {
      const sentSince = new Date(now.getTime() - ORGANIZATION_INVITE_SEND_WINDOW_MS);
      const [recent] = await db.select({ count: sql<number>`count(*)::int` })
        .from(businessInvitations)
        .where(and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.locationId, locationId),
          eq(businessInvitations.invitedByUserId, userId),
          gt(businessInvitations.createdAt, sentSince),
        ));
      if (Number(recent?.count ?? 0) >= ORGANIZATION_INVITE_SEND_LIMIT) {
        return res.status(429).json({
          error: "Please wait before sending more invitations.",
          code: "INVITATION_SEND_THROTTLED",
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
          eq(businessInvitations.locationId, locationId),
          eq(businessInvitations.email, normalizedEmail),
          eq(businessInvitations.status, "pending"),
          gt(businessInvitations.expiresAt, now),
          eq(businessInvitations.invitationType, invitationType as any),
        ),
      )
      .limit(1);

    if (existingInvite) {
      return res.status(409).json({
        error: "A pending invitation already exists for this email. Use Resend on the existing invitation.",
        code: "PENDING_INVITATION_EXISTS",
        invitationId: existingInvite.id,
        expiresAt: existingInvite.expiresAt,
      });
    }

    // Expire stale pending invites for this email+type
    await db
      .update(businessInvitations)
      .set({ status: "expired" })
      .where(
        and(
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.locationId, locationId),
          eq(businessInvitations.email, normalizedEmail),
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
          .from(locationMemberships)
          .where(
            and(
              eq(locationMemberships.locationId, locationId),
              eq(locationMemberships.userId, existingUser.id),
              eq(locationMemberships.status, "active"),
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
    const resolvedTrialDays = isClient ? Number(trialDays) : null;

    const [createdInvitation] = await db.insert(businessInvitations).values({
      businessId: business.id,
      locationId,
      email: normalizedEmail,
      token,
      role: isClient ? "staff" : (role as any),
      status: "pending",
      invitedByUserId: userId,
      expiresAt,
      invitationType: invitationType as any,
      trialDays: resolvedTrialDays,
      programName: isClient ? (programName?.trim() || null) : null,
      partnerRecordId: partnerRecordId ?? null,
    }).returning({ id: businessInvitations.id });

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
      ? `${PATIENT_ENROLLMENT_APP_URL}/business/join#token=${token}`
      : `${getAppUrl()}/auth?mode=signup&invite=${token}`;

    if (shouldSendEmail) {
      const organizationContext = await loadOrgContext(business.organizationId);
      const emailResult = await sendBusinessInviteEmail({
        to: normalizedEmail,
        businessName: business.name,
        inviterName: owner?.username || "Your organization",
        inviteLink,
        role,
        expiresAt,
        invitationType: invitationType as any,
        trialDays: resolvedTrialDays,
        programName: isClient ? (programName?.trim() || null) : undefined,
        recipientName: recipientName?.trim() || undefined,
        supportEmail: organizationContext.supportEmail,
      });
      if (!emailResult) {
        await db
          .update(businessInvitations)
          .set({ status: "delivery_failed" })
          .where(eq(businessInvitations.id, createdInvitation.id));
        return res.status(502).json({
          error: "The invitation was saved, but the email provider did not accept the message. You can retry it from Invitation Status.",
          code: "INVITATION_EMAIL_DELIVERY_FAILED",
          invitationId: createdInvitation.id,
        });
      }
    }

    console.log(`✅ [business] Invite sent | type=${invitationType}`);
    return res.json({
      success: true,
      emailQueued: shouldSendEmail,
      inviteLink,
      message: `Invitation created for ${normalizedEmail}.`,
    });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

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

    // Flat organizations have no purchased professional-seat limit. Preserve
    // the legacy limit for non-flat products.
    const usedSeats = await getActiveSeats(business.id);
    if (!isFlatOrganization(business) && usedSeats >= business.seatLimit) {
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
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business, callerRole, locationId } = resolved;

    const [member] = await db
      .select()
      .from(locationMemberships)
      .where(and(
        eq(locationMemberships.id, memberId),
        eq(locationMemberships.locationId, locationId),
      ))
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
      .update(locationMemberships)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(locationMemberships.id, memberId));

    console.log(`✅ [business] Member removed | business=${business.id} | member=${memberId}`);
    return res.json({ success: true });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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

// ── DELETE /api/business/invitations/:token — remove an unaccepted invite
router.delete("/invitations/:token", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const { token } = req.params;

  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business, locationId } = resolved;

    const [invite] = await db
      .select({ id: businessInvitations.id, status: businessInvitations.status })
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.token, token),
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.locationId, locationId),
        ),
      )
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found in the selected organization and location." });
    }
    if (invite.status === "accepted") {
      return res.status(409).json({
        error: "Accepted invitations cannot be deleted here. Remove the person from Patients or Team instead.",
        code: "ACCEPTED_INVITATION",
      });
    }

    await db
      .delete(businessInvitations)
      .where(eq(businessInvitations.id, invite.id));

    return res.json({ success: true, deleted: true });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
    console.error("[business/invitations/cancel] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// ── POST /api/business/invitations/:token/resend — owner resends an invite
router.post("/invitations/:token/resend", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) {
      return res.status(403).json({ error: "No business account found." });
    }
    const { business, locationId } = resolved;

    const [invite] = await db
      .select()
      .from(businessInvitations)
      .where(
        and(
          eq(businessInvitations.token, token),
          eq(businessInvitations.businessId, business.id),
          eq(businessInvitations.locationId, locationId),
          or(
            eq(businessInvitations.status, "pending"),
            eq(businessInvitations.status, "delivery_failed"),
            eq(businessInvitations.status, "expired"),
          ),
        ),
      )
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invite not found or already used." });
    }

    // expiresAt is reset to now + seven days on every delivery. It therefore
    // provides a durable resend timestamp without a new mutable schema column.
    if (
      invite.status === "pending" &&
      invite.expiresAt.getTime() >
      Date.now() + (7 * 24 * 60 * 60 * 1000 - ORGANIZATION_RESEND_COOLDOWN_MS)
    ) {
      return res.status(429).json({
        error: "Please wait before resending this invitation.",
        code: "INVITATION_RESEND_COOLDOWN",
      });
    }

    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [owner] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isClientResend = (invite.invitationType ?? "team_member") === "client";
    const inviteLink = isClientResend
      ? `${PATIENT_ENROLLMENT_APP_URL}/business/join#token=${invite.token}`
      : `${getAppUrl()}/auth?mode=signup&invite=${invite.token}`;

    const organizationContext = await loadOrgContext(business.organizationId);
    const emailResult = await sendBusinessInviteEmail({
      to: invite.email,
      businessName: business.name,
      inviterName: owner?.username || "Your team owner",
      inviteLink,
      role: invite.role,
      expiresAt: newExpiry,
      invitationType: (invite.invitationType ?? "team_member") as any,
      trialDays: invite.trialDays,
      programName: invite.programName,
      supportEmail: organizationContext.supportEmail,
    });
    if (!emailResult) {
      await db
        .update(businessInvitations)
        .set({ status: "delivery_failed" })
        .where(eq(businessInvitations.id, invite.id));
      return res.status(502).json({
        error: "The email provider did not accept this resend. The invitation was not reported as sent.",
        code: "INVITATION_EMAIL_DELIVERY_FAILED",
      });
    }

    await db
      .update(businessInvitations)
      .set({ status: "pending", expiresAt: newExpiry })
      .where(eq(businessInvitations.id, invite.id));

    return res.json({ success: true, emailQueued: true, message: "Invite resent." });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

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
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

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
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
    console.error("[business/org-policies] error:", err);
    return res.status(500).json({ error: "Server error." });
  }
});

// New invitation links submit tokens through a header so bearer credentials do
// not appear in request URLs. The legacy path remains for previously sent links.
async function inspectBusinessInvitation(req: any, res: any) {
  const token = req.get("x-business-invitation-token") || req.params.token;
  if (!token) return res.status(400).json({ error: "Invitation token is required." });

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
}

router.get("/invite/inspect", inspectBusinessInvitation);
router.get("/invite/:token", inspectBusinessInvitation);

async function acceptBusinessInvitation(req: any, res: any) {
  const userId = (req as any).authUser?.id as string;
  const token = req.body?.token || req.get("x-business-invitation-token") || req.params.token;
  if (!token) return res.status(400).json({ error: "Invitation token is required." });

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
          trialDays: pilotInvite.trialDays,
          accessStartsAt: accepted.alreadyAccepted ? null : accepted.accessStartsAt,
          accessEndsAt: accepted.alreadyAccepted ? null : accepted.accessEndsAt,
        });
      } catch (error) {
        try { return handlePilotInvitationError(res, error); } catch (unexpected) { throw unexpected; }
      }
    }

    const [invite] = await db
      .select()
      .from(businessInvitations)
      .where(eq(businessInvitations.token, token))
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found." });
    }

    const isIdempotentClientAcceptance =
      invite.invitationType === "client"
      && invite.status === "accepted"
      && invite.acceptedByUserId === userId;

    if (invite.status !== "pending" && !isIdempotentClientAcceptance) {
      return res.status(404).json({ error: "Invitation not found or already used." });
    }

    if (invite.status === "pending" && new Date() > new Date(invite.expiresAt)) {
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
      if (!isAllowedClientTrialDuration(trialDays)) {
        return res.status(409).json({
          error: "This invitation has an unsupported complimentary access period. Please ask the Organization to send a new invitation.",
          code: "INVALID_CLIENT_TRIAL_DURATION",
        });
      }
      if (
        business.plan !== "clinical_business_monthly"
        || !business.stripeCustomerId
        || !business.stripeSubscriptionId
      ) {
        return res.status(403).json({
          error: "This invitation is not from a verified paid Organization.",
          code: "PAID_ORGANIZATION_REQUIRED",
        });
      }

      const [ownerMembership] = await db
        .select({ userId: businessMembers.userId })
        .from(businessMembers)
        .where(and(
          eq(businessMembers.businessId, business.id),
          eq(businessMembers.userId, business.ownerUserId),
          eq(businessMembers.role, "owner"),
          eq(businessMembers.status, "active"),
        ))
        .limit(1);

      if (!ownerMembership) {
        return res.status(409).json({
          error: "This Organization does not have an active professional owner.",
          code: "ORGANIZATION_OWNER_NOT_READY",
        });
      }

      let activation;
      try {
        activation = await activateProCareClient(
          userId,
          ownerMembership.userId,
          "paid_business_client_invite",
          async (tx) => {
            if (isIdempotentClientAcceptance) return;

            const [consumedInvite] = await tx
              .update(businessInvitations)
              .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId })
              .where(and(
                eq(businessInvitations.id, invite.id),
                eq(businessInvitations.status, "pending"),
              ))
              .returning({ id: businessInvitations.id });

            if (!consumedInvite) {
              const conflict = new Error("Invitation is no longer pending.") as Error & { code: string };
              conflict.code = "INVITATION_NOT_PENDING";
              throw conflict;
            }

            // Preserve existing paid personal subscriptions. Complimentary
            // access is granted exactly once, in the same transaction that
            // activates the canonical ProCare relationship and consumes the invite.
            const [acceptingUser] = await tx
              .select({ planLookupKey: users.planLookupKey })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);
            const hasActivePaidPlan =
              acceptingUser?.planLookupKey != null && acceptingUser.planLookupKey !== "";

            if (!hasActivePaidPlan) {
              await tx.execute(
                sql`UPDATE users
                    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, '1970-01-01'::timestamptz), NOW() + (${trialDays}::text || ' days')::interval),
                        trial_reminders_sent = CASE WHEN ${trialDays} > 7 THEN '{}'::text[] ELSE trial_reminders_sent END
                    WHERE id = ${userId}`,
              );
            }
          },
        );
      } catch (error) {
        if (error instanceof ActivationError) {
          const isRelationshipConflict = error.code === "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL";
          return res.status(isRelationshipConflict ? 409 : 422).json({
            error: isRelationshipConflict
              ? "This client is already connected to another professional."
              : "The Organization owner is not ready to accept ProCare clients.",
            code: error.code,
          });
        }
        if ((error as any)?.code === "INVITATION_NOT_PENDING") {
          return res.status(409).json({
            error: "This invitation has already been accepted.",
            code: "INVITATION_NOT_PENDING",
          });
        }
        throw error;
      }

      const programName = invite.programName || "My Perfect Meals Complimentary Access";
      console.log(
        `✅ [business] Client invite accepted | business=${business.id} | user=${userId} | days=${trialDays} | proCareOwner=${ownerMembership.userId} | alreadyAccepted=${isIdempotentClientAcceptance}`,
      );
      return res.json({
        success: true,
        alreadyAccepted: isIdempotentClientAcceptance,
        invitationType: "client",
        businessName: business.name,
        programName,
        trialDays,
        proCareConnected: true,
        studioId: activation.studioId,
      });
    }

    // ── Existing membership check (any status) ────────────────────────────────
    // Must run BEFORE the seat-count check so we emit the correct error and
    // never create a duplicate row.  A removed member re-accepting a new invite
    // re-activates their existing row instead of inserting a second one.
    if (!invite.locationId) {
      return res.status(409).json({
        error: "Invitation is missing its Organization Location context.",
        code: "INVITATION_WORKSPACE_MISSING",
      });
    }
    const [existingLocationAccess] = await db
      .select({ id: locationMemberships.id })
      .from(locationMemberships)
      .where(and(
        eq(locationMemberships.locationId, invite.locationId),
        eq(locationMemberships.userId, userId),
        eq(locationMemberships.status, "active"),
      ))
      .limit(1);
    if (existingLocationAccess) {
      return res.status(400).json({ error: "You are already a member of this Location." });
    }

    const [existing] = await db
      .select()
      .from(businessMembers)
      .where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.userId, userId)))
      .limit(1);

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

    // Atomically update member row + mark invite accepted so they can never diverge.
    // The per-user advisory lock serializes concurrent invitation acceptance.
    // Membership uniqueness is scoped to (business_id, user_id), allowing an
    // existing staff member to separately own another organization.
    try {
      await db.transaction(async (tx) => {
        // Serialize acceptance by both organization and user. Re-read the
        // invitation/member state while locked: a stale preflight must never
        // create a second membership or a second introductory entitlement.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${business.id}))`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
        const [lockedInvite] = await tx.select()
          .from(businessInvitations)
          .where(eq(businessInvitations.id, invite.id))
          .limit(1);
        if (!lockedInvite || lockedInvite.status !== "pending") {
          const inviteError = new Error("Invitation is no longer pending.") as Error & { code: string };
          inviteError.code = "INVITATION_NOT_PENDING";
          throw inviteError;
        }
        const [lockedExisting] = await tx.select().from(businessMembers)
          .where(and(
            eq(businessMembers.businessId, business.id),
            eq(businessMembers.userId, userId),
          ))
          .limit(1);
        const [lockedLocationAccess] = await tx.select({ id: locationMemberships.id })
          .from(locationMemberships)
          .where(and(
            eq(locationMemberships.locationId, lockedInvite.locationId!),
            eq(locationMemberships.userId, userId),
            eq(locationMemberships.status, "active"),
          ))
          .limit(1);
        if (lockedLocationAccess) {
          const memberError = new Error("You are already a member of this Location.") as Error & { code: string };
          memberError.code = "ALREADY_MEMBER";
          throw memberError;
        }
        const [lockedElsewhere] = await tx.select({ businessId: businessMembers.businessId })
          .from(businessMembers)
          .where(and(
            eq(businessMembers.userId, userId),
            eq(businessMembers.status, "active"),
            ne(businessMembers.businessId, business.id),
          ))
          .limit(1);
        if (lockedElsewhere) {
          const elsewhereError = new Error(
            "You are already an active member of another business. Leave that business before joining a new one.",
          ) as Error & { code: string };
          elsewhereError.code = "ALREADY_IN_ANOTHER_BUSINESS";
          throw elsewhereError;
        }

        const [lockedBusiness] = await tx
          .select({
            seatLimit: businesses.seatLimit,
            plan: businesses.plan,
            organizationId: businesses.organizationId,
          })
          .from(businesses)
          .where(eq(businesses.id, business.id))
          .limit(1);
        const [seatUsage] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(businessMembers)
          .where(and(
            eq(businessMembers.businessId, business.id),
            eq(businessMembers.status, "active"),
          ));
        const usedSeats = Number(seatUsage?.count ?? 0);
        if (!lockedBusiness || (!isFlatOrganization(lockedBusiness) && usedSeats >= lockedBusiness.seatLimit)) {
          const seatError = new Error("All seats are currently in use.") as Error & { code: string };
          seatError.code = "SEATS_FULL";
          throw seatError;
        }

        if (lockedExisting?.status === "removed") {
          // Re-activate a previously-removed member row — never insert a duplicate.
          // Also set noticeDismissedAt so the stale removal-notice banner is cleared
          // immediately on re-join and never shown to an active member.
          await tx
            .update(businessMembers)
            .set({
              locationId: lockedInvite.locationId,
              status: "active",
              joinedAt: new Date(),
              noticeDismissedAt: new Date(),
            })
            .where(eq(businessMembers.id, lockedExisting.id));

          // Belt-and-suspenders: dismiss any other undismissed removal-notice rows
          // for this user in this business (historical rows from prior removals).
          // Using the shared clearRemovalNotice helper so any future reactivation
          // path (admin restore, direct API, etc.) gets the same guarantee by
          // calling one function rather than duplicating the WHERE clause.
          await clearRemovalNotice(tx, userId, business.id);
        } else if (!lockedExisting) {
          await tx.insert(businessMembers).values({
            businessId: business.id,
            locationId: lockedInvite.locationId,
            userId,
            role: invite.role as any,
            status: "active",
          });
        }

        if (!lockedInvite.locationId || !lockedBusiness?.organizationId) {
          const contextError = new Error("Invitation is missing its Organization Location context.") as Error & { code: string };
          contextError.code = "INVITATION_WORKSPACE_MISSING";
          throw contextError;
        }
        await tx.insert(organizationMemberships).values({
          organizationId: lockedBusiness.organizationId,
          userId,
          role: "member",
          status: "active",
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [organizationMemberships.organizationId, organizationMemberships.userId],
          set: { status: "active", updatedAt: new Date() },
        });
        await tx.insert(locationMemberships).values({
          locationId: lockedInvite.locationId,
          userId,
          role: invite.role as any,
          status: "active",
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [locationMemberships.locationId, locationMemberships.userId],
          set: { role: invite.role as any, status: "active", updatedAt: new Date() },
        });

        // A flat organization preserves membership but does not convey
        // permanent sponsored professional access. Give an unpaid invitee one
        // authoritative, non-stackable 30-day introduction. Historical
        // accepted team invitations are the durable one-time grant marker.
        if (isFlatOrganization(lockedBusiness)) {
          const [lockedUser] = await tx.select({
            planLookupKey: users.planLookupKey,
            personalPlanLookupKey: users.personalPlanLookupKey,
            entitlements: users.entitlements,
          }).from(users).where(eq(users.id, userId)).limit(1);
          const [priorGrant] = await tx.select({ id: businessInvitations.id })
            .from(businessInvitations)
            .where(and(
              eq(businessInvitations.acceptedByUserId, userId),
              eq(businessInvitations.invitationType, "team_member"),
              eq(businessInvitations.status, "accepted"),
              ne(businessInvitations.id, lockedInvite.id),
            ))
            .limit(1);
          const hasPaidEntitlement = Boolean(
            lockedUser?.personalPlanLookupKey || lockedUser?.planLookupKey,
          );
          if (!hasPaidEntitlement && !priorGrant) {
            await tx.execute(sql`UPDATE users
              SET trial_ends_at = GREATEST(
                COALESCE(trial_ends_at, '1970-01-01'::timestamptz),
                NOW() + interval '30 days'
              ),
              trial_reminders_sent = '{}'::text[]
              WHERE id = ${userId}`);
          }
        } else {
          // Legacy paid-business behavior: retain the personal snapshot used
          // when a legacy sponsored seat later ends.
          const [currentUser] = await tx.select({
            planLookupKey: users.planLookupKey,
            personalPlanLookupKey: users.personalPlanLookupKey,
            entitlements: users.entitlements,
          }).from(users).where(eq(users.id, userId)).limit(1);
          if (currentUser && currentUser.personalPlanLookupKey === null) {
            await tx.update(users).set({
              personalPlanLookupKey: currentUser.planLookupKey ?? null,
              personalEntitlements: (currentUser.entitlements ?? []) as any,
              personalSubscriptionStatus: "active",
            } as any).where(eq(users.id, userId));
          }
        }

        await tx
          .update(businessInvitations)
          .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId })
          .where(eq(businessInvitations.id, invite.id));
      });
    } catch (txErr: any) {
      if (txErr.code === "SEATS_FULL") {
        return res.status(400).json({
          error: "All seats are currently in use. Please contact the business owner.",
          code: "SEATS_FULL",
        });
      }
      if (txErr.code === "INVITATION_NOT_PENDING" || txErr.code === "ALREADY_MEMBER") {
        return res.status(409).json({ error: txErr.message, code: txErr.code });
      }
      if (txErr.code === "INVITATION_WORKSPACE_MISSING") {
        return res.status(409).json({ error: txErr.message, code: txErr.code });
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
}

router.post("/invite/accept", requireAuth, acceptBusinessInvitation);
router.post("/invite/:token/accept", requireAuth, acceptBusinessInvitation);

// ── PATCH /api/business/name — owner renames the business
router.patch("/name", requireAuth, requireProOrOrgAdmin, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { name } = req.body as { name: string };

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Business name must be at least 2 characters." });
  }

  try {
    const resolved = await resolveDashboardBusiness(req, "admin_or_owner");

    if (!resolved) return res.status(403).json({ error: "No business account found." });

    await db
      .update(businesses)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(businesses.id, resolved.business.id));

    return res.json({ success: true });
  } catch (err) {
    const workspaceError = sendDashboardWorkspaceError(res, err);
    if (workspaceError) return workspaceError;
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
  const requestedOperationId = req.get("Idempotency-Key")?.trim();
  if (requestedOperationId && requestedOperationId.length > 200) {
    return res.status(400).json({ error: "Invalid seat-change operation identifier." });
  }
  const operationId = requestedOperationId || randomUUID();

  try {
    const seatsResolved = await resolveDashboardBusiness(req, "owner_only");
    if (!seatsResolved) return res.status(404).json({ error: "No business found for this account." });
    const biz = seatsResolved.business;
    if (biz.status !== "active") return res.status(400).json({ error: "Business subscription is not active." });
    if (isFlatOrganization(biz)) {
      return res.status(410).json({
        error: "This Organization plan is flat-priced; professional invitations do not change Stripe quantity.",
        code: "FLAT_ORGANIZATION_NO_SEAT_MUTATION",
      });
    }

    await db.transaction(async (tx) => {
      // Serialize seat changes across app instances so Stripe and the local
      // seat limit cannot be updated by overlapping requests out of order.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${biz.id}))`);

      const [lockedBusiness] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, biz.id))
        .limit(1);
      if (!lockedBusiness || lockedBusiness.status !== "active") {
        throw new Error("Business subscription is not active.");
      }
      const [seatUsage] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(businessMembers)
        .where(and(
          eq(businessMembers.businessId, biz.id),
          eq(businessMembers.status, "active"),
        ));
      const activeSeats = Number(seatUsage?.count ?? 0);
      if (newSeats < activeSeats) {
        throw new Error(
          `Cannot reduce to ${newSeats} seat${newSeats !== 1 ? "s" : ""}. You have ${activeSeats} active member${activeSeats !== 1 ? "s" : ""} using seats. Remove members first.`,
        );
      }

      // Update Stripe subscription quantity if we have a live subscription ID.
      if (
        stripe
        && lockedBusiness.stripeSubscriptionId
        && !lockedBusiness.stripeSubscriptionId.startsWith("dev_")
      ) {
        assertStripeBillingOwnership(stripeKey);
        const subscription = await stripe.subscriptions.retrieve(lockedBusiness.stripeSubscriptionId);
        const itemId = subscription.items.data[0]?.id;
        if (!itemId) throw new Error("Could not locate subscription item on Stripe.");

        const currentQuantity = subscription.items.data[0]?.quantity ?? 0;
        if (currentQuantity !== newSeats) {
          await stripe.subscriptions.update(
            lockedBusiness.stripeSubscriptionId,
            {
              items: [{ id: itemId, quantity: newSeats }],
              proration_behavior: "always_invoice",
            },
            {
              idempotencyKey: `mpm-business-seats:${biz.id}:${operationId}`,
            },
          );
          console.log(`✅ [business/seats] Stripe quantity updated → ${newSeats} | biz=${biz.id} | owner=${userId}`);
        }
      }

      await tx
        .update(businesses)
        .set({ seatLimit: newSeats, updatedAt: new Date() })
        .where(eq(businesses.id, biz.id));
    });
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
// The Stripe webhook flips status to active. Ordinary organizations are flat;
// seatLimit is retained only for legacy compatibility and is not capacity.
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
      await ensureCanonicalWorkspaceForBusiness(existing.id);
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
          seatLimit: 1,
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
      const isUniqueViolation =
        conflictErr?.code === "23505" || // PostgreSQL unique violation
        String(conflictErr?.message).includes("unique");
      // Unique constraint on ownerUserId means a concurrent request already
      // created the org. Re-read and return it rather than surfacing a 500.
      if (isUniqueViolation) {
        const [race] = await db.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
        if (race) {
          console.warn(`[business/create-org] race resolved | biz=${race.id} | owner=${userId}`);
          await ensureCanonicalWorkspaceForBusiness(race.id);
          return res.json({ businessId: race.id, created: false });
        }
      }
      throw conflictErr;
    }

    await ensureCanonicalWorkspaceForBusiness(newBiz!.id);
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
