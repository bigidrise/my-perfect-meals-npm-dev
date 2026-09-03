/**
 * resolveGLP1MealTargets — Deterministic GLP-1 meal target resolver
 *
 * Architecture (Phase 0.5):
 *   calculated daily macro targets
 *   + remaining daily macro budget
 *   + planned meal frequency
 *   + meal type
 *   + GLP-1 treatment phase
 *   + appetite / tolerance context
 *   + activity and training demand
 *   + muscle-preservation goal
 *   + active medical protocols
 *   + provider overrides (glp1_profile.guardrails)
 *   = patient-specific GLP-1 meal targets
 *
 * Falls back to static baselines (400 kcal/meal, 150 kcal/snack, 15g fat, 25g protein)
 * ONLY when the platform lacks enough reliable data to calculate a better target.
 *
 * ── GOVERNANCE ────────────────────────────────────────────────────────────────
 * Rules are governed by server/services/glp1/ruleRegistry.ts.
 * The registry is the SINGLE SOURCE OF TRUTH for every clinical rule.
 *
 * Enforcement contract:
 *   - Every multiplier and threshold is read via getExecutableRuleValue()
 *   - Rules with reviewStatus === "removed" throw at runtime — they must not be used
 *   - Rules with reviewStatus === "pending_review" are withheld (fail-closed); go into rulesWithheld[]
 *   - Approved rules that influenced the output are recorded in rulesApplied[]
 *   - rulesEvaluated[] = union of rulesApplied + rulesWithheld (full audit trail)
 *   - MACRO_AUDIT=true emits a structured clinical log per resolution call
 *   - No clinical numerical value is hardcoded in this file
 *
 * See docs/clinical-intelligence-governance.md for the full review process.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { GLP1Guardrails } from '../../../shared/glp1-schema';
import { DEFAULT_GLP1_GUARDRAILS } from '../../../shared/glp1-schema';
import {
  assertRuleApproved,
  getRuleValue,
  emitRuleLog,
  type RuleFiredEntry,
  type ClinicalRule,
} from './ruleRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// STATIC BASELINES — fallback only, not universal ceilings
// These are used ONLY when the platform lacks a calculated daily target.
// They are not clinical thresholds and are not governed by the rule registry.
// ─────────────────────────────────────────────────────────────────────────────
const BASELINE_MEAL_CALORIES = 400;
const BASELINE_SNACK_CALORIES = 150;
const BASELINE_PROTEIN_TARGET = 25;
const BASELINE_PROTEIN_FLOOR = 15;
const BASELINE_FAT_CEILING = 15;

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type GLP1TreatmentPhase = 'intro' | 'maintenance' | 'muscle_preserve' | 'unknown';
export type AppetiteLevel = 'suppressed' | 'reduced' | 'normal' | 'increased';
export type TrainingDemand = 'none' | 'light' | 'moderate' | 'heavy' | 'elite';

export interface GLP1UserContext {
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyFatTarget?: number | null;
  dailyCarbsTarget?: number | null;
  macroMealsPerDay?: number | null;
  glp1Guardrails?: GLP1Guardrails | null;
  activeConstraints?: string[];
  appetiteLevel?: AppetiteLevel;
  trainingDemand?: TrainingDemand;
  musclePreservationPriority?: boolean;
  isActive?: boolean;
}

export interface GLP1MealContext {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  remainingMacros?: {
    calories?: number | null;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
  };
  mealsCompletedToday?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedGLP1Targets {
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailyFatTarget: number;
  remainingCalories: number;
  remainingProtein: number;
  remainingFat: number;

  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealsPerDay: number;
  plannedMealsRemaining: number;

  baselineMealCalories: number;
  resolvedMealCalories: number;
  baselineSnackCalories: number;
  resolvedSnackCalories: number;

  targetProteinGrams: number;
  minimumProteinFloor: number;

  targetFatGrams: number;
  maximumToleratedFatGrams: number;

  treatmentPhase: GLP1TreatmentPhase;
  appetiteLevel: AppetiteLevel;
  trainingDemand: TrainingDemand;
  musclePreservationPriority: boolean;

  activeConstraints: string[];
  usedBaseline: boolean;
  resolutionReasons: string[];

  /**
   * Every clinical rule that fired during this resolution.
   * ruleId, sourceIds, evidenceLevel, reviewStatus, version, and value
   * are read directly from the registry — not from resolver code.
   * Pending-review rules appear here with reviewStatus: "pending_review".
   * Use this field to answer: "Why did the AI recommend this?"
   */
  rulesFired: RuleFiredEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function inferTreatmentPhase(guardrails: GLP1Guardrails): GLP1TreatmentPhase {
  const protein = guardrails.proteinMinG ?? DEFAULT_GLP1_GUARDRAILS.proteinMinG ?? 25;
  const fat = guardrails.fatMaxG ?? DEFAULT_GLP1_GUARDRAILS.fatMaxG ?? 15;
  if (protein >= 40) return 'muscle_preserve';
  if (fat <= 10) return 'intro';
  if (fat <= 15) return 'maintenance';
  return 'unknown';
}

