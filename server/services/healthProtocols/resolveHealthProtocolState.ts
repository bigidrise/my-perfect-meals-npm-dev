import {
  HEALTH_PROTOCOLS,
  HEALTH_PROTOCOL_SOURCES,
  HEALTH_PROTOCOL_STATUSES,
  type FoodBuilderStrategy,
  type HealthProtocol,
  type HealthProtocolRecord,
} from "../../../shared/healthProtocolState";

export type ProtocolReviewReason =
  | "legacy_unverified"
  | "state_pending_review"
  | "provider_relationship_ended"
  | "provider_relationship_unverified"
  | "lab_acceptance_unverified"
  | "medication_use_unverified"
  | "recommendation_not_accepted";

export interface ProtocolReview {
  protocol: HealthProtocol;
  sourceRecordId: string;
  reason: ProtocolReviewReason;
}

export interface ResolvedHealthProtocolState {
  /** Current source-backed health context, independently of Builder choice. */
  activeHealthContext: HealthProtocol[];
  /** The source IDs responsible for each active protocol; never collapse them. */
  activeSourceIds: Partial<Record<HealthProtocol, string[]>>;
  /** Strategy for this food action, not a diagnosis or medication assertion. */
  builderStrategy: HealthProtocol | null;
  /** Null means an unresolved claim must not produce an unguarded food action. */
  effectiveForFood: HealthProtocol[] | null;
  /** Unresolved claims must be reviewed before this model can own live reads. */
  needsReview: ProtocolReview[];
}

const BUILDER_STRATEGY: Partial<Record<FoodBuilderStrategy, HealthProtocol>> = {
  anti_inflammatory: "anti_inflammatory",
  glp1: "glp1",
  diabetic: "diabetes",
  performance_competition: "performance",
};

/**
 * Deterministic contract for the future stored source-of-truth model.
 *
 * This does not read legacy arrays or change live generation. Until migrated
 * records are reviewed and food surfaces are explicitly switched over, the
 * existing conservative food protection path remains authoritative.
 */
export function resolveHealthProtocolState(input: {
  builder: FoodBuilderStrategy;
  records: readonly HealthProtocolRecord[];
  relationshipStatus: Readonly<Record<string, "active" | "ended">>;
}): ResolvedHealthProtocolState {
  const activeSourceIds: Partial<Record<HealthProtocol, string[]>> = {};
  const needsReview: ProtocolReview[] = [];
  const seen = new Set<string>();

  for (const record of input.records) {
    if (!record.id || seen.has(record.id)) {
      throw new Error("Health protocol source IDs must be unique and nonempty.");
    }
    seen.add(record.id);
    if (!HEALTH_PROTOCOLS.includes(record.protocol)) {
      throw new Error("Unknown health protocol cannot be resolved.");
    }
    if (!HEALTH_PROTOCOL_SOURCES.includes(record.source) ||
        !HEALTH_PROTOCOL_STATUSES.includes(record.status)) {
      throw new Error("Unknown health protocol source or status cannot be resolved.");
    }
    if (record.status === "inactive" || record.status === "historical") continue;

    let reason: ProtocolReviewReason | null = null;
    if (record.source === "legacy_migrated") {
      reason = "legacy_unverified";
    } else if (record.source === "provider") {
      const relationship = record.relationshipId
        ? input.relationshipStatus[record.relationshipId]
        : undefined;
      if (relationship !== "active") {
        reason = relationship === "ended"
          ? "provider_relationship_ended"
          : "provider_relationship_unverified";
      }
    }
    if (!reason && record.status === "pending_review") {
      reason = "state_pending_review";
    } else if (record.source === "lab" && record.acceptedRecommendation !== true) {
      reason = "lab_acceptance_unverified";
    } else if (record.source === "medication" && record.currentMedicationUse !== true) {
      reason = "medication_use_unverified";
    } else if (record.source === "system_recommendation") {
      reason = "recommendation_not_accepted";
    }
    if (reason) {
      needsReview.push({ protocol: record.protocol, sourceRecordId: record.id, reason });
      continue;
    }
    (activeSourceIds[record.protocol] ??= []).push(record.id);
  }

  const activeHealthContext = HEALTH_PROTOCOLS.filter(
    (protocol) => !!activeSourceIds[protocol]?.length,
  );
  const builderStrategy = BUILDER_STRATEGY[input.builder] ?? null;
  return {
    activeHealthContext,
    activeSourceIds,
    builderStrategy,
    effectiveForFood: needsReview.length > 0
      ? null
      : HEALTH_PROTOCOLS.filter(
        (protocol) => activeHealthContext.includes(protocol) || builderStrategy === protocol,
      ),
    needsReview,
  };
}