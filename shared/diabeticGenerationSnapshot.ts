/**
 * Public, immutable provenance for a newly generated diabetes-aware meal.
 * This contains only the context used by that operation, never the actor,
 * patient identity, profile, or an independently refreshed glucose reading.
 * Version-one browser stamps remain historical data and are not upgraded.
 */
export interface DiabeticGenerationSnapshot {
  readonly version: 2;
  readonly generatedBglMgdl: number | null;
  readonly glucoseContext: string;
  readonly bglBucket: "low" | "in-range" | "elevated" | "high" | "unavailable";
  readonly protocolTypeLabel: string;
  readonly recommendedBglRange: string;
  readonly generatedAt: string;
  readonly source: "diabetic-builder";
  readonly readingRecordedAt: string | null;
  readonly readingSource: "LOG" | "SETTINGS" | null;
  readonly glucoseState: "LOW" | "IN_RANGE" | "HIGH" | "STALE" | "NONE";
  readonly policyVersion: "diabetic-generation-v2";
}