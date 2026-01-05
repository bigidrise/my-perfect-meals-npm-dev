import { classifyMeal, StarchClassification } from '@/utils/starchMealClassifier';

interface Ingredient {
  name?: string;
  item?: string;
  quantity?: string | number;
  unit?: string;
}

interface StarchMealBadgeProps {
  meal: {
    name?: string;
    ingredients?: (string | Ingredient)[];
  };
  className?: string;
}

export function StarchMealBadge({ meal, className = '' }: StarchMealBadgeProps) {
  const classification = classifyMeal(meal);
  
  return (
    <span 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        classification.isStarchMeal 
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      } ${className}`}
    >
      {classification.emoji} {classification.label}
    </span>
  );
}
