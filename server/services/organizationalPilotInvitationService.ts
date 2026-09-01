import crypto from "crypto";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { businessInvitations, businessMembers, businesses } from "../db/schema/business";
import {
  organizationalPilotParticipants,
  organizationalPilots,
} from "../db/schema/pilotProgram";
import { users } from "@shared/schema";
import {
  assertPilotCapacityAvailable,
  type PilotPopulationType,
} from "./pilotProgramAccess";
import { normalizeEmailIdentity, resolveEmailIdentityForUser } from "./emailIdentityService";
import { logAudit } from "../lib/auditLog";

export type PilotInvitationRole =
  | "champion"
  | "nurse"
  | "provider"
  | "coach"
  | "staff"
  | "client";

export class PilotInvitationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function capacityFor(pilot: typeof organizationalPilots.$inferSelect, populationType: PilotPopulationType): number {
  return populationType === "professional"
    ? pilot.professionalCapacity
    : pilot.clientCapacity;
}

export function toBusinessMemberRole(role: PilotInvitationRole) {
  switch (role) {
    case "nurse": return "nurse" as const;
    case "provider": return "physician" as const;
    case "coach": return "coach" as const;
    case "staff": return "staff" as const;
    default:
      throw new PilotInvitationError("Role cannot receive a professional Business membership.", "INVALID_ROLE");
  }
}

async function reservedCount(
  tx: any,
  pilotId: string,
  populationType: PilotPopulationType,
): Promise<number> {
  const result = await tx.execute(sql`
    SELECT count(*)::int AS count
      FROM organizational_pilot_participants
     WHERE pilot_id = ${pilotId}
       AND population_type = ${populationType}
       AND status IN ('pending', 'active')
  `);
  return Number((result.rows[0] as { count?: number } | undefined)?.count ?? 0);
}

