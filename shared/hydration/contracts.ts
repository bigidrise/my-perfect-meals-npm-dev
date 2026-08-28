/**
 * Hydration Phase 1 domain contracts.
 *
 * These contracts intentionally describe a feature-disabled foundation. They
 * can represent provenance, uncertainty, and future policy inputs, but a
 * Phase 1 plan cannot contain a numeric target or recommendation.
 */

export const HYDRATION_PHASE1_CONTRACT_VERSION = "hydration-foundation-v1";

export const HYDRATION_PLAN_STATUSES = [
  "monitor_only",
  "needs_review",
  "blocked",
] as const;
export type HydrationPlanStatus = (typeof HYDRATION_PLAN_STATUSES)[number];

export const HYDRATION_TARGET_KINDS = ["monitor_only"] as const;
export type HydrationTargetKind = (typeof HYDRATION_TARGET_KINDS)[number];

export const HYDRATION_UNITS = ["ml", "l", "oz", "fl_oz", "cup"] as const;
export type HydrationUnit = (typeof HYDRATION_UNITS)[number];

export const HYDRATION_BEVERAGE_CLASSES = [
  "water",
  "oral_rehydration",
  "electrolyte_drink",
  "coffee",
  "tea",
  "juice",
  "milk",
  "alcohol",
  "other",
  "unknown",
] as const;
export type HydrationBeverageClass =
  (typeof HYDRATION_BEVERAGE_CLASSES)[number];

export const HYDRATION_EVENT_SOURCES = [
  "manual",
  "import",
  "beverage_recipe",
  "wearable",
  "clinician_entry",
  "legacy_manual",
] as const;
export type HydrationEventSource = (typeof HYDRATION_EVENT_SOURCES)[number];

export const HYDRATION_EVENT_LINEAGE_KINDS = ["correction", "void"] as const;
export type HydrationEventLineageKind =
  (typeof HYDRATION_EVENT_LINEAGE_KINDS)[number];

export const HYDRATION_ELECTROLYTE_COVERAGE = [
  "not_tracked",
  "water_only",
  "partial",
  "complete",
] as const;
export type HydrationElectrolyteCoverage =
  (typeof HYDRATION_ELECTROLYTE_COVERAGE)[number];

export const HYDRATION_CONTRIBUTION_METHODS = [
  "unknown",
  "direct_water",
  "declared_beverage",
  "recipe_derived",
  "estimated",
] as const;
export type HydrationContributionMethod =
  (typeof HYDRATION_CONTRIBUTION_METHODS)[number];

export const HYDRATION_CONFIDENCE = [
  "not_available",
  "low",
  "medium",
  "high",
] as const;
export type HydrationConfidence = (typeof HYDRATION_CONFIDENCE)[number];

export type HydrationDeclaredNutrients = {
  sodiumMg?: number;
  potassiumMg?: number;
  magnesiumMg?: number;
  carbohydrateG?: number;
  caffeineMg?: number;
  alcoholUnits?: number;
  source: "label" | "recipe_nutrition" | "database" | "clinician" | "estimated";
  confidence: Exclude<HydrationConfidence, "not_available">;
};

/**
 * This is deliberately a client-submittable contract without any subject
 * identifier. The server derives subject ownership from authentication.
 */
export type HydrationIntakeEventInput = {
  originalAmount: number;
  originalUnit: HydrationUnit;
  occurredAt: string;
  occurredTimezone: string;
  beverageClass: HydrationBeverageClass;
  source?: Extract<HydrationEventSource, "manual" | "import">;
  note?: string;
  idempotencyKey: string;
  clientInstanceId?: string;
  declaredNutrients?: HydrationDeclaredNutrients;
};

