import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { pilotProCareGrants } from "../db/schema/pilotProcare";
import { trialAccessInvites, users } from "@shared/schema";

export type ActivePilotProCareGrant = typeof pilotProCareGrants.$inferSelect;

export async function getActivePilotProCareGrant(
  providerUserId: string,
  now = new Date(),
): Promise<ActivePilotProCareGrant | null> {
  try {
    const [grant] = await db.select().from(pilotProCareGrants).where(and(
      eq(pilotProCareGrants.providerUserId, providerUserId),
      isNull(pilotProCareGrants.revokedAt),
      lte(pilotProCareGrants.startsAt, now),
      gt(pilotProCareGrants.endsAt, now),
    )).orderBy(desc(pilotProCareGrants.createdAt)).limit(1);
    return grant ?? null;
  } catch (error) {
    console.error("[Pilot ProCare] Failed closed while resolving provider grant:", error);
    return null;
  }
}

export async function getPilotClientSponsorshipState(clientUserId: string): Promise<{
  linked: boolean;
  active: boolean;
}> {
  try {
    const [latest] = await db.select({
      providerUserId: trialAccessInvites.providerUserId,
      revokedAt: trialAccessInvites.revokedAt,
    }).from(trialAccessInvites).where(and(
      eq(trialAccessInvites.activatedUserId, clientUserId),
      sql`${trialAccessInvites.pilotGrantId} IS NOT NULL`,
    )).orderBy(desc(trialAccessInvites.invitedAt)).limit(1);
    if (!latest) return { linked: false, active: false };
    if (latest.revokedAt || !latest.providerUserId) return { linked: true, active: false };
    return {
      linked: true,
      active: Boolean(await getActivePilotProCareGrant(latest.providerUserId)),
    };
  } catch (error) {
    console.error("[Pilot ProCare] Failed closed while resolving client sponsorship:", error);
    return { linked: true, active: false };
  }
}

export async function getPilotProCareAdminStatus(providerUserId: string) {
  const grants = await db.select().from(pilotProCareGrants)
    .where(eq(pilotProCareGrants.providerUserId, providerUserId))
    .orderBy(desc(pilotProCareGrants.createdAt));
  const activeGrant = await getActivePilotProCareGrant(providerUserId);
  const clients = activeGrant
    ? await db.select().from(trialAccessInvites).where(eq(trialAccessInvites.pilotGrantId, activeGrant.id))
    : [];
  return {
    activeGrant,
    grants,
    clients,
    usedSeats: clients.filter((client) => !client.revokedAt).length,
  };
}

export async function createPilotProCareGrant(input: {
  providerUserId: string;
  grantedByUserId: string;
  startsAt: Date;
  endsAt: Date;
  seatLimit: number;
  reason: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.providerUserId}))`);
    const [overlap] = await tx.select({ id: pilotProCareGrants.id }).from(pilotProCareGrants).where(and(
      eq(pilotProCareGrants.providerUserId, input.providerUserId),
      isNull(pilotProCareGrants.revokedAt),
      lte(pilotProCareGrants.startsAt, input.endsAt),
      gt(pilotProCareGrants.endsAt, input.startsAt),
    )).limit(1);
    if (overlap) throw new Error("This provider already has an overlapping pilot grant");
    const [grant] = await tx.insert(pilotProCareGrants).values(input).returning();
    return grant;
  });
}

export async function revokePilotProCareGrant(input: {
  providerUserId: string;
  revokedByUserId: string;
  reason: string;
}) {
  const active = await getActivePilotProCareGrant(input.providerUserId);
  if (!active) throw new Error("No active pilot grant exists for this provider");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(pilotProCareGrants).set({
      revokedAt: now,
      revokedByUserId: input.revokedByUserId,
      revocationReason: input.reason,
      updatedAt: now,
    }).where(eq(pilotProCareGrants.id, active.id));
    await tx.update(trialAccessInvites).set({ revokedAt: now })
      .where(and(eq(trialAccessInvites.pilotGrantId, active.id), isNull(trialAccessInvites.revokedAt)));
  });
}

export async function grantPilotClientAccess(input: {
  providerUserId: string;
  email: string;
  durationDays: number;
  invitedByUserId: string;
  notes?: string;
}) {
  const active = await getActivePilotProCareGrant(input.providerUserId);
  if (!active) throw new Error("The provider does not have an active Pilot ProCare grant");
  const normalizedEmail = input.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${active.id}))`);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(trialAccessInvites)
      .where(and(eq(trialAccessInvites.pilotGrantId, active.id), isNull(trialAccessInvites.revokedAt)));
    if (Number(count) >= active.seatLimit) throw new Error("This pilot has reached its client seat limit");
    const [existingUser] = await tx.select({ id: users.id }).from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
    const now = new Date();
    const endsAt = new Date(Math.min(
      active.endsAt.getTime(),
      now.getTime() + input.durationDays * 86400000,
    ));
    const [invitation] = await tx.insert(trialAccessInvites).values({
      normalizedEmail,
      accessType: "client",
      durationDays: input.durationDays,
      invitedByUserId: input.invitedByUserId,
      notes: input.notes,
      pilotGrantId: active.id,
      providerUserId: input.providerUserId,
      activatedAt: existingUser ? now : null,
      activatedUserId: existingUser?.id ?? null,
    }).returning();
    if (existingUser) {
      await tx.update(users).set({
        trialStartedAt: now,
        trialEndsAt: endsAt,
        trialSource: "client_access",
        trialAccessType: "client",
      }).where(eq(users.id, existingUser.id));
      await tx.execute(sql`
        INSERT INTO trial_grants
          (user_id, granted_by, trial_source, trial_started_at, trial_ends_at, notes, pilot_grant_id, provider_user_id)
        VALUES
          (${existingUser.id}, ${input.invitedByUserId}, 'client_access', ${now}, ${endsAt}, ${input.notes ?? null}, ${active.id}, ${input.providerUserId})
      `);
    }
    return { invitation, activated: Boolean(existingUser), endsAt: existingUser ? endsAt : null };
  });
}

export async function revokePilotClientAccess(input: {
  providerUserId: string;
  invitationId: string;
}) {
  const status = await getPilotProCareAdminStatus(input.providerUserId);
  const client = status.clients.find((item) => item.id === input.invitationId);
  if (!client) throw new Error("Pilot client grant not found");
  await db.update(trialAccessInvites).set({ revokedAt: new Date() })
    .where(and(
      eq(trialAccessInvites.id, input.invitationId),
      eq(trialAccessInvites.providerUserId, input.providerUserId),
    ));
}