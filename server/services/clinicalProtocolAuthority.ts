import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { studioMemberships, studios, clientActivityLog } from "../db/schema/studio";

export interface ClinicalAuthorityFacts {
  oncology?: { enabled?: boolean; source?: string; locked?: boolean } | null;
  memberships: Array<{
    type: string; assignedBuilder: string | null; professionalRole: string | null;
    verificationStatus: string | null;
    verifiedAssignment?: boolean;
  }>;
}
export interface ClinicalProtocolAuthority {
  kind: "self_managed" | "physician_directed" | "legacy_review_required";
  selfModificationBlocked: boolean;
}

/**
 * A builder cache is not physician provenance. Existing clinical assignments
 * without explicit ownership remain review-required, not silently unlocked.
 * Ordinary nonclinical trainer assignments never establish clinical authority.
 */
export function evaluateClinicalProtocolAuthority(facts: ClinicalAuthorityFacts): ClinicalProtocolAuthority {
  if (facts.oncology?.enabled && facts.oncology.source === "physician") {
    return { kind: "physician_directed", selfModificationBlocked: true };
  }
  if (facts.memberships.some(membership => membership.verifiedAssignment)) {
    return { kind: "physician_directed", selfModificationBlocked: true };
  }
  const clinicalBuilders = new Set(["diabetic", "glp1", "anti_inflammatory", "weekly"]);
  const ambiguous = facts.memberships.some((membership) =>
    !!membership.assignedBuilder &&
    (membership.type === "clinic" || clinicalBuilders.has(membership.assignedBuilder)));
  return ambiguous
    ? { kind: "legacy_review_required", selfModificationBlocked: true }
    : { kind: "self_managed", selfModificationBlocked: false };
}

/** No catch-and-unlock fallback: failed authority reads must fail closed. */
export async function resolveClinicalProtocolAuthority(userId: string): Promise<ClinicalProtocolAuthority> {
  const [profile] = await db.select({ oncology: users.oncologySupportContext })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!profile) throw new Error("Clinical profile unavailable.");
  const memberships = await db.select({
    type: studios.type, assignedBuilder: studioMemberships.assignedBuilder,
    id: studioMemberships.id, studioId: studios.id, ownerUserId: studios.ownerUserId,
    professionalRole: users.professionalRole, verificationStatus: studios.verificationStatus,
  }).from(studioMemberships)
    .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
    .innerJoin(users, eq(users.id, studios.ownerUserId))
    .where(and(eq(studioMemberships.clientUserId, userId),
      eq(studioMemberships.status, "active"), eq(studioMemberships.isArchived, false)));
  const assignments = await db.select({
    actorUserId: clientActivityLog.actorUserId, studioId: clientActivityLog.studioId,
    entityId: clientActivityLog.entityId, metadata: clientActivityLog.metadata,
  }).from(clientActivityLog).where(and(eq(clientActivityLog.clientUserId, userId),
    eq(clientActivityLog.action, "builder_assigned"))).orderBy(desc(clientActivityLog.createdAt)).limit(50);
  return evaluateClinicalProtocolAuthority({
    oncology: profile.oncology as ClinicalAuthorityFacts["oncology"],
    memberships: memberships.map(membership => ({
      ...membership,
      verifiedAssignment: membership.type === "clinic" &&
        membership.professionalRole === "physician" && membership.verificationStatus === "verified" &&
        assignments.some(assignment => assignment.actorUserId === membership.ownerUserId &&
          assignment.studioId === membership.studioId && assignment.entityId === membership.id &&
          assignment.metadata?.source === "clinical" &&
          assignment.metadata?.assignedBuilder === membership.assignedBuilder),
    })),
  });
}
