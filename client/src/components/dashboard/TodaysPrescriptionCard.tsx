/**
 * TodaysPrescriptionCard
 *
 * Reusable surface that shows the user's live DailyNutritionPrescription —
 * macros, starch slots, and any active Performance or Clinical modifiers.
 *
 * Designed to be embedded on the Dashboard today, and later reused by
 * Coach's Corner, the meal explanation panel, and the prescription trace.
 */

import { useMemo } from "react";
import { useDailyPrescription } from "@/hooks/useDailyPrescription";
import type {
  TrainingDayType,
  ClinicalPrecisionStatus,
} from "../../../../shared/dailyNutritionPrescription";

const TRAINING_DAY_LABELS: Record<NonNullable<TrainingDayType>, string> = {
  rest: "Rest Day",
  light: "Light Training",
  moderate: "Moderate Training",
  heavy: "Heavy Training Day",
  competition: "Competition Day",
};

const CLINICAL_BADGE_LABELS: Partial<Record<ClinicalPrecisionStatus, string>> = {
  clinical_precision_available: "Clinical Precision Available",
  clinical_precision_active: "Clinical Precision Active",
};

interface MacroTileProps {
  label: string;
  value: string | number;
}

function MacroTile({ label, value }: MacroTileProps) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <p className="text-xs text-white/40 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

interface TodaysPrescriptionCardProps {
  /** If provided, dashboard-level starch consumption is passed for adaptive gram guidance */
  starchyConsumed?: number;
  starchMealsUsed?: number;
}

export function TodaysPrescriptionCard({
  starchyConsumed = 0,
  starchMealsUsed = 0,
}: TodaysPrescriptionCardProps) {
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { prescription, isLoading } = useDailyPrescription({
    dateISO: todayISO,
    starchyConsumed,
    starchMealsUsed,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 animate-pulse space-y-3">
        <div className="h-4 bg-white/10 rounded w-40" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-white/10 rounded-lg" />
          ))}
        </div>
        <div className="h-2 bg-white/10 rounded-full" />
      </div>
    );
  }

  if (!prescription || !prescription.caloriesTarget) return null;

  const dayLabel = prescription.trainingDayType
    ? TRAINING_DAY_LABELS[prescription.trainingDayType]
    : null;

  const clinicalBadge = CLINICAL_BADGE_LABELS[prescription.clinicalPrecisionStatus] ?? null;
  const hasPerformance = prescription.trainingDayType !== null;

  const starchPct =
    prescription.starchMealsAllowed > 0
      ? Math.min(
          (prescription.starchMealsUsed / prescription.starchMealsAllowed) * 100,
          100,
        )
      : 0;

  const isHighIntensityDay =
    prescription.trainingDayType === "heavy" ||
    prescription.trainingDayType === "competition";

  return (
    <div className="rounded-xl bg-black/40 border border-orange-500/20 p-4 space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-orange-400">Today's Nutrition Prescription</p>
        {dayLabel && (
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${
              isHighIntensityDay
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                : "bg-white/10 text-white/50"
            }`}
          >
            {dayLabel}
          </span>
        )}
      </div>

      {/* ── Macro grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <MacroTile label="Cal" value={prescription.caloriesTarget.toLocaleString()} />
        <MacroTile label="Protein" value={`${prescription.proteinTarget}g`} />
        <MacroTile label="Carbs" value={`${prescription.carbsTarget}g`} />
        <MacroTile label="Fat" value={`${prescription.fatTarget}g`} />
      </div>

      {/* ── Starch slots ───────────────────────────────────────────────── */}
      {prescription.starchMealsAllowed > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Starch slots today</span>
            <span
              className={
                prescription.starchMealsRemaining === 0
                  ? "text-white/30"
                  : "text-orange-400 font-medium"
              }
            >
              {prescription.starchMealsUsed} of {prescription.starchMealsAllowed} used
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${starchPct}%` }}
            />
          </div>
          {prescription.isZeroStarchDay && (
            <p className="text-xs text-white/40">Zero-starch day — rest day protocol active</p>
          )}
        </div>
      )}

      {/* ── Active modifier badges ──────────────────────────────────────── */}
      {(hasPerformance || clinicalBadge) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {hasPerformance && (
            <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-full">
              ⚡ Performance modified
            </span>
          )}
          {clinicalBadge && (
            <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-0.5 rounded-full">
              ⚕️ {clinicalBadge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
