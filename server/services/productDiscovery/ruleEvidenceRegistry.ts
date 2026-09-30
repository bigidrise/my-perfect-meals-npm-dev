import type {
  ProductEvaluationContext,
  ProductHardRequirement,
  ProductRankingFactor,
} from "../../../shared/productCandidateContract";
import type { ProductSubjectSnapshot } from "./subjectAuthority";

/**
 * No clinical or freshness defaults are installed here. An explicit reviewed
 * policy entry must name the pre-existing authority and the exact evidence
 * threshold. A condition name is never itself a sodium/carb limit.
 */
export interface ReviewedProductRule extends ProductHardRequirement {
  authorityReference: string;
}

export interface ProductRuleEvidenceRegistry {
  version: string;
  identityMaxAgeDays: number | null;
  reviewedRules: readonly ReviewedProductRule[];
  /** Only for a catalog surface: a day-level diet may guide ranking without becoming an intrinsic package ban. */
  contextualDietaryIdentities?: readonly string[];
}

export const UNREVIEWED_PRODUCT_POLICY: ProductRuleEvidenceRegistry = {
  version: "product-policy-unreviewed.v1",
  identityMaxAgeDays: null,
  reviewedRules: [],
};

/**
 * Development-only catalog identity observation. A fresh exact-GTIN read
 * verifies the source record's identity, NOT the current package formulation.
 * Hard rules still require independently reviewed fact policies and evidence.
 */
export const DEVELOPMENT_CATALOG_IDENTITY_POLICY: ProductRuleEvidenceRegistry = {
  version: "development-catalog-identity.v1",
  identityMaxAgeDays: 1,
  reviewedRules: [],
  contextualDietaryIdentities: ["low_carb", "low carb"],
};

export interface UnresolvedProductRule {
  id: string;
  classification: "hard" | "support_context" | "authority";
  reason: string;
}

export interface ResolvedProductRulePolicy {
  context: ProductEvaluationContext;
  unresolved: UnresolvedProductRule[];
}

function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveProductRulePolicy(
  subject: ProductSubjectSnapshot,
  registry: ProductRuleEvidenceRegistry,
  evaluatedAt: string,
): ResolvedProductRulePolicy {
  if (!registry.version.trim() || !Number.isFinite(Date.parse(evaluatedAt)) ||
      (registry.identityMaxAgeDays !== null &&
        (!Number.isFinite(registry.identityMaxAgeDays) || registry.identityMaxAgeDays < 0))) {
    throw new Error("Product policy requires a version, valid evaluation time, and reviewed identity freshness.");
  }
  const byId = new Map<string, ReviewedProductRule>();
  for (const rule of registry.reviewedRules) {
    if (!rule.id.trim() || !rule.authorityReference.trim() || !rule.evidenceNeeds.length ||
        rule.evidenceNeeds.some((need) =>
          !Number.isFinite(need.maxAgeDays) || need.maxAgeDays < 0) ||
        byId.has(rule.id)) {
      throw new Error("Invalid or duplicate reviewed product rule.");
    }
    byId.set(rule.id, rule);
  }
  const active = new Map<string, ProductHardRequirement["type"]>();
  function hard(id: string, type: ProductHardRequirement["type"]) {
    active.set(id, type);
  }
  const contextualDiets = subject.dietaryIdentity.filter((value) =>
    registry.contextualDietaryIdentities?.some((diet) => key(diet) === key(value)) &&
    !byId.has(`dietary_identity:${key(value)}`));
  subject.dietaryIdentity.forEach((value) => {
    if (!contextualDiets.includes(value)) hard(`dietary_identity:${key(value)}`, "dietary_identity");
  });
  subject.allergies.forEach((value) => hard(`allergy:${key(value)}`, "allergy"));
  subject.explicitAvoidances.forEach((value) => hard(`explicit_avoidance:${key(value)}`, "explicit_avoidance"));
  subject.medicalHardLimitNames.forEach((value) => hard(`clinical:${key(value)}`, "clinical"));
  if (subject.glp1Active) hard("clinical:glp1", "clinical");
  if (subject.alphaGalActive) hard("alpha_gal:active", "alpha_gal");
  if (subject.pregnancyActive) hard("pregnancy:active", "pregnancy");
  subject.providerInterventionKeys.forEach((value) =>
    hard(`provider_intervention:${key(value)}`, "clinical"));

  const unresolved: UnresolvedProductRule[] = subject.issues.map((issue) => ({
    id: `subject:${issue}`, classification: "authority", reason: issue,
  }));
  if (registry.identityMaxAgeDays === null) unresolved.push({
    id: "identity:freshness", classification: "authority",
    reason: "Exact product identity freshness has no reviewed threshold.",
  });
  const hardRequirements: ProductHardRequirement[] = [];
  for (const [id, type] of active) {
    const reviewed = byId.get(id);
    // Clinical condition names, legacy provider prompt interventions, and
    // pregnancy/alpha-gal support flags are not typed current directives.
    // An evidence template alone cannot promote them into product policy.
    const authorityMissing = type === "clinical" || type === "alpha_gal" ||
      type === "pregnancy";
    if (authorityMissing || !reviewed || reviewed.type !== type) {
      unresolved.push({
        id, classification: "hard",
        reason: authorityMissing
          ? "Current subject authority or hazard-specific packaged-product policy is not established."
          : "No reviewed, rule-specific packaged-product evidence policy is available.",
      });
    } else {
      hardRequirements.push({
        id, type, evidenceNeeds: reviewed.evidenceNeeds,
      });
    }
  }
  // Medical support without an exact directive is context, not an invented
  // packaged-food prohibition. Preserve that open policy question separately.
  subject.medicalOptimizationNames.forEach((value) => unresolved.push({
    id: `support:${key(value)}`, classification: "support_context",
    reason: "Support optimization does not establish an intrinsic product hard limit.",
  }));
  const rankingFactors: ProductRankingFactor[] = [
    ...contextualDiets.map((value) => ({
      id: `dietary_fit:${key(value)}`, type: "optimization" as const, weight: 1,
    })),
    ...subject.dislikes.map((value) => ({
      id: `dislike:${key(value)}`, type: "dislike" as const, weight: 1,
    })),
    ...subject.preferences.map((value) => ({
      id: `preference:${key(value)}`, type: "preference" as const, weight: 1,
    })),
    ...subject.medicalOptimizationNames.map((value) => ({
      id: `optimization:${key(value)}`, type: "optimization" as const, weight: 1,
    })),
  ];
  const activeHardRestrictionIds = [...active.keys()];
  return {
    context: {
      subjectId: subject.subjectId,
      contextFingerprint: subject.fingerprint,
      policyVersion: registry.version,
      resolved: subject.status === "resolved",
      policyStatus: unresolved.some((issue) => issue.classification !== "support_context")
        ? "unresolved" : "resolved",
      activeHardRestrictionIds,
      evaluatedAt,
      // A missing threshold is represented in policyStatus, never accepted as
      // zero-day currentness or infinite freshness by the reducer.
      identityMaxAgeDays: registry.identityMaxAgeDays ?? 0,
      hardRequirements,
      rankingFactors,
    },
    unresolved,
  };
}