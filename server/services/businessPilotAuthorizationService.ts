import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { organizations } from "../db/schema/organizations";
import { organizationMemberships } from "../db/schema/workspaces";
import { businesses } from "../db/schema/business";
import {
  businessPilotAuthorizations,
  type BusinessPilotAuthorization,
  type BusinessPilotDurationPolicy,
} from "../db/schema/businessPilotAuthorization";
import { normalizeEmailIdentity } from "./emailIdentityService";

export class BusinessPilotAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function normalizedEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new BusinessPilotAuthorizationError("A valid authorized email is required.", "INVALID_EMAIL");
  }
  const value = normalizeEmailIdentity(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new BusinessPilotAuthorizationError("A valid authorized email is required.", "INVALID_EMAIL");
  }
  return value;
}

function dateOrNull(value: unknown, name: string): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new BusinessPilotAuthorizationError(`${name} must be a valid date.`, "INVALID_DATE");
  }
  return date;
}

function validateWindow(startsAt: Date | null, expiresAt: Date | null) {
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw new BusinessPilotAuthorizationError("expiresAt must be after startsAt.", "INVALID_WINDOW");
  }
}

const DAY_MS = 86400000;

function normalizedDurationDays(value: unknown, fallback = 30): number {
  const days = Number(value ?? fallback);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new BusinessPilotAuthorizationError("durationDays must be between 1 and 3650.", "INVALID_DURATION");
  }
  return days;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function durationBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  return Boolean(left && right && left.getTime() === right.getTime());
}

function lockKey(value: string) {
  return sql`SELECT pg_advisory_xact_lock(hashtext(${value}))`;
}

export async function createBusinessPilotAuthorization(input: {
  authorizedEmail: string;
  createdByUserId: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  durationPolicy?: BusinessPilotDurationPolicy;
  durationDays?: number;
  notes?: string | null;
  internalMetadata?: Record<string, unknown> | null;
}): Promise<BusinessPilotAuthorization> {
  const email = normalizedEmail(input.authorizedEmail);
  const startsAt = dateOrNull(input.startsAt, "startsAt");
  const durationPolicy = input.durationPolicy ?? "fixed";
  if (!["fixed", "indefinite", "custom"].includes(durationPolicy)) {
    throw new BusinessPilotAuthorizationError("Invalid duration policy.", "INVALID_DURATION_POLICY");
  }
  const requestedExpiresAt = dateOrNull(input.expiresAt, "expiresAt");
  const storedDurationDays = durationPolicy === "indefinite"
    ? null
    : normalizedDurationDays(input.durationDays);
  if (durationPolicy === "indefinite" && requestedExpiresAt) {
    throw new BusinessPilotAuthorizationError("Indefinite authorizations cannot expire.", "INVALID_DURATION_POLICY");
  }
  // An authorization is not a commercial clock. With no explicit dates it
  // carries only an intended duration until the claimed user creates a
  // canonical organization.
  const expiresAt = requestedExpiresAt ?? (
    startsAt && durationPolicy !== "indefinite"
      ? addDays(startsAt, storedDurationDays!)
      : null
  );
  validateWindow(startsAt, expiresAt);
  if (input.notes != null && input.notes.length > 10000) {
    throw new BusinessPilotAuthorizationError("notes is too long.", "INVALID_NOTES");
  }

  return db.transaction(async (tx) => {
    await tx.execute(lockKey(email));
    const [created] = await tx.insert(businessPilotAuthorizations).values({
      authorizedEmail: input.authorizedEmail.trim(),
      normalizedAuthorizedEmail: email,
      status: "pending",
      createdByUserId: input.createdByUserId,
      startsAt,
      expiresAt,
      durationPolicy,
      durationDays: storedDurationDays,
      accessProvenance: "business_pilot",
      notes: input.notes?.trim() || null,
      internalMetadata: input.internalMetadata ?? null,
    }).returning();
    return created;
  }).catch((error: any) => {
    if (error?.code === "23505") {
      throw new BusinessPilotAuthorizationError(
        "An open Business Pilot authorization already exists for this email.",
        "OPEN_AUTHORIZATION_EXISTS",
        409,
      );
    }
    throw error;
  });
}

