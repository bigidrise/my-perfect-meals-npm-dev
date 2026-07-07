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
import { users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { glucoseLogs } from "../../shared/diabetes-schema";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import {
  buildNutritionSummary,
  type UserExtrasForSummary,
} from "../services/nutritionSummary/buildNutritionSummary";

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
        dailyCalorieTarget:     (users as any).dailyCalorieTarget,
        dailyProteinTarget:     (users as any).dailyProteinTarget,
        dailyCarbTarget:        (users as any).dailyCarbsTarget,
        dailyFatTarget:         (users as any).dailyFatTarget,
        goalType:               (users as any).goalType,
        goalTarget:             (users as any).goalTarget,
        goalTimelineWeeks:      (users as any).goalTimelineWeeks,
        fitnessGoal:            users.fitnessGoal,
        performanceContext:     users.performanceContext,
        weeklyTrainingSchedule: (users as any).weeklyTrainingSchedule,
        selectedMealBuilder:    users.selectedMealBuilder,
        activeBoard:            users.activeBoard,
        carbCycleState:         (users as any).carbCycleState,
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
      dailyCalorieTarget:     userRow?.dailyCalorieTarget ?? null,
      dailyProteinTarget:     userRow?.dailyProteinTarget ?? null,
      dailyCarbTarget:        userRow?.dailyCarbTarget ?? null,
      dailyFatTarget:         userRow?.dailyFatTarget ?? null,
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
    };

    const summary = buildNutritionSummary(envelope, extras);

    return res.json(summary);
  } catch (err) {
    console.error("[NutritionSummary] Error:", err);
    return res.status(500).json({ error: "Failed to build nutrition summary" });
  }
});

export default router;
