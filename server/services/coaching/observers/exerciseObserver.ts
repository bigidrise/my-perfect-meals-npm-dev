/**
 * Exercise Observer — Phase 3
 *
 * Data sources:
 *   users.performance_context JSONB  — training profile (reported, user-entered during setup)
 *   ace_daily_checkins               — subjective recovery signals (reported, daily self-assessment)
 *
 * OBSERVABILITY: PARTIALLY OBSERVABLE
 *
 * There is NO dedicated exercise_logs, workout_sessions, or training_log table
 * in the MPM database. The Exercise Observer can see:
 *   ✅ What training the user says they do (performance_context profile)
 *   ✅ How they feel after training (ACE check-in: soreness, energy, schedule)
 *   ❌ What they actually did in any given session
 *   ❌ Duration, volume, sets/reps, calories burned
 *   ❌ Whether a scheduled session was completed or skipped
 *
 * This boundary is enforced in findings.metric "exercise_observability"
 * and must be communicated to the LLM renderer.
 *
 * NOT allowed to infer:
 *   - Actual workouts completed vs planned
 *   - Caloric expenditure from exercise
 *   - Recovery adequacy as a medical assessment
 *   - Whether soreness is from training vs illness/injury
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

export const exerciseObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "exercise",
  name: "Exercise & Recovery Observer",
  description:
    "Reads performance_context (training profile) and ace_daily_checkins (soreness, energy). " +
    "PARTIALLY OBSERVABLE: no workout log table exists. Reports profile intent and subjective recovery only.",
  supportedWindows: ["today", "7d", "30d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "fatigue_low_energy",
    "weight_loss_plateau",
    "rapid_weight_gain",
    "general_inquiry",
  ],
  sourcesQueried: [
    "users.performance_context JSONB — training type, frequency, phase, cardio focus (reported, profile-level)",
    "ace_daily_checkins (user_id, date, energy, soreness, schedule, stress, sleep) — unique(user_id,date)",
    "⚠ exercise_logs — NOT YET OBSERVABLE (table does not exist)",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    // Permanently record that actual workout logs are not available
    findings.push({
      metric: "exercise_observability",
      value: "partial_profile_and_subjective_only",
      quality: "inferred",
      window: "30d",
      source: "observer_audit",
      observedAt: now,
    });

    try {
      // ── Performance context (training profile) ─────────────────────────────
      const profileRows = await db.execute<{
        performance_context: string | null;
        performance_mode_enabled: boolean | null;
      }>(sql`
        SELECT performance_context, performance_mode_enabled
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `);

      const profileRow = profileRows.rows[0];
      const hasPerformanceMode = profileRow?.performance_mode_enabled === true;

      findings.push({
        metric: "has_performance_profile",
        value: hasPerformanceMode,
        quality: "reported",
        window: "today",
        source: "users.performance_mode_enabled",
        observedAt: now,
      });

      if (hasPerformanceMode && profileRow?.performance_context) {
        let ctx: Record<string, unknown>;
        try {
          ctx = typeof profileRow.performance_context === "string"
            ? JSON.parse(profileRow.performance_context)
            : (profileRow.performance_context as Record<string, unknown>);
        } catch {
          ctx = {};
        }

        if (ctx.trainingType) {
          findings.push({
            metric: "training_type",
            value: String(ctx.trainingType),
            quality: "reported",
            window: "today",
            source: "users.performance_context",
            observedAt: now,
          });
        }
        if (ctx.trainingFrequency) {
          findings.push({
            metric: "training_frequency_setting",
            value: String(ctx.trainingFrequency),
            quality: "reported",
            window: "today",
            source: "users.performance_context",
            observedAt: now,
          });
        }
        if (ctx.trainingPhase) {
          findings.push({
            metric: "training_phase",
            value: String(ctx.trainingPhase),
            quality: "reported",
            window: "today",
            source: "users.performance_context",
            observedAt: now,
          });
        }
        if (ctx.cardioFocus) {
          findings.push({
            metric: "cardio_focus",
            value: String(ctx.cardioFocus),
            quality: "reported",
            window: "today",
            source: "users.performance_context",
            observedAt: now,
          });
        }
        if (ctx.twoADays !== undefined) {
          findings.push({
            metric: "two_a_days",
            value: Boolean(ctx.twoADays),
            quality: "reported",
            window: "today",
            source: "users.performance_context",
            observedAt: now,
          });
        }
      }

      // ── ACE Daily Check-in — subjective recovery signals (7d) ─────────────
      const checkinRows = await db.execute<{
        checkin_days: string;
        avg_energy: string | null;
        avg_soreness: string | null;
        avg_stress: string | null;
        avg_sleep: string | null;
        has_schedule_flag: string;
      }>(sql`
        SELECT
          COUNT(*)::text                                AS checkin_days,
          AVG(CASE WHEN energy IS NOT NULL THEN energy::numeric END)::text    AS avg_energy,
          AVG(CASE WHEN soreness IS NOT NULL THEN soreness::numeric END)::text AS avg_soreness,
          AVG(CASE WHEN stress IS NOT NULL THEN stress::numeric END)::text     AS avg_stress,
          AVG(CASE WHEN sleep IS NOT NULL THEN sleep::numeric END)::text       AS avg_sleep,
          COUNT(CASE WHEN schedule IS NOT NULL THEN 1 END)::text              AS has_schedule_flag
        FROM ace_daily_checkins
        WHERE user_id = ${userId}
          AND date >= CURRENT_DATE - INTERVAL '7 days'
      `);

      const cr = checkinRows.rows[0];
      const checkinDays = parseInt(cr?.checkin_days ?? "0");

      findings.push({
        metric: "ace_checkin_days_7d",
        value: checkinDays,
        quality: checkinDays > 0 ? "reported" : "missing",
        window: "7d",
        source: "ace_daily_checkins",
        observedAt: now,
      });

      if (checkinDays > 0) {
        if (cr?.avg_energy !== null && cr?.avg_energy !== undefined) {
          findings.push({
            metric: "avg_subjective_energy_7d",
            value: Math.round(parseFloat(cr.avg_energy!) * 10) / 10,
            quality: "reported",
            window: "7d",
            source: "ace_daily_checkins",
            observedAt: now,
          });
        }
        if (cr?.avg_soreness !== null && cr?.avg_soreness !== undefined) {
          findings.push({
            metric: "avg_subjective_soreness_7d",
            value: Math.round(parseFloat(cr.avg_soreness!) * 10) / 10,
            quality: "reported",
            window: "7d",
            source: "ace_daily_checkins",
            observedAt: now,
          });
        }
        if (cr?.avg_sleep !== null && cr?.avg_sleep !== undefined) {
          findings.push({
            metric: "avg_subjective_sleep_7d",
            value: Math.round(parseFloat(cr.avg_sleep!) * 10) / 10,
            quality: "reported",
            window: "7d",
            source: "ace_daily_checkins",
            observedAt: now,
          });
        }
      }
    } catch (err: any) {
      console.error("[ExerciseObserver] Query failed:", err.message);
    }

    return {
      observerId: "exercise",
      findings,
      ranAt: now,
      windowsCovered: ["today", "7d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
