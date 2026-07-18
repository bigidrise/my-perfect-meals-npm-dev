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
import { users } from "../db/schema";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { companionProfiles } from "../db/schema/companionProfiles";
import { eq, count } from "drizzle-orm";
import {
  DailyNutritionPrescription,
  PrescriptionSource,
  TrainingDayType,
  ClinicalPrecisionStatus,
  buildFallbackPrescription,
  computeGramsPerRemainingMeal,
  deriveStarchMealsAllowed,
  sessionTypeToTrainingDayType,
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
  starchyCarbs: number;
  starchMealsUsed: number;
}

interface PrescriptionResolverInput {
  userId: string;
  dateISO: string;
  /** Grams of starchy carbs already consumed today (for adaptive tracking) */
  consumed?: ConsumedTotals;
  /** Override "now" for testing */
  nowOverride?: Date;
}

// ── Clinical precision status ─────────────────────────────────────────────────

function deriveClinicalStatus(
  tier: string,
  hasMedications: boolean,
  hasLabs: boolean,
): ClinicalPrecisionStatus {
  const isClinicalTier = tier === "ultimate";

  if (!isClinicalTier) {
    return "standard_personalization";
  }

  // Clinical tier
  if (hasMedications && hasLabs) return "clinical_precision_active";
  if (hasMedications || hasLabs) return "clinical_precision_available";
  return "clinical_precision_available";
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

  // ── Baseline macros (from real DB columns) ────────────────────────────────
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

  // ── Clinical precision status ─────────────────────────────────────────────
  const tier = getTierForLookupKey(user.planLookupKey);

  // Check for lab results and medications in parallel
  const [labCountResult, companionResult] = await Promise.all([
    db.select({ count: count() }).from(clinicalLabs).where(eq(clinicalLabs.userId, userId)),
    db.select().from(companionProfiles).where(eq(companionProfiles.userId, userId)).limit(1),
  ]);

  const hasLabs = (labCountResult[0]?.count ?? 0) > 0;
  const hasMedications =
    Array.isArray(companionResult[0]?.medications) &&
    (companionResult[0]!.medications as string[]).length > 0;

  const clinicalPrecisionStatus = deriveClinicalStatus(tier, hasMedications, hasLabs);
  if (clinicalPrecisionStatus === "clinical_precision_active") {
    rationaleCodes.push("clinical_precision_active");
  }

  // ── Starch/fibrous split baseline ─────────────────────────────────────────
  // Derive from stored columns or fall back to 65/35 heuristic
  let starchyCarbsTarget = starchyBase > 0 ? starchyBase : Math.round(carbsBase * 0.65);
  let fibrousCarbsTarget = fibrousBase > 0 ? fibrousBase : Math.max(0, carbsBase - starchyCarbsTarget);

  // Infer baseline starch strategy from starch plan settings
  // "flex" when starchyCarbsTarget indicates > 1 meal worth of carbs.
  // Default to "one" (conservative).
  const baselineStarchStrategy: "one" | "flex" =
    user.starchPlanDefined ? "flex" : "one";

  // ── Performance Hub layer ─────────────────────────────────────────────────
  let source: PrescriptionSource = "user_default";
  let caloriesTarget = caloriesBase;
  let proteinTarget  = proteinBase;
  let carbsTarget    = carbsBase;
  let fatTarget      = fatBase;
  let trainingDayType: TrainingDayType = null;
  let resolvedSessionType: SessionType | null = null;

  const weeklySchedule = user.weeklyTrainingSchedule as WeeklyTrainingSchedule | null;
  const perfConfig     = user.performanceProtocolConfig as PerformanceProtocolConfig | null;

  if (weeklySchedule && perfConfig) {
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
      if (resolved.sessionType === "off" || resolved.sessionType === "recovery") {
        rationaleCodes.push("zero_starch_rest_day");
      }
    } catch {
      rationaleCodes.push("performance_resolver_error_fallback");
    }
  }

  // ── Starch meal count ─────────────────────────────────────────────────────
  const isZeroStarchDay = trainingDayType === "rest";
  const starchMealsAllowed = deriveStarchMealsAllowed(
    trainingDayType,
    baselineStarchStrategy,
    isZeroStarchDay,
  );

  const starchMealsUsed      = consumed.starchMealsUsed;
  const starchMealsRemaining = Math.max(0, starchMealsAllowed - starchMealsUsed);
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
    starchDistributionStrategy: "even",
    isZeroStarchDay,
    trainingDayType,
    clinicalPrecisionStatus,
    rationaleCodes,
  };
}
