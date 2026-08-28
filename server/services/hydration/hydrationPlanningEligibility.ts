import crypto from "node:crypto";
import {
  hydrationCanonicalIntakeSnapshotSchema,
  hydrationPlanningEligibilityInputSchema,
  hydrationPlanningEligibilityResultSchema,
} from "@shared/hydration/schemas";
import { hydrationModifierInputSchema } from "@shared/hydration/modifierSchemas";
import {
  HYDRATION_MODIFIER_REGISTRY_VERSION,
  assertHydrationModifierMatchesRegistry,
} from "@shared/hydration/modifierRegistry";
import {
  HYDRATION_PLANNING_ELIGIBILITY_VERSION,
  type HydrationCanonicalIntakeSnapshot,
  type HydrationIntakeEvent,
  type HydrationModifierInput,
  type HydrationPlanningEligibilityInput,
  type HydrationPlanningEligibilityReason,
  type HydrationPlanningEligibilityResult,
  type HydrationResolvedPolicyState,
} from "@shared/hydration/contracts";
import { hydrationModifierResolver } from "./hydrationModifierResolver";

type SnapshotEvent = Pick<
  HydrationIntakeEvent,
  | "id"
  | "subjectUserId"
  | "localDate"
  | "occurredTimezone"
  | "source"
  | "sourceEventId"
  | "payloadHash"
  | "occurredAt"
  | "enteredAt"
>;

export type CreateHydrationCanonicalIntakeSnapshotInput = Readonly<{
  subjectUserId: string;
  localDate: string;
  timezone: string;
  status: HydrationCanonicalIntakeSnapshot["status"];
  observedAt: string;
  events: readonly SnapshotEvent[];
}>;

export class HydrationPlanningEligibilityError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "HydrationPlanningEligibilityError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function hashCanonical(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function hashSnapshot(
  input: Omit<HydrationCanonicalIntakeSnapshot, "snapshotHash">,
): string {
  return hashCanonical(input);
}

