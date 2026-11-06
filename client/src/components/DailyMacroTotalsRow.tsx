import { useTranslation } from "react-i18next";
import { formatBuilderMacro, type BuilderMacroKey } from "@/lib/builderMacroCalculation";
import { resolveDisplayCarbTargets } from "@/lib/macroResolver";

/**
 * DailyMacroTotalsRow
 *
 * Displays the "Today:" macro progress row used across all meal builders.
 * Shows the shared, serving-aware Builder summary without deriving any splits.
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
  starchyCarbs?: number;
  fibrousCarbs?: number;
  uncertainFields?: BuilderMacroKey[];
  estimated?: boolean;
  issues?: string[];
  unclassifiedCarbs?: number;
}

interface PrescriptionSnapshot {
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  source: string;
  starchyCarbsTarget?: number;
  fibrousCarbsTarget?: number;
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
  /** Exact same already-resolved target snapshot as the footer. */
  targetsOverride?: {
    calories_kcal?: number;
    protein_g: number;
    carbs_g: number;
    starchyCarbs_g?: number;
    fibrousCarbs_g?: number;
    fat_g: number;
  };
}

function macroColor(value: number, target: number, pinkAtLimit = false): string {
  if (target === 0 && value > 0) return pinkAtLimit ? "bg-pink-500/60 text-pink-100" : "bg-red-700/60 text-red-100";
  if (!target) return "bg-white/10 text-white/80";
  const pct = value / target;
  if (pct >= 1 && pinkAtLimit) return "bg-pink-500/60 text-pink-100";
  if (pct > 1) return "bg-red-700/60 text-red-100";
  if (pct >= 0.9) return pinkAtLimit ? "bg-pink-500/60 text-pink-100" : "bg-amber-600/60 text-amber-100";
  return "bg-lime-800/50 text-lime-100";
}

export function DailyMacroTotalsRow({ totals, prescription, activeDayISO, fallbackTargets, targetsOverride }: Props) {
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
  if (!hasTargets && !targetsOverride && !anyConsumed) return null;

  const targetSnapshot = targetsOverride ?? (hasTargets ? {
    calories_kcal: effectiveTargets!.caloriesTarget,
    protein_g: effectiveTargets!.proteinTarget,
    carbs_g: effectiveTargets!.carbsTarget,
    starchyCarbs_g: effectiveTargets!.starchyCarbsTarget,
    fibrousCarbs_g: effectiveTargets!.fibrousCarbsTarget,
    fat_g: effectiveTargets!.fatTarget,
  } : null);
  const targets = targetSnapshot
    ? { ...targetSnapshot, ...resolveDisplayCarbTargets(targetSnapshot) }
    : null;
  const indicators: { key: BuilderMacroKey; label: string; target: number | undefined }[] = [
    { key: "calories", label: "Calories", target: targets?.calories_kcal },
    { key: "protein", label: "Protein", target: targets?.protein_g },
    { key: "carbs", label: "Total Carbs", target: targets?.carbs_g },
    { key: "starchyCarbs", label: "Starchy Carbs", target: targets?.starchyCarbs_g },
    { key: "fibrousCarbs", label: "Fibrous Carbs", target: targets?.fibrousCarbs_g },
    { key: "fat", label: "Fat", target: targets?.fat_g },
  ];
  return (
    <div className="space-y-1 px-1" data-testid="builder-today-macros">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-white/40 text-xs font-medium shrink-0">{t("common.today")}</span>
        {indicators.map(({ key, label, target }) => {
          const value = totals[key];
          const unknown = value === undefined;
          const incomplete = totals.uncertainFields?.includes(key);
          const over = !unknown && target !== undefined && value > target;
          return (
            <span key={key} data-macro={key}
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${target === undefined || unknown || (incomplete && !over)
                ? "bg-white/10 text-white/80" : macroColor(
                  value ?? 0, target ?? 0, key === "carbs" || key === "starchyCarbs" || key === "fibrousCarbs",
                )}`}>
              {label} {unknown ? "—" : formatBuilderMacro(value, incomplete)}
              {target !== undefined ? ` / ${formatBuilderMacro(target)}` : " / —"}{key === "calories" ? " cal" : "g"}
              {over && ` (${incomplete ? "≥ " : ""}+${formatBuilderMacro(value! - target!)}${key === "calories" ? " cal" : "g"} over)`}
            </span>
          );
        })}
      </div>
      {(totals.estimated || totals.issues?.length || (totals.unclassifiedCarbs ?? 0) > 0.01) && (
        <p className="text-[10px] text-white/60">
          {totals.estimated && "Carb split estimated. "}
          {(totals.unclassifiedCarbs ?? 0) > 0.01 && `${Math.round(totals.unclassifiedCarbs!)}g other/unclassified carbs. `}
          {totals.issues?.join(". ")}{totals.uncertainFields?.length ? " · Totals incomplete (≥ known amounts)." : ""}
        </p>
      )}
    </div>
  );
}
