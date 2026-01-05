import { getDayStarchStatus } from '@/utils/starchMealClassifier';

interface Meal {
  name?: string;
  ingredients?: (string | { name?: string; item?: string })[];
}

interface DailyStarchIndicatorProps {
  meals: Meal[];
  compact?: boolean;
}

export function DailyStarchIndicator({ meals, compact = false }: DailyStarchIndicatorProps) {
  const status = getDayStarchStatus(meals);
  
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span>{status.isUsed ? '🟠' : '🟢'}</span>
        <span className={status.isUsed ? 'text-orange-600' : 'text-green-600'}>
          {status.label}
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 text-xs">
      <span className="font-medium text-muted-foreground">Daily Starch:</span>
      <span className={`flex items-center gap-1 ${status.isUsed ? 'text-orange-600' : 'text-green-600'}`}>
        {status.isUsed ? '🟠' : '🟢'} {status.label}
      </span>
      {status.starchMealCount > 1 && (
        <span className="text-orange-500 text-[10px]">
          ({status.starchMealCount} starch meals)
        </span>
      )}
    </div>
  );
}
