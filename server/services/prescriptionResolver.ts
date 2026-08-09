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
import { eq, count } from "drizzle-orm";
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

  // ── Performance Hub layer ─────────────────────────────────────────────────
  let source: PrescriptionSource = "user_default";
  let caloriesTarget = caloriesBase;
  let proteinTarget  = proteinBase;
  let carbsTarget    = carbsBase;
  let fatTarget      = fatBase;
  let trainingDayType: TrainingDayType = null;
  let resolvedSessionType: SessionType | null = null;
  let isZeroStarchDay = false;

  const weeklySchedule = user.weeklyTrainingSchedule as WeeklyTrainingSchedule | null;
  const perfConfig     = user.performanceProtocolConfig as PerformanceProtocolConfig | null;

  if (weeklySchedule && perfConfig && user.performanceModeEnabled) {
    try {
      const baseline: MacroBaseline = {
        calories:      caloriesBase,
        proteinG:      proteinBase,
        carbsG:        carbsBase,
        fatG:          fatBase,
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
