/**
 * Coach Knowledge Library — Initial Adult Seed (Coach's Corner)
 *
 * Five initial patterns for Coach's Corner. Each pattern distinguishes:
 *   - triggerIntents: when to investigate (not a clinical claim)
 *   - requiredEvidence: investigation signals (not thresholds as facts)
 *   - interpretationBoundaries: what IS and IS NOT allowed to be concluded
 *   - actionTemplates: safe coaching steps
 *   - learningTemplates: what data would improve future coaching
 *
 * Rule: numeric values in evidence predicates are INVESTIGATION SIGNALS.
 * They tell the engine when to look closer — not what to assert as clinical truth.
 *
 * Idempotent: ON CONFLICT (specialization, key, version) → DO NOTHING.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

export async function seedCoachKnowledgePatterns(): Promise<void> {
  // Defensive: ensure knowledge_patterns table exists before inserting.
  // The coaching engine migration creates this table, but under cold-start
  // connection pressure the seed may fire before that migration completes.
  // Running CREATE TABLE IF NOT EXISTS here is idempotent and costs nothing
  // when the table already exists.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      specialization TEXT NOT NULL,
      key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT false,
      rule_json JSONB NOT NULL,
      template_json JSONB NOT NULL,
      safety_class TEXT NOT NULL DEFAULT 'routine',
      approved_at TIMESTAMPTZ,
      approved_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS knowledge_patterns_spec_key_version_idx
      ON knowledge_patterns (specialization, key, version)
  `);

  const patterns = [
    // ─── 1. Rapid Weight Gain ────────────────────────────────────────────────
    {
      specialization: "corner",
      key: "rapid_weight_gain",
      version: 1,
      isActive: true,
      safetyClass: "routine",
      ruleJson: {
        triggerIntents: [
          "weight_gain", "gained_weight", "weight_went_up",
          "scale_up", "gained_pounds", "scale_higher",
        ],
        requiredEvidence: [
          {
            observer: "weight",
            metric: "recent_trend",
            window: "7d",
            predicate: "trending_up",
            investigationSignalNote:
              "Upward weight trend over 7 days — signals that exploration is warranted, not a conclusion about cause",
          },
        ],
        contraindications: [
          { observer: "lifestyle", metric: "pregnancy_active", predicate: "present" },
          { observer: "weight", metric: "medical_gain_directive", predicate: "present" },
        ],
        confidenceRule: {
          highRequires: ["weight.recent_trend", "macro.sodium_logged"],
          moderateRequires: ["weight.recent_trend"],
        },
        safetyClass: "routine",
        interpretationBoundaries: {
          allowedFramings: [
            "Your recent weight readings show an upward trend worth exploring together",
            "There are several things that can cause the scale to move up in a short window",
            "This might be worth looking at from a few different angles",
          ],
          forbiddenFramings: [
            "You gained fat",
            "You overate X calories and that is why the scale moved",
            "This is definitely water retention",
            "You need to cut calories immediately",
            "Your diet is causing this weight gain",
          ],
          causalLanguageMinConfidence: "high",
        },
      },
      templateJson: {
        interpretation:
          "Recent weight readings trending upward — worth exploring sodium, sleep, hydration, and meal patterns as possible contributors before drawing conclusions",
        actionTemplates: [
          {
            horizon: "today",
            kind: "log",
            text: "Log all of your meals today so we can see the full picture",
            completionSignal: "meal_logged",
          },
          {
            horizon: "today",
            kind: "drink",
            text: "Hit your hydration goal today — water fluctuation affects the scale",
            completionSignal: "water_logged",
          },
          {
            horizon: "next_check_in",
            kind: "weigh",
            text: "Continue weighing in at the same time each morning so we can track the actual trend",
            completionSignal: "weight_logged",
          },
        ],
        learningTemplates: [
          {
            observer: "weight",
            ask: "Are you weighing yourself at the same time each day, ideally first thing in the morning?",
            benefit:
              "Same-time weigh-ins remove water and food fluctuation noise and help us spot actual trends faster",
            cooldownKey: "weight_timing_ask",
          },
        ],
      },
    },

    // ─── 2. Weight-Loss Plateau ──────────────────────────────────────────────
    {
      specialization: "corner",
      key: "weight_loss_plateau",
      version: 1,
      isActive: true,
      safetyClass: "routine",
      ruleJson: {
        triggerIntents: [
          "plateau", "not_losing", "weight_stuck", "scale_not_moving",
          "stalled", "weight_same", "not_dropping",
        ],
        requiredEvidence: [
          {
            observer: "weight",
            metric: "recent_trend",
            window: "30d",
            predicate: "flat",
            investigationSignalNote:
              "Weight trend flat over 30 days with active logging — warrants exploring contributing factors",
          },
          {
            observer: "compliance",
            metric: "logging_recency",
            window: "7d",
            predicate: "present",
            investigationSignalNote:
              "Confirmed logging activity — plateau signal is more meaningful when the person is consistently logging",
          },
        ],
        contraindications: [
          { observer: "weight", metric: "goal_type", predicate: "maintenance_goal" },
          { observer: "weight", metric: "recent_trend", predicate: "trending_down" },
        ],
        confidenceRule: {
          highRequires: ["weight.recent_trend", "macro.protein_distribution", "restaurant.frequency"],
          moderateRequires: ["weight.recent_trend"],
        },
        safetyClass: "routine",
        interpretationBoundaries: {
          allowedFramings: [
            "Your weight has been consistent recently — a few things can contribute to this",
            "Plateaus are common and often temporary — let's look at what might be going on",
            "When the scale holds steady, there are usually a few areas worth checking",
          ],
          forbiddenFramings: [
            "Your metabolism has slowed",
            "You need to cut X more calories",
            "You are eating too much for your body",
            "Your body is in starvation mode",
          ],
          causalLanguageMinConfidence: "high",
        },
      },
      templateJson: {
        interpretation:
          "Weight holding steady over an extended period — worth reviewing restaurant meal frequency, protein distribution across meals, and logging consistency before drawing conclusions",
        actionTemplates: [
          {
            horizon: "today",
            kind: "log",
            text: "Log every meal today including any snacks — complete logging gives us the clearest picture",
            completionSignal: "meal_logged",
          },
          {
            horizon: "next_check_in",
            kind: "use_feature",
            text: "Take a look at your protein at each meal in your recent logs",
            featureTarget: "/nutrition-hub",
            completionSignal: "macro_logged",
          },
          {
            horizon: "next_check_in",
            kind: "weigh",
            text: "Keep daily weigh-ins going so we can see if the trend shifts over the next week",
            completionSignal: "weight_logged",
          },
        ],
        learningTemplates: [
          {
            observer: "restaurant",
            ask: "How many times did you eat out or order in this week?",
            benefit:
              "Restaurant meals often have more sodium and larger portions than home-cooked meals, which can mask progress on the scale",
            cooldownKey: "restaurant_frequency_ask",
          },
        ],
      },
    },

    // ─── 3. Fatigue / Low Energy ─────────────────────────────────────────────
    {
      specialization: "corner",
      key: "fatigue_low_energy",
      version: 1,
      isActive: true,
      safetyClass: "caution",
      ruleJson: {
        triggerIntents: [
          "tired", "fatigue", "no_energy", "exhausted", "low_energy",
          "drained", "sluggish", "fatigued", "run_down",
        ],
        requiredEvidence: [
          {
            observer: "macro",
            metric: "intake_vs_goal",
            window: "7d",
            predicate: "low",
            investigationSignalNote:
              "Logged intake appears below goal for multiple days — warrants exploring energy intake as a possible contributor",
          },
        ],
        contraindications: [
          { observer: "lifestyle", metric: "illness_reported", predicate: "present" },
          { observer: "lifestyle", metric: "medical_fatigue_condition", predicate: "present" },
        ],
        confidenceRule: {
          highRequires: ["macro.intake_vs_goal", "macro.protein_vs_goal", "hydration.daily_average"],
          moderateRequires: ["macro.intake_vs_goal"],
        },
        safetyClass: "caution",
        interpretationBoundaries: {
          allowedFramings: [
            "Your recent logged intake has been lower than your targets on several days — that can affect how you feel",
            "A few things sometimes contribute to energy dips — let's look at what we can see in your logs",
            "When energy is low, intake, protein timing, and hydration are often worth reviewing together",
          ],
          forbiddenFramings: [
            "Eating under 1,400 calories is causing your fatigue",
            "Low protein IS causing your energy issues",
            "You have a nutritional deficiency",
            "Your blood sugar is causing this",
            "This is adrenal fatigue",
            "You need more iron",
          ],
          causalLanguageMinConfidence: "high",
        },
      },
      templateJson: {
        interpretation:
          "Energy dip reported alongside logged intake below goal on multiple days — worth exploring meal timing, total intake, protein distribution, and hydration as areas to review",
        actionTemplates: [
          {
            horizon: "today",
            kind: "log",
            text: "Log everything you eat and drink today — a complete picture helps us see what might be missing",
            completionSignal: "meal_logged",
          },
          {
            horizon: "today",
            kind: "drink",
            text: "Prioritize your water goal today — dehydration often shows up as fatigue first",
            completionSignal: "water_logged",
          },
          {
            horizon: "today",
            kind: "eat",
            text: "Make sure you eat within two hours of waking — skipping the first meal can affect energy throughout the day",
            completionSignal: "meal_logged",
          },
        ],
        learningTemplates: [
          {
            observer: "macro",
            ask: "How consistent has your meal timing been this week — are you eating at similar times each day?",
            benefit:
              "Consistent meal timing helps us understand whether energy dips might be linked to gaps between meals",
            cooldownKey: "meal_timing_ask",
          },
        ],
      },
    },

    // ─── 4. Cravings ─────────────────────────────────────────────────────────
    {
      specialization: "corner",
      key: "cravings",
      version: 1,
      isActive: true,
      safetyClass: "routine",
      ruleJson: {
        triggerIntents: [
          "cravings", "craving", "want_to_snack", "hungry_all_time",
          "cant_stop_eating", "always_hungry", "snacking", "food_noise",
        ],
        requiredEvidence: [
          {
            observer: "macro",
            metric: "meal_gap",
            window: "7d",
            predicate: "present",
            investigationSignalNote:
              "Visible gaps between logged meals — worth exploring as a possible contributor to cravings",
          },
        ],
        contraindications: [
          { observer: "behavior", metric: "eating_disorder_flag", predicate: "present" },
        ],
        confidenceRule: {
          highRequires: ["macro.meal_gap", "macro.protein_distribution", "macro.evening_macro_gap"],
          moderateRequires: ["macro.meal_gap"],
        },
        safetyClass: "routine",
        interpretationBoundaries: {
          allowedFramings: [
            "Cravings often increase when meals are spread unevenly or protein is lower at certain points in the day",
            "There are a few patterns in eating timing and distribution that sometimes show up alongside cravings",
            "Let's look at how your meals are timed and distributed — that often gives useful clues",
          ],
          forbiddenFramings: [
            "Your blood sugar is crashing and causing cravings",
            "This is a hormonal imbalance",
            "Your cortisol is elevated",
            "You have insulin resistance",
            "You are addicted to sugar",
          ],
          causalLanguageMinConfidence: "high",
        },
      },
      templateJson: {
        interpretation:
          "Cravings reported alongside gaps between logged meals — worth reviewing meal timing distribution and protein at each meal",
        actionTemplates: [
          {
            horizon: "today",
            kind: "eat",
            text: "Try to have a meal or substantial snack every 3–4 hours today and log each one",
            completionSignal: "meal_logged",
          },
          {
            horizon: "today",
            kind: "log",
            text: "Log meals as you eat them today — real-time logging helps us spot where the gaps are",
            completionSignal: "meal_logged",
          },
          {
            horizon: "next_check_in",
            kind: "use_feature",
            text: "Use the Meal Builder to plan a protein-forward snack for later in the day",
            featureTarget: "/meals",
            completionSignal: "meal_logged",
          },
        ],
        learningTemplates: [
          {
            observer: "macro",
            ask: "Do the cravings tend to hit at a specific time of day — evening, mid-afternoon, or after meals?",
            benefit:
              "Knowing when cravings peak helps us look for patterns in your meal timing and distribution that might explain what's happening",
            cooldownKey: "craving_timing_ask",
          },
        ],
      },
    },

    // ─── 5. Restaurant Eating ─────────────────────────────────────────────────
    {
      specialization: "corner",
      key: "restaurant_eating",
      version: 1,
      isActive: true,
      safetyClass: "routine",
      ruleJson: {
        triggerIntents: [
          "eating_out", "restaurant", "takeout", "dining_out",
          "going_out_to_eat", "ordering_in", "hard_to_eat_healthy",
          "travel_eating", "on_the_road",
        ],
        requiredEvidence: [
          {
            observer: "restaurant",
            metric: "meal_frequency",
            window: "7d",
            predicate: "elevated",
            investigationSignalNote:
              "Restaurant meal frequency elevated this week — relevant to explore when the person is asking about eating out",
          },
        ],
        contraindications: [
          { observer: "lifestyle", metric: "restaurant_strategy_confirmed", predicate: "present" },
        ],
        confidenceRule: {
          highRequires: ["restaurant.meal_frequency", "macro.sodium_trend"],
          moderateRequires: ["restaurant.meal_frequency"],
        },
        safetyClass: "routine",
        interpretationBoundaries: {
          allowedFramings: [
            "Restaurant meals often have more sodium and larger portions than home cooking — that can make staying on track trickier",
            "Eating out frequently is something we can work with — it just helps to have a few strategies ready",
            "When dining out is a regular part of your week, having a go-to approach makes a real difference",
          ],
          forbiddenFramings: [
            "Restaurant food is too high in sodium for you to eat out",
            "You are consuming X mg sodium per restaurant meal",
            "Eating out this often is why you are not losing weight",
            "You should stop eating at restaurants",
          ],
          causalLanguageMinConfidence: "high",
        },
      },
      templateJson: {
        interpretation:
          "Multiple restaurant meals this week with user asking about eating out — practical navigation strategies are the appropriate response",
        actionTemplates: [
          {
            horizon: "today",
            kind: "log",
            text: "Log your restaurant meal as best you can — an estimate is more useful than nothing",
            completionSignal: "restaurant_logged",
          },
          {
            horizon: "today",
            kind: "use_feature",
            text: "Check the Restaurant Guide for your destination — it has on-plan options already identified",
            featureTarget: "/restaurant-guide",
            completionSignal: "restaurant_logged",
          },
          {
            horizon: "next_check_in",
            kind: "drink",
            text: "Prioritize extra water today — restaurant meals tend to run higher in sodium, and staying hydrated helps",
            completionSignal: "water_logged",
          },
        ],
        learningTemplates: [
          {
            observer: "restaurant",
            ask: "Do you have a few restaurants you go to regularly, or is it more varied each week?",
            benefit:
              "Knowing your regular spots lets us give you more specific guidance for exactly where you're eating",
            cooldownKey: "restaurant_regulars_ask",
          },
        ],
      },
    },
  ] as const;

  for (const pattern of patterns) {
    await db.execute(sql`
      INSERT INTO knowledge_patterns
        (specialization, key, version, is_active, safety_class, rule_json, template_json, approved_at, approved_by)
      VALUES (
        ${pattern.specialization},
        ${pattern.key},
        ${pattern.version},
        ${pattern.isActive},
        ${pattern.safetyClass},
        ${JSON.stringify(pattern.ruleJson)}::jsonb,
        ${JSON.stringify(pattern.templateJson)}::jsonb,
        NOW(),
        'phase2_seed'
      )
      ON CONFLICT (specialization, key, version) DO NOTHING
    `);
  }

  console.log("✅ Coach Knowledge Library: 5 adult Corner patterns seeded (or already present)");
}
