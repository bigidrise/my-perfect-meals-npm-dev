/**
 * Hydration Observer — Phase 3
 *
 * Data sources (authoritative):
 *   water_logs — user_id + intake_time indexes (two: byUserCreated, byUserIntake) ✅
 *
 * Provenance: REPORTED — users manually log water intake.
 * No automatic device sync for hydration.
 *
 * Baseline: 2000 ml/day (general adult adequacy threshold).
 * This is an INVESTIGATION SIGNAL only — not a clinical prescription.
 * Individual needs vary by body size, activity, climate, health conditions.
 *
 * NOT allowed to infer:
 *   - Dehydration as a medical finding
 *   - Whether low intake caused any symptom
 *   - Optimal intake for this specific user
 *   - Total fluid intake (coffee, food water content, etc. are not tracked)
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";
import {
  hydrationCalendarWindow,
  resolveHydrationDay,
} from "../../hydration/hydrationDay";

/** Investigation signal — not a clinical standard */
const BASELINE_ML_PER_DAY = 2000;

export const hydrationObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "hydration",
  name: "Hydration Observer",
  description:
    "Reads water_logs to compute average daily water intake (ml) over 7d. " +
    "Flags low/adequate/high relative to a 2000 ml/day baseline. " +
    "All evidence is reported (manual user entry).",
  supportedWindows: ["today", "7d", "30d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "fatigue_low_energy",
    "rapid_weight_gain",
    "cravings",
    "general_inquiry",
  ],
  sourcesQueried: [
    "water_logs (user_id, amount_ml, intake_time) — water_logs_user_intake_idx",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    try {
      const hydrationDay = await resolveHydrationDay({
        subjectUserId: userId,
        now,
      });
      const window = hydrationCalendarWindow({
        endingLocalDate: hydrationDay.localDate,
        timezone: hydrationDay.timezone,
        days: 7,
      });
      // ── 7-day aggregate ────────────────────────────────────────────────────
      const rows = await db.execute<{
        log_days: string;
        total_ml: string;
        latest_intake: string | null;
      }>(sql`
        SELECT
          COUNT(DISTINCT DATE(intake_time AT TIME ZONE ${hydrationDay.timezone}))::text AS log_days,
          COALESCE(SUM(amount_ml), 0)::text       AS total_ml,
          MAX(intake_time)::text                  AS latest_intake
        FROM water_logs
        WHERE user_id = ${userId}
          AND intake_time >= ${window.start.toISOString()}
          AND intake_time <= ${window.end.toISOString()}
      `);

      const r = rows.rows[0];
      const logDays = parseInt(r?.log_days ?? "0");
      const totalMl = parseInt(r?.total_ml ?? "0");
      const latestIntake = r?.latest_intake ? new Date(r.latest_intake) : null;

      findings.push({
        metric: "water_log_days_7d",
        value: logDays,
        quality: logDays > 0 ? "reported" : "missing",
        window: "7d",
        source: "water_logs",
        observedAt: now,
      });

      if (logDays === 0) {
        findings.push({
          metric: "avg_daily_water_ml_7d",
          value: null,
          quality: "missing",
          window: "7d",
          source: "water_logs",
          observedAt: now,
        });
        findings.push({
          metric: "hydration_vs_baseline",
          value: null,
          quality: "missing",
          window: "7d",
          source: "water_logs",
          observedAt: now,
        });
      } else {
        const avgMl = Math.round(totalMl / logDays);
        findings.push({
          metric: "avg_daily_water_ml_7d",
          value: avgMl,
          quality: "reported",
          window: "7d",
          source: "water_logs",
          observedAt: latestIntake ?? now,
        });

        // Adequacy signal — investigation threshold only
        const adequacy =
          avgMl >= BASELINE_ML_PER_DAY * 1.2 ? "high"
          : avgMl >= BASELINE_ML_PER_DAY * 0.8 ? "adequate"
          : "low";

        findings.push({
          metric: "hydration_vs_baseline",
          value: adequacy,
          quality: "inferred",    // derived from threshold comparison, not measured
          window: "7d",
          source: "water_logs",
          observedAt: now,
        });
      }

      // Recency — how long since last water log
      if (latestIntake) {
        const hoursAgo = Math.round(
          (now.getTime() - latestIntake.getTime()) / 3600000
        );
        findings.push({
          metric: "last_water_log_hours_ago",
          value: hoursAgo,
          quality: "reported",
          window: "today",
          source: "water_logs",
          observedAt: now,
        });
      }

      // ── Tracking note ──────────────────────────────────────────────────────
      // Explicitly state what is NOT observable to ensure the engine
      // can't claim full hydration coverage:
      // - Non-water beverages (coffee, juice, sports drinks) not tracked
      // - Food water content not tracked
      findings.push({
        metric: "hydration_tracking_scope",
        value: "water_only_no_beverages_or_food_water",
        quality: "inferred",
        window: "7d",
        source: "water_logs",
        observedAt: now,
      });
    } catch (err: any) {
      console.error("[HydrationObserver] Query failed:", err.message);
    }

    return {
      observerId: "hydration",
      findings,
      ranAt: now,
      windowsCovered: ["today", "7d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