export async function listBusinessPilotAuthorizations() {
  return db.select().from(businessPilotAuthorizations)
    .orderBy(desc(businessPilotAuthorizations.createdAt));
}

export async function findOpenBusinessPilotAuthorizationByEmail(email: string) {
  const normalized = normalizedEmail(email);
  const [authorization] = await db.select().from(businessPilotAuthorizations).where(and(
    eq(businessPilotAuthorizations.normalizedAuthorizedEmail, normalized),
    inArray(businessPilotAuthorizations.status, ["pending", "active"]),
    or(sql`${businessPilotAuthorizations.expiresAt} IS NULL`, sql`${businessPilotAuthorizations.expiresAt} > now()`),
  )).orderBy(desc(businessPilotAuthorizations.createdAt)).limit(1);
  return authorization ?? null;
}

export async function findClaimedBusinessPilotAuthorizationForUser(userId: string) {
  const now = new Date();
  const [authorization] = await db.select().from(businessPilotAuthorizations).where(and(
    eq(businessPilotAuthorizations.claimedUserId, userId),
    eq(businessPilotAuthorizations.status, "active"),
    or(sql`${businessPilotAuthorizations.expiresAt} IS NULL`, sql`${businessPilotAuthorizations.expiresAt} > ${now}`),
  )).orderBy(desc(businessPilotAuthorizations.claimedAt)).limit(1);
  return authorization ?? null;
}

