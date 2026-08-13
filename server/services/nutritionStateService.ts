/**
 * nutritionStateService.ts
 *
 * Resolves the DailyNutritionState for a user on a given date.
 * This is the single server-side function that every consumer — the
 * /api/nutrition-state route AND the /api/meals/generate route — should
 * call instead of duplicating DB queries.
 *
 * Extracted from routes/nutritionState.ts so generation can resolve
 * the authoritative remaining budget before invoking the AI.
 */

import { db } from "../db";
import { users, macroLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { resolveDailyNutritionPrescription } from "./prescriptionResolver";
import { getUserTimezone } from "./nutritionDayService";
import { computeGramsPerRemainingMeal } from "../../shared/dailyNutritionPrescription";
import type {
  DailyNutritionState,
  MacroTotals,
  GenerationContext,
} from "../../shared/dailyNutritionPrescription";

/**
 * Resolve the full DailyNutritionState for a user on a given local date.
 * Uses the user's saved timezone to compute the correct day boundary.
 *
 * Throws if the user row is not found (callers should handle 404).
 */
export async function resolveDailyNutritionState(
  userId: string,
  dateISO: string,
): Promise<DailyNutritionState> {
  const [prescription, userRows, tz] = await Promise.all([
    resolveDailyNutritionPrescription({ userId, dateISO }),
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    getUserTimezone(userId),
  ]);

  const user = userRows[0];
  if (!user) throw new Error(`User not found: ${userId}`);

  // ── Consumed: aggregate macro_logs for this user-local date ─────────────
  const consumedRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(kcal::numeric),         0) AS calories,
      COALESCE(SUM(protein::numeric),       0) AS protein,
      COALESCE(SUM(carbs::numeric),         0) AS total_carbs,
      COALESCE(SUM(starchy_carbs::numeric), 0) AS starchy_carbs,
      COALESCE(SUM(fibrous_carbs::numeric), 0) AS fibrous_carbs,
      COALESCE(SUM(fat::numeric),           0) AS fat,
      COUNT(*) FILTER (
        WHERE starchy_carbs::numeric > 0 AND source != 'alcohol'
      )                                        AS starch_meal_count,
      COUNT(*) FILTER (
        WHERE source != 'alcohol'
      )                                        AS meal_count
    FROM macro_logs
    WHERE user_id = ${userId}
      AND (at AT TIME ZONE ${tz})::date = ${dateISO}::date
  `);

  const cr = (consumedRows.rows?.[0] ?? {}) as Record<string, unknown>;

  const consumed: MacroTotals & { starchMeals: number; mealCount: number } = {
    calories:    Number(cr.calories    ?? 0),
    protein:     Number(cr.protein     ?? 0),
    totalCarbs:  Number(cr.total_carbs ?? 0),
    starchyCarbs: Number(cr.starchy_carbs ?? 0),
    fibrousCarbs: Number(cr.fibrous_carbs ?? 0),
    fat:         Number(cr.fat         ?? 0),
    starchMeals: Number(cr.starch_meal_count ?? 0),
    mealCount:   Number(cr.meal_count  ?? 0),
  };

  // ── Planned: zeros until Stage 2 wires board reservations ───────────────
  const planned: MacroTotals & { starchMeals: number; mealCount: number } = {
    calories: 0, protein: 0, totalCarbs: 0,
    starchyCarbs: 0, fibrousCarbs: 0, fat: 0,
    starchMeals: 0, mealCount: 0,
  };

  // ── Remaining = prescription − consumed − planned (floor 0) ─────────────
  const clamp = (n: number) => Math.max(0, Math.round(n));

  const remaining = {
    calories:      clamp(prescription.caloriesTarget    - consumed.calories     - planned.calories),
    protein:       clamp(prescription.proteinTarget      - consumed.protein      - planned.protein),
    totalCarbs:    clamp(prescription.carbsTarget        - consumed.totalCarbs   - planned.totalCarbs),
    starchyCarbs:  clamp(prescription.starchyCarbsTarget - consumed.starchyCarbs - planned.starchyCarbs),
    fibrousCarbs:  clamp(prescription.fibrousCarbsTarget - consumed.fibrousCarbs - planned.fibrousCarbs),
    fat:           clamp(prescription.fatTarget          - consumed.fat          - planned.fat),
    starchMeals:   Math.max(0, prescription.starchMealsAllowed - consumed.starchMeals - planned.starchMeals),
    nonStarchMeals: 0,
  };

  const mealsPerDay       = user.macroMealsPerDay      ?? 4;
  const starchMealsPerDay = user.defaultStarchMealsPerDay ?? 2;
  const mealsConsumed     = consumed.mealCount;
  const mealsPlanned      = planned.mealCount;
  const mealsRemaining    = Math.max(0, mealsPerDay - mealsConsumed - mealsPlanned);

  remaining.nonStarchMeals = Math.max(0, mealsRemaining - remaining.starchMeals);

  const gramsPerRemainingStarchMeal = computeGramsPerRemainingMeal(
    remaining.starchyCarbs,
    remaining.starchMeals,
  );

  // ── Active constraints ───────────────────────────────────────────────────
  const specialtyConditions = Array.isArray(user.specialtyConditions)
    ? (user.specialtyConditions as string[]) : [];
  const medicalConditions = Array.isArray(user.medicalConditions)
    ? (user.medicalConditions as string[]) : [];

  const glp1Active = specialtyConditions.includes("glp1")
    || medicalConditions.some(c => c === "glp1" || c === "glp-1");

  const diabeticActive = specialtyConditions.includes("diabetic")
    || medicalConditions.some(c => c === "diabetic" || c.includes("diabetes"));

  const performanceActive = !!user.performanceModeEnabled
    && prescription.trainingDayType !== null;

  const clinicalActive =
    prescription.clinicalPrecisionStatus === "clinical_precision_active";

  const procareActive =
    typeof user.planLookupKey === "string" && user.planLookupKey.includes("procare");

  return {
    date: dateISO,
    resolvedPrescription: prescription,
    consumed,
    planned,
    remaining,
    mealPlan: {
      mealsPerDay,
      mealsConsumed,
      mealsPlanned,
      mealsRemaining,
      starchMealsPerDay,
      starchMealsConsumed:  consumed.starchMeals,
      starchMealsPlanned:   planned.starchMeals,
      starchMealsRemaining: remaining.starchMeals,
      starchDistributionStrategy: prescription.starchDistributionStrategy,
      gramsPerRemainingStarchMeal,
      isZeroStarchDay: prescription.isZeroStarchDay,
    },
    activeConstraints: {
      performanceActive,
      glp1Active,
      diabeticActive,
      clinicalActive,
      procareActive,
    },
  };
}

/**
 * Derive a typed GenerationContext from a user's active constraints and the
 * client-supplied context string (used in the generation route).
 */
export function deriveGenerationContext(
  activeConstraints: DailyNutritionState["activeConstraints"],
  clientContext?: string,
): GenerationContext {
  const isPerf = activeConstraints.performanceActive
    || clientContext === "performance_training_day";

  if (activeConstraints.diabeticActive && isPerf) return "diabetic_performance";
  if (activeConstraints.diabeticActive)            return "diabetic";
  if (activeConstraints.glp1Active && isPerf)      return "glp1_performance";
  if (activeConstraints.glp1Active)                return "glp1";
  if (isPerf)                                      return "performance_training_day";
  return "standard";
}
