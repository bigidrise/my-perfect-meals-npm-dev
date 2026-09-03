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
  StarchClassificationStatus,
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
  /**
   * Exclude this board item ID from both consumed (macro_logs) and planned
   * (meal_board_items) counts.  Used by the meal refinement flow so the item
   * being replaced is not counted against its own replacement budget.
   */
  excludeItemId?: string,
): Promise<DailyNutritionState> {
  // ── Read stored prescription source BEFORE resolving ─────────────────────
  // The prescriptionResolver fire-and-forgets an upsert that overwrites this
  // row. Reading first ensures we capture the PREVIOUS source for mid-day
  // change detection — a concurrent read would race the upsert.
  const storedPrescriptionRows = await db
    .select({ source: dailyNutritionPrescriptions.source })
    .from(dailyNutritionPrescriptions)
    .where(
      and(
        eq(dailyNutritionPrescriptions.userId, userId),
        eq(dailyNutritionPrescriptions.date, dateISO),
      ),
    )
    .limit(1);

  // Now resolve concurrently — the upsert triggered here writes the NEW source.
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
      COALESCE(SUM(
        CASE WHEN classification_source IN ('user_input', 'ingredient')
          THEN starchy_carbs::numeric ELSE 0 END
      ), 0) AS confirmed_starchy_carbs,
      COALESCE(SUM(
        CASE WHEN classification_source IN ('conservative_fallback', 'unclassified')
          THEN starchy_carbs::numeric ELSE 0 END
      ), 0) AS uncertain_starchy_carbs,
      COALESCE(SUM(fibrous_carbs::numeric), 0) AS fibrous_carbs,
      COALESCE(SUM(fat::numeric),           0) AS fat,
      COUNT(*) FILTER (
        WHERE starchy_carbs::numeric > 0 AND source != 'alcohol'
      )                                        AS starch_meal_count,
      COUNT(*) FILTER (
        WHERE starchy_carbs::numeric > 0
          AND source != 'alcohol'
          AND classification_source IN ('user_input', 'ingredient')
      )                                        AS confirmed_starch_meal_count,
      COUNT(*) FILTER (
        WHERE classification_source IN ('conservative_fallback', 'unclassified')
      )                                        AS uncertain_classification_count,
      COUNT(*) FILTER (
        WHERE source != 'alcohol'
      )                                        AS meal_count
    FROM macro_logs
    WHERE user_id = ${userId}
      AND (at AT TIME ZONE ${tz})::date = ${dateISO}::date
      AND (${excludeItemId ?? null}::text IS NULL
           OR board_item_reference IS DISTINCT FROM ${excludeItemId ?? null}::text)
  `);

  const cr = (consumedRows.rows?.[0] ?? {}) as Record<string, unknown>;
  const confirmedStarchyCarbs = Number(cr.confirmed_starchy_carbs ?? 0);
  const uncertainStarchyCarbs = Number(cr.uncertain_starchy_carbs ?? 0);
  const uncertainClassificationCount = Number(cr.uncertain_classification_count ?? 0);
  const classificationStatus: StarchClassificationStatus =
    uncertainClassificationCount === 0
      ? "VERIFIED"
      : confirmedStarchyCarbs > 0
        ? "MIXED"
        : "UNCLASSIFIED";

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
    confirmedStarchyCarbs,
    uncertainStarchyCarbs,
    confirmedStarchMealsLogged: Number(cr.confirmed_starch_meal_count ?? 0),
    classificationStatus,
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
      AND (${excludeItemId ?? null}::text IS NULL
           OR mbi.id::text != ${excludeItemId ?? null}::text)
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

  const confirmedStarchMeals = consumed.confirmedStarchMealsLogged ?? 0;
  const consumedRemaining: NonNullable<DailyNutritionState["consumedRemaining"]> = {
    calories: clamp(prescription.caloriesTarget - consumed.calories),
    protein: clamp(prescription.proteinTarget - consumed.protein),
    carbs: clamp(prescription.carbsTarget - consumed.carbs),
    fat: clamp(prescription.fatTarget - consumed.fat),
    starchyCarbs: clamp(prescription.starchyCarbsTarget - confirmedStarchyCarbs),
    fibrousCarbs: clamp(prescription.fibrousCarbsTarget - consumed.fibrousCarbs),
    starchMealsRemaining: Math.max(
      0,
      prescription.starchMealsAllowed - confirmedStarchMeals,
    ),
  };

  const projectedRemaining: NonNullable<DailyNutritionState["projectedRemaining"]> = {
    calories: clamp(consumedRemaining.calories - planned.calories),
    protein: clamp(consumedRemaining.protein - planned.protein),
    carbs: clamp(consumedRemaining.carbs - planned.carbs),
    fat: clamp(consumedRemaining.fat - planned.fat),
    starchyCarbs: clamp(consumedRemaining.starchyCarbs - planned.starchyCarbs),
    fibrousCarbs: consumedRemaining.fibrousCarbs,
    starchMealsRemaining: Math.max(
      0,
      consumedRemaining.starchMealsRemaining - planned.starchMealsPlanned,
    ),
  };

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

  const prescribedStarchTarget = Math.max(0, prescription.starchyCarbsTarget);
  const consumedStarchExhausted =
    prescribedStarchTarget > 0 && confirmedStarchyCarbs >= prescribedStarchTarget;
  const projectedStarchGrams = confirmedStarchyCarbs + planned.starchyCarbs;
  const projectedStarchConflict =
    (prescribedStarchTarget > 0 && projectedStarchGrams >= prescribedStarchTarget)
    || (prescription.starchMealsAllowed > 0
      && confirmedStarchMeals + planned.starchMealsPlanned >= prescription.starchMealsAllowed);
  const uncertaintyCouldChangeExhaustion =
    uncertainStarchyCarbs > 0
    && !consumedStarchExhausted
    && confirmedStarchyCarbs + uncertainStarchyCarbs >= prescribedStarchTarget;
  const resolutionStatus =
    prescription.source === "fallback"
      ? "INSUFFICIENT_DATA"
      : uncertaintyCouldChangeExhaustion
        ? "NEEDS_REVIEW"
        : "RESOLVED";
  const resolvedAt = new Date().toISOString();

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
    contractVersion: "daily-nutrition-state.v1",
    authority: "nutritionStateService",
    subject: { userId, accessMode: "self" },
    localDay: { date: dateISO, timezone: tz },
    resolution: {
      status: resolutionStatus,
      reasonCodes: [
        ...(prescription.source === "fallback" ? ["fallback_prescription"] : []),
        ...(uncertaintyCouldChangeExhaustion ? ["starch_classification_uncertain"] : []),
      ],
    },
    date:       dateISO,
    resolvedAt,
    prescription,
    consumed,
    consumedRemaining,
    planned,
    reservedAllocation: {
      calories: planned.calories,
      protein: planned.protein,
      carbs: planned.carbs,
      fat: planned.fat,
      starchyCarbs: planned.starchyCarbs,
      starchMealsReserved: planned.starchMealsPlanned,
      reservationCount: planned.reservationCount,
    },
    projectedRemaining,
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
      consumedStarchExhausted,
      projectedStarchConflict,
      resolutionStatus,
    },
    starch: {
      consumed: {
        targetGrams: prescribedStarchTarget,
        confirmedGrams: confirmedStarchyCarbs,
        uncertainGrams: uncertainStarchyCarbs,
        remainingGrams: consumedRemaining.starchyCarbs,
        mealsUsed: confirmedStarchMeals,
        mealsRemaining: consumedRemaining.starchMealsRemaining,
        exhausted: consumedStarchExhausted,
        classificationStatus,
      },
      projected: {
        reservedGrams: planned.starchyCarbs,
        projectedGrams: projectedStarchGrams,
        projectedRemainingGrams: projectedRemaining.starchyCarbs,
        projectedMealsUsed: confirmedStarchMeals + planned.starchMealsPlanned,
        projectedConflict: projectedStarchConflict,
      },
    },
    modifiers: {
      glp1: glp1Active,
      performance: performanceActive,
      clinical: prescription.source === "clinical" || diabeticActive,
      prescriptionSource: prescription.source,
    },
    provenance: {
      consumptionSource: "macro_logs",
      plannedSource: "meal_board_items",
      prescriptionSource: prescription.source,
      calculationTimestamp: resolvedAt,
      classificationSources:
        classificationStatus === "VERIFIED"
          ? ["user_input", "ingredient"]
          : classificationStatus === "MIXED"
            ? ["user_input", "ingredient", "conservative_fallback_or_unclassified"]
            : ["conservative_fallback_or_unclassified"],
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
  _clientContext?: string,
): GenerationContext {
  // Client context describes interaction intent only. Performance activation is
  // resolved from authorized server state above and can never be upgraded here.
  return constraints.generationContext;
}

/**
 * Map the DB-stored source string back to the PrescriptionSource used by the
 * resolver. Must be the exact inverse of the dbSource mapping in
 * prescriptionResolver.ts — keep both in sync whenever a new source is added.
 */
function storedSourceToResolverSource(stored: string | null): PrescriptionSource {
  switch (stored) {
    case "procare":             return "professional_override";
    case "performance_overlay": return "performance";
    case "clinical":            return "clinical";
    default:                    return "user_default"; // macro_calculator / unknown / null
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
 *
 * Direction semantics:
 *   from = storedRow.source  (what was written to daily_nutrition_prescriptions —
 *                             the MOST RECENT write wins, so ProCare upserts after
 *                             the macro calculator make "from" = professional_override)
 *   to   = prescription.source (what the resolver computed fresh)
 *
 * The resolver never returns "professional_override" — it can only produce
 * user_default | performance | clinical. Therefore the canonical ProCare banner
 * case is from="professional_override", to="user_default", and the check must
 * inspect "from" to identify it.
 */
function changeReasonLabel(from: PrescriptionSource, to: PrescriptionSource): string {
  // ProCare professional wrote targets mid-day: the stored row was stamped
  // 'procare' (→ professional_override) and the resolver still sees user_default.
  if (from === "professional_override") return "ProCare override";
  // Transitioning into Performance Mode (performance overlay newly applied).
  if (to === "performance")             return "Performance Mode";
  if (from === "performance")           return "Nutrition plan update";
  // Transitioning into a clinical plan.
  if (to === "clinical")                return "Clinical plan";
  return "Nutrition plan update";
}
