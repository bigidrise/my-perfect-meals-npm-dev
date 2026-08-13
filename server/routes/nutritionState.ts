/**
 * Daily Nutrition State API
 *
 * GET /api/nutrition-state/:dateISO
 *
 * Returns the complete DailyNutritionState for the authenticated user on the
 * given date: prescription + consumed (logged) + planned (board reservations
 * not yet logged) + remaining budget + meal plan config + active constraints.
 *
 * This is the canonical endpoint every meal builder should consult before
 * generating. No builder should invent its own budget accounting.
 *
 * Double-counting prevention:
 *   - A board item that has been logged (macro_logs.board_item_reference = item.id)
 *     is counted in "consumed" only, NOT in "planned".
 *   - Board items without a matching log row count toward "planned" only.
 *
 * Query params:
 *   timezone  — IANA timezone string (default: "UTC"). Used to compute which
 *               macro_logs belong to the requested calendar day.
 */

import { Router } from "express";
import { db } from "../db";
import { users, macroLogs } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";
import { deriveGenerationContext } from "../services/nutritionBudget";
import { localDayUTCBounds } from "../utils/localDayBounds";
import type { DailyNutritionState } from "../../shared/dailyNutritionPrescription";

const router = Router();

// ── Route ─────────────────────────────────────────────────────────────────────

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const userId: string = (req as any).authUser?.id || (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { dateISO } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const timezone = (req.query.timezone as string | undefined) || "UTC";
    const { start: logStart, end: logEnd } = localDayUTCBounds(dateISO, timezone);

    // ── 1. Aggregate consumed macros for the day ──────────────────────────────
    const [consumedRow] = await db
      .select({
        calories:          sql<number>`COALESCE(SUM(${macroLogs.kcal}::numeric), 0)`,
        protein:           sql<number>`COALESCE(SUM(${macroLogs.protein}::numeric), 0)`,
        carbs:             sql<number>`COALESCE(SUM(${macroLogs.carbs}::numeric), 0)`,
        fat:               sql<number>`COALESCE(SUM(${macroLogs.fat}::numeric), 0)`,
        starchyCarbs:      sql<number>`COALESCE(SUM(${macroLogs.starchyCarbs}::numeric), 0)`,
        fibrousCarbs:      sql<number>`COALESCE(SUM(${macroLogs.fibrousCarbs}::numeric), 0)`,
        mealCount:         sql<number>`COUNT(*)`,
        starchMealsLogged: sql<number>`COUNT(*) FILTER (WHERE ${macroLogs.starchyCarbs}::numeric > 0)`,
      })
      .from(macroLogs)
      .where(
        sql`${macroLogs.userId} = ${userId}
          AND ${macroLogs.at} >= ${logStart.toISOString()}::timestamptz
          AND ${macroLogs.at} <= ${logEnd.toISOString()}::timestamptz`,
      );

    const consumed = {
      calories:          Number(consumedRow?.calories ?? 0),
      protein:           Number(consumedRow?.protein ?? 0),
      carbs:             Number(consumedRow?.carbs ?? 0),
      fat:               Number(consumedRow?.fat ?? 0),
      starchyCarbs:      Number(consumedRow?.starchyCarbs ?? 0),
      fibrousCarbs:      Number(consumedRow?.fibrousCarbs ?? 0),
      mealCount:         Number(consumedRow?.mealCount ?? 0),
      starchMealsLogged: Number(consumedRow?.starchMealsLogged ?? 0),
    };

    // ── 2. Load user profile (for mealPlanConfig + specialtyConditions) ───────
    const [userRow] = await db
      .select({
        macroMealsPerDay:    users.macroMealsPerDay,
        specialtyConditions: users.specialtyConditions,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const specialtyConditions: string[] = Array.isArray(userRow?.specialtyConditions)
      ? (userRow!.specialtyConditions as string[])
      : [];

    // ── 3. Resolve prescription with actual consumption ────────────────────────
    const prescription = await resolveDailyNutritionPrescription({
      userId,
      dateISO,
      consumed: {
        starchyCarbs:    consumed.starchyCarbs,
        starchMealsUsed: consumed.starchMealsLogged,
      },
    });

    // ── 4. Query planned (board items for today not yet logged) ───────────────
    // A board item is "for today" when its calendar date (start_date + day_index)
    // matches dateISO. An item is "logged" when macro_logs.board_item_reference = item.id.
    let plannedCalories     = 0;
    let plannedProtein      = 0;
    let plannedCarbs        = 0;
    let plannedFat          = 0;
    let plannedStarchyCarbs = 0;
    let reservationCount    = 0;
    let starchMealsPlanned  = 0;

    try {
      const boardItemsResult = await db.execute(sql`
        SELECT bi.id, bi.macros
        FROM meal_board_items bi
        JOIN meal_boards b ON bi.board_id = b.id
        WHERE b.user_id::text = ${userId}
          AND (b.start_date::date + (bi.day_index * INTERVAL '1 day'))::date = ${dateISO}::date
          AND NOT EXISTS (
            SELECT 1 FROM macro_logs ml
            WHERE ml.board_item_reference = bi.id::text
              AND ml.user_id = ${userId}
          )
      `);

      for (const r of boardItemsResult.rows) {
        const mac = (r as any).macros as Record<string, number> | null;
        if (!mac) continue;
        // Board items store calories as either "kcal" (the DB/board contract) or
        // "calories" (some builder paths). Normalise with kcal-first fallback.
        const cal     = Number(mac.kcal ?? mac.calories ?? 0);
        const pro     = Number(mac.protein ?? 0);
        const carb    = Number(mac.carbohydrates ?? mac.carbs ?? 0);
        const fat     = Number(mac.fat ?? 0);
        const starchy = Number(mac.starchyCarbs ?? 0);
        plannedCalories     += cal;
        plannedProtein      += pro;
        plannedCarbs        += carb;
        plannedFat          += fat;
        plannedStarchyCarbs += starchy;
        reservationCount    += 1;
        if (starchy > 0) starchMealsPlanned += 1;
      }
    } catch (boardErr) {
      // Non-fatal: board items query falls back to zeros if the table doesn't
      // exist yet (fresh environments before migration runs).
      console.warn("[nutritionState] board items query failed, falling back to zeros:", boardErr);
    }

    const planned = {
      calories:          plannedCalories,
      protein:           plannedProtein,
      carbs:             plannedCarbs,
      fat:               plannedFat,
      starchyCarbs:      plannedStarchyCarbs,
      starchMealsPlanned,
      reservationCount,
    };

    // ── 5. Compute remaining budget ───────────────────────────────────────────
    const totalUsedCalories     = consumed.calories     + planned.calories;
    const totalUsedProtein      = consumed.protein      + planned.protein;
    const totalUsedCarbs        = consumed.carbs        + planned.carbs;
    const totalUsedFat          = consumed.fat          + planned.fat;
    const totalUsedStarchyCarbs = consumed.starchyCarbs + planned.starchyCarbs;
    const totalUsedFibrousCarbs = consumed.fibrousCarbs;
    const totalUsedStarchMeals  = consumed.starchMealsLogged + planned.starchMealsPlanned;

    const remaining = {
      calories:             Math.max(0, prescription.caloriesTarget    - totalUsedCalories),
      protein:              Math.max(0, prescription.proteinTarget      - totalUsedProtein),
      carbs:                Math.max(0, prescription.carbsTarget        - totalUsedCarbs),
      fat:                  Math.max(0, prescription.fatTarget          - totalUsedFat),
      starchyCarbs:         Math.max(0, prescription.starchyCarbsTarget - totalUsedStarchyCarbs),
      fibrousCarbs:         Math.max(0, prescription.fibrousCarbsTarget - totalUsedFibrousCarbs),
      starchMealsRemaining: Math.max(0, prescription.starchMealsAllowed - totalUsedStarchMeals),
    };

    // ── 6. Meal plan config (prefer prescription snapshot; fall back to user row)
    const mealPlanConfig = {
      mealsPerDay:                userRow?.macroMealsPerDay ?? 4,
      starchMealsPerDay:          prescription.starchMealsAllowed,
      starchDistributionStrategy: prescription.starchDistributionStrategy,
    };

    // ── 7. Active constraints ─────────────────────────────────────────────────
    const generationContext = deriveGenerationContext(
      prescription.source,
      prescription.trainingDayType,
      prescription.rationaleCodes,
      specialtyConditions,
    );

    const activeConstraints = {
      generationContext,
      starchSlotsExhausted:   remaining.starchMealsRemaining <= 0,
      calorieBudgetExhausted: remaining.calories <= 0,
      proteinBudgetMet:
        consumed.protein + planned.protein >= prescription.proteinTarget,
    };

    // ── 8. Build and return DailyNutritionState ───────────────────────────────
    const state: DailyNutritionState = {
      date:        dateISO,
      resolvedAt:  new Date().toISOString(),
      prescription,
      consumed,
      planned,
      remaining,
      mealPlanConfig,
      activeConstraints,
    };

    return res.json(state);
  } catch (err) {
    console.error("[nutritionState] error:", err);
    return res.status(500).json({ error: "Failed to resolve nutrition state" });
  }
});

export default router;
