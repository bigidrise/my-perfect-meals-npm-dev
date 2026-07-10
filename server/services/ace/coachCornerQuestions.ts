// Coach's Corner — v1 Behavioral Intake
//
// This is the vertical-slice intake used to prove the end-to-end loop:
// dashboard card -> welcome -> questions -> saved profile -> completion.
//
// It intentionally reuses the existing coaching_profiles columns
// (coachingStyle, accountabilityPref, motivations[], lifestyleFlags[],
// biggestChallenges[]) rather than inventing new schema, since the full
// Behavioral Variables / Intake Specification has not been locked yet.
// When that spec is finalized, this file should be replaced, not patched.

import type {
  CoachCornerFieldTarget,
  CoachCornerQuestion,
} from "../../../shared/coachCornerTypes";

export type { CoachCornerFieldTarget, CoachCornerQuestion };

export const COACH_CORNER_QUESTIONS: CoachCornerQuestion[] = [
  {
    id: "q1_coaching_style",
    prompt: "How should Chef talk to you when giving guidance?",
    target: "coachingStyle",
    multiSelect: false,
    options: [
      { value: "direct", label: "Direct — just tell me what to do" },
      { value: "gentle", label: "Gentle — ease me into it" },
      { value: "educational", label: "Educational — explain the why" },
      { value: "encouraging", label: "Encouraging — cheer me on" },
    ],
  },
  {
    id: "q2_accountability",
    prompt: "How much accountability do you want from Coach's Corner?",
    target: "accountabilityPref",
    multiSelect: false,
    options: [
      { value: "high", label: "High — check in on me often" },
      { value: "moderate", label: "Moderate — occasional nudges" },
      { value: "minimal", label: "Minimal — I'll ask when I need it" },
    ],
  },
  {
    id: "q3_motivation",
    prompt: "What motivates you most right now?",
    target: "motivations",
    multiSelect: false,
    options: [
      { value: "health", label: "My health" },
      { value: "family", label: "My family" },
      { value: "appearance", label: "How I look" },
      { value: "performance", label: "Performance / how I feel" },
      { value: "longevity", label: "Longevity" },
    ],
  },
  {
    id: "q4_setback_response",
    prompt: "When progress slows for a few weeks, what's most likely to happen?",
    target: "biggestChallenges",
    multiSelect: false,
    options: [
      { value: "loses_motivation", label: "I lose motivation" },
      { value: "pushes_harder", label: "I push harder" },
      { value: "questions_plan", label: "I start questioning the plan" },
      { value: "stays_consistent", label: "I stay consistent anyway" },
    ],
  },
  {
    id: "q5_stress_response",
    prompt: "When you're stressed, what do you tend to do?",
    target: "lifestyleFlags",
    multiSelect: false,
    options: [
      { value: "eats_more", label: "Eat more than usual" },
      { value: "eats_less", label: "Eat less than usual" },
      { value: "keeps_routine", label: "Keep my routine the same" },
      { value: "skips_meals", label: "Skip meals" },
    ],
  },
  {
    id: "q6_off_track",
    prompt: "What tends to knock you off track the most?",
    target: "biggestChallenges",
    multiSelect: true,
    maxSelect: 2,
    options: [
      { value: "cravings", label: "Cravings" },
      { value: "travel", label: "Travel" },
      { value: "social_events", label: "Social events / eating out" },
      { value: "busy_schedule", label: "A busy schedule" },
      { value: "low_motivation", label: "Low motivation" },
    ],
  },
  {
    id: "q7_recovery",
    prompt: "What helps you get back on track fastest?",
    target: "lifestyleFlags",
    multiSelect: false,
    options: [
      { value: "simple_plan", label: "A simple, clear plan" },
      { value: "encouragement", label: "Encouragement" },
      { value: "understanding_why", label: "Understanding why it matters" },
      { value: "fresh_start", label: "Just starting fresh, no dwelling on it" },
    ],
  },
  {
    id: "q8_eating_pattern",
    prompt: "How do you like to eat day to day?",
    target: "lifestyleFlags",
    multiSelect: false,
    options: [
      { value: "cooks_at_home", label: "Mostly cook at home" },
      { value: "eats_out_often", label: "Eat out often" },
      { value: "mix_of_both", label: "A mix of both" },
    ],
  },
];
