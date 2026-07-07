/**
 * buildAcePromptBlock.ts
 *
 * Builds the ADAPTIVE COACHING CONTEXT prompt block for AI builders.
 *
 * CONTRACT:
 * - Returns null if no check-in exists today → caller omits block entirely (no-op)
 * - Returns a structured 3-section text block, hard-capped at 1200 characters
 * - NEVER touches: macros, medical rules, allergies, dietary identity, Protocol Envelope
 * - Block is always injected AFTER all protocol/medical/behavioral blocks in the prompt
 *
 * The block contains:
 *   Today's Coaching Context  — signals reported in today's check-in
 *   Today's Priorities        — from the top-scored intervention's strategies
 *   Things To Avoid           — from the top-scored intervention's avoid list
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { computeTopInterventions } from "./aceDecisionEngine";
import type { AceDailyCheckin, CoachingProfile, CoachingIntervention } from "../../db/schema/ace";

const MAX_CHARS = 1200;

// ─── Signal label map ─────────────────────────────────────────────────────────

type CheckinRow = Record<string, unknown>;

function num(row: CheckinRow, field: string): number {
  const v = row[field];
  return typeof v === "number" ? v : 3;
}

const SIGNAL_LABELS: Array<{ test: (c: CheckinRow) => boolean; label: string }> = [
  { test: (c) => num(c, "stress") >= 4,             label: "High stress" },
  { test: (c) => num(c, "energy") <= 2,             label: "Low energy" },
  { test: (c) => num(c, "sleep") <= 2,              label: "Below-average sleep" },
  { test: (c) => num(c, "cravings") >= 4,           label: "Strong cravings" },
  { test: (c) => num(c, "mood") <= 2,               label: "Low mood" },
  { test: (c) => num(c, "motivation") <= 2,         label: "Low motivation" },
  { test: (c) => num(c, "emotional_eating_risk") >= 4, label: "Elevated emotional eating risk" },
  { test: (c) => num(c, "digestion") <= 2,          label: "Digestive discomfort" },
  { test: (c) => num(c, "soreness") >= 4,           label: "Elevated muscle soreness" },
  { test: (c) => num(c, "hunger") === 1,            label: "Very low appetite" },
  { test: (c) => c["schedule"] === "travel",        label: "Travel-day schedule" },
  { test: (c) => c["schedule"] === "busy",          label: "High-demand day schedule" },
];

// ─── Balanced fallback (no intervention scored) ───────────────────────────────

const BALANCED_BLOCK = {
  context: ["Balanced signals today — energy, mood, stress, sleep, and cravings are all within normal range."],
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
  signalLabels: string[],
  priorities: string[],
  avoidances: string[],
): string {
  const DISCLAIMER =
    "Adaptive Coaching Context exists to improve adherence. " +
    "It does not replace medical, dietary, macro, allergy, religious, cultural, or protocol instructions. " +
    "When conflict exists, always follow the higher-priority protocol instructions above.";

  const contextLines = signalLabels.length > 0
    ? signalLabels.map((l) => `• ${l}`).join("\n")
    : "• Balanced signals — no elevated flags today";

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

  const signalLabels = SIGNAL_LABELS
    .filter((s) => s.test(checkinRow))
    .map((s) => s.label)
    .slice(0, 4);

  // Scenario 5 rule: no signals + no intervention = silent day.
  // Return null so nothing is injected into the AI prompt.
  // The dashboard card handles the "all green" state on its own.
  if (signalLabels.length === 0 && top === null) {
    return null;
  }

  const priorities = top ? top.strategies  : BALANCED_BLOCK.priorities;
  const avoidances = top ? top.avoid       : BALANCED_BLOCK.avoid;

  const block = formatBlock(signalLabels, priorities, avoidances);

  const meta: AcePromptMeta = {
    interventionKey: top?.key ?? null,
    signalCount: signalLabels.length,
    charCount: block.length,
  };

  return { block, meta };
}
