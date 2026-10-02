import type { DiabeticGenerationSnapshot } from "@shared/diabeticGenerationSnapshot";

export type BglBucket = "low" | "in-range" | "elevated" | "high";

export interface DiabeticMemoryStamp {
  version: 1;
  generatedBglMgdl: number;
  glucoseContext: string;
  protocolTypeLabel: string;
  bglBucket: BglBucket;
  recommendedBglRange: string;
  generatedAt: string;
  source: "diabetic-builder";
}

export type { DiabeticGenerationSnapshot } from "@shared/diabeticGenerationSnapshot";

export type DiabeticMemoryContext =
  | DiabeticMemoryStamp
  | DiabeticGenerationSnapshot;

/** Read stored evidence only. Never infer provenance from profile or builder state. */
export function getPersistedDiabeticMemory(value: unknown): DiabeticMemoryContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  const validDate = (date: unknown) =>
    typeof date === "string" && date.length > 0 && Number.isFinite(Date.parse(date));
  const hasNumber = typeof m.generatedBglMgdl === "number" &&
    Number.isFinite(m.generatedBglMgdl) && m.generatedBglMgdl > 0;
  if (m.source !== "diabetic-builder" || !validDate(m.generatedAt) ||
      typeof m.protocolTypeLabel !== "string" || !m.protocolTypeLabel.trim() ||
      typeof m.glucoseContext !== "string" || !m.glucoseContext.trim() ||
      typeof m.recommendedBglRange !== "string") return null;
  const numericBucket = ["low", "in-range", "elevated", "high"].includes(String(m.bglBucket));
  // Preserve complete historical v1 records as-is; do not upgrade them.
  if (m.version === 1) {
    return hasNumber && numericBucket ? value as DiabeticMemoryStamp : null;
  }
  if (m.version !== 2 || m.policyVersion !== "diabetic-generation-v2") return null;
  if (m.generatedBglMgdl === null) {
    return (m.glucoseState === "STALE" || m.glucoseState === "NONE") &&
      m.bglBucket === "unavailable" && m.readingRecordedAt === null && m.readingSource === null
      ? value as DiabeticGenerationSnapshot : null;
  }
  return hasNumber && numericBucket &&
    ["LOW", "IN_RANGE", "HIGH"].includes(String(m.glucoseState)) &&
    validDate(m.readingRecordedAt) && (m.readingSource === "LOG" || m.readingSource === "SETTINGS")
    ? value as DiabeticGenerationSnapshot : null;
}

export function projectServerDiabeticMemory(
  meal: { diabeticMemory?: DiabeticMemoryContext | null } | null | undefined,
  isDiabeticWorkflow: boolean,
): { diabeticMemory?: DiabeticMemoryContext } {
  const memory = meal?.diabeticMemory;
  if (!memory) return {};
  if (memory.version === 2) return { diabeticMemory: memory };
  if (memory.version === 1 && isDiabeticWorkflow) return { diabeticMemory: memory };
  return {};
}

export function getBglBucket(bgl: number): BglBucket {
  if (bgl < 70) return "low";
  if (bgl <= 140) return "in-range";
  if (bgl <= 200) return "elevated";
  return "high";
}

export function getProtocolLabel(bucket: BglBucket): string {
  switch (bucket) {
    case "low":       return "Hypoglycemia Support Protocol";
    case "in-range":  return "Glucose Balance Protocol";
    case "elevated":  return "Elevated Glucose Support";
    case "high":      return "High BGL Management Protocol";
  }
}

export function getRecommendedRange(bgl: number): string {
  const bucket = getBglBucket(bgl);
  switch (bucket) {
    case "low":       return "40–70 mg/dL";
    case "in-range":  return "70–140 mg/dL";
    case "elevated":  return "141–200 mg/dL";
    case "high":      return "200–400 mg/dL";
  }
}

export function buildDiabeticMemory(
  latestBgl: number,
  glucoseContext: string
): DiabeticMemoryStamp {
  const bucket = getBglBucket(latestBgl);
  return {
    version: 1,
    generatedBglMgdl: latestBgl,
    glucoseContext,
    protocolTypeLabel: getProtocolLabel(bucket),
    bglBucket: bucket,
    recommendedBglRange: getRecommendedRange(latestBgl),
    generatedAt: new Date().toISOString(),
    source: "diabetic-builder",
  };
}
