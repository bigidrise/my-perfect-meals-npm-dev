import { db } from "../db";
import { macroLogs, mealInstances, users, waterLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { getUserTimezone, todayInTimezone, daysAgo } from "./nutritionDayService";
import { resolveHydrationCenterState } from "./hydration/hydrationCenterService";

export interface MealSlots {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface MealActivity {
  expectedMealCount: number;
  completedMealCount: number;
  plannedMealDays: number;
  completedMealDays: number;
  completionRate: number | null;
}

export interface ComplianceResult {
  // --- existing fields (preserved for all current consumers) ---
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  mealConsistency: number;
  mealCompletion: number | null;
  mealLogging: number;
  macroAdherence: number;
  macroAdherenceEligible: boolean;
  hydrationAdherence: number | null;
  hydrationEligible: boolean;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  mealActivity: MealActivity;
  completedMealSlots: MealSlots;
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
  macroAdherence: number | null;
  hydrationAdherence: number | null;
}): number {
  const components = [
    { value: input.mealConsistency, weight: 0.4 },
    { value: input.macroAdherence, weight: 0.4 },
    { value: input.hydrationAdherence, weight: 0.2 },
  ].filter((component): component is { value: number; weight: number } =>
    component.value !== null && Number.isFinite(component.value),
  );
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight === 0) return 0;
  const score = components.reduce(
    (sum, component) => sum + component.value * component.weight,
    0,
  ) / totalWeight;
  return clamp(Math.round(score), 0, 100);
}

export function combineMealConsistency(input: {
  completionRate: number | null;
  loggingRate: number;
}): number {
  if (input.completionRate === null) return clamp(Math.round(input.loggingRate), 0, 100);
  return clamp(Math.round((input.completionRate + input.loggingRate) / 2), 0, 100);
}

