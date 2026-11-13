import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { studioMemberships, studios, clientActivityLog } from "../db/schema/studio";
import { clinicalProtocolRecommendations } from "../db/schema/clinicalProtocolRecommendations";
import { PHYSICIAN_PROTOCOL_DECISION } from "./clinicalProtocolProvenance";
import { effectiveClinicalProtocols, canonicalClinicalProtocol } from "@shared/clinicalProtocolIdentity";

export interface ClinicalAuthorityFacts {
  protocolProvenance?: Array<{ protocol: string; owner: "physician" | "self" | "unknown" }>;
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
  if (facts.protocolProvenance?.some(p => p.owner === "physician")) {
    return { kind: "physician_directed", selfModificationBlocked: true };
  }
  if (facts.memberships.some(membership => membership.verifiedAssignment)) {
    return { kind: "physician_directed", selfModificationBlocked: true };
  }
  const clinicalBuilders = new Set(["diabetic", "glp1", "anti_inflammatory", "weekly"]);
  const ambiguous = facts.memberships.some((membership) =>
    !!membership.assignedBuilder &&
    (membership.type === "clinic" || clinicalBuilders.has(membership.assignedBuilder))) ||
    (facts.memberships.some(m => m.type === "clinic") &&
      !!facts.protocolProvenance?.some(p => p.owner === "unknown"));
  return ambiguous
    ? { kind: "legacy_review_required", selfModificationBlocked: true }
    : { kind: "self_managed", selfModificationBlocked: false };
}

/** No catch-and-unlock fallback: failed authority reads must fail closed. */
export async function resolveClinicalProtocolAuthority(userId: string): Promise<ClinicalProtocolAuthority> {
  const [profile] = await db.select({
    oncology: users.oncologySupportContext, specialtyConditions: users.specialtyConditions,
    specialtyCondition: users.specialtyCondition, healthConditions: users.healthConditions,
    medicalConditions: users.medicalConditions, thyroidType: users.thyroidType,
  })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!profile) throw new Error("Clinical profile unavailable.");
  const decisions = await db.selectDistinctOn([clinicalProtocolRecommendations.recommendedProtocol], {
    id: clinicalProtocolRecommendations.id, protocol: clinicalProtocolRecommendations.recommendedProtocol,
    status: clinicalProtocolRecommendations.status, reason: clinicalProtocolRecommendations.reason,
  }).from(clinicalProtocolRecommendations).where(and(
    eq(clinicalProtocolRecommendations.userId, userId),
    inArray(clinicalProtocolRecommendations.status, ["accepted", "removed"]),
  )).orderBy(clinicalProtocolRecommendations.recommendedProtocol, desc(clinicalProtocolRecommendations.id));
  const latest = new Map<string, typeof decisions[number]>();
  for (const decision of decisions.sort((a, b) => b.id - a.id)) {
    const protocol = canonicalClinicalProtocol(decision.protocol);
    if (!latest.has(protocol)) latest.set(protocol, decision);
  }
  const protocols = effectiveClinicalProtocols({ ...profile, oncologySupportContext: profile.oncology });
  const provenanceTargets = new Set([
    ...protocols,
    ...(profile.thyroidType ? ["thyroid-support"] : []),
    ...[...latest].filter(([, d]) => d.status === "accepted" && d.reason === PHYSICIAN_PROTOCOL_DECISION).map(([p]) => p),
  ]);
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
    protocolProvenance: [...provenanceTargets].map(protocol => {
      // A thyroid subtype may be a narrowing of its parent's authorized choice.
      const decision = latest.get(protocol) ?? (["hypothyroid", "hyperthyroid", "hashimotos"].includes(protocol) ? latest.get("thyroid-support") : undefined);
      return { protocol, owner: decision?.status === "accepted"
        ? decision.reason === PHYSICIAN_PROTOCOL_DECISION ? "physician" : "self"
        : "unknown" };
    }),
    oncology: profile.oncology as ClinicalAuthorityFacts["oncology"],
    memberships: memberships.map(membership => ({
      ...membership,
      verifiedAssignment: membership.type === "clinic" &&
        membership.professionalRole === "physician" && membership.verificationStatus === "verified" &&
        (() => {
          const assignment = assignments.find(a => a.studioId === membership.studioId && a.entityId === membership.id);
          return !!assignment && assignment.actorUserId === membership.ownerUserId &&
            assignment.metadata?.source === "clinical" &&
            assignment.metadata?.assignedBuilder === membership.assignedBuilder;
        })(),
    })),
  });
}
