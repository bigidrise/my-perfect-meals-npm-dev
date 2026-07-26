
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM SEVERITY TYPES — used by the Hub self-assessment and resolver
// ─────────────────────────────────────────────────────────────────────────────

export type SymptomSeverity = "none" | "mild" | "moderate" | "severe";
export type VomitingFrequency = "none" | "once" | "multiple" | "cant_keep_fluids";
export type FluidRetention = "yes" | "with_difficulty" | "no";
export type EatingTolerance = "yes" | "partially" | "no";
export type SymptomTrend = "improving" | "same" | "worsening" | "na";
export type DoseRelation = "yes" | "no" | "unsure";
export type CareTeamNotify = "none" | "coach" | "physician" | "both";

/**
 * Medication class for Phase 2 medication-profile readiness.
 * Rules are not yet activated per medication class — stored for future use.
 */
export type MedicationClass =
  | "semaglutide"      // Ozempic, Wegovy (weekly SC injection)
  | "tirzepatide"      // Mounjaro, Zepbound (GIP+GLP-1 dual agonist)
  | "oral_glp1"        // Rybelsus (oral semaglutide — different timing/hydration rules)
  | "research"         // Retatrutide and other investigational agents
  | "other"            // Compounded, liraglutide, unlisted
  | null;              // Not specified

export const SymptomSeverityZ = z.enum(["none", "mild", "moderate", "severe"]);
export const VomitingFrequencyZ = z.enum(["none", "once", "multiple", "cant_keep_fluids"]);
export const FluidRetentionZ = z.enum(["yes", "with_difficulty", "no"]);
export const EatingToleranceZ = z.enum(["yes", "partially", "no"]);
export const SymptomTrendZ = z.enum(["improving", "same", "worsening", "na"]);
export const DoseRelationZ = z.enum(["yes", "no", "unsure"]);
export const CareTeamNotifyZ = z.enum(["none", "coach", "physician", "both"]);
export const MedicationClassZ = z.enum([
  "semaglutide",
  "tirzepatide",
  "oral_glp1",
  "research",
  "other",
]).nullable();

/**
 * Validated payload for POST /api/glp1/hub-checkin.
 * All clinical logic lives in the resolver — the route only validates and persists this.
 */
export const HubCheckinPayloadZ = z.object({
  nausea:               SymptomSeverityZ.default("none"),
  constipation:         SymptomSeverityZ.default("none"),
  diarrhea:             SymptomSeverityZ.default("none"),
  reflux:               SymptomSeverityZ.default("none"),
  bloating:             SymptomSeverityZ.default("none"),
  earlyFullness:        SymptomSeverityZ.default("none"),
  foodAversions:        SymptomSeverityZ.default("none"),
  fatigue:              SymptomSeverityZ.default("none"),
  dizziness:            SymptomSeverityZ.default("none"),
  headache:             SymptomSeverityZ.default("none"),
  vomiting:             VomitingFrequencyZ.default("none"),
  canKeepFluidsDown:    FluidRetentionZ.default("yes"),
  canEatWithoutWorsening: EatingToleranceZ.default("yes"),
  reducedUrination:     z.boolean().default(false),
  symptomTrend:         SymptomTrendZ.default("na"),
  symptomsAfterDose:    DoseRelationZ.default("unsure"),
  appetiteLevel:        z.enum(["suppressed", "reduced", "normal", "increased"]).default("normal"),
  medicationName:       z.string().nullable().optional(),
  medicationClass:      MedicationClassZ.optional(),
  notifyCareTeam:       CareTeamNotifyZ.default("none"),
});

export type HubCheckinPayload = z.infer<typeof HubCheckinPayloadZ>;

/**
 * Structured hub checkin returned from the API — payload + resolved tolerance.
 * The client uses this to display the status card and adaptation list.
 * tolerance is typed as unknown here to avoid a circular dependency;
 * use DailyMedicationTolerance from the same file at call sites.
 */
export type HubCheckinResponse = {
  checkin: {
    id: string;
    submittedAt: string;
    checkInDate: string;
  } & HubCheckinPayload;
  tolerance: unknown;
};

export type GLP1Guardrails = {
  maxMealVolumeMl?: number;
  proteinMinG?: number;
  fatMaxG?: number;
  fiberMinG?: number;
  hydrationMinMl?: number;
  mealsPerDay?: number;
  slowDigestOnly?: boolean;
  limitCarbonation?: boolean;
  limitAlcohol?: boolean;
};

export const GLP1GuardrailsZ = z.object({
  maxMealVolumeMl: z.number().int().min(100).max(600).optional(),
  proteinMinG: z.number().int().min(10).max(60).optional(),
  fatMaxG: z.number().int().min(5).max(50).optional(),
  fiberMinG: z.number().int().min(10).max(50).optional(),
  hydrationMinMl: z.number().int().min(1000).max(4000).optional(),
  mealsPerDay: z.number().int().min(3).max(6).optional(),
  slowDigestOnly: z.boolean().optional(),
  limitCarbonation: z.boolean().optional(),
  limitAlcohol: z.boolean().optional(),
});

