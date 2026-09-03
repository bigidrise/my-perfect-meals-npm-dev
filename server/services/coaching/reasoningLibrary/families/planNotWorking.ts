import type { ReasoningFamily } from "../../../../../shared/coaching/types";

export const planNotWorking: ReasoningFamily = {
  id: "plan_not_working",
  name: "Plan Not Working — Consistency Before Adjustment",
  description:
    "The user believes their nutrition plan is failing. The coach must determine whether " +
    "this is a prescription problem or an execution problem before recommending any change.",

  activation: {
    intentKeywords: [
      "not working", "plan isn't working", "nothing is working", "plan doesn't work",
      "not losing", "weight stuck", "plateau", "stalled", "not dropping",
      "same weight", "stopped losing", "not seeing results", "no progress",
      "not helping", "this isn't working", "why isn't", "why am i not",
      "plan failed", "giving up",
    ],
    intentIds: ["weight_loss_plateau", "general_inquiry"],
  },

  primaryQuestion:
    "Has the prescription actually been followed consistently enough to evaluate it? " +
    "Bad results + poor adherence = execution problem. " +
    "Bad results + strong adherence = prescription investigation.",

  evidenceNeeded: [
    {
      snapshotPath: "observer.macro.log_frequency_7d",
      label: "Macro logging consistency (7 days)",
      importance: "required",
      why: "Cannot evaluate adherence without knowing how often the user has been logging.",
    },
    {
      snapshotPath: "observer.macro.calorie_adherence_pct_7d",
      label: "Calorie adherence % (7 days)",
      importance: "required",
      why: "Adherence percentage is the primary signal for execution vs. prescription diagnosis.",
    },
    {
      snapshotPath: "observer.weight.trend",
      label: "Weight trend (recent)",
      importance: "helpful",
      why: "The user's complaint must be contextualized — is the trend actually flat, or just short-term noise?",
    },
    {
      snapshotPath: "prescription.calories",
      label: "Calorie target",
      importance: "required",
      why: "Cannot compute adherence without knowing the prescription.",
    },
    {
      snapshotPath: "today.macros.calories",
      label: "Today's calories logged",
      importance: "contextual",
      why: "Provides current-day context alongside the 7-day adherence picture.",
    },
    {
      snapshotPath: "observer.macro.prescription_days_7d",
      label: "Days with an active prescription (7 days)",
      importance: "helpful",
      why: "If the user hasn't had a prescription set, adherence cannot be computed.",
    },
  ],

  interpretationRules: [
    {
      id: "execution_problem_low_logging",
      condition: "Macro logging frequency is sparse (fewer than 3 days out of 7)",
      interpretation:
        "There is not enough logging to evaluate whether the prescription has been followed. " +
        "Before changing anything, we need to know what the person is actually eating. " +
        "This is almost certainly an execution visibility problem, not a prescription problem.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.macro.log_frequency_7d"],
    },
    {
      id: "execution_problem_low_adherence",
      condition: "Calorie adherence is below 80% on days that were logged",
      interpretation:
        "The prescription has not been consistently followed on logged days. " +
        "Changing a prescription that hasn't been tested would be premature. " +
        "The first goal should be consistent execution of the current plan.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.macro.calorie_adherence_pct_7d"],
    },
    {
      id: "prescription_investigation_warranted",
      condition: "Adherence is strong (>90% of target on 5+ logged days) and trend is genuinely flat or wrong direction",
      interpretation:
        "The data suggests the plan has actually been followed, which means the prescription " +
        "itself may warrant review. This is a real prescription evaluation, not an adherence issue.",
      likelihood: "most_likely",
      requiresObservedPaths: ["observer.macro.calorie_adherence_pct_7d", "observer.macro.log_frequency_7d"],
    },
    {
      id: "mixed_adherence",
      condition: "Adherence is moderate (60–90%) — some compliance, some gaps",
      interpretation:
        "The picture is mixed. Results cannot be cleanly attributed to either the prescription " +
        "or execution because we're somewhere in between. More consistency is needed before " +
        "drawing conclusions either way.",
      likelihood: "possible",
      requiresObservedPaths: ["observer.macro.calorie_adherence_pct_7d"],
    },
    {
      id: "short_timeline",
      condition: "The plan has only been in place a short time (less than 2 weeks of data)",
      interpretation:
        "The evaluation window may be too short. Nutrition plans generally need 3–4 weeks of " +
        "consistent execution before results are meaningful enough to evaluate.",
      likelihood: "possible",
      requiresObservedPaths: ["observer.macro.log_frequency_7d"],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: true,
    minimumRequiredPaths: ["prescription.calories"],
    askFirst: [
      "Have you been logging your meals consistently over the past week or two?",
      "On most days, were you hitting your calorie and protein targets?",
    ],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [
    {
      kind: "log",
      description:
        "Encourage consistent logging for the next 7 days before evaluating the prescription. " +
        "This gives the coach real data to work with.",
      condition: "Logging frequency is sparse or adherence is unknown",
      featureId: "macro_logger",
    },
    {
      kind: "other",
      description:
        "Commit to following the current prescription consistently for one more week " +
        "before deciding it needs to change.",
      condition: "Adherence is moderate — mixed results with inconsistent execution",
    },
    {
      kind: "other",
      description:
        "Schedule a real prescription review conversation after one more week of consistent data.",
      condition: "Strong adherence confirmed — prescription investigation is appropriate",
    },
  ],

  learningOpportunity:
    "The more consistently you log, the more clearly I can tell whether the plan needs " +
    "adjusting or whether execution is the real gap. Right now I can't see enough to know which one this is.",

  forbiddenConclusions: [
    "Recommend changing the calorie or macro targets without confirmed adherence evidence",
    "Tell the user the plan is working or not working without logging data",
    "Diagnose a plateau from fewer than 7 days of weight data",
    "Suggest the prescription is wrong without ruling out an execution problem first",
    "Recommend a calorie increase or decrease without seeing adherence",
    "Dismiss the user's concern as 'just be patient' without investigating adherence",
  ],
};