export async function extendBusinessPilotAuthorization(input: {
  authorizationId: string;
  actorUserId: string;
  expiresAt?: Date | string | null;
  durationDays?: number;
  durationPolicy?: BusinessPilotDurationPolicy;
}) {
  const requestedExpiresAt = dateOrNull(input.expiresAt, "expiresAt");
  return db.transaction(async (tx) => {
    await tx.execute(lockKey(input.authorizationId));
    const [current] = await tx.select().from(businessPilotAuthorizations)
      .where(eq(businessPilotAuthorizations.id, input.authorizationId)).limit(1);
    if (!current) throw new BusinessPilotAuthorizationError("Authorization not found.", "AUTHORIZATION_NOT_FOUND", 404);
    if (!["pending", "active"].includes(current.status)) {
      throw new BusinessPilotAuthorizationError("Only open authorizations can be extended.", "AUTHORIZATION_NOT_EXTENDABLE", 409);
    }
    const policy = input.durationPolicy ?? current.durationPolicy;
    if (!["fixed", "indefinite", "custom"].includes(policy)) {
      throw new BusinessPilotAuthorizationError("Invalid duration policy.", "INVALID_DURATION_POLICY");
    }
    if (input.durationDays != null) normalizedDurationDays(input.durationDays, 1);

    let nextStartsAt = current.startsAt;
    let nextExpiresAt = policy === "indefinite" ? null : requestedExpiresAt ?? current.expiresAt;
    let nextDurationDays = policy === "indefinite" ? null : current.durationDays ?? 30;
    const linkedBusiness = current.organizationId
      ? (await tx.select().from(businesses)
          .where(eq(businesses.organizationId, current.organizationId))
          .limit(1))[0]
      : null;

    if (current.organizationId) {
      if (!linkedBusiness) {
        throw new BusinessPilotAuthorizationError("Attached organization business not found.", "BUSINESS_ORGANIZATION_MISMATCH", 409);
      }
      if (linkedBusiness.commercialAccessMode === "paid" || linkedBusiness.stripeCustomerId || linkedBusiness.stripeSubscriptionId) {
        throw new BusinessPilotAuthorizationError("Paid or Stripe-backed organizations cannot be extended as a Business Pilot.", "COMMERCIAL_CLOCK_CONFLICT", 409);
      }
      if (policy === "indefinite") {
        nextStartsAt = linkedBusiness.commercialAccessStartedAt ?? current.startsAt ?? new Date();
        nextExpiresAt = null;
        nextDurationDays = null;
      } else if (requestedExpiresAt) {
        nextStartsAt = linkedBusiness.commercialAccessStartedAt ?? current.startsAt ?? new Date();
        nextExpiresAt = requestedExpiresAt;
        nextDurationDays = durationBetween(nextStartsAt, nextExpiresAt);
      } else if (input.durationDays != null) {
        nextStartsAt = linkedBusiness.commercialAccessStartedAt ?? current.startsAt ?? new Date();
        const baseEnd = linkedBusiness.commercialAccessEndsAt ?? new Date();
        const now = new Date();
        nextExpiresAt = addDays(baseEnd > now ? baseEnd : now, normalizedDurationDays(input.durationDays, 1));
        nextDurationDays = durationBetween(nextStartsAt, nextExpiresAt);
      } else {
        nextStartsAt = linkedBusiness.commercialAccessStartedAt ?? current.startsAt;
        nextExpiresAt = linkedBusiness.commercialAccessEndsAt ?? nextExpiresAt;
        nextDurationDays = nextExpiresAt && nextStartsAt ? durationBetween(nextStartsAt, nextExpiresAt) : nextDurationDays;
      }

      validateWindow(nextStartsAt, nextExpiresAt);
      const [updatedBusiness] = await tx.update(businesses).set({
        commercialAccessMode: policy === "indefinite" ? "authorized_arrangement" : "onboarding_pilot",
        commercialAccessStartedAt: nextStartsAt,
        commercialAccessEndsAt: policy === "indefinite" ? null : nextExpiresAt,
        updatedAt: new Date(),
      }).where(eq(businesses.id, linkedBusiness.id)).returning();
      if (!updatedBusiness) throw new BusinessPilotAuthorizationError("Organization commercial clock changed before extension.", "EXTENSION_RACE", 409);
    } else if (input.durationDays != null) {
      // Before association durationDays is only intended policy. It must not
      // start a clock; if explicit dates exist, add to the intended expiry.
      const days = normalizedDurationDays(input.durationDays, 1);
      if (policy === "indefinite") {
        nextStartsAt = null;
        nextExpiresAt = null;
        nextDurationDays = null;
      } else if (current.expiresAt) {
        nextExpiresAt = addDays(current.expiresAt, days);
        nextDurationDays = durationBetween(current.startsAt ?? new Date(), nextExpiresAt);
      } else {
        nextStartsAt = null;
        nextExpiresAt = null;
        nextDurationDays = (current.durationDays ?? 30) + days;
      }
    } else if (policy === "indefinite") {
      nextStartsAt = null;
      nextExpiresAt = null;
      nextDurationDays = null;
    } else if (requestedExpiresAt) {
      nextDurationDays = null;
    }
    validateWindow(nextStartsAt, nextExpiresAt);
    const [updated] = await tx.update(businessPilotAuthorizations).set({
      startsAt: nextStartsAt,
      expiresAt: nextExpiresAt,
      durationPolicy: policy,
      durationDays: nextDurationDays,
      updatedAt: new Date(),
    }).where(and(
      eq(businessPilotAuthorizations.id, input.authorizationId),
      inArray(businessPilotAuthorizations.status, ["pending", "active"]),
    )).returning();
    if (!updated) throw new BusinessPilotAuthorizationError("Authorization changed before it could be extended.", "EXTENSION_RACE", 409);
    return updated;
  });
}

export async function revokeBusinessPilotAuthorization(input: {
  authorizationId: string;
  actorUserId: string;
  reason?: string | null;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(lockKey(input.authorizationId));
    const [current] = await tx.select().from(businessPilotAuthorizations)
      .where(eq(businessPilotAuthorizations.id, input.authorizationId)).limit(1);
    if (!current) throw new BusinessPilotAuthorizationError("Authorization not found.", "AUTHORIZATION_NOT_FOUND", 404);
    const [revoked] = await tx.update(businessPilotAuthorizations).set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: input.actorUserId,
      revokeReason: input.reason?.trim() || "Revoked by administrator",
      updatedAt: new Date(),
    }).where(and(
      eq(businessPilotAuthorizations.id, input.authorizationId),
      inArray(businessPilotAuthorizations.status, ["pending", "active"]),
    )).returning();
    if (!revoked) {
      throw new BusinessPilotAuthorizationError("Authorization is no longer open.", "AUTHORIZATION_NOT_REVOCABLE", 409);
    }
    if (current.organizationId) {
      const [business] = await tx.select().from(businesses)
        .where(eq(businesses.organizationId, current.organizationId)).limit(1);
      const isMatchingIndefinitePilot =
        business?.commercialAccessMode === "authorized_arrangement"
        && sameInstant(business.commercialAccessStartedAt, current.startsAt)
        && !current.expiresAt;
      if (
        business
        && (business.commercialAccessMode === "onboarding_pilot" || isMatchingIndefinitePilot)
        && !business.stripeCustomerId
        && !business.stripeSubscriptionId
      ) {
        await tx.update(businesses).set({
          commercialAccessMode: "onboarding_pilot",
          commercialAccessEndsAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(businesses.id, business.id));
      }
    }
    return revoked;
  });
}

