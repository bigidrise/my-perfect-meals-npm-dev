/**
 * prescriptionAdapter.ts
 *
 * Single shared adapter between the server's DailyNutritionPrescription
 * field names and the display contract expected by DailyTargetsCard and
 * RemainingMacrosFooter.
 *
 * This is the ONLY place the field-name mapping lives. All builder pages
 * must import this function instead of writing their own mapping.
 *
 * Design rules:
 *  - Returns undefined for null / fallback prescriptions so callers can
 *    fall back to the macro-calculator baseline (useBaselineNutrition).
 *  - Never modifies the prescription — pure function, no side effects.
 *  - Do NOT import from shared/dailyNutritionPrescription here to avoid
 *    a client build dependency on the server-type barrel. The interface
 *    below is a structural match, not a nominal import.
 */

import type { MacroTargets } from "@/components/biometrics/RemainingMacrosFooter";

/** Structural subset of DailyNutritionPrescription that this adapter reads. */
interface PrescriptionLike {
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  starchyCarbsTarget?: number;
  fibrousCarbsTarget?: number;
  /** "fallback" prescriptions are placeholders — do not override the display. */
  source?: string;
}

/**
 * Convert a server-resolved prescription to the MacroTargets shape consumed
 * by DailyTargetsCard (`targetsOverride`) and RemainingMacrosFooter (`targetsOverride`).
 *
 * Returns `undefined` only when the prescription is absent OR when
 * source === "fallback" (the server itself fell back to raw macro-calc values
 * because it couldn't resolve — rare). ALL other sources — "user_default",
 * "clinical" (GLP-1, diabetic, anti-inflammatory), "performance", and
 * "professional_override" — are treated as authoritative and override the
 * client-side macro-calculator baseline.
 *
 * Usage in a builder:
 *   const prescription = nutritionState?.prescription ?? null;
 *   const effectiveTargets = prescriptionToTargetsOverride(prescription) ?? nutritionTargets;
 *   // then pass effectiveTargets to both DailyTargetsCard and RemainingMacrosFooter
 */
export function prescriptionToTargetsOverride(
  prescription: PrescriptionLike | null | undefined,
): MacroTargets | undefined {
  if (!prescription) return undefined;
  if (prescription.source === "fallback") return undefined;
  // Guard against zero-value prescriptions that haven't resolved yet.
  if (prescription.proteinTarget <= 0 && prescription.carbsTarget <= 0) return undefined;

  return {
    protein_g:      prescription.proteinTarget,
    carbs_g:        prescription.carbsTarget,
    fat_g:          prescription.fatTarget,
    starchyCarbs_g: prescription.starchyCarbsTarget,
    fibrousCarbs_g: prescription.fibrousCarbsTarget,
  };
}
