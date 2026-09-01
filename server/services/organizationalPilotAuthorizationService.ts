import crypto from "crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { businessMembers, businesses } from "../db/schema/business";
import {
  organizationalPilotAuthorizations,
  organizationalPilotEvents,
  organizationalPilotParticipants,
  organizationalPilots,
} from "../db/schema/pilotProgram";
import { normalizeEmailIdentity, resolveEmailIdentityForUser } from "./emailIdentityService";

export class PilotAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createToken = () => crypto.randomBytes(32).toString("hex");

export async function createApprovedPilotAuthorization(input: {
  organizationName: string;
  championEmail: string;
  professionalCapacity: number;
  clientCapacity: number;
  durationDays: number;
  approvedByUserId: string;
  expiresAt?: Date;
}) {
  const organizationName = input.organizationName.trim();
  const normalizedChampionEmail = normalizeEmailIdentity(input.championEmail);
  if (organizationName.length < 2 || organizationName.length > 80) {
    throw new PilotAuthorizationError("Organization name must be between 2 and 80 characters.", "INVALID_ORGANIZATION_NAME");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedChampionEmail)) {
    throw new PilotAuthorizationError("A valid Champion email is required.", "INVALID_EMAIL");
  }
  if (!Number.isInteger(input.professionalCapacity) || input.professionalCapacity < 1 || input.professionalCapacity > 1000) {
    throw new PilotAuthorizationError("Professional capacity must be between 1 and 1000.", "INVALID_PROFESSIONAL_CAPACITY");
  }
  if (!Number.isInteger(input.clientCapacity) || input.clientCapacity < 0 || input.clientCapacity > 100000) {
    throw new PilotAuthorizationError("Client capacity must be between 0 and 100000.", "INVALID_CLIENT_CAPACITY");
  }
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1 || input.durationDays > 365) {
    throw new PilotAuthorizationError("Pilot duration must be between 1 and 365 days.", "INVALID_DURATION");
  }

  const rawToken = createToken();
  const claimTokenHash = hashToken(rawToken);
  const claimTokenExpiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const authorization = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedChampionEmail}))`);
    const [existing] = await tx.select({ id: organizationalPilotAuthorizations.id })
      .from(organizationalPilotAuthorizations)
      .where(and(
        eq(organizationalPilotAuthorizations.normalizedChampionEmail, normalizedChampionEmail),
        inArray(organizationalPilotAuthorizations.status, ["approved", "claimed"]),
      ))
      .limit(1);
    if (existing) {
      throw new PilotAuthorizationError("This Champion already has an active organizational authorization.", "AUTHORIZATION_ALREADY_EXISTS", 409);
    }
    const [created] = await tx.insert(organizationalPilotAuthorizations).values({
      organizationName,
      championEmail: normalizedChampionEmail,
      normalizedChampionEmail,
      status: "approved",
      professionalCapacity: input.professionalCapacity,
      clientCapacity: input.clientCapacity,
      durationDays: input.durationDays,
      claimTokenHash,
      claimTokenExpiresAt,
      approvedAt: new Date(),
      approvedByUserId: input.approvedByUserId,
      createdByUserId: input.approvedByUserId,
    }).returning();
    return created;
  });

  return { authorization, rawToken };
}

export async function inspectPilotAuthorizationToken(rawToken: string) {
  const [authorization] = await db.select({
    id: organizationalPilotAuthorizations.id,
    organizationName: organizationalPilotAuthorizations.organizationName,
    championEmail: organizationalPilotAuthorizations.championEmail,
    status: organizationalPilotAuthorizations.status,
    professionalCapacity: organizationalPilotAuthorizations.professionalCapacity,
    clientCapacity: organizationalPilotAuthorizations.clientCapacity,
    durationDays: organizationalPilotAuthorizations.durationDays,
    claimTokenExpiresAt: organizationalPilotAuthorizations.claimTokenExpiresAt,
  }).from(organizationalPilotAuthorizations).where(
    eq(organizationalPilotAuthorizations.claimTokenHash, hashToken(rawToken)),
  ).limit(1);
  return authorization ?? null;
}

async function resolveAuthorizationForClaim(
  tx: any,
  input: { rawToken?: string; authorizationId?: string },
) {
  if (!input.rawToken && !input.authorizationId) {
    throw new PilotAuthorizationError("Authorization token or ID is required.", "AUTHORIZATION_REQUIRED");
  }
  const condition = input.rawToken
    ? eq(organizationalPilotAuthorizations.claimTokenHash, hashToken(input.rawToken))
    : eq(organizationalPilotAuthorizations.id, input.authorizationId!);
  const [authorization] = await tx.select().from(organizationalPilotAuthorizations)
    .where(condition).limit(1);
  if (!authorization) {
    throw new PilotAuthorizationError("Organizational authorization not found.", "AUTHORIZATION_NOT_FOUND", 404);
  }
  return authorization;
}

export async function claimPilotAuthorization(input: {
  userId: string;
  rawToken?: string;
  authorizationId?: string;
}) {
  const identity = await resolveEmailIdentityForUser(input.userId);
  if (identity.status !== "unique") {
    throw new PilotAuthorizationError("A unique account email is required to claim this authorization.", "EMAIL_IDENTITY_REVIEW_REQUIRED", 409);
  }
  const normalizedUserEmail = normalizeEmailIdentity(identity.user.email);

  return db.transaction(async (tx) => {
    const authorization = await resolveAuthorizationForClaim(tx, input);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${authorization.id}))`);
    const [locked] = await tx.select().from(organizationalPilotAuthorizations)
      .where(eq(organizationalPilotAuthorizations.id, authorization.id)).limit(1);
    if (!locked) throw new PilotAuthorizationError("Authorization not found.", "AUTHORIZATION_NOT_FOUND", 404);

    if (locked.normalizedChampionEmail !== normalizedUserEmail) {
      throw new PilotAuthorizationError("This authorization was issued to a different account.", "EMAIL_MISMATCH", 403);
    }
    if (locked.status === "claimed") {
      if (locked.claimedByUserId !== input.userId) {
        throw new PilotAuthorizationError("This authorization has already been claimed.", "AUTHORIZATION_ALREADY_CLAIMED", 409);
      }
      const [existingPilot] = await tx.select().from(organizationalPilots)
        .where(eq(organizationalPilots.authorizationId, locked.id)).limit(1);
      const [existingBusiness] = locked.businessId
        ? await tx.select().from(businesses).where(eq(businesses.id, locked.businessId)).limit(1)
        : [];
      return { authorization: locked, pilot: existingPilot, business: existingBusiness, alreadyClaimed: true };
    }
    if (locked.status !== "approved") {
      throw new PilotAuthorizationError("This authorization is not available for claim.", "AUTHORIZATION_NOT_APPROVED", 410);
    }
    if (locked.claimTokenExpiresAt && locked.claimTokenExpiresAt <= new Date()) {
      await tx.update(organizationalPilotAuthorizations).set({ status: "expired", updatedAt: new Date() })
        .where(eq(organizationalPilotAuthorizations.id, locked.id));
      throw new PilotAuthorizationError("This authorization has expired.", "AUTHORIZATION_EXPIRED", 410);
    }

    let business = locked.businessId
      ? (await tx.select().from(businesses).where(eq(businesses.id, locked.businessId)).limit(1))[0]
      : null;
    if (!business) {
      const [owned] = await tx.select().from(businesses)
        .where(eq(businesses.ownerUserId, input.userId)).limit(1);
      if (owned) {
        throw new PilotAuthorizationError(
          "This account already owns a different organization. An administrator must associate the authorization explicitly.",
          "BUSINESS_OWNERSHIP_CONFLICT",
          409,
        );
      }
      [business] = await tx.insert(businesses).values({
        name: locked.organizationName,
        ownerUserId: input.userId,
        plan: "organizational_pilot",
        seatLimit: locked.professionalCapacity,
        clientCapacity: locked.clientCapacity,
        status: "active",
      }).returning();
    }

    const [existingMembership] = await tx.select().from(businessMembers).where(and(
      eq(businessMembers.businessId, business.id),
      eq(businessMembers.userId, input.userId),
    )).limit(1);
    const [membership] = existingMembership
      ? await tx.update(businessMembers).set({ role: "admin", status: "active", removedAt: null, joinedAt: new Date() })
          .where(eq(businessMembers.id, existingMembership.id)).returning()
      : await tx.insert(businessMembers).values({
          businessId: business.id,
          userId: input.userId,
          role: "admin",
          status: "active",
        }).returning();

    let [pilot] = await tx.select().from(organizationalPilots)
      .where(eq(organizationalPilots.authorizationId, locked.id)).limit(1);
    if (!pilot) {
      [pilot] = await tx.insert(organizationalPilots).values({
        businessId: business.id,
        authorizationId: locked.id,
        name: `${locked.organizationName} ${locked.durationDays}-Day Pilot`,
        status: "preparing",
        professionalCapacity: locked.professionalCapacity,
        clientCapacity: locked.clientCapacity,
        durationDays: locked.durationDays,
        championBusinessMemberId: membership.id,
        pilotStartAt: null,
        pilotEndAt: null,
        createdByUserId: input.userId,
      }).returning();
    }

    const [existingParticipant] = await tx.select().from(organizationalPilotParticipants).where(and(
      eq(organizationalPilotParticipants.pilotId, pilot.id),
      eq(organizationalPilotParticipants.normalizedEmail, normalizedUserEmail),
    )).limit(1);
    if (existingParticipant) {
      await tx.update(organizationalPilotParticipants).set({
        userId: input.userId,
        businessMemberId: membership.id,
        participantRole: "champion",
        populationType: "professional",
        status: "active",
        acceptedAt: existingParticipant.acceptedAt ?? new Date(),
        removedAt: null,
        updatedAt: new Date(),
      }).where(eq(organizationalPilotParticipants.id, existingParticipant.id));
    } else {
      await tx.insert(organizationalPilotParticipants).values({
        pilotId: pilot.id,
        userId: input.userId,
        businessMemberId: membership.id,
        email: identity.user.email,
        normalizedEmail: normalizedUserEmail,
        populationType: "professional",
        participantRole: "champion",
        status: "active",
        acceptedAt: new Date(),
        createdByUserId: input.userId,
      });
    }

    const [claimed] = await tx.update(organizationalPilotAuthorizations).set({
      status: "claimed",
      businessId: business.id,
      claimedAt: new Date(),
      claimedByUserId: input.userId,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationalPilotAuthorizations.id, locked.id),
      eq(organizationalPilotAuthorizations.status, "approved"),
    )).returning();
    if (!claimed) throw new PilotAuthorizationError("Authorization was claimed by another request.", "CLAIM_RACE", 409);

    await tx.insert(organizationalPilotEvents).values({
      pilotId: pilot.id,
      actorUserId: input.userId,
      eventType: "champion_authorization_claimed",
      entityType: "authorization",
      entityId: claimed.id,
      metadata: { businessId: business.id, pilotStatus: pilot.status },
    });

    return { authorization: claimed, business, pilot, membership, alreadyClaimed: false };
  });
}

