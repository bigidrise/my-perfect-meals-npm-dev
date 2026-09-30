import type {
  ProductCandidate,
  ProductEligibilityDecision,
  ProductHardRequirement,
  ProductRuleAssessment,
  ProductSearchIntent,
} from "../../../shared/productCandidateContract";
import {
  evaluateProductCandidate,
  isWellFormedProductSearchIntent,
  productCandidateSignature,
} from "./evaluateProductCandidate";
import {
  normalizeProductEvidence,
  type ProductEvidenceAdapter,
} from "./productEvidenceAdapters";
import {
  resolveProductRulePolicy,
  type ProductRuleEvidenceRegistry,
  type UnresolvedProductRule,
} from "./ruleEvidenceRegistry";
import {
  resolveProductSubjectAuthority,
  type ProductSubjectRequest,
  type ProductSubjectSources,
} from "./subjectAuthority";

export interface ProductRuleAssessor {
  /** Only a trusted server validator may make a claim; no AI proofs. */
  assess(input: {
    candidate: ProductCandidate;
    requirement: ProductHardRequirement;
    subjectId: string;
  }): Promise<Pick<ProductRuleAssessment, "outcome" | "factIds" | "reason">>;
}

/** Safe default until governed rule-specific validators exist. */
export const unimplementedProductAssessor: ProductRuleAssessor = {
  async assess() {
    return {
      outcome: "unknown", factIds: [],
      reason: "A trusted product-specific validator is not installed.",
    };
  },
};

export interface ProductDiscoveryResult {
  status: "authority_unresolved" | "complete" | "search_exhausted";
  unresolved: UnresolvedProductRule[];
  qualified: ProductEligibilityDecision[];
  needsVerification: ProductEligibilityDecision[];
  /** Internal evidence-bound records; never expose a catalog match as a recommendation. */
  evaluatedCandidates: { candidate: ProductCandidate; decision: ProductEligibilityDecision }[];
  rejectedCount: number;
  inspectedCount: number;
  sourceFailures: { source: string; sourceRecordId?: string; reason: string }[];
  knownConflicts: { productKey: string; reason: string }[];
}

export async function discoverProductCandidates(input: {
  subject: ProductSubjectRequest;
  intent: ProductSearchIntent;
  sources: ProductSubjectSources;
  registry: ProductRuleEvidenceRegistry;
  adapters: readonly ProductEvidenceAdapter[];
  assessor?: ProductRuleAssessor;
  /** Development catalog-lead mode: search despite unresolved policy, but never qualify. */
  allowUnresolvedLeads?: boolean;
  /** Existing deterministic safety screen may reject known conflicts, never assert a pass. */
  knownConflict?: (candidate: ProductCandidate, subject: Awaited<ReturnType<typeof resolveProductSubjectAuthority>>) => string | null;
  evaluatedAt: string;
  maxCandidates: number;
  maxPages: number;
  targetCount: number;
}): Promise<ProductDiscoveryResult> {
  const { maxCandidates, maxPages, targetCount } = input;
  if (![maxCandidates, maxPages, targetCount].every((value) =>
    Number.isInteger(value) && value > 0) ||
    maxCandidates > 100 || maxPages > 20 || targetCount > maxCandidates ||
    !input.adapters.length || new Set(input.adapters.map((adapter) => adapter.source)).size !== input.adapters.length) {
    throw new Error("Product discovery requires distinct providers and bounded positive search limits.");
  }
  const subject = await resolveProductSubjectAuthority(input.subject, input.sources);
  const policy = resolveProductRulePolicy(subject, input.registry, input.evaluatedAt);
  const result: ProductDiscoveryResult = {
    status: "authority_unresolved",
    unresolved: policy.unresolved,
    qualified: [],
    needsVerification: [],
    evaluatedCandidates: [],
    rejectedCount: 0,
    inspectedCount: 0,
    sourceFailures: [],
    knownConflicts: [],
  };
  // Never search as if an unresolved subject or hard policy were unrestricted.
  if ((!policy.context.resolved || policy.context.policyStatus !== "resolved") &&
      (!input.allowUnresolvedLeads || !policy.context.resolved)) return result;
  if (!isWellFormedProductSearchIntent(input.intent, policy.context.activeHardRestrictionIds)) {
    throw new Error("Product search intent does not preserve the requested purpose.");
  }
  const assessor = input.assessor ?? unimplementedProductAssessor;
  const seen = new Set<string>();
  let pages = 0;
  outer: for (const adapter of input.adapters) {
    let cursor: string | null = null;
    const visitedCursors = new Set<string>();
    do {
      if (pages >= maxPages || result.inspectedCount >= maxCandidates ||
          result.qualified.length >= targetCount) break outer;
      if (cursor !== null) {
        if (visitedCursors.has(cursor)) throw new Error("Evidence provider repeated its pagination cursor.");
        visitedCursors.add(cursor);
      }
      let page;
      try {
        page = await adapter.search(input.intent, cursor, Math.min(
          maxCandidates - result.inspectedCount, 25,
        ));
      } catch {
        result.sourceFailures.push({
          source: adapter.source, reason: "Product source search was unavailable.",
        });
        break;
      }
      pages++;
      if (page.references.length > 25) throw new Error("Evidence provider exceeded the requested page size.");
      for (const reference of page.references) {
        if (result.inspectedCount >= maxCandidates || result.qualified.length >= targetCount) break outer;
        if (reference.source !== adapter.source || !reference.sourceRecordId.trim()) {
          throw new Error("Evidence provider returned a mismatched source reference.");
        }
        result.inspectedCount++;
        let record;
        try {
          record = await adapter.read(reference);
        } catch {
          result.sourceFailures.push({
            source: adapter.source, sourceRecordId: reference.sourceRecordId,
            reason: "Exact source product record could not be retrieved.",
          });
          continue;
        }
        if (record.source !== reference.source || record.sourceRecordId !== reference.sourceRecordId) {
          throw new Error("Evidence provider returned a different source record.");
        }
        const candidate = normalizeProductEvidence(record);
        // Never combine facts from separate source versions or conflicting
        // variants merely because the barcode or display name is similar.
        const signature = productCandidateSignature(candidate);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const conflict = input.knownConflict?.(candidate, subject);
        if (conflict) {
          result.rejectedCount++;
          result.knownConflicts.push({ productKey: candidate.identity.key, reason: conflict });
          continue;
        }
        const assessments: ProductRuleAssessment[] = [];
        for (const requirement of policy.context.hardRequirements) {
          const assessment = await assessor.assess({
            candidate, requirement, subjectId: subject.subjectId,
          });
          assessments.push({
            ...assessment,
            requirementId: requirement.id,
            subjectId: subject.subjectId,
            contextFingerprint: policy.context.contextFingerprint,
            policyVersion: policy.context.policyVersion,
            candidateSignature: signature,
          });
        }
        const decision = evaluateProductCandidate(candidate, policy.context, assessments);
        result.evaluatedCandidates.push({ candidate, decision });
        if (decision.status === "eligible") result.qualified.push(decision);
        else if (decision.status === "needs_verification") result.needsVerification.push(decision);
        else result.rejectedCount++;
      }
      cursor = page.nextCursor;
    } while (cursor !== null);
  }
  result.status = result.qualified.length >= targetCount ? "complete" : "search_exhausted";
  return result;
}