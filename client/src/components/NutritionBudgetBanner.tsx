import { useNutritionBudget } from "@/hooks/useNutritionBudget";
import { Leaf, Wheat, Drumstick } from "lucide-react";

interface NutritionBudgetBannerProps {
  className?: string;
}

export function NutritionBudgetBanner({ className = "" }: NutritionBudgetBannerProps) {
  const budget = useNutritionBudget();

  if (!budget.hasTargets && !budget.hasStarchyFibrousTargets) {
    return null;
  }

  const hasProteinTarget = budget.targets.protein_g > 0;
  const hasStarchyTarget = budget.targets.starchyCarbs_g > 0;
  const hasFibrousTarget = budget.targets.fibrousCarbs_g > 0;

  if (!hasProteinTarget && !hasStarchyTarget && !hasFibrousTarget) {
    return null;
  }

  return (
    <div className={`bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-3 ${className}`}>
      <p className="text-xs text-gray-400 mb-2 font-medium">Today's Nutrition Balance</p>
      <p className="text-[10px] text-gray-500 mb-3">Here's what you have left for today</p>
      
      <div className="flex items-center gap-4 flex-wrap">
        {hasProteinTarget && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Drumstick className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Protein</p>
              <p className="text-sm font-semibold text-white">
                {Math.round(budget.remaining.protein)}g left
              </p>
            </div>
          </div>
        )}
        
        {hasStarchyTarget && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Wheat className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Starchy carbs</p>
              <p className="text-sm font-semibold text-white">
                {Math.round(budget.remaining.starchyCarbs)}g left
              </p>
            </div>
          </div>
        )}
        
        {hasFibrousTarget && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Fiber target</p>
              <p className="text-sm font-semibold text-white">
                {Math.round(budget.remaining.fibrousCarbs)}g left
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