export async function getOrganizationWorkspaceOptions(userId: string) {
  const identity = await resolveEmailIdentityForUser(userId);
  if (identity.status !== "unique") return [];
  const normalizedEmail = normalizeEmailIdentity(identity.user.email);

  const pending = await db.select({
    authorizationId: organizationalPilotAuthorizations.id,
    organizationName: organizationalPilotAuthorizations.organizationName,
    status: organizationalPilotAuthorizations.status,
    expiresAt: organizationalPilotAuthorizations.claimTokenExpiresAt,
  }).from(organizationalPilotAuthorizations).where(and(
    eq(organizationalPilotAuthorizations.normalizedChampionEmail, normalizedEmail),
    eq(organizationalPilotAuthorizations.status, "approved"),
    or(
      sql`${organizationalPilotAuthorizations.claimTokenExpiresAt} IS NULL`,
      sql`${organizationalPilotAuthorizations.claimTokenExpiresAt} > now()`,
    ),
  ));

  const memberships = await db.select({
    businessId: businesses.id,
    organizationName: businesses.name,
    membershipRole: businessMembers.role,
    pilotStatus: organizationalPilots.status,
  }).from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .leftJoin(organizationalPilots, eq(organizationalPilots.businessId, businesses.id))
    .where(and(
      eq(businessMembers.userId, userId),
      eq(businessMembers.status, "active"),
      inArray(businessMembers.role, ["owner", "admin"]),
    ));

  return [
    ...pending.map((row) => ({ ...row, businessId: null, action: "setup" as const })),
    ...memberships.map((row) => ({
      authorizationId: null,
      businessId: row.businessId,
      organizationName: row.organizationName,
      status: row.pilotStatus ?? "business",
      action: "open" as const,
    })),
  ];
}

