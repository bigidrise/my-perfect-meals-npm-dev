// Coach's Corner — Behavioral Intake (Onboarding V1)
//
// Each question maps to exactly one typed behavioral-variable column on
// coaching_profiles (see shared/coachCornerTypes.ts). This is a first-pass
// question set: every question exists to change how the Coach Decision
// Engine responds, not to diagnose psychology. Expect this list to be
// pruned/replaced once the Core Coaching Action Library and Recommendation
// Library are locked — do not treat it as final.

import type {
  CoachCornerFieldTarget,
  CoachCornerQuestion,
} from "../../../shared/coachCornerTypes";

export type { CoachCornerFieldTarget, CoachCornerQuestion };

export const COACH_CORNER_QUESTIONS: CoachCornerQuestion[] = [
  // ---- Section 1 — Your Relationship With Change ----
  {
    id: "q1_off_track_causes",
    prompt: "When things are going well, what usually causes you to get off track?",
    target: "offTrackCauses",
    multiSelect: true,
    maxSelect: 2,
    options: [
      { value: "stress", label: "Stress" },
      { value: "busy_schedule", label: "Busy schedule" },
      { value: "travel", label: "Travel" },
      { value: "family_responsibilities", label: "Family responsibilities" },
      { value: "social_events", label: "Social events" },
      { value: "cravings", label: "Cravings" },
      { value: "boredom", label: "Boredom" },
      { value: "dont_know", label: "I honestly don't know" },
    ],
  },
  {
    id: "q2_setback_response",
    prompt: "When you get off track, what's most likely to happen next?",
    target: "setbackResponse",
    multiSelect: false,
    options: [
      { value: "quits_completely", label: "I quit completely" },
      { value: "starts_monday", label: "I tell myself I'll start Monday" },
      { value: "keeps_trying_struggles", label: "I keep trying but struggle" },
      { value: "recovers_quickly", label: "I usually recover quickly" },
    ],
  },
  {
    id: "q3_progress_mindset",
    prompt: "When progress slows, what's your first thought?",
    target: "progressMindset",
    multiSelect: false,
    options: [
      { value: "plan_not_working", label: "My plan isn't working" },
      { value: "doing_something_wrong", label: "I'm doing something wrong" },
      { value: "gets_discouraged", label: "I get discouraged" },
      { value: "stays_patient", label: "I stay patient and trust the process" },
    ],
  },

  // ---- Section 2 — How You Make Decisions ----
  {
    id: "q4_trust_style",
    prompt: "When someone gives you advice, what helps you trust it?",
    target: "trustStyle",
    multiSelect: false,
    options: [
      { value: "explain_why", label: "Explain why it works" },
      { value: "show_science", label: "Show me the science" },
      { value: "just_tell_me", label: "Just tell me what to do" },
      { value: "let_me_decide", label: "Let me decide" },
    ],
  },
  {
    id: "q5_overwhelm_response",
    prompt: "When you feel overwhelmed, you usually...",
    target: "overwhelmResponse",
    multiSelect: false,
    options: [
      { value: "stops_everything", label: "Stop everything" },
      { value: "does_less", label: "Do less" },
      { value: "keeps_pushing", label: "Keep pushing" },
      { value: "asks_for_help", label: "Ask for help" },
    ],
  },
  {
    id: "q6_decision_style",
    prompt: "How do you usually make important health decisions?",
    target: "decisionStyle",
    multiSelect: false,
    options: [
      { value: "researches_everything", label: "I research everything" },
      { value: "asks_someone_trusted", label: "I ask someone I trust" },
      { value: "tries_whats_promising", label: "I try whatever sounds promising" },
      { value: "goes_by_experience", label: "I mostly go by experience" },
    ],
  },

  // ---- Section 3 — Food Relationship ----
  {
    id: "q7_eating_driver",
    prompt: "Which statement sounds most like you?",
    target: "eatingDriver",
    multiSelect: false,
    options: [
      { value: "hunger", label: "I eat because I'm hungry" },
      { value: "stress", label: "I eat because I'm stressed" },
      { value: "enjoyment", label: "I eat because food is enjoyable" },
      { value: "schedule", label: "I eat because it's time to eat" },
      { value: "depends", label: "It depends" },
    ],
  },
  {
    id: "q8_craving_response",
    prompt: "When you crave something, what usually happens?",
    target: "cravingResponse",
    multiSelect: false,
    options: [
      { value: "gives_in_immediately", label: "I give in immediately" },
      { value: "fights_it", label: "I fight it" },
      { value: "looks_for_healthier_option", label: "I look for a healthier option" },
      { value: "depends_on_day", label: "It depends on the day" },
    ],
  },
  {
    id: "q9_hardest_part",
    prompt: "Which is harder for you?",
    target: "hardestPart",
    multiSelect: false,
    options: [
      { value: "saying_no", label: "Saying no" },
      { value: "knowing_what_to_eat", label: "Knowing what to eat" },
      { value: "staying_consistent", label: "Staying consistent" },
      { value: "being_patient", label: "Being patient" },
    ],
  },

  // ---- Section 4 — Lifestyle ----
  {
    id: "q10_activity_level",
    prompt: "How active are you right now?",
    target: "activityLevel",
    multiSelect: false,
    options: [
      { value: "no_exercise", label: "I don't exercise" },
      { value: "walking_only", label: "Walking only" },
      { value: "strength_training", label: "Strength training" },
      { value: "endurance_training", label: "Endurance training" },
      { value: "mix", label: "A mix" },
    ],
  },
  {
    id: "q11_active_days_per_week",
    prompt: "How many days each week are you active?",
    target: "activeDaysPerWeek",
    multiSelect: false,
    options: [
      { value: "0", label: "0 days" },
      { value: "1", label: "1 day" },
      { value: "2", label: "2 days" },
      { value: "3", label: "3 days" },
      { value: "4", label: "4 days" },
      { value: "5", label: "5 days" },
      { value: "6", label: "6 days" },
      { value: "7", label: "7 days" },
    ],
  },
  {
    id: "q12_plan_start_stage",
    prompt: "When did you begin your current nutrition plan?",
    target: "planStartStage",
    multiSelect: false,
    options: [
      { value: "not_started", label: "I haven't started yet" },
      { value: "this_week", label: "This week" },
      { value: "two_to_four_weeks", label: "2–4 weeks ago" },
      { value: "one_to_three_months", label: "1–3 months ago" },
      { value: "more_than_three_months", label: "More than 3 months ago" },
    ],
  },

  // ---- Section 5 — Coaching Style ----
  {
    id: "q13_recovery_preference",
    prompt: "How would you like Coach to help when you're struggling?",
    target: "recoveryPreference",
    multiSelect: false,
    options: [
      { value: "encouragement", label: "Encourage me" },
      { value: "understanding_why", label: "Educate me" },
      { value: "simple_plan", label: "Give me a simple plan" },
      { value: "fresh_start", label: "Challenge me" },
    ],
  },
  {
    id: "q14_motivation_driver",
    prompt: "When you accomplish something, what keeps you motivated?",
    target: "motivationDriver",
    multiSelect: false,
    options: [
      { value: "seeing_progress", label: "Seeing progress" },
      { value: "feeling_healthier", label: "Feeling healthier" },
      { value: "encouragement", label: "Encouragement" },
      { value: "knowing_why_it_worked", label: "Knowing why it worked" },
    ],
  },
  {
    id: "q15_goal_type",
    prompt: "Which statement best describes what you're looking for?",
    target: "goalType",
    multiSelect: false,
    options: [
      { value: "lose_weight", label: "I want to lose weight" },
      { value: "build_habits", label: "I want to build healthy habits" },
      { value: "more_energy", label: "I want more energy" },
      { value: "better_overall_health", label: "I want better overall health" },
      { value: "all_of_the_above", label: "I want all of the above" },
    ],
  },
];
