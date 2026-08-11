import type { ReasoningFamily } from "../../../../../shared/coaching/types";

export const weightChangePlateau: ReasoningFamily = {
  id: "weight_change_plateau",
  name: "Weight Change / Plateau — Trend vs. Artifact",
  description:
    "The user is concerned about unexpected weight movement or a stall in progress. " +
    "The coach must distinguish a real longitudinal trend from a short-term artifact " +
    "before drawing any conclusions.",

  activation: {
    intentKeywords: [
      "gained weight", "weight went up", "gaining weight", "scale went up",
      "weight is higher", "gained pounds", "up on the scale", "put on weight",
      "plateau", "not losing", "weight stuck", "scale not moving", "stalled",
      "same weight", "not dropping", "stopped losing", "weight hasn't moved",
      "can't lose weight", "no progress", "why did i gain", "suddenly gained",
      "weight jumped", "heavier", "scale spiked",
    ],
    intentIds: ["weight_gain", "weight_loss_plateau", "general_inquiry"],
  },

  primaryQuestion:
    "Is this a real longitudinal trend (3+ days, confirmed by adherence data) " +
    "or a short-term artifact (sodium, water, glycogen, timing)?",

  evidenceNeeded: [
    {
      snapshotPath: "observer.weight.trend",
      label: "Weight trend direction",
      importance: "required",
      why: "The core question is whether weight is genuinely trending in the wrong direction.",
    },
    {
      snapshotPath: "observer.weight.velocity",
      label: "Weight change velocity",
      importance: "helpful",
      why: "Rate of change distinguishes normal fluctuation from a real shift.",
    },
    {
      snapshotPath: "observer.macro.log_frequency_7d",
      label: "Logging consistency (7 days)",
      importance: "required",
      why: "Without logging data, no conclusion about the cause is possible.",
    },
    {
      snapshotPath: "observer.macro.calorie_adherence_pct_7d",
      label: "Calorie adherence % (7 days)",
      importance: "helpful",
      why: "Adherence is needed to determine whether the prescription was actually followed.",
    },
    {
      snapshotPath: "observer.restaurant.recent_exposure",
      label: "Recent restaurant activity",
      importance: "helpful",
      why: "Restaurant meals are high in sodium and can produce 1–3 lb water weight spikes.",
    },
    {
      snapshotPath: "today.hydration.oz",
      label: "Hydration today",
      importance: "contextual",
      why: "Sodium-water retention is common after high-sodium meals — hydration is relevant context.",
    },
    {
      snapshotPath: "prescription.calories",
      label: "Calorie prescription",
      importance: "helpful",
      why: "Needed to contextualize whether the prescription is appropriate for the goal.",
    },
  ],

  interpretationRules: [
    {
      id: "short_term_artifact",
      condition:
        "Weight increased 1–3 lbs over 1–3 days and recent restaurant exposure or high-sodium meals are present",
      interpretation:
        "A short-term scale jump in this range following restaurant eating is consistent with " +
        "sodium-driven water retention, not fat gain. Stored glycogen is also associated with water, " +
        "so meaningful carbohydrate changes can temporarily affect scale weight. " +
        "This is an artifact worth monitoring rather than a trend to react to.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.weight.trend"],
    },
    {
      id: "real_trend_low_adherence",
      condition: "Weight is trending in the wrong direction for 7+ days AND macro logging is sparse",
      interpretation:
        "The trend appears sustained, but logging is too sparse to diagnose why. " +
        "The most important next step is improving data quality rather than changing the prescription — " +
        "we cannot know if the plan was followed.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.weight.trend", "observer.macro.log_frequency_7d"],
    },
    {
      id: "real_trend_high_adherence",
      condition:
        "Weight trend is flat or moving wrong direction for 10+ days AND calorie adherence is strong (>85%)",
      interpretation:
        "The evidence suggests the prescription has been followed and the expected outcome is " +
        "not materializing. This is a legitimate prescription investigation — " +
        "targets may need recalibration.",
      likelihood: "most_likely",
      requiresObservedPaths: [
        "observer.weight.trend",
        "observer.macro.calorie_adherence_pct_7d",
        "observer.macro.log_frequency_7d",
      ],
    },
    {
      id: "insufficient_weight_data",
      condition: "Fewer than 3 weight measurements in the past 2 weeks",
      interpretation:
        "There is not enough weight data to determine whether this is a trend or noise. " +
        "Daily weigh-ins (same time, same conditions) for 1–2 more weeks would give " +
        "a much clearer picture.",
      likelihood: "most_likely",
      requiresObservedPaths: [],
    },
    {
      id: "plateau_investigation",
      condition:
        "Weight has been flat for 2+ weeks, goal is weight loss, and adherence appears strong",
      interpretation:
        "A genuine plateau — weight stable despite consistent effort — warrants " +
        "a closer look at the prescription. This is the appropriate time to discuss " +
        "whether the targets need adjusting.",
      likelihood: "possible",
      requiresObservedPaths: [
        "observer.weight.trend",
        "observer.macro.calorie_adherence_pct_7d",
      ],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: true,
    minimumRequiredPaths: [],
    askFirst: [
      "When did you notice this change — was it overnight or has it been building over several days?",
      "Did you eat out or have any unusually salty meals recently?",
      "Have you been logging your meals consistently?",
    ],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [
    {
      kind: "weigh",
      description: "Weigh in consistently for the next 5–7 days to establish a real trend.",
      condition: "Insufficient weight data — cannot evaluate from a single reading",
    },
    {
      kind: "log",
      description:
        "Log meals consistently for the next week so adherence can be established before any prescription change.",
      condition: "Logging is sparse — adherence is unknown",
      featureId: "macro_logger",
    },
    {
      kind: "other",
      description:
        "Monitor for 3–5 more days without making changes — a short-term spike is likely to resolve.",
      condition: "Short-term jump with restaurant exposure or sodium-heavy eating",
    },
  ],

  learningOpportunity:
    "Daily weight readings plus consistent meal logging would let me tell you within " +
    "a week whether this is a real trend or noise — and what's actually driving it.",

  forbiddenConclusions: [
    "Declare fat gain from a 1–3 day scale increase",
    "Tell the user 'carbs make you fat' or attribute all weight gain to carbohydrates",
    "Recommend reducing calories immediately from a single weight reading",
    "Assert that any specific food caused the weight change without adherence data",
    "Dismiss a 10+ day trend as 'just water weight'",
    "Recommend stopping the nutrition plan based on insufficient data",
    "Attribute sustained weight gain to metabolism without ruling out adherence issues",
  ],
};
