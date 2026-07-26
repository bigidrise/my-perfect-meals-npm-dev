/**
 * resolveDailyMedicationTolerance.ts
 *
 * GLP-1 / Metabolic Medication Daily Tolerance Aggregator — Phase 1
 *
 * Reads today's behavioral check-in data from ace_daily_checkins + water_logs
 * and derives DIRECTIONAL FLAGS ONLY. This service emits no invented calorie
 * or macro numbers — it is a classification layer, not a calculation layer.
 *
 * All escalation triggers are governed by the GLP-1 Rule Registry:
 *   - glp1_vomiting_escalate            (approved, FDA §5.1 / §6.1)
 *   - glp1_dehydration_difficulty_escalate (approved, FDA §5.1 / §6.1)
 *
 * Data sources (read-only):
 *   - ace_daily_checkins.symptoms[]  — self-reported GI symptoms for today
 *   - ace_daily_checkins.hunger      — self-reported hunger score (1-10)
 *   - ace_daily_checkins.digestion   — self-reported digestion quality (1-10)
 *   - water_logs                     — summed daily water intake in mL
 *
 * Output (DailyMedicationTolerance) is injected into the protocol envelope
 * as glp1DailyTolerance and consumed by all 4 GLP-1-aware surfaces:
 *   GLP-1 Builder, Snack Creator, Weekly Board, Coach's Corner.
 */

import { db } from "../../db";
import { aceDailyCheckins } from "../../db/schema/ace";
import { waterLogs } from "../../../shared/schema";
import { eq, and, gte, lt, sql as drizzleSql } from "drizzle-orm";
import {
  type DailyMedicationTolerance,
  type NauseaLevel,
  type HydrationRisk,
  type ToleranceAppetiteLevel,
} from "../../../shared/glp1-schema";
import {
  assertRuleApproved,
  emitRuleLog,
  type RuleFiredEntry,
} from "./ruleRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM KEYWORD SETS
// Checked via case-insensitive partial match against ace_daily_checkins.symptoms[].
// Keywords are deliberately broad to catch natural-language user entries
// ("threw up", "vomiting", "puked") without requiring exact matches.
// ─────────────────────────────────────────────────────────────────────────────

const NAUSEA_KEYWORDS = [
  "nausea", "nauseated", "nauseous", "queasy", "sick to my stomach",
  "feel sick", "feeling sick",
];
const VOMITING_KEYWORDS = [
  "vomit", "threw up", "throwing up", "puked", "puke", "vomiting",
];
const DIARRHEA_KEYWORDS = [
  "diarrhea", "loose stool", "loose bowel", "watery stool", "runny stool",
];
const CONSTIPATION_KEYWORDS = [
  "constipat", "bloat", "can't go", "cannot go", "haven't gone",
  "no bowel", "hard stool",
];
const REFLUX_KEYWORDS = [
  "reflux", "heartburn", "acid", "indigestion", "gerd", "regurgitat",
  "chest burn",
];

