import { Router } from "express";
import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { biometricSample } from "../../shared/biometricsSchema";
import { eq, gte, and, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

export type PatternAlertPriority = "low" | "medium" | "high";
export type PatternAlertKind = "drift" | "positive";

export interface PatternAlert {
  type:
    | "no_meal_logs_3d"
    | "low_protein_streak"
    | "macro_consistency_low"
    | "no_weigh_in_7d"
    | "protein_target_streak"
    | "macro_consistency_strong"
    | "routine_strong_week";
  priority: PatternAlertPriority;
  kind: PatternAlertKind;
}

const PRIORITY_RANK: Record<PatternAlertPriority, number> = {
  high: 3, medium: 2, low: 1,
};

// Which focus areas each pattern belongs to — unmapped patterns always pass through
const PATTERN_FOCUS_MAP: Record<string, string[]> = {
  no_meal_logs_3d:          ["Meal compliance"],
  low_protein_streak:       ["Meal compliance"],
  macro_consistency_low:    ["Meal compliance"],
  no_weigh_in_7d:           ["Weight consistency"],
  protein_target_streak:    ["Meal compliance"],
  macro_consistency_strong: ["Meal compliance"],
  routine_strong_week:      ["Weight consistency", "Meal compliance"],
};

function shouldInclude(type: string, focusAreas: string[]): boolean {
  if (!focusAreas || focusAreas.length === 0) return true;
  const mapped = PATTERN_FOCUS_MAP[type];
  if (!mapped || mapped.length === 0) return true; // unmapped always included
  return mapped.some((area) => focusAreas.includes(area));
}

interface ThresholdProfile {
  habitMinDays: number;
  consistencyLowMax: number;   // < this many days in last 7 triggers drift
  proteinLowPct: number;
  consistencyHighMin: number;  // >= this many days in last 7 triggers positive
  proteinStreakDays: number;   // days hitting protein target for positive
}

const THRESHOLDS: Record<string, ThresholdProfile> = {
  light: {
    habitMinDays: 3,
    consistencyLowMax: 3,
    proteinLowPct: 0.60,
    consistencyHighMin: 7,
    proteinStreakDays: 6,
  },
  regular: { // defaults
    habitMinDays: 2,
    consistencyLowMax: 4,
    proteinLowPct: 0.70,
    consistencyHighMin: 6,
    proteinStreakDays: 5,
  },
  persistent: {
    habitMinDays: 1,
    consistencyLowMax: 5,
    proteinLowPct: 0.80,
    consistencyHighMin: 5,
    proteinStreakDays: 4,
  },
};

// GET /api/pattern-alerts
// Returns behavioral pattern alerts for the authenticated user.
// Positive patterns win if detected — never mix positive and drift in same response.
// Coaching preferences (style, focusAreas, frequency) read from app_preferences server-side.
router.get("/pattern-alerts", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const now = new Date();
    const threeDaysAgo   = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000);
    const sevenDaysAgo   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch macro logs + user row (protein target + coaching prefs) in parallel
    const [last14Logs, [userRow], recentWeightSamples, anyWeightSample] =
      await Promise.all([
        db.select({ at: macroLogs.at, protein: macroLogs.protein })
          .from(macroLogs)
          .where(and(eq(macroLogs.userId, userId), gte(macroLogs.at, fourteenDaysAgo))),

        db.select({
            dailyProteinTarget: users.dailyProteinTarget,
            appPreferences: sql<Record<string, any>>`app_preferences`,
          })
          .from(users)
          .where(eq(users.id, userId)),

        db.select({ startTime: biometricSample.startTime })
          .from(biometricSample)
          .where(and(
            eq(biometricSample.userId, userId),
            eq(biometricSample.type, "weight"),
            gte(biometricSample.startTime, sevenDaysAgo),
          ))
          .limit(1),

        db.select({ startTime: biometricSample.startTime })
          .from(biometricSample)
          .where(and(
            eq(biometricSample.userId, userId),
            eq(biometricSample.type, "weight"),
          ))
          .limit(1),
      ]);

    // --- Coaching preferences (server-authoritative, validated against allowlists) ---
    const coachingRaw = userRow?.appPreferences?.coaching ?? {};
    const VALID_STYLES = ["supportive", "balanced", "high_accountability"] as const;
    const VALID_FREQUENCIES = ["light", "regular", "persistent"] as const;
    const VALID_FOCUS_AREAS = [
      "Weight consistency", "Grocery guidance", "Meal compliance",
      "Emotional eating", "Workout adherence",
    ] as const;

    const coachingStyle: string = VALID_STYLES.includes(coachingRaw.style)
      ? coachingRaw.style : "balanced";
    const frequency: string = VALID_FREQUENCIES.includes(coachingRaw.frequency)
      ? coachingRaw.frequency : "regular";
    const focusAreas: string[] = Array.isArray(coachingRaw.focusAreas)
      ? coachingRaw.focusAreas.filter((a: unknown) => VALID_FOCUS_AREAS.includes(a as any))
      : [];

    const t = THRESHOLDS[frequency] ?? THRESHOLDS.regular;

    // --- Pre-compute day sets ---
    const last3Logs  = last14Logs.filter((l) => new Date(l.at) >= threeDaysAgo);
    const last7Logs  = last14Logs.filter((l) => new Date(l.at) >= sevenDaysAgo);
    const days14 = new Set(last14Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)));
    const days3  = new Set(last3Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)));
    const days7  = new Set(last7Logs.map((l) => new Date(l.at).toISOString().slice(0, 10)));
    const proteinTarget = userRow?.dailyProteinTarget ?? 0;

    // =========================================================
    // POSITIVE PATTERNS — checked first; positive wins if any exist
    // =========================================================
    const positive: PatternAlert[] = [];

    // Positive 1 — protein streak
    if (proteinTarget > 0 && last7Logs.length >= t.proteinStreakDays) {
      // Count days where avg protein for that day met the target
      const dayProtein: Record<string, number[]> = {};
      for (const l of last7Logs) {
        const d = new Date(l.at).toISOString().slice(0, 10);
        if (!dayProtein[d]) dayProtein[d] = [];
        dayProtein[d].push(parseFloat(String(l.protein ?? "0")));
      }
      const daysOnTarget = Object.values(dayProtein).filter(
        (vals) => vals.reduce((s, v) => s + v, 0) / vals.length >= proteinTarget * 0.90,
      ).length;
      if (daysOnTarget >= t.proteinStreakDays && shouldInclude("protein_target_streak", focusAreas)) {
        positive.push({ type: "protein_target_streak", priority: "medium", kind: "positive" });
      }
    }

    // Positive 2 — strong consistency week
    if (days7.size >= t.consistencyHighMin && shouldInclude("macro_consistency_strong", focusAreas)) {
      positive.push({ type: "macro_consistency_strong", priority: "low", kind: "positive" });
    }

    // Positive 3 — strong routine: logging + weight check-in this week
    if (days7.size >= 5 && recentWeightSamples.length > 0 && shouldInclude("routine_strong_week", focusAreas)) {
      positive.push({ type: "routine_strong_week", priority: "low", kind: "positive" });
    }

    // If any positive patterns exist, return those only — never mix with drift
    if (positive.length > 0) {
      const sorted = positive
        .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
        .slice(0, 2);
      return res.json({ alerts: sorted, coachingStyle });
    }

    // =========================================================
    // DRIFT PATTERNS — only evaluated when no positives detected
    // =========================================================
    const drift: PatternAlert[] = [];

    // Drift 1 — no meal logs in last 3 days (established user only)
    if (days3.size === 0 && days14.size >= t.habitMinDays &&
        shouldInclude("no_meal_logs_3d", focusAreas)) {
      drift.push({ type: "no_meal_logs_3d", priority: "medium", kind: "drift" });
    }

    // Drift 2 — low protein streak
    if (proteinTarget > 0 && last3Logs.length >= 2 && shouldInclude("low_protein_streak", focusAreas)) {
      const avg = last3Logs.reduce((s, l) => s + parseFloat(String(l.protein ?? "0")), 0) / last3Logs.length;
      if (avg < proteinTarget * t.proteinLowPct) {
        drift.push({ type: "low_protein_streak", priority: "low", kind: "drift" });
      }
    }

    // Drift 3 — inconsistent week (not already captured by drift 1)
    if (!drift.some((a) => a.type === "no_meal_logs_3d") &&
        days7.size > 0 && days7.size < t.consistencyLowMax &&
        days14.size >= 3 &&
        shouldInclude("macro_consistency_low", focusAreas)) {
      drift.push({ type: "macro_consistency_low", priority: "low", kind: "drift" });
    }

    // Drift 4 — no weigh-in in last 7 days (established weigher only)
    if (recentWeightSamples.length === 0 && anyWeightSample.length > 0 &&
        shouldInclude("no_weigh_in_7d", focusAreas)) {
      drift.push({ type: "no_weigh_in_7d", priority: "low", kind: "drift" });
    }

    const sorted = drift
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
      .slice(0, 2);

    res.json({ alerts: sorted, coachingStyle });
  } catch (e: any) {
    console.error("[pattern-alerts] error:", e);
    res.status(500).json({ error: e.message || "Failed to compute alerts" });
  }
});

export default router;
