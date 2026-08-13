/**
 * DailyNutritionPrescription — Server Resolver
 *
 * Produces a DailyNutritionPrescription for a given user + date by walking
 * the priority hierarchy:
 *
 *   1. Performance Hub  (training-day modifiers on top of baseline)
 *   2. User baseline    (Macro Calculator targets from DB columns)
 *   3. Fallback         (no targets set)
 *
 * Professional overrides are handled upstream by ProCare; this resolver
 * focuses on the user's own prescription.
 *
 * Pure, side-effect-free except for DB reads. Pass nowOverride for tests.
 */

import { db } from "../db";
import { users } from "../../shared/schema";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { companionProfiles } from "../db/schema/companionProfiles";
import { dailyNutritionPrescriptions } from "../db/schema/dailyNutritionPrescriptions";
import { eq, count, sql } from "drizzle-orm";
import { DEFAULT_GLP1_GUARDRAILS } from "../../shared/glp1-schema";
import {
  DailyNutritionPrescription,
  PrescriptionSource,
  TrainingDayType,
  ClinicalPrecisionStatus,
  StarchDistributionStrategy,
  buildFallbackPrescription,
  computeGramsPerRemainingMeal,
  deriveStarchMealsAllowed,
  sessionTypeToTrainingDayType,
  deriveClinicalStatus,
} from "../../shared/dailyNutritionPrescription";
import {
  WeeklyTrainingSchedule,
  PerformanceProtocolConfig,
  MacroBaseline,
  resolveTodayTargets,
  SessionType,
} from "./protocol/performanceProtocolResolver";
import { getTierForLookupKey } from "../../shared/planFeatures";
import { getExecutableRuleValue } from "./glp1/ruleRegistry";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConsumedTotals {
  starchyCarbs: number;   // grams of STARCHY carbs only (not total carbs)
  starchMealsUsed: number;
}