function matchesAny(symptoms: string[], keywords: string[]): boolean {
  return symptoms.some((s) =>
    keywords.some((k) => s.toLowerCase().includes(k))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVATION HELPERS — directional classification only, no clinical numbers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map ace_daily_checkins.hunger (1-10, higher = more hunger felt) to an
 * appetite level category. Null hunger = no check-in → assume normal.
 */
function deriveAppetiteLevel(hunger: number | null): ToleranceAppetiteLevel {
  if (hunger === null) return "normal";
  if (hunger <= 2) return "suppressed";
  if (hunger <= 4) return "reduced";
  if (hunger <= 7) return "normal";
  return "increased";
}

/**
 * Derive nausea severity from symptoms presence and digestion quality score.
 * ace_daily_checkins.digestion is 1-10 (higher = better digestion quality).
 * When nausea keywords are present, digestion score refines the severity tier.
 */
function deriveNauseaLevel(
  symptoms: string[],
  digestion: number | null
): NauseaLevel {
  const hasNausea = matchesAny(symptoms, NAUSEA_KEYWORDS);
  if (!hasNausea) return "none";
  if (digestion !== null && digestion <= 2) return "severe";
  if (digestion !== null && digestion <= 4) return "moderate";
  return "mild";
}

/**
 * Hydration risk tier:
 *   - severe:   vomiting present AND water < 1 000 mL (severe dehydration risk)
 *   - elevated: vomiting present, OR diarrhea + water < 1 500 mL
 *   - mild:     diarrhea alone, OR water < 1 200 mL
 *   - none:     no GI loss signals, adequate water
 *
 * Thresholds are conservative lower bounds only — the registry governs
 * which of these tiers triggers escalation, not the thresholds themselves.
 */
function deriveHydrationRisk(
  hasVomiting: boolean,
  hasDiarrhea: boolean,
  waterMlLogged: number
): HydrationRisk {
  if (hasVomiting && waterMlLogged < 1000) return "severe";
  if (hasVomiting || (hasDiarrhea && waterMlLogged < 1500)) return "elevated";
  if (hasDiarrhea || waterMlLogged < 1200) return "mild";
  return "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveDailyToleranceOptions {
  userId: string;
  dateStr: string; // YYYY-MM-DD — the date to assess
}

/**
 * Aggregate today's behavioral check-in data into a DailyMedicationTolerance.
 *
 * This is a read-only service. It does not write to the database.
 * Writing the resolved tolerance to glp1_profile is handled by the API layer.
 *
 * Never throws — failures fall back to a safe neutral state so that
 * the protocol envelope never crashes due to missing check-in data.
 */
export async function resolveDailyMedicationTolerance(
  opts: ResolveDailyToleranceOptions
): Promise<DailyMedicationTolerance> {
  const { userId, dateStr } = opts;
  const rulesFired: RuleFiredEntry[] = [];

  // ── 1. Load today's ACE check-in ──────────────────────────────────────────
  let symptoms: string[] = [];
  let hunger: number | null = null;
  let digestion: number | null = null;

  try {
    const rows = await db
      .select({
        symptoms:  aceDailyCheckins.symptoms,
        hunger:    aceDailyCheckins.hunger,
        digestion: aceDailyCheckins.digestion,
      })
      .from(aceDailyCheckins)
      .where(
        and(
          eq(aceDailyCheckins.userId, userId),
          eq(aceDailyCheckins.date, dateStr)
        )
      )
      .limit(1);

    if (rows.length > 0) {
      symptoms  = rows[0].symptoms  ?? [];
      hunger    = rows[0].hunger    != null ? Number(rows[0].hunger)    : null;
      digestion = rows[0].digestion != null ? Number(rows[0].digestion) : null;
    }
  } catch (err) {
    console.warn(
      "[resolveDailyMedicationTolerance] Failed to load ACE check-in — using empty symptoms:",
      err
    );
  }

  // ── 2. Load today's water intake ──────────────────────────────────────────
  // intakeTime is timestamp WITHOUT timezone — cast to date in SQL for safety.
  let waterMlLogged = 0;

  try {
    const waterRows = await db
      .select({
        total: drizzleSql<number>`COALESCE(SUM(${waterLogs.amountMl}), 0)`,
      })
      .from(waterLogs)
      .where(
        and(
          eq(waterLogs.userId, userId),
          drizzleSql`DATE(${waterLogs.intakeTime}) = ${dateStr}::date`
        )
      );

    waterMlLogged = waterRows[0] ? Number(waterRows[0].total) : 0;
  } catch (err) {
    console.warn(
      "[resolveDailyMedicationTolerance] Failed to load water logs — defaulting to 0 mL:",
      err
    );
  }

  // ── 3. Derive directional flags ───────────────────────────────────────────
  const appetiteLevel   = deriveAppetiteLevel(hunger);
  const nauseaLevel     = deriveNauseaLevel(symptoms, digestion);
  const hasVomiting     = matchesAny(symptoms, VOMITING_KEYWORDS);
  const hasDiarrhea     = matchesAny(symptoms, DIARRHEA_KEYWORDS);
  const hasConstipation = matchesAny(symptoms, CONSTIPATION_KEYWORDS);
  const hasReflux       = matchesAny(symptoms, REFLUX_KEYWORDS);
  const hydrationRisk   = deriveHydrationRisk(hasVomiting, hasDiarrhea, waterMlLogged);

  // ── 4. Escalation — registry-governed only ────────────────────────────────
  // Escalation triggers are hardcoded to their registry rule IDs. Any rule
  // not in the registry throws, preventing silent regressions on rule removal.

  let shouldEscalate   = false;
  let escalationReason: string | null = null;

  // glp1_vomiting_escalate — any vomiting → provider contact before next meal
  if (hasVomiting) {
    const rule = assertRuleApproved("glp1_vomiting_escalate");
    if (rule) {
      rulesFired.push({
        ruleId:        rule.ruleId,
        sourceIds:     rule.sourceIds,
        evidenceLevel: rule.evidenceLevel,
        reviewStatus:  rule.reviewStatus,
        version:       rule.version,
      });
      shouldEscalate   = true;
      escalationReason =
        "Vomiting reported. Please contact your prescribing provider before your next meal.";
    }
  }

  // glp1_dehydration_difficulty_escalate — vomiting + very low hydration
  if (hydrationRisk === "severe") {
    const rule = assertRuleApproved("glp1_dehydration_difficulty_escalate");
    if (rule) {
      rulesFired.push({
        ruleId:        rule.ruleId,
        sourceIds:     rule.sourceIds,
        evidenceLevel: rule.evidenceLevel,
        reviewStatus:  rule.reviewStatus,
        version:       rule.version,
      });
      shouldEscalate   = true;
      escalationReason = escalationReason
        ? escalationReason + " Severe hydration difficulty also detected — seek medical attention."
        : "Severe hydration difficulty detected. Seek immediate medical attention.";
    }
  }

  // ── 5. Emit structured audit log (gated on MACRO_AUDIT=true) ─────────────
  if (rulesFired.length > 0) {
    emitRuleLog(rulesFired);
  }

  return {
    date:            dateStr,
    appetiteLevel,
    nauseaLevel,
    hasVomiting,
    hydrationRisk,
    waterMlLogged,
    hasReflux,
    hasDiarrhea,
    hasConstipation,
    shouldEscalate,
    escalationReason,
    rulesFired: rulesFired.map((r) => r.ruleId),
  };
}
