import type { HydrationPlanningEligibilityResult } from "./contracts";

export const HYDRATION_NUMERIC_POLICY_VERSION =
  "MPM-HYDRATION-NUMERIC-POLICY-v0.1";

export const HYDRATION_DIRECTIVE_TARGET_KINDS = [
  "point",
  "range",
  "floor",
  "ceiling",
] as const;

export type HydrationDirectiveTargetKind =
  (typeof HYDRATION_DIRECTIVE_TARGET_KINDS)[number];

export type HydrationNumericDirective = Readonly<{
  id: string;
  subjectUserId: string;
  organizationId: string;
  authorityUserId: string;
  targetKind: HydrationDirectiveTargetKind;
  targetMl: number | null;
  minimumMl: number | null;
  maximumMl: number | null;
  status: "active" | "revoked" | "superseded";
  effectiveAt: string;
  reviewAt: string;
  expiresAt: string;
  reasonCode: string;
  rationaleCode: string;
  sourceReference: string;
  consentReference: string;
  policyVersion: typeof HYDRATION_NUMERIC_POLICY_VERSION;
}>;

export type HydrationNumericPolicyStatus =
  | "TRACK_ONLY"
  | "NUMERIC_ACTIVE"
  | "PLAN_WITHHELD"
  | "NEEDS_REVIEW";

export type HydrationNumericPolicyResult = Readonly<{
  policyVersion: typeof HYDRATION_NUMERIC_POLICY_VERSION;
  status: HydrationNumericPolicyStatus;
  targetKind: HydrationDirectiveTargetKind | null;
  consumedMl: number;
  targetMl: number | null;
  minimumMl: number | null;
  maximumMl: number | null;
  remainingMl: number | null;
  remainingToMinimumMl: number | null;
  headroomToMaximumMl: number | null;
  progressPercent: number | null;
  reasonCodes: string[];
  directiveId: string | null;
  intakeSnapshotHash: string;
}>;

export type EvaluateHydrationNumericPolicyInput = Readonly<{
  eligibility: HydrationPlanningEligibilityResult;
  consumedMl: number;
  directive?: HydrationNumericDirective | null;
  directiveConflict?: boolean;
  activationStatus: "development_authorized" | "inactive";
  evaluatedAt: string;
}>;

function emptyResult(
  input: EvaluateHydrationNumericPolicyInput,
  status: HydrationNumericPolicyStatus,
  reasonCodes: string[],
): HydrationNumericPolicyResult {
  return {
    policyVersion: HYDRATION_NUMERIC_POLICY_VERSION,
    status,
    targetKind: null,
    consumedMl: input.consumedMl,
    targetMl: null,
    minimumMl: null,
    maximumMl: null,
    remainingMl: null,
    remainingToMinimumMl: null,
    headroomToMaximumMl: null,
    progressPercent: null,
    reasonCodes,
    directiveId: null,
    intakeSnapshotHash: input.eligibility.intakeSnapshotHash,
  };
}

function isPositiveInteger(value: number | null): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validateDirective(
  directive: HydrationNumericDirective,
  input: EvaluateHydrationNumericPolicyInput,
): string[] {
  const reasons: string[] = [];
  const evaluatedAt = new Date(input.evaluatedAt);
  const effectiveAt = new Date(directive.effectiveAt);
  const reviewAt = new Date(directive.reviewAt);
  const expiresAt = new Date(directive.expiresAt);

  if (directive.subjectUserId !== input.eligibility.subjectUserId) {
    reasons.push("DIRECTIVE_SUBJECT_MISMATCH");
  }
  if (directive.policyVersion !== HYDRATION_NUMERIC_POLICY_VERSION) {
    reasons.push("DIRECTIVE_POLICY_VERSION_MISMATCH");
  }
  if (directive.status !== "active") reasons.push("DIRECTIVE_NOT_ACTIVE");
  if (
    [evaluatedAt, effectiveAt, reviewAt, expiresAt].some((date) =>
      Number.isNaN(date.getTime()),
    )
  ) {
    reasons.push("DIRECTIVE_DATE_INVALID");
  } else {
    if (effectiveAt > evaluatedAt) reasons.push("DIRECTIVE_NOT_YET_EFFECTIVE");
    if (reviewAt <= evaluatedAt) reasons.push("DIRECTIVE_REVIEW_DUE");
    if (expiresAt <= evaluatedAt) reasons.push("DIRECTIVE_EXPIRED");
    if (reviewAt > expiresAt) reasons.push("DIRECTIVE_REVIEW_AFTER_EXPIRY");
  }
  if (
    !directive.organizationId ||
    !directive.authorityUserId ||
    !directive.reasonCode ||
    !directive.rationaleCode ||
    !directive.sourceReference ||
    !directive.consentReference
  ) {
    reasons.push("DIRECTIVE_PROVENANCE_INCOMPLETE");
  }

  if (
    directive.targetKind === "point" &&
    (!isPositiveInteger(directive.targetMl) ||
      directive.minimumMl !== null ||
      directive.maximumMl !== null)
  ) {
    reasons.push("DIRECTIVE_POINT_INVALID");
  }
  if (
    directive.targetKind === "range" &&
    (!isPositiveInteger(directive.minimumMl) ||
      !isPositiveInteger(directive.maximumMl) ||
      directive.minimumMl > directive.maximumMl ||
      directive.targetMl !== null)
  ) {
    reasons.push("DIRECTIVE_RANGE_INVALID");
  }
  if (
    directive.targetKind === "floor" &&
    (!isPositiveInteger(directive.minimumMl) ||
      directive.targetMl !== null ||
      directive.maximumMl !== null)
  ) {
    reasons.push("DIRECTIVE_FLOOR_INVALID");
  }
  if (
    directive.targetKind === "ceiling" &&
    (!isPositiveInteger(directive.maximumMl) ||
      directive.targetMl !== null ||
      directive.minimumMl !== null)
  ) {
    reasons.push("DIRECTIVE_CEILING_INVALID");
  }

  return reasons;
}

