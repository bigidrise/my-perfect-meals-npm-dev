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
 */
export function getDayStarchStatus(meals: MealLike[]): {
  isUsed: boolean;
  starchMealCount: number;
  label: string;
} {
  let starchMealCount = 0;
  
  for (const meal of meals) {
    if (classifyMeal(meal).isStarchMeal) {
      starchMealCount++;
    }
  }
  
  return {
    isUsed: starchMealCount > 0,
    starchMealCount,
    label: starchMealCount > 0 ? 'Used' : 'Available',
  };
}