interface PrescriptionResolverInput {
  userId: string;
  dateISO: string;
  /** Grams of starchy carbs already consumed today (not total carbs!) */
  consumed?: ConsumedTotals;
  /** Override "now" for testing */
  nowOverride?: Date;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export async function resolveDailyNutritionPrescription(
  input: PrescriptionResolverInput,
): Promise<DailyNutritionPrescription> {
  const { userId, dateISO, consumed = { starchyCarbs: 0, starchMealsUsed: 0 } } = input;
  const nowOverride = input.nowOverride ?? new Date(dateISO + "T12:00:00Z");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return buildFallbackPrescription(dateISO);

  const rationaleCodes: string[] = [];

  // ── Baseline macros (from real DB columns only) ───────────────────────────
  const caloriesBase = user.dailyCalorieTarget ?? 0;
  const proteinBase  = user.dailyProteinTarget ?? 0;
  const carbsBase    = user.dailyCarbsTarget   ?? 0;
  const fatBase      = user.dailyFatTarget     ?? 0;
  const starchyBase  = user.dailyStarchyCarbsTarget ?? 0;
  const fibrousBase  = user.dailyFibrousCarbsTarget ?? 0;

  if (caloriesBase === 0) {
    rationaleCodes.push("fallback_no_targets");
    return buildFallbackPrescription(dateISO);
  }

  // ── Clinical precision status (conservative — verified sources only) ───────
  const tier = getTierForLookupKey(user.planLookupKey);

  const [labCountResult, companionResult] = await Promise.all([
    db.select({ count: count() }).from(clinicalLabs).where(eq(clinicalLabs.userId, userId)),
    db.select().from(companionProfiles).where(eq(companionProfiles.userId, userId)).limit(1),
  ]);

  // hasVerifiedMedications: companion profile entries — requires clinical builder workflow.
  // hasScreeningResponse: user self-reported categories in the Macro Calculator gate.
  // Only hasVerifiedMedications + hasLabs → clinical_precision_active.
  // Self-reported screening alone → clinical_precision_available (engine knows something, not enough for active).
  const hasLabs = (labCountResult[0]?.count ?? 0) > 0;
  const hasVerifiedMedications =
    Array.isArray(companionResult[0]?.medications) &&
    (companionResult[0]!.medications as string[]).length > 0;
  const selfReportedCategories = Array.isArray(user.clinicalContextCategories)
    ? (user.clinicalContextCategories as string[])
    : [];
  const hasScreeningResponse =
    user.clinicalContextResponse === "yes" && selfReportedCategories.length > 0;

  const clinicalPrecisionStatus = deriveClinicalStatus(
    tier,
    hasVerifiedMedications,
    hasLabs,
    hasScreeningResponse,
  );
  if (clinicalPrecisionStatus === "clinical_precision_active") {
    rationaleCodes.push("clinical_precision_active");
  } else if (clinicalPrecisionStatus === "clinical_information_needed") {
    rationaleCodes.push("clinical_information_needed");
  }

  // ── Starch/fibrous split baseline ─────────────────────────────────────────
  // Prefer explicit DB targets; fall back to 65/35 heuristic only when both
  // columns are zero (legacy users who set macros before the split was tracked).
  let starchyCarbsTarget = starchyBase > 0 ? starchyBase : Math.round(carbsBase * 0.65);
  let fibrousCarbsTarget = fibrousBase > 0 ? fibrousBase : Math.max(0, carbsBase - starchyCarbsTarget);

  // ── Starch meal count — read from DB, never infer from carb ratios ─────────
  // defaultStarchMealsPerDay is the user's saved preference (integer, 1-6).
  // starchPlanDefined indicates whether the user has set this preference.
  // For users with no preference saved, we default to 2 (a reasonable midpoint
  // that the user can refine). This is NOT inferred from starchy/fibrous ratios.
  const savedStarchMeals = user.defaultStarchMealsPerDay;
  const baselineStarchMeals: number =
    savedStarchMeals !== null && savedStarchMeals !== undefined
      ? savedStarchMeals
      : (user.starchPlanDefined ? 2 : 2); // default 2 until user sets preference

  // ── Distribution strategy — read from DB, never invented ─────────────────
  const validStrategies: StarchDistributionStrategy[] = ["even", "workout", "morning", "evening", "ai"];
  const savedStrategy = user.starchDistributionStrategy as StarchDistributionStrategy | null;
  const starchDistributionStrategy: StarchDistributionStrategy =
    savedStrategy && validStrategies.includes(savedStrategy) ? savedStrategy : "even";

  // ── Effective daily target variables ─────────────────────────────────────
  // Start from Macro Calculator baseline. GLP-1 and Performance overlays
  // modify these in strict priority order: GLP-1 first, then Performance.
  let source: PrescriptionSource = "user_default";
  let caloriesTarget = caloriesBase;
  let proteinTarget  = proteinBase;
  let carbsTarget    = carbsBase;
  let fatTarget      = fatBase;
  let trainingDayType: TrainingDayType = null;
  let resolvedSessionType: SessionType | null = null;
  let isZeroStarchDay = false;

  // ── GLP-1 Clinical Overlay ─────────────────────────────────────────────────
  // Applied BEFORE Performance so Performance modifiers operate on the
  // GLP-1-adjusted baseline, never on the raw Macro Calculator values.
  // Design rule: Performance must not bypass GLP-1 clinical constraints.
  const specialtyConditions = Array.isArray(user.specialtyConditions)
    ? (user.specialtyConditions as string[]) : [];
  const isGLP1Active =
    specialtyConditions.includes("glp1") ||
    (Array.isArray(user.medicalConditions) &&
      (user.medicalConditions as string[]).some((c) => c === "glp1" || c === "glp-1"));

  let glp1DailyProteinFloor: number | null = null;
  let glp1DailyFatCeiling: number | null = null;

  if (isGLP1Active) {
    let guardrails = DEFAULT_GLP1_GUARDRAILS;
    try {
      const glp1Result = await db.execute(
        sql`SELECT guardrails FROM glp1_profile WHERE user_id = ${userId} LIMIT 1`
      );
      const glp1Row = glp1Result.rows?.[0] as { guardrails?: unknown } | undefined;
      if (glp1Row?.guardrails && typeof glp1Row.guardrails === "object") {
        guardrails = glp1Row.guardrails as typeof DEFAULT_GLP1_GUARDRAILS;
      }
    } catch {
      // Use defaults on any DB error
    }

    const mealsPerDay = guardrails.mealsPerDay ?? 4;
    const proteinMinG = guardrails.proteinMinG ?? 25;
    const fatMaxG     = guardrails.fatMaxG     ?? 15;

    // Infer treatment phase (mirrors logic in resolveGLP1MealTargets.ts)
    const treatmentPhase =
      proteinMinG >= 40 ? "muscle_preserve"
      : fatMaxG <= 10   ? "intro"
      : "maintenance";

    // Daily calorie adjustment based on treatment phase.
    // Phase multipliers are registered in the clinical rule registry.
    // pending_review rules are fail-closed: getExecutableRuleValue returns the
    // fallback (1.0) when the rule has not yet been approved by an RD/physician,
    // meaning no calorie adjustment is applied until the rule is promoted.
    const phaseMultiplier =
      treatmentPhase === "intro"
        ? getExecutableRuleValue("glp1_intro_phase_calorie_multiplier", 1.0).value
        : treatmentPhase === "muscle_preserve"
        ? getExecutableRuleValue("glp1_muscle_preserve_calorie_multiplier", 1.0).value
        : 1.0;
    caloriesTarget = Math.round(caloriesTarget * phaseMultiplier);

    // Daily protein floor and fat ceiling (per-meal limit × meals per day)
    glp1DailyProteinFloor = proteinMinG * mealsPerDay;
    glp1DailyFatCeiling   = fatMaxG * mealsPerDay;
    proteinTarget = Math.max(proteinTarget, glp1DailyProteinFloor);
    fatTarget     = Math.min(fatTarget,     glp1DailyFatCeiling);

    // Recompute carbs for caloric integrity, then re-split starchy/fibrous
    const remainingCals = caloriesTarget - proteinTarget * 4 - fatTarget * 9;
    carbsTarget = Math.max(0, Math.round(remainingCals / 4));
    const carbRatio = carbsBase > 0 ? carbsTarget / carbsBase : 0;
    starchyCarbsTarget = Math.round(starchyCarbsTarget * carbRatio);
    fibrousCarbsTarget = Math.max(0, carbsTarget - starchyCarbsTarget);

    source = "clinical";
    rationaleCodes.push("glp1_daily_overlay_active");
    if (treatmentPhase !== "maintenance") rationaleCodes.push(`glp1_phase_${treatmentPhase}`);
  }

  // ── Performance Hub layer ─────────────────────────────────────────────────
  const weeklySchedule = user.weeklyTrainingSchedule as WeeklyTrainingSchedule | null;
  const perfConfig     = user.performanceProtocolConfig as PerformanceProtocolConfig | null;

  if (weeklySchedule && perfConfig && user.performanceModeEnabled) {
    try {
      const baseline: MacroBaseline = {
        // Use GLP-1-adjusted values as the starting point. When GLP-1 is not
        // active, caloriesTarget === caloriesBase so behaviour is unchanged.
        calories:      caloriesTarget,
        proteinG:      proteinTarget,
        carbsG:        carbsTarget,
        fatG:          fatTarget,
        starchyCarbsG: starchyCarbsTarget,
        fibrousCarbsG: fibrousCarbsTarget,
      };

      const resolved = resolveTodayTargets(weeklySchedule, perfConfig, baseline, nowOverride);
      caloriesTarget     = resolved.calories;
      proteinTarget      = resolved.proteinG;
      carbsTarget        = resolved.carbsG;
      fatTarget          = resolved.fatG;
      starchyCarbsTarget = resolved.starchyCarbsG;
      fibrousCarbsTarget = resolved.fibrousCarbsG;
      source             = "performance";
      resolvedSessionType = resolved.sessionType;
      trainingDayType    = sessionTypeToTrainingDayType(resolved.sessionType);

      rationaleCodes.push("performance_modifier_active");
      if (trainingDayType === "rest") {
        isZeroStarchDay = true;
        rationaleCodes.push("zero_starch_rest_day");
      }
    } catch {
      rationaleCodes.push("performance_resolver_error_fallback");
    }
  }

  // ── GLP-1 Re-enforcement after Performance ────────────────────────────────
  // Performance modifiers apply to the GLP-1-adjusted baseline, but we
  // explicitly re-enforce floors/ceilings so Performance can never silently
  // push protein below the clinical floor or fat above the clinical ceiling.
  // After clamping protein/fat we rebalance carbs (and the starchy/fibrous
  // split) so P+C+F calories still sum to caloriesTarget.
  if (isGLP1Active) {
    const proteinBefore = proteinTarget;
    const fatBefore     = fatTarget;

    if (glp1DailyProteinFloor !== null) {
      proteinTarget = Math.max(proteinTarget, glp1DailyProteinFloor);
    }
    if (glp1DailyFatCeiling !== null) {
      fatTarget = Math.min(fatTarget, glp1DailyFatCeiling);
    }

    // If either clamp actually changed a value, rebalance carbs so macros
    // still sum to the calorie target (avoids P+C+F mismatch).
    if (proteinTarget !== proteinBefore || fatTarget !== fatBefore) {
      const remainingCals = caloriesTarget - proteinTarget * 4 - fatTarget * 9;
      const prevCarbsTarget = carbsTarget;
      carbsTarget = Math.max(0, Math.round(remainingCals / 4));
      // Preserve the starchy/fibrous ratio from before re-enforcement.
      const carbRatio = prevCarbsTarget > 0 ? carbsTarget / prevCarbsTarget : 0;
      starchyCarbsTarget = Math.round(starchyCarbsTarget * carbRatio);
      fibrousCarbsTarget = Math.max(0, carbsTarget - starchyCarbsTarget);
    }

    if (source === "performance") {
      rationaleCodes.push("glp1_limits_enforced_post_performance");
    }
  }

  // ── Starch meal count for this day ────────────────────────────────────────
  // Performance protocol overrides baseline (rest=0, heavy=3, etc.).
  // When no performance protocol is active, use the user's saved preference.
  const starchMealsAllowed = trainingDayType !== null
    ? deriveStarchMealsAllowed(trainingDayType, undefined, isZeroStarchDay)
    : baselineStarchMeals;

  const starchMealsUsed      = consumed.starchMealsUsed;
  const starchMealsRemaining = Math.max(0, starchMealsAllowed - starchMealsUsed);
  // consumed.starchyCarbs must be STARCHY carbs only — not total carbs
  const starchyCarbsConsumed  = consumed.starchyCarbs;
  const starchyCarbsRemaining = Math.max(0, starchyCarbsTarget - starchyCarbsConsumed);
  const gramsPerRemainingStarchMeal = computeGramsPerRemainingMeal(
    starchyCarbsRemaining,
    starchMealsRemaining,
  );

  if (isZeroStarchDay) rationaleCodes.push("zero_starch_day");
  if (source === "user_default") rationaleCodes.push("user_default_targets");

  // ── Persist resolved prescription (fire-and-forget) ───────────────────────
  // Map internal source names to the DB's source vocabulary.
  // Each distinct source must be stored distinctly so mid-day-change detection
  // in nutritionStateService can compare stored vs. current without false positives.
  // Re-widen to the full PrescriptionSource union so the "professional_override"
  // branch compiles even though the current resolver paths only assign
  // "user_default", "clinical", and "performance". The branch is preserved
  // for when ProCare overrides are wired in.
  const srcKey = source as PrescriptionSource;
  const dbSource =
    srcKey === "performance"          ? "performance_overlay" :
    srcKey === "clinical"             ? "clinical"            :
    srcKey === "professional_override"? "procare"             :
    "macro_calculator";
  const rationaleSig = rationaleCodes.join(",");

  // Snapshot the user's meal-plan preferences at resolve time so every builder
  // reads from one place. The upsert runs unconditionally (no setWhere) because
  // meal-plan config changes (mealsPerDay, starchMealsPerDay, starchDistribution)
  // must always refresh the snapshot even when the macro rationale hasn't changed.
  // The write is fire-and-forget so the slight extra DB traffic is acceptable.
  const snapshotMealsPerDay       = user.macroMealsPerDay ?? 4;
  const snapshotStarchMealsPerDay = baselineStarchMeals;

  db.insert(dailyNutritionPrescriptions)
    .values({
      userId,
      date: dateISO,
      targetCalories:    String(caloriesTarget),
      targetProtein:     String(proteinTarget),
      targetTotalCarbs:  String(carbsTarget),
      targetStarchyCarbs: String(starchyCarbsTarget),
      targetFibrousCarbs: String(fibrousCarbsTarget),
      targetFat:         String(fatTarget),
      source:            dbSource,
      sourceVersion:     rationaleSig,
      performanceDayType: trainingDayType ?? null,
      mealsPerDay:       snapshotMealsPerDay,
      starchMealsPerDay: snapshotStarchMealsPerDay,
      starchDistributionStrategy: starchDistributionStrategy,
      updatedAt:         new Date(),
    })
    .onConflictDoUpdate({
      target: [dailyNutritionPrescriptions.userId, dailyNutritionPrescriptions.date],
      set: {
        targetCalories:    String(caloriesTarget),
        targetProtein:     String(proteinTarget),
        targetTotalCarbs:  String(carbsTarget),
        targetStarchyCarbs: String(starchyCarbsTarget),
        targetFibrousCarbs: String(fibrousCarbsTarget),
        targetFat:         String(fatTarget),
        source:            dbSource,
        sourceVersion:     rationaleSig,
        performanceDayType: trainingDayType ?? null,
        mealsPerDay:       snapshotMealsPerDay,
        starchMealsPerDay: snapshotStarchMealsPerDay,
        starchDistributionStrategy: starchDistributionStrategy,
        updatedAt:         new Date(),
      },
      // No setWhere guard — snapshot columns (mealsPerDay, starchMealsPerDay,
      // starchDistributionStrategy) must always be refreshed so a mid-day
      // preference change takes effect immediately on the same date.
    })
    .catch((err: unknown) => {
      console.error("[prescriptionResolver] upsert failed:", err);
    });

  return {
    date: dateISO,
    source,
    caloriesTarget,
    proteinTarget,
    carbsTarget,
    fatTarget,
    starchyCarbsTarget,
    fibrousCarbsTarget,
    starchMealsAllowed,
    starchMealsUsed,
    starchMealsRemaining,
    starchyCarbsConsumed,
    starchyCarbsRemaining,
    gramsPerRemainingStarchMeal,
    starchDistributionStrategy,
    isZeroStarchDay,
    trainingDayType,
    clinicalPrecisionStatus,
    rationaleCodes,
  };
}
