/**
 * Coaching Engine — Behavioral Style Resolver
 *
 * Maps coaching_profiles behavioral data to one of four StyleModes.
 * Purely deterministic — no LLM, no randomness.
 *
 * The same evidence, the same coaching decision — different delivery.
 * Style controls how the rendering pass communicates, not what it recommends.
 *
 * Priority order (first match wins):
 *   1. Reassurance — for people who catastrophize or shut down under pressure
 *   2. Education   — for people who need to understand the "why"
 *   3. Accountability — for people who want direct guidance and structure
 *   4. Encouragement — default for everyone else
 *
 * If the user has no coaching profile yet, default to Encouragement.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { StyleMode } from "../../../shared/coaching/types";

export interface StyleResolution {
  mode: StyleMode;
  /** Natural-language instructions injected into the rendering pass prompt */
  instructions: string;
  /** Whether a coaching profile was found */
  profileFound: boolean;
}

interface CoachingProfileRow extends Record<string, unknown> {
  setback_response: string | null;
  overwhelm_response: string | null;
  trust_style: string | null;
  decision_style: string | null;
  progress_mindset: string | null;
  recovery_preference: string | null;
  coaching_style: string | null;
}

/**
 * Resolve communication style from the user's coaching profile.
 * Defaults to 'encouragement' if no profile exists.
 */
export async function resolveStyle(userId: string): Promise<StyleResolution> {
  let profile: CoachingProfileRow | null = null;

  try {
    const result = await db.execute<CoachingProfileRow>(sql`
      SELECT
        setback_response,
        overwhelm_response,
        trust_style,
        decision_style,
        progress_mindset,
        recovery_preference,
        coaching_style
      FROM coaching_profiles
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    profile = result.rows[0] ?? null;
  } catch {
    // No profile — use default
  }

  if (!profile) {
    return {
      mode: "encouragement",
      instructions: STYLE_INSTRUCTIONS.encouragement,
      profileFound: false,
    };
  }

  const mode = determineStyle(profile);
  return {
    mode,
    instructions: STYLE_INSTRUCTIONS[mode],
    profileFound: true,
  };
}

function determineStyle(profile: CoachingProfileRow): StyleMode {
  const {
    setback_response,
    overwhelm_response,
    progress_mindset,
    trust_style,
    decision_style,
    recovery_preference,
    coaching_style,
  } = profile;

  // 1. Reassurance — for people who stop everything, catastrophize, or feel like they're always doing something wrong
  const needsReassurance =
    setback_response === "stops_everything" ||
    setback_response === "stop" ||
    overwhelm_response === "catastrophize" ||
    overwhelm_response === "shut_down" ||
    progress_mindset === "failure_focused" ||
    progress_mindset === "doing_something_wrong";
  if (needsReassurance) return "reassurance";

  // 2. Education — for people who want to understand the science before acting
  const wantsEducation =
    trust_style === "evidence_based" ||
    trust_style === "show_science" ||
    trust_style === "researches_everything" ||
    decision_style === "research_first" ||
    decision_style === "understanding_why" ||
    coaching_style === "understanding_why";
  if (wantsEducation) return "education";

  // 3. Accountability — for people who want direct, structured guidance
  const wantsAccountability =
    decision_style === "direct" ||
    decision_style === "just_tell_me" ||
    recovery_preference === "structured" ||
    coaching_style === "just_tell_me" ||
    coaching_style === "simple_plan";
  if (wantsAccountability) return "accountability";

  // 4. Default
  return "encouragement";
}

// ─── Style Instructions ───────────────────────────────────────────────────────
// These are injected verbatim into the rendering pass system prompt.

const STYLE_INSTRUCTIONS: Record<StyleMode, string> = {
  reassurance: [
    "COMMUNICATION STYLE: Reassurance.",
    "This person needs to feel safe and supported first. Start by acknowledging what they shared before moving to any plan.",
    "Use warm, grounding language: 'This is completely normal', 'You haven't done anything wrong', 'We can figure this out together'.",
    "Never frame the situation as a mistake or failure on their part.",
    "Today's Plan should feel manageable and low-stakes — not a correction, just a next step.",
    "If learning opportunities are included, frame them as something that will help YOU help them — not something they're failing to do.",
  ].join(" "),

  education: [
    "COMMUNICATION STYLE: Education.",
    "This person wants to understand the 'why' before they act. Briefly explain what's happening and the reasoning behind recommendations.",
    "Use clear, evidence-grounded language: 'Here's what the data suggests...', 'The reason for this is...'.",
    "Don't over-simplify — they want substance. But keep it focused on what's relevant, not an exhaustive lecture.",
    "Frame Today's Plan as a hypothesis worth testing, not a prescription.",
    "The learning opportunity section is valuable to this person — lean into it.",
  ].join(" "),

  accountability: [
    "COMMUNICATION STYLE: Accountability.",
    "This person wants clear, direct guidance. Lead with the plan, not the analysis.",
    "'What I Found' and 'What It Could Mean' should be brief. Spend most of the response on Today's Plan.",
    "Use direct language: 'Here's what to do today', 'Your job this week is...', 'Keep it simple'.",
    "One clear, specific action is more valuable to this person than three vague ones.",
    "Skip elaborate hedging — say what you think and move on.",
  ].join(" "),

  encouragement: [
    "COMMUNICATION STYLE: Encouragement.",
    "This person responds well to positive momentum. Acknowledge their effort and progress, even small wins.",
    "Use warm, forward-looking language: 'You're doing well', 'One step at a time', 'Let's build on what's working'.",
    "Frame the plan as something achievable and reinforcing, not corrective.",
    "Avoid language that implies they're behind or struggling, even when the evidence shows challenges.",
    "End with something that gives them something to look forward to.",
  ].join(" "),
};
