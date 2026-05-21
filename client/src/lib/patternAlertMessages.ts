// Phase 3 — Pattern Alert Tone Library
//
// MPM's voice is supportive, observant, and human — never robotic or punitive.
// Alerts are written as a caring coach noticing a shift, not a system issuing a warning.
//
// Rules for all messages:
//   ✗  "Warning", "Failure", "Noncompliance", "You missed targets"
//   ✓  "Looks like things got busy", "Let's simplify", "Whenever you're ready"

export type PatternAlertType =
  | "no_meal_logs_3d"
  | "low_protein_streak"
  | "macro_consistency_low"
  | "no_weigh_in_7d";

export interface PatternAlertMessage {
  headline: string;
  body: string;
  cta: string;
  ctaRoute: string;
}

export const PATTERN_ALERT_MESSAGES: Record<
  PatternAlertType,
  PatternAlertMessage
> = {
  no_meal_logs_3d: {
    headline: "Looks like things got busy",
    body: "It's been a few days since you logged a meal — life happens. Whenever you're ready, I'm here to help you pick up right where you left off.",
    cta: "Get back on track",
    ctaRoute: "/dashboard",
  },

  low_protein_streak: {
    headline: "Your protein's been a little lower than usual",
    body: "You're doing well overall, but protein has been below target the past few days. A couple of small swaps can close the gap easily.",
    cta: "Find high-protein meals",
    ctaRoute: "/create-dish",
  },

  macro_consistency_low: {
    headline: "Your routine shifted a little this week",
    body: "You've been logging less consistently lately — that's completely okay. Let's simplify your plan so it fits where life is right now.",
    cta: "See your plan",
    ctaRoute: "/dashboard",
  },

  no_weigh_in_7d: {
    headline: "No recent weigh-in",
    body: "You haven't logged a weight check-in in a while. No pressure at all — your trend is saved and ready whenever you want to see it.",
    cta: "Log a weigh-in",
    ctaRoute: "/my-biometrics",
  },
};

// Dismissal TTL per priority — medium alerts reappear sooner if pattern persists
export const DISMISS_TTL_MS: Record<string, number> = {
  high: 12 * 60 * 60 * 1000,   // 12 h
  medium: 24 * 60 * 60 * 1000, // 24 h
  low: 48 * 60 * 60 * 1000,    // 48 h
};
