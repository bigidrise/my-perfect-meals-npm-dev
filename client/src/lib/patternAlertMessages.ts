// Adaptive Coaching State — Tone Library
//
// Voice: supportive / observant / human — never punitive, never robotic.
// Each alert type has 3–4 message variants that rotate based on dismiss count
// so the coach feels observant rather than scripted.
//
// Rotation is deterministic: variant = dismissCount % variants.length
// (same result per browser session, no randomness, no AI call needed)
//
// Rules:
//   ✗  "Warning", "Failure", "Noncompliance", "You missed targets"
//   ✓  "Looks like things got busy", "Let's simplify", "Whenever you're ready"
//   ✓  Positives celebrate without being hollow — specific and earned

export type PatternAlertType =
  | "no_meal_logs_3d"
  | "low_protein_streak"
  | "macro_consistency_low"
  | "no_weigh_in_7d"
  | "protein_target_streak"
  | "macro_consistency_strong"
  | "routine_strong_week";

export interface PatternAlertMessage {
  headline: string;
  body: string;
  cta: string;
  ctaRoute: string;
}

// Each type is an array of variants — rotate via dismissCount % length
export const PATTERN_ALERT_VARIANTS: Record<PatternAlertType, PatternAlertMessage[]> = {

  // ── DRIFT ────────────────────────────────────────────────────────────────

  no_meal_logs_3d: [
    {
      headline: "Looks like things got busy",
      body: "It's been a few days since you logged a meal — life happens. Whenever you're ready, I'm here to help you pick up right where you left off.",
      cta: "Get back on track",
      ctaRoute: "/dashboard",
    },
    {
      headline: "No pressure, just checking in",
      body: "You've been quiet the last few days. No judgment — even a quick log today can help me recalibrate your plan.",
      cta: "Log something quick",
      ctaRoute: "/dashboard",
    },
    {
      headline: "Ready when you are",
      body: "Breaks happen, even for the most consistent people. Whenever you want to re-engage, your plan and history are exactly where you left them.",
      cta: "Pick up where I left off",
      ctaRoute: "/dashboard",
    },
  ],

  low_protein_streak: [
    {
      headline: "Your protein's been a little lower than usual",
      body: "You're doing well overall, but protein has been below target the past few days. A couple of small swaps can close the gap easily.",
      cta: "Find high-protein meals",
      ctaRoute: "/create-dish",
    },
    {
      headline: "Quick protein boost opportunity",
      body: "Protein's trended a bit low this week. Even one high-protein meal today can shift your average — want some fast ideas?",
      cta: "Show me quick ideas",
      ctaRoute: "/create-dish",
    },
    {
      headline: "Small gap, easy fix",
      body: "Your protein intake has dipped a bit lately. This is one of the easiest things to correct — a couple of intentional meals makes all the difference.",
      cta: "Build a high-protein meal",
      ctaRoute: "/create-dish",
    },
  ],

  macro_consistency_low: [
    {
      headline: "Your routine shifted a little this week",
      body: "You've been logging less consistently lately — that's completely okay. Let's simplify your plan so it fits where life is right now.",
      cta: "See your plan",
      ctaRoute: "/dashboard",
    },
    {
      headline: "Consistency is a rhythm, not a rule",
      body: "Some weeks are steadier than others. You're still here, which matters. Want to lighten things up for the rest of the week?",
      cta: "Simplify this week",
      ctaRoute: "/dashboard",
    },
    {
      headline: "Let's make this week easier",
      body: "Your logging has been a little sporadic. That often means the plan feels like too much right now — want to find a simpler groove?",
      cta: "Find my groove",
      ctaRoute: "/create-dish",
    },
  ],

  no_weigh_in_7d: [
    {
      headline: "No recent weigh-in",
      body: "You haven't logged a weight check-in in a while. No pressure at all — your trend is saved and ready whenever you want to see it.",
      cta: "Log a weigh-in",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "Your trend is waiting for you",
      body: "It's been over a week since your last weight check. Whenever you're ready, a single data point helps me understand how things are going.",
      cta: "Check in now",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "One number, big picture",
      body: "Your weight trend shows your progress over time — but only if you log it. No judgment, just data. Whenever feels right.",
      cta: "Add today's weight",
      ctaRoute: "/my-biometrics",
    },
  ],

  // ── POSITIVE ─────────────────────────────────────────────────────────────

  protein_target_streak: [
    {
      headline: "Your protein game is dialed in",
      body: "You've been consistently hitting your protein targets — that's the kind of habit that compounds. Your body is getting what it needs.",
      cta: "Keep the momentum",
      ctaRoute: "/dashboard",
    },
    {
      headline: "Protein streak looking strong",
      body: "You've hit your protein target multiple days in a row this week. That's not easy — and it shows in how consistently you're building.",
      cta: "See your progress",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "Solid protein week",
      body: "Your consistency with protein this week has been really strong. This is exactly the kind of rhythm that drives long-term results.",
      cta: "Build on it",
      ctaRoute: "/create-dish",
    },
  ],

  macro_consistency_strong: [
    {
      headline: "Your routine looks strong this week",
      body: "You've been logging consistently and staying on plan. That kind of steady effort is what drives real, lasting change.",
      cta: "Keep it going",
      ctaRoute: "/dashboard",
    },
    {
      headline: "Consistency is your superpower right now",
      body: "You've logged most of this week and your patterns are looking solid. This is the compounding phase — keep showing up.",
      cta: "See how you're trending",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "Strong week in the books",
      body: "Your logging consistency this week has been above the curve. Small actions, repeated — that's the whole game.",
      cta: "View your week",
      ctaRoute: "/dashboard",
    },
  ],

  routine_strong_week: [
    {
      headline: "You're building real momentum",
      body: "Logging every day and checking in with your weight — that's the full picture. You're giving your plan everything it needs to work.",
      cta: "See your progress",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "Full commitment this week",
      body: "Meals logged, weight tracked — you're not missing a beat. This kind of complete routine is rare and genuinely effective.",
      cta: "View your trend",
      ctaRoute: "/my-biometrics",
    },
    {
      headline: "Your routine is firing on all cylinders",
      body: "Consistent logging plus regular weigh-ins gives your plan the most accurate picture possible. This week is working.",
      cta: "Keep the streak alive",
      ctaRoute: "/dashboard",
    },
  ],
};

// Dismissal TTL per priority — medium reappears sooner if pattern persists
export const DISMISS_TTL_MS: Record<string, number> = {
  high:   12 * 60 * 60 * 1000,  // 12 h
  medium: 24 * 60 * 60 * 1000,  // 24 h
  low:    48 * 60 * 60 * 1000,  // 48 h
};

export function getVariant(type: PatternAlertType, dismissCount: number): PatternAlertMessage {
  const variants = PATTERN_ALERT_VARIANTS[type];
  if (!variants || variants.length === 0) {
    return { headline: "", body: "", cta: "", ctaRoute: "/dashboard" };
  }
  return variants[dismissCount % variants.length];
}
