import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getResolvedTargets } from "@/lib/macroResolver";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import {
  MPM_GLASS,
  MPM_STICKY_FOOTER,
  MPM_MACRO_COLORS,
  getMacroProgressColor,
} from "@/components/glass/mpmGlassStandard";
import { Flame } from "lucide-react";

export interface ConsumedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Optional starchy/fibrous breakdown
  starchyCarbs?: number;
  fibrousCarbs?: number;
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  // Optional starchy/fibrous breakdown targets
  starchyCarbs_g?: number;
  fibrousCarbs_g?: number;
}

interface RemainingMacrosFooterProps {
  onSaveDay?: () => void;
  showSaveButton?: boolean;
  className?: string;
  consumedOverride?: ConsumedMacros;
  targetsOverride?: MacroTargets;
  layoutMode?: "sticky" | "inline";
}

export function RemainingMacrosFooter({
  onSaveDay,
  showSaveButton = true,
  className = "",
  consumedOverride,
  targetsOverride,
  layoutMode = "sticky",
}: RemainingMacrosFooterProps) {
  const { user } = useAuth();
  const todayMacros = useTodayMacros();

  const targets = useMemo(() => {
    if (targetsOverride) {
      return targetsOverride;
    }
    // Use resolved targets which includes pro-set starchy/fibrous breakdown
    const resolved = getResolvedTargets(user?.id);
    return {
      calories: resolved.calories,
      protein_g: resolved.protein_g,
      carbs_g: resolved.carbs_g,
      fat_g: resolved.fat_g,
      starchyCarbs_g: resolved.starchyCarbs_g,
      fibrousCarbs_g: resolved.fibrousCarbs_g,
    };
  }, [user?.id, targetsOverride]);

  const hasTargets = targets.calories > 0 || targets.protein_g > 0;

  const consumed = useMemo(() => {
    if (consumedOverride) {
      return consumedOverride;
    }
    return {
      calories: todayMacros.kcal,
      protein: todayMacros.protein,
      carbs: todayMacros.carbs,
      fat: todayMacros.fat,
    };
  }, [consumedOverride, todayMacros]);

  // Check if we have starchy/fibrous breakdown - requires BOTH targets AND consumed data with actual values
  // This prevents showing 5-column layout with zeros when meal data lacks starchy/fibrous breakdown
  const hasStarchyFibrousTargets = (targets.starchyCarbs_g ?? 0) > 0 || (targets.fibrousCarbs_g ?? 0) > 0;
  // Check if consumed data has actual starchy/fibrous values (not just zeros when total carbs exists)
  const consumedStarchyFibrous = (consumed.starchyCarbs ?? 0) + (consumed.fibrousCarbs ?? 0);
  const consumedHasMeaningfulBreakdown = consumedStarchyFibrous > 0 || consumed.carbs === 0;
  // Show breakdown only when we have targets AND the consumed data has meaningful starchy/fibrous values
  const showStarchyFibrousBreakdown = hasStarchyFibrousTargets && consumedHasMeaningfulBreakdown;

  const remaining = useMemo(() => ({
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein_g - consumed.protein),
    carbs: Math.max(0, targets.carbs_g - consumed.carbs),
    fat: Math.max(0, targets.fat_g - consumed.fat),
    // Starchy/fibrous breakdown
    starchyCarbs: Math.max(0, (targets.starchyCarbs_g ?? 0) - (consumed.starchyCarbs ?? 0)),
    fibrousCarbs: Math.max(0, (targets.fibrousCarbs_g ?? 0) - (consumed.fibrousCarbs ?? 0)),
  }), [targets, consumed]);

  const colorState = useMemo(() => ({
    calories: getMacroProgressColor(consumed.calories, targets.calories),
    protein: getMacroProgressColor(consumed.protein, targets.protein_g),
    carbs: getMacroProgressColor(consumed.carbs, targets.carbs_g),
    fat: getMacroProgressColor(consumed.fat, targets.fat_g),
    // Starchy/fibrous breakdown colors
    starchyCarbs: getMacroProgressColor(consumed.starchyCarbs ?? 0, targets.starchyCarbs_g ?? 0),
    fibrousCarbs: getMacroProgressColor(consumed.fibrousCarbs ?? 0, targets.fibrousCarbs_g ?? 0),
  }), [consumed, targets]);

  const isInline = layoutMode === "inline";
  const containerClass = isInline 
    ? `w-full ${className}`
    : `${MPM_STICKY_FOOTER.container} ${className}`;
  const innerClass = isInline
    ? `${MPM_GLASS.medium} rounded-2xl p-4`
    : `${MPM_GLASS.medium} border-t border-white/10 ${MPM_STICKY_FOOTER.safeArea}`;
  const contentClass = isInline
    ? ""
    : MPM_STICKY_FOOTER.content;

  if (!hasTargets) {
    return (
      <div className={containerClass}>
        <div className={`${innerClass} px-4 py-3`}>
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Flame className="w-4 h-4" />
            <span>Set your macros in the Macro Calculator to see remaining</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        <div className={contentClass}>
          {showSaveButton && onSaveDay && (
            <button
              onClick={onSaveDay}
              className="w-full mb-3 py-2.5 bg-gradient-to-r from-zinc-900 to-zinc-900 hover:from-zinc-900 hover:to-zinc-900 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg border-2 border-zinc-700/90 especially effective for00/60"
            >
              Save Day to Biometrics
            </button>
          )}

          <div className="flex items-center justify-center mb-2">
            <span className="text-white/70 text-xs font-medium uppercase tracking-wide">
              Remaining Today
            </span>
          </div>

          {/* Show 5-column layout with starchy/fibrous breakdown when available, otherwise 4-column */}
          <div className={`grid gap-2 ${showStarchyFibrousBreakdown ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <MacroCell
              label="Cal"
              remaining={remaining.calories}
              target={targets.calories}
              consumed={consumed.calories}
              colorState={colorState.calories}
            />
            <MacroCell
              label="Protein*"
              remaining={remaining.protein}
              target={targets.protein_g}
              consumed={consumed.protein}
              colorState={colorState.protein}
              suffix="g"
            />
            {showStarchyFibrousBreakdown ? (
              <>
                <MacroCell
                  label="Starchy*"
                  remaining={remaining.starchyCarbs}
                  target={targets.starchyCarbs_g ?? 0}
                  consumed={consumed.starchyCarbs ?? 0}
                  colorState={colorState.starchyCarbs}
                  suffix="g"
                />
                <MacroCell
                  label="Fibrous*"
                  remaining={remaining.fibrousCarbs}
                  target={targets.fibrousCarbs_g ?? 0}
                  consumed={consumed.fibrousCarbs ?? 0}
                  colorState={colorState.fibrousCarbs}
                  suffix="g"
                />
              </>
            ) : (
              <MacroCell
                label="Carbs*"
                remaining={remaining.carbs}
                target={targets.carbs_g}
                consumed={consumed.carbs}
                colorState={colorState.carbs}
                suffix="g"
              />
            )}
            <MacroCell
              label="Fat"
              remaining={remaining.fat}
              target={targets.fat_g}
              consumed={consumed.fat}
              colorState={colorState.fat}
              suffix="g"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface MacroCellProps {
  label: string;
  remaining: number;
  target: number;
  consumed: number;
  colorState: keyof typeof MPM_MACRO_COLORS;
  suffix?: string;
}

function MacroCell({
  label,
  remaining,
  target,
  consumed,
  colorState,
  suffix = "",
}: MacroCellProps) {
  const color = MPM_MACRO_COLORS[colorState];
  const isOver = consumed > target && target > 0;
  const percentage = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;

  return (
    <div className="flex flex-col items-center bg-black/20 rounded-lg px-1.5 py-1.5">
      <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-base font-bold ${isOver ? color.text : "text-white"}`}>
        {isOver ? `+${Math.round(consumed - target)}` : Math.round(remaining)}
        <span className="text-[10px] font-normal text-white/60">{suffix}</span>
      </div>
      <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full ${color.bg} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
