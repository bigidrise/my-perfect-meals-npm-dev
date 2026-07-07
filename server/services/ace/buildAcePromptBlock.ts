/**
 * buildAcePromptBlock.ts
 *
 * Builds the ADAPTIVE COACHING CONTEXT prompt block for AI builders.
 *
 * CONTRACT:
 * - Returns null if no check-in exists today → caller omits block entirely (no-op)
 * - Returns null if no negative signals and no intervention scored (perfect day — stay silent)
 * - Returns a structured 3-section text block, hard-capped at 1200 characters
 * - NEVER touches: macros, medical rules, allergies, dietary identity, Protocol Envelope
 * - Block is always injected AFTER all protocol/medical/behavioral blocks in the prompt
 *
 * The block contains:
 *   Today's Coaching Context  — negative signals the user reported (challenges)
 *                               + strengths to leverage (when opposing signals present)
 *   Today's Priorities        — from the top-scored intervention's strategies
 *   Things To Avoid           — from the top-scored intervention's avoid list
 *
 * OPPOSING-SIGNAL RULE:
 *   When both negative and positive signals are detected, both are shown in context.
 *   Positive signals are purely additive — they never cancel, reduce, or override the
 *   selected intervention or any safety-relevant negative signal.
 *   Positive labels are only shown when at least one negative signal is also present.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { computeTopInterventions } from "./aceDecisionEngine";
import type { AceDailyCheckin, CoachingProfile, CoachingIntervention } from "../../db/schema/ace";

const MAX_CHARS = 1200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CheckinRow = Record<string, unknown>;

function num(row: CheckinRow, field: string): number {
  const v = row[field];
  return typeof v === "number" ? v : 3;
}

// ─── Negative signal labels (challenges) ──────────────────────────────────────
// Each one that fires becomes a bullet in "The user reported:" section.
// These drive intervention scoring in the Decision Engine.

const NEGATIVE_SIGNAL_LABELS: Array<{ test: (c: CheckinRow) => boolean; label: string }> = [
  { test: (c) => num(c, "stress") >= 4,                label: "High stress" },
  { test: (c) => num(c, "energy") <= 2,                label: "Low energy" },
  { test: (c) => num(c, "sleep") <= 2,                 label: "Below-average sleep" },
  { test: (c) => num(c, "cravings") >= 4,              label: "Strong cravings" },
  { test: (c) => num(c, "mood") <= 2,                  label: "Low mood" },
  { test: (c) => num(c, "motivation") <= 2,            label: "Low motivation" },
  { test: (c) => num(c, "emotional_eating_risk") >= 4, label: "Elevated emotional eating risk" },
  { test: (c) => num(c, "digestion") <= 2,             label: "Digestive discomfort" },
  { test: (c) => num(c, "soreness") >= 4,              label: "Elevated muscle soreness" },
  { test: (c) => num(c, "hunger") === 1,               label: "Very low appetite" },
  { test: (c) => c["schedule"] === "travel",           label: "Travel-day schedule" },
  { test: (c) => c["schedule"] === "busy",             label: "High-demand day schedule" },
];

// ─── Positive signal labels (strengths) ───────────────────────────────────────
// Only shown when at least one negative signal is also present (opposing signals).
// These provide nuance — they never override the selected intervention.

const POSITIVE_SIGNAL_LABELS: Array<{ test: (c: CheckinRow) => boolean; label: string }> = [
  { test: (c) => num(c, "energy") >= 4,      label: "High energy" },
  { test: (c) => num(c, "mood") >= 4,        label: "Great mood" },
  { test: (c) => num(c, "sleep") >= 4,       label: "Good sleep" },
  { test: (c) => num(c, "stress") <= 2,      label: "Low stress" },
  { test: (c) => num(c, "cravings") <= 2,    label: "Low cravings" },
  { test: (c) => num(c, "motivation") >= 4,  label: "High motivation" },
  { test: (c) => c["schedule"] === "rest",   label: "Rest day — lighter schedule" },
];

// ─── Balanced fallback (profile-challenge boost fired, no day-level signals) ──

const BALANCED_BLOCK = {
  priorities: [
    "Maintain current nutrition consistency",
    "Stay well hydrated throughout the day",
    "Focus on variety and quality of whole foods",
  ],
  avoid: [
    "Unnecessary changes to a working plan",
    "Skipping planned meals",
    "Overcomplicating preparation",
  ],
};

// ─── Block formatter ──────────────────────────────────────────────────────────

function formatBlock(
  negativeLabels: string[],
  positiveLabels: string[],
  priorities: string[],
  avoidances: string[],
): string {
  const DISCLAIMER =
    "Adaptive Coaching Context exists to improve adherence. " +
    "It does not replace medical, dietary, macro, allergy, religious, cultural, or protocol instructions. " +
    "When conflict exists, always follow the higher-priority protocol instructions above.";

  let contextLines: string;

  if (negativeLabels.length > 0 && positiveLabels.length > 0) {
    // Opposing signals: show both — challenges first, then strengths to leverage.
    const negLines = negativeLabels.map((l) => `• ${l}`).join("\n");
    const posLines = positiveLabels.map((l) => `• ${l}`).join("\n");
    contextLines =
      negLines +
      "\n\nStrengths to leverage:\n" +
      posLines;
  } else if (negativeLabels.length > 0) {
    contextLines = negativeLabels.map((l) => `• ${l}`).join("\n");
  } else {
    // Profile-challenge boost drove an intervention on an otherwise balanced day.
    contextLines = "• Balanced signals — no elevated flags today";
  }

  const priorityLines = priorities.slice(0, 3).map((p) => `• ${p}`).join("\n");
  const avoidLines    = avoidances.slice(0, 3).map((a) => `• ${a}`).join("\n");

  const block = [
    "ADAPTIVE COACHING CONTEXT",
    DISCLAIMER,
    "",
    "Today's Coaching Context",
    "The user reported:",
    contextLines,
    "",
    "Today's Priorities",
    priorityLines,
    "",
    "Things To Avoid",
    avoidLines,
  ].join("\n");

  if (block.length <= MAX_CHARS) return block;

  return block.slice(0, MAX_CHARS - 3) + "...";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface AcePromptMeta {
  block: string;
  interventionKey: string | null;
  signalCount: number;
  positiveSignalCount: number;
  charCount: number;
}

export async function buildAcePromptBlock(userId: string): Promise<{
  block: string;
  meta: AcePromptMeta;
} | null> {
  const today = new Date().toISOString().slice(0, 10);

  const checkinResult = await db.execute(
    sql`SELECT * FROM ace_daily_checkins WHERE user_id = ${userId} AND date = ${today} LIMIT 1`
  );
  const checkinRow = checkinResult.rows[0] as CheckinRow | undefined;

  if (!checkinRow) return null;

  const profileResult = await db.execute(
    sql`SELECT * FROM coaching_profiles WHERE user_id = ${userId} LIMIT 1`
  );
  const profile = (profileResult.rows[0] ?? null) as CoachingProfile | null;

  const ivResult = await db.execute(
    sql`SELECT * FROM coaching_interventions WHERE is_active = true`
  );
  const interventions = ivResult.rows as CoachingIntervention[];

  const checkinSignals = checkinRow as unknown as AceDailyCheckin;
  const matched = computeTopInterventions(checkinSignals, profile, interventions, 1);
  const top = matched[0] ?? null;

  // Negative signals (challenges) — cap at 4 to stay within char budget.
  const negativeLabels = NEGATIVE_SIGNAL_LABELS
    .filter((s) => s.test(checkinRow))
    .map((s) => s.label)
    .slice(0, 4);

  // Perfect day rule: no negative signals + no intervention = completely silent.
  // Dashboard card handles the "all green" display independently.
  if (negativeLabels.length === 0 && top === null) {
    return null;
  }

  // Positive signals (strengths) — only surface when opposing negative signals exist.
  // Positive labels alone never trigger a block or override an intervention.
  const positiveLabels = negativeLabels.length > 0
    ? POSITIVE_SIGNAL_LABELS
        .filter((s) => s.test(checkinRow))
        .map((s) => s.label)
        .slice(0, 3)
    : [];

  const priorities = top ? top.strategies : BALANCED_BLOCK.priorities;
  const avoidances = top ? top.avoid      : BALANCED_BLOCK.avoid;

  const block = formatBlock(negativeLabels, positiveLabels, priorities, avoidances);

  const meta: AcePromptMeta = {
    interventionKey: top?.key ?? null,
    signalCount: negativeLabels.length,
    positiveSignalCount: positiveLabels.length,
    charCount: block.length,
  };

  return { block, meta };
}