function computeBiggestOpportunity(
  slots: MealSlots,
  proteinGoalDays: number,
  proteinTargetAvailable: boolean,
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
  if (proteinTargetAvailable && proteinGoalDays < Math.ceil(windowDays * 0.5)) {
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
  proteinTargetAvailable: boolean,
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
  if (proteinTargetAvailable && proteinGoalDays < Math.ceil(windowDays * 0.5)) {
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
  const emptyMealActivity: MealActivity = {
    expectedMealCount: 0,
    completedMealCount: 0,
    plannedMealDays: 0,
    completedMealDays: 0,
    completionRate: null,
  };
  const emptyCompletedMealSlots: MealSlots = { breakfast: 0, lunch: 0, dinner: 0 };

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
      mealCompletion: null,
      mealLogging: 0,
      macroAdherence: 0,
      macroAdherenceEligible: false,
      hydrationAdherence: null,
      hydrationEligible: false,
      calorieAverage7: 0,
      proteinAverage7: 0,
      loggedDays7: 0,
      windowDays: cappedWindow,
      mealActivity: emptyMealActivity,
      completedMealSlots: emptyCompletedMealSlots,
      reason: "user_not_found",
      proteinGoalDays: 0,
      calorieGoalDays: 0,
      mealSlots: emptySlots,
      biggestOpportunity: "Use My Perfect Meals to start tracking your nutrition.",
      coachingSummary: "No user data available.",
    };
  }

  const calorieTarget = typeof user.dailyCalorieTarget === "number" && user.dailyCalorieTarget > 0
    ? user.dailyCalorieTarget
    : null;
  const proteinTarget = typeof user.dailyProteinTarget === "number" && user.dailyProteinTarget > 0
    ? user.dailyProteinTarget
    : null;

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

  // --- Meal activity query ---
  // A replacement creates a replaced original and a new instance for the same
  // date/slot. Collapse those records so one planned slot cannot count twice.
  let mealActivity = emptyMealActivity;
  let completedMealSlots: MealSlots = { ...emptyCompletedMealSlots };
  try {
    const activityResult = await db.execute(sql`
      WITH slot_activity AS (
        SELECT
          ${mealInstances.date} AS date,
          ${mealInstances.slot} AS slot,
          BOOL_OR(${mealInstances.status} IN ('eaten', 'logged')) AS completed,
          BOOL_OR(${mealInstances.status} IN ('planned', 'eaten', 'logged', 'skipped', 'replaced')) AS scheduled
        FROM ${mealInstances}
        WHERE ${mealInstances.userId} = ${userId}
          AND ${mealInstances.date} >= ${startDateStr}::date
          AND ${mealInstances.date} <= ${todayStr}::date
          AND ${mealInstances.status} IN ('planned', 'eaten', 'logged', 'skipped', 'replaced')
        GROUP BY ${mealInstances.date}, ${mealInstances.slot}
      )
      SELECT
        COUNT(*) FILTER (WHERE scheduled)::int AS expected_meal_count,
        COUNT(*) FILTER (WHERE scheduled AND completed)::int AS completed_meal_count,
        COUNT(DISTINCT date) FILTER (WHERE scheduled)::int AS planned_meal_days,
        COUNT(DISTINCT date) FILTER (WHERE scheduled AND completed)::int AS completed_meal_days,
        COUNT(DISTINCT date) FILTER (WHERE scheduled AND completed AND slot = 'breakfast')::int AS completed_breakfast_days,
        COUNT(DISTINCT date) FILTER (WHERE scheduled AND completed AND slot = 'lunch')::int AS completed_lunch_days,
        COUNT(DISTINCT date) FILTER (WHERE scheduled AND completed AND slot = 'dinner')::int AS completed_dinner_days
      FROM slot_activity
    `);
    const row = activityResult.rows[0] as {
      expected_meal_count?: number;
      completed_meal_count?: number;
      planned_meal_days?: number;
      completed_meal_days?: number;
      completed_breakfast_days?: number;
      completed_lunch_days?: number;
      completed_dinner_days?: number;
    } | undefined;
    const expectedMealCount = Number(row?.expected_meal_count ?? 0);
    const completedMealCount = Number(row?.completed_meal_count ?? 0);
    mealActivity = {
      expectedMealCount,
      completedMealCount,
      plannedMealDays: Number(row?.planned_meal_days ?? 0),
      completedMealDays: Number(row?.completed_meal_days ?? 0),
      completionRate: expectedMealCount > 0
        ? clamp(Math.round((completedMealCount / expectedMealCount) * 100), 0, 100)
        : null,
    };
    completedMealSlots = {
      breakfast: Number(row?.completed_breakfast_days ?? 0),
      lunch: Number(row?.completed_lunch_days ?? 0),
      dinner: Number(row?.completed_dinner_days ?? 0),
    };
  } catch (error) {
    console.warn("[consistency-score] Meal activity unavailable; completion component omitted", error);
  }

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

  if (loggedDays === 0 && mealActivity.expectedMealCount === 0) {
    return {
      complianceScore: 0,
      calorieCompliance: 0,
      proteinCompliance: 0,
      loggingCompliance: 0,
      mealConsistency: 0,
      mealCompletion: null,
      mealLogging: 0,
      macroAdherence: 0,
      macroAdherenceEligible: false,
      hydrationAdherence: null,
      hydrationEligible: false,
      calorieAverage7: 0,
      proteinAverage7: 0,
      loggedDays7: 0,
      windowDays: cappedWindow,
      mealActivity,
      completedMealSlots,
      proteinGoalDays: 0,
      calorieGoalDays: 0,
      mealSlots,
      biggestOpportunity: "Start logging your meals to activate your Nutrition Activity Summary.",
      coachingSummary: "No meal logs recorded in this window. Consider a check-in to discuss barriers.",
    };
  }

  const totalKcal = dailyRows.reduce((sum, r) => sum + (r.kcal || 0), 0);
  const totalProtein = dailyRows.reduce((sum, r) => sum + (r.protein || 0), 0);
  const calorieAverage = loggedDays > 0 ? Math.round(totalKcal / loggedDays) : 0;
  const proteinAverage = loggedDays > 0 ? Math.round(totalProtein / loggedDays) : 0;

  const calorieCompliance = loggedDays > 0 && calorieTarget !== null ? clamp(
    Math.round(100 - (Math.abs(calorieAverage - calorieTarget) / calorieTarget) * 100),
    0,
    100,
  ) : 0;

  const proteinThreshold = proteinTarget !== null ? proteinTarget * 0.9 : null;
  const daysMetProtein = proteinThreshold !== null
    ? dailyRows.filter((r) => (r.protein || 0) >= proteinThreshold).length
    : 0;
  const proteinCompliance = loggedDays > 0 && proteinTarget !== null
    ? clamp(Math.round((daysMetProtein / loggedDays) * 100), 0, 100)
    : 0;

  const loggingCompliance = clamp(Math.round((loggedDays / cappedWindow) * 100), 0, 100);
  const mealCompletion = mealActivity.completionRate;
  const mealLogging = loggingCompliance;
  const mealConsistency = combineMealConsistency({
    completionRate: mealCompletion,
    loggingRate: mealLogging,
  });
  const macroTargets = [
    { key: "kcal" as const, target: calorieTarget },
    { key: "protein" as const, target: proteinTarget },
    { key: "carbs" as const, target: user.dailyCarbsTarget },
    { key: "fat" as const, target: user.dailyFatTarget },
  ].filter((entry): entry is {
    key: "kcal" | "protein" | "carbs" | "fat";
    target: number;
  } => typeof entry.target === "number" && entry.target > 0);
  const macroAdherenceEligible = dailyRows.length > 0 && macroTargets.length > 0;
  const macroAdherence = macroAdherenceEligible ? Math.round(
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
  ) : 0;

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
    macroAdherence: macroAdherenceEligible ? macroAdherence : null,
    hydrationAdherence,
  });

  // Days where calories fell within 80-120% of target
  const calorieGoalDays = calorieTarget === null ? 0 : dailyRows.filter((r) => {
    const pct = (r.kcal || 0) / calorieTarget;
    return pct >= 0.8 && pct <= 1.2;
  }).length;

  const biggestOpportunity = computeBiggestOpportunity(
    mealSlots,
    daysMetProtein,
    proteinTarget !== null,
    loggedDays,
    cappedWindow,
  );
  const coachingSummary = computeCoachingSummary(
    mealSlots,
    daysMetProtein,
    proteinTarget !== null,
    loggedDays,
    cappedWindow,
  );

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
    mealActivity,
    completedMealSlots,
    mealCompletion,
    mealLogging,
    macroAdherenceEligible,
    proteinGoalDays: daysMetProtein,
    calorieGoalDays,
    mealSlots,
    biggestOpportunity,
    coachingSummary,
  };
}
