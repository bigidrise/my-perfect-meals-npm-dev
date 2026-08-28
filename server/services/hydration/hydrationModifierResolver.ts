import crypto from "node:crypto";
import { hydrationModifierResolutionInputSchema } from "@shared/hydration/modifierSchemas";
import type {
  HydrationModifierAuthority,
  HydrationModifierInput,
  HydrationResolvedModifier,
  HydrationResolvedPolicyState,
  HydrationSuppression,
} from "@shared/hydration/contracts";

const AUTHORITY_RANK: Record<HydrationModifierAuthority, number> = {
  emergency_safety: 800,
  clinician: 700,
  organ_safety: 600,
  condition_overlay: 500,
  performance: 400,
  user_preference: 300,
  wellness_baseline: 200,
  analytics_reference: 100,
};

const EXPLANATION_KEYS = {
  emergency_safety: "hydration.modifier.suppressed_by_emergency_safety",
  clinician: "hydration.modifier.suppressed_by_clinician_directive",
  organ_safety: "hydration.modifier.suppressed_by_organ_safety",
  condition_overlay: "hydration.modifier.suppressed_by_condition_overlay",
  performance: "hydration.modifier.suppressed_by_performance_context",
  user_preference: "hydration.modifier.suppressed_by_user_preference",
  wellness_baseline: "hydration.modifier.suppressed_by_wellness_baseline",
  analytics_reference: "hydration.modifier.suppressed_by_analytics_reference",
} as const;

const BUILDER_KEYS = [
  "performance_nutrition",
  "diabetic",
  "glp1",
  "anti_inflammatory",
  "pregnancy",
  "fertility",
  "kids",
  "toddlers",
] as const;
export type HydrationBuilderKey = (typeof BUILDER_KEYS)[number];

export type HydrationBuilderContextContribution = Readonly<{
  builder: HydrationBuilderKey;
  sourceId?: string;
  policyVersion?: string;
}>;

export type HydrationModifierResolverInput = Readonly<{
  modifiers?: readonly unknown[];
  policyVersion: string;
}>;

export class HydrationModifierResolverError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "DUPLICATE_ID"
      | "POLICY_VERSION_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "HydrationModifierResolverError";
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

function hashInputs(
  policyVersion: string,
  modifiers: readonly HydrationModifierInput[],
): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          policyVersion,
          modifiers: [...modifiers].sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
        }),
      ),
    )
    .digest("hex");
}

function authorityRank(modifier: HydrationModifierInput): number {
  return AUTHORITY_RANK[modifier.authority];
}

function compareModifiers(
  left: HydrationModifierInput,
  right: HydrationModifierInput,
): number {
  return (
    authorityRank(right) - authorityRank(left) ||
    Number(Boolean(right.hardStop)) - Number(Boolean(left.hardStop)) ||
    left.id.localeCompare(right.id)
  );
}

function isRestriction(modifier: HydrationModifierInput): boolean {
  return (
    modifier.effect === "limits" ||
    modifier.effect === "blocks" ||
    modifier.authority === "emergency_safety" ||
    modifier.authority === "organ_safety" ||
    modifier.modifierType.endsWith("_restriction") ||
    modifier.modifierType.endsWith("_constraint")
  );
}

function affectsSameScope(
  modifier: HydrationModifierInput,
  other: HydrationModifierInput,
): boolean {
  return (
    modifier.metric === other.metric ||
    other.metric === "general" ||
    Boolean(
      modifier.conflictGroup &&
        other.conflictGroup &&
        modifier.conflictGroup === other.conflictGroup,
    )
  );
}

function isPots(modifier: HydrationModifierInput): boolean {
  return modifier.modifierType === "pots";
}

function isClinicianDirective(modifier: HydrationModifierInput): boolean {
  return (
    modifier.authority === "clinician" ||
    modifier.source === "clinician_directive"
  );
}

