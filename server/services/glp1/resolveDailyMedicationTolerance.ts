/**
 * resolveDailyMedicationTolerance.ts
 *
 * GLP-1 / Metabolic Medication Daily Tolerance Aggregator — Phase 1
 *
 * Reads today's behavioral check-in data from ace_daily_checkins + water_logs
 * and derives DIRECTIONAL FLAGS ONLY. This service emits no invented calorie
 * or macro numbers — it is a classification layer, not a calculation layer.
 *
 * Governance:
 *   All escalation triggers are governed by the GLP-1 Rule Registry:
 *     - glp1_vomiting_escalate            (approved, FDA §5.1 / §6.1)
 *     - glp1_dehydration_difficulty_escalate (approved, FDA §5.1 / §6.1)
 *
 *   Pending-review rules NEVER influence this output (fail-closed):
 *     - rulesWithheld[] tracks blocked rules for audit
 *     - rulesApplied[] tracks rules that contributed to the assessment
 *     - rulesEvaluated[] = union of applied + withheld
 *
 *   safetyEscalations[] and nutritionAdaptations[] are populated as
 *   SEPARATE collections so downstream consumers (Coach's Corner, provider
 *   dashboards, generators) can distinguish safety directives from meal guidance.
 *
 * Data sources (read-only):
 *   - ace_daily_checkins.symptoms[]  — self-reported GI symptoms for today
 *   - ace_daily_checkins.hunger      — self-reported hunger score (1-10)
 *   - ace_daily_checkins.digestion   — self-reported digestion quality (1-10)
 *   - water_logs                     — summed daily water intake in mL
 *
 * This service never writes to the database. Persistence of resolved tolerance
 * is handled by POST /api/glp1/daily-tolerance (routes/glp1.ts).
 *
 * Resolver version: 1.0
 */

import { db } from "../../db";
import { aceDailyCheckins } from "../../db/schema/ace";
import { waterLogs } from "../../../shared/schema";
import { eq, and, sql as drizzleSql } from "drizzle-orm";
import {
  type DailyMedicationTolerance,
  type NauseaLevel,
  type HydrationRisk,
  type ToleranceAppetiteLevel,
} from "../../../shared/glp1-schema";
import {
  assertRuleApproved,
  emitRuleLog,
  type RuleAppliedEntry,
  type RuleFiredEntry,
} from "./ruleRegistry";

/** Semantic version of this resolver — bump on any logic or output-shape change. */
const RESOLVER_VERSION = "1.0";

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
// NUTRITION ADAPTATION BUILDERS
// Produce meal/food guidance strings for nutritionAdaptations[].
// These are safe to inject into generator prompts as dietary constraints.
// ─────────────────────────────────────────────────────────────────────────────

function buildAppetiteAdaptation(level: ToleranceAppetiteLevel): string | null {
  switch (level) {
    case "suppressed":
      return "APPETITE: SUPPRESSED — Small, nutrient-dense meals only. Prioritize protein over volume. Do not suggest large portions or high-volume meals.";
    case "reduced":
      return "APPETITE: REDUCED — Keep portions modest. Prioritize protein and slow-digest foods. Avoid bulky high-volume meals.";
    case "increased":
      return "APPETITE: INCREASED — Standard GLP-1 portion guidance applies. Monitor for overeating relative to medication goals.";
    case "normal":
    default:
      return null; // Normal appetite requires no directive
  }
}

function buildNauseaAdaptation(level: NauseaLevel): string | null {
  if (level === "none") return null;
  return (
    `NAUSEA: ${level.toUpperCase()} — Favor neutral, bland flavors. ` +
    `Avoid strong aromatics, heavy spices, rich sauces, and overpowering smells.`
  );
}

function buildRefluxAdaptation(hasReflux: boolean): string | null {
  if (!hasReflux) return null;
  return (
    "REFLUX REPORTED — Avoid acidic ingredients (tomatoes, citrus, vinegar), " +
    "fatty or fried foods, chocolate, mint, and carbonated beverages."
  );
}

function buildGiAdaptation(hasDiarrhea: boolean, hasConstipation: boolean): string | null {
  if (!hasDiarrhea && !hasConstipation) return null;
  const flags = [
    hasDiarrhea    ? "diarrhea"    : null,
    hasConstipation ? "constipation" : null,
  ].filter(Boolean).join(" and ");
  return (
    `GI SYMPTOMS (${flags.toUpperCase()}) — Use gentle, easy-to-digest preparations. ` +
    `Avoid raw cruciferous vegetables, high-insoluble-fiber foods, and heavily spiced dishes.`
  );
}

