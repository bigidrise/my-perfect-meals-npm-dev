import { Router } from "express";
import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { biometricSample } from "../../shared/biometricsSchema";
import { eq, gte, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

export type PatternAlertPriority = "low" | "medium" | "high";

export interface PatternAlert {
  type:
    | "no_meal_logs_3d"
    | "low_protein_streak"
    | "macro_consistency_low"
    | "no_weigh_in_7d";
  priority: PatternAlertPriority;
}

const PRIORITY_RANK: Record<PatternAlertPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// GET /api/pattern-alerts
// Returns behavioral pattern alerts for the authenticated user.
// Only fires for users who have established a habit — never punishes new users.
router.get("/pattern-alerts", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch last 14 days of macro logs to establish "active logger" baseline
    const last14Logs = await db
      .select({ at: macroLogs.at, protein: macroLogs.protein })
      .from(macroLogs)
      .where(and(eq(macroLogs.userId, userId), gte(macroLogs.at, fourteenDaysAgo)));

    // Fetch user protein target
    const [userRow] = await db
      .select({ dailyProteinTarget: users.dailyProteinTarget })
      .from(users)
      .where(eq(users.id, userId));

    // Fetch any weight biometric in last 7 days
    const recentWeightSamples = await db
      .select({ startTime: biometricSample.startTime })
      .from(biometricSample)
      .where(
        and(
          eq(biometricSample.userId, userId),
          eq(biometricSample.type, "weight"),
          gte(biometricSample.startTime, sevenDaysAgo),
        ),
      )
      .limit(1);

    // Fetch at least one historical weight sample (establishes they use the feature)
    const anyWeightSample = await db
      .select({ startTime: biometricSample.startTime })
      .from(biometricSample)
      .where(
        and(
          eq(biometricSample.userId, userId),
          eq(biometricSample.type, "weight"),
        ),
      )
      .limit(1);

    const alerts: PatternAlert[] = [];

    const last3Logs = last14Logs.filter((l) => new Date(l.at) >= threeDaysAgo);
    const last7Logs = last14Logs.filter((l) => new Date(l.at) >= sevenDaysAgo);
    const last14Logs_activeDays = new Set(
      last14Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)),
    );
    const last3Days = new Set(
      last3Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)),
    );
    const last7Days = new Set(
      last7Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)),
    );

    // Pattern 1 — no meal logs in last 3 days, but they were active in the prior 14
    // Requires at least 2 logging days in the last 14 to qualify (established user)
    if (last3Days.size === 0 && last14Logs_activeDays.size >= 2) {
      alerts.push({ type: "no_meal_logs_3d", priority: "medium" });
    }

    // Pattern 2 — low protein streak (only when there are recent logs to evaluate)
    const proteinTarget = userRow?.dailyProteinTarget;
    if (proteinTarget && proteinTarget > 0 && last3Logs.length >= 2) {
      const totalProtein = last3Logs.reduce(
        (sum, l) => sum + parseFloat(String(l.protein ?? "0")),
        0,
      );
      const avgProtein = totalProtein / last3Logs.length;
      if (avgProtein < proteinTarget * 0.7) {
        alerts.push({ type: "low_protein_streak", priority: "low" });
      }
    }

    // Pattern 3 — inconsistent week: logged fewer than 4 of last 7 days
    // Only fires if they logged at least 3 days in prior 14 (not already captured by no_meal_logs_3d)
    const alreadyFlagged = alerts.some((a) => a.type === "no_meal_logs_3d");
    if (
      !alreadyFlagged &&
      last7Days.size > 0 &&
      last7Days.size < 4 &&
      last14Logs_activeDays.size >= 3
    ) {
      alerts.push({ type: "macro_consistency_low", priority: "low" });
    }

    // Pattern 4 — no weigh-in in last 7 days, but they have logged weight before
    if (recentWeightSamples.length === 0 && anyWeightSample.length > 0) {
      alerts.push({ type: "no_weigh_in_7d", priority: "low" });
    }

    // Return sorted by priority, top alerts only (max 2 — don't overwhelm)
    const sorted = alerts
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
      .slice(0, 2);

    res.json({ alerts: sorted });
  } catch (e: any) {
    console.error("[pattern-alerts] error:", e);
    res.status(500).json({ error: e.message || "Failed to compute alerts" });
  }
});

export default router;
