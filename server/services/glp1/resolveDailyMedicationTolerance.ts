/**
 * resolveDailyMedicationTolerance.ts
 *
 * GLP-1 / Metabolic Medication Daily Tolerance Aggregator — Phase 2
 *
 * Two observation sources (merge-by-timestamp):
 *   1. ace_daily_checkins   — free-text symptoms[], hunger/digestion scores (ACE check-in flow)
 *   2. glp1_daily_checkins  — structured severity enums from the Hub self-assessment
 *
 * Precedence rule:
 *   The source with the later submission timestamp wins for today.
 *   When source timestamps are equal, hub structured data is preferred.
 *   Raw observations from BOTH sources are preserved in the database.
 *
 * Clinical authority hierarchy:
 *   1. Provider clinical interventions (highest — providerClinicalInterventions table)
 *   2. Most recent patient structured hub check-in (glp1_daily_checkins.submitted_at)
 *   3. Most recent ACE conversational check-in (ace_daily_checkins.updatedAt)
 *   4. Previous day — history only, not active
 *
 * Governance:
 *   All escalation triggers are governed by the GLP-1 Rule Registry:
 *     Approved:       glp1_vomiting_escalate, glp1_dehydration_difficulty_escalate
 *     Pending review: glp1_cant_keep_fluids_escalate, glp1_repeated_vomiting_escalate,
 *                     glp1_severe_gi_cant_eat_escalate, glp1_worsening_trend_advisory,
 *                     glp1_severe_nausea_advisory
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
 * This service never writes to the database. Persistence of resolved tolerance
 * is handled by POST /api/glp1/daily-tolerance and POST /api/glp1/hub-checkin.
 *
 * Resolver version: 2.0
 */

import { db } from "../../db";
import { aceDailyCheckins } from "../../db/schema/ace";
import { waterLogs } from "../../../shared/schema";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import {
  type DailyMedicationTolerance,
  type NauseaLevel,
  type HydrationRisk,
  type ToleranceAppetiteLevel,
  type SymptomSeverity,
  type VomitingFrequency,
  type FluidRetention,
  type EatingTolerance,
  type SymptomTrend,
} from "../../../shared/glp1-schema";
import {
  assertRuleApproved,
  emitRuleLog,
  type RuleAppliedEntry,
  type RuleFiredEntry,
} from "./ruleRegistry";

/** Semantic version of this resolver — bump on any logic or output-shape change. */
const RESOLVER_VERSION = "2.0";

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM KEYWORD SETS (ACE check-in path — keyword matching)
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
// STRUCTURED HUB DATA TYPE — what we read from glp1_daily_checkins
// ─────────────────────────────────────────────────────────────────────────────