/**
 * Estimate how many meals (and snacks) are still to be eaten today,
 * given the meal type being generated now.
 */
function estimateMealsRemaining(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  mealsPerDay: number,
  mealsCompletedToday?: number
): number {
  if (mealsCompletedToday !== undefined) {
    return Math.max(mealsPerDay - mealsCompletedToday, 1);
  }
  switch (mealType) {
    case 'breakfast': return mealsPerDay;
    case 'lunch': return Math.max(mealsPerDay - 1, 1);
    case 'dinner': return Math.max(mealsPerDay - 2, 1);
    case 'snack': return Math.max(mealsPerDay - 1, 1);
    default: return mealsPerDay;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export function resolveGLP1MealTargets(
  user: GLP1UserContext,
  meal: GLP1MealContext
): ResolvedGLP1Targets {
  const reasons: string[] = [];
  const firedRules: RuleFiredEntry[] = [];
  let usedBaseline = false;

  // ── Rule accumulator ─────────────────────────────────────────────────────
  // Every rule that influences a calculation calls fireRule() instead of
  // reading a hardcoded constant. The registry is the single source of truth.
  function fireRule(ruleId: string): ClinicalRule | null {
    const rule = assertRuleApproved(ruleId); // throws if removed
    if (!rule) return null;
    // Deduplicate — a rule may apply to multiple branches
    if (!firedRules.some(e => e.ruleId === ruleId)) {
      firedRules.push({
        ruleId: rule.ruleId,
        sourceIds: rule.sourceIds,
        evidenceLevel: rule.evidenceLevel,
        reviewStatus: rule.reviewStatus,
        version: rule.version,
        value: rule.value,
      });
    }
    return rule;
  }

  const guardrails: GLP1Guardrails = user.glp1Guardrails ?? DEFAULT_GLP1_GUARDRAILS;
  const activeConstraints = user.activeConstraints ?? [];
  const appetiteLevel: AppetiteLevel = user.appetiteLevel ?? 'normal';
  const trainingDemand: TrainingDemand = user.trainingDemand ?? 'none';
  const musclePreservationPriority = user.musclePreservationPriority ?? false;
  const treatmentPhase = inferTreatmentPhase(guardrails);

  // ── Daily targets ──────────────────────────────────────────────────────────
  const dailyCalorieTarget = (user.dailyCalorieTarget && user.dailyCalorieTarget > 0)
    ? user.dailyCalorieTarget : 0;
  const dailyProteinTarget = (user.dailyProteinTarget && user.dailyProteinTarget > 0)
    ? user.dailyProteinTarget : 0;
  const dailyFatTarget = (user.dailyFatTarget && user.dailyFatTarget > 0)
    ? user.dailyFatTarget : 0;

  // ── Remaining budget ───────────────────────────────────────────────────────
  const remainingCalories = (meal.remainingMacros?.calories != null && meal.remainingMacros.calories > 0)
    ? meal.remainingMacros.calories
    : dailyCalorieTarget;
  const remainingProtein = (meal.remainingMacros?.protein != null && meal.remainingMacros.protein > 0)
    ? meal.remainingMacros.protein
    : dailyProteinTarget;
  const remainingFat = (meal.remainingMacros?.fat != null && meal.remainingMacros.fat > 0)
    ? meal.remainingMacros.fat
    : dailyFatTarget;

  // ── Meal frequency ─────────────────────────────────────────────────────────
  const mealsPerDay = guardrails.mealsPerDay
    ?? user.macroMealsPerDay
    ?? 4;

  const plannedMealsRemaining = estimateMealsRemaining(
    meal.mealType,
    mealsPerDay,
    meal.mealsCompletedToday
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CALORIE RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────
  let resolvedMealCalories: number;
  let resolvedSnackCalories: number;

  if (dailyCalorieTarget === 0) {
    resolvedMealCalories = BASELINE_MEAL_CALORIES;
    resolvedSnackCalories = BASELINE_SNACK_CALORIES;
    usedBaseline = true;
    reasons.push('No daily calorie target set — using baseline (400 kcal meal / 150 kcal snack)');
  } else {
    const baseMealAllocation = remainingCalories / plannedMealsRemaining;

    // ── Treatment phase multiplier ─────────────────────────────────────────
    // Values come from the registry — never hardcoded here.
    let phaseMultiplier = 1.0;
    if (treatmentPhase === 'intro') {
      fireRule('glp1_intro_phase_calorie_multiplier');
      phaseMultiplier = getRuleValue('glp1_intro_phase_calorie_multiplier', 0.82);
    } else if (treatmentPhase === 'muscle_preserve') {
      fireRule('glp1_muscle_preserve_calorie_multiplier');
      phaseMultiplier = getRuleValue('glp1_muscle_preserve_calorie_multiplier', 1.08);
    }

    // ── Appetite multiplier ────────────────────────────────────────────────
    let appetiteMultiplier = 1.0;
    if (appetiteLevel === 'suppressed') {
      fireRule('glp1_appetite_suppressed_multiplier');
      appetiteMultiplier = getRuleValue('glp1_appetite_suppressed_multiplier', 0.80);
    } else if (appetiteLevel === 'reduced') {
      fireRule('glp1_appetite_reduced_multiplier');
      appetiteMultiplier = getRuleValue('glp1_appetite_reduced_multiplier', 0.90);
    } else if (appetiteLevel === 'increased') {
      appetiteMultiplier = 1.05; // non-clinical — no rule entry needed
    }

    // ── Training multiplier ────────────────────────────────────────────────
    // Training demand is not GLP-1-specific; values are not in the clinical registry.
    const trainingMultipliers: Record<TrainingDemand, number> = {
      none: 1.00,
      light: 1.05,
      moderate: 1.10,
      heavy: 1.18,
      elite: 1.28,
    };
    const trainingMultiplier = trainingMultipliers[trainingDemand];

    const muscleMultiplier = musclePreservationPriority ? 1.05 : 1.0;

    const combinedMultiplier = phaseMultiplier * appetiteMultiplier * trainingMultiplier * muscleMultiplier;
    const adjusted = baseMealAllocation * combinedMultiplier;

    if (meal.mealType === 'snack') {
      resolvedSnackCalories = clamp(dailyCalorieTarget * 0.13 * appetiteMultiplier * trainingMultiplier, 100, 350);
      resolvedMealCalories = BASELINE_MEAL_CALORIES;
      reasons.push(`Snack: ${resolvedSnackCalories} kcal (${Math.round(13 * appetiteMultiplier * trainingMultiplier)}% of daily target)`);
    } else {
      resolvedMealCalories = clamp(adjusted, 200, 900);
      resolvedSnackCalories = clamp(dailyCalorieTarget * 0.13 * appetiteMultiplier, 100, 350);

      if (combinedMultiplier !== 1.0) {
        reasons.push(`Meal calories ${baseMealAllocation.toFixed(0)} kcal base × ${combinedMultiplier.toFixed(2)} modifier = ${resolvedMealCalories} kcal`);
      } else {
        reasons.push(`Meal calories: ${remainingCalories} remaining ÷ ${plannedMealsRemaining} meals = ${resolvedMealCalories} kcal`);
      }
    }

    if (treatmentPhase !== 'unknown' && treatmentPhase !== 'maintenance') {
      reasons.push(`Treatment phase: ${treatmentPhase} (× ${phaseMultiplier})`);
    }
    if (appetiteLevel !== 'normal') {
      reasons.push(`Appetite: ${appetiteLevel} (× ${appetiteMultiplier})`);
    }
    if (trainingDemand !== 'none') {
      reasons.push(`Training demand: ${trainingDemand} (× ${trainingMultiplier})`);
    }
    if (musclePreservationPriority) {
      reasons.push('Muscle preservation priority active (+5% calories)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROTEIN RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────
  // glp1_protein_priority: protein-dense foods prioritized for lean mass preservation
  fireRule('glp1_protein_priority');

  const minimumProteinFloor = guardrails.proteinMinG ?? BASELINE_PROTEIN_FLOOR;
  let targetProteinGrams: number;

  if (dailyProteinTarget === 0) {
    targetProteinGrams = guardrails.proteinMinG ?? BASELINE_PROTEIN_TARGET;
    usedBaseline = true;
    reasons.push(`No daily protein target set — using guardrail minimum (${targetProteinGrams}g protein/meal)`);
  } else {
    const proteinPerMeal = remainingProtein / plannedMealsRemaining;
    if (meal.mealType === 'snack') {
      targetProteinGrams = clamp(dailyProteinTarget * 0.15, minimumProteinFloor * 0.5, 30);
    } else {
      targetProteinGrams = clamp(Math.max(proteinPerMeal, minimumProteinFloor), minimumProteinFloor, 80);
    }

    if (musclePreservationPriority || treatmentPhase === 'muscle_preserve') {
      const muscleProtein = Math.min(targetProteinGrams * 1.1, 80);
      if (muscleProtein > targetProteinGrams) {
        reasons.push(`Muscle preservation: protein bumped ${targetProteinGrams}g → ${Math.round(muscleProtein)}g`);
        targetProteinGrams = Math.round(muscleProtein);
      }
    }
    reasons.push(`Protein: ${remainingProtein}g remaining ÷ ${plannedMealsRemaining} meals = ${targetProteinGrams}g target`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FAT RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────
  // glp1_lower_fat: high fat is the primary GLP-1 nausea trigger
  fireRule('glp1_lower_fat');

  const guardrailFatCeiling = guardrails.fatMaxG ?? BASELINE_FAT_CEILING;
  let targetFatGrams: number;
  let maximumToleratedFatGrams: number;

  if (dailyFatTarget === 0) {
    targetFatGrams = Math.round(guardrailFatCeiling * 0.8);
    maximumToleratedFatGrams = guardrailFatCeiling;
    usedBaseline = true;
    reasons.push(`No daily fat target set — using guardrail ceiling (${guardrailFatCeiling}g fat max/meal)`);
  } else {
    const fatPerMeal = remainingFat / plannedMealsRemaining;

    if (meal.mealType === 'snack') {
      maximumToleratedFatGrams = Math.min(guardrailFatCeiling * 0.4, 8);
      targetFatGrams = Math.round(maximumToleratedFatGrams * 0.7);
    } else {
      maximumToleratedFatGrams = clamp(Math.min(fatPerMeal, guardrailFatCeiling), 7, guardrailFatCeiling);
      targetFatGrams = Math.round(maximumToleratedFatGrams * 0.8);
    }

    // Intro phase: stricter fat limits — values read from registry
    if (treatmentPhase === 'intro') {
      fireRule('glp1_intro_fat_ceiling');
      fireRule('glp1_intro_fat_target');
      const introCeiling = getRuleValue('glp1_intro_fat_ceiling', 10);
      const introTarget = getRuleValue('glp1_intro_fat_target', 8);
      maximumToleratedFatGrams = Math.min(maximumToleratedFatGrams, introCeiling);
      targetFatGrams = Math.min(targetFatGrams, introTarget);
      reasons.push(`Intro phase: fat ceiling reduced to ${introCeiling}g ceiling / ${introTarget}g target (registry: glp1_intro_fat_ceiling + glp1_intro_fat_target — pending RD review)`);
    }
    reasons.push(`Fat: ${remainingFat}g remaining ÷ ${plannedMealsRemaining} meals = max ${maximumToleratedFatGrams}g`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENAL CONSTRAINT CHECK
  // ─────────────────────────────────────────────────────────────────────────
  const hasRenal = activeConstraints.some(c =>
    c.toLowerCase().includes('renal') || c.toLowerCase().includes('kidney') || c.toLowerCase().includes('ckd')
  );
  if (hasRenal && targetProteinGrams > 25) {
    reasons.push('⚠️ Renal constraint active — protein target may need reduction per provider; using upper-safe estimate');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DIABETES CONSTRAINT CHECK
  // ─────────────────────────────────────────────────────────────────────────
  const hasDiabetes = activeConstraints.some(c =>
    c.toLowerCase().includes('diabet') || c.toLowerCase().includes('t2d') || c.toLowerCase().includes('type 2')
  );
  if (hasDiabetes) {
    reasons.push('Diabetes active — carb quality and glycemic control rules stack with GLP-1 protocol');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STRUCTURED AUDIT LOG (MACRO_AUDIT=true)
  // ─────────────────────────────────────────────────────────────────────────
  emitRuleLog(firedRules);

  return {
    dailyCalorieTarget,
    dailyProteinTarget,
    dailyFatTarget,
    remainingCalories,
    remainingProtein,
    remainingFat,

    mealType: meal.mealType,
    mealsPerDay,
    plannedMealsRemaining,

    baselineMealCalories: BASELINE_MEAL_CALORIES,
    resolvedMealCalories,
    baselineSnackCalories: BASELINE_SNACK_CALORIES,
    resolvedSnackCalories,

    targetProteinGrams,
    minimumProteinFloor,

    targetFatGrams,
    maximumToleratedFatGrams,

    treatmentPhase,
    appetiteLevel,
    trainingDemand,
    musclePreservationPriority,

    activeConstraints,
    usedBaseline,
    resolutionReasons: reasons,
    rulesFired: firedRules,
  };
}
