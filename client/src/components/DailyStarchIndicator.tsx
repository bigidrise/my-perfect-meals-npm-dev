/**
 * DailyStarchIndicator
 *
 * Presentation component — never calls a nutrition resolver.
 * Strategy is always supplied by the parent workflow page.
 *
 * Accepts either:
 *  - A full DailyNutritionPrescription (preferred — shows adaptive gram guidance)
 *  - Legacy strategyOverride + bodyFatSlotDelta (backward compat)
 */

import { getDayStarchStatus } from '@/utils/starchMealClassifier';
import type { DailyNutritionPrescription } from '../../../shared/dailyNutritionPrescription';

interface Meal {
  name?: string;
  ingredients?: (string | { name?: string; item?: string })[];
}

interface DailyStarchIndicatorProps {
  meals: Meal[];
  compact?: boolean;
  /** Preferred: full prescription from useDailyPrescription hook */
  prescription?: DailyNutritionPrescription | null;
  /** Legacy: 'one' (1 slot) or 'flex' (2 slots). Used when prescription is absent. */
  strategyOverride?: 'one' | 'flex';
  /** Legacy: body fat-based slot adjustment (-1, 0, or +1) */
  bodyFatSlotDelta?: number;
}

export function DailyStarchIndicator({
  meals,
  compact = false,
  prescription,
  strategyOverride,
  bodyFatSlotDelta = 0,
}: DailyStarchIndicatorProps) {
  // ── Derive slot count ──────────────────────────────────────────────────────
  let maxSlots: number;
  if (prescription) {
    maxSlots = prescription.starchMealsAllowed;
  } else {
    const base = strategyOverride === 'flex' ? 2 : 1;
    maxSlots = Math.max(0, base + bodyFatSlotDelta);
  }

  const status = getDayStarchStatus(meals, maxSlots);

  // ── Adaptive gram guidance (only available from prescription) ─────────────
  const showGramGuidance =
    prescription &&
    typeof prescription.gramsPerRemainingStarchMeal === 'number' &&
    prescription.starchMealsRemaining > 0;

  // ── Color logic ────────────────────────────────────────────────────────────
  const isOver = status.starchMealCount > maxSlots;
  const colorClass = isOver
    ? 'text-red-500'
    : status.isUsed
    ? 'text-orange-500'
    : 'text-green-500';

  const emoji = isOver ? '🔴' : status.isUsed ? '🟠' : '🟢';

  // ── Zero starch day callout ────────────────────────────────────────────────
  if (prescription?.isZeroStarchDay && !compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-xs">
        <span className="font-medium text-white/70">Starch Meals:</span>
        <span className="flex items-center gap-1 font-semibold text-blue-400">
          🔵 Rest Day — Zero Starch
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span>{emoji}</span>
        <span className={colorClass}>{status.label}</span>
        {showGramGuidance && (
          <span className="text-white/40 ml-1">
            ~{prescription!.gramsPerRemainingStarchMeal}g ea
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-xs">
      <span className="font-medium text-white/70">Starch Meals:</span>
      <span className={`flex items-center gap-1 font-semibold ${colorClass}`}>
        {emoji} {status.label}
      </span>
      {isOver && (
        <span className="text-red-400 text-[10px]">(over limit)</span>
      )}
      {showGramGuidance && !isOver && (
        <span className="text-white/50 text-[10px] ml-1">
          ~{prescription!.gramsPerRemainingStarchMeal}g / remaining meal
        </span>
      )}
    </div>
  );
}
