/**
 * nutritionStateService.ts
 *
 * Resolves the DailyNutritionState for a user on a given date.
 * This is the single server-side function that every consumer — the
 * /api/nutrition-state route AND the /api/meals/generate route — should
 * call instead of duplicating DB queries.
 *
 * Returns the canonical DailyNutritionState shape defined in
 * shared/dailyNutritionPrescription.ts. All field names must match
 * that interface exactly.
 */

import { db } from "../db";
import { users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { resolveDailyNutritionPrescription } from "./prescriptionResolver";
import { getUserTimezone } from "./nutritionDayService";
import type {
  DailyNutritionState,
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

  // ── Consumed: aggregate macro_logs for this user-local date ──────────────
  const consumedRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(kcal::numeric),         0) AS calories,
      COALESCE(SUM(protein::numeric),       0) AS protein,
      COALESCE(SUM(carbs::numeric),         0) AS carbs,
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

  // Field names must match DailyNutritionState["consumed"]
  const consumed: DailyNutritionState["consumed"] = {
    calories:          Number(cr.calories           ?? 0),
    protein:           Number(cr.protein            ?? 0),
    carbs:             Number(cr.carbs              ?? 0),
    fat:               Number(cr.fat                ?? 0),
    starchyCarbs:      Number(cr.starchy_carbs      ?? 0),
    fibrousCarbs:      Number(cr.fibrous_carbs      ?? 0),
    starchMealsLogged: Number(cr.starch_meal_count  ?? 0),
    mealCount:         Number(cr.meal_count         ?? 0),
  };

  // ── Planned: zeros — board reservation wiring is Stage 2 / #691 ──────────
  const planned: DailyNutritionState["planned"] = {
    calories:           0,
    protein:            0,
    carbs:              0,
    fat:                0,
    starchyCarbs:       0,
    starchMealsPlanned: 0,
    reservationCount:   0,
  };

  // ── Remaining = prescription − consumed − planned (clamped ≥ 0) ──────────
  const clamp = (n: number) => Math.max(0, Math.round(n));

  const remaining: DailyNutritionState["remaining"] = {
    calories:     clamp(prescription.caloriesTarget    - consumed.calories     - planned.calories),
    protein:      clamp(prescription.proteinTarget     - consumed.protein      - planned.protein),
    carbs:        clamp(prescription.carbsTarget       - consumed.carbs        - planned.carbs),
    fat:          clamp(prescription.fatTarget         - consumed.fat          - planned.fat),
    starchyCarbs: clamp(prescription.starchyCarbsTarget - consumed.starchyCarbs - planned.starchyCarbs),
    fibrousCarbs: clamp(prescription.fibrousCarbsTarget - consumed.fibrousCarbs),
    starchMealsRemaining: Math.max(
      0,
      prescription.starchMealsAllowed
        - consumed.starchMealsLogged
        - planned.starchMealsPlanned,
    ),
  };

  const mealsPerDay       = (user as any).macroMealsPerDay         ?? 4;
  const starchMealsPerDay = (user as any).defaultStarchMealsPerDay ?? 2;

  // ── Derive generation context from clinical flags ─────────────────────────
  // Priority order: diabetic > glp1 > performance > standard.
  // This context is what the AI generation layer uses to select guardrails.
  // Performance is NOT a separate clinical condition — it adjusts macros only.
  const specialtyConditions = Array.isArray(user.specialtyConditions)
    ? (user.specialtyConditions as string[]) : [];
  const medicalConditions = Array.isArray(user.medicalConditions)
    ? (user.medicalConditions as string[]) : [];

  const glp1Active = specialtyConditions.includes("glp1")
    || medicalConditions.some(c => c === "glp1" || c === "glp-1");
  const diabeticActive = specialtyConditions.includes("diabetic")
    || medicalConditions.some(c => c === "diabetic" || c.includes("diabetes"));
  const performanceActive = !!(user as any).performanceModeEnabled
    && prescription.trainingDayType !== null;

  const generationContext: GenerationContext =
    diabeticActive    ? "diabetic" :
    glp1Active        ? "glp1"     :
    performanceActive ? "performance_training_day" :
    "standard";

  return {
    date:       dateISO,
    resolvedAt: new Date().toISOString(),
    prescription,
    consumed,
    planned,
    remaining,
    mealPlanConfig: {
      mealsPerDay,
      starchMealsPerDay,
      starchDistributionStrategy: prescription.starchDistributionStrategy,
    },
    activeConstraints: {
      generationContext,
      starchSlotsExhausted:    remaining.starchMealsRemaining <= 0,
      calorieBudgetExhausted:  remaining.calories <= 0,
      proteinBudgetMet:
        consumed.protein + planned.protein >= prescription.proteinTarget,
    },
  };
}

/**
 * Derive a GenerationContext for a generation request.
 *
 * Base context comes from the resolved state (clinical conditions take priority).
 * If the client signals a performance context and the base is "standard",
 * the context is upgraded to "performance_training_day".
 */
export function deriveGenerationContext(
  constraints: DailyNutritionState["activeConstraints"],
  clientContext?: string,
): GenerationContext {
  // Client may explicitly signal a performance training day for standard users.
  if (
    constraints.generationContext === "standard" &&
    clientContext === "performance_training_day"
  ) {
    return "performance_training_day";
  }
  return constraints.generationContext;
}
