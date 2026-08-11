import type { ReasoningFamily } from "../../../../../shared/coaching/types";

export const lowEnergy: ReasoningFamily = {
  id: "low_energy",
  name: "Low Energy / Fatigue",
  description:
    "The user is reporting fatigue, low energy, or feeling drained. The coach investigates " +
    "nutritional causes (under-eating, poor carb availability, dehydration, meal timing) " +
    "before considering non-nutritional factors — and knows when to escalate.",

  activation: {
    intentKeywords: [
      "tired", "no energy", "exhausted", "fatigued", "drained", "sluggish",
      "no motivation", "run down", "low energy", "worn out", "always tired",
      "so tired", "exhaustion", "lethargic", "can't focus", "brain fog",
      "wiped out", "crashing", "energy crash", "afternoon crash",
      "tired all the time", "no drive",
    ],
    intentIds: ["fatigue", "general_inquiry"],
  },

  primaryQuestion:
    "Is this energy issue driven by under-eating, poor carb availability, dehydration, " +
    "meal timing, or performance demand — and what nutritional intervention is most appropriate?",

  evidenceNeeded: [
    {
      snapshotPath: "today.macros.calories",
      label: "Calories logged today",
      importance: "required",
      why: "Under-eating is the most common nutritional driver of low energy.",
    },
    {
      snapshotPath: "prescription.calories",
      label: "Calorie prescription",
      importance: "required",
      why: "Cannot determine whether the user is under-eating without a target to compare against.",
    },
    {
      snapshotPath: "today.macros.carbs",
      label: "Carbohydrates logged today",
      importance: "helpful",
      why: "Carbohydrates are the primary fuel for cognitive and physical performance. Very low carbs can cause brain fog and fatigue.",
    },
    {
      snapshotPath: "today.hydration.oz",
      label: "Hydration today",
      importance: "helpful",
      why: "Even mild dehydration (1–2%) produces measurable fatigue and reduced cognitive function.",
    },
    {
      snapshotPath: "today.macros.protein",
      label: "Protein logged today",
      importance: "helpful",
      why: "Protein supports satiety and stable energy — though its direct fatigue connection is weaker than carbs/calories.",
    },
    {
      snapshotPath: "today.checkin.energy",
      label: "Rated energy level",
      importance: "helpful",
      why: "Confirms the symptom and gauges severity on a consistent scale.",
    },
    {
      snapshotPath: "today.checkin.stress",
      label: "Stress level today",
      importance: "contextual",
      why: "High stress depletes energy through a different pathway than nutrition.",
    },
    {
      snapshotPath: "today.meals.completeness",
      label: "Day completeness",
      importance: "helpful",
      why: "Pre-meal fatigue (expecting to eat soon) differs from post-meal fatigue (ate and still tired).",
    },
    {
      snapshotPath: "overlays.performanceModeActive",
      label: "Performance mode active",
      importance: "contextual",
      why: "Training demand can justify higher carb or calorie intake to support energy needs.",
    },
  ],

  interpretationRules: [
    {
      id: "under_eating",
      condition: "Today's calories are significantly below target (< 75%) and energy is low",
      interpretation:
        "Under-eating is the most direct nutritional cause of low energy. " +
        "The gap between prescription and actual intake may be driving the fatigue.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.macros.calories", "prescription.calories"],
    },
    {
      id: "low_carb_energy",
      condition: "Carbohydrate intake appears very low relative to prescription and fatigue is reported",
      interpretation:
        "Carbohydrates are the body's primary fuel for mental and physical performance. " +
        "Very low carb availability can produce brain fog and low energy, " +
        "particularly around training or in the afternoon.",
      likelihood: "possible",
      requiresObservedPaths: ["today.macros.carbs"],
    },
    {
      id: "dehydration",
      condition: "Hydration is low (significantly below typical targets) alongside fatigue",
      interpretation:
        "Even mild dehydration produces measurable fatigue. " +
        "This is worth addressing before attributing energy issues to food.",
      likelihood: "possible",
      requiresObservedPaths: ["today.hydration.oz"],
    },
    {
      id: "pre_meal_dip",
      condition: "It is mid-afternoon, the next meal hasn't been logged, and energy is low",
      interpretation:
        "An afternoon energy dip before the next meal is common and expected. " +
        "This may not be a nutrition problem — it may just be time to eat.",
      likelihood: "possible",
      requiresObservedPaths: ["today.meals.completeness"],
    },
    {
      id: "non_nutritional_factor",
      condition: "Calories, carbs, protein, and hydration all appear adequate but energy is still low",
      interpretation:
        "The nutritional picture looks reasonable. Non-nutritional factors — " +
        "quality of sleep, life stress, illness, or overtraining — may be the primary driver. " +
        "These are outside the scope of nutrition coaching and may warrant attention elsewhere.",
      likelihood: "possible",
      requiresObservedPaths: ["today.macros.calories", "today.macros.carbs"],
    },
    {
      id: "performance_demand",
      condition: "Performance mode is active and fatigue appears on a training day",
      interpretation:
        "Training demand may require higher carbohydrate and calorie intake than the " +
        "rest-day prescription provides. Performance nutrition targets should reflect " +
        "actual training load.",
      likelihood: "possible",
      requiresObservedPaths: ["overlays.performanceModeActive"],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: true,
    minimumRequiredPaths: [],
    askFirst: [
      "Have you eaten your normal meals today?",
      "Have you had much water today?",
      "Is this a training day?",
    ],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [
    {
      kind: "eat",
      description: "Eat a carbohydrate and protein-balanced meal to address a calorie/carb gap.",
      condition: "Significant under-eating identified — calorie or carb gap",
      featureId: "meal_builder",
      contextToPass: "Remaining calorie and carbohydrate budget for today",
    },
    {
      kind: "drink",
      description: "Increase water intake — dehydration is a common energy drain.",
      condition: "Hydration is low",
    },
    {
      kind: "drink",
      description: "A protein or carbohydrate beverage can quickly address an energy gap.",
      condition: "Calorie or carb gap exists and user prefers liquid nutrition",
      featureId: "beverage_creator",
      contextToPass: "Remaining carbohydrate and calorie targets",
    },
    {
      kind: "log",
      description: "Log today's meals so the coach can determine if under-eating is the cause.",
      condition: "No meal data — cannot diagnose cause of fatigue",
      featureId: "macro_logger",
    },
    {
      kind: "contact_care",
      description:
        "If fatigue is severe, persistent across multiple days, or accompanied by other symptoms, " +
        "a healthcare provider should evaluate it — this is outside nutrition coaching scope.",
      condition: "Fatigue is severe or unexplained by nutritional factors",
    },
  ],

  learningOpportunity:
    "Logging your meals and check-in energy rating helps me see whether this is a nutrition " +
    "pattern (consistent low calorie or carb days = consistent fatigue) or something else. " +
    "Over time, I can tell you what your energy looks like on well-fueled days vs. not.",

  forbiddenConclusions: [
    "Assert a specific cause for fatigue without supporting evidence",
    "Diagnose fatigue as a medical condition",
    "Recommend a specific supplement without the user mentioning supplements",
    "Tell the user their fatigue is caused by stress or sleep without evidence",
    "Attribute fatigue to any single food or food group without data",
    "Suggest the user is sick or has a health problem — escalate if necessary, don't diagnose",
    "Recommend stopping exercise without a care team recommendation",
  ],
};
