/**
 * Contract-first product discovery. These types are not connected to live
 * recommendations. A future server-side resolver must build the subject's
 * requirements; neither client requests nor model output may supply proofs.
 */
export const PRODUCT_CANDIDATE_CONTRACT_VERSION = "product-candidate.v1" as const;

export type ProductEvidenceSource =
  | "current_package_label"
  | "manufacturer"
  | "usda_branded"
  | "open_food_facts"
  | "user_entered"
  | "model_suggestion";

export type ApprovedProductEvidenceSource = Exclude<
  ProductEvidenceSource,
  "user_entered" | "model_suggestion"
>;

export type ProductFactKind =
  | "ingredients"
  | "precautionary_allergens"
  | "nutrition"
  | "certification"
  | "processing";

export interface ProductEvidenceProvenance {
  source: ProductEvidenceSource;
  sourceRecordId: string;
  observedAt: string; // ISO timestamp of the evidence, not the evaluation time
  identityKey: string; // exact product/variant, never a brand or food category
  barcode?: string; // when present, must agree with the candidate's barcode
  exactVariantMatch: boolean;
  /** A photograph/OCR alone is not a reviewed, complete current-package label. */
  labelCompletenessConfirmed?: boolean;
  /** Low-confidence OCR cannot by itself establish even a positive conflict. */
  captureConfidence?: "high" | "low" | "unknown";
}

export interface ProductIdentity {
  key: string; // GTIN + variant or an opaque exact-package capture identity
  name: string;
  brand: string;
  variant: string;
  barcode?: string;
  match: "exact_variant" | "uncertain" | "brand_only";
  provenance: ProductEvidenceProvenance;
}

export interface ProductFact {
  id: string;
  kind: ProductFactKind;
  /** e.g. "peanut", "sodium_mg_per_serving", "vegan" */
  target?: string;
  /** The original label/record claim; never an inferred ingredient list. */
  statement: string;
  completeness: "complete" | "partial" | "unknown";
  /** Only for precautionary_allergens; no statement supplied is always unknown. */
  precautionaryStatus?: "explicitly_absent_for_target" | "declared_present" | "unknown";
  provenance: ProductEvidenceProvenance;
}

export interface ProductCandidate {
  identity: ProductIdentity;
  facts: readonly ProductFact[];
}

export interface ProductEvidenceNeed {
  kind: ProductFactKind;
  target?: string;
  /** Catalog evidence suffices only when the applicable rule allows it. */
  minimum: "approved_source_record" | "confirmed_current_label";
  maxAgeDays: number;
  acceptedSources?: readonly ApprovedProductEvidenceSource[];
}

export interface ProductHardRequirement {
  id: string; // exact subject-scoped rule identity, not a display label
  type: "allergy" | "alpha_gal" | "pregnancy" | "dietary_identity"
    | "intolerance" | "clinical" | "explicit_avoidance" | "other";
  evidenceNeeds: readonly ProductEvidenceNeed[];
}

export interface ProductRankingFactor {
  id: string;
  type: "optimization" | "preference" | "dislike";
  /** Ranking cannot amend or override any hard requirement. */
  weight: number;
}

export interface ProductEvaluationContext {
  subjectId: string;
  contextFingerprint: string; // current protocol/clinical/plan snapshot
  policyVersion: string; // changes to evidence requirements invalidate assessments
  resolved: boolean;
  /** From the authoritative resolver. If absent or incomplete, do not approve. */
  policyStatus: "resolved" | "unresolved";
  activeHardRestrictionIds: readonly string[];
  evaluatedAt: string;
  identityMaxAgeDays: number;
  hardRequirements: readonly ProductHardRequirement[];
  rankingFactors: readonly ProductRankingFactor[];
}

/**
 * Only a future trusted server validator may issue these assessments after
 * interpreting the actual product facts. The reducer does not infer allergens,
 * nutrient compliance, certifications, or clinical suitability from text.
 */
export interface ProductRuleAssessment {
  requirementId: string;
  subjectId: string;
  contextFingerprint: string;
  policyVersion: string;
  candidateSignature: string;
  outcome: "pass" | "conflict" | "unknown";
  factIds: readonly string[];
  reason: string;
}

export interface ProductRankingAssessment {
  factorId: string;
  score: number;
  reason: string;
}

export type ProductEligibility = "eligible" | "rejected" | "needs_verification";
export type ProductPresentation = "recommended_for_you" | "check_the_label" | "not_shown";

export interface ProductDecisionReason {
  requirementId?: string;
  code: "context_unavailable" | "identity_unverified" | "hard_conflict"
    | "evidence_missing" | "assessment_missing";
  detail: string;
}

export interface ProductEligibilityDecision {
  contractVersion: typeof PRODUCT_CANDIDATE_CONTRACT_VERSION;
  status: ProductEligibility;
  presentation: ProductPresentation;
  /** Neither this nor a label scan is an unconditional guarantee of safety. */
  subjectId: string;
  contextFingerprint: string;
  productKey: string;
  evaluatedAt: string;
  reasons: ProductDecisionReason[];
  ranking: ProductRankingAssessment[];
  /** Rejected or unresolved candidates may prompt continued discovery. */
  continueDiscovery: boolean;
}

export interface ProductSearchIntent {
  requestedFood: string;
  purpose: "drink" | "cooking" | "baking" | "other" | "unknown";
  /** Direct functional alternatives only; no silent change of purpose. */
  searchCategories: readonly {
    category: string;
    adaptationReasonRequirementIds: readonly string[];
    preservesPurpose: boolean;
  }[];
}

/** Future Scan to Check handoff; the receiving flow re-resolves the subject. */
export interface ProductLabelCheckHandoff {
  productKey: string;
  subjectId: string;
  originatingContextFingerprint: string;
  returnTo: "find_product" | "build_a_meal" | "product_scan";
}