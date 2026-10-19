import {
  AdvisorResponse, CompleteResponseReview, EvidenceContext,
  type PolicyDecision,
} from "../../../shared/pairingAdvisor/contracts";
import { findWineListEntry, parseWineListEntries } from "../pairings/wineListIdentity";

export const RESTRICTION_MESSAGES = {
  INGREDIENT_EVIDENCE_REQUIRED:
    "Choosing something for you to consume requires verified ingredient information under your current safety settings. A wine name or supplied list is not sufficient.",
  ACTIVE_SAFETY_RESTRICTION:
    "Your active safety requirements prevent this personal consumption recommendation. General pairing principles can still be explained.",
  NEW_RISK_UNRESOLVED:
    "You disclosed a relevant risk that has not been resolved for personal suitability. Affected consumption recommendations are withheld; your saved profile has not been changed.",
} as const;
export const CLARIFICATION_QUESTIONS = {
  INTENT_UNCLEAR: "Are you asking about a general pairing principle or choosing something for yourself?",
  REFERENCE_UNRESOLVED: "Which item are you referring to?",
  SUBJECT_UNSUPPORTED: "This advisor personalizes only for your own account. Would you like a general educational explanation instead?",
} as const;
export const UNAVAILABLE_MESSAGES = {
  SAFETY_AUTHORITY_UNAVAILABLE: "Your required safety information could not be loaded. No pairing advice was generated.",
  VALIDATION_FAILED: "The response could not be validated. No unchecked recommendations are being shown.",
  PROVIDER_UNAVAILABLE: "The advisor could not complete this request. No partial recommendations are being shown.",
} as const;

export type ValidationResult =
  | { status: "accepted"; response: AdvisorResponse }
  | { status: "rejected"; reason: "VALIDATION_FAILED" };

/**
 * Deterministic contract checks plus a supplied complete-response review.
 * Increment 1 supplies synthetic reviews ONLY. This does not implement a semantic judge
 * or replace the frozen consumption scanners; real scanner wiring belongs to Increment 2.
 */
export function validateAdvisorResponse(
  raw: unknown, decision: PolicyDecision, rawEvidence: unknown, rawReview: unknown,
): ValidationResult {
  const reject = (): ValidationResult => ({ status: "rejected", reason: "VALIDATION_FAILED" });
  const parsed = AdvisorResponse.safeParse(raw);
  const evidence = EvidenceContext.safeParse(rawEvidence);
  if (!parsed.success || !evidence.success) return reject();
  const response = parsed.data;
  if (decision.kind === "disabled" || decision.kind === "unauthorized" || decision.kind === "forbidden") return reject();
  if (response.outcome === "unavailable") {
    if (response.message !== UNAVAILABLE_MESSAGES[response.reason]) return reject();
    const expected = decision.kind === "unavailable" ? decision.reason : null;
    if (expected !== null && response.reason !== expected) return reject();
    if (response.reason === "SAFETY_AUTHORITY_UNAVAILABLE" && expected !== response.reason) return reject();
    return { status: "accepted", response };
  }
  if (response.outcome === "clarification") {
    return decision.kind === "clarification" && response.reason === decision.reason
      && response.question === CLARIFICATION_QUESTIONS[response.reason]
      ? { status: "accepted", response } : reject();
  }
  if (response.outcome === "restricted") {
    if (decision.kind !== "restricted" || response.reason !== decision.reason
      || response.message !== RESTRICTION_MESSAGES[response.reason]
      || (response.education !== null && !decision.allowEducation)) return reject();
    if (response.education === null) return { status: "accepted", response };
  } else if (response.outcome === "education") {
    if (decision.kind !== "generate_education") return reject();
  } else {
    if (decision.kind !== "generate_recommendation"
      || (response.education !== null && !decision.includeEducation)) return reject();
    const ids = new Set(response.recommendations.map(card => card.id));
    if (ids.size !== response.recommendations.length) return reject();
    if (response.bestChoiceId !== null && !ids.has(response.bestChoiceId)) return reject();
    const references = [
      ...response.narrative.flatMap(segment => segment.recommendationIds),
      ...response.followUps.flatMap(segment => segment.recommendationIds),
      ...response.recommendations.flatMap(card => card.alternativeIds),
    ];
    if (references.some(ref => !ids.has(ref))) return reject();
    const list = evidence.data.suppliedList;
    const entries = list ? parseWineListEntries(list.text) : [];
    if (entries.length > 100) return reject();
    const usedEntries = new Set<string>();
    for (const card of response.recommendations) {
      if (list) {
        const entry = findWineListEntry(entries, card.name);
        if (!entry || entry.id !== card.listEntryId || usedEntries.has(entry.id)) return reject();
        usedEntries.add(entry.id);
      } else if (card.listEntryId !== null) return reject();
      for (const claim of card.claims) {
        // No structured price, stock, or verified composition evidence exists in this increment.
        if (claim.kind !== "list_membership" || !list
          || claim.evidenceId !== `list:${list.revision}:${card.listEntryId}`) return reject();
      }
    }
  }
  const review = CompleteResponseReview.safeParse(rawReview);
  if (!review.success || review.data.verdict !== "pass"
    || review.data.reviewedPayload !== JSON.stringify(response)
    || !review.data.intentBoundary || !review.data.evidenceClaims
    || !review.data.noUnsafeAdvice || !review.data.referencesConsistent) return reject();
  return { status: "accepted", response };
}