export async function createOrganizationalPilotInvitation(input: {
  businessId: string;
  pilotId: string;
  invitedByUserId: string;
  email: string;
  populationType: PilotPopulationType;
  participantRole: PilotInvitationRole;
  assignedProfessionalUserId?: string | null;
  participantName?: string | null;
  expiresAt?: Date;
}) {
  const normalizedEmail = normalizeEmailIdentity(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new PilotInvitationError("Valid email required.", "INVALID_EMAIL");
  }
  if (input.populationType === "professional" && input.participantRole === "client") {
    throw new PilotInvitationError("Professional invitations require a professional role.", "INVALID_ROLE");
  }
  if (input.populationType === "client" && input.participantRole !== "client") {
    throw new PilotInvitationError("Client invitations require the client role.", "INVALID_ROLE");
  }
  if (input.participantRole === "champion") {
    throw new PilotInvitationError(
      "Pilot Champions must claim an approved organizational authorization, not a participant invitation.",
      "CHAMPION_AUTHORIZATION_REQUIRED",
    );
  }

  const rawToken = newToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.pilotId}))`);
    const [pilot] = await tx.select().from(organizationalPilots).where(and(
      eq(organizationalPilots.id, input.pilotId),
      eq(organizationalPilots.businessId, input.businessId),
      inArray(organizationalPilots.status, ["preparing", "active"]),
    )).limit(1);
    if (!pilot) throw new PilotInvitationError("Organizational pilot not found or unavailable.", "PILOT_NOT_AVAILABLE", 404);

    const [duplicate] = await tx.select({ id: businessInvitations.id }).from(businessInvitations).where(and(
      eq(businessInvitations.businessId, input.businessId),
      eq(businessInvitations.organizationalPilotId, input.pilotId),
      eq(businessInvitations.email, normalizedEmail),
      eq(businessInvitations.status, "pending"),
      gt(businessInvitations.expiresAt, new Date()),
    )).limit(1);
    if (duplicate) throw new PilotInvitationError("A pending invitation already exists for this email.", "DUPLICATE_INVITATION");

    const count = await reservedCount(tx, input.pilotId, input.populationType);
    assertPilotCapacityAvailable({
      populationType: input.populationType,
      capacity: capacityFor(pilot, input.populationType),
      reservedCount: count,
    });
    if (input.populationType === "client" && input.assignedProfessionalUserId) {
      const [assignedProfessional] = await tx.select({ id: businessMembers.id })
        .from(businessMembers)
        .where(and(
          eq(businessMembers.businessId, input.businessId),
          eq(businessMembers.userId, input.assignedProfessionalUserId),
          eq(businessMembers.status, "active"),
        ))
        .limit(1);
      if (!assignedProfessional) {
        throw new PilotInvitationError("Assigned professional is not an active member of this organization.", "INVALID_ASSIGNED_PROFESSIONAL");
      }
    }

    const [invite] = await tx.insert(businessInvitations).values({
      businessId: input.businessId,
      email: normalizedEmail,
      token: tokenHash,
      tokenHash,
      role: input.populationType === "client" ? "staff" : toBusinessMemberRole(input.participantRole),
      status: "pending",
      invitedByUserId: input.invitedByUserId,
      expiresAt,
      invitationType: input.populationType === "client" ? "client" : "team_member",
      trialDays: null,
      programName: pilot.name,
      organizationalPilotId: input.pilotId,
      populationType: input.populationType,
      participantRole: input.participantRole,
      assignedProfessionalUserId: input.assignedProfessionalUserId ?? null,
    }).returning();

    const [participant] = await tx.insert(organizationalPilotParticipants).values({
      pilotId: input.pilotId,
      participantName: input.participantName?.trim() || null,
      email: normalizedEmail,
      normalizedEmail,
      populationType: input.populationType,
      participantRole: input.participantRole,
      status: "pending",
      businessInvitationId: invite.id,
      createdByUserId: input.invitedByUserId,
    }).returning();
    return { invite, participant, pilot };
  });

  return {
    ...result,
    rawToken,
    inviteLink: input.populationType === "client"
      ? `/business/join/${rawToken}`
      : `/auth?mode=signup&invite=${rawToken}`,
  };
}

export async function findOrganizationalPilotInvitation(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [invite] = await db.select().from(businessInvitations).where(and(
    or(eq(businessInvitations.tokenHash, tokenHash), eq(businessInvitations.token, tokenHash)),
    sql`${businessInvitations.organizationalPilotId} IS NOT NULL`,
  )).limit(1);
  return invite ?? null;
}

export async function expireOrganizationalPilotInvitation(inviteId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [invite] = await tx.update(businessInvitations)
      .set({ status: "expired" })
      .where(and(eq(businessInvitations.id, inviteId), eq(businessInvitations.status, "pending")))
      .returning({ id: businessInvitations.id });
    if (invite) {
      await tx.update(organizationalPilotParticipants)
        .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(organizationalPilotParticipants.businessInvitationId, invite.id), eq(organizationalPilotParticipants.status, "pending")));
    }
  });
}

export async function cancelOrganizationalPilotInvitation(inviteId: string, actorUserId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [invite] = await tx.update(businessInvitations)
      .set({ status: "cancelled" })
      .where(and(eq(businessInvitations.id, inviteId), eq(businessInvitations.status, "pending")))
      .returning({ id: businessInvitations.id, pilotId: businessInvitations.organizationalPilotId });
    if (!invite) return false;
    await tx.update(organizationalPilotParticipants)
      .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(organizationalPilotParticipants.businessInvitationId, invite.id), eq(organizationalPilotParticipants.status, "pending")));
    logAudit({
      actor: actorUserId,
      action: "WRITE",
      resourceType: "organizational_pilot_invitation",
      resourceId: invite.id,
      meta: { event: "cancelled", pilotId: invite.pilotId },
    });
    return true;
  });
}

export async function resendOrganizationalPilotInvitation(input: {
  inviteId: string;
  businessId: string;
  actorUserId: string;
}) {
  const rawToken = newToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(businessInvitations).where(and(
      eq(businessInvitations.id, input.inviteId),
      eq(businessInvitations.businessId, input.businessId),
      sql`${businessInvitations.organizationalPilotId} IS NOT NULL`,
      inArray(businessInvitations.status, ["pending", "expired"]),
    )).limit(1);
    if (!current) throw new PilotInvitationError("Invitation not found or already used.", "INVITATION_NOT_FOUND", 404);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${current.organizationalPilotId!}))`);
    const [pilot] = await tx.select().from(organizationalPilots)
      .where(eq(organizationalPilots.id, current.organizationalPilotId!)).limit(1);
    if (!pilot || !current.populationType) {
      throw new PilotInvitationError("Organizational pilot not found.", "PILOT_NOT_AVAILABLE", 404);
    }
    if (current.status === "expired") {
      const count = await reservedCount(tx, pilot.id, current.populationType);
      assertPilotCapacityAvailable({
        populationType: current.populationType,
        capacity: capacityFor(pilot, current.populationType),
        reservedCount: count,
      });
    }
    const [updated] = await tx.update(businessInvitations).set({
      token: tokenHash,
      tokenHash,
      status: "pending",
      expiresAt,
    }).where(eq(businessInvitations.id, current.id)).returning();
    await tx.update(organizationalPilotParticipants).set({
      status: "pending",
      removedAt: null,
      updatedAt: new Date(),
    }).where(eq(organizationalPilotParticipants.businessInvitationId, current.id));
    return updated;
  });
  return {
    invite,
    rawToken,
    expiresAt,
    invitePath: invite.populationType === "client"
      ? `/business/join/${rawToken}`
      : `/auth?mode=signup&invite=${rawToken}`,
  };
}

