import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { getUserTimezone, todayInTimezone, daysAgo } from "./nutritionDayService";

export interface MealSlots {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface ComplianceResult {
  // --- existing fields (preserved for all current consumers) ---
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;

  // --- new behavioral summary fields ---
  proteinGoalDays: number;
  calorieGoalDays: number;
  mealSlots: MealSlots;
  biggestOpportunity: string;
  coachingSummary: string;
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

function computeBiggestOpportunity(
  slots: MealSlots,
  proteinGoalDays: number,
  loggedDays: number,
  windowDays: number,
): string {
  const { breakfast, lunch, dinner } = slots;
  const maxSlot = Math.max(breakfast, lunch, dinner);

  if (maxSlot - dinner >= 2) {
    return "Log dinner more consistently to complete your daily nutrition picture.";
  }
  if (maxSlot - lunch >= 2) {
    return "Log lunch more consistently to complete your daily nutrition picture.";
  }
  if (maxSlot - breakfast >= 2) {
    return "Log breakfast to track your full day of nutrition.";
  }
  if (proteinGoalDays < Math.ceil(windowDays * 0.5)) {
    return "Focus on meeting your daily protein target more consistently.";
  }
  if (loggedDays < Math.ceil(windowDays * 0.7)) {
    return "Use My Perfect Meals more consistently when making food decisions.";
  }
  return "Keep building on your consistent nutrition habits.";
}

function computeCoachingSummary(
  slots: MealSlots,
  proteinGoalDays: number,
  loggedDays: number,
  windowDays: number,
): string {
  const { dinner, breakfast, lunch } = slots;
  const maxSlot = Math.max(breakfast, lunch, dinner);

  if (maxSlot - dinner >= 2) {
    return "Client is consistently missing evening meal logs — dinner is the most frequent gap. Consider checking in on evening routine.";
  }
  if (maxSlot - lunch >= 2) {
    return "Midday meal logging is the primary gap. May indicate a disrupted lunch routine or work schedule conflict.";
  }
  if (proteinGoalDays < Math.ceil(windowDays * 0.5)) {
    return "Protein adherence is below target on more than half of tracked days. Reviewing meal composition and protein sources may help.";
  }
  if (loggedDays < Math.ceil(windowDays * 0.5)) {
    return "Client engagement is significantly below optimal. A check-in may be warranted to identify barriers to consistent use.";
  }
  if (loggedDays < Math.ceil(windowDays * 0.7)) {
    return "Client is engaging but not consistently logging daily. Light reinforcement around habit formation may improve consistency.";
  }
  return "Client is demonstrating consistent nutrition engagement across tracked behaviors.";
}

export async function getUserCompliance(
  userId: string,
  windowDays: number = DEFAULT_WINDOW,
): Promise<ComplianceResult> {
  const cappedWindow = sanitizeWindow(windowDays);

  const emptySlots: MealSlots = { breakfast: 0, lunch: 0, dinner: 0 };

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
      proteinGoalDays: 0,
      calorieGoalDays: 0,
      mealSlots: emptySlots,
      biggestOpportunity: "Use My Perfect Meals to start tracking your nutrition.",
      coachingSummary: "No user data available.",
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
      proteinGoalDays: 0,
      calorieGoalDays: 0,
      mealSlots: emptySlots,
      biggestOpportunity: "Set your macro targets to activate full nutrition tracking.",
      coachingSummary: "Client has not set macro targets. Establishing targets is the recommended first step.",
    };
  }

  const tz = await getUserTimezone(userId);
  const todayStr = todayInTimezone(tz);
  const startDateStr = daysAgo(todayStr, cappedWindow - 1);

  // --- Primary compliance query (existing logic, unchanged) ---
  const rows = await db.execute(sql`
    WITH day_data AS (
      SELECT
        (${macroLogs.at} AT TIME ZONE ${tz})::date AS date,
        ${macroLogs.source} AS source,
        SUM(${macroLogs.kcal})::int AS kcal,
        SUM(${macroLogs.protein})::int AS protein
      FROM ${macroLogs}
      WHERE ${macroLogs.userId} = ${userId}
        AND (${macroLogs.at} AT TIME ZONE ${tz})::date >= ${startDateStr}::date
        AND (${macroLogs.at} AT TIME ZONE ${tz})::date <= ${todayStr}::date
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

  // --- Meal slot query (count distinct days per slot via raw SQL) ---
  // meal_type is not mapped in the Drizzle schema, so we use raw column names.
  const slotResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT CASE WHEN meal_type = 'breakfast'
        THEN (at AT TIME ZONE ${tz})::date END)::int AS breakfast_days,
      COUNT(DISTINCT CASE WHEN meal_type = 'lunch'
        THEN (at AT TIME ZONE ${tz})::date END)::int AS lunch_days,
      COUNT(DISTINCT CASE WHEN meal_type = 'dinner'
        THEN (at AT TIME ZONE ${tz})::date END)::int AS dinner_days
    FROM macro_logs
    WHERE user_id = ${userId}
      AND (at AT TIME ZONE ${tz})::date >= ${startDateStr}::date
      AND (at AT TIME ZONE ${tz})::date <= ${todayStr}::date
  `);

  const slotRow = slotResult.rows[0] as { breakfast_days: number; lunch_days: number; dinner_days: number } | undefined;
  const mealSlots: MealSlots = {
    breakfast: Number(slotRow?.breakfast_days ?? 0),
    lunch: Number(slotRow?.lunch_days ?? 0),
    dinner: Number(slotRow?.dinner_days ?? 0),
  };

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
      proteinGoalDays: 0,
      calorieGoalDays: 0,
      mealSlots,
      biggestOpportunity: "Start logging your meals to activate your Nutrition Activity Summary.",
      coachingSummary: "No meal logs recorded in this window. Consider a check-in to discuss barriers.",
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

  // Days where calories fell within 80-120% of target
  const calorieGoalDays = dailyRows.filter((r) => {
    const pct = (r.kcal || 0) / calorieTarget;
    return pct >= 0.8 && pct <= 1.2;
  }).length;

  const biggestOpportunity = computeBiggestOpportunity(mealSlots, daysMetProtein, loggedDays, cappedWindow);
  const coachingSummary = computeCoachingSummary(mealSlots, daysMetProtein, loggedDays, cappedWindow);

  return {
    complianceScore,
    calorieCompliance,
    proteinCompliance,
    loggingCompliance,
    calorieAverage7: calorieAverage,
    proteinAverage7: proteinAverage,
    loggedDays7: loggedDays,
    windowDays: cappedWindow,
    proteinGoalDays: daysMetProtein,
    calorieGoalDays,
    mealSlots,
    biggestOpportunity,
    coachingSummary,
  };
}