export async function getClaimedChampionSetup(userId: string) {
  const [row] = await db.select({
    authorizationId: organizationalPilotAuthorizations.id,
    organizationName: businesses.name,
    businessId: businesses.id,
    pilotId: organizationalPilots.id,
    pilotStatus: organizationalPilots.status,
    professionalCapacity: organizationalPilotAuthorizations.professionalCapacity,
    clientCapacity: organizationalPilotAuthorizations.clientCapacity,
    durationDays: organizationalPilotAuthorizations.durationDays,
    pilotStartAt: organizationalPilots.pilotStartAt,
    pilotEndAt: organizationalPilots.pilotEndAt,
  }).from(organizationalPilotAuthorizations)
    .innerJoin(businesses, eq(businesses.id, organizationalPilotAuthorizations.businessId))
    .innerJoin(organizationalPilots, eq(organizationalPilots.authorizationId, organizationalPilotAuthorizations.id))
    .where(and(
      eq(organizationalPilotAuthorizations.claimedByUserId, userId),
      eq(organizationalPilotAuthorizations.status, "claimed"),
    )).limit(1);
  if (!row) throw new PilotAuthorizationError("No claimed Champion authorization found.", "CHAMPION_AUTHORIZATION_NOT_FOUND", 404);
  return row;
}

export async function updateClaimedChampionSetup(userId: string, name: string) {
  const setup = await getClaimedChampionSetup(userId);
  const normalizedName = name.trim();
  if (normalizedName.length < 2 || normalizedName.length > 80) {
    throw new PilotAuthorizationError("Organization name must be between 2 and 80 characters.", "INVALID_ORGANIZATION_NAME");
  }
  await db.update(businesses).set({ name: normalizedName, updatedAt: new Date() })
    .where(eq(businesses.id, setup.businessId));
  return { ...setup, organizationName: normalizedName };
}