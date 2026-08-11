/**
 * Lifestyle Observer — Phase 3B
 *
 * Data sources:
 *   user_behavior_monthly_summary — compressed monthly platform behavior (authoritative for history)
 *   macro_logs.alcohol             — alcohol frequency signal (reported)
 *   saved_meals                    — platform engagement proxy (reported)
 *   platform_activity_events       — feature usage signals (Phase 3B — new)
 *
 * OBSERVABILITY: PARTIALLY OBSERVABLE → Moving toward SUPPORTED
 *
 * Phase 3B changes:
 *   ✅ Beverage Creator usage now visible via platform_activity_events (beverage_generated)
 *   ✅ Dessert Creator usage now visible (dessert_generated)
 *   ✅ Fridge Rescue usage now visible (fridge_rescue_generated)
 *   ✅ Meal saves now visible as engagement events (meal_saved)
 *   ✅ Shopping List engagement now visible (shopping_item_added)
 *   ✅ Product Intelligence scans now visible (product_scan_completed)
 *
 * Still NOT observable (usage ≠ consumption rule):
 *   ❌ Whether generated beverages/desserts were actually consumed
 *   ❌ Specific beverage types or their exact macros
 *   ❌ Whether fridge rescue meals were eaten
 *   ❌ Whether shopping list items were purchased
 *   ❌ Builder session abandonment rate
 *
 * NOT allowed to infer:
 *   - Specific beverages consumed or their macros
 *   - That beverage_generated = beverage consumed
 *   - Total lifestyle quality score — only individual signals
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

export const lifestyleObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "lifestyle",
  name: "Lifestyle & Platform Engagement Observer",
  description:
    "Reads user_behavior_monthly_summary (platform consistency, log patterns), " +
    "macro_logs.alcohol (alcohol frequency), and saved_meals (engagement proxy). " +
    "PARTIALLY OBSERVABLE: beverages, desserts, fridge rescue, shopping lists " +
    "are NOT YET OBSERVABLE — no dedicated activity event tables exist.",
  supportedWindows: ["7d", "30d", "90d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "rapid_weight_gain",
    "weight_loss_plateau",
    "fatigue_low_energy",
    "cravings",
    "restaurant_eating",
    "general_inquiry",
  ],
  sourcesQueried: [
    "user_behavior_monthly_summary (user_id, month, meal_consistency_score, adherence_percentage, top_diet_patterns, avg_calories) — ubms_user_month_uniq",
    "macro_logs (user_id, at, alcohol) — alcohol > 0 days in 30d",
    "saved_meals (user_id, created_at, source_type) — meals saved in 30d",
    "platform_activity_events (owner_user_id, event_type, event_class, occurred_at) — feature usage counts in 7d/30d",
    "⚠ beverage consumption not confirmable — beverage_generated (usage) ≠ beverage drunk",
    "⚠ dessert consumption not confirmable — dessert_generated (usage) ≠ dessert eaten",
    "⚠ fridge rescue consumption not confirmable — fridge_rescue_generated (usage) ≠ meal eaten",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    // Phase 3B: query platform_activity_events for feature usage signals
    // These replace the Phase 3 "not_yet_observable" stubs.
    // IMPORTANT: event_class='usage' = feature was used; does NOT mean consumption occurred.
    try {
      const activityRows = await db.execute<{
        event_type: string;
        event_class: string;
        count_7d: string;
        count_30d: string;
        latest_at: string | null;
      }>(sql`
        SELECT
          event_type,
          event_class,
          COUNT(CASE WHEN occurred_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text  AS count_7d,
          COUNT(CASE WHEN occurred_at >= NOW() - INTERVAL '30 days' THEN 1 END)::text AS count_30d,
          MAX(occurred_at)::text AS latest_at
        FROM platform_activity_events
        WHERE owner_user_id = ${userId}
          AND subject_type = 'user'
          AND occurred_at >= NOW() - INTERVAL '30 days'
          AND event_type IN (
            'beverage_generated', 'beverage_added_to_macros',
            'dessert_generated', 'dessert_added_to_macros',
            'fridge_rescue_generated', 'fridge_rescue_meal_saved',
            'meal_generated', 'meal_saved', 'meal_added_to_macros',
            'shopping_item_added',
            'product_scan_completed'
          )
        GROUP BY event_type, event_class
        ORDER BY event_type
      `);

      // Index by event_type for easy lookup
      const eventIndex = new Map<string, { count7d: number; count30d: number }>();
      for (const row of activityRows.rows) {
        eventIndex.set(row.event_type, {
          count7d: parseInt(row.count_7d),
          count30d: parseInt(row.count_30d),
        });
      }

      // ── Beverage Creator (usage only — consumption not yet confirmable) ────
      const bevCount7d = eventIndex.get("beverage_generated")?.count7d ?? 0;
      const bevCount30d = eventIndex.get("beverage_generated")?.count30d ?? 0;
      findings.push({
        metric: "beverage_generated_7d",
        value: bevCount7d,
        quality: bevCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (usage)",
        observedAt: now,
      });
      findings.push({
        metric: "beverage_generated_30d",
        value: bevCount30d,
        quality: bevCount30d > 0 ? "reported" : "missing",
        window: "30d",
        source: "platform_activity_events (usage)",
        observedAt: now,
      });

      // ── Dessert Creator (usage only) ──────────────────────────────────────
      const dessertCount7d = eventIndex.get("dessert_generated")?.count7d ?? 0;
      findings.push({
        metric: "dessert_generated_7d",
        value: dessertCount7d,
        quality: dessertCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (usage)",
        observedAt: now,
      });

      // ── Fridge Rescue (usage only) ────────────────────────────────────────
      const fridgeCount7d = eventIndex.get("fridge_rescue_generated")?.count7d ?? 0;
      findings.push({
        metric: "fridge_rescue_used_7d",
        value: fridgeCount7d,
        quality: fridgeCount7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (usage)",
        observedAt: now,
      });

      // ── Meal saves (engagement) ───────────────────────────────────────────
      const mealSaved7d = eventIndex.get("meal_saved")?.count7d ?? 0;
      findings.push({
        metric: "meal_saves_7d",
        value: mealSaved7d,
        quality: mealSaved7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (engagement)",
        observedAt: now,
      });

      // ── Shopping List (engagement) ────────────────────────────────────────
      const shoppingItems7d = eventIndex.get("shopping_item_added")?.count7d ?? 0;
      findings.push({
        metric: "shopping_items_added_7d",
        value: shoppingItems7d,
        quality: shoppingItems7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (engagement)",
        observedAt: now,
      });

      // ── Product scans (engagement) ────────────────────────────────────────
      const productScans7d = eventIndex.get("product_scan_completed")?.count7d ?? 0;
      findings.push({
        metric: "product_scans_7d",
        value: productScans7d,
        quality: productScans7d > 0 ? "reported" : "missing",
        window: "7d",
        source: "platform_activity_events (engagement)",
        observedAt: now,
      });

      // ── Platform feature richness summary ─────────────────────────────────
      // How many distinct feature types did the user engage with in 7d?
      const featureTypesUsed = [bevCount7d, dessertCount7d, fridgeCount7d, mealSaved7d, shoppingItems7d, productScans7d]
        .filter(c => c > 0).length;
      findings.push({
        metric: "platform_feature_richness_7d",
        value: featureTypesUsed,
        quality: "inferred",
        window: "7d",
        source: "platform_activity_events",
        observedAt: now,
      });

    } catch (actErr: any) {
      // Non-fatal — platform_activity_events may not exist in older envs
      console.warn("[LifestyleObserver] Activity events query skipped:", actErr.message);
      // Fall back to not-yet-observable markers so the engine knows what's missing
      for (const metric of ["beverage_generated_7d", "dessert_generated_7d", "fridge_rescue_used_7d", "shopping_items_added_7d"]) {
        findings.push({ metric, value: null, quality: "missing", window: "7d", source: "observer_audit", observedAt: now });
      }
    }

    try {
      // ── Monthly behavior summary (current month + last month) ───────────────
      const ubmsRows = await db.execute<{
        month: string;
        meal_consistency_score: string | null;
        adherence_percentage: string | null;
        top_diet_patterns: unknown;
        avg_calories: string | null;
      }>(sql`
        SELECT
          month::text,
          meal_consistency_score::text,
          adherence_percentage::text,
          top_diet_patterns,
          avg_calories::text
        FROM user_behavior_monthly_summary
        WHERE user_id = ${userId}
        ORDER BY month DESC
        LIMIT 2
      `);

      if (ubmsRows.rows.length > 0) {
        const current = ubmsRows.rows[0];
        if (current.meal_consistency_score !== null) {
          findings.push({
            metric: "platform_consistency_score",
            value: parseFloat(current.meal_consistency_score!),
            quality: "reported",
            window: "30d",
            source: "user_behavior_monthly_summary",
            observedAt: now,
          });
        }
        if (current.adherence_percentage !== null) {
          findings.push({
            metric: "adherence_percentage",
            value: parseFloat(current.adherence_percentage!),
            quality: "reported",
            window: "30d",
            source: "user_behavior_monthly_summary",
            observedAt: now,
          });
        }
        if (current.top_diet_patterns) {
          // Surface the dominant log source
          const patterns =
            typeof current.top_diet_patterns === "string"
              ? JSON.parse(current.top_diet_patterns)
              : (current.top_diet_patterns as Record<string, number>);
          const dominant = Object.entries(patterns as Record<string, number>)
            .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
          if (dominant) {
            findings.push({
              metric: "dominant_log_source",
              value: dominant,
              quality: "reported",
              window: "30d",
              source: "user_behavior_monthly_summary",
              observedAt: now,
            });
          }
        }

        const hasUbms = true;
        findings.push({
          metric: "monthly_summary_available",
          value: hasUbms,
          quality: "reported",
          window: "30d",
          source: "user_behavior_monthly_summary",
          observedAt: now,
        });
      } else {
        findings.push({
          metric: "monthly_summary_available",
          value: false,
          quality: "missing",
          window: "30d",
          source: "user_behavior_monthly_summary",
          observedAt: now,
        });
      }

      // ── Alcohol frequency (30d from macro_logs) ────────────────────────────
      const alcoholRows = await db.execute<{
        alcohol_days: string;
        total_alcohol_g: string;
      }>(sql`
        SELECT
          COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC'))::text AS alcohol_days,
          COALESCE(SUM(alcohol), 0)::text                  AS total_alcohol_g
        FROM macro_logs
        WHERE user_id = ${userId}
          AND at >= NOW() - INTERVAL '30 days'
          AND alcohol > 0
      `);

      const alc = alcoholRows.rows[0];
      const alcoholDays = parseInt(alc?.alcohol_days ?? "0");
      findings.push({
        metric: "alcohol_days_30d",
        value: alcoholDays,
        quality: alcoholDays > 0 ? "reported" : "missing",
        window: "30d",
        source: "macro_logs (alcohol column)",
        observedAt: now,
      });

      // Note: alcohol from macro_logs is approximated — user enters macros,
      // not specific drink types. We can't distinguish beer/wine/spirits.
      if (alcoholDays > 0) {
        findings.push({
          metric: "alcohol_tracking_scope",
          value: "macro_log_g_only_no_drink_type_detail",
          quality: "inferred",
          window: "30d",
          source: "observer_audit",
          observedAt: now,
        });
      }

      // ── Saved meals (platform engagement proxy, 30d) ────────────────────────
      const savedMealRows = await db.execute<{
        saved_count: string;
        source_types: string | null;
      }>(sql`
        SELECT
          COUNT(*)::text AS saved_count,
          STRING_AGG(DISTINCT source_type, ',') AS source_types
        FROM saved_meals
        WHERE user_id = ${userId}
          AND created_at >= NOW() - INTERVAL '30 days'
      `);

      const sm = savedMealRows.rows[0];
      const savedCount = parseInt(sm?.saved_count ?? "0");
      findings.push({
        metric: "saved_meals_30d",
        value: savedCount,
        quality: savedCount > 0 ? "reported" : "missing",
        window: "30d",
        source: "saved_meals",
        observedAt: now,
      });

      const engagementLevel =
        savedCount >= 10 ? "high" : savedCount >= 3 ? "medium" : savedCount > 0 ? "low" : "none";
      findings.push({
        metric: "platform_engagement_level",
        value: engagementLevel,
        quality: "inferred",
        window: "30d",
        source: "saved_meals",
        observedAt: now,
      });
    } catch (err: any) {
      console.error("[LifestyleObserver] Query failed:", err.message);
    }

    return {
      observerId: "lifestyle",
      findings,
      ranAt: now,
      windowsCovered: ["7d", "30d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
