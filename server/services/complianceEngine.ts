import { db } from "../db";
import { macroLogs, users, waterLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { getUserTimezone, todayInTimezone, daysAgo } from "./nutritionDayService";
import { resolveHydrationCenterState } from "./hydration/hydrationCenterService";

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
  mealConsistency: number;
  macroAdherence: number;
  hydrationAdherence: number | null;
  hydrationEligible: boolean;
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

export function combineConsistencyComponents(input: {
  mealConsistency: number;
  macroAdherence: number;
  hydrationAdherence: number | null;
}): number {
  const score = input.hydrationAdherence === null
    ? input.mealConsistency * 0.5 + input.macroAdherence * 0.5
    : input.mealConsistency * 0.4 +
      input.macroAdherence * 0.4 +
      input.hydrationAdherence * 0.2;
  return clamp(Math.round(score), 0, 100);
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
      dailyCarbsTarget: users.dailyCarbsTarget,
      dailyFatTarget: users.dailyFatTarget,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return {
      complianceScore: null,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      mealConsistency: 0,
      macroAdherence: 0,
      hydrationAdherence: null,
      hydrationEligible: false,
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
      mealConsistency: 0,
      macroAdherence: 0,
      hydrationAdherence: null,
      hydrationEligible: false,
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
        SUM(${macroLogs.protein})::int AS protein,
        SUM(${macroLogs.carbs})::int AS carbs,
        SUM(${macroLogs.fat})::int AS fat
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
      SUM(d.protein)::int AS protein,
      SUM(d.carbs)::int AS carbs,
      SUM(d.fat)::int AS fat
    FROM day_data d
    WHERE
      (d.date IN (SELECT date FROM locked_dates) AND d.source = 'locked-day')
      OR
      (d.date NOT IN (SELECT date FROM locked_dates))
    GROUP BY d.date
    ORDER BY d.date ASC
  `);

  const dailyRows = rows.rows as Array<{
    date: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  const loggedDays = dailyRows.length;

  // --- Meal slot query (count distinct days per slot via raw SQL) ---
  // meal_type column exists in the DB but is not mapped in the Drizzle schema.
  // Wrapped in try/catch: if the column is missing in a given environment the
  // rest of the summary still returns correctly with zeros for slots.
  let mealSlots: MealSlots = { breakfast: 0, lunch: 0, dinner: 0 };
  try {
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
    mealSlots = {
      breakfast: Number(slotRow?.breakfast_days ?? 0),
      lunch: Number(slotRow?.lunch_days ?? 0),
      dinner: Number(slotRow?.dinner_days ?? 0),
    };
  } catch {
    // meal_type column not available in this environment — slots stay at zero
  }

  if (loggedDays === 0) {
    return {
      complianceScore: 0,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      mealConsistency: 0,
      macroAdherence: 0,
      hydrationAdherence: null,
      hydrationEligible: false,
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
  const mealConsistency = loggingCompliance;
  const macroTargets = [
    { key: "kcal" as const, target: calorieTarget },
    { key: "protein" as const, target: proteinTarget },
    { key: "carbs" as const, target: user.dailyCarbsTarget },
    { key: "fat" as const, target: user.dailyFatTarget },
  ].filter((entry): entry is {
    key: "kcal" | "protein" | "carbs" | "fat";
    target: number;
  } => typeof entry.target === "number" && entry.target > 0);
  const macroAdherence = Math.round(
    dailyRows.reduce((sum, row) => {
      const dailyScore = macroTargets.reduce((daySum, target) => {
        const actual = Number(row[target.key] ?? 0);
        return daySum + clamp(
          Math.round(100 - Math.abs(actual - target.target) / target.target * 100),
          0,
          100,
        );
      }, 0) / macroTargets.length;
      return sum + dailyScore;
    }, 0) / dailyRows.length,
  );

  let hydrationAdherence: number | null = null;
  let hydrationEligible = false;
  try {
    const hydrationState = await resolveHydrationCenterState({
      subjectUserId: userId,
      localDate: todayStr,
      timezone: tz,
      access: {
        authenticatedUserId: userId,
        subjectUserId: userId,
        mode: "self",
        authorizationStatus: "allowed",
      },
    });
    const policy = hydrationState.numericPolicy;
    hydrationEligible = policy.status === "NUMERIC_ACTIVE";
    if (hydrationEligible) {
      const hydrationRows = await db.execute(sql`
        SELECT
          (${waterLogs.intakeTime} AT TIME ZONE ${tz})::date AS date,
          SUM(${waterLogs.amountMl})::int AS total_ml
        FROM ${waterLogs}
        WHERE ${waterLogs.userId} = ${userId}
          AND (${waterLogs.intakeTime} AT TIME ZONE ${tz})::date >= ${startDateStr}::date
          AND (${waterLogs.intakeTime} AT TIME ZONE ${tz})::date <= ${todayStr}::date
        GROUP BY 1
      `);
      const hydrationByDate = new Map(
        (hydrationRows.rows as Array<{ date: string; total_ml: number }>).map((row) => [
          String(row.date).slice(0, 10),
          Number(row.total_ml ?? 0),
        ]),
      );
      const scoreHydrationDay = (consumed: number): number => {
        if (policy.targetKind === "point" && policy.targetMl) {
          return clamp(Math.round(100 - Math.abs(consumed - policy.targetMl) / policy.targetMl * 100), 0, 100);
        }
        if (policy.targetKind === "range" && policy.minimumMl && policy.maximumMl) {
          if (consumed >= policy.minimumMl && consumed <= policy.maximumMl) return 100;
          const boundary = consumed < policy.minimumMl ? policy.minimumMl : policy.maximumMl;
          return clamp(Math.round(100 - Math.abs(consumed - boundary) / boundary * 100), 0, 100);
        }
        if (policy.targetKind === "floor" && policy.minimumMl) {
          return clamp(Math.round(consumed / policy.minimumMl * 100), 0, 100);
        }
        if (policy.targetKind === "ceiling" && policy.maximumMl) {
          return consumed <= policy.maximumMl
            ? 100
            : clamp(Math.round(100 - (consumed - policy.maximumMl) / policy.maximumMl * 100), 0, 100);
        }
        return 0;
      };
      const hydrationScores = Array.from({ length: cappedWindow }, (_, offset) =>
        scoreHydrationDay(hydrationByDate.get(daysAgo(todayStr, offset)) ?? 0),
      );
      hydrationAdherence = Math.round(
        hydrationScores.reduce((sum, score) => sum + score, 0) / hydrationScores.length,
      );
    }
  } catch (error) {
    console.warn("[consistency-score] Hydration unavailable; omitting component", error);
  }

  const complianceScore = combineConsistencyComponents({
    mealConsistency,
    macroAdherence,
    hydrationAdherence,
  });

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
    mealConsistency,
    macroAdherence,
    hydrationAdherence,
    hydrationEligible,
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
