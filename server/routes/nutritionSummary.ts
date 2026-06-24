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
import { eq } from "drizzle-orm";
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
        dailyCalorieTarget:  (users as any).dailyCalorieTarget,
        dailyProteinTarget:  (users as any).dailyProteinTarget,
        dailyCarbTarget:     (users as any).dailyCarbsTarget,
        dailyFatTarget:      (users as any).dailyFatTarget,
        goalType:            (users as any).goalType,
        goalTarget:          (users as any).goalTarget,
        fitnessGoal:         users.fitnessGoal,
        performanceContext:  users.performanceContext,
        weeklyTrainingSchedule: (users as any).weeklyTrainingSchedule,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const extras: UserExtrasForSummary = {
      dailyCalorieTarget:  userRow?.dailyCalorieTarget ?? null,
      dailyProteinTarget:  userRow?.dailyProteinTarget ?? null,
      dailyCarbTarget:     userRow?.dailyCarbTarget ?? null,
      dailyFatTarget:      userRow?.dailyFatTarget ?? null,
      goalType:            userRow?.goalType ?? null,
      goalTarget:          userRow?.goalTarget ?? null,
      fitnessGoal:         userRow?.fitnessGoal ?? null,
      performanceContext:  userRow?.performanceContext ?? null,
      weeklyTrainingSchedule: userRow?.weeklyTrainingSchedule ?? null,
    };

    const summary = buildNutritionSummary(envelope, extras);

    return res.json(summary);
  } catch (err) {
    console.error("[NutritionSummary] Error:", err);
    return res.status(500).json({ error: "Failed to build nutrition summary" });
  }
});

export default router;
