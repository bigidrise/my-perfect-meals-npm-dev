// Coach's Corner — Behavioral Intake (Version 1, typed variables)
//
// Each question maps to exactly one typed behavioral-variable column on
// coaching_profiles (see shared/coachCornerTypes.ts). These three variables
// are the approved starting set. Additional behavioral variables and
// questions will be supplied before the intake is considered complete —
// do NOT add tone/lifestyle/preference questions back into this list as a
// substitute for real behavioral variables.

import type {
  CoachCornerFieldTarget,
  CoachCornerQuestion,
} from "../../../shared/coachCornerTypes";

export type { CoachCornerFieldTarget, CoachCornerQuestion };

export const COACH_CORNER_QUESTIONS: CoachCornerQuestion[] = [
  {
    id: "q1_setback_response",
    prompt: "When progress slows for a few weeks, what's most likely to happen?",
    target: "setbackResponse",
    multiSelect: false,
    options: [
      { value: "loses_motivation", label: "I lose motivation" },
      { value: "pushes_harder", label: "I push harder" },
      { value: "questions_plan", label: "I start questioning the plan" },
      { value: "stays_consistent", label: "I stay consistent anyway" },
    ],
  },
  {
    id: "q2_stress_response",
    prompt: "When you're stressed, what do you tend to do?",
    target: "stressResponse",
    multiSelect: false,
    options: [
      { value: "eats_more", label: "Eat more than usual" },
      { value: "eats_less", label: "Eat less than usual" },
      { value: "keeps_routine", label: "Keep my routine the same" },
      { value: "skips_meals", label: "Skip meals" },
    ],
  },
  {
    id: "q3_recovery_preference",
    prompt: "What helps you get back on track fastest?",
    target: "recoveryPreference",
    multiSelect: false,
    options: [
      { value: "simple_plan", label: "A simple, clear plan" },
      { value: "encouragement", label: "Encouragement" },
      { value: "understanding_why", label: "Understanding why it matters" },
      { value: "fresh_start", label: "Just starting fresh, no dwelling on it" },
    ],
  },
];
