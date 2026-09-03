/**
 * Behavior Observer — Phase 3
 *
 * Data sources (authoritative):
 *   coaching_profiles — behavioral self-assessment columns (one row per user)
 *   ace_daily_checkins — daily subjective state (cravings, emotional_eating_risk)
 *
 * Provenance: ALL REPORTED — users enter behavioral profile during onboarding/quiz.
 * ACE check-ins are also self-reported daily.
 *
 * This observer surfaces HOW the user relates to food and coaching, not WHAT they eat.
 * It informs the Style Resolver and the coaching response tone, not macro targets.
 *
 * NOT allowed to infer:
 *   - Clinical diagnosis from behavioral patterns (e.g., disordered eating)
 *   - Cause-effect between behavioral style and weight outcomes
 *   - Whether stated preferences match actual behavior
 *   - Accuracy of self-assessment (halo effect, social desirability bias)
 */

import { db } from "../../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverConfig,
  ObserverOutput,
  CoachSubject,
  Evidence,
} from "../../../../shared/coaching/types";

export const behaviorObserver: ObserverConfig & {
  run(subject: CoachSubject): Promise<ObserverOutput>;
} = {
  id: "behavior",
  name: "Behavioral Profile Observer",
  description:
    "Reads coaching_profiles (behavioral self-assessment: coaching style, setback response, " +
    "eating driver, craving response, trust style, etc.) and recent ACE check-in craving/emotional data. " +
    "All evidence is reported (self-assessed).",
  supportedWindows: ["today", "7d", "30d"],
  supportedSpecializations: ["corner", "pregnancy"],
  relevantIntents: [
    "cravings",
    "weight_loss_plateau",
    "fatigue_low_energy",
    "restaurant_eating",
    "general_inquiry",
  ],
  sourcesQueried: [
    "coaching_profiles (user_id, coaching_style, setback_response, eating_driver, craving_response, trust_style, decision_style, overwhelm_response, activity_level, active_days_per_week, off_track_causes[], motivations[]) — unique(user_id)",
    "ace_daily_checkins (user_id, date, cravings, emotional_eating_risk) — unique(user_id,date)",
  ],

  async run(subject: CoachSubject): Promise<ObserverOutput> {
    const findings: Evidence[] = [];
    const userId = subject.subjectId;
    const now = new Date();

    try {
      // ── Coaching profile ───────────────────────────────────────────────────
      const profileRows = await db.execute<{
        coaching_style: string | null;
        setback_response: string | null;
        eating_driver: string | null;
        craving_response: string | null;
        trust_style: string | null;
        decision_style: string | null;
        overwhelm_response: string | null;
        activity_level: string | null;
        active_days_per_week: number | null;
        off_track_causes: string[] | null;
        motivations: string[] | null;
        coach_profile_completed_at: string | null;
        progress_mindset: string | null;
        stress_response: string | null;
        recovery_preference: string | null;
      }>(sql`
        SELECT
          coaching_style,
          setback_response,
          eating_driver,
          craving_response,
          trust_style,
          decision_style,
          overwhelm_response,
          activity_level,
          active_days_per_week,
          off_track_causes,
          motivations,
          coach_profile_completed_at,
          progress_mindset,
          stress_response,
          recovery_preference
        FROM coaching_profiles
        WHERE user_id = ${userId}
        LIMIT 1
      `);

      const profile = profileRows.rows[0];
      const hasProfile = !!profile && !!profile.coach_profile_completed_at;

      findings.push({
        metric: "has_coaching_profile",
        value: hasProfile,
        quality: "reported",
        window: "today",
        source: "coaching_profiles",
        observedAt: now,
      });

      if (!hasProfile) {
        findings.push({
          metric: "behavior_profile_completeness",
          value: profile ? "incomplete" : "missing",
          quality: "missing",
          window: "today",
          source: "coaching_profiles",
          observedAt: now,
        });
      } else {
        // Surface each behavioral dimension that is populated
        const dims: Array<[string, string | null]> = [
          ["coaching_style", profile.coaching_style],
          ["setback_response", profile.setback_response],
          ["eating_driver", profile.eating_driver],
          ["craving_response", profile.craving_response],
          ["trust_style", profile.trust_style],
          ["decision_style", profile.decision_style],
          ["overwhelm_response", profile.overwhelm_response],
          ["activity_level", profile.activity_level],
          ["progress_mindset", profile.progress_mindset],
          ["stress_response", profile.stress_response],
          ["recovery_preference", profile.recovery_preference],
        ];

        let populated = 0;
        for (const [metric, value] of dims) {
          if (value) {
            populated++;
            findings.push({
              metric,
              value,
              quality: "reported",
              window: "today",
              source: "coaching_profiles",
              observedAt: now,
            });
          }
        }

        if (profile.active_days_per_week !== null && profile.active_days_per_week !== undefined) {
          populated++;
          findings.push({
            metric: "active_days_per_week",
            value: profile.active_days_per_week,
            quality: "reported",
            window: "today",
            source: "coaching_profiles",
            observedAt: now,
          });
        }

        const completeness =
          populated >= 8 ? "full" : populated >= 4 ? "partial" : "minimal";
        findings.push({
          metric: "behavior_profile_completeness",
          value: completeness,
          quality: "reported",
          window: "today",
          source: "coaching_profiles",
          observedAt: now,
        });

        // Motivation and challenge arrays (surfaced as presence, not detail)
        if (profile.motivations && profile.motivations.length > 0) {
          findings.push({
            metric: "has_stated_motivations",
            value: true,
            quality: "reported",
            window: "today",
            source: "coaching_profiles",
            observedAt: now,
          });
        }

        if (profile.off_track_causes && profile.off_track_causes.length > 0) {
          findings.push({
            metric: "has_stated_off_track_causes",
            value: true,
            quality: "reported",
            window: "today",
            source: "coaching_profiles",
            observedAt: now,
          });
        }
      }

      // ── ACE Check-in: craving and emotional eating signals (7d) ───────────
      const checkinRows = await db.execute<{
        checkin_days: string;
        avg_cravings: string | null;
        avg_emotional_eating_risk: string | null;
      }>(sql`
        SELECT
          COUNT(*)::text AS checkin_days,
          AVG(CASE WHEN cravings IS NOT NULL THEN cravings::numeric END)::text AS avg_cravings,
          AVG(CASE WHEN emotional_eating_risk IS NOT NULL THEN emotional_eating_risk::numeric END)::text AS avg_emotional_eating_risk
        FROM ace_daily_checkins
        WHERE user_id = ${userId}
          AND date >= CURRENT_DATE - INTERVAL '7 days'
      `);

      const cr = checkinRows.rows[0];
      const checkinDays = parseInt(cr?.checkin_days ?? "0");

      if (checkinDays > 0) {
        if (cr?.avg_cravings !== null && cr?.avg_cravings !== undefined) {
          findings.push({
            metric: "avg_craving_intensity_7d",
            value: Math.round(parseFloat(cr.avg_cravings!) * 10) / 10,
            quality: "reported",
            window: "7d",
            source: "ace_daily_checkins",
            observedAt: now,
          });
        }
        if (cr?.avg_emotional_eating_risk !== null && cr?.avg_emotional_eating_risk !== undefined) {
          findings.push({
            metric: "avg_emotional_eating_risk_7d",
            value: Math.round(parseFloat(cr.avg_emotional_eating_risk!) * 10) / 10,
            quality: "reported",
            window: "7d",
            source: "ace_daily_checkins",
            observedAt: now,
          });
        }
      }
    } catch (err: any) {
      console.error("[BehaviorObserver] Query failed:", err.message);
    }

    return {
      observerId: "behavior",
      findings,
      ranAt: now,
      windowsCovered: ["today", "7d"],
      sourcesQueried: this.sourcesQueried ?? [],
    };
  },
};
