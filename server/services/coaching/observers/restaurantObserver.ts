/**
 * Restaurant Observer — Phase 3B
 *
 * Data sources:
 *   restaurant_guide_sessions   — guide generation events (pre-Phase 3B)
 *   platform_activity_events    — restaurant_recommendations_generated (usage)
 *                                 restaurant_meal_added_to_macros (consumption, when available)
 *
 * OBSERVABILITY: PARTIALLY OBSERVABLE → Moving toward SUPPORTED
 *
 * Phase 3B changes:
 *   ✅ restaurant_recommendations_generated events now recorded in platform_activity_events
 *   ✅ restaurant_meal_added_to_macros (consumption) will be recorded when user
 *      uses "Add to Macros" from a Restaurant Guide recommendation (Phase 4 UI)
 *   ✅ restaurant_guide_sessions still queried for pre-Phase-3B history
 *   ❌ Macros consumed at the restaurant (still not recoverable from logs)
 *   ❌ Whether the user actually went (usage ≠ consumption)
 *
 * GOVERNING RULE: usage ≠ consumption.
 *   restaurant_recommendations_generated = user LOOKED at a restaurant guide
 *   restaurant_meal_added_to_macros      = user CONFIRMED they ate that meal
 *
 * The Observer distinguishes these two event classes and reports separately.
 * The LLM renderer MUST NOT conflate guide usage with confirmed eating.
 *
 * NOT allowed to infer:
 *   - That guide_usage events prove the user ate at the restaurant
 *   - Macro impact of restaurant eating without restaurant_meal_added_to_macros events
 *   - That a time-coincidence between guide usage and a macro log entry proves the meal was eaten there
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

export const restaurantObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "restaurant",
  name: "Restaurant Behavior Observer",
  description:
    "Reads restaurant_guide_sessions to infer dining-out intent and frequency. " +
    "PARTIALLY OBSERVABLE: guide usage ≠ confirmed meals consumed. " +
    "No restaurant column exists in macro_logs or saved_meals.",
  supportedWindows: ["7d", "30d", "90d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "restaurant_eating",
    "weight_loss_plateau",
    "rapid_weight_gain",
    "general_inquiry",
  ],
  sourcesQueried: [
    "restaurant_guide_sessions (user_id, restaurant_name, cuisine, craving, generated_at) — pre-Phase-3B guide history",
    "platform_activity_events (owner_user_id, event_type='restaurant_recommendations_generated', occurred_at) — usage events",
    "platform_activity_events (owner_user_id, event_type='restaurant_meal_added_to_macros', occurred_at) — consumption events (Phase 4)",
    "⚠ macro_logs — NO restaurant column (restaurant eating still NOT directly observable in logs)",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    // Always record the observability boundary — critical for LLM renderer
    findings.push({
      metric: "restaurant_observability",
      value: "guide_usage_tracked_confirmed_consumption_available_phase4",
      quality: "inferred",
      window: "30d",
      source: "observer_audit",
      observedAt: now,
    });

    try {
      // ── Guide session count (30d) ──────────────────────────────────────────
      const sessionRows = await db.execute<{
        session_count: string;
        latest_session: string | null;
        top_cuisine: string | null;
        top_restaurant: string | null;
      }>(sql`
        SELECT
          COUNT(*)::text                     AS session_count,
          MAX(generated_at)::text            AS latest_session,
          MODE() WITHIN GROUP (ORDER BY cuisine) AS top_cuisine,
          MODE() WITHIN GROUP (ORDER BY restaurant_name) AS top_restaurant
        FROM restaurant_guide_sessions
        WHERE user_id = ${userId}
          AND generated_at >= NOW() - INTERVAL '30 days'
      `);

      const r = sessionRows.rows[0];
      const sessionCount = parseInt(r?.session_count ?? "0");

      findings.push({
        metric: "guide_sessions_30d",
        value: sessionCount,
        quality: sessionCount > 0 ? "reported" : "missing",
        window: "30d",
        source: "restaurant_guide_sessions",
        observedAt: now,
      });

      if (sessionCount > 0 && r?.latest_session) {
        const latestDate = new Date(r.latest_session);
        const daysAgo = Math.floor(
          (now.getTime() - latestDate.getTime()) / 86400000
        );
        findings.push({
          metric: "latest_guide_session_days_ago",
          value: daysAgo,
          quality: "reported",
          window: "30d",
          source: "restaurant_guide_sessions",
          observedAt: now,
        });

        if (r?.top_cuisine) {
          findings.push({
            metric: "most_requested_cuisine_30d",
            value: r.top_cuisine,
            quality: "reported",
            window: "30d",
            source: "restaurant_guide_sessions",
            observedAt: now,
          });
        }

        if (r?.top_restaurant) {
          findings.push({
            metric: "most_used_restaurant_30d",
            value: r.top_restaurant,
            quality: "reported",
            window: "30d",
            source: "restaurant_guide_sessions",
            observedAt: now,
          });
        }
      }

      // ── 90-day context ─────────────────────────────────────────────────────
      const rows90 = await db.execute<{ session_count: string }>(sql`
        SELECT COUNT(*)::text AS session_count
        FROM restaurant_guide_sessions
        WHERE user_id = ${userId}
          AND generated_at >= NOW() - INTERVAL '90 days'
      `);

      findings.push({
        metric: "guide_sessions_90d",
        value: parseInt(rows90.rows[0]?.session_count ?? "0"),
        quality: "reported",
        window: "90d",
        source: "restaurant_guide_sessions",
        observedAt: now,
      });

      // ── Phase 3B: Platform activity events ────────────────────────────────
      // Query restaurant events from the new event stream.
      // Two distinct event types with different evidential weight:
      //   restaurant_recommendations_generated → user USED the guide (usage)
      //   restaurant_meal_added_to_macros      → user CONFIRMED they ate it (consumption)
      try {
        const activityRows = await db.execute<{
          event_type: string;
          event_class: string;
          count: string;
          latest_at: string | null;
        }>(sql`
          SELECT
            event_type,
            event_class,
            COUNT(*)::text AS count,
            MAX(occurred_at)::text AS latest_at
          FROM platform_activity_events
          WHERE owner_user_id = ${userId}
            AND subject_type = 'user'
            AND event_type IN ('restaurant_recommendations_generated', 'restaurant_meal_added_to_macros')
            AND occurred_at >= NOW() - INTERVAL '30 days'
          GROUP BY event_type, event_class
        `);

        let guideUsageCount = 0;
        let confirmedConsumptionCount = 0;

        for (const row of activityRows.rows) {
          if (row.event_type === "restaurant_recommendations_generated") {
            guideUsageCount = parseInt(row.count);
          } else if (row.event_type === "restaurant_meal_added_to_macros") {
            confirmedConsumptionCount = parseInt(row.count);
          }
        }

        findings.push({
          metric: "restaurant_guide_usage_events_30d",
          value: guideUsageCount,
          quality: guideUsageCount > 0 ? "reported" : "missing",
          window: "30d",
          source: "platform_activity_events (usage)",
          observedAt: now,
        });

        findings.push({
          metric: "restaurant_confirmed_consumption_30d",
          value: confirmedConsumptionCount,
          quality: confirmedConsumptionCount > 0 ? "reported" : "missing",
          window: "30d",
          source: "platform_activity_events (consumption)",
          observedAt: now,
        });

        // Contextual insight: high usage + low consumption = explored but didn't confirm
        if (guideUsageCount > 2 && confirmedConsumptionCount === 0) {
          findings.push({
            metric: "restaurant_usage_vs_consumption_gap",
            value: "high_guide_usage_no_confirmed_meals",
            quality: "inferred",
            window: "30d",
            source: "platform_activity_events",
            observedAt: now,
          });
        }
      } catch (actErr: any) {
        // Non-fatal — platform_activity_events may not exist in older envs
        console.warn("[RestaurantObserver] Activity events query skipped:", actErr.message);
      }
    } catch (err: any) {
      console.error("[RestaurantObserver] Query failed:", err.message);
    }

    return {
      observerId: "restaurant",
      findings,
      ranAt: now,
      windowsCovered: ["30d", "90d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
