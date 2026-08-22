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