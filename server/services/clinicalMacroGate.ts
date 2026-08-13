/**
 * clinicalMacroGate.ts
 *
 * Pure, side-effect-free validation of generated meal macros against
 * server-authoritative clinical ceilings.
 *
 * Designed to be called from the POST /api/meals/generate handler after
 * generateMealUnified returns, before the response is sent to the client.
 *
 * The gate enforces two hard clinical constraints:
 *   - Diabetic: ≤ N carbs per meal (N = server-resolved remaining carbs,
 *     already capped at the 35 g per-meal limit by computeNextMealBudget).
 *   - GLP-1:    ≤ M fat per meal  (M = server-resolved remaining fat,
 *     already capped at prescription.fatTarget / mealsPerDay).
 *
 * Importantly, the gate gates on `generationContext` (diabetic / glp1),
 * NOT on `clinicalNotes`. Clinical notes are only emitted when the divided
 * budget exceeds the nominal ceiling; when the user's remaining macros are
 * already below that ceiling (e.g. 20 g carbs left for a diabetic user),
 * no note is emitted but the clinical constraint still applies.
 *
 * Null / non-finite macro values are treated as a validation failure for
 * clinical users: unknown nutrition cannot be cleared as safe.
 */

export type ClinicalGateResult =
  | { passed: true }
  | { passed: false; reason: ClinicalGateRejection };

export type ClinicalGateRejection =
  | "diabetic_unknown_carbs"
  | "diabetic_carb_ceiling_exceeded"
  | "glp1_unknown_fat"
  | "glp1_fat_ceiling_exceeded";

/**
 * Tolerance values.
 * AI nutrient estimates carry ±5 g rounding imprecision. The tolerances
 * allow small overages due to rounding while still catching clear violations.
 */
const CARB_TOLERANCE = 10;
const FAT_TOLERANCE  = 5;

/**
 * Validate a single generated meal against the server-resolved clinical ceilings.
 *
 * @param generationContext  The authoritative context from resolveDailyNutritionState
 *                           (e.g. "diabetic", "glp1", "standard").
 * @param carbCeiling        Server-authoritative carb ceiling for this meal slot
 *                           (effectiveRemainingMacros.carbs from ChefBudgetResult).
 * @param fatCeiling         Server-authoritative fat ceiling for this meal slot
 *                           (effectiveRemainingMacros.fat from ChefBudgetResult).
 * @param rawCarbs           Carb value from the generated meal (may be null/undefined).
 * @param rawFat             Fat value from the generated meal (may be null/undefined).
 */
export function validateClinicalMacros(
  generationContext: string,
  carbCeiling: number,
  fatCeiling: number,
  rawCarbs: unknown,
  rawFat: unknown,
): ClinicalGateResult {
  const diabeticActive = generationContext === "diabetic";
  const glp1Active     = generationContext === "glp1";

  if (!diabeticActive && !glp1Active) {
    return { passed: true };
  }

  if (diabeticActive) {
    const mealCarbs = toFiniteNumber(rawCarbs);
    if (mealCarbs === null) {
      return { passed: false, reason: "diabetic_unknown_carbs" };
    }
    if (mealCarbs > carbCeiling + CARB_TOLERANCE) {
      return { passed: false, reason: "diabetic_carb_ceiling_exceeded" };
    }
  }

  if (glp1Active) {
    const mealFat = toFiniteNumber(rawFat);
    if (mealFat === null) {
      return { passed: false, reason: "glp1_unknown_fat" };
    }
    if (mealFat > fatCeiling + FAT_TOLERANCE) {
      return { passed: false, reason: "glp1_fat_ceiling_exceeded" };
    }
  }

  return { passed: true };
}

/** Convert a raw value to a finite number, or return null for null/undefined/NaN/Infinity. */
function toFiniteNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return isFinite(n) ? n : null;
}