export function createHydrationCanonicalIntakeSnapshot(
  input: CreateHydrationCanonicalIntakeSnapshotInput,
): HydrationCanonicalIntakeSnapshot {
  if (
    input.events.some(
      (event) => event.subjectUserId !== input.subjectUserId,
    )
  ) {
    throw new HydrationPlanningEligibilityError(
      "INVALID_INPUT",
      "Canonical Hydration intake snapshot contains a cross-subject event",
    );
  }
  const records = [...input.events]
    .map((event) => ({
      id: event.id,
      subjectUserId: event.subjectUserId,
      localDate: event.localDate,
      occurredTimezone: event.occurredTimezone,
      source: event.source,
      sourceEventId: event.sourceEventId,
      payloadHash: event.payloadHash,
      occurredAt: event.occurredAt,
      enteredAt: event.enteredAt,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const snapshotWithoutHash = {
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    source: "canonical_intake_bridge" as const,
    status: input.status,
    eventIds: records.map((event) => event.id),
    eventFingerprints: records.map((event) => hashCanonical(event)),
    sourceRecordIds: sortedUnique(
      records.map((event) => event.sourceEventId ?? event.id),
    ),
    observedAt: input.observedAt,
  };
  const snapshot = {
    ...snapshotWithoutHash,
    snapshotHash: hashSnapshot(snapshotWithoutHash),
  };

  try {
    return hydrationCanonicalIntakeSnapshotSchema.parse(snapshot) as HydrationCanonicalIntakeSnapshot;
  } catch (error) {
    throw new HydrationPlanningEligibilityError(
      "INVALID_INPUT",
      error instanceof Error
        ? error.message
        : "Invalid canonical Hydration intake snapshot",
    );
  }
}

function createReason(
  code: HydrationPlanningEligibilityReason["code"],
  disposition: HydrationPlanningEligibilityReason["disposition"],
  source: HydrationPlanningEligibilityReason["source"],
  inputIds: readonly string[] = [],
  sourceIds: readonly string[] = [],
  detailCodes?: readonly string[],
): HydrationPlanningEligibilityReason {
  return {
    code,
    disposition,
    source,
    inputIds: sortedUnique(inputIds),
    sourceIds: sortedUnique(sourceIds),
    ...(detailCodes && detailCodes.length > 0
      ? { detailCodes: sortedUnique(detailCodes) }
      : {}),
  };
}

function parseEligibilityInput(
  input: HydrationPlanningEligibilityInput,
): HydrationPlanningEligibilityInput {
  try {
    return hydrationPlanningEligibilityInputSchema.parse(
      input,
    ) as HydrationPlanningEligibilityInput;
  } catch (error) {
    throw new HydrationPlanningEligibilityError(
      "INVALID_INPUT",
      error instanceof Error
        ? error.message
        : "Invalid Hydration planning eligibility input",
    );
  }
}

function hasDuplicateIds(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function accessReasons(
  input: HydrationPlanningEligibilityInput,
): HydrationPlanningEligibilityReason[] {
  const reasons: HydrationPlanningEligibilityReason[] = [];
  const access = input.access;

  if (access.authorizationStatus === "unavailable") {
    reasons.push(
      createReason(
        "ACCESS_AUTHORIZATION_UNAVAILABLE",
        "review",
        "access",
      ),
    );
  } else if (access.authorizationStatus !== "allowed") {
    reasons.push(createReason("ACCESS_NOT_AUTHORIZED", "review", "access"));
  }

  if (access.subjectUserId !== input.subjectUserId) {
    reasons.push(
      createReason(
        "ACCESS_SUBJECT_MISMATCH",
        "review",
        "access",
        [input.subjectUserId, access.subjectUserId],
      ),
    );
  }

  if (
    access.mode === "self" &&
    access.authenticatedUserId !== input.subjectUserId
  ) {
    reasons.push(
      createReason(
        "ACCESS_SUBJECT_MISMATCH",
        "review",
        "access",
        [input.subjectUserId, access.authenticatedUserId],
      ),
    );
  }

  if (
    access.mode === "delegated" &&
    access.authorizationStatus === "allowed" &&
    !access.authorizationReference
  ) {
    reasons.push(
      createReason(
        "ACCESS_NOT_AUTHORIZED",
        "review",
        "access",
        [input.subjectUserId],
      ),
    );
  }

  return reasons;
}

function intakeReasons(
  input: HydrationPlanningEligibilityInput,
): HydrationPlanningEligibilityReason[] {
  const reasons: HydrationPlanningEligibilityReason[] = [];
  const intake = input.intake;
  const eventIds = intake.eventIds;
  const eventFingerprints = intake.eventFingerprints;
  const sourceRecordIds = intake.sourceRecordIds;

  if (intake.subjectUserId !== input.subjectUserId) {
    reasons.push(
      createReason(
        "INTAKE_SUBJECT_MISMATCH",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (intake.localDate !== input.localDate || intake.timezone !== input.timezone) {
    reasons.push(
      createReason(
        "INTAKE_SNAPSHOT_INVALID",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (!intake.snapshotHash) {
    reasons.push(
      createReason(
        "INTAKE_SNAPSHOT_INVALID",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  const expectedSnapshotHash = hashSnapshot({
    subjectUserId: intake.subjectUserId,
    localDate: intake.localDate,
    timezone: intake.timezone,
    source: intake.source,
    status: intake.status,
    eventIds: intake.eventIds,
    eventFingerprints: intake.eventFingerprints,
    sourceRecordIds: intake.sourceRecordIds,
    observedAt: intake.observedAt,
  });
  if (
    intake.snapshotHash !== expectedSnapshotHash ||
    eventFingerprints.length !== eventIds.length ||
    hasDuplicateIds(eventIds) ||
    hasDuplicateIds(sourceRecordIds)
  ) {
    reasons.push(
      createReason(
        "INTAKE_SNAPSHOT_INVALID",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (intake.status === "unavailable") {
    reasons.push(
      createReason(
        "INTAKE_UNAVAILABLE",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  } else if (intake.status === "partial") {
    reasons.push(
      createReason(
        "INTAKE_PARTIAL",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (input.dataQuality.stale) {
    reasons.push(
      createReason(
        "INTAKE_STALE",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (!input.dataQuality.provenanceComplete) {
    reasons.push(
      createReason(
        "INTAKE_PROVENANCE_INCOMPLETE",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
      ),
    );
  }
  if (input.dataQuality.missingDataCodes.length > 0) {
    reasons.push(
      createReason(
        "MISSING_REQUIRED_INPUT",
        "review",
        "intake",
        eventIds,
        sourceRecordIds,
        input.dataQuality.missingDataCodes,
      ),
    );
  }

  return reasons;
}

function registryReasons(
  input: HydrationPlanningEligibilityInput,
): HydrationPlanningEligibilityReason[] {
  const reasons: HydrationPlanningEligibilityReason[] = [];

  if (input.policyVersion !== HYDRATION_MODIFIER_REGISTRY_VERSION) {
    reasons.push(
      createReason(
        "REGISTRY_POLICY_NOT_APPROVED",
        "review",
        "registry",
        [],
        [],
        [input.policyVersion],
      ),
    );
  }

  for (const rawModifier of input.modifiers) {
    const inputId =
      rawModifier &&
      typeof rawModifier === "object" &&
      typeof (rawModifier as { id?: unknown }).id === "string"
        ? [(rawModifier as { id: string }).id]
        : [];
    try {
      const modifier = hydrationModifierInputSchema.parse(
        rawModifier,
      ) as HydrationModifierInput;
      assertHydrationModifierMatchesRegistry(modifier);
    } catch {
      reasons.push(
        createReason(
          "REGISTRY_CLAIM_INVALID",
          "review",
          "registry",
          inputId,
        ),
      );
    }
  }

  return reasons;
}

export function evaluateHydrationPlanningEligibility(
  input: HydrationPlanningEligibilityInput,
): HydrationPlanningEligibilityResult {
  const parsed = parseEligibilityInput(input);
  const reasons = [
    ...accessReasons(parsed),
    ...intakeReasons(parsed),
    ...registryReasons(parsed),
  ];
  const intake = parsed.intake;
  const resolverInputIds = [...parsed.modifiers]
    .filter(
      (modifier): modifier is { id: string } =>
        Boolean(modifier) &&
        typeof modifier === "object" &&
        typeof (modifier as { id?: unknown }).id === "string",
    )
    .map((modifier) => modifier.id);
  let resolution: HydrationResolvedPolicyState | undefined;

  try {
    resolution = hydrationModifierResolver.resolve({
      modifiers: parsed.modifiers,
      policyVersion: parsed.policyVersion,
    });
  } catch {
    reasons.push(
      createReason(
        "RESOLVER_REVIEW_REQUIRED",
        "review",
        "resolver",
        resolverInputIds,
      ),
    );
  }

  if (parsed.dataQuality.unsupportedContextCodes.length > 0) {
    reasons.push(
      createReason(
        "UNSUPPORTED_CONTEXT",
        "withhold",
        "eligibility",
        [],
        [],
        parsed.dataQuality.unsupportedContextCodes,
      ),
    );
  }

  const resolverSourceIds = resolution?.provenance.sourceIds ?? [];
  if (resolution) {
    if (resolution.numericPlanAllowed !== false) {
      reasons.push(
        createReason(
          "RESOLVER_NUMERIC_PERMISSION_VIOLATION",
          "review",
          "resolver",
          resolution.provenance.inputIds,
          resolverSourceIds,
        ),
      );
    }
    if (resolution.status === "blocked") {
      reasons.push(
        createReason(
          "RESOLVER_HARD_STOP",
          "withhold",
          "resolver",
          resolution.provenance.inputIds,
          resolverSourceIds,
        ),
      );
    } else if (
      resolution.escalationRequired ||
      resolution.clinicalConflictState === "unresolved" ||
      resolution.status === "needs_review"
    ) {
      reasons.push(
        createReason(
          "RESOLVER_REVIEW_REQUIRED",
          "review",
          "resolver",
          resolution.provenance.inputIds,
          resolverSourceIds,
        ),
      );
    }
    if (resolution.activeRestrictions.length > 0) {
      reasons.push(
        createReason(
          "ACTIVE_RESTRICTIONS_PRESENT",
          "informational",
          "resolver",
          resolution.activeRestrictions.map((restriction) => restriction.id),
          resolution.activeRestrictions.map(
            (restriction) => `${restriction.source}:${restriction.sourceId}`,
          ),
        ),
      );
    }
    if (resolution.suppressedModifiers.length > 0) {
      reasons.push(
        createReason(
          "MODIFIER_SUPPRESSED",
          "informational",
          "resolver",
          resolution.suppressedModifiers.map((modifier) => modifier.id),
          resolution.suppressedModifiers.flatMap((modifier) => [
            `${modifier.source}:${modifier.sourceId}`,
            ...modifier.suppressedByInputIds,
          ]),
        ),
      );
    }
  }

  const hasWithhold = reasons.some(
    (reason) => reason.disposition === "withhold",
  );
  const hasReview = reasons.some((reason) => reason.disposition === "review");
  const outcome = hasWithhold
    ? "PLAN_WITHHELD"
    : hasReview
      ? "NEEDS_REVIEW"
      : "PLAN_ELIGIBLE";

  if (outcome === "PLAN_ELIGIBLE") {
    reasons.push(
      createReason(
        "ELIGIBILITY_INPUTS_GOVERNED",
        "informational",
        "eligibility",
        [...intake.eventIds, ...(resolution?.provenance.inputIds ?? [])],
        [
          ...intake.sourceRecordIds,
          ...(resolution?.provenance.sourceIds ?? []),
        ],
      ),
    );
  }

  const result: HydrationPlanningEligibilityResult = {
    eligibilityPolicyVersion: HYDRATION_PLANNING_ELIGIBILITY_VERSION,
    policyVersion: parsed.policyVersion,
    subjectUserId: parsed.subjectUserId,
    localDate: parsed.localDate,
    timezone: parsed.timezone,
    outcome,
    numericPlanningPermission: "disabled",
    intakeSnapshotHash: intake.snapshotHash,
    resolverStatus: resolution?.status ?? "unavailable",
    ...(resolution ? { resolverSnapshotHash: resolution.inputSnapshotHash } : {}),
    reasons,
    provenance: {
      intakeEventIds: sortedUnique(intake.eventIds),
      intakeEventFingerprints: sortedUnique(intake.eventFingerprints),
      intakeSourceRecordIds: sortedUnique(intake.sourceRecordIds),
      resolverInputIds: sortedUnique(resolution?.provenance.inputIds ?? resolverInputIds),
      resolverSourceIds: sortedUnique(resolverSourceIds),
      policyVersions: {
        eligibility: HYDRATION_PLANNING_ELIGIBILITY_VERSION,
        resolver: parsed.policyVersion,
      },
    },
  };

  try {
    return hydrationPlanningEligibilityResultSchema.parse(
      result,
    ) as HydrationPlanningEligibilityResult;
  } catch (error) {
    throw new HydrationPlanningEligibilityError(
      "INVALID_INPUT",
      error instanceof Error
        ? error.message
        : "Invalid Hydration planning eligibility result",
    );
  }
}