import { desc, eq } from "drizzle-orm";
import { glucoseLogs } from "../../shared/diabetes-schema";
import { userGlycemicSettings } from "../../shared/schema";

export type GlucoseContext =
  | "FASTED"
  | "PRE_MEAL"
  | "POST_MEAL_1H"
  | "POST_MEAL_2H"
  | "RANDOM";
export type GlucoseState = "LOW" | "IN_RANGE" | "HIGH" | "STALE" | "NONE";

export interface GlycemicPreferenceSettings {
  bloodGlucose?: number | null;
  updatedAt?: Date | string | null;
  preferredCarbs?: string[] | null;
  lowRangeCarbs?: string[] | null;
  midRangeCarbs?: string[] | null;
  highRangeCarbs?: string[] | null;
  glycemicPreferencesConfigured?: boolean | null;
}

export interface GlucoseStateResolution {
  state: GlucoseState;
  valueMgdl: number | null;
  context: GlucoseContext | null;
  source: "LOG" | "SETTINGS" | null;
  ageMinutes: number | null;
  criticalLow: boolean;
  criticalHigh: boolean;
  activePreferences: string[];
  preferencesConfigured: boolean;
}

const FRESH_FOR_MINUTES = 240;

export function classifyGlucoseState(valueMgdl: number, context: GlucoseContext): GlucoseState {
  if (valueMgdl < 70) return "LOW";
  const upperBound = context === "FASTED" || context === "PRE_MEAL" ? 120 : 140;
  return valueMgdl <= upperBound ? "IN_RANGE" : "HIGH";
}

export function resolveActivePreferenceList(
  settings: GlycemicPreferenceSettings | null | undefined,
  state: GlucoseState,
): string[] {
  if (!settings) return [];
  const selected = state === "LOW"
    ? settings.lowRangeCarbs
    : state === "IN_RANGE"
      ? settings.midRangeCarbs
      : state === "HIGH"
        ? settings.highRangeCarbs
        : undefined;
  const selectedList = selected ?? [];

  // An explicit configuration makes an empty list meaningful: it must not
  // silently re-enable the legacy list.
  if (settings.glycemicPreferencesConfigured) return [...selectedList];
  return selectedList.length > 0 ? [...selectedList] : [...(settings.preferredCarbs ?? [])];
}

function ageInMinutes(recordedAt: Date | string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(recordedAt).getTime()) / 60_000));
}

function emptyResolution(settings?: GlycemicPreferenceSettings | null): GlucoseStateResolution {
  return {
    state: "NONE", valueMgdl: null, context: null, source: null, ageMinutes: null,
    criticalLow: false, criticalHigh: false, activePreferences: [],
    preferencesConfigured: Boolean(settings?.glycemicPreferencesConfigured),
  };
}

/** Pure resolver. A fresh glucose log has priority; a stale log may use fresh settings. */
export function resolveGlucoseState(
  latestLog: { valueMgdl: number; context: GlucoseContext; recordedAt: Date | string } | null | undefined,
  settings: GlycemicPreferenceSettings | null | undefined,
  now = new Date(),
): GlucoseStateResolution {
  const logAge = latestLog ? ageInMinutes(latestLog.recordedAt, now) : null;
  const settingAge = settings?.bloodGlucose != null && settings.updatedAt
    ? ageInMinutes(settings.updatedAt, now)
    : null;
  const candidate = latestLog && logAge !== null && logAge <= FRESH_FOR_MINUTES
    ? { valueMgdl: latestLog.valueMgdl, context: latestLog.context, source: "LOG" as const, ageMinutes: logAge }
    : settings?.bloodGlucose != null && settingAge !== null && settingAge <= FRESH_FOR_MINUTES
      ? { valueMgdl: settings.bloodGlucose, context: "PRE_MEAL" as const, source: "SETTINGS" as const, ageMinutes: settingAge }
      : null;

  if (!candidate) {
    const result = emptyResolution(settings);
    if (latestLog) result.state = "STALE";
    return result;
  }
  const state = classifyGlucoseState(candidate.valueMgdl, candidate.context);
  return {
    state,
    valueMgdl: candidate.valueMgdl,
    context: candidate.context,
    source: candidate.source,
    ageMinutes: candidate.ageMinutes,
    criticalLow: candidate.valueMgdl < 54,
    criticalHigh: candidate.valueMgdl > 400,
    activePreferences: resolveActivePreferenceList(settings, state),
    preferencesConfigured: Boolean(settings?.glycemicPreferencesConfigured),
  };
}

/** Database-backed resolver for the authenticated user's own settings and latest log. */
export async function resolveUserGlucoseState(userId: string, now = new Date()): Promise<GlucoseStateResolution> {
  const { db } = await import("../db");
  const [[latestLog], [settings]] = await Promise.all([
    db.select().from(glucoseLogs).where(eq(glucoseLogs.userId, userId)).orderBy(desc(glucoseLogs.recordedAt)).limit(1),
    db.select().from(userGlycemicSettings).where(eq(userGlycemicSettings.userId, userId)).limit(1),
  ]);
  return resolveGlucoseState(latestLog ?? null, settings ?? null, now);
}