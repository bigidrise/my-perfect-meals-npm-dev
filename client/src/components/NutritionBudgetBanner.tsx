import { useNutritionBudget, NutrientStatus } from "@/hooks/useNutritionBudget";
import { Leaf, Wheat, Drumstick, CheckCircle2 } from "lucide-react";

interface NutritionBudgetBannerProps {
  className?: string;
}

const getStatusText = (status: NutrientStatus, remaining: number, nutrientLabel: string) => {
  const shortName = nutrientLabel.replace(' target', '').toLowerCase();
  switch (status) {
    case 'over':
      return `You've used your ${shortName}`;
    case 'exhausted':
      return `${shortName} used up`;
    case 'low':
      return `${Math.round(remaining)}g left`;
    default:
      return `${Math.round(remaining)}g left`;
  }
};

const getCoachingMessage = (status: { protein: NutrientStatus; starchyCarbs: NutrientStatus; fibrousCarbs: NutrientStatus }) => {
  if (status.starchyCarbs === 'over' || status.starchyCarbs === 'exhausted') {
    return "Your body will feel better finishing the day with fiber-rich options.";
  }
  if (status.protein === 'over' || status.protein === 'exhausted') {
    return "You've hit your protein goal for today. Great job!";
  }
  if (status.fibrousCarbs === 'over') {
    return "Excellent fiber intake today!";
  }
  if (status.starchyCarbs === 'low') {
    return "Consider saving your remaining starchy carbs for later.";
  }
  if (status.protein === 'low') {
    return "Protein-forward options will help you hit your target.";
  }
  if (status.fibrousCarbs === 'low' || status.fibrousCarbs === 'exhausted') {
    return "Try adding more vegetables to reach your fiber goal.";
  }
  return null;
};

const baseColorClasses: Record<string, { bg: string; icon: string }> = {
  blue: { bg: 'bg-blue-500/20', icon: 'text-blue-400' },
  amber: { bg: 'bg-amber-500/20', icon: 'text-amber-400' },
  emerald: { bg: 'bg-emerald-500/20', icon: 'text-emerald-400' },
};

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

  const coachingMessage = getCoachingMessage(budget.status);

  return (
    <div className={`bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-3 ${className}`}>
      <p className="text-xs text-gray-400 mb-1 font-medium">Today's Nutrition Balance</p>
      <p className="text-[10px] text-gray-500 mb-3">Here's what you have left for today</p>
      
      <div className="flex items-center gap-4 flex-wrap">
        {hasProteinTarget && (
          <NutrientItem
            icon={Drumstick}
            label="Protein"
            remaining={budget.remaining.protein}
            status={budget.status.protein}
            baseColor="blue"
          />
        )}
        
        {hasStarchyTarget && (
          <NutrientItem
            icon={Wheat}
            label="Starchy carbs"
            remaining={budget.remaining.starchyCarbs}
            status={budget.status.starchyCarbs}
            baseColor="amber"
          />
        )}
        
        {hasFibrousTarget && (
          <NutrientItem
            icon={Leaf}
            label="Fiber target"
            remaining={budget.remaining.fibrousCarbs}
            status={budget.status.fibrousCarbs}
            baseColor="emerald"
          />
        )}
      </div>

      {coachingMessage && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-gray-400 italic">{coachingMessage}</p>
        </div>
      )}
    </div>
  );
}

interface NutrientItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  remaining: number;
  status: NutrientStatus;
  baseColor: 'blue' | 'amber' | 'emerald';
}

function NutrientItem({ icon: Icon, label, remaining, status, baseColor }: NutrientItemProps) {
  const isComplete = status === 'exhausted' || status === 'over';
  const baseClasses = baseColorClasses[baseColor];
  
  const bgColor = status === 'over' ? 'bg-rose-500/20' : 
                  status === 'exhausted' ? 'bg-amber-500/20' : 
                  baseClasses.bg;
  
  const iconColor = status === 'over' ? 'text-rose-400' : 
                    status === 'exhausted' ? 'text-amber-400' : 
                    baseClasses.icon;
  
  const textColor = status === 'over' ? 'text-rose-300' : 
                    status === 'exhausted' ? 'text-amber-300' : 
                    'text-white';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full ${bgColor} flex items-center justify-center`}>
        {isComplete ? (
          <CheckCircle2 className={`w-3.5 h-3.5 ${iconColor}`} />
        ) : (
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        )}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-semibold ${textColor}`}>
          {getStatusText(status, remaining, label)}
        </p>
      </div>
    </div>
  );
}
