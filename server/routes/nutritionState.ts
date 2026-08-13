/**
 * nutritionState.ts — GET /api/nutrition-state/:dateISO
 *
 * Returns the canonical DailyNutritionState for the authenticated user on
 * the given date. This is the single authority every meal builder reads —
 * no builder computes or caches its own nutrition targets independently.
 *
 * Stage 1 (#690): planned nutrition is zeros. Board reservation wiring
 * happens in Stage 2 (#691) when the Weekly Meal Board is integrated.
 *
 * Auth: requireAuth — user always reads their own state (or ProCare coach
 * reads a client's state via ?clientId=).
 */

import express from "express";
import { db } from "../db";
import { users, macroLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";
import { getUserTimezone } from "../services/nutritionDayService";
import type {
  DailyNutritionState,
  MacroTotals,
} from "../../shared/dailyNutritionPrescription";
import { computeGramsPerRemainingMeal } from "../../shared/dailyNutritionPrescription";

const router = express.Router();

// ── GET /api/nutrition-state/:dateISO ─────────────────────────────────────────

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    // ProCare coaches may query a client's state
    const clientId  = (req.query.clientId as string) ?? null;
    const userId    = clientId ?? String(authUser.id);
    const { dateISO } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "dateISO must be YYYY-MM-DD" });
    }

    // ── Run in parallel: prescription + user row + timezone ───────────────
    const [prescription, userRows, tz] = await Promise.all([
      resolveDailyNutritionPrescription({ userId, dateISO }),
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      getUserTimezone(userId),
    ]);

    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ── Consumed: aggregate macro_logs for this user-local date ──────────
    // Uses the user's timezone so CDT/PST users get their local day boundary.
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

    // ── Planned: zeros in Stage 1 (#690) — wired in Stage 2 (#691) ───────
    const planned: MacroTotals & { starchMeals: number; mealCount: number } = {
      calories: 0, protein: 0, totalCarbs: 0,
      starchyCarbs: 0, fibrousCarbs: 0, fat: 0,
      starchMeals: 0, mealCount: 0,
    };

    // ── Remaining = prescription − consumed − planned (floor 0) ──────────
    const clamp = (n: number) => Math.max(0, Math.round(n));

    const remaining = {
      calories:     clamp(prescription.caloriesTarget   - consumed.calories     - planned.calories),
      protein:      clamp(prescription.proteinTarget     - consumed.protein      - planned.protein),
      totalCarbs:   clamp(prescription.carbsTarget       - consumed.totalCarbs   - planned.totalCarbs),
      starchyCarbs: clamp(prescription.starchyCarbsTarget - consumed.starchyCarbs - planned.starchyCarbs),
      fibrousCarbs: clamp(prescription.fibrousCarbsTarget - consumed.fibrousCarbs - planned.fibrousCarbs),
      fat:          clamp(prescription.fatTarget         - consumed.fat          - planned.fat),
      starchMeals:  Math.max(0, prescription.starchMealsAllowed - consumed.starchMeals - planned.starchMeals),
      nonStarchMeals: 0, // computed below after mealsRemaining is known
    };

    // ── Meal plan configuration ───────────────────────────────────────────
    // Prefer the snapshotted values from the prescription row (written by
    // prescriptionResolver on this call). Fall back to users columns.
    const mealsPerDay       = user.macroMealsPerDay      ?? 4;
    const starchMealsPerDay = user.defaultStarchMealsPerDay ?? 2;

    const mealsConsumed  = consumed.mealCount;
    const mealsPlanned   = planned.mealCount;
    const mealsRemaining = Math.max(0, mealsPerDay - mealsConsumed - mealsPlanned);

    remaining.nonStarchMeals = Math.max(0, mealsRemaining - remaining.starchMeals);

    // Adaptive starchy-carb target for the next starch meal
    const gramsPerRemainingStarchMeal = computeGramsPerRemainingMeal(
      remaining.starchyCarbs,
      remaining.starchMeals,
    );

    // ── Active constraints ────────────────────────────────────────────────
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

    // ProCare: user is a ProCare client if their plan key includes 'procare'
    // OR if a ProCare coach is currently querying their state (clientId param).
    const procareActive = !!clientId
      || (typeof user.planLookupKey === "string" && user.planLookupKey.includes("procare"));

    // ── Assemble and return ───────────────────────────────────────────────
    const state: DailyNutritionState = {
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

    res.json(state);
  } catch (err: any) {
    console.error("[nutritionState] GET error:", err);
    res.status(500).json({ error: "Failed to resolve daily nutrition state" });
  }
});

export default router;
