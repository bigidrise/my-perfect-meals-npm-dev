/**
 * Compliance Observer — Phase 3B (redesigned)
 *
 * Data sources:
 *   macro_logs               — logging frequency (reported)
 *   water_logs               — hydration logging frequency (reported)
 *   ace_daily_checkins       — daily check-in frequency (reported)
 *   biometric_sample         — weight entry recency (measured or reported)
 *   platform_activity_events — feature usage vs confirmed consumption events
 *
 * PURPOSE:
 * The Compliance Observer tells the coaching engine how complete its picture
 * actually is before it gives advice. If a user asks "why am I not losing weight?"
 * and they've logged only 2 days in the past 30, the engine MUST know that before
 * the LLM renderer produces a confident response.
 *
 * PHASE 3B REDESIGN — "Data Coverage" framing:
 * A person who doesn't log something isn't necessarily non-compliant with their
 * plan — the database may simply be incomplete. The engine must not shame someone
 * because the database is incomplete. Naming it "Data Coverage Score" instead of
 * "Compliance Score" reflects this distinction.
 *
 * PRIMARY evidence: structured breakdown per signal (authoritative for reasoning).
 * SECONDARY: data_coverage_score (0–100) for dashboard presentation only.
 *   The Coaching Engine MUST NOT use the composite number as its primary reasoning.
 *   It must use the individual signal findings instead.
 *
 * Coverage components:
 *   Macro logging consistency (7d): 0–40 pts
 *   Water logging consistency (7d): 0–20 pts
 *   ACE check-in consistency (7d):  0–20 pts
 *   Biometric recency:              0–20 pts
 *   Platform activity (bonus context, not scored): usage vs confirmed consumption
 *
 * NOT allowed to infer:
 *   - Why the user isn't logging (illness, vacation, disengagement)
 *   - Whether missing logs mean the user ate well or poorly
 *   - That a low score means the user is non-compliant with their diet
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

export const complianceObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "compliance",
  name: "Data Coverage & Evidence Completeness Observer",
  description:
    "Assesses how complete the coaching engine's behavioral picture is. " +
    "Returns structured per-signal findings (macro logs, water logs, check-ins, biometrics, platform activity). " +
    "Also returns data_coverage_score (0–100) as a SECONDARY presentation metric only — " +
    "the engine reasons from individual signal findings, never from the composite score. " +
    "Phase 3B: now includes platform_activity_events to distinguish feature usage from confirmed consumption.",
  supportedWindows: ["today", "7d", "30d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "weight_loss_plateau",
    "rapid_weight_gain",
    "fatigue_low_energy",
    "cravings",
    "restaurant_eating",
    "general_inquiry",
  ],
  sourcesQueried: [
    "macro_logs (user_id, at) — distinct log days in 7d and 30d",
    "water_logs (user_id, intake_time) — distinct log days in 7d",
    "ace_daily_checkins (user_id, date) — distinct check-in days in 7d",
    "biometric_sample (user_id, type='weight', start_time) — recency of last weight entry",
    "platform_activity_events (owner_user_id, event_class, occurred_at) — usage vs consumption event counts in 7d",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    let macroLogDays7 = 0;
    let waterLogDays7 = 0;
    let checkinDays7 = 0;
    let biometricDaysAgo: number | null = null;

    try {
      // ── Macro log frequency ─────────────────────────────────────────────────
      const macroRows = await db.execute<{
        log_days_7d: string;
        log_days_30d: string;
      }>(sql`
        SELECT
          COUNT(DISTINCT CASE WHEN at >= NOW() - INTERVAL '7 days'  THEN DATE(at AT TIME ZONE 'UTC') END)::text AS log_days_7d,
          COUNT(DISTINCT CASE WHEN at >= NOW() - INTERVAL '30 days' THEN DATE(at AT TIME ZONE 'UTC') END)::text AS log_days_30d
        FROM macro_logs
        WHERE user_id = ${userId}
          AND at >= NOW() - INTERVAL '30 days'
      `);

      macroLogDays7 = parseInt(macroRows.rows[0]?.log_days_7d ?? "0");
      const macroLogDays30 = parseInt(macroRows.rows[0]?.log_days_30d ?? "0");

      findings.push({
        metric: "macro_log_days_7d",
        value: macroLogDays7,
        quality: macroLogDays7 > 0 ? "reported" : "missing",
        window: "7d",
        source: "macro_logs",
        observedAt: now,
      });
      findings.push({
        metric: "macro_log_days_30d",
        value: macroLogDays30,
        quality: macroLogDays30 > 0 ? "reported" : "missing",
        window: "30d",
        source: "macro_logs",
        observedAt: now,
      });

      // ── Water log frequency ─────────────────────────────────────────────────
      const hydrationDay = await resolveHydrationDay({
        subjectUserId: userId,
        now,
      });
      const hydrationWindow = hydrationCalendarWindow({
        endingLocalDate: hydrationDay.localDate,
        timezone: hydrationDay.timezone,
        days: 7,
      });
      const waterRows = await db.execute<{ log_days_7d: string }>(sql`
        SELECT COUNT(DISTINCT DATE(intake_time AT TIME ZONE ${hydrationDay.timezone}))::text AS log_days_7d
        FROM water_logs
        WHERE user_id = ${userId}
          AND intake_time >= ${hydrationWindow.start.toISOString()}
          AND intake_time <= ${hydrationWindow.end.toISOString()}
      `);

      waterLogDays7 = parseInt(waterRows.rows[0]?.log_days_7d ?? "0");
      findings.push({
        metric: "water_log_days_7d",
        value: waterLogDays7,
        quality: waterLogDays7 > 0 ? "reported" : "missing",
        window: "7d",
        source: "water_logs",
        observedAt: now,
      });

      // ── ACE check-in frequency ──────────────────────────────────────────────
      const checkinRows = await db.execute<{ checkin_days_7d: string }>(sql`
        SELECT COUNT(DISTINCT date)::text AS checkin_days_7d
        FROM ace_daily_checkins
        WHERE user_id = ${userId}
          AND date >= CURRENT_DATE - INTERVAL '7 days'
      `);

      checkinDays7 = parseInt(checkinRows.rows[0]?.checkin_days_7d ?? "0");
      findings.push({
        metric: "ace_checkin_days_7d",
        value: checkinDays7,
        quality: checkinDays7 > 0 ? "reported" : "missing",
        window: "7d",
        source: "ace_daily_checkins",
        observedAt: now,
      });

      // ── Biometric recency ───────────────────────────────────────────────────
      const bioRows = await db.execute<{ latest: string | null }>(sql`
        SELECT MAX(start_time)::text AS latest
        FROM biometric_sample
        WHERE user_id = ${userId}
          AND type = 'weight'
      `);

      const latestBio = bioRows.rows[0]?.latest;
      if (latestBio) {
        biometricDaysAgo = Math.floor(
          (now.getTime() - new Date(latestBio).getTime()) / 86400000
        );
        findings.push({
          metric: "biometric_weight_days_ago",
          value: biometricDaysAgo,
          quality: "measured",
          window: "90d",
          source: "biometric_sample",
          observedAt: now,
        });
      } else {
        findings.push({
          metric: "biometric_weight_days_ago",
          value: null,
          quality: "missing",
          window: "90d",
          source: "biometric_sample",
          observedAt: now,
        });
      }
    } catch (err: any) {
      console.error("[ComplianceObserver] Query failed:", err.message);
    }

    // ── Platform activity events (7d) ──────────────────────────────────────
    // Distinguish feature usage (opened/generated) from confirmed consumption (logged).
    // A high usage count with low consumption count means the user is exploring but
    // not confirming — important context for the coach.
    let platformUsageCount7d = 0;
    let platformConsumptionCount7d = 0;
    let platformEngagementCount7d = 0;
    try {
      const activityRows = await db.execute<{
        event_class: string;
        count: string;
      }>(sql`
        SELECT event_class, COUNT(*)::text AS count
        FROM platform_activity_events
        WHERE owner_user_id = ${userId}
          AND subject_type = 'user'
          AND occurred_at >= NOW() - INTERVAL '7 days'
        GROUP BY event_class
      `);

      for (const row of activityRows.rows) {
        const c = parseInt(row.count);
        if (row.event_class === "usage") platformUsageCount7d = c;
        else if (row.event_class === "consumption") platformConsumptionCount7d = c;
        else if (row.event_class === "engagement") platformEngagementCount7d = c;
      }

      findings.push({
        metric: "platform_usage_events_7d",
        value: platformUsageCount7d,
        quality: platformUsageCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events",
        observedAt: now,
      });
      findings.push({
        metric: "platform_consumption_events_7d",
        value: platformConsumptionCount7d,
        quality: platformConsumptionCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events",
        observedAt: now,
      });
      findings.push({
        metric: "platform_engagement_events_7d",
        value: platformEngagementCount7d,
        quality: platformEngagementCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events",
        observedAt: now,
      });
    } catch (actErr: any) {
      // Non-fatal — platform_activity_events may not exist yet in older envs
      console.warn("[ComplianceObserver] Activity events query skipped:", actErr.message);
    }

    // ── Data Coverage Score (0–100) — PRESENTATION ONLY ────────────────────
    //
    // ⚠️  The engine MUST reason from the individual signal findings above,
    //     not from this composite number. This score is for dashboard display.
    //     A low number does not mean the user is non-compliant — it means
    //     the database has incomplete behavioral data.
    //
    // Macro logging: 7 days = 40 pts max (proportional)
    const macroScore = Math.round((macroLogDays7 / 7) * 40);
    // Water logging: 7 days = 20 pts max
    const waterScore = Math.round((waterLogDays7 / 7) * 20);
    // ACE check-ins: 7 days = 20 pts max
    const checkinScore = Math.round((checkinDays7 / 7) * 20);
    // Biometric recency: 20 pts if within 7d, 10 pts if within 30d, 0 otherwise
    const bioScore =
      biometricDaysAgo === null ? 0
      : biometricDaysAgo <= 7 ? 20
      : biometricDaysAgo <= 30 ? 10
      : 0;

    const dataCoverageScore = macroScore + waterScore + checkinScore + bioScore;

    findings.push({
      metric: "data_coverage_score",
      value: dataCoverageScore,
      quality: "inferred",
      window: "7d",
      source: "compliance_observer_composite",
      observedAt: now,
    });

    // ── Evidence tier — LLM renderer uses this to calibrate its language ────
    const evidenceTier =
      dataCoverageScore >= 70 ? "strong"
      : dataCoverageScore >= 40 ? "moderate"
      : dataCoverageScore >= 15 ? "weak"
      : "insufficient";

    findings.push({
      metric: "evidence_tier",
      value: evidenceTier,
      quality: "inferred",
      window: "7d",
      source: "compliance_observer_composite",
      observedAt: now,
    });

    // ── Data gaps — inputs for the LLM renderer to caveat its response ──────
    const gaps: string[] = [];
    if (macroLogDays7 < 3) gaps.push("macro_logging_sparse");
    if (waterLogDays7 === 0) gaps.push("water_logging_absent");
    if (checkinDays7 === 0) gaps.push("daily_checkins_absent");
    if (biometricDaysAgo === null || biometricDaysAgo > 30) gaps.push("weight_data_stale_or_missing");
    if (platformUsageCount7d > 0 && platformConsumptionCount7d === 0) {
      gaps.push("platform_active_but_no_confirmed_consumption");
    }

    findings.push({
      metric: "data_gaps",
      value: gaps.length > 0 ? gaps.join(",") : "none",
      quality: "inferred",
      window: "7d",
      source: "compliance_observer_composite",
      observedAt: now,
    });

    return {
      observerId: "compliance",
      findings,
      ranAt: now,
      windowsCovered: ["7d", "30d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
