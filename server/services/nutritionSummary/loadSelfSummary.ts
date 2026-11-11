import { db } from "../../db";
import { users } from "@shared/schema";
import { glucoseLogs } from "../../../shared/diabetes-schema";
import { desc, eq } from "drizzle-orm";
import { loadUserProtocolEnvelope } from "../protocolEnvelope";
import { buildNutritionSummary, type UserExtrasForSummary } from "./buildNutritionSummary";

async function timed<T>(operation: () => PromiseLike<T>) {
  const start = performance.now();
  const value = await operation();
  return { value, ms: Math.round(performance.now() - start) };
}

export async function loadSelfNutritionSummary(userId: string, includeDayContext: boolean) {
  // All reads use the same already-authorized self subject. They do not depend
  // on one another: start together, without sharing or caching across requests.
  const [profile, user, glucose] = await Promise.all([
    timed(() => loadUserProtocolEnvelope(userId, undefined, {
      includeDailyNutritionState: false,
    })),
    timed(() => db
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
    .limit(1)),
    includeDayContext
    ? timed(() => db
        .select({ value: glucoseLogs.valueMgdl })
        .from(glucoseLogs)
        .where(eq(glucoseLogs.userId, userId))
        .orderBy(desc(glucoseLogs.recordedAt))
        .limit(1))
    : Promise.resolve({ value: [], ms: 0 }),
  ]);
  const envelope = profile.value;
  if (!envelope) return null;
  const [userRow] = user.value;
  const [latestGlucoseLog] = glucose.value;

  const buildStartedAt = performance.now();
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
      `[NutritionSummaryTiming] core.profile=${profile.ms}ms core.user=${user.ms}ms ` +
      `core.glucose=${glucose.ms}ms core.build=${Math.round(performance.now() - buildStartedAt)}ms (parallel reads)`,
    );
  }
  return summary;
}