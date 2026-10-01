import type { Guardrails } from "../../shared/diabetes-schema";
import type { DiabeticGenerationSnapshot } from "../../shared/diabeticGenerationSnapshot";
import type { DiabeticContext } from "./diabeticContextService";
import {
  resolveUserGlucoseStateWithEvidence,
  type GlucoseStateResolution,
  type GlycemicPreferenceSettings,
} from "./glucoseStateResolver";

export interface DiabetesGenerationProfile {
  type?: string;
  hypoHistory?: boolean | null;
  guardrails?: Guardrails | null;
}

/** Internal authority. Never serialize this object into a public meal response. */
export interface DiabetesGenerationAttempt {
  readonly subjectId: string;
  readonly resolvedAt: string;
  readonly glucose: GlucoseStateResolution;
  readonly context: DiabeticContext;
  readonly profile: DiabetesGenerationProfile | null;
  readonly settings: GlycemicPreferenceSettings | null;
  readonly snapshot: DiabeticGenerationSnapshot;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Pure construction, also used by regression tests without touching a database. */
export function buildDiabetesGenerationAttempt(
  subjectId: string,
  inputs: {
    glucose: GlucoseStateResolution;
    settings: GlycemicPreferenceSettings | null;
    profile: DiabetesGenerationProfile | null;
    readingRecordedAt: string | null;
  },
  now = new Date(),
): DiabetesGenerationAttempt {
  if (!subjectId) throw new Error("A diabetes generation subject is required");
  // Copy inputs: freezing an attempt must not mutate shared resolver/cache state.
  const glucose = { ...inputs.glucose, activePreferences: [...inputs.glucose.activePreferences] };
  const profile = inputs.profile ? JSON.parse(JSON.stringify(inputs.profile)) as DiabetesGenerationProfile : null;
  const settings = inputs.settings ? JSON.parse(JSON.stringify(inputs.settings)) as GlycemicPreferenceSettings : null;
  const fresh = glucose.state === "LOW" || glucose.state === "IN_RANGE" || glucose.state === "HIGH";
  const value = fresh ? glucose.valueMgdl : null;
  const preMeal = glucose.context === "PRE_MEAL" || glucose.context === "FASTED";
  const bucket: DiabeticGenerationSnapshot["bglBucket"] = value === null
    ? "unavailable" : glucose.state === "LOW" ? "low"
      : glucose.state === "IN_RANGE" ? "in-range" : value > 200 ? "high" : "elevated";
  const labels = {
    low: "Hypoglycemia Support Protocol",
    "in-range": "Glucose Balance Protocol",
    elevated: "Elevated Glucose Support",
    high: "High BGL Management Protocol",
    unavailable: "Diabetic Protocol — Current Glucose Unavailable",
  };
  const ranges = {
    low: "Below 70 mg/dL",
    "in-range": preMeal ? "70–120 mg/dL" : "70–140 mg/dL",
    elevated: preMeal ? "Above 120 mg/dL" : "Above 140 mg/dL",
    high: "Above 200 mg/dL",
    unavailable: "No current reading used",
  };
  const context: DiabeticContext = {
    hasDiabetes: Boolean(profile?.type && profile.type !== "NONE"),
    diabetesType: (profile?.type as DiabeticContext["diabetesType"]) || "NONE",
    hypoHistory: Boolean(profile?.hypoHistory),
    latestGlucose: fresh && value !== null && glucose.context ? {
      value,
      context: glucose.context,
      state: glucose.state === "LOW" ? "low" : glucose.state === "HIGH" ? "high-risk" : "in-range",
      recordedAt: new Date(inputs.readingRecordedAt ?? now),
      ageMinutes: glucose.ageMinutes ?? 0,
    } : null,
  };
  return freeze({
    subjectId,
    resolvedAt: now.toISOString(),
    glucose,
    context,
    profile,
    settings,
    snapshot: {
      version: 2,
      generatedBglMgdl: value,
      glucoseContext: glucose.context ?? "RANDOM",
      bglBucket: bucket,
      protocolTypeLabel: labels[bucket],
      recommendedBglRange: ranges[bucket],
      generatedAt: now.toISOString(),
      source: "diabetic-builder",
      readingRecordedAt: fresh ? inputs.readingRecordedAt : null,
      readingSource: fresh ? glucose.source : null,
      glucoseState: glucose.state,
      policyVersion: "diabetic-generation-v2",
    },
  });
}

/** Call only after authorizing the nutrition subject and diabetic operation. */
export async function resolveDiabetesGenerationAttempt(subjectId: string): Promise<DiabetesGenerationAttempt> {
  const { db } = await import("../db");
  const now = new Date();
  const [profile, evidence] = await Promise.all([
    db.query.diabetesProfile.findFirst({ where: (p, { eq }) => eq(p.userId, subjectId) }),
    resolveUserGlucoseStateWithEvidence(subjectId, now),
  ]);
  return buildDiabetesGenerationAttempt(subjectId, {
    ...evidence,
    profile: profile ? {
      type: profile.type,
      hypoHistory: profile.hypoHistory,
      guardrails: profile.guardrails as Guardrails | null,
    } : null,
  }, now);
}

export function assertDiabetesAttemptSubject(attempt: DiabetesGenerationAttempt, subjectId: string): void {
  if (attempt.subjectId !== subjectId) throw new Error("Diabetes generation subject mismatch");
}