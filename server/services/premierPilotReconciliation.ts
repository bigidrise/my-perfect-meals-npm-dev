import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { businessInvitations, businessMembers, businesses } from "../db/schema/business";
import {
  organizationalPilotAuthorizations,
  organizationalPilotEvents,
  organizationalPilotParticipants,
  organizationalPilots,
} from "../db/schema/pilotProgram";
import { resolveEmailIdentityForEmail } from "./emailIdentityService";
import {
  claimPilotAuthorization,
  createApprovedPilotAuthorization,
  PilotAuthorizationError,
} from "./organizationalPilotAuthorizationService";
import { createOrganizationalPilotInvitation } from "./organizationalPilotInvitationService";

export const PREMIER_PILOT_RECONCILIATION = {
  organizationName: "Premier Health",
  championEmail: "apate@pwlindy.com",
  professionalCapacity: 5,
  clientCapacity: 30,
  durationDays: 30,
  // September 1 through September 30 in America/Chicago. End is exclusive,
  // so the full final day remains inside the shared window.
  pilotStartAt: new Date("2026-09-01T00:00:00-05:00"),
  pilotEndAt: new Date("2026-10-01T00:00:00-05:00"),
  participants: [
    { email: "apate@pwlindy.com", name: "Allison Pate" },
    { email: "tlanghammer@pwlindy.com", name: "Tory Langhammer" },
    { email: "spugh@pwlindy.com", name: "Sam Pugh" },
    { email: "lbanks@pwlindy.com", name: "Lauren Banks" },
    { email: "sfriedman@pwlindy.com", name: "Scott Friedman" },
  ],
} as const;

async function resolvePremierIdentities() {
  const identities = await Promise.all(
    PREMIER_PILOT_RECONCILIATION.participants.map(async (participant) => ({
      ...participant,
      identity: await resolveEmailIdentityForEmail(participant.email),
    })),
  );
  const champion = identities.find((item) => item.email === PREMIER_PILOT_RECONCILIATION.championEmail)!;
  if (champion.identity.status !== "unique" && champion.identity.status !== "legacy_exact") {
    throw new PilotAuthorizationError(
      "Allison's existing account must resolve to exactly one MPM user before Premier reconciliation.",
      "PREMIER_CHAMPION_IDENTITY_REQUIRED",
      409,
    );
  }
  for (const item of identities) {
    if (item.identity.status === "ambiguous") {
      throw new PilotAuthorizationError(
        `Premier identity is ambiguous for ${item.email}; reconciliation stopped.`,
        "PREMIER_IDENTITY_AMBIGUOUS",
        409,
      );
    }
  }
  return identities;
}