/**
 * Called from the signup transaction after the user row exists. It only binds
 * the user to an authorization; it never creates an organization or membership.
 */
export async function claimBusinessPilotAuthorizationInTransaction(
  tx: any,
  input: { userId: string; email: string },
) {
  const email = normalizedEmail(input.email);
  await tx.execute(lockKey(email));
  const [authorization] = await tx.select().from(businessPilotAuthorizations)
    .where(eq(businessPilotAuthorizations.normalizedAuthorizedEmail, email))
    .orderBy(desc(businessPilotAuthorizations.createdAt))
    .limit(1);
  if (!authorization) {
    throw new BusinessPilotAuthorizationError(
      "No Business Pilot authorization matches this email.",
      "AUTHORIZATION_EMAIL_MISMATCH",
      403,
    );
  }
  if (authorization.claimedUserId) {
    throw new BusinessPilotAuthorizationError(
      authorization.claimedUserId === input.userId
        ? "This Business Pilot authorization has already been claimed."
        : "This Business Pilot authorization has already been claimed by another account.",
      "AUTHORIZATION_ALREADY_CLAIMED",
      409,
    );
  }
  if (authorization.status === "revoked") {
    throw new BusinessPilotAuthorizationError("This Business Pilot authorization has been revoked.", "AUTHORIZATION_REVOKED", 410);
  }
  if (authorization.status === "expired" || (authorization.expiresAt && authorization.expiresAt <= new Date())) {
    if (authorization.status !== "expired") {
      await tx.update(businessPilotAuthorizations).set({ status: "expired", updatedAt: new Date() })
        .where(eq(businessPilotAuthorizations.id, authorization.id));
    }
    throw new BusinessPilotAuthorizationError("This Business Pilot authorization has expired.", "AUTHORIZATION_EXPIRED", 410);
  }
  if (!["pending", "active"].includes(authorization.status)) {
    throw new BusinessPilotAuthorizationError("This Business Pilot authorization is not available.", "AUTHORIZATION_NOT_AVAILABLE", 410);
  }
  const [claimed] = await tx.update(businessPilotAuthorizations).set({
    claimedUserId: input.userId,
    claimedAt: new Date(),
    status: "active",
    updatedAt: new Date(),
  }).where(and(
    eq(businessPilotAuthorizations.id, authorization.id),
    inArray(businessPilotAuthorizations.status, ["pending", "active"]),
  )).returning();
  if (!claimed) throw new BusinessPilotAuthorizationError("Authorization claim raced with another request.", "CLAIM_RACE", 409);
  return claimed;
}

/**
 * Bind a claimed authorization to the canonical tenant only after checking
 * the claimed user is already an active owner/admin of that exact tenant.
 * This never creates membership and never writes users.organization_id.
 */
