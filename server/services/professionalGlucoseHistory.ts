import type { Guardrails } from "@shared/diabetes-schema";
import type {
  ProfessionalGlucoseContext,
  ProfessionalGlucoseHistoryResponse,
  ProfessionalGlucosePeriod,
  ProfessionalGlucoseReading,
  ProfessionalGlucoseTargetRange,
} from "@shared/professionalGlucose";

export const PROFESSIONAL_GLUCOSE_STALE_AFTER_HOURS = 7 * 24;

export function getProfessionalGlucoseWindowStart(
  periodDays: ProfessionalGlucosePeriod,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
}

export interface RawProfessionalGlucoseReading {
  valueMgdl: number;
  context: ProfessionalGlucoseContext;
  recordedAt: Date | string;
  notes?: string | null;
}

function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function patientLocalParts(
  recordedAt: Date,
  timeZone: string,
): { date: string; time: string } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(recordedAt);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(recordedAt);
  return { date, time };
}

export function buildProfessionalGlucoseTargetRanges(
  guardrails: Guardrails | null | undefined,
): Partial<
  Record<ProfessionalGlucoseContext, ProfessionalGlucoseTargetRange>
> {
  if (!guardrails) return {};

  const targets: Partial<
    Record<ProfessionalGlucoseContext, ProfessionalGlucoseTargetRange>
  > = {};

  if (
    guardrails.fastingMin !== undefined ||
    guardrails.fastingMax !== undefined
  ) {
    targets.FASTED = {
      minMgdl: guardrails.fastingMin ?? null,
      maxMgdl: guardrails.fastingMax ?? null,
      provenance: "diabetes_profile.guardrails",
    };
  }

  if (guardrails.postMealMax !== undefined) {
    const postMealTarget: ProfessionalGlucoseTargetRange = {
      minMgdl: null,
      maxMgdl: guardrails.postMealMax,
      provenance: "diabetes_profile.guardrails",
    };
    targets.POST_MEAL_1H = postMealTarget;
    targets.POST_MEAL_2H = postMealTarget;
  }

  return targets;
}

export function classifyProfessionalGlucoseReading(
  value: number,
  target: ProfessionalGlucoseTargetRange | null | undefined,
): ProfessionalGlucoseReading["rangeStatus"] {
  if (!target) return "unavailable";
  if (target.minMgdl !== null && value < target.minMgdl) return "below_range";
  if (target.maxMgdl !== null && value > target.maxMgdl) return "above_range";
  return "in_range";
}

export function buildProfessionalGlucoseHistory(
  rawReadings: RawProfessionalGlucoseReading[],
  options: {
    periodDays: ProfessionalGlucosePeriod;
    timeZone?: string | null;
    guardrails?: Guardrails | null;
    now?: Date;
  },
): ProfessionalGlucoseHistoryResponse {
  const timeZone = normalizeTimeZone(options.timeZone);
  const targets = buildProfessionalGlucoseTargetRanges(options.guardrails);
  const now = options.now ?? new Date();

  const readings = [...rawReadings]
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .map<ProfessionalGlucoseReading>((reading) => {
      const recordedAt = new Date(reading.recordedAt);
      const local = patientLocalParts(recordedAt, timeZone);
      const target = targets[reading.context] ?? null;
      return {
        value: reading.valueMgdl,
        unit: "mg/dL",
        recordedAt: recordedAt.toISOString(),
        context: reading.context,
        patientLocalDate: local.date,
        patientLocalTime: local.time,
        patientTimeZone: timeZone,
        note: reading.notes?.trim() || null,
        targetRange: target,
        rangeStatus: classifyProfessionalGlucoseReading(
          reading.valueMgdl,
          target,
        ),
      };
    });

  const contextBuckets = new Map<
    ProfessionalGlucoseContext,
    { total: number; count: number }
  >();
  for (const reading of readings) {
    const bucket = contextBuckets.get(reading.context) ?? {
      total: 0,
      count: 0,
    };
    bucket.total += reading.value;
    bucket.count += 1;
    contextBuckets.set(reading.context, bucket);
  }

  const averagesByContext = Array.from(contextBuckets.entries()).map(
    ([context, bucket]) => ({
      context,
      averageMgdl: Math.round(bucket.total / bucket.count),
      readingCount: bucket.count,
    }),
  );

  const rangeCounts = {
    inRange: readings.filter((reading) => reading.rangeStatus === "in_range")
      .length,
    aboveRange: readings.filter(
      (reading) => reading.rangeStatus === "above_range",
    ).length,
    belowRange: readings.filter(
      (reading) => reading.rangeStatus === "below_range",
    ).length,
    unavailable: readings.filter(
      (reading) => reading.rangeStatus === "unavailable",
    ).length,
  };

  const latestReading = readings[0] ?? null;
  const ageHours = latestReading
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(latestReading.recordedAt).getTime()) /
            (60 * 60 * 1000),
        ),
      )
    : null;
  const freshnessStatus =
    ageHours === null
      ? "no_data"
      : ageHours >= PROFESSIONAL_GLUCOSE_STALE_AFTER_HOURS
        ? "stale"
        : "current";

  return {
    periodDays: options.periodDays,
    unit: "mg/dL",
    patientTimeZone: timeZone,
    readings,
    latestReading,
    readingCount: readings.length,
    averagesByContext,
    rangeCounts,
    targetRanges: targets,
    targetStatus: Object.keys(targets).length ? "available" : "unavailable",
    freshness: {
      status: freshnessStatus,
      ageHours,
      staleAfterHours: PROFESSIONAL_GLUCOSE_STALE_AFTER_HOURS,
    },
    dataStatus:
      readings.length === 0
        ? "no_data"
        : readings.length < 3
          ? "insufficient_data"
          : "available",
  };
}