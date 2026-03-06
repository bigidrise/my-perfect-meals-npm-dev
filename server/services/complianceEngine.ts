import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

export interface ComplianceResult {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
}

const MAX_WINDOW = 30;
const DEFAULT_WINDOW = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeWindow(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_WINDOW;
  return clamp(Math.round(raw), 1, MAX_WINDOW);
}

export async function getUserCompliance(
  userId: string,
  windowDays: number = DEFAULT_WINDOW,
): Promise<ComplianceResult> {
  const cappedWindow = sanitizeWindow(windowDays);

  const [user] = await db
    .select({
      dailyCalorieTarget: users.dailyCalorieTarget,
      dailyProteinTarget: users.dailyProteinTarget,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return {
      complianceScore: null,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      calorieAverage7: 0,
      proteinAverage7: 0,
      loggedDays7: 0,
      windowDays: cappedWindow,
      reason: "user_not_found",
    };
  }

  const calorieTarget = user.dailyCalorieTarget;
  const proteinTarget = user.dailyProteinTarget;

  if (!calorieTarget || calorieTarget <= 0 || !proteinTarget || proteinTarget <= 0) {
    return {
      complianceScore: null,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      calorieAverage7: 0,
      proteinAverage7: 0,
      loggedDays7: 0,
      windowDays: cappedWindow,
      reason: "no_targets",
    };
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const startDate = new Date(todayStr);
  startDate.setDate(startDate.getDate() - (cappedWindow - 1));

  const rows = await db.execute(sql`
    WITH day_data AS (
      SELECT
        (${macroLogs.at})::date AS date,
        ${macroLogs.source} AS source,
        SUM(${macroLogs.kcal})::int AS kcal,
        SUM(${macroLogs.protein})::int AS protein
      FROM ${macroLogs}
      WHERE ${macroLogs.userId} = ${userId}
        AND (${macroLogs.at})::date >= ${startDate.toISOString().slice(0, 10)}::date
        AND (${macroLogs.at})::date <= ${todayStr}::date
      GROUP BY 1, 2
    ),
    locked_dates AS (
      SELECT DISTINCT date FROM day_data WHERE source = 'locked-day'
    )
    SELECT
      d.date,
      SUM(d.kcal)::int AS kcal,
      SUM(d.protein)::int AS protein
    FROM day_data d
    WHERE
      (d.date IN (SELECT date FROM locked_dates) AND d.source = 'locked-day')
      OR
      (d.date NOT IN (SELECT date FROM locked_dates))
    GROUP BY d.date
    ORDER BY d.date ASC
  `);

  const dailyRows = rows.rows as Array<{ date: string; kcal: number; protein: number }>;
  const loggedDays = dailyRows.length;

  if (loggedDays === 0) {
    return {
      complianceScore: 0,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      calorieAverage7: 0,
      proteinAverage7: 0,
      loggedDays7: 0,
      windowDays: cappedWindow,
    };
  }

  const totalKcal = dailyRows.reduce((sum, r) => sum + (r.kcal || 0), 0);
  const totalProtein = dailyRows.reduce((sum, r) => sum + (r.protein || 0), 0);
  const calorieAverage = Math.round(totalKcal / loggedDays);
  const proteinAverage = Math.round(totalProtein / loggedDays);

  const calorieCompliance = clamp(
    Math.round(100 - (Math.abs(calorieAverage - calorieTarget) / calorieTarget) * 100),
    0,
    100,
  );

  const proteinThreshold = proteinTarget * 0.9;
  const daysMetProtein = dailyRows.filter((r) => (r.protein || 0) >= proteinThreshold).length;
  const proteinCompliance = clamp(Math.round((daysMetProtein / loggedDays) * 100), 0, 100);

  const loggingCompliance = clamp(Math.round((loggedDays / cappedWindow) * 100), 0, 100);

  const complianceScore = clamp(
    Math.round(calorieCompliance * 0.4 + proteinCompliance * 0.4 + loggingCompliance * 0.2),
    0,
    100,
  );

  return {
    complianceScore,
    calorieCompliance,
    proteinCompliance,
    loggingCompliance,
    calorieAverage7: calorieAverage,
    proteinAverage7: proteinAverage,
    loggedDays7: loggedDays,
    windowDays: cappedWindow,
  };
}
