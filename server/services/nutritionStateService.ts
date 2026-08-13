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
import { eq, sql, and } from "drizzle-orm";
import { resolveDailyNutritionPrescription } from "./prescriptionResolver";
import { getUserTimezone } from "./nutritionDayService";
import { dailyNutritionPrescriptions } from "../db/schema/dailyNutritionPrescriptions";
import type {
  DailyNutritionState,
  GenerationContext,
  PrescriptionSource,
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
  const [prescription, userRows, tz, storedPrescriptionRows] = await Promise.all([
    resolveDailyNutritionPrescription({ userId, dateISO }),
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    getUserTimezone(userId),
    db
      .select({ source: dailyNutritionPrescriptions.source })
      .from(dailyNutritionPrescriptions)
      .where(
        and(
          eq(dailyNutritionPrescriptions.userId, userId),
          eq(dailyNutritionPrescriptions.date, dateISO),
        ),
      )
      .limit(1),
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

  // ── Planned: board reservations not yet converted to logs ────────────────
  // Query meal_board_items rows for this user/date that do NOT have a
  // matching board_item_reference in macro_logs (those are already consumed).
  const plannedRows = await db.execute(sql`
    SELECT
      COALESCE(SUM((mbi.macros->>'kcal')::numeric),         0) AS calories,
      COALESCE(SUM((mbi.macros->>'protein')::numeric),      0) AS protein,
      COALESCE(SUM((mbi.macros->>'carbs')::numeric),        0) AS carbs,
      COALESCE(SUM((mbi.macros->>'fat')::numeric),          0) AS fat,
      COALESCE(SUM((mbi.macros->>'starchyCarbs')::numeric), 0) AS starchy_carbs,
      COUNT(*) FILTER (
        WHERE COALESCE((mbi.macros->>'starchyCarbs')::numeric, 0) > 0
      )                                                         AS starch_meal_count,
      COUNT(*)                                                  AS reservation_count
    FROM meal_board_items mbi
    JOIN meal_boards mb ON mb.id = mbi.board_id
    WHERE mb.user_id = ${userId}::uuid
      AND (
        mb.start_date::date
        + (mbi.day_index * INTERVAL '1 day')
      ) = ${dateISO}::date
      AND NOT EXISTS (
        SELECT 1 FROM macro_logs ml
        WHERE ml.board_item_reference = mbi.id::text
      )
  `);

  const pr = (plannedRows.rows?.[0] ?? {}) as Record<string, unknown>;

  const planned: DailyNutritionState["planned"] = {
    calories:           Number(pr.calories          ?? 0),
    protein:            Number(pr.protein           ?? 0),
    carbs:              Number(pr.carbs             ?? 0),
    fat:                Number(pr.fat               ?? 0),
    starchyCarbs:       Number(pr.starchy_carbs     ?? 0),
    starchMealsPlanned: Number(pr.starch_meal_count ?? 0),
    reservationCount:   Number(pr.reservation_count ?? 0),
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

  // ── Mid-day prescription change detection ─────────────────────────────────
  // Compare the stored prescription source (written when the day was first
  // resolved) with the source the resolver just computed. If they differ and
  // at least one meal has already been logged, the prescription changed mid-day.
  let prescriptionChangedMidDay: boolean | undefined;
  let prescriptionChangeReason: string | undefined;

  const storedRow = storedPrescriptionRows[0];
  if (storedRow && consumed.mealCount > 0) {
    const storedSource = storedSourceToResolverSource(storedRow.source);
    const currentSource = prescription.source;

    // Use the compatibility matrix defined below. Compatible pairs (e.g.
    // ProCare + Performance Mode) can coexist all day without the prescription
    // actually changing, so they must never trigger the banner. To support a
    // new pairing, add it to COMPATIBLE_SOURCE_PAIRS — do not extend this block.
    if (!areSourcesCompatible(storedSource, currentSource)) {
      prescriptionChangedMidDay = true;
      prescriptionChangeReason = changeReasonLabel(storedSource, currentSource);
    }
  }

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
    ...(prescriptionChangedMidDay && {
      prescriptionChangedMidDay,
      prescriptionChangeReason,
    }),
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

/**
 * Map the DailyNutritionPrescriptions table source string to the PrescriptionSource
 * used by the resolver, so the two can be compared for mid-day-change detection.
 */
function storedSourceToResolverSource(stored: string | null): PrescriptionSource {
  switch (stored) {
    case "procare":             return "professional_override";
    case "performance_overlay": return "performance";
    case "clinical":            return "clinical";
    default:                    return "user_default"; // macro_calculator / unknown
  }
}

/**
 * Source pairs that are considered compatible and must NOT trigger the
 * mid-day prescription-change banner, even when the stored source differs
 * from the resolver's current source.
 *
 * Each entry is [sourceA, sourceB]. The check is symmetric — (A, B) also
 * covers (B, A).
 *
 * When to add a new entry:
 *   Two sources are compatible when they can legitimately coexist all day
 *   without the prescription actually changing mid-day. For example, ProCare
 *   writes "professional_override" to the DB, but if the same user also has
 *   Performance Mode enabled the resolver returns "performance" — both can be
 *   true simultaneously, so this is NOT a real mid-day prescription change.
 *
 *   Add a row here rather than extending the comparison block above so that
 *   new source pairings are always in one place and are easy to audit.
 */
const COMPATIBLE_SOURCE_PAIRS: ReadonlyArray<[PrescriptionSource, PrescriptionSource]> = [
  // ProCare stores "professional_override"; Performance Mode resolver returns
  // "performance". A ProCare client with Performance Mode enabled will always
  // hit this pair — it must never fire the banner.
  ["professional_override", "performance"],
];

/**
 * Returns true when two PrescriptionSource values are considered compatible
 * (i.e. their mismatch does NOT indicate a real mid-day change).
 * Equal sources are always compatible.
 */
function areSourcesCompatible(a: PrescriptionSource, b: PrescriptionSource): boolean {
  if (a === b) return true;
  return COMPATIBLE_SOURCE_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

/**
 * Human-readable label for a PrescriptionSource transition.
 * Only called when a transition is actually detected.
 */
function changeReasonLabel(from: PrescriptionSource, to: PrescriptionSource): string {
  if (to === "professional_override") return "ProCare override";
  if (to === "performance")           return "Performance Mode";
  if (to === "clinical")              return "Clinical plan";
  if (from === "professional_override" || from === "performance") {
    return "Nutrition plan update";
  }
  return "Nutrition plan update";
}