export type HydrationIntakeEvent = {
  id: string;
  subjectUserId: string;
  occurredAt: string;
  occurredTimezone: string;
  localDate: string;
  volumeMl: number;
  originalAmount: number;
  originalUnit: HydrationUnit;
  beverageClass: HydrationBeverageClass;
  source: HydrationEventSource;
  sourceEventId?: string;
  idempotencyKey: string;
  payloadHash: string;
  enteredAt: string;
  enteredByUserId: string;
  clientInstanceId?: string;
  observedPlanRevisionId?: string;
  note?: string;
  declaredNutrients?: HydrationDeclaredNutrients;
};

export type HydrationEventSupersession = {
  id: string;
  subjectUserId: string;
  priorEventId: string;
  successorEventId?: string;
  kind: HydrationEventLineageKind;
  reasonCode: string;
  createdAt: string;
  createdByUserId: string;
  correlationId: string;
};

export type HydrationPlanRevision = {
  id: string;
  subjectUserId: string;
  localDate: string;
  timezone: string;
  revision: number;
  status: HydrationPlanStatus;
  targetKind: HydrationTargetKind;
  targetMl: null;
  minimumMl: null;
  maximumMl: null;
  remainingMl: null;
  calculationPolicyVersionId: string;
  inputSnapshotHash: string;
  policyVersionManifest: Record<string, unknown>;
  missingDataCodes: string[];
  rationaleCodes: string[];
  explanationKeys: string[];
  effectiveAt: string;
  createdAt: string;
};

export type HydrationPlanRevisionInputRef = {
  planRevisionId: string;
  inputKind:
    | "baseline"
    | "modifier"
    | "restriction"
    | "clinician_directive"
    | "policy";
  inputId: string;
  inputRevision?: number;
  inputHash?: string;
  disposition: "used" | "withheld" | "missing" | "conflicted";
  reasonCode: string;
};

export type HydrationContribution = {
  id: string;
  eventId: string;
  planRevisionId: string;
  contributionMl: null;
  method: "unknown";
  confidence: "not_available";
  assumptionCodes: string[];
  excludedReason?: string;
  algorithmVersion: string;
  createdAt: string;
};

export type HydrationElectrolyteAccounting = {
  id: string;
  subjectUserId: string;
  localDate: string;
  timezone: string;
  planRevisionId: string;
  coverage: "not_tracked" | "water_only";
  sodiumMg: null;
  potassiumMg: null;
  magnesiumMg: null;
  sourceCount: number;
  warningCodes: string[];
  computedAt: string;
};

export type HydrationDailyState = {
  id: string;
  subjectUserId: string;
  localDate: string;
  timezone: string;
  stateVersion: number;
  effectivePlanRevisionId: string;
  inputWatermark: string;
  activeEventCount: number;
  totalDeclaredVolumeMl: number;
  knownContributionMl: null;
  unknownContributionEventCount: number;
  lastEventAt?: string;
  electrolyteLedgerId: string;
  planStatus: HydrationPlanStatus;
  progressStatus: "unknown";
  computedAt: string;
  calculationPolicyVersionId: string;
  projectionHash: string;
};

export const HYDRATION_MODIFIER_AUTHORITIES = [
  "emergency_safety",
  "clinician",
  "organ_safety",
  "condition_overlay",
  "performance",
  "user_preference",
  "wellness_baseline",
  "analytics_reference",
] as const;
export type HydrationModifierAuthority =
  (typeof HYDRATION_MODIFIER_AUTHORITIES)[number];

export const HYDRATION_MODIFIER_METRICS = [
  "fluid",
  "sodium",
  "electrolyte",
  "caffeine",
  "carbohydrate",
  "timing",
  "general",
] as const;
export type HydrationModifierMetric =
  (typeof HYDRATION_MODIFIER_METRICS)[number];

export const HYDRATION_MODIFIER_EFFECTS = [
  "context_only",
  "supports",
  "limits",
  "blocks",
  "requires_review",
] as const;
export type HydrationModifierEffect =
  (typeof HYDRATION_MODIFIER_EFFECTS)[number];

