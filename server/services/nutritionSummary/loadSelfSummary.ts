import { db } from "../../db";
import { users } from "@shared/schema";
import { glucoseLogs } from "../../../shared/diabetes-schema";
import { desc, eq } from "drizzle-orm";
import { loadUserProtocolEnvelope } from "../protocolEnvelope";
import { buildNutritionSummary, type UserExtrasForSummary } from "./buildNutritionSummary";

export async function loadSelfNutritionSummary(userId: string, includeDayContext: boolean) {
  const startedAt = performance.now();
  const envelope = await loadUserProtocolEnvelope(userId, undefined, {
    includeDailyNutritionState: false,
  });
  if (!envelope) return null;
  const profileMs = Math.round(performance.now() - startedAt);

  const [userRow] = await db
    .select({
      dailyCalorieTarget: (users as any).dailyCalorieTarget,
      dailyProteinTarget: (users as any).dailyProteinTarget,
      dailyCarbTarget: (users as any).dailyCarbsTarget,
      dailyStarchyCarbsTarget: (users as any).dailyStarchyCarbsTarget,
      dailyFibrousCarbsTarget: (users as any).dailyFibrousCarbsTarget,
      dailyFatTarget: (users as any).dailyFatTarget,
      goalType: (users as any).goalType,
      goalTarget: (users as any).goalTarget,
      goalTimelineWeeks: (users as any).goalTimelineWeeks,
      fitnessGoal: users.fitnessGoal,
      performanceContext: users.performanceContext,
      weeklyTrainingSchedule: (users as any).weeklyTrainingSchedule,
      selectedMealBuilder: users.selectedMealBuilder,
      activeBoard: users.activeBoard,
      carbCycleState: (users as any).carbCycleState,
      alphaGalProfile: (users as any).alphaGalProfile,
      foodInclusionPriorities: users.foodInclusionPriorities,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const userMs = Math.round(performance.now() - startedAt) - profileMs;
  const [latestGlucoseLog] = includeDayContext
    ? await db
        .select({ value: glucoseLogs.valueMgdl })
        .from(glucoseLogs)
        .where(eq(glucoseLogs.userId, userId))
        .orderBy(desc(glucoseLogs.recordedAt))
        .limit(1)
    : [];
  const glucoseMs = Math.round(performance.now() - startedAt) - profileMs - userMs;

  const extras: UserExtrasForSummary = {
    dailyCalorieTarget: userRow?.dailyCalorieTarget ?? null,
    dailyProteinTarget: userRow?.dailyProteinTarget ?? null,
    dailyCarbTarget: userRow?.dailyCarbTarget ?? null,
    dailyStarchyCarbsTarget: userRow?.dailyStarchyCarbsTarget ?? null,
    dailyFibrousCarbsTarget: userRow?.dailyFibrousCarbsTarget ?? null,
    dailyFatTarget: userRow?.dailyFatTarget ?? null,
    goalType: userRow?.goalType ?? null,
    goalTarget: userRow?.goalTarget ?? null,
    goalTimelineWeeks: userRow?.goalTimelineWeeks ?? null,
    fitnessGoal: userRow?.fitnessGoal ?? null,
    performanceContext: userRow?.performanceContext ?? null,
    weeklyTrainingSchedule: userRow?.weeklyTrainingSchedule ?? null,
    latestGlucose: latestGlucoseLog?.value ?? null,
    selectedMealBuilder: userRow?.selectedMealBuilder ?? null,
    activeBoard: userRow?.activeBoard ?? null,
    carbCycleState: userRow?.carbCycleState ?? null,
    alphaGalProfile: (userRow?.alphaGalProfile as any) ?? null,
    foodInclusionPriorities: userRow?.foodInclusionPriorities ?? null,
  };
  const summary = buildNutritionSummary(envelope, extras, { includeDayContext });
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[NutritionSummaryTiming] core.profile=${profileMs}ms core.user=${userMs}ms ` +
      `core.glucose=${glucoseMs}ms core.build=${Math.round(performance.now() - startedAt) - profileMs - userMs - glucoseMs}ms`,
    );
  }
  return summary;
}