export async function reconcilePremierPilot(approvedByUserId: string) {
  const identities = await resolvePremierIdentities();
  const champion = identities.find((item) => item.email === PREMIER_PILOT_RECONCILIATION.championEmail)!;
  if (champion.identity.status !== "unique" && champion.identity.status !== "legacy_exact") {
    throw new PilotAuthorizationError(
      "Allison's existing account must resolve to exactly one MPM user before Premier reconciliation.",
      "PREMIER_CHAMPION_IDENTITY_REQUIRED",
      409,
    );
  }
  const championUserId = champion.identity.user.id;

  let authorization = (await db.select().from(organizationalPilotAuthorizations).where(and(
    eq(organizationalPilotAuthorizations.organizationName, PREMIER_PILOT_RECONCILIATION.organizationName),
    eq(organizationalPilotAuthorizations.normalizedChampionEmail, PREMIER_PILOT_RECONCILIATION.championEmail),
  )).limit(1))[0];

  if (!authorization) {
    authorization = (await createApprovedPilotAuthorization({
      organizationName: PREMIER_PILOT_RECONCILIATION.organizationName,
      championEmail: PREMIER_PILOT_RECONCILIATION.championEmail,
      professionalCapacity: PREMIER_PILOT_RECONCILIATION.professionalCapacity,
      clientCapacity: PREMIER_PILOT_RECONCILIATION.clientCapacity,
      durationDays: PREMIER_PILOT_RECONCILIATION.durationDays,
      approvedByUserId,
    })).authorization;
  }

  if (authorization.status === "approved") {
    await claimPilotAuthorization({
      userId: championUserId,
      authorizationId: authorization.id,
    });
  } else if (authorization.status !== "claimed") {
    throw new PilotAuthorizationError(
      `Premier authorization is ${authorization.status} and cannot be reconciled.`,
      "PREMIER_AUTHORIZATION_UNAVAILABLE",
      409,
    );
  }

  const result = await db.transaction(async (tx) => {
    const [lockedAuthorization] = await tx.select().from(organizationalPilotAuthorizations)
      .where(eq(organizationalPilotAuthorizations.id, authorization!.id)).limit(1);
    if (!lockedAuthorization?.businessId) {
      throw new PilotAuthorizationError("Premier authorization did not bind to a Business.", "PREMIER_BUSINESS_REQUIRED", 500);
    }
    const [business] = await tx.update(businesses).set({
      name: PREMIER_PILOT_RECONCILIATION.organizationName,
      seatLimit: PREMIER_PILOT_RECONCILIATION.professionalCapacity,
      clientCapacity: PREMIER_PILOT_RECONCILIATION.clientCapacity,
      plan: "organizational_pilot",
      status: "active",
      updatedAt: new Date(),
    }).where(eq(businesses.id, lockedAuthorization.businessId)).returning();
    if (!business) throw new PilotAuthorizationError("Premier Business not found.", "PREMIER_BUSINESS_REQUIRED", 500);

    const [adminMembership] = await tx.select().from(businessMembers).where(and(
      eq(businessMembers.businessId, business.id),
      eq(businessMembers.userId, championUserId),
    )).limit(1);
    if (!adminMembership) {
      throw new PilotAuthorizationError("Premier Champion membership is missing.", "PREMIER_CHAMPION_MEMBERSHIP_REQUIRED", 500);
    }
    await tx.update(businessMembers).set({
      role: "admin",
      status: "active",
      removedAt: null,
    }).where(eq(businessMembers.id, adminMembership.id));

    let [pilot] = await tx.select().from(organizationalPilots)
      .where(eq(organizationalPilots.authorizationId, lockedAuthorization.id)).limit(1);
    if (!pilot) {
      throw new PilotAuthorizationError("Premier pilot was not created by the Champion claim.", "PREMIER_PILOT_REQUIRED", 500);
    }
    [pilot] = await tx.update(organizationalPilots).set({
      name: "Premier Health 30-Day Pilot",
      status: "active",
      professionalCapacity: PREMIER_PILOT_RECONCILIATION.professionalCapacity,
      clientCapacity: PREMIER_PILOT_RECONCILIATION.clientCapacity,
      durationDays: PREMIER_PILOT_RECONCILIATION.durationDays,
      championBusinessMemberId: adminMembership.id,
      pilotStartAt: PREMIER_PILOT_RECONCILIATION.pilotStartAt,
      pilotEndAt: PREMIER_PILOT_RECONCILIATION.pilotEndAt,
      startedByUserId: approvedByUserId,
      updatedAt: new Date(),
    }).where(eq(organizationalPilots.id, pilot.id)).returning();

    const [participant] = await tx.select().from(organizationalPilotParticipants).where(and(
      eq(organizationalPilotParticipants.pilotId, pilot.id),
      eq(organizationalPilotParticipants.normalizedEmail, PREMIER_PILOT_RECONCILIATION.championEmail),
    )).limit(1);
    if (participant) {
      await tx.update(organizationalPilotParticipants).set({
        userId: championUserId,
        businessMemberId: adminMembership.id,
        participantName: "Allison Pate",
        populationType: "professional",
        participantRole: "nurse",
        status: "active",
        acceptedAt: participant.acceptedAt ?? new Date(),
        removedAt: null,
        updatedAt: new Date(),
      }).where(eq(organizationalPilotParticipants.id, participant.id));
    } else {
      await tx.insert(organizationalPilotParticipants).values({
        pilotId: pilot.id,
        userId: championUserId,
        businessMemberId: adminMembership.id,
        participantName: "Allison Pate",
        email: PREMIER_PILOT_RECONCILIATION.championEmail,
        normalizedEmail: PREMIER_PILOT_RECONCILIATION.championEmail,
        populationType: "professional",
        participantRole: "nurse",
        status: "active",
        acceptedAt: new Date(),
        createdByUserId: approvedByUserId,
      });
    }

    await tx.insert(organizationalPilotEvents).values({
      pilotId: pilot.id,
      actorUserId: approvedByUserId,
      eventType: "premier_reconciled",
      entityType: "pilot",
      entityId: pilot.id,
      metadata: {
        fixedWindow: true,
        professionalCapacity: PREMIER_PILOT_RECONCILIATION.professionalCapacity,
        clientCapacity: PREMIER_PILOT_RECONCILIATION.clientCapacity,
        participantRole: "nurse",
      },
    });
    return { business, pilot, adminMembership };
  });

  const invitationResults: Array<{ email: string; state: "active" | "pending" }> = [];
  for (const participant of PREMIER_PILOT_RECONCILIATION.participants.filter(
    (item) => item.email !== PREMIER_PILOT_RECONCILIATION.championEmail,
  )) {
    const identity = identities.find((item) => item.email === participant.email)!;
    if (identity.identity.status === "unique" || identity.identity.status === "legacy_exact") {
      const existing = (await db.select().from(businessMembers).where(and(
        eq(businessMembers.businessId, result.business.id),
        eq(businessMembers.userId, identity.identity.user.id),
      )).limit(1))[0];
      const member = existing
        ? (await db.update(businessMembers).set({ role: "nurse", status: "active", removedAt: null })
            .where(eq(businessMembers.id, existing.id)).returning())[0]
        : (await db.insert(businessMembers).values({
            businessId: result.business.id,
            userId: identity.identity.user.id,
            role: "nurse",
            status: "active",
          }).returning())[0];
      const [existingParticipant] = await db.select().from(organizationalPilotParticipants).where(and(
        eq(organizationalPilotParticipants.pilotId, result.pilot.id),
        eq(organizationalPilotParticipants.normalizedEmail, participant.email),
      )).limit(1);
      if (!existingParticipant) {
        await db.insert(organizationalPilotParticipants).values({
          pilotId: result.pilot.id,
          userId: identity.identity.user.id,
          businessMemberId: member.id,
          participantName: participant.name,
          email: participant.email,
          normalizedEmail: participant.email,
          populationType: "professional",
          participantRole: "nurse",
          status: "active",
          acceptedAt: new Date(),
          createdByUserId: approvedByUserId,
        });
      }
      invitationResults.push({ email: participant.email, state: "active" });
      continue;
    }

    const [existingInvitation] = await db.select({ id: businessInvitations.id }).from(businessInvitations).where(and(
      eq(businessInvitations.businessId, result.business.id),
      eq(businessInvitations.organizationalPilotId, result.pilot.id),
      eq(businessInvitations.email, participant.email),
      eq(businessInvitations.status, "pending"),
    )).limit(1);
    if (!existingInvitation) {
      await createOrganizationalPilotInvitation({
        businessId: result.business.id,
        pilotId: result.pilot.id,
        invitedByUserId: approvedByUserId,
        email: participant.email,
        populationType: "professional",
        participantRole: "nurse",
        participantName: participant.name,
        expiresAt: PREMIER_PILOT_RECONCILIATION.pilotEndAt,
      });
    }
    invitationResults.push({ email: participant.email, state: "pending" });
  }

  return {
    businessId: result.business.id,
    pilotId: result.pilot.id,
    authorizationId: authorization.id,
    championUserId,
    professionalCapacity: result.pilot.professionalCapacity,
    clientCapacity: result.pilot.clientCapacity,
    pilotStatus: result.pilot.status,
    pilotStartAt: result.pilot.pilotStartAt,
    pilotEndAt: result.pilot.pilotEndAt,
    participants: [
      { email: PREMIER_PILOT_RECONCILIATION.championEmail, role: "nurse", state: "active" as const },
      ...invitationResults.map((item) => ({ ...item, role: "nurse" as const })),
    ],
  };
}