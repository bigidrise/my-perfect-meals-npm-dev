import type { ReasoningFamily } from "../../../../../shared/coaching/types";

/**
 * Reinforcement — Meaningful Progress Recognition
 *
 * This family is a MODIFIER, not a primary response.
 * It does not activate from a user question — it activates when the compliance
 * observer detects improving participation, and prepends a genuine, data-grounded
 * acknowledgment to the start of whatever response the engine is producing.
 *
 * The acknowledgment is NOT a badge, congratulations, or gamification.
 * It is a substantive statement of what the data now reveals that it couldn't before.
 *
 * Example:
 *   "This helps. You've logged consistently for five days now, so I can actually
 *    see a pattern instead of guessing. Your protein is landing right around target
 *    most days, which is part of why your hunger has been more manageable."
 *
 * That is different from: 🎉 "You logged 5 days in a row!"
 */
export const reinforcement: ReasoningFamily = {
  id: "reinforcement",
  name: "Progress Recognition — What the Data Now Shows",
  description:
    "Detect meaningful improvements in participation and acknowledge them by stating " +
    "what the platform can now see or determine that it could not before. " +
    "This is a coaching modifier — not a primary response and not gamification.",

  isModifier: true,

  activation: {
    // This family does not activate from user message keywords.
    // It activates from compliance observer signals evaluated in the matcher.
    intentKeywords: [],
    intentIds: [],
  },

  primaryQuestion:
    "What has improved in this person's participation, and what does the data now " +
    "reveal that it couldn't before — specifically and substantively?",

  evidenceNeeded: [
    {
      snapshotPath: "observer.compliance.macro_log_days_7d",
      label: "Macro logging days (7 days)",
      importance: "required",
      why: "Primary signal for participation improvement — logging consistency is the foundation.",
    },
    {
      snapshotPath: "observer.compliance.data_coverage_score",
      label: "Data coverage score",
      importance: "helpful",
      why: "Composite signal for overall evidence quality improvement.",
    },
    {
      snapshotPath: "observer.macro.protein_adherence_pct_7d",
      label: "Protein adherence % (7 days)",
      importance: "helpful",
      why: "If protein consistency has improved, the coach can now see whether satiety should be improving too.",
    },
    {
      snapshotPath: "observer.macro.calorie_adherence_pct_7d",
      label: "Calorie adherence % (7 days)",
      importance: "helpful",
      why: "Calorie consistency enables real trend analysis.",
    },
  ],

  interpretationRules: [
    {
      id: "logging_streak_improved",
      condition:
        "User has logged 5 or more of the last 7 days — a meaningful improvement over prior sparse logging",
      interpretation:
        "Consistent participation has improved the coaching engine's evidence quality. " +
        "The coach can now see patterns instead of making broad guesses.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.compliance.macro_log_days_7d"],
    },
    {
      id: "protein_consistency_improved",
      condition: "Protein adherence has been consistently close to target for 5+ logged days",
      interpretation:
        "Protein consistency is now visible as a real pattern. The coach can connect " +
        "consistent protein intake to satiety outcomes in a personalized way.",
      likelihood: "possible",
      requiresObservedPaths: ["observer.macro.protein_adherence_pct_7d"],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: false,
    minimumRequiredPaths: ["observer.compliance.macro_log_days_7d"],
    askFirst: [],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [],

  learningOpportunity: "",

  forbiddenConclusions: [
    "Use gamification language — no badges, streaks celebrated for their own sake, or points",
    "Say 'great job' or 'congratulations' without connecting to what the data now shows",
    "Exaggerate the improvement beyond what the evidence actually shows",
    "Fabricate specific outcomes from the improved data that aren't in the evidence",
    "Use the reinforcement as the entire response — it is a modifier, always combined with actual coaching",
  ],
};
