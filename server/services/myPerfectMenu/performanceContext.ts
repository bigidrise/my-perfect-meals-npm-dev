import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "@shared/schema";
import { computeDemandProfile } from "@shared/performanceDemandEngine";
import { resolveDailyNutritionState } from "../nutritionStateService";
import { deriveCompPrepStatus } from "../protocol/competitionPrepDateEngine";
import type { MyPerfectMenuMealSlot } from "@shared/myPerfectMenu";

export type PerformanceMenuSlot = MyPerfectMenuMealSlot;

export interface PerformanceMenuAuthority {
  dateISO: string;
  slot: PerformanceMenuSlot;
  sessionType: string | null;
  sessionLabel: string | null;
  trainingDay: boolean;
  performanceTrack: string | null;
  competition: {
    eventDate: string | null;
    competitionType: string | null;
    phase: string | null;
  };
  demand: ReturnType<typeof computeDemandProfile> | null;
  nutrition: {
    targets: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      starchyCarbs: number;
      fibrousCarbs: number;
    };
    remaining: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      starchyCarbs: number;
      starchMealsRemaining: number;
    };
    planned: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      starchyCarbs: number;
      starchMeals: number;
    };
    starch: {
      isZeroStarchDay: boolean;
      distributionStrategy: string;
      gramsPerRemainingMeal: number | null;
    };
  };
}

export async function resolveMyPerfectMenuPerformanceContext(
  subjectUserId: string,
  dateISO: string,
  slot: PerformanceMenuSlot,
): Promise<PerformanceMenuAuthority | null> {
  const [row] = await db.select({
    performanceContext: users.performanceContext,
    competitionPrepContext: users.competitionPrepContext,
    activeProtocolTrack: users.activeProtocolTrack,
    performanceModeEnabled: users.performanceModeEnabled,
  }).from(users).where(eq(users.id, subjectUserId)).limit(1);
  if (!row?.performanceContext && !row?.competitionPrepContext) return null;

  const state = await resolveDailyNutritionState(subjectUserId, dateISO);
  const performanceContext = row.performanceContext as Record<string, unknown> | null;
  const competition = row.competitionPrepContext as Record<string, unknown> | null;
  const sessionType = state.prescription.trainingDayType ?? null;
  const eventDate = typeof competition?.eventDate === "string" ? competition.eventDate : null;
  const competitionType = typeof competition?.competitionType === "string" ? competition.competitionType : null;
  const competitionStatus = eventDate && competitionType
    ? deriveCompPrepStatus(eventDate, competitionType as any)
    : null;

  return {
    dateISO,
    slot,
    sessionType,
    sessionLabel: sessionType ? String(sessionType) : null,
    trainingDay: Boolean(sessionType && sessionType !== "rest"),
    performanceTrack: row.activeProtocolTrack ?? (competition ? "competition" : "athletic"),
    competition: {
      eventDate,
      competitionType,
      phase: competitionStatus?.currentPhase ?? null,
    },
    demand: computeDemandProfile(performanceContext as any),
    nutrition: {
      targets: {
        calories: state.prescription.caloriesTarget,
        protein: state.prescription.proteinTarget,
        carbs: state.prescription.carbsTarget,
        fat: state.prescription.fatTarget,
        starchyCarbs: state.prescription.starchyCarbsTarget,
        fibrousCarbs: state.prescription.fibrousCarbsTarget,
      },
      remaining: {
        calories: state.remaining.calories,
        protein: state.remaining.protein,
        carbs: state.remaining.carbs,
        fat: state.remaining.fat,
        starchyCarbs: state.remaining.starchyCarbs,
        starchMealsRemaining: state.remaining.starchMealsRemaining,
      },
      planned: {
        calories: state.planned.calories,
        protein: state.planned.protein,
        carbs: state.planned.carbs,
        fat: state.planned.fat,
        starchyCarbs: state.planned.starchyCarbs,
        starchMeals: state.planned.starchMealsPlanned,
      },
      starch: {
        isZeroStarchDay: state.prescription.isZeroStarchDay,
        distributionStrategy: state.prescription.starchDistributionStrategy,
        gramsPerRemainingMeal: state.prescription.gramsPerRemainingStarchMeal ?? null,
      },
    },
  };
}