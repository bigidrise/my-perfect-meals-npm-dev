import {
  HYDRATION_NUMERIC_POLICY_VERSION,
  evaluateHydrationNumericPolicy,
  type HydrationNumericDirective,
} from "../../shared/hydration/numericPolicy";
import type { HydrationPlanningEligibilityResult } from "../../shared/hydration/contracts";

const eligibility = (
  outcome: HydrationPlanningEligibilityResult["outcome"] = "PLAN_ELIGIBLE",
): HydrationPlanningEligibilityResult => ({
  eligibilityPolicyVersion: "hydration-planning-eligibility-v1",
  policyVersion: "hydration-modifier-registry-v1",
  subjectUserId: "subject-1",
  localDate: "2026-08-27",
  timezone: "America/Chicago",
  outcome,
  numericPlanningPermission: "disabled",
  intakeSnapshotHash: "snapshot-1",
  resolverStatus: "neutral",
  reasons: [],
  provenance: {
    intakeEventIds: [],
    intakeEventFingerprints: [],
    intakeSourceRecordIds: [],
    resolverInputIds: [],
    resolverSourceIds: [],
    policyVersions: {},
  },
});

const directive = (
  values: Partial<HydrationNumericDirective> = {},
): HydrationNumericDirective => ({
  id: "directive-1",
  subjectUserId: "subject-1",
  organizationId: "org-1",
  authorityUserId: "clinician-1",
  targetKind: "point",
  targetMl: 2000,
  minimumMl: null,
  maximumMl: null,
  status: "active",
  effectiveAt: "2026-08-01T00:00:00.000Z",
  reviewAt: "2026-09-15T00:00:00.000Z",
  expiresAt: "2026-10-01T00:00:00.000Z",
  reasonCode: "CLINICIAN_PLAN",
  rationaleCode: "DOCUMENTED_CLINICAL_PLAN",
  sourceReference: "chart:hydration-plan",
  consentReference: "consent:hydration",
  policyVersion: HYDRATION_NUMERIC_POLICY_VERSION,
  ...values,
});

const evaluate = (
  values: Partial<Parameters<typeof evaluateHydrationNumericPolicy>[0]> = {},
) =>
  evaluateHydrationNumericPolicy({
    eligibility: eligibility(),
    consumedMl: 750,
    directive: directive(),
    activationStatus: "development_authorized",
    evaluatedAt: "2026-08-27T12:00:00.000Z",
    ...values,
  });

describe("Hydration numeric policy v0.1", () => {
  it("never creates a number without a clinician directive", () => {
    const result = evaluate({ directive: null });
    expect(result.status).toBe("TRACK_ONLY");
    expect(result.targetMl).toBeNull();
    expect(result.remainingMl).toBeNull();
  });

  it("keeps numeric output inactive when the activation gate is closed", () => {
    const result = evaluate({ activationStatus: "inactive" });
    expect(result.status).toBe("TRACK_ONLY");
    expect(result.reasonCodes).toContain("NUMERIC_POLICY_INACTIVE");
  });

  it("requires PLAN_ELIGIBLE before arithmetic", () => {
    expect(
      evaluate({ eligibility: eligibility("PLAN_WITHHELD") }).status,
    ).toBe("PLAN_WITHHELD");
    expect(
      evaluate({ eligibility: eligibility("NEEDS_REVIEW") }).status,
    ).toBe("NEEDS_REVIEW");
  });

  it("computes a point directive without changing eligibility permission", () => {
    const result = evaluate();
    expect(result.status).toBe("NUMERIC_ACTIVE");
    expect(result.remainingMl).toBe(1250);
    expect(result.progressPercent).toBe(38);
    expect(result.eligibility).toBeUndefined();
  });

  it("preserves range semantics", () => {
    const result = evaluate({
      consumedMl: 1400,
      directive: directive({
        targetKind: "range",
        targetMl: null,
        minimumMl: 1800,
        maximumMl: 2200,
      }),
    });
    expect(result.remainingMl).toBeNull();
    expect(result.remainingToMinimumMl).toBe(400);
    expect(result.headroomToMaximumMl).toBe(800);
    expect(result.progressPercent).toBeNull();
  });

  it("preserves floor and ceiling semantics", () => {
    const floor = evaluate({
      consumedMl: 1000,
      directive: directive({
        targetKind: "floor",
        targetMl: null,
        minimumMl: 1600,
      }),
    });
    const ceiling = evaluate({
      consumedMl: 1000,
      directive: directive({
        targetKind: "ceiling",
        targetMl: null,
        maximumMl: 1500,
      }),
    });
    expect(floor.remainingToMinimumMl).toBe(600);
    expect(ceiling.headroomToMaximumMl).toBe(500);
    expect(ceiling.progressPercent).toBeNull();
  });

  it("fails closed for stale, cross-subject, or malformed directives", () => {
    expect(
      evaluate({ directive: directive({ reviewAt: "2026-08-01T00:00:00.000Z" }) })
        .status,
    ).toBe("NEEDS_REVIEW");
    expect(
      evaluate({ directive: directive({ subjectUserId: "other" }) }).status,
    ).toBe("NEEDS_REVIEW");
    expect(
      evaluate({
        directive: directive({ targetKind: "range", targetMl: null }),
      }).status,
    ).toBe("NEEDS_REVIEW");
  });

  it("fails closed when active directives conflict", () => {
    const result = evaluate({ directiveConflict: true });
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reasonCodes).toContain("MULTIPLE_ACTIVE_DIRECTIVES");
    expect(result.targetMl).toBeNull();
  });
});