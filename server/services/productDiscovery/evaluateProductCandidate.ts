import { createHash } from "node:crypto";
import {
  PRODUCT_CANDIDATE_CONTRACT_VERSION,
  type ProductCandidate,
  type ProductDecisionReason,
  type ProductEligibility,
  type ProductEligibilityDecision,
  type ProductEvaluationContext,
  type ProductEvidenceNeed,
  type ProductEvidenceProvenance,
  type ProductFact,
  type ProductSearchIntent,
  type ProductRuleAssessment,
  type ProductRankingAssessment,
} from "../../../shared/productCandidateContract";

const APPROVED_SOURCES = new Set([
  "current_package_label", "manufacturer", "usda_branded",
  "open_food_facts",
]);

function isCurrent(provenance: ProductEvidenceProvenance, at: number, maxAgeDays: number): boolean {
  const observed = Date.parse(provenance.observedAt);
  return Number.isFinite(observed) && Number.isFinite(maxAgeDays)
    && maxAgeDays >= 0 && observed <= at
    && at - observed <= maxAgeDays * 86_400_000;
}

function trustedForIdentity(
  provenance: ProductEvidenceProvenance,
  productKey: string,
  at: number,
  maxAgeDays: number,
): boolean {
  return APPROVED_SOURCES.has(provenance.source) &&
    !!provenance.sourceRecordId.trim() &&
    provenance.identityKey === productKey &&
    provenance.exactVariantMatch &&
    isCurrent(provenance, at, maxAgeDays);
}

/** Exact evidence snapshot binding; an assessment for an earlier label cannot be replayed. */
export function productCandidateSignature(candidate: ProductCandidate): string {
  return createHash("sha256").update(JSON.stringify({
    identity: candidate.identity,
    facts: [...candidate.facts].sort((a, b) => a.id.localeCompare(b.id)),
  })).digest("hex");
}

function factMatchesNeed(fact: ProductFact, need: ProductEvidenceNeed): boolean {
  return fact.kind === need.kind &&
    (need.target === undefined || fact.target === need.target);
}

function trustedForNeed(
  fact: ProductFact,
  need: ProductEvidenceNeed,
  productKey: string,
  at: number,
  requireComplete: boolean,
): boolean {
  const provenance = fact.provenance;
  if (!factMatchesNeed(fact, need) || !fact.statement.trim() ||
      !trustedForIdentity(provenance, productKey, at, need.maxAgeDays) ||
      (requireComplete && fact.completeness !== "complete")) return false;
  if (fact.kind === "precautionary_allergens" &&
      fact.precautionaryStatus !== "explicitly_absent_for_target") return false;
  if (provenance.source === "current_package_label" &&
      provenance.captureConfidence !== "high") return false;
  if (need.acceptedSources && !need.acceptedSources.includes(
    provenance.source as typeof need.acceptedSources[number],
  )) return false;
  return need.minimum !== "confirmed_current_label" ||
    (provenance.source === "current_package_label" &&
      provenance.labelCompletenessConfirmed === true);
}

function trustedForConflict(
  fact: ProductFact,
  need: ProductEvidenceNeed,
  productKey: string,
  at: number,
): boolean {
  // Positive evidence of a conflict need not be a *complete* ingredient list:
  // a partial current label that explicitly contains an allergen is enough to
  // reject it, although the same partial label cannot establish a pass.
  return factMatchesNeed(fact, need) && !!fact.statement.trim() &&
    trustedForIdentity(fact.provenance, productKey, at, need.maxAgeDays) &&
    (fact.provenance.source !== "current_package_label" ||
      fact.provenance.captureConfidence === "high") &&
    (!need.acceptedSources || need.acceptedSources.includes(
      fact.provenance.source as typeof need.acceptedSources[number],
    ));
}

function makeDecision(
  context: ProductEvaluationContext,
  productKey: string,
  status: ProductEligibility,
  reasons: ProductDecisionReason[],
  ranking: ProductRankingAssessment[] = [],
): ProductEligibilityDecision {
  return {
    contractVersion: PRODUCT_CANDIDATE_CONTRACT_VERSION,
    status,
    presentation: status === "eligible"
      ? "recommended_for_you"
      : status === "needs_verification" ? "check_the_label" : "not_shown",
    subjectId: context.subjectId,
    contextFingerprint: context.contextFingerprint,
    productKey,
    evaluatedAt: context.evaluatedAt,
    reasons,
    ranking: status === "eligible" ? ranking : [],
    continueDiscovery: status !== "eligible",
  };
}

/**
 * Pure contract reducer, NOT a live product safety validator. The caller must
 * resolve current subject authority and obtain assessments from a trusted
 * server-side validator. Missing or weak evidence cannot prove a pass.
 */
