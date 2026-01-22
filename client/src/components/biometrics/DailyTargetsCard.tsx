import { PillButton } from "@/components/ui/pill-button";
import { getResolvedTargets } from "@/lib/macroResolver";

interface DailyTargetsCardProps {
  userId?: string;
  onQuickAddClick?: () => void;
  showQuickAddButton?: boolean;
  targetsOverride?: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    starchyCarbs_g?: number;
    fibrousCarbs_g?: number;
  };
}

export function DailyTargetsCard({
  userId,
  onQuickAddClick,
  showQuickAddButton = true,
  targetsOverride,
}: DailyTargetsCardProps) {
  const resolved = targetsOverride || getResolvedTargets(userId);
  const starchyCarbs = resolved.starchyCarbs_g ?? 0;
  const fibrousCarbs = resolved.fibrousCarbs_g ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Daily Targets</span>
          {showQuickAddButton && onQuickAddClick && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">QUICK</span>
              <PillButton
                onClick={onQuickAddClick}
                data-testid="button-quick-add-macros"
              >
                Add
              </PillButton>
            </div>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.protein_g || 0)}g</div>
            <div className="text-xs text-white/60">Protein</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.carbs_g || 0)}g</div>
            <div className="text-xs text-white/60">Total Carbs</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(starchyCarbs)}g</div>
            <div className="text-xs text-white/60">Starchy</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(fibrousCarbs)}g</div>
            <div className="text-xs text-white/60">Fibrous</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.fat_g || 0)}g</div>
            <div className="text-xs text-white/60">Fat</div>
          </div>
        </div>
      </div>
    </div>
  );
}
