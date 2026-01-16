/**
 * Starch Meal Classifier
 * 
 * Categorical classification of meals as "Starch Meal" or "Fiber-Based Meal"
 * for the Daily Starch Meal coaching system on meal boards.
 * 
 * This is behavioral guidance, not macro tracking.
 * Classification is based on ingredient keywords, not gram calculations.
 */

const STARCHY_KEYWORDS = [
  'rice', 'pasta', 'noodle', 'bread', 'toast', 'bagel', 'roll', 'bun', 'croissant',
  'oat', 'oatmeal', 'cereal', 'granola', 'flour', 'wheat', 'barley', 'quinoa',
  'couscous', 'bulgur', 'farro', 'millet', 'polenta', 'grits', 'cornmeal',
  'potato', 'sweet potato', 'yam', 'tater', 'hash brown', 'fries', 'french fries',
  'bean', 'lentil', 'chickpea', 'hummus', 'pea', 'black bean', 'kidney bean',
  'pinto bean', 'navy bean', 'cannellini', 'edamame',
  'corn', 'tortilla', 'chip', 'cracker', 'pretzel', 'popcorn',
  'breaded', 'crusted', 'battered', 'fried',
];

interface Ingredient {
  name?: string;
  item?: string;
  quantity?: string | number;
  unit?: string;
}

interface MealLike {
  name?: string;
  ingredients?: (string | Ingredient)[];
}

export interface StarchClassification {
  isStarchMeal: boolean;
  label: string;
  emoji: string;
}

/**
 * Classify a meal as Starch or Fiber-Based
 * Returns categorical classification for UI display
 */
export function classifyMeal(meal: MealLike): StarchClassification {
  const ingredients = meal.ingredients || [];
  
  for (const ing of ingredients) {
    const name = (typeof ing === 'string' ? ing : (ing.name || ing.item || '')).toLowerCase();
    
    for (const keyword of STARCHY_KEYWORDS) {
      if (name.includes(keyword)) {
        return {
          isStarchMeal: true,
          label: 'Starch Meal',
          emoji: '🟠',
        };
      }
    }
  }
  
  return {
    isStarchMeal: false,
    label: 'Fiber-Based',
    emoji: '🟢',
  };
}

/**
 * Check if a day has used its starch meal allocation
 * @param meals - List of meals for the day
 * @param maxSlots - Maximum starch meals allowed (1 = "one" strategy, 2 = "flex" strategy)
 */
export function getDayStarchStatus(meals: MealLike[], maxSlots: number = 1): {
  isUsed: boolean;
  starchMealCount: number;
  slotsRemaining: number;
  maxSlots: number;
  label: string;
} {
  let starchMealCount = 0;
  
  for (const meal of meals) {
    if (classifyMeal(meal).isStarchMeal) {
      starchMealCount++;
    }
  }
  
  const slotsRemaining = Math.max(0, maxSlots - starchMealCount);
  const isUsed = slotsRemaining === 0;
  
  // Generate label based on slots
  let label: string;
  if (maxSlots === 1) {
    label = starchMealCount > 0 ? 'Used' : 'Available';
  } else {
    // Flex mode: show remaining slots
    if (slotsRemaining === 0) {
      label = 'Both Used';
    } else if (slotsRemaining === maxSlots) {
      label = `${maxSlots} Available`;
    } else {
      label = `${slotsRemaining} Remaining`;
    }
  }
  
  return {
    isUsed,
    starchMealCount,
    slotsRemaining,
    maxSlots,
    label,
  };
}
