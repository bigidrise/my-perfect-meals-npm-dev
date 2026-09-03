/**
 * nutritionSummary.ts
 *
 * GET /api/nutrition-summary
 *
 * Returns a NutritionPersonalizationSummary DTO for the authenticated user.
 * Read-only. Reuses the Protocol Envelope — no new protocol logic.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { macroProgramHistory, mealPlansCurrent, users } from "@shared/schema";
import { and, eq, desc, ne } from "drizzle-orm";
import { glucoseLogs } from "../../shared/diabetes-schema";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import {
  buildNutritionSummary,
  type UserExtrasForSummary,
} from "../services/nutritionSummary/buildNutritionSummary";
import { resolveHydrationDay } from "../services/hydration/hydrationDay";
import { resolveHydrationCenterState } from "../services/hydration/hydrationCenterService";
import { hydrationClinicianDirectives } from "../db/schema/hydration";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).authUser?.id as string;

    const envelope = await loadUserProtocolEnvelope(userId);
    if (!envelope) {
      return res.status(404).json({ error: "User not found" });
    }

    const [userRow] = await db
      .select({
        dailyCalorieTarget:       (users as any).dailyCalorieTarget,
        dailyProteinTarget:       (users as any).dailyProteinTarget,
        dailyCarbTarget:          (users as any).dailyCarbsTarget,
        dailyStarchyCarbsTarget:  (users as any).dailyStarchyCarbsTarget,
        dailyFibrousCarbsTarget:  (users as any).dailyFibrousCarbsTarget,
        dailyFatTarget:           (users as any).dailyFatTarget,
        goalType:               (users as any).goalType,
        goalTarget:             (users as any).goalTarget,
        goalTimelineWeeks:      (users as any).goalTimelineWeeks,
        fitnessGoal:            users.fitnessGoal,
        performanceContext:     users.performanceContext,
        weeklyTrainingSchedule: (users as any).weeklyTrainingSchedule,
        selectedMealBuilder:    users.selectedMealBuilder,
        activeBoard:            users.activeBoard,
        carbCycleState:         (users as any).carbCycleState,
        alphaGalProfile:        (users as any).alphaGalProfile,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [latestGlucoseLog] = await db
      .select({ value: glucoseLogs.valueMgdl })
      .from(glucoseLogs)
      .where(eq(glucoseLogs.userId, userId))
      .orderBy(desc(glucoseLogs.recordedAt))
      .limit(1);

    const extras: UserExtrasForSummary = {
      dailyCalorieTarget:       userRow?.dailyCalorieTarget       ?? null,
      dailyProteinTarget:       userRow?.dailyProteinTarget       ?? null,
      dailyCarbTarget:          userRow?.dailyCarbTarget          ?? null,
      dailyStarchyCarbsTarget:  userRow?.dailyStarchyCarbsTarget  ?? null,
      dailyFibrousCarbsTarget:  userRow?.dailyFibrousCarbsTarget  ?? null,
      dailyFatTarget:           userRow?.dailyFatTarget           ?? null,
      goalType:               userRow?.goalType ?? null,
      goalTarget:             userRow?.goalTarget ?? null,
      goalTimelineWeeks:      userRow?.goalTimelineWeeks ?? null,
      fitnessGoal:            userRow?.fitnessGoal ?? null,
      performanceContext:     userRow?.performanceContext ?? null,
      weeklyTrainingSchedule: userRow?.weeklyTrainingSchedule ?? null,
      latestGlucose:          latestGlucoseLog?.value ?? null,
      selectedMealBuilder:    userRow?.selectedMealBuilder ?? null,
      activeBoard:            userRow?.activeBoard ?? null,
      carbCycleState:         userRow?.carbCycleState ?? null,
      alphaGalProfile:        (userRow?.alphaGalProfile as any) ?? null,
    };

    const summary = buildNutritionSummary(envelope, extras);
    const hydrationDay = await resolveHydrationDay({ subjectUserId: userId });
    const hydrationState = await resolveHydrationCenterState({
      subjectUserId: userId,
      localDate: hydrationDay.localDate,
      timezone: hydrationDay.timezone,
      access: {
        authenticatedUserId: userId,
        subjectUserId: userId,
        mode: "self",
        authorizationStatus: "allowed",
      },
    });
    const directiveId = hydrationState.numericPolicy.directiveId;
    const [directiveRow] = directiveId
      ? await db
          .select({
            id: hydrationClinicianDirectives.id,
            authorUserId: hydrationClinicianDirectives.authorUserId,
            createdAt: hydrationClinicianDirectives.createdAt,
            expiresAt: hydrationClinicianDirectives.expiresAt,
          })
          .from(hydrationClinicianDirectives)
          .where(eq(hydrationClinicianDirectives.id, directiveId))
          .limit(1)
      : [];
    const [latestMacroUpdate] = await db
      .select()
      .from(macroProgramHistory)
      .where(and(
        eq(macroProgramHistory.clientUserId, userId),
        ne(macroProgramHistory.coachUserId, userId),
      ))
      .orderBy(desc(macroProgramHistory.createdAt))
      .limit(1);
    const [latestMealPlan] = await db
      .select()
      .from(mealPlansCurrent)
      .where(eq(mealPlansCurrent.userId, userId))
      .limit(1);

    const professionalUpdates: NonNullable<typeof summary.professionalUpdates> = [];
    if (directiveRow?.authorUserId && directiveRow.authorUserId !== userId) {
      professionalUpdates.push({
        id: `hydration:${directiveRow.id}`,
        kind: "hydration",
        title: "Hydration Plan updated",
        detail: "Your care team changed your authorized Hydration guidance.",
        changedAt: directiveRow.createdAt.toISOString(),
        href: "/hydration",
      });
    }
    if (latestMacroUpdate?.coachUserId && latestMacroUpdate.coachUserId !== userId) {
      professionalUpdates.push({
        id: `macros:${latestMacroUpdate.id}`,
        kind: "macros",
        title: "Nutrition targets updated",
        detail: "Your care team changed your macro targets.",
        changedAt: latestMacroUpdate.createdAt.toISOString(),
        href: "/dashboard",
      });
    }
    const mealPlanMeta = latestMealPlan?.meta as Record<string, unknown> | undefined;
    const mealPlanActor = typeof mealPlanMeta?.updatedByUserId === "string"
      ? mealPlanMeta.updatedByUserId
      : typeof mealPlanMeta?.assignedByUserId === "string"
        ? mealPlanMeta.assignedByUserId
        : null;
    if (latestMealPlan && mealPlanActor && mealPlanActor !== userId) {
      professionalUpdates.push({
        id: `meal_plan:${latestMealPlan.updatedAt.toISOString()}`,
        kind: "meal_plan",
        title: "Meal plan updated",
        detail: "Your care team changed your current meal plan.",
        changedAt: latestMealPlan.updatedAt.toISOString(),
        href: "/weekly-meal-planner",
      });
    }
    professionalUpdates.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    const liquid = hydrationState.liquidProtocol;
    const currentDay = liquid && liquid.status === "active"
      ? Math.max(
          1,
          Math.floor(
            (Date.parse(`${hydrationState.localDate}T12:00:00Z`) -
              Date.parse(`${liquid.startsOn}T12:00:00Z`)) /
              86_400_000,
          ) + 1,
        )
      : null;

    return res.json({
      ...summary,
      hydration: {
        tracking: {
          status: hydrationState.numericPolicy.status,
          targetKind: hydrationState.numericPolicy.targetKind,
          targetMl: hydrationState.numericPolicy.targetMl,
          minimumMl: hydrationState.numericPolicy.minimumMl,
          maximumMl: hydrationState.numericPolicy.maximumMl,
          validThrough: directiveRow?.expiresAt?.toISOString() ?? null,
        },
        liquidNutrition: liquid
          ? {
              status: liquid.status,
              startsOn: liquid.startsOn,
              endsOn: liquid.endsOn,
              currentDay,
              verificationStatus: liquid.verificationStatus,
            }
          : null,
        href: "/hydration",
      },
      professionalUpdates: professionalUpdates.slice(0, 3),
    });
  } catch (err) {
    console.error("[NutritionSummary] Error:", err);
    return res.status(500).json({ error: "Failed to build nutrition summary" });
  }
});

export default router;
