/**
 * Weight Observer — Phase 3
 *
 * Data sources (authoritative):
 *   biometric_sample  WHERE type = 'weight'   — user_id + start_time index ✅
 *   body_fat_entries                           — user_id + recorded_at index ✅
 *   users.weight                               — denormalized snapshot, no history
 *
 * Provenance rules:
 *   provider IN ('apple_health','health_connect','fitbit','garmin','oura','whoop') → measured
 *   provider IN ('manual','macro-calculator') → reported
 *   mix of both → mixed
 *
 * NOT allowed to infer:
 *   - Medical cause of weight change
 *   - Whether the trend will continue
 *   - Target weight or ideal weight from current weight
 *   - Caloric surplus/deficit from weight alone
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

const DEVICE_PROVIDERS = new Set([
  "apple_health",
  "health_connect",
  "fitbit",
  "garmin",
  "oura",
  "whoop",
]);

export const weightObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "weight",
  name: "Weight & Body Composition Observer",
  description:
    "Reads weight entries from biometric_sample and body_fat_entries. " +
    "Computes trend direction and velocity over 30d. " +
    "Distinguishes device-synced (measured) vs manually entered (reported).",
  supportedWindows: ["today", "7d", "30d", "90d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "weight_gain",
    "weight_loss_plateau",
    "rapid_weight_gain",
    "fatigue_low_energy",
    "general_inquiry",
  ],
  sourcesQueried: [
    "biometric_sample (user_id, type='weight', value, unit, start_time, provider) — idx_bio_user_time",
    "body_fat_entries (user_id, current_body_fat_pct, scan_method, source, recorded_at) — body_fat_user_idx",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    try {
      // ── 30-day weight history ──────────────────────────────────────────────
      const weightRows = await db.execute<{
        value: string;
        unit: string;
        start_time: string;
        provider: string;
      }>(sql`
        SELECT value, unit, start_time, provider
        FROM biometric_sample
        WHERE user_id = ${userId}
          AND type = 'weight'
          AND start_time >= NOW() - INTERVAL '30 days'
        ORDER BY start_time ASC
      `);

      const rows = weightRows.rows;
      const entryCount = rows.length;

      findings.push({
        metric: "weight_entry_count_30d",
        value: entryCount,
        quality: entryCount > 0 ? "measured" : "missing",
        window: "30d",
        source: "biometric_sample",
        observedAt: now,
      });

      if (entryCount === 0) {
        // No weight data — everything else is missing
        findings.push({
          metric: "weight_trend_direction",
          value: null,
          quality: "missing",
          window: "30d",
          source: "biometric_sample",
          observedAt: now,
        });
        findings.push({
          metric: "latest_weight_kg",
          value: null,
          quality: "missing",
          window: "today",
          source: "biometric_sample",
          observedAt: now,
        });
      } else {
        // Normalise to kg
        const weights = rows.map((r) => {
          const v = parseFloat(r.value);
          return r.unit === "lb" ? v * 0.453592 : v;
        });

        const latestWeight = weights[weights.length - 1];
        const latestRow = rows[rows.length - 1];

        // Determine data quality by provider mix
        const providers = rows.map((r) => r.provider);
        const hasDevice = providers.some((p) => DEVICE_PROVIDERS.has(p));
        const hasManual = providers.some((p) => !DEVICE_PROVIDERS.has(p));
        const dataQuality: Evidence["quality"] =
          hasDevice && hasManual ? "measured" : hasDevice ? "measured" : "reported";

        findings.push({
          metric: "latest_weight_kg",
          value: Math.round(latestWeight * 10) / 10,
          quality: DEVICE_PROVIDERS.has(latestRow.provider) ? "measured" : "reported",
          window: "today",
          source: "biometric_sample",
          observedAt: new Date(latestRow.start_time),
        });

        findings.push({
          metric: "weight_data_quality",
          value: hasDevice && hasManual ? "mixed" : hasDevice ? "measured" : "reported",
          quality: dataQuality,
          window: "30d",
          source: "biometric_sample",
          observedAt: now,
        });

        // Trend: only meaningful with ≥4 readings
        if (weights.length >= 4) {
          const firstHalf = weights.slice(0, Math.floor(weights.length / 2));
          const secondHalf = weights.slice(Math.floor(weights.length / 2));
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          const delta = secondAvg - firstAvg;

          // Simple linear velocity: delta over ~half the window (~15 days → kg/week)
          const halfWindowDays = 15;
          const velocityKgPerWeek = (delta / halfWindowDays) * 7;

          const direction =
            Math.abs(delta) < 0.3
              ? "stable"
              : delta > 0
              ? "rising"
              : "falling";

          findings.push({
            metric: "weight_trend_direction",
            value: direction,
            quality: dataQuality,
            window: "30d",
            source: "biometric_sample",
            observedAt: now,
          });

          findings.push({
            metric: "weight_velocity_kg_per_week",
            value: Math.round(velocityKgPerWeek * 100) / 100,
            quality: dataQuality,
            window: "30d",
            source: "biometric_sample",
            observedAt: now,
          });
        } else {
          findings.push({
            metric: "weight_trend_direction",
            value: "insufficient_data",
            quality: "inferred",
            window: "30d",
            source: "biometric_sample",
            observedAt: now,
          });
        }
      }

      // ── Body fat (most recent entry) ───────────────────────────────────────
      const bfRows = await db.execute<{
        current_body_fat_pct: string;
        scan_method: string;
        source: string;
        recorded_at: string;
      }>(sql`
        SELECT current_body_fat_pct, scan_method, source, recorded_at
        FROM body_fat_entries
        WHERE user_id = ${userId}
        ORDER BY recorded_at DESC
        LIMIT 1
      `);

      if (bfRows.rows.length > 0) {
        const bf = bfRows.rows[0];
        const daysSince = Math.floor(
          (now.getTime() - new Date(bf.recorded_at).getTime()) / 86400000
        );
        findings.push({
          metric: "body_fat_pct",
          value: parseFloat(bf.current_body_fat_pct),
          quality: bf.scan_method === "DEXA" || bf.scan_method === "BodPod"
            ? "measured"
            : "reported",
          window: daysSince <= 90 ? "90d" : "90d",
          source: `body_fat_entries (${bf.scan_method})`,
          observedAt: new Date(bf.recorded_at),
        });
        findings.push({
          metric: "body_fat_days_since_measurement",
          value: daysSince,
          quality: "measured",
          window: "90d",
          source: "body_fat_entries",
          observedAt: now,
        });
      } else {
        findings.push({
          metric: "body_fat_pct",
          value: null,
          quality: "missing",
          window: "90d",
          source: "body_fat_entries",
          observedAt: now,
        });
      }
    } catch (err: any) {
      console.error("[WeightObserver] Query failed:", err.message);
    }

    return {
      observerId: "weight",
      findings,
      ranAt: now,
      windowsCovered: ["today", "30d", "90d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