export const HYDRATION_MODIFIER_SOURCES = [
  "manual",
  "import",
  "wearable",
  "baseline",
  "performance",
  "environment",
  "builder",
  "condition",
  "medication",
  "user_preference",
  "clinician_directive",
  "safety",
  "analytics",
] as const;
export type HydrationModifierSource =
  (typeof HYDRATION_MODIFIER_SOURCES)[number];

export const HYDRATION_MODIFIER_STATUSES = [
  "active",
  "withheld",
  "expired",
] as const;
export type HydrationModifierStatus =
  (typeof HYDRATION_MODIFIER_STATUSES)[number];

export type HydrationRegistryProvenance = {
  sourceRecordId: string;
  sourceTimestamp?: string;
  authorityIdentity?: string;
  protocolRevision?: string;
  populationContext?: string;
};

/**
 * A modifier is a typed claim about future hydration planning, not a plan
 * value. Numeric values are intentionally absent from this Phase 2 contract.
 */
export type HydrationModifierInput = {
  id: string;
  modifierType: string;
  registryDefinitionId?: string;
  registryFamily?: string;
  registryProvenance?: HydrationRegistryProvenance;
  metric: HydrationModifierMetric;
  effect: HydrationModifierEffect;
  authority: HydrationModifierAuthority;
  source: HydrationModifierSource;
  sourceId: string;
  conflictGroup?: string;
  rationaleCode: string;
  policyVersion: string;
  status?: HydrationModifierStatus;
  hardStop?: boolean;
  contextKey?: string;
};

export type HydrationResolvedModifier = HydrationModifierInput & {
  status: "active";
  disposition: "active" | "suppressed";
  suppressionReasonCodes: string[];
  suppressedByInputIds: string[];
};

export type HydrationSuppression = {
  modifierId: string;
  reasonCode: string;
  explanationKey: string;
  byInputIds: string[];
};

export type HydrationNumericPlanGuard = {
  targetMl: null;
  minimumMl: null;
  maximumMl: null;
  remainingMl: null;
  numericPlanAllowed: false;
};

export type HydrationResolvedPolicyState = HydrationNumericPlanGuard & {
  policyVersion: string;
  inputSnapshotHash: string;
  status:
    | "neutral"
    | "context_only"
    | "resolved"
    | "withheld"
    | "needs_review"
    | "blocked";
  activeModifiers: HydrationResolvedModifier[];
  activeRestrictions: HydrationResolvedModifier[];
  suppressedModifiers: HydrationResolvedModifier[];
  suppressions: HydrationSuppression[];
  clinicianDirectiveState:
    | "none"
    | "represented"
    | "withheld_for_conflict"
    | "needs_review";
  potsState:
    | "not_present"
    | "context_only"
    | "clinician_defined"
    | "conflict_review";
  clinicalConflictState: "none" | "detected" | "unresolved";
  escalationRequired: boolean;
  provenance: {
    inputIds: string[];
    sourceIds: string[];
    policyVersion: string;
  };
};

export const HYDRATION_PLANNING_ELIGIBILITY_VERSION =
  "hydration-planning-eligibility-v1";

export const HYDRATION_PLANNING_ELIGIBILITY_OUTCOMES = [
  "PLAN_ELIGIBLE",
  "PLAN_WITHHELD",
  "NEEDS_REVIEW",
] as const;
export type HydrationPlanningEligibilityOutcome =
  (typeof HYDRATION_PLANNING_ELIGIBILITY_OUTCOMES)[number];

