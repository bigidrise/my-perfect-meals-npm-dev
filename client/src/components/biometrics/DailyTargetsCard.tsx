import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getResolvedTargets } from "@/lib/macroResolver";

interface DailyTargetsCardProps {
  userId?: string;
  onQuickAddClick: () => void;
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
  targetsOverride,
}: DailyTargetsCardProps) {
  const resolved = targetsOverride || getResolvedTargets(userId);
  const hasTargets = (resolved.protein_g || 0) > 0 || (resolved.carbs_g || 0) > 0;

  if (!hasTargets) return null;

  const hasStarchyFibrous = (resolved.starchyCarbs_g ?? 0) > 0 || (resolved.fibrousCarbs_g ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Daily Targets</span>
          <Button
            onClick={onQuickAddClick}
            className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            data-testid="button-quick-add-macros"
          >
            <Plus className="h-4 w-4 mr-1" />
            Quick Add
          </Button>
        </div>
        {hasStarchyFibrous ? (
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
              <div className="text-lg font-bold text-white">{Math.round(resolved.starchyCarbs_g ?? 0)}g</div>
              <div className="text-xs text-white/60">Starchy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Math.round(resolved.fibrousCarbs_g ?? 0)}g</div>
              <div className="text-xs text-white/60">Fibrous</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Math.round(resolved.fat_g || 0)}g</div>
              <div className="text-xs text-white/60">Fat</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Math.round(resolved.protein_g || 0)}g</div>
              <div className="text-xs text-white/60">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Math.round(resolved.carbs_g || 0)}g</div>
              <div className="text-xs text-white/60">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{Math.round(resolved.fat_g || 0)}g</div>
              <div className="text-xs text-white/60">Fat</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
