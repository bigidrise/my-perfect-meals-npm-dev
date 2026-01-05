import { getDayStarchStatus } from '@/utils/starchMealClassifier';
import { getResolvedTargets } from '@/lib/macroResolver';
import { useAuth } from '@/contexts/AuthContext';

interface Meal {
  name?: string;
  ingredients?: (string | { name?: string; item?: string })[];
}

interface DailyStarchIndicatorProps {
  meals: Meal[];
  compact?: boolean;
  /** Override the strategy - useful when board knows the strategy */
  strategyOverride?: 'one' | 'flex';
}

export function DailyStarchIndicator({ meals, compact = false, strategyOverride }: DailyStarchIndicatorProps) {
  const { user } = useAuth();
  
  // Get strategy from macroResolver (respects pro override) or use override
  const resolvedTargets = getResolvedTargets(user?.id);
  const strategy = strategyOverride || resolvedTargets.starchStrategy || 'one';
  const maxSlots = strategy === 'flex' ? 2 : 1;
  
  const status = getDayStarchStatus(meals, maxSlots);
  
  // Determine color: green = slots available, orange = all used, red = over limit
  const isOver = status.starchMealCount > maxSlots;
  const colorClass = isOver 
    ? 'text-red-500' 
    : status.isUsed 
      ? 'text-orange-500' 
      : 'text-green-500';
  
  const emoji = isOver ? '🔴' : status.isUsed ? '🟠' : '🟢';
  
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span>{emoji}</span>
        <span className={colorClass}>
          {status.label}
        </span>
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
        <span className="text-red-400 text-[10px]">
          (over limit)
        </span>
      )}
    </div>
  );
}