function suppressionReason(
  winner: HydrationModifierInput,
): string {
  if (winner.authority === "emergency_safety") return "emergency_safety_precedence";
  if (winner.authority === "clinician") return "clinician_directive_precedence";
  if (winner.authority === "organ_safety") return "organ_safety_precedence";
  if (winner.authority === "condition_overlay") return "condition_overlay_precedence";
  return `${winner.authority}_precedence`;
}

function toResolved(
  modifier: HydrationModifierInput,
  disposition: "active" | "suppressed",
  suppressionReasonCodes: string[] = [],
  suppressedByInputIds: string[] = [],
): HydrationResolvedModifier {
  return {
    ...modifier,
    status: "active",
    disposition,
    suppressionReasonCodes,
    suppressedByInputIds,
  };
}

function asSource(modifier: HydrationModifierInput): string {
  return `${modifier.source}:${modifier.sourceId}`;
}

/**
 * Context adapters use this seam to contribute facts without creating
 * builder-specific hydration rules. Every supported builder is context-only
 * until an approved policy gives it a typed effect.
 */
export function createBuilderHydrationContextContribution(
  contribution: HydrationBuilderContextContribution,
): HydrationModifierInput {
  if (!BUILDER_KEYS.includes(contribution.builder)) {
    throw new HydrationModifierResolverError(
      "INVALID_INPUT",
      `Unsupported Hydration builder context: ${String(contribution.builder)}`,
    );
  }
  const sourceId = contribution.sourceId ?? `builder:${contribution.builder}`;
  return {
    id: sourceId,
    modifierType: "builder_context",
    metric: "general",
    effect: "context_only",
    authority: "condition_overlay",
    source: "builder",
    sourceId,
    rationaleCode: `builder_${contribution.builder}_context_only`,
    policyVersion: contribution.policyVersion ?? "hydration-foundation-v1",
    contextKey: contribution.builder,
  };
}

