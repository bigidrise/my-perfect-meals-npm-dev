
import { z } from "zod";

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
 * rulesFired[] lists every registry rule that contributed to this assessment.
 * Use these IDs for audit trails and MACRO_AUDIT structured logging.
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
   * Triggers a provider-contact directive in all generator prompts.
   * Governed exclusively by:
   *   - glp1_vomiting_escalate
   *   - glp1_dehydration_difficulty_escalate
   */
  shouldEscalate: boolean;

  /** Human-readable escalation reason for display and prompt injection.
   *  Null when shouldEscalate is false. */
  escalationReason: string | null;

  /** Rule registry IDs that contributed to this tolerance assessment. */
  rulesFired: string[];
};