function buildHydrationAdaptation(risk: HydrationRisk): string | null {
  if (risk === "none") return null;
  return (
    `HYDRATION RISK: ${risk.toUpperCase()} — Include hydrating ingredients where appropriate. ` +
    `Suggest water before meals and between bites in any preparation instructions.`
  );
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
 * This is a READ-ONLY service. It does not write to the database.
 * Persistence is handled by POST /api/glp1/daily-tolerance.
 *
 * Never throws — failures fall back to a safe neutral state so that
 * the protocol envelope never crashes due to missing check-in data.
 *
 * Rule governance:
 *   - Approved escalation rules → populate safetyEscalations[] + rulesApplied[]
 *   - Pending-review rules → withheld (fail-closed); populate rulesWithheld[]
 *   - No pending rule may enter rulesApplied[] or affect any output value
 */
export async function resolveDailyMedicationTolerance(
  opts: ResolveDailyToleranceOptions
): Promise<DailyMedicationTolerance> {
  const { userId, dateStr } = opts;

  // Separate audit collections
  const rulesApplied:  RuleAppliedEntry[] = [];  // approved, contributed to output
  const rulesWithheld: string[] = [];             // pending_review, blocked (fail-closed)

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

  // ── 4. Build nutrition adaptations (dietary guidance, not safety) ─────────
  const nutritionAdaptations: string[] = [
    buildAppetiteAdaptation(appetiteLevel),
    buildNauseaAdaptation(nauseaLevel),
    buildRefluxAdaptation(hasReflux),
    buildGiAdaptation(hasDiarrhea, hasConstipation),
    buildHydrationAdaptation(hydrationRisk),
  ].filter((s): s is string => s !== null);

  // ── 5. Safety escalations — registry-governed only ───────────────────────
  // ⚠️ These are SAFETY DIRECTIVES, not meal modifications.
  // They go into safetyEscalations[], NOT nutritionAdaptations[].
  // Any downstream consumer (generator, coach) must surface them as urgent
  // patient safety guidance, never reframe as a dietary preference.

  const safetyEscalations: string[] = [];
  let shouldEscalate   = false;
  let escalationReason: string | null = null;

  // glp1_vomiting_escalate — any vomiting → provider contact before next meal
  if (hasVomiting) {
    const rule = assertRuleApproved("glp1_vomiting_escalate");
    if (rule) {
      // rule is approved — record in applied
      rulesApplied.push({
        ruleId:        rule.ruleId,
        sourceIds:     rule.sourceIds,
        evidenceLevel: rule.evidenceLevel,
        reviewStatus:  "approved",
        version:       rule.version,
      });
      shouldEscalate = true;
      const msg =
        "⚠️ SAFETY — Vomiting reported today. Please contact your prescribing provider " +
        "before your next meal. Do not generate a meal plan that encourages eating normally " +
        "before the user contacts their provider.";
      safetyEscalations.push(msg);
      escalationReason = "Vomiting reported. Please contact your prescribing provider before your next meal.";
    }
    // If assertRuleApproved returns null (rule is pending_review or missing),
    // it already logs a warning internally. We do not escalate (fail-closed).
  }

  // glp1_dehydration_difficulty_escalate — vomiting + very low hydration
  if (hydrationRisk === "severe") {
    const rule = assertRuleApproved("glp1_dehydration_difficulty_escalate");
    if (rule) {
      rulesApplied.push({
        ruleId:        rule.ruleId,
        sourceIds:     rule.sourceIds,
        evidenceLevel: rule.evidenceLevel,
        reviewStatus:  "approved",
        version:       rule.version,
      });
      shouldEscalate = true;
      const msg =
        "⚠️ SAFETY — Severe hydration difficulty detected (vomiting + critically low water intake). " +
        "The user should seek medical attention. Do not suggest food or drink intake as the primary " +
        "intervention — direct the user to their provider or emergency care if symptoms are severe.";
      safetyEscalations.push(msg);
      escalationReason = escalationReason
        ? escalationReason + " Severe hydration difficulty also detected — seek medical attention."
        : "Severe hydration difficulty detected. Seek immediate medical attention.";
    }
  }

  // ── 6. Emit structured audit log (gated on MACRO_AUDIT=true) ─────────────
  // Emit in the legacy format for emitRuleLog compatibility
  if (rulesApplied.length > 0) {
    const legacyEntries: RuleFiredEntry[] = rulesApplied.map(r => ({
      ruleId:        r.ruleId,
      sourceIds:     r.sourceIds,
      evidenceLevel: r.evidenceLevel,
      reviewStatus:  r.reviewStatus,
      version:       r.version,
    }));
    emitRuleLog(legacyEntries);
  }

  if (rulesWithheld.length > 0 && process.env.MACRO_AUDIT === "true") {
    console.log(
      `[GLP-1 Tolerance] ⚠️  ${rulesWithheld.length} pending_review rule(s) withheld: ${rulesWithheld.join(", ")}. ` +
      `These rules did NOT affect any recommendation.`
    );
  }

  // rulesEvaluated = applied IDs + withheld IDs
  const rulesEvaluated = [
    ...rulesApplied.map(r => r.ruleId),
    ...rulesWithheld,
  ];

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
    rulesApplied:  rulesApplied.map(r => r.ruleId),
    rulesWithheld,
    rulesEvaluated,
    safetyEscalations,
    nutritionAdaptations,
  };
}
