import type { db } from "../db";
import { clinicalProtocolRecommendations } from "../db/schema/clinicalProtocolRecommendations";
import { normalizeClinicalProtocols } from "@shared/clinicalProtocolIdentity";

/** Reserved server-owned reasons in the existing clinical decision audit. */
export const PHYSICIAN_PROTOCOL_DECISION = "physician_directed_protocol_decision";
export const SUBJECT_PROFILE_DECISION = "subject_profile_protocol_decision";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The caller must already have authorized the authenticated actor. This write
 * MUST share the profile transaction: ownership must never be fire-and-forget.
 * No lab values or extra personal information are copied into the record.
 */
export async function recordClinicalProtocolDecision(
  tx: Transaction, subjectId: string, protocol: string,
  status: "accepted" | "removed", authority: "physician" | "self",
) {
  await tx.insert(clinicalProtocolRecommendations).values({
    userId: subjectId, recommendedProtocol: protocol, status,
    reason: authority === "physician" ? PHYSICIAN_PROTOCOL_DECISION : SUBJECT_PROFILE_DECISION,
  });
}

export async function recordSubjectProtocolChanges(
  tx: Transaction, subjectId: string, before: readonly string[], after: readonly string[],
) {
  const previous = normalizeClinicalProtocols(before);
  const next = normalizeClinicalProtocols(after);
  for (const protocol of next.filter(p => !previous.includes(p))) {
    await recordClinicalProtocolDecision(tx, subjectId, protocol, "accepted", "self");
  }
  for (const protocol of previous.filter(p => !next.includes(p))) {
    await recordClinicalProtocolDecision(tx, subjectId, protocol, "removed", "self");
  }
}