export const HYDRATION_PLANNING_ELIGIBILITY_REASON_CODES = [
  "ELIGIBILITY_INPUTS_GOVERNED",
  "ACCESS_NOT_AUTHORIZED",
  "ACCESS_SUBJECT_MISMATCH",
  "ACCESS_AUTHORIZATION_UNAVAILABLE",
  "INTAKE_UNAVAILABLE",
  "INTAKE_PARTIAL",
  "INTAKE_STALE",
  "INTAKE_PROVENANCE_INCOMPLETE",
  "INTAKE_SUBJECT_MISMATCH",
  "INTAKE_SNAPSHOT_INVALID",
  "MISSING_REQUIRED_INPUT",
  "UNSUPPORTED_CONTEXT",
  "REGISTRY_POLICY_NOT_APPROVED",
  "REGISTRY_CLAIM_INVALID",
  "RESOLVER_HARD_STOP",
  "RESOLVER_REVIEW_REQUIRED",
  "RESOLVER_NUMERIC_PERMISSION_VIOLATION",
  "ACTIVE_RESTRICTIONS_PRESENT",
  "MODIFIER_SUPPRESSED",
] as const;
export type HydrationPlanningEligibilityReasonCode =
  (typeof HYDRATION_PLANNING_ELIGIBILITY_REASON_CODES)[number];

export type HydrationCanonicalIntakeSnapshot = {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  source: "canonical_intake_bridge";
  status: "complete" | "partial" | "unavailable";
  snapshotHash: string;
  eventIds: string[];
  eventFingerprints: string[];
  sourceRecordIds: string[];
  observedAt: string;
};

export type HydrationPlanningEligibilityAccess = {
  authenticatedUserId: string;
  subjectUserId: string;
  mode: "self" | "delegated";
  authorizationStatus: "allowed" | "denied" | "unavailable";
  authorizationReference?: string;
};

export type HydrationPlanningEligibilityDataQuality = {
  stale: boolean;
  provenanceComplete: boolean;
  missingDataCodes: string[];
  unsupportedContextCodes: string[];
};

export type HydrationPlanningEligibilityInput = {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  policyVersion: string;
  access: HydrationPlanningEligibilityAccess;
  intake: HydrationCanonicalIntakeSnapshot;
  modifiers: unknown[];
  dataQuality: HydrationPlanningEligibilityDataQuality;
};

export type HydrationPlanningEligibilityReason = {
  code: HydrationPlanningEligibilityReasonCode;
  disposition: "withhold" | "review" | "informational";
  source: "access" | "intake" | "registry" | "resolver" | "eligibility";
  inputIds: string[];
  sourceIds: string[];
  detailCodes?: string[];
};

export type HydrationPlanningEligibilityResult = {
  eligibilityPolicyVersion: string;
  policyVersion: string;
  subjectUserId: string;
  localDate: string;
  timezone: string;
  outcome: HydrationPlanningEligibilityOutcome;
  numericPlanningPermission: "disabled";
  intakeSnapshotHash: string;
  resolverStatus: HydrationResolvedPolicyState["status"] | "unavailable";
  resolverSnapshotHash?: string;
  reasons: HydrationPlanningEligibilityReason[];
  provenance: {
    intakeEventIds: string[];
    intakeEventFingerprints: string[];
    intakeSourceRecordIds: string[];
    resolverInputIds: string[];
    resolverSourceIds: string[];
    policyVersions: Record<string, string>;
  };
};

export type HydrationPhase1PolicyVersion = {
  policyKey: string;
  version: string;
  kind: "foundation_algorithm" | "future_policy_manifest";
  status: "draft" | "withheld" | "retired";
  contentHash: string;
  manifest: Record<string, unknown>;
};

/**
 * A runtime guard for resolver implementations. Keeping this invariant in a
 * shared contract prevents a later resolver from accidentally returning a
 * target-shaped object during the feature-disabled phase.
 */
export function assertPhase1NonnumericPlan(
  plan: Pick<
    HydrationPlanRevision,
    | "status"
    | "targetKind"
    | "targetMl"
    | "minimumMl"
    | "maximumMl"
    | "remainingMl"
  >,
): void {
  if (
    !HYDRATION_PLAN_STATUSES.includes(plan.status) ||
    plan.targetKind !== "monitor_only" ||
    plan.targetMl !== null ||
    plan.minimumMl !== null ||
    plan.maximumMl !== null ||
    plan.remainingMl !== null
  ) {
    throw new Error("HYDRATION_PHASE1_NUMERIC_OUTPUT_FORBIDDEN");
  }
}