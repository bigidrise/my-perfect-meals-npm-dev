import { useTranslation } from "react-i18next";

/**
 * DailyMacroTotalsRow
 *
 * Displays the "Today:" macro progress row used across all meal builders.
 * Shows consumed vs. target for calories, protein, carbs, and fat.
 * Color-coded: green = under target, amber = 90–100%, red = over.
 *
 * Reads targets exclusively from the DailyNutritionPrescription so every
 * builder shows the same authoritative effective-daily-prescription — including
 * GLP-1 overlays, Performance training-day modifiers, and ProCare authority —
 * rather than the raw Macro Calculator baseline.
 */

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface PrescriptionSnapshot {
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  source: string;
}

interface Props {
  totals: MacroTotals;
  prescription: PrescriptionSnapshot | null;
  activeDayISO: string | null;
  /**
   * Optional fallback target snapshot used when the prescription endpoint
   * is temporarily unavailable. Prevents displaying 0/0/0/0. For the
   * Performance Builder this should be the resolvedTargets from
   * usePerformanceNutrition so the day-specific training numbers still show.
   * For pro-client views in Beach Body, pass nutritionTargets mapped to this shape.
   */
  fallbackTargets?: PrescriptionSnapshot | null;
}

function macroColor(value: number, target: number): string {
  if (!target) return "bg-white/10 text-white/80";
  const pct = value / target;
  if (pct > 1) return "bg-red-700/60 text-red-100";
  if (pct >= 0.9) return "bg-amber-600/60 text-amber-100";
  return "bg-lime-800/50 text-lime-100";
}

export function DailyMacroTotalsRow({ totals, prescription, activeDayISO, fallbackTargets }: Props) {
  const { t } = useTranslation();
  if (!activeDayISO) return null;

  // Prefer the server-resolved prescription; fall back to local targets when
  // the endpoint is temporarily unavailable. Never show 0/0/0/0.
  const prescriptionValid =
    prescription &&
    prescription.source !== "fallback" &&
    (prescription.caloriesTarget > 0 ||
      prescription.proteinTarget > 0 ||
      prescription.carbsTarget > 0 ||
      prescription.fatTarget > 0);

  const fallbackValid =
    !prescriptionValid &&
    fallbackTargets &&
    (fallbackTargets.caloriesTarget > 0 ||
      fallbackTargets.proteinTarget > 0 ||
      fallbackTargets.carbsTarget > 0 ||
      fallbackTargets.fatTarget > 0);

  const effectiveTargets = prescriptionValid
    ? prescription!
    : fallbackValid
    ? fallbackTargets!
    : null;

  const hasTargets = !!effectiveTargets;

  // Hide the row entirely when there is nothing useful to display
  // (no consumed macros AND no targets). Zeros are not real data.
  const anyConsumed = totals.calories > 0 || totals.protein > 0 || totals.carbs > 0 || totals.fat > 0;
  if (!hasTargets && !anyConsumed) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-white/40 text-xs font-medium shrink-0">{t("common.today")}</span>
      {hasTargets ? (
        <>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(
              totals.calories,
              effectiveTargets!.caloriesTarget,
            )}`}
          >
            {totals.calories.toLocaleString()} /{" "}
            {Math.round(effectiveTargets!.caloriesTarget).toLocaleString()} cal
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(
              totals.protein,
              effectiveTargets!.proteinTarget,
            )}`}
          >
            P {totals.protein} / {Math.round(effectiveTargets!.proteinTarget)}g
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(
              totals.carbs,
              effectiveTargets!.carbsTarget,
            )}`}
          >
            C {totals.carbs} / {Math.round(effectiveTargets!.carbsTarget)}g
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(
              totals.fat,
              effectiveTargets!.fatTarget,
            )}`}
          >
            F {totals.fat} / {Math.round(effectiveTargets!.fatTarget)}g
          </span>
        </>
      ) : (
        <>
          <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
            {totals.calories.toLocaleString()} cal
          </span>
          <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
            P {totals.protein}g
          </span>
          <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
            C {totals.carbs}g
          </span>
          <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
            F {totals.fat}g
          </span>
        </>
      )}
    </div>
  );
}