export async function acceptOrganizationalPilotInvitation(rawToken: string, userId: string) {
  const found = await findOrganizationalPilotInvitation(rawToken);
  if (!found) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${found.id}))`);
    const [invite] = await tx.select().from(businessInvitations)
      .where(eq(businessInvitations.id, found.id)).limit(1);
    if (!invite) throw new PilotInvitationError("Invitation not found.", "INVITATION_NOT_FOUND", 404);
    if (invite.status === "accepted" && invite.acceptedByUserId === userId) {
      return { alreadyAccepted: true, invite };
    }
    if (invite.status !== "pending") {
      throw new PilotInvitationError("This invitation is no longer valid.", "INVITATION_NOT_PENDING", 410);
    }
    if (new Date() > invite.expiresAt) {
      await tx.update(businessInvitations).set({ status: "expired" }).where(eq(businessInvitations.id, invite.id));
      await tx.update(organizationalPilotParticipants).set({ status: "removed", removedAt: new Date() })
        .where(eq(organizationalPilotParticipants.businessInvitationId, invite.id));
      throw new PilotInvitationError("This invitation has expired.", "INVITATION_EXPIRED", 410);
    }

    const identity = await resolveEmailIdentityForUser(userId);
    if (identity.status !== "unique" || normalizeEmailIdentity(identity.user.email) !== normalizeEmailIdentity(invite.email)) {
      throw new PilotInvitationError("This invitation was issued to a different email address.", "EMAIL_MISMATCH", 403);
    }

    const [participant] = await tx.select().from(organizationalPilotParticipants)
      .where(eq(organizationalPilotParticipants.businessInvitationId, invite.id)).limit(1);
    if (!participant) throw new PilotInvitationError("Pilot participant record is missing.", "PARTICIPANT_MISSING", 500);
    const [pilot] = await tx.select().from(organizationalPilots).where(and(
      eq(organizationalPilots.id, participant.pilotId),
      inArray(organizationalPilots.status, ["preparing", "active"]),
    )).limit(1);
    if (!pilot) throw new PilotInvitationError("Organizational pilot is no longer available.", "PILOT_NOT_AVAILABLE", 410);

    let membershipId: string | null = null;
    if (participant.populationType === "professional") {
      const [elsewhere] = await tx.select({ businessId: businessMembers.businessId }).from(businessMembers)
        .where(and(eq(businessMembers.userId, userId), eq(businessMembers.status, "active"), sql`${businessMembers.businessId} <> ${invite.businessId}`))
        .limit(1);
      if (elsewhere) throw new PilotInvitationError("You are already an active member of another business.", "ALREADY_IN_ANOTHER_BUSINESS");

      const [existing] = await tx.select().from(businessMembers).where(and(
        eq(businessMembers.businessId, invite.businessId),
        eq(businessMembers.userId, userId),
      )).limit(1);
      if (existing?.status === "active") {
        membershipId = existing.id;
      } else if (existing) {
        const [restored] = await tx.update(businessMembers).set({ status: "active", role: invite.role as any, joinedAt: new Date(), removedAt: null })
          .where(eq(businessMembers.id, existing.id)).returning({ id: businessMembers.id });
        membershipId = restored?.id ?? null;
      } else {
        const [member] = await tx.insert(businessMembers).values({
          businessId: invite.businessId,
          userId,
          role: invite.role as any,
          status: "active",
        }).returning({ id: businessMembers.id });
        membershipId = member.id;
      }
    }

    await tx.update(organizationalPilotParticipants).set({
      userId,
      businessMemberId: membershipId,
      status: "active",
      acceptedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(organizationalPilotParticipants.id, participant.id));
    await tx.update(businessInvitations).set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedByUserId: userId,
    }).where(eq(businessInvitations.id, invite.id));

    return {
      alreadyAccepted: false,
      invite,
      participantId: participant.id,
      membershipId,
      pilotEndAt: pilot.pilotEndAt,
    };
  });
}