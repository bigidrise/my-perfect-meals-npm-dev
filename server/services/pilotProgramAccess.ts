/**
 * Organizational pilot access foundation.
 *
 * Commercial pilot access exists only when:
 *   active pilot + active participant + current time inside the shared window.
 *
 * This module deliberately does not provision users, mutate user trial fields,
 * create Stripe records, or grant care-team access.
 */
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  organizationalPilotParticipants,
  organizationalPilots,
} from "../db/schema/pilotProgram";

export type PilotPopulationType = "professional" | "client";

export interface OrganizationalPilotAccessState {
  pilotStatus: "preparing" | "active" | "completed" | "cancelled" | "revoked";
  participantStatus: "pending" | "active" | "removed" | "replaced";
  pilotStartAt: Date | null;
  pilotEndAt: Date | null;
}

export function isOrganizationalPilotEntitlementActive(
  state: OrganizationalPilotAccessState,
  now: Date = new Date(),
): boolean {
  return state.pilotStatus === "active"
    && state.participantStatus === "active"
    && state.pilotStartAt != null
    && state.pilotEndAt != null
    && state.pilotStartAt <= now
    && state.pilotEndAt > now;
}

export function assertPilotCapacityAvailable(input: {
  populationType: PilotPopulationType;
  capacity: number;
  reservedCount: number;
}): void {
  if (!Number.isInteger(input.capacity) || input.capacity < 0) {
    throw new Error("Pilot capacity must be a non-negative integer");
  }
  if (input.reservedCount >= input.capacity) {
    const label = input.populationType === "professional"
      ? "professional seats"
      : "client capacity";
    throw new Error(`No ${label} available`);
  }
}

export async function getActivePilotFullAccess(userId: string, now: Date = new Date()) {
  const [row] = await db
    .select({
      participantId: organizationalPilotParticipants.id,
      programId: organizationalPilots.id,
      programName: organizationalPilots.name,
      organizationName: organizationalPilots.name,
      participantRole: organizationalPilotParticipants.participantRole,
      populationType: organizationalPilotParticipants.populationType,
      programStatus: organizationalPilots.status,
      programStartAt: organizationalPilots.pilotStartAt,
      programEndAt: organizationalPilots.pilotEndAt,
      expiresAt: organizationalPilots.pilotEndAt,
    })
    .from(organizationalPilotParticipants)
    .innerJoin(
      organizationalPilots,
      eq(organizationalPilots.id, organizationalPilotParticipants.pilotId),
    )
    .where(and(
      eq(organizationalPilotParticipants.userId, userId),
      eq(organizationalPilotParticipants.status, "active"),
      eq(organizationalPilots.status, "active"),
      lte(organizationalPilots.pilotStartAt, now),
      gt(organizationalPilots.pilotEndAt, now),
    ))
    .orderBy(desc(organizationalPilots.pilotEndAt))
    .limit(1);

  return row ?? null;
}

export async function getReservedPilotCapacity(
  pilotId: string,
  populationType: PilotPopulationType,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS count
      FROM organizational_pilot_participants
     WHERE pilot_id = ${pilotId}
       AND population_type = ${populationType}
       AND status IN ('pending', 'active')
  `);
  return Number((result.rows[0] as { count?: number } | undefined)?.count ?? 0);
}

/**
 * Compatibility guards for the retired participant-level endpoints. They
 * intentionally perform no writes while those routes are removed in the
 * invitation phase.
 */
export async function inspectPilotActivationToken(_token: string): Promise<{
  participantName: string | null;
  email: string;
  programName: string;
  organizationName: string;
  durationDays: number;
  requiresPasswordSetup: boolean;
} | null> {
  return null;
}

export async function activatePilotByToken(
  _token: string,
  _password?: string,
): Promise<any> {
  throw new Error("The provisional pilot activation flow has been retired");
}

export async function provisionPilotProgram(_input: unknown): Promise<any> {
  throw new Error("Participant-level pilot provisioning has been retired");
}

export async function startPilotProgram(_programId: string): Promise<any> {
  throw new Error("Participant-level pilot start has been retired");
}
