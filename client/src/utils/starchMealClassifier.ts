/**
 * Starch Meal Classifier
 * 
 * Categorical classification of meals as "Starch Meal" or "Fiber-Based Meal"
 * for the Daily Starch Meal coaching system on meal boards.
 * 
 * USES SHARED SOURCE OF TRUTH: shared/starchKeywords.ts
 * This ensures the client-side indicator and server-side Starch Game Plan
 * always agree on what counts as a starchy carb.
 */

import { STARCHY_KEYWORDS } from '../../../shared/starchKeywords';

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
  matchedStarch?: string;
}

/**
 * Check if an ingredient contains any starchy carb
 * Uses the shared STARCHY_KEYWORDS list for consistency with server-side logic
 */
function containsStarch(ingredientName: string): string | null {
  const name = ingredientName.toLowerCase().trim();
  
  for (const starch of STARCHY_KEYWORDS) {
    if (starch.length <= 4) {
      const regex = new RegExp(`\\b${starch}\\b`, 'i');
      if (regex.test(name)) {
        return starch;
      }
    } else {
      if (name.includes(starch)) {
        return starch;
      }
    }
  }
  
  return null;
}

/**
 * Classify a meal as Starch or Fiber-Based
 * Any meal containing a starchy carb ingredient counts as a Starch Meal
 */
export function classifyMeal(meal: MealLike): StarchClassification {
  const ingredients = meal.ingredients || [];
  
  for (const ing of ingredients) {
    const name = typeof ing === 'string' ? ing : (ing.name || ing.item || '');
    const matchedStarch = containsStarch(name);
    
    if (matchedStarch) {
      return {
        isStarchMeal: true,
        label: 'Starch Meal',
        emoji: '🟠',
        matchedStarch,
      };
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
  
  let label: string;
  if (maxSlots === 1) {
    label = starchMealCount > 0 ? 'Used' : 'Available';
  } else {
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