export function evaluateProductCandidate(
  candidate: ProductCandidate,
  context: ProductEvaluationContext,
  assessments: readonly ProductRuleAssessment[],
  rankingAssessments: readonly ProductRankingAssessment[] = [],
): ProductEligibilityDecision {
  const at = Date.parse(context.evaluatedAt);
  if (!context.subjectId.trim() || !context.contextFingerprint.trim() ||
      !context.policyVersion.trim() ||
      !Number.isFinite(at) || !Number.isFinite(context.identityMaxAgeDays) ||
      context.identityMaxAgeDays < 0) {
    throw new Error("Product evaluation requires an identified subject, context, and valid time policy.");
  }
  const requirementIds = context.hardRequirements.map((r) => r.id);
  if (new Set(requirementIds).size !== requirementIds.length ||
      context.hardRequirements.some((r) => !r.id.trim() || !r.evidenceNeeds.length ||
        r.evidenceNeeds.some((n) => !Number.isFinite(n.maxAgeDays) || n.maxAgeDays < 0 ||
          (["precautionary_allergens", "nutrition", "certification"].includes(n.kind) &&
            !n.target?.trim())))) {
    throw new Error("Invalid product hard-requirement policy.");
  }
  if (new Set(candidate.facts.map((fact) => fact.id)).size !== candidate.facts.length ||
      candidate.facts.some((fact) => !fact.id.trim()) ||
      new Set(assessments.map((assessment) => assessment.requirementId)).size !== assessments.length) {
    throw new Error("Ambiguous product evidence or rule assessments.");
  }
  const key = candidate.identity.key;
  if (!context.resolved || context.policyStatus !== "resolved" ||
      new Set(context.activeHardRestrictionIds).size !== context.activeHardRestrictionIds.length ||
      context.activeHardRestrictionIds.some((id) => !requirementIds.includes(id)) ||
      requirementIds.some((id) => !context.activeHardRestrictionIds.includes(id))) {
    return makeDecision(context, key, "needs_verification", [{
      code: "context_unavailable", detail: "Current subject requirements could not be resolved.",
    }]);
  }

  const identity = candidate.identity;
  if (!key.trim() || !identity.name.trim() || !identity.brand.trim() ||
      !identity.variant.trim() || identity.match !== "exact_variant" ||
      (identity.barcode && identity.provenance.barcode !== identity.barcode) ||
      !trustedForIdentity(identity.provenance, key, at, context.identityMaxAgeDays)) {
    return makeDecision(context, key, "needs_verification", [{
      code: "identity_unverified", detail: "Exact, current product and variant identity is unavailable.",
    }]);
  }

  const byId = new Map(candidate.facts.map((f) => [f.id, f]));
  const byRequirement = new Map(assessments.map((a) => [a.requirementId, a]));
  const signature = productCandidateSignature(candidate);
  const reasons: ProductDecisionReason[] = [];
  let conflicted = false;
  for (const requirement of context.hardRequirements) {
    const assessment = byRequirement.get(requirement.id);
    if (!assessment || assessment.outcome === "unknown" ||
        assessment.subjectId !== context.subjectId ||
        assessment.contextFingerprint !== context.contextFingerprint ||
        assessment.policyVersion !== context.policyVersion ||
        assessment.candidateSignature !== signature) {
      reasons.push({
        requirementId: requirement.id, code: "assessment_missing",
        detail: "The applicable hard restriction has not been resolved for this product.",
      });
      continue;
    }
    const cited = assessment.factIds.map((id) => byId.get(id)).filter(
      (fact): fact is ProductFact => !!fact,
    );
    if (assessment.outcome === "conflict") {
      // A partial declaration can establish a positive conflict, but model or
      // user-entered claims and facts about another variant cannot.
      if (cited.some((fact) => requirement.evidenceNeeds.some((need) =>
        (!fact.provenance.barcode || !identity.barcode ||
          fact.provenance.barcode === identity.barcode) &&
        trustedForConflict(fact, need, key, at)))) {
        conflicted = true;
        reasons.push({ requirementId: requirement.id, code: "hard_conflict", detail: assessment.reason });
      } else {
        reasons.push({
          requirementId: requirement.id, code: "evidence_missing",
          detail: "The reported conflict lacks qualifying product evidence.",
        });
      }
      continue;
    }
    for (const need of requirement.evidenceNeeds) {
      if (!cited.some((fact) =>
        (!fact.provenance.barcode || !identity.barcode ||
          fact.provenance.barcode === identity.barcode) &&
        trustedForNeed(fact, need, key, at, true))) {
        reasons.push({
          requirementId: requirement.id, code: "evidence_missing",
          detail: `Required ${need.kind}${need.target ? ` (${need.target})` : ""} evidence is incomplete or unavailable.`,
        });
      }
    }
  }
  if (conflicted) return makeDecision(context, key, "rejected", reasons);
  if (reasons.length) return makeDecision(context, key, "needs_verification", reasons);

  const softIds = new Set(context.rankingFactors.map((factor) => factor.id));
  const ranking = rankingAssessments.filter(
    (assessment) => softIds.has(assessment.factorId) && Number.isFinite(assessment.score),
  );
  return makeDecision(context, key, "eligible", [], ranking);
}

/** Structural guard only: semantic preservation must be checked by intent interpretation. */
export function isWellFormedProductSearchIntent(
  intent: ProductSearchIntent,
  applicableHardRequirementIds: readonly string[],
): boolean {
  return !!intent.requestedFood.trim() && intent.searchCategories.length > 0 &&
    intent.searchCategories.every((option) =>
      !!option.category.trim() && option.preservesPurpose &&
      option.adaptationReasonRequirementIds.every((id) =>
        applicableHardRequirementIds.includes(id)));
}

/** A candidate failure does not exhaust a request; the search budget does. */
export function shouldContinueProductDiscovery(input: {
  qualifiedCount: number;
  targetCount: number;
  inspectedCount: number;
  maxCandidates: number;
  moreCandidatesAvailable: boolean;
}): boolean {
  if (![input.qualifiedCount, input.targetCount, input.inspectedCount, input.maxCandidates]
    .every((n) => Number.isInteger(n) && n >= 0) || input.targetCount === 0 ||
    input.maxCandidates === 0) {
    throw new Error("Product discovery requires positive, bounded search counts.");
  }
  return input.qualifiedCount < input.targetCount &&
    input.inspectedCount < input.maxCandidates &&
    input.moreCandidatesAvailable;
}