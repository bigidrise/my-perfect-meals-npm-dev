import crypto from "crypto";
import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { businesses } from "../db/schema/business";
import { users } from "@shared/schema";
import { clinicPilotEnrollmentLinks, clinicTrialEntitlements, organizationalPilotEvents, organizationalPilotParticipants, organizationalPilots } from "../db/schema/pilotProgram";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");
export function clinicTrialEnd(start: Date): Date {
  return new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
}

export async function createClinicPilotEnrollmentLink(input: { businessId: string; pilotId: string; actorUserId: string; capacity?: number; expiresAt?: Date | null }) {
  const capacity = input.capacity ?? 100;
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("INVALID_CAPACITY");
  const rawToken = newToken();
  const [link] = await db.transaction(async (tx) => {
    const [business] = await tx.select({ organizationId: businesses.organizationId, status: businesses.status }).from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
    const [pilot] = await tx.select().from(organizationalPilots).where(and(eq(organizationalPilots.id, input.pilotId), eq(organizationalPilots.businessId, input.businessId), eq(organizationalPilots.status, "active"))).limit(1);
    const now = new Date();
    if (!business || business.status !== "active") throw new Error("BUSINESS_INACTIVE");
    if (!pilot || !pilot.pilotStartAt || !pilot.pilotEndAt || pilot.pilotStartAt > now || pilot.pilotEndAt <= now) throw new Error("PILOT_ENROLLMENT_CLOSED");
    const [created] = await tx.insert(clinicPilotEnrollmentLinks).values({ businessId: input.businessId, pilotId: input.pilotId, organizationId: business.organizationId ?? null, tokenHash: hashToken(rawToken), capacity, expiresAt: input.expiresAt ?? null, createdByUserId: input.actorUserId }).returning();
    await tx.insert(organizationalPilotEvents).values({ pilotId: input.pilotId, actorUserId: input.actorUserId, eventType: "clinic_link_created", entityType: "clinic_enrollment_link", entityId: created.id, metadata: { capacity } });
    return [created];
  });
  return { link, rawToken };
}

export async function inspectClinicPilotEnrollmentLink(rawToken: string) {
  const [link] = await db.select({ id: clinicPilotEnrollmentLinks.id, pilotId: clinicPilotEnrollmentLinks.pilotId, businessId: clinicPilotEnrollmentLinks.businessId, status: clinicPilotEnrollmentLinks.status, expiresAt: clinicPilotEnrollmentLinks.expiresAt, capacity: clinicPilotEnrollmentLinks.capacity, pilotName: organizationalPilots.name, pilotStatus: organizationalPilots.status, pilotStartAt: organizationalPilots.pilotStartAt, pilotEndAt: organizationalPilots.pilotEndAt, businessStatus: businesses.status }).from(clinicPilotEnrollmentLinks).innerJoin(organizationalPilots, eq(organizationalPilots.id, clinicPilotEnrollmentLinks.pilotId)).innerJoin(businesses, eq(businesses.id, clinicPilotEnrollmentLinks.businessId)).where(eq(clinicPilotEnrollmentLinks.tokenHash, hashToken(rawToken))).limit(1);
  if (!link) return null;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(clinicTrialEntitlements).where(eq(clinicTrialEntitlements.linkId, link.id));
  const now = new Date();
  return { ...link, enrolledCount: Number(count ?? 0), available: link.status === "active" && link.businessStatus === "active" && link.pilotStatus === "active" && !!link.pilotStartAt && !!link.pilotEndAt && link.pilotStartAt <= now && link.pilotEndAt > now && (!link.expiresAt || link.expiresAt > now) && Number(count ?? 0) < link.capacity };
}

export async function enrollClinicPatient(rawToken: string, userId: string) {
  return db.transaction((tx) => enrollClinicPatientInTransaction(tx, rawToken, userId));
}