export async function attachClaimedBusinessPilotAuthorizationToOrganization(input: {
  authorizationId: string;
  claimedUserId: string;
  organizationId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(lockKey(input.authorizationId));
    const [authorization] = await tx.select().from(businessPilotAuthorizations)
      .where(eq(businessPilotAuthorizations.id, input.authorizationId)).limit(1);
    if (!authorization) {
      throw new BusinessPilotAuthorizationError("Authorization not found.", "AUTHORIZATION_NOT_FOUND", 404);
    }
    if (
      authorization.status !== "active"
      || authorization.claimedUserId !== input.claimedUserId
    ) {
      throw new BusinessPilotAuthorizationError(
        "Only the claimed user may attach this authorization.",
        "CLAIMED_USER_REQUIRED",
        403,
      );
    }
    const [organization] = await tx.select({ id: organizations.id }).from(organizations).where(and(
      eq(organizations.id, input.organizationId),
      eq(organizations.activeStatus, "active"),
    )).limit(1);
    if (!organization) {
      throw new BusinessPilotAuthorizationError("Canonical organization not found.", "ORGANIZATION_NOT_FOUND", 404);
    }
    const [membership] = await tx.select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(and(
        eq(organizationMemberships.organizationId, input.organizationId),
        eq(organizationMemberships.userId, input.claimedUserId),
        eq(organizationMemberships.status, "active"),
        inArray(organizationMemberships.role, ["owner", "admin"]),
      )).limit(1);
    if (!membership) {
      throw new BusinessPilotAuthorizationError(
        "The claimed user must be an active canonical organization owner or admin.",
        "CANONICAL_ADMIN_MEMBERSHIP_REQUIRED",
        403,
      );
    }
    if (authorization.organizationId && authorization.organizationId !== input.organizationId) {
      throw new BusinessPilotAuthorizationError(
        "Authorization is already attached to another organization.",
        "ORGANIZATION_ALREADY_ATTACHED",
        409,
      );
    }
    const [attached] = await tx.update(businessPilotAuthorizations).set({
      organizationId: input.organizationId,
      updatedAt: new Date(),
    }).where(and(
      eq(businessPilotAuthorizations.id, input.authorizationId),
      eq(businessPilotAuthorizations.claimedUserId, input.claimedUserId),
    )).returning();
    if (!attached) throw new BusinessPilotAuthorizationError("Authorization attachment raced with another request.", "ATTACHMENT_RACE", 409);
    return attached;
  });
}

/**
 * The organization owns the commercial clock. This operation is called only
 * after canonical workspace provisioning and authorization attachment.
 */
export async function activateBusinessPilotOrganizationWindow(input: {
  authorizationId: string;
  businessId: string;
  organizationId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(lockKey(input.authorizationId));
    const [authorization] = await tx.select().from(businessPilotAuthorizations)
      .where(and(
        eq(businessPilotAuthorizations.id, input.authorizationId),
        eq(businessPilotAuthorizations.organizationId, input.organizationId),
        eq(businessPilotAuthorizations.status, "active"),
      )).limit(1);
    if (!authorization) {
      throw new BusinessPilotAuthorizationError("Attached Business Pilot authorization not found.", "AUTHORIZATION_NOT_ATTACHED", 409);
    }
    const [business] = await tx.select().from(businesses).where(and(
      eq(businesses.id, input.businessId),
      eq(businesses.organizationId, input.organizationId),
    )).limit(1);
    if (!business) {
      throw new BusinessPilotAuthorizationError("Business is not linked to the canonical organization.", "BUSINESS_ORGANIZATION_MISMATCH", 409);
    }
    if (business.commercialAccessMode === "paid" || business.stripeCustomerId || business.stripeSubscriptionId) {
      throw new BusinessPilotAuthorizationError(
        "Paid or Stripe-backed organizations cannot be converted into a Business Pilot.",
        "COMMERCIAL_CLOCK_CONFLICT",
        409,
      );
    }
    const startsAt = authorization.startsAt ?? new Date();
    const endsAt = authorization.expiresAt ?? (
      authorization.durationPolicy === "indefinite"
        ? null
        : addDays(startsAt, authorization.durationDays ?? 30)
    );
    if (authorization.durationPolicy !== "indefinite" && (!endsAt || endsAt <= startsAt)) {
      throw new BusinessPilotAuthorizationError("Business Pilot authorization has an invalid commercial window.", "INVALID_WINDOW", 409);
    }
    const [updated] = await tx.update(businesses).set({
      commercialAccessMode: authorization.durationPolicy === "indefinite" ? "authorized_arrangement" : "onboarding_pilot",
      commercialAccessStartedAt: startsAt,
      commercialAccessEndsAt: authorization.durationPolicy === "indefinite" ? null : endsAt,
      updatedAt: new Date(),
    }).where(eq(businesses.id, business.id)).returning();
    await tx.update(businessPilotAuthorizations).set({
      startsAt,
      expiresAt: endsAt,
      durationDays: authorization.durationPolicy === "indefinite"
        ? null
        : durationBetween(startsAt, endsAt!),
      updatedAt: new Date(),
    }).where(eq(businessPilotAuthorizations.id, authorization.id));
    return updated;
  });
}