interface StructuredHubCheckin {
  submittedAt: Date;
  nausea: SymptomSeverity;
  constipation: SymptomSeverity;
  diarrhea: SymptomSeverity;
  reflux: SymptomSeverity;
  bloating: SymptomSeverity;
  earlyFullness: SymptomSeverity;
  foodAversions: SymptomSeverity;
  fatigue: SymptomSeverity;
  dizziness: SymptomSeverity;
  headache: SymptomSeverity;
  vomiting: VomitingFrequency;
  canKeepFluidsDown: FluidRetention;
  canEatWithoutWorsening: EatingTolerance;
  reducedUrination: boolean;
  symptomTrend: SymptomTrend;
  appetiteLevel: ToleranceAppetiteLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVATION HELPERS — ACE path
// ─────────────────────────────────────────────────────────────────────────────

function deriveAppetiteLevelFromScore(hunger: number | null): ToleranceAppetiteLevel {
  if (hunger === null) return "normal";
  if (hunger <= 2) return "suppressed";
  if (hunger <= 4) return "reduced";
  if (hunger <= 7) return "normal";
  return "increased";
}

function deriveNauseaLevelFromKeywords(
  symptoms: string[],
  digestion: number | null
): NauseaLevel {
  const hasNausea = matchesAny(symptoms, NAUSEA_KEYWORDS);
  if (!hasNausea) return "none";
  if (digestion !== null && digestion <= 2) return "severe";
  if (digestion !== null && digestion <= 4) return "moderate";
  return "mild";
}

function deriveHydrationRisk(
  hasVomiting: boolean,
  hasDiarrhea: boolean,
  waterMlLogged: number,
  canKeepFluidsDown?: FluidRetention
): HydrationRisk {
  if (canKeepFluidsDown === "no") return "severe";
  if (hasVomiting && waterMlLogged < 1000) return "severe";
  if (hasVomiting || (hasDiarrhea && waterMlLogged < 1500)) return "elevated";
  if (canKeepFluidsDown === "with_difficulty") return "elevated";
  if (hasDiarrhea || waterMlLogged < 1200) return "mild";
  return "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION ADAPTATION BUILDERS
// Produce meal/food guidance strings for nutritionAdaptations[].
// Each builder returns { adaptation, reason, evidenceRef } for display.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptationEntry {
  adaptation: string;     // what changes in the meal (e.g. "Smaller, more frequent meals")
  reason: string;         // why (e.g. "Mild nausea reported today")
  evidenceRef: string;    // source (e.g. "GLP-1 Nutrition Protocol (BMJ Gut 2023)")
  promptDirective: string; // string injected into AI prompt
}

function buildAppetiteAdaptation(level: ToleranceAppetiteLevel): AdaptationEntry | null {
  switch (level) {
    case "suppressed":
      return {
        adaptation: "Small, nutrient-dense portions only — volume reduced to match suppressed appetite",
        reason: "Suppressed appetite reported today",
        evidenceRef: "GLP-1 Nutrition Protocol (FDA Prescribing Information)",
        promptDirective: "APPETITE: SUPPRESSED — Small, nutrient-dense meals only. Prioritize protein over volume. Do not suggest large portions or high-volume meals.",
      };
    case "reduced":
      return {
        adaptation: "Modest portions — protein and slow-digest foods prioritized",
        reason: "Reduced appetite reported today",
        evidenceRef: "GLP-1 Nutrition Protocol (FDA Prescribing Information)",
        promptDirective: "APPETITE: REDUCED — Keep portions modest. Prioritize protein and slow-digest foods. Avoid bulky high-volume meals.",
      };
    case "increased":
      return {
        adaptation: "Standard GLP-1 portion guidance — monitor for overeating relative to medication goals",
        reason: "Increased appetite reported today",
        evidenceRef: "GLP-1 Nutrition Protocol (FDA Prescribing Information)",
        promptDirective: "APPETITE: INCREASED — Standard GLP-1 portion guidance applies. Monitor for overeating relative to medication goals.",
      };
    case "normal":
    default:
      return null;
  }
}

function buildNauseaAdaptation(level: NauseaLevel): AdaptationEntry | null {
  if (level === "none") return null;
  const intensityNote =
    level === "severe"   ? "extreme caution — very small portions, room-temperature or cool foods only, no strong smells" :
    level === "moderate" ? "extra caution — bland foods, smaller portions, no strong aromatics" :
                           "mild caution — bland flavors preferred, avoid heavy spices";
  return {
    adaptation: `Bland flavors, lower-fat preparation, smaller portions (${level} nausea protocol)`,
    reason: `${level.charAt(0).toUpperCase() + level.slice(1)} nausea reported today`,
    evidenceRef: "Clinical Recommendations for GLP-1 GI Management (BMJ Gut 2023, PMID 36614945)",
    promptDirective: `NAUSEA: ${level.toUpperCase()} — Favor neutral, bland flavors. Avoid strong aromatics, heavy spices, rich sauces, and overpowering smells. ${intensityNote}.`,
  };
}

function buildRefluxAdaptation(hasSeverity: boolean, severity: SymptomSeverity): AdaptationEntry | null {
  if (!hasSeverity) return null;
  return {
    adaptation: "No acidic ingredients (citrus, tomato, vinegar), no fried or fatty foods, no mint or carbonation",
    reason: `Heartburn/reflux reported today (${severity})`,
    evidenceRef: "GLP-1 GI Management Protocol (BMJ Gut 2023, PMID 36614945)",
    promptDirective: "REFLUX REPORTED — Avoid acidic ingredients (tomatoes, citrus, vinegar), fatty or fried foods, chocolate, mint, and carbonated beverages.",
  };
}

function buildGiAdaptation(
  hasDiarrhea: boolean,
  hasConstipation: boolean,
  diarrheaSeverity: SymptomSeverity,
  constipationSeverity: SymptomSeverity
): AdaptationEntry | null {
  if (!hasDiarrhea && !hasConstipation) return null;
  const flags = [
    hasDiarrhea     ? `diarrhea (${diarrheaSeverity})`     : null,
    hasConstipation ? `constipation (${constipationSeverity})` : null,
  ].filter(Boolean).join(" and ");
  const directive = hasDiarrhea && hasConstipation
    ? "GI SYMPTOMS (DIARRHEA + CONSTIPATION) — Use gentle, easy-to-digest preparations. Avoid raw cruciferous vegetables, high-insoluble-fiber foods, and heavily spiced dishes."
    : hasDiarrhea
      ? "GI SYMPTOMS (DIARRHEA) — Use gentle, easy-to-digest preparations. Avoid raw vegetables, high-fiber foods, and heavily spiced dishes. Include binding foods (bananas, plain rice, toast)."
      : "GI SYMPTOMS (CONSTIPATION) — Include gentle soluble fiber sources (cooked vegetables, oatmeal). Hydration emphasis. Avoid ultra-low-fiber preparations.";
  return {
    adaptation: hasDiarrhea ? "Gentle preparations — binding foods, avoid raw/high-fiber items" : "Gentle soluble fiber, hydration emphasis for constipation",
    reason: `${flags.charAt(0).toUpperCase() + flags.slice(1)} reported today`,
    evidenceRef: "GLP-1 GI Management Protocol (BMJ Gut 2023, PMID 36614945)",
    promptDirective: directive,
  };
}

function buildBloatingAdaptation(severity: SymptomSeverity): AdaptationEntry | null {
  if (severity === "none") return null;
  return {
    adaptation: "Low-gas foods — avoid beans, cruciferous vegetables, carbonation",
    reason: `Bloating reported today (${severity})`,
    evidenceRef: "GLP-1 GI Management Protocol (BMJ Gut 2023, PMID 36614945)",
    promptDirective: `BLOATING (${severity.toUpperCase()}) — Avoid gas-producing foods (beans, lentils, raw cruciferous vegetables, carbonated drinks). Favor cooked, soft preparations. Smaller meal volume.`,
  };
}

function buildEarlyFullnessAdaptation(severity: SymptomSeverity): AdaptationEntry | null {
  if (severity === "none") return null;
  return {
    adaptation: "Very small portions — calorie-dense, nutrient-concentrated choices to meet needs in less volume",
    reason: `Early fullness reported today (${severity})`,
    evidenceRef: "GLP-1 Nutrition Protocol (BMJ Gut 2023, PMID 36614945)",
    promptDirective: `EARLY FULLNESS (${severity.toUpperCase()}) — Serve very small portions. Prioritize calorie-dense, protein-rich foods that deliver maximum nutrition in minimal volume. Suggest eating slowly and stopping at first fullness signal.`,
  };
}

function buildFoodAversionAdaptation(severity: SymptomSeverity): AdaptationEntry | null {
  if (severity === "none") return null;
  return {
    adaptation: "Mild, familiar flavors — no adventurous or strong-tasting combinations",
    reason: `Food aversions reported today (${severity})`,
    evidenceRef: "GLP-1 GI Management Protocol (BMJ Gut 2023, PMID 36614945)",
    promptDirective: `FOOD AVERSIONS (${severity.toUpperCase()}) — Use familiar, mild, neutral flavors. Avoid unusual combinations or bold tastes. No exotic proteins or strong-flavored sauces.`,
  };
}

function buildHydrationAdaptation(risk: HydrationRisk): AdaptationEntry | null {
  if (risk === "none") return null;
  const note =
    risk === "severe"   ? "CRITICAL — hydrating ingredients essential; suggest electrolyte-containing foods" :
    risk === "elevated" ? "elevated — include hydrating ingredients; suggest fluids before and between meals" :
                          "mild — include hydrating ingredients where appropriate";
  return {
    adaptation: `Hydrating ingredients included — ${risk} hydration risk`,
    reason: risk === "severe" ? "Inability to keep fluids down or severe vomiting reported" : "GI fluid loss risk detected",
    evidenceRef: "FDA Prescribing Information — Volume Depletion Warning (§5.1/§6.1)",
    promptDirective: `HYDRATION RISK: ${risk.toUpperCase()} — ${note}. Suggest water before meals and between bites in preparation instructions.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveDailyToleranceOptions {
  userId: string;
  dateStr: string; // YYYY-MM-DD — the date to assess
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate today's behavioral check-in data into a DailyMedicationTolerance.
 *
 * Data sources checked (most recent timestamp wins):
 *   1. glp1_daily_checkins — structured hub self-assessment (severity enums)
 *   2. ace_daily_checkins — conversational ACE check-in (keyword-matched)
 *
 * This is a READ-ONLY service. It does not write to the database.
 * Persistence is handled by POST /api/glp1/daily-tolerance and POST /api/glp1/hub-checkin.
 *
 * Never throws — failures fall back to a safe neutral state so that
 * the protocol envelope never crashes due to missing check-in data.
 */
export async function resolveDailyMedicationTolerance(
  opts: ResolveDailyToleranceOptions
): Promise<DailyMedicationTolerance> {
  const { userId, dateStr } = opts;

  const rulesApplied:  RuleAppliedEntry[] = [];
  const rulesWithheld: string[] = [];

  // ── 1. Load hub structured check-in (glp1_daily_checkins) ─────────────────
  let hubCheckin: StructuredHubCheckin | null = null;
  let hubSubmittedAt: Date | null = null;

  try {
    const hubRows = await db.execute(
      drizzleSql`
        SELECT
          submitted_at,
          nausea, constipation, diarrhea, reflux,
          bloating, early_fullness, food_aversions,
          fatigue, dizziness, headache,
          vomiting,
          can_keep_fluids_down,
          can_eat_without_worsening,
          reduced_urination,
          symptom_trend,
          appetite_level
        FROM glp1_daily_checkins
        WHERE user_id = ${userId}
          AND check_in_date = ${dateStr}::date
        ORDER BY submitted_at DESC
        LIMIT 1
      `
    );

    if (hubRows.rows.length > 0) {
      const r = hubRows.rows[0] as Record<string, unknown>;
      hubSubmittedAt = r.submitted_at ? new Date(r.submitted_at as string) : null;
      hubCheckin = {
        submittedAt:             hubSubmittedAt!,
        nausea:                  (r.nausea as SymptomSeverity)             ?? "none",
        constipation:            (r.constipation as SymptomSeverity)       ?? "none",
        diarrhea:                (r.diarrhea as SymptomSeverity)           ?? "none",
        reflux:                  (r.reflux as SymptomSeverity)             ?? "none",
        bloating:                (r.bloating as SymptomSeverity)           ?? "none",
        earlyFullness:           (r.early_fullness as SymptomSeverity)     ?? "none",
        foodAversions:           (r.food_aversions as SymptomSeverity)     ?? "none",
        fatigue:                 (r.fatigue as SymptomSeverity)            ?? "none",
        dizziness:               (r.dizziness as SymptomSeverity)          ?? "none",
        headache:                (r.headache as SymptomSeverity)           ?? "none",
        vomiting:                (r.vomiting as VomitingFrequency)         ?? "none",
        canKeepFluidsDown:       (r.can_keep_fluids_down as FluidRetention) ?? "yes",
        canEatWithoutWorsening:  (r.can_eat_without_worsening as EatingTolerance) ?? "yes",
        reducedUrination:        Boolean(r.reduced_urination),
        symptomTrend:            (r.symptom_trend as SymptomTrend)         ?? "na",
        appetiteLevel:           (r.appetite_level as ToleranceAppetiteLevel) ?? "normal",
      };
    }
  } catch (err) {
    console.warn(
      "[resolveDailyMedicationTolerance] Failed to load hub check-in — skipping:",
      err
    );
  }

  // ── 2. Load ACE conversational check-in ───────────────────────────────────
  let aceSymptoms: string[] = [];
  let aceHunger: number | null = null;
  let aceDigestion: number | null = null;
  let aceUpdatedAt: Date | null = null;

  try {
    const aceRows = await db
      .select({
        symptoms:  aceDailyCheckins.symptoms,
        hunger:    aceDailyCheckins.hunger,
        digestion: aceDailyCheckins.digestion,
        updatedAt: aceDailyCheckins.updatedAt,
      })
      .from(aceDailyCheckins)
      .where(
        and(
          eq(aceDailyCheckins.userId, userId),
          eq(aceDailyCheckins.date, dateStr)
        )
      )
      .limit(1);

    if (aceRows.length > 0) {
      aceSymptoms  = aceRows[0].symptoms  ?? [];
      aceHunger    = aceRows[0].hunger    != null ? Number(aceRows[0].hunger)    : null;
      aceDigestion = aceRows[0].digestion != null ? Number(aceRows[0].digestion) : null;
      aceUpdatedAt = aceRows[0].updatedAt ?? null;
    }
  } catch (err) {
    console.warn(
      "[resolveDailyMedicationTolerance] Failed to load ACE check-in — using empty symptoms:",
      err
    );
  }

  // ── 3. Merge-by-timestamp: pick most recent source ────────────────────────
  //
  //  Hub structured data is preferred when:
  //    a) Only hub data exists today, OR
  //    b) Hub submitted_at >= ACE updated_at (hub is same time or newer)
  //
  //  ACE data is used when:
  //    a) Only ACE data exists today, OR
  //    b) ACE updated_at > hub submitted_at (user did an ACE check-in more recently)

  const useHub = hubCheckin !== null && (
    aceUpdatedAt === null ||
    (hubSubmittedAt !== null && hubSubmittedAt >= aceUpdatedAt)
  );
  const dataSource: "hub" | "ace" | "none" =
    useHub ? "hub" : (aceSymptoms.length > 0 || aceHunger !== null) ? "ace" : "none";

  // ── 4. Load water intake ───────────────────────────────────────────────────
  let waterMlLogged = 0;
  try {
    const waterRows = await db
      .select({ total: drizzleSql<number>`COALESCE(SUM(${waterLogs.amountMl}), 0)` })
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

  // ── 5. Derive directional flags ────────────────────────────────────────────

  let nauseaLevel: NauseaLevel;
  let hasVomiting: boolean;
  let hasDiarrhea: boolean;
  let hasConstipation: boolean;
  let hasReflux: boolean;
  let appetiteLevel: ToleranceAppetiteLevel;
  let canKeepFluidsDown: FluidRetention = "yes";
  let vomitingFrequency: VomitingFrequency = "none";
  let symptomTrend: SymptomTrend = "na";

  let diarrheaSeverity: SymptomSeverity = "none";
  let constipationSeverity: SymptomSeverity = "none";
  let refluxSeverity: SymptomSeverity = "none";
  let bloatingSeverity: SymptomSeverity = "none";
  let earlyFullnessSeverity: SymptomSeverity = "none";
  let foodAversionSeverity: SymptomSeverity = "none";
  let canEatWithoutWorsening: EatingTolerance = "yes";

  if (useHub && hubCheckin) {
    // ── Hub path: use pre-classified severity directly ─────────────────────
    nauseaLevel           = hubCheckin.nausea;
    hasVomiting           = hubCheckin.vomiting !== "none";
    vomitingFrequency     = hubCheckin.vomiting;
    hasDiarrhea           = hubCheckin.diarrhea !== "none";
    hasConstipation       = hubCheckin.constipation !== "none";
    hasReflux             = hubCheckin.reflux !== "none";
    appetiteLevel         = hubCheckin.appetiteLevel;
    canKeepFluidsDown     = hubCheckin.canKeepFluidsDown;
    canEatWithoutWorsening = hubCheckin.canEatWithoutWorsening;
    symptomTrend          = hubCheckin.symptomTrend;

    diarrheaSeverity      = hubCheckin.diarrhea;
    constipationSeverity  = hubCheckin.constipation;
    refluxSeverity        = hubCheckin.reflux;
    bloatingSeverity      = hubCheckin.bloating;
    earlyFullnessSeverity = hubCheckin.earlyFullness;
    foodAversionSeverity  = hubCheckin.foodAversions;
  } else {
    // ── ACE path: keyword matching (existing behavior) ─────────────────────
    nauseaLevel     = deriveNauseaLevelFromKeywords(aceSymptoms, aceDigestion);
    hasVomiting     = matchesAny(aceSymptoms, VOMITING_KEYWORDS);
    hasDiarrhea     = matchesAny(aceSymptoms, DIARRHEA_KEYWORDS);
    hasConstipation = matchesAny(aceSymptoms, CONSTIPATION_KEYWORDS);
    hasReflux       = matchesAny(aceSymptoms, REFLUX_KEYWORDS);
    appetiteLevel   = deriveAppetiteLevelFromScore(aceHunger);

    // For ACE path, derive basic severity from boolean presence
    if (hasDiarrhea)     diarrheaSeverity     = "mild";
    if (hasConstipation) constipationSeverity = "mild";
    if (hasReflux)       refluxSeverity       = "mild";
  }

  const hydrationRisk = deriveHydrationRisk(hasVomiting, hasDiarrhea, waterMlLogged, canKeepFluidsDown);

  // ── 6. Build nutrition adaptations ────────────────────────────────────────
  const adaptationEntries: AdaptationEntry[] = [
    buildAppetiteAdaptation(appetiteLevel),
    buildNauseaAdaptation(nauseaLevel),
    buildRefluxAdaptation(hasReflux, refluxSeverity),
    buildGiAdaptation(hasDiarrhea, hasConstipation, diarrheaSeverity, constipationSeverity),
    buildBloatingAdaptation(bloatingSeverity),
    buildEarlyFullnessAdaptation(earlyFullnessSeverity),
    buildFoodAversionAdaptation(foodAversionSeverity),
    buildHydrationAdaptation(hydrationRisk),
  ].filter((e): e is AdaptationEntry => e !== null);

  const nutritionAdaptations = adaptationEntries.map(e => e.promptDirective);

  // ── 7. Safety escalations — registry-governed only ────────────────────────
  const safetyEscalations: string[] = [];
  let shouldEscalate   = false;
  let escalationReason: string | null = null;

  const addEscalation = (reason: string, msg: string) => {
    safetyEscalations.push(msg);
    shouldEscalate = true;
    escalationReason = escalationReason ? `${escalationReason} ${reason}` : reason;
  };

  // APPROVED: glp1_vomiting_escalate — any vomiting
  if (hasVomiting) {
    const rule = assertRuleApproved("glp1_vomiting_escalate");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Vomiting reported. Contact your prescribing provider before your next meal.",
        "⚠️ SAFETY — Vomiting reported today. Please contact your prescribing provider " +
        "before your next meal. Do not generate a meal plan that encourages eating normally " +
        "before the user contacts their provider."
      );
    }
  }

  // APPROVED: glp1_dehydration_difficulty_escalate — severe hydration risk
  if (hydrationRisk === "severe") {
    const rule = assertRuleApproved("glp1_dehydration_difficulty_escalate");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Severe hydration difficulty also detected — seek medical attention.",
        "⚠️ SAFETY — Severe hydration difficulty detected (vomiting + critically low water intake). " +
        "The user should seek medical attention. Do not suggest food or drink intake as the primary " +
        "intervention — direct the user to their provider or emergency care if symptoms are severe."
      );
    }
  }

  // PENDING REVIEW: glp1_cant_keep_fluids_escalate
  if (useHub && canKeepFluidsDown === "no") {
    const rule = assertRuleApproved("glp1_cant_keep_fluids_escalate");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Unable to keep fluids down — contact provider urgently.",
        "⚠️ SAFETY — Patient reports inability to keep fluids down. " +
        "Contact your healthcare provider urgently. Dehydration risk is elevated."
      );
    } else {
      rulesWithheld.push("glp1_cant_keep_fluids_escalate");
    }
  }

  // PENDING REVIEW: glp1_repeated_vomiting_escalate
  if (vomitingFrequency === "multiple" || vomitingFrequency === "cant_keep_fluids") {
    const rule = assertRuleApproved("glp1_repeated_vomiting_escalate");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Repeated vomiting reported.",
        "⚠️ SAFETY — Repeated vomiting reported today. " +
        "Contact your healthcare provider or urgent care. Risk of dehydration and kidney injury."
      );
    } else {
      rulesWithheld.push("glp1_repeated_vomiting_escalate");
    }
  }

  // PENDING REVIEW: glp1_severe_gi_cant_eat_escalate
  if (useHub && hubCheckin && canEatWithoutWorsening === "no") {
    const hasSevere = [
      hubCheckin.nausea, hubCheckin.diarrhea, hubCheckin.constipation,
      hubCheckin.reflux, hubCheckin.bloating,
    ].some(s => s === "severe");
    if (hasSevere) {
      const rule = assertRuleApproved("glp1_severe_gi_cant_eat_escalate");
      if (rule) {
        rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
          evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
        addEscalation(
          "Severe symptoms preventing eating — contact provider.",
          "⚠️ SAFETY — Severe GI symptoms are preventing normal eating. " +
          "Contact your healthcare provider for evaluation."
        );
      } else {
        rulesWithheld.push("glp1_severe_gi_cant_eat_escalate");
      }
    }
  }

  // PENDING REVIEW: glp1_worsening_trend_advisory
  if (useHub && symptomTrend === "worsening") {
    const rule = assertRuleApproved("glp1_worsening_trend_advisory");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Worsening symptoms trend reported.",
        "⚠️ ADVISORY — Symptoms reported as worsening today. " +
        "If symptoms do not improve, contact your healthcare provider."
      );
    } else {
      rulesWithheld.push("glp1_worsening_trend_advisory");
    }
  }

  // PENDING REVIEW: glp1_severe_nausea_advisory
  if (nauseaLevel === "severe" && !shouldEscalate) {
    const rule = assertRuleApproved("glp1_severe_nausea_advisory");
    if (rule) {
      rulesApplied.push({ ruleId: rule.ruleId, sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel, reviewStatus: "approved", version: rule.version });
      addEscalation(
        "Severe nausea reported — contact provider if persistent.",
        "⚠️ ADVISORY — Severe nausea reported today. " +
        "Contact your prescribing provider if nausea persists or prevents eating."
      );
    } else {
      rulesWithheld.push("glp1_severe_nausea_advisory");
    }
  }

  // ── 8. Audit log ──────────────────────────────────────────────────────────
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

  const rulesEvaluated = [...rulesApplied.map(r => r.ruleId), ...rulesWithheld];

  return {
    date:             dateStr,
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
    rulesApplied:   rulesApplied.map(r => r.ruleId),
    rulesWithheld,
    rulesEvaluated,
    safetyEscalations,
    nutritionAdaptations,
    // Extended fields for hub display (safely optional for backward compat)
    adaptationEntries,
    vomitingFrequency,
    symptomTrend,
    dataSource,
    canKeepFluidsDown,
  } as DailyMedicationTolerance & {
    adaptationEntries: AdaptationEntry[];
    vomitingFrequency: VomitingFrequency;
    symptomTrend: SymptomTrend;
    dataSource: "hub" | "ace" | "none";
    canKeepFluidsDown: FluidRetention;
  };
}
