import { z } from "zod";

export const PROFESSIONAL_GLUCOSE_PERIODS = [7, 14, 30, 90] as const;
export type ProfessionalGlucosePeriod = (typeof PROFESSIONAL_GLUCOSE_PERIODS)[number];

export const professionalGlucosePeriodSchema = z.coerce
  .number()
  .refine(
    (value): value is ProfessionalGlucosePeriod =>
      PROFESSIONAL_GLUCOSE_PERIODS.includes(value as ProfessionalGlucosePeriod),
    { message: "Period must be one of 7, 14, 30, or 90 days" },
  );

export type ProfessionalGlucoseContext =
  | "FASTED"
  | "PRE_MEAL"
  | "POST_MEAL_1H"
  | "POST_MEAL_2H"
  | "RANDOM";

export interface ProfessionalGlucoseTargetRange {
  minMgdl: number | null;
  maxMgdl: number | null;
  provenance: "diabetes_profile.guardrails";
}

export interface ProfessionalGlucoseReading {
  value: number;
  unit: "mg/dL";
  recordedAt: string;
  context: ProfessionalGlucoseContext;
  patientLocalDate: string;
  patientLocalTime: string;
  patientTimeZone: string;
  note: string | null;
  targetRange: ProfessionalGlucoseTargetRange | null;
  rangeStatus: "in_range" | "above_range" | "below_range" | "unavailable";
}

export interface ProfessionalGlucoseContextSummary {
  context: ProfessionalGlucoseContext;
  averageMgdl: number;
  readingCount: number;
}

export interface ProfessionalGlucoseHistoryResponse {
  periodDays: ProfessionalGlucosePeriod;
  unit: "mg/dL";
  patientTimeZone: string;
  readings: ProfessionalGlucoseReading[];
  latestReading: ProfessionalGlucoseReading | null;
  readingCount: number;
  averagesByContext: ProfessionalGlucoseContextSummary[];
  rangeCounts: {
    inRange: number;
    aboveRange: number;
    belowRange: number;
    unavailable: number;
  };
  targetRanges: Partial<
    Record<ProfessionalGlucoseContext, ProfessionalGlucoseTargetRange>
  >;
  targetStatus: "available" | "unavailable";
  freshness: {
    status: "current" | "stale" | "no_data";
    ageHours: number | null;
    staleAfterHours: number;
  };
  dataStatus: "no_data" | "insufficient_data" | "available";
}

export interface ProfessionalGlucoseClientSummary {
  clientUserId: string;
  latestReading: Omit<ProfessionalGlucoseReading, "note">;
}

export interface ProfessionalGlucoseClientSummariesResponse {
  summaries: ProfessionalGlucoseClientSummary[];
}