/**
 * Macro Observer — Phase 3
 *
 * Data sources (authoritative):
 *   macro_logs  — user_id + at columns (no dedicated index confirmed; full table scan on user_id)
 *
 * Provenance: ALL reported (user-entered or platform-generated macros the user accepted).
 * No device sync. source column ('quick'|'food'|'recipe') distinguishes entry method
 * but all are user-initiated.
 *
 * No nutrition targets table exists — macro targets come from the Nutrition Resolver
 * at request time, not stored per-row in a targets table. Adherence is NOT computed
 * here — the engine will fetch targets separately when available.
 *
 * NOT allowed to infer:
 *   - Why macros are high/low (illness, stress, social event)
 *   - Whether the user cheated or skipped intentionally
 *   - Caloric deficit/surplus without confirmed expenditure data
 *   - Whether macros are "good" — only whether they were logged
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

export const macroObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "macro",
  name: "Macro & Calorie Observer",
  description:
    "Reads macro_logs to compute average daily intake (kcal, protein, carbs, fat, fiber, alcohol) " +
    "over 7d and 30d windows. Tracks logging frequency as a compliance signal.",
  supportedWindows: ["today", "7d", "30d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "weight_gain",
    "weight_loss_plateau",
    "rapid_weight_gain",
    "fatigue_low_energy",
    "cravings",
    "restaurant_eating",
    "general_inquiry",
  ],
  sourcesQueried: [
    "macro_logs (user_id, at, kcal, protein, carbs, fat, fiber, alcohol, source) — no composite index; queries filtered by user_id + date range",
    "daily_nutrition_prescriptions (user_id, date, target_calories, target_protein, target_total_carbs, target_fat) — adherence computation",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    try {
      // ── 7-day aggregate ────────────────────────────────────────────────────
      const rows7d = await db.execute<{
        log_days: string;
        total_kcal: string;
        total_protein: string;
        total_carbs: string;
        total_fat: string;
        total_fiber: string;
        total_alcohol: string;
        alcohol_days: string;
      }>(sql`
        SELECT
          COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC'))::text AS log_days,
          COALESCE(SUM(kcal), 0)::text                     AS total_kcal,
          COALESCE(SUM(protein), 0)::text                  AS total_protein,
          COALESCE(SUM(carbs), 0)::text                    AS total_carbs,
          COALESCE(SUM(fat), 0)::text                      AS total_fat,
          COALESCE(SUM(fiber), 0)::text                    AS total_fiber,
          COALESCE(SUM(alcohol), 0)::text                  AS total_alcohol,
          COUNT(DISTINCT CASE WHEN alcohol > 0 THEN DATE(at AT TIME ZONE 'UTC') END)::text AS alcohol_days
        FROM macro_logs
        WHERE user_id = ${userId}
          AND at >= NOW() - INTERVAL '7 days'
      `);

      const r7 = rows7d.rows[0];
      const logDays7 = parseInt(r7?.log_days ?? "0");

      findings.push({
        metric: "log_days_7d",
        value: logDays7,
        quality: "reported",
        window: "7d",
        source: "macro_logs",
        observedAt: now,
      });

      if (logDays7 === 0) {
        // No data — push missing markers
        for (const metric of ["avg_kcal_7d", "avg_protein_g_7d", "avg_carbs_g_7d", "avg_fat_g_7d"]) {
          findings.push({ metric, value: null, quality: "missing", window: "7d", source: "macro_logs", observedAt: now });
        }
      } else {
        const avg = (total: string) => Math.round(parseFloat(total) / logDays7);
        findings.push({ metric: "avg_kcal_7d",     value: avg(r7.total_kcal),    quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
        findings.push({ metric: "avg_protein_g_7d", value: avg(r7.total_protein), quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
        findings.push({ metric: "avg_carbs_g_7d",   value: avg(r7.total_carbs),   quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
        findings.push({ metric: "avg_fat_g_7d",     value: avg(r7.total_fat),     quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
        findings.push({ metric: "avg_fiber_g_7d",   value: avg(r7.total_fiber),   quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
        findings.push({ metric: "alcohol_days_7d",  value: parseInt(r7.alcohol_days ?? "0"), quality: "reported", window: "7d", source: "macro_logs", observedAt: now });
      }

      // Logging frequency signal
      const logFreqLabel =
        logDays7 >= 6 ? "consistent" : logDays7 >= 3 ? "sparse" : "missing";
      findings.push({
        metric: "log_frequency_7d",
        value: logFreqLabel,
        quality: logDays7 > 0 ? "reported" : "missing",
        window: "7d",
        source: "macro_logs",
        observedAt: now,
      });

      // ── 30-day log day count (for trend context) ───────────────────────────
      const rows30d = await db.execute<{ log_days: string }>(sql`
        SELECT COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC'))::text AS log_days
        FROM macro_logs
        WHERE user_id = ${userId}
          AND at >= NOW() - INTERVAL '30 days'
      `);

      const logDays30 = parseInt(rows30d.rows[0]?.log_days ?? "0");
      findings.push({
        metric: "log_days_30d",
        value: logDays30,
        quality: logDays30 > 0 ? "reported" : "missing",
        window: "30d",
        source: "macro_logs",
        observedAt: now,
      });

      // ── Phase 3B: Prescription adherence from daily_nutrition_prescriptions ─
      // Compare what the user actually logged against what the Resolver prescribed.
      // Only computable when both intake data AND persisted prescriptions are available.
      try {
        const prescRows = await db.execute<{
          days_with_prescription: string;
          avg_target_calories: string | null;
          avg_target_protein: string | null;
          avg_target_carbs: string | null;
          avg_target_fat: string | null;
          source: string | null;
        }>(sql`
          SELECT
            COUNT(*)::text AS days_with_prescription,
            AVG(target_calories)::text AS avg_target_calories,
            AVG(target_protein)::text AS avg_target_protein,
            AVG(target_total_carbs)::text AS avg_target_carbs,
            AVG(target_fat)::text AS avg_target_fat,
            MODE() WITHIN GROUP (ORDER BY source) AS source
          FROM daily_nutrition_prescriptions
          WHERE user_id = ${userId}
            AND date >= CURRENT_DATE - INTERVAL '7 days'
        `);

        const presc = prescRows.rows[0];
        const prescDays = parseInt(presc?.days_with_prescription ?? "0");

        findings.push({
          metric: "prescription_days_7d",
          value: prescDays,
          quality: prescDays > 0 ? "reported" : "missing",
          window: "7d",
          source: "daily_nutrition_prescriptions",
          observedAt: now,
        });

        // Compute adherence when both intake and targets are available on the same days
        if (prescDays > 0 && logDays7 > 0 && presc.avg_target_calories) {
          // Get actual per-day averages from macro_logs (already computed above as r7)
          // Re-use r7 values
          const targetKcal = parseFloat(presc.avg_target_calories);
          const avgActualKcal = logDays7 > 0 ? Math.round(parseFloat(r7.total_kcal) / logDays7) : 0;
          const calorieAdherencePct = targetKcal > 0
            ? Math.round((avgActualKcal / targetKcal) * 100)
            : null;

          if (calorieAdherencePct !== null) {
            findings.push({
              metric: "calorie_adherence_pct_7d",
              value: calorieAdherencePct,
              quality: "inferred",
              window: "7d",
              source: "daily_nutrition_prescriptions + macro_logs",
              observedAt: now,
              trend: calorieAdherencePct > 110 ? "up" : calorieAdherencePct < 90 ? "down" : "stable",
            });
          }

          if (presc.avg_target_protein) {
            const targetProtein = parseFloat(presc.avg_target_protein);
            const avgActualProtein = logDays7 > 0 ? Math.round(parseFloat(r7.total_protein) / logDays7) : 0;
            const proteinAdherencePct = targetProtein > 0
              ? Math.round((avgActualProtein / targetProtein) * 100)
              : null;
            if (proteinAdherencePct !== null) {
              findings.push({
                metric: "protein_adherence_pct_7d",
                value: proteinAdherencePct,
                quality: "inferred",
                window: "7d",
                source: "daily_nutrition_prescriptions + macro_logs",
                observedAt: now,
              });
            }
          }

          findings.push({
            metric: "prescription_source_7d",
            value: presc.source ?? "macro_calculator",
            quality: "reported",
            window: "7d",
            source: "daily_nutrition_prescriptions",
            observedAt: now,
          });
        } else if (prescDays === 0) {
          findings.push({
            metric: "calorie_adherence_pct_7d",
            value: null,
            quality: "missing",
            window: "7d",
            source: "daily_nutrition_prescriptions",
            observedAt: now,
          });
        }
      } catch (prescErr: any) {
        // Non-fatal — table may not exist in older envs yet
        console.warn("[MacroObserver] Prescription adherence query skipped:", prescErr.message);
      }
    } catch (err: any) {
      console.error("[MacroObserver] Query failed:", err.message);
    }

    return {
      observerId: "macro",
      findings,
      ranAt: now,
      windowsCovered: ["7d", "30d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