export const DEFAULT_GLP1_GUARDRAILS: GLP1Guardrails = {
  maxMealVolumeMl: 300,
  proteinMinG: 25,
  fatMaxG: 15,
  fiberMinG: 28,
  hydrationMinMl: 2000,
  mealsPerDay: 4,
  slowDigestOnly: true,
  limitCarbonation: true,
  limitAlcohol: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// DAILY MEDICATION TOLERANCE — Phase 1
//
// Directional flags only. No invented calorie or macro numbers.
// Derived by resolveDailyMedicationTolerance() from ace_daily_checkins +
// water_logs. Used by all 4 GLP-1-aware surfaces:
//   GLP-1 Builder, Snack Creator, Weekly Board, Coach's Corner.
//
// All escalation triggers are registry-governed (ruleRegistry.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** Self-reported nausea severity — derived from ace_daily_checkins.symptoms +
 *  digestion quality score. */
export type NauseaLevel = "none" | "mild" | "moderate" | "severe";

/** Hydration risk tier — derived from vomiting/diarrhea flags + water_logs
 *  total. Governed by glp1_dehydration_difficulty_escalate registry rule. */
export type HydrationRisk = "none" | "mild" | "elevated" | "severe";

/** Real-time appetite level — derived from ace_daily_checkins.hunger (1-10).
 *  Feeds into loadGLP1ResolvedTargets() as the appetiteLevel input. */
export type ToleranceAppetiteLevel =
  | "suppressed"
  | "reduced"
  | "normal"
  | "increased";

/**
 * Resolved daily tolerance state for a GLP-1 / metabolic medication user.
 *
 * Produced by resolveDailyMedicationTolerance() — a read-only aggregator
 * that never invents numbers. Injected into the protocol envelope as
 * glp1DailyTolerance and surfaced to all GLP-1-aware generators.
 *
 * Rule audit collections:
 *   rulesApplied[]   — approved rules that influenced this assessment
 *   rulesWithheld[]  — pending_review rules blocked from production (fail-closed)
 *   rulesEvaluated[] — union of applied + withheld (complete audit trail)
 *
 * Directive collections (mutually exclusive semantics):
 *   safetyEscalations[]    — provider-contact and seek-care directives; must not
 *                            be reframed as nutrition preferences by any generator
 *   nutritionAdaptations[] — meal/food modification directives (smaller portions,
 *                            bland flavors, hydrating ingredients, etc.)
 */
export type DailyMedicationTolerance = {
  /** YYYY-MM-DD — the date this tolerance state was resolved for. */
  date: string;

  /** Real-time appetite level — drives appetiteLevel input in resolver. */
  appetiteLevel: ToleranceAppetiteLevel;

  /** Nausea presence and severity — drives flavor/aroma guidance. */
  nauseaLevel: NauseaLevel;

  /** True when vomiting keyword detected in symptoms[]. Always escalates. */
  hasVomiting: boolean;

  /** Hydration risk tier — derives from vomiting, diarrhea, and water intake. */
  hydrationRisk: HydrationRisk;

  /** Total water logged today in mL (sum of water_logs.amount_ml). */
  waterMlLogged: number;

  /** True when reflux/heartburn/GERD keyword detected in symptoms[]. */
  hasReflux: boolean;

  /** True when diarrhea/loose stool keyword detected in symptoms[]. */
  hasDiarrhea: boolean;

  /** True when constipation/bloating keyword detected in symptoms[]. */
  hasConstipation: boolean;

  /**
   * True when a registry-governed escalation rule fires.
   * Governed exclusively by:
   *   - glp1_vomiting_escalate (approved, FDA §5.1/§6.1)
   *   - glp1_dehydration_difficulty_escalate (approved, FDA §5.1/§6.1)
   */
  shouldEscalate: boolean;

  /** Human-readable escalation reason for display and prompt injection.
   *  Null when shouldEscalate is false. */
  escalationReason: string | null;

  /**
   * Registry IDs of APPROVED rules that were evaluated and applied.
   * These rules directly influenced the output of this assessment.
   * Use for audit trails, MACRO_AUDIT logging, and provider dashboards.
   */
  rulesApplied: string[];

  /**
   * Registry IDs of PENDING_REVIEW rules that were evaluated but withheld.
   * These rules did NOT affect any recommendation (fail-closed governance).
   * Their fallback values were used instead of candidate values.
   * Use to track clinical review backlog and surface to RD review queue.
   */
  rulesWithheld: string[];

  /**
   * Union of rulesApplied + rulesWithheld.
   * Every rule that was evaluated during this resolution, regardless of outcome.
   * Use for completeness audits and change-impact analysis.
   */
  rulesEvaluated: string[];

  /**
   * Provider-contact and seek-care directives produced by escalation rules.
   *
   * ⚠️ These are SAFETY DIRECTIVES, not nutrition preferences.
   * Generators and coaches must surface these as urgent patient safety guidance,
   * never reframe them as meal modifications or dietary recommendations.
   *
   * Examples:
   *   "Vomiting reported. Contact your prescribing provider before your next meal."
   *   "Severe hydration difficulty. Seek medical attention."
   */
  safetyEscalations: string[];

  /**
   * Meal and food modification directives derived from current GI symptoms.
   *
   * These are dietary adaptation recommendations, separate from escalations.
   * Safe for injection into generator prompts as meal-planning constraints.
   *
   * Examples:
   *   "NAUSEA: MODERATE — Favor neutral, bland flavors. Avoid strong aromatics."
   *   "HYDRATION RISK: ELEVATED — Include hydrating ingredients where appropriate."
   *   "APPETITE: SUPPRESSED — Small, nutrient-dense meals only."
   */
  nutritionAdaptations: string[];
};