export function createHydrationModifierResolver() {
  return {
    resolve(input: HydrationModifierResolverInput): HydrationResolvedPolicyState {
      let parsedInput;
      try {
        parsedInput = hydrationModifierResolutionInputSchema.parse({
          modifiers: input.modifiers ?? [],
          policyVersion: input.policyVersion,
        });
      } catch (error) {
        throw new HydrationModifierResolverError(
          "INVALID_INPUT",
          error instanceof Error ? error.message : "Invalid modifier resolver input",
        );
      }

      const normalized = parsedInput.modifiers
        .filter((modifier) => modifier.status === "active")
        .sort(compareModifiers);
      const seenIds = new Set<string>();
      for (const modifier of normalized) {
        if (seenIds.has(modifier.id)) {
          throw new HydrationModifierResolverError(
            "DUPLICATE_ID",
            `Hydration modifier ID is duplicated: ${modifier.id}`,
          );
        }
        seenIds.add(modifier.id);
        if (modifier.policyVersion !== parsedInput.policyVersion) {
          throw new HydrationModifierResolverError(
            "POLICY_VERSION_MISMATCH",
            `Hydration modifier ${modifier.id} uses policy ${modifier.policyVersion}; expected ${parsedInput.policyVersion}`,
          );
        }
      }

      const restrictions = normalized.filter(isRestriction);
      const activeRestrictions = restrictions.map((modifier) =>
        toResolved(modifier, "active"),
      );
      const suppressions: HydrationSuppression[] = [];
      const activeModifiers: HydrationResolvedModifier[] = [];
      const suppressedModifiers: HydrationResolvedModifier[] = [];

      for (const modifier of normalized) {
        if (isRestriction(modifier)) continue;

        const blockers = restrictions.filter(
          (restriction) =>
            affectsSameScope(modifier, restriction) &&
            (modifier.effect !== "context_only" || isPots(modifier)) &&
            (authorityRank(restriction) > authorityRank(modifier) ||
              (isPots(modifier) &&
                (restriction.authority === "organ_safety" ||
                  restriction.authority === "emergency_safety"))),
        );
        const higherPriorityClaims = normalized.filter(
          (candidate) =>
            candidate.id !== modifier.id &&
            !isRestriction(candidate) &&
            isClinicianDirective(candidate) &&
            modifier.effect !== "context_only" &&
            authorityRank(candidate) > authorityRank(modifier) &&
            affectsSameScope(modifier, candidate),
        );
        const conflictBlockers = [...blockers, ...higherPriorityClaims].sort(
          compareModifiers,
        );

        if (conflictBlockers.length > 0) {
          const reasonCode = suppressionReason(conflictBlockers[0]);
          const byInputIds = conflictBlockers.map((blocker) => blocker.id);
          const suppressed = toResolved(
            modifier,
            "suppressed",
            [reasonCode],
            byInputIds,
          );
          suppressedModifiers.push(suppressed);
          suppressions.push({
            modifierId: modifier.id,
            reasonCode,
            explanationKey: EXPLANATION_KEYS[conflictBlockers[0].authority],
            byInputIds,
          });
        } else {
          activeModifiers.push(toResolved(modifier, "active"));
        }
      }

      const potsClaims = normalized.filter(isPots);
      const activePots = activeModifiers.filter(isPots);
      const suppressedPots = suppressedModifiers.filter(isPots);
      const potsState =
        potsClaims.length === 0
          ? "not_present"
          : suppressedPots.length > 0
            ? "conflict_review"
            : activePots.some(isClinicianDirective)
              ? "clinician_defined"
              : "context_only";

      const clinicianClaims = normalized.filter(isClinicianDirective);
      const clinicianDirectiveState =
        clinicianClaims.length === 0
          ? "none"
          : suppressedModifiers.some((modifier) =>
                clinicianClaims.some((claim) => claim.id === modifier.id),
              )
            ? "needs_review"
            : suppressedPots.length > 0
              ? "withheld_for_conflict"
              : "represented";

      const hasConflict = suppressions.length > 0;
      const hasHardStop = restrictions.some(
        (restriction) =>
          restriction.hardStop ||
          restriction.effect === "blocks" ||
          restriction.authority === "emergency_safety",
      );
      const hasReviewClaim = normalized.some(
        (modifier) => modifier.effect === "requires_review",
      );
      const hasHardConflict = hasHardStop || normalized.some(
        (modifier) =>
          modifier.hardStop &&
          suppressedModifiers.some(
            (suppressed) =>
              suppressed.id === modifier.id ||
              suppressed.suppressedByInputIds.includes(modifier.id),
          ),
      );
      const escalationRequired =
        hasHardConflict ||
        hasReviewClaim ||
        potsState === "conflict_review" ||
        clinicianDirectiveState === "needs_review";
      const status = hasHardConflict
        ? "blocked"
        : escalationRequired
          ? "needs_review"
          : hasConflict
            ? "withheld"
          : activeModifiers.length === 0 && activeRestrictions.length === 0
            ? "neutral"
            : activeModifiers.some(
                  (modifier) => modifier.effect !== "context_only",
                )
              ? "resolved"
              : "context_only";

      const inputIds = normalized.map((modifier) => modifier.id).sort();
      const sourceIds = normalized.map(asSource).sort();
      return {
        policyVersion: parsedInput.policyVersion,
        inputSnapshotHash: hashInputs(parsedInput.policyVersion, normalized),
        status,
        activeModifiers,
        activeRestrictions,
        suppressedModifiers,
        suppressions,
        clinicianDirectiveState,
        potsState,
        clinicalConflictState: escalationRequired
          ? "unresolved"
          : hasConflict
            ? "detected"
            : "none",
        escalationRequired,
        provenance: {
          inputIds,
          sourceIds,
          policyVersion: parsedInput.policyVersion,
        },
        targetMl: null,
        minimumMl: null,
        maximumMl: null,
        remainingMl: null,
        numericPlanAllowed: false,
      };
    },
  };
}

export const hydrationModifierResolver = createHydrationModifierResolver();