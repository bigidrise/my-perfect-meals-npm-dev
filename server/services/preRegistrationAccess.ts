import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { trialAccessInvites } from "@shared/schema";
import { normalizeEmailIdentity } from "./emailIdentityService";

export type TrialAccessType = "pilot" | "client";

export interface PendingPreRegistrationAccess {
  id: string;
  normalizedEmail: string;
  accessType: TrialAccessType;
  durationDays: number;
}

export function trialSourceForAccessType(accessType: TrialAccessType): "pilot_program" | "client_access" {
  return accessType === "pilot" ? "pilot_program" : "client_access";
}

export function resolveSignupTrial(
  now: Date,
  pendingAccess: Pick<PendingPreRegistrationAccess, "accessType" | "durationDays"> | null,
) {
  const durationDays = pendingAccess?.durationDays ?? 7;
  return {
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
    trialSource: pendingAccess
      ? trialSourceForAccessType(pendingAccess.accessType)
      : "standard_signup" as const,
    trialAccessType: pendingAccess?.accessType ?? null,
    durationDays,
  };
}

export async function findPendingPreRegistrationAccess(
  email: string,
): Promise<PendingPreRegistrationAccess | null> {
  const normalizedEmail = normalizeEmailIdentity(email);
  const [row] = await db
    .select({
      id: trialAccessInvites.id,
      normalizedEmail: trialAccessInvites.normalizedEmail,
      accessType: trialAccessInvites.accessType,
      durationDays: trialAccessInvites.durationDays,
    })
    .from(trialAccessInvites)
    .where(and(
      eq(trialAccessInvites.normalizedEmail, normalizedEmail),
      isNull(trialAccessInvites.activatedAt),
      isNull(trialAccessInvites.revokedAt),
    ))
    .orderBy(desc(trialAccessInvites.invitedAt))
    .limit(1);

  return row ?? null;
}