export async function enrollClinicPatientInTransaction(tx: any, rawToken: string, userId: string) {
  const tokenHash = hashToken(rawToken);
  return (async () => {
    const [link] = await tx.select().from(clinicPilotEnrollmentLinks).where(eq(clinicPilotEnrollmentLinks.tokenHash, tokenHash)).limit(1);
    if (!link) throw new Error("LINK_NOT_FOUND");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${link.pilotId}))`);
    const [existing] = await tx.select().from(clinicTrialEntitlements).where(and(eq(clinicTrialEntitlements.userId, userId), eq(clinicTrialEntitlements.pilotId, link.pilotId))).limit(1);
    if (existing) return { entitlement: existing, alreadyEnrolled: true };
    const [business] = await tx.select({ status: businesses.status }).from(businesses).where(eq(businesses.id, link.businessId)).limit(1);
    const [pilot] = await tx.select().from(organizationalPilots).where(and(eq(organizationalPilots.id, link.pilotId), eq(organizationalPilots.status, "active"))).limit(1);
    const now = new Date();
    if (!business || business.status !== "active") throw new Error("BUSINESS_INACTIVE");
    if (!pilot || !pilot.pilotStartAt || !pilot.pilotEndAt || pilot.pilotStartAt > now || pilot.pilotEndAt <= now) throw new Error("PILOT_ENROLLMENT_CLOSED");
    if (link.status !== "active") throw new Error("LINK_REVOKED");
    if (link.expiresAt && link.expiresAt <= now) throw new Error("LINK_EXPIRED");
    const [{ linkCount }] = await tx.select({ linkCount: sql<number>`count(*)::int` }).from(clinicTrialEntitlements).where(eq(clinicTrialEntitlements.linkId, link.id));
    if (Number(linkCount ?? 0) >= link.capacity) throw new Error("LINK_CAPACITY");
    const [{ pilotCount }] = await tx.select({ pilotCount: sql<number>`count(*)::int` }).from(organizationalPilotParticipants).where(and(eq(organizationalPilotParticipants.pilotId, link.pilotId), eq(organizationalPilotParticipants.populationType, "client"), inArray(organizationalPilotParticipants.status, ["pending", "active"])));
    if (Number(pilotCount ?? 0) >= pilot.clientCapacity) throw new Error("PILOT_CLIENT_CAPACITY");
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("USER_NOT_FOUND");
    let [participant] = await tx.select().from(organizationalPilotParticipants).where(and(eq(organizationalPilotParticipants.pilotId, link.pilotId), eq(organizationalPilotParticipants.userId, userId))).limit(1);
    if (!participant) [participant] = await tx.insert(organizationalPilotParticipants).values({ pilotId: link.pilotId, userId, email: user.email, normalizedEmail: user.email.toLowerCase(), populationType: "client", participantRole: "client", status: "active", acceptedAt: now, createdByUserId: userId }).returning();
    const startsAt = now;
    const endsAt = clinicTrialEnd(startsAt);
    const [entitlement] = await tx.insert(clinicTrialEntitlements).values({ userId, pilotId: link.pilotId, linkId: link.id, businessId: link.businessId, organizationId: link.organizationId, participantId: participant.id, status: "active", provenance: "clinical_trial", startsAt, endsAt }).returning();
    if (link.organizationId) await tx.update(users).set({ attributionOrganizationId: link.organizationId }).where(and(eq(users.id, userId), isNull(users.attributionOrganizationId)));
    await tx.insert(organizationalPilotEvents).values({ pilotId: link.pilotId, actorUserId: userId, eventType: "clinic_link_used", entityType: "clinic_trial_entitlement", entityId: entitlement.id, metadata: { linkId: link.id } });
    return { entitlement, alreadyEnrolled: false };
  })();
}

export async function revokeClinicPilotEnrollmentLink(linkId: string, actorUserId: string, reason?: string) {
  const [link] = await db.update(clinicPilotEnrollmentLinks).set({ status: "revoked", revokedAt: new Date(), revokedByUserId: actorUserId, revokeReason: reason ?? null, updatedAt: new Date() }).where(and(eq(clinicPilotEnrollmentLinks.id, linkId), eq(clinicPilotEnrollmentLinks.status, "active"))).returning();
  if (link) await db.insert(organizationalPilotEvents).values({ pilotId: link.pilotId, actorUserId, eventType: "clinic_link_revoked", entityType: "clinic_enrollment_link", entityId: link.id, metadata: { reasonProvided: Boolean(reason) } });
  return Boolean(link);
}

export async function getActiveClinicTrialEntitlement(userId: string, now = new Date()) {
  const [row] = await db.select().from(clinicTrialEntitlements).where(and(eq(clinicTrialEntitlements.userId, userId), eq(clinicTrialEntitlements.status, "active"), lte(clinicTrialEntitlements.startsAt, now), gt(clinicTrialEntitlements.endsAt, now))).limit(1);
  return row ?? null;
}