function percent(consumedMl: number, denominatorMl: number): number {
  return Math.round(Math.min(100, (consumedMl / denominatorMl) * 100));
}

/**
 * Numeric planning is deliberately separate from planning eligibility.
 * PLAN_ELIGIBLE is necessary but never sufficient: activation and a current,
 * provenance-complete clinician directive are also mandatory.
 */
export function evaluateHydrationNumericPolicy(
  input: EvaluateHydrationNumericPolicyInput,
): HydrationNumericPolicyResult {
  if (!Number.isSafeInteger(input.consumedMl) || input.consumedMl < 0) {
    return emptyResult(input, "NEEDS_REVIEW", ["INTAKE_TOTAL_INVALID"]);
  }
  if (input.activationStatus !== "development_authorized") {
    return emptyResult(input, "TRACK_ONLY", ["NUMERIC_POLICY_INACTIVE"]);
  }
  if (input.eligibility.outcome === "PLAN_WITHHELD") {
    return emptyResult(input, "PLAN_WITHHELD", [
      "ELIGIBILITY_WITHHELD",
      ...input.eligibility.reasons.map((reason) => reason.code),
    ]);
  }
  if (input.eligibility.outcome === "NEEDS_REVIEW") {
    return emptyResult(input, "NEEDS_REVIEW", [
      "ELIGIBILITY_NEEDS_REVIEW",
      ...input.eligibility.reasons.map((reason) => reason.code),
    ]);
  }
  if (input.directiveConflict) {
    return emptyResult(input, "NEEDS_REVIEW", [
      "MULTIPLE_ACTIVE_DIRECTIVES",
    ]);
  }
  if (!input.directive) {
    return emptyResult(input, "TRACK_ONLY", [
      "NO_CLINICIAN_DIRECTIVE",
    ]);
  }

  const directiveReasons = validateDirective(input.directive, input);
  if (directiveReasons.length > 0) {
    return emptyResult(input, "NEEDS_REVIEW", directiveReasons);
  }

  const directive = input.directive;
  const base: HydrationNumericPolicyResult = {
    policyVersion: HYDRATION_NUMERIC_POLICY_VERSION,
    status: "NUMERIC_ACTIVE" as const,
    targetKind: directive.targetKind,
    consumedMl: input.consumedMl,
    targetMl: directive.targetMl,
    minimumMl: directive.minimumMl,
    maximumMl: directive.maximumMl,
    remainingMl: null,
    remainingToMinimumMl: null,
    headroomToMaximumMl: null,
    progressPercent: null,
    reasonCodes: ["AUTHORIZED_CLINICIAN_DIRECTIVE"],
    directiveId: directive.id,
    intakeSnapshotHash: input.eligibility.intakeSnapshotHash,
  };

  if (directive.targetKind === "point") {
    const targetMl = directive.targetMl as number;
    return {
      ...base,
      remainingMl: Math.max(0, targetMl - input.consumedMl),
      progressPercent: percent(input.consumedMl, targetMl),
    };
  }
  if (directive.targetKind === "range") {
    const minimumMl = directive.minimumMl as number;
    const maximumMl = directive.maximumMl as number;
    return {
      ...base,
      remainingToMinimumMl: Math.max(0, minimumMl - input.consumedMl),
      headroomToMaximumMl: Math.max(0, maximumMl - input.consumedMl),
    };
  }
  if (directive.targetKind === "floor") {
    const minimumMl = directive.minimumMl as number;
    return {
      ...base,
      remainingToMinimumMl: Math.max(0, minimumMl - input.consumedMl),
      progressPercent: percent(input.consumedMl, minimumMl),
    };
  }

  const maximumMl = directive.maximumMl as number;
  return {
    ...base,
    headroomToMaximumMl: Math.max(0, maximumMl - input.consumedMl),
  };
}