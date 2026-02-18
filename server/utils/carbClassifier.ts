/**
 * Ingredient-based Carb Classifier
 * 
 * NON-NEGOTIABLE PRODUCT DOCTRINE:
 * "Ingredient-based carb derivation must occur in the meal generation pipeline and be persisted.
 *  The UI must not infer, calculate, guess, or repair macros. Ever."
 * 
 * This utility analyzes ingredients and derives starchyCarbs/fibrousCarbs when AI returns 0s.
 * Called POST-PARSE, BEFORE SAVING, in the meal generation pipeline.
 * 
 * USES SHARED SOURCE OF TRUTH: shared/starchKeywords.ts
 */

import { STARCHY_KEYWORDS } from '../../shared/starchKeywords';

const FIBROUS_KEYWORDS = [
  'spinach', 'lettuce', 'kale', 'arugula', 'chard', 'collard', 'romaine',
  'mixed greens', 'spring mix', 'salad', 'cabbage', 'bok choy', 'watercress',
  'broccoli', 'cauliflower', 'brussels sprout', 'kohlrabi',
  'pepper', 'bell pepper', 'jalapeno', 'onion', 'garlic', 'shallot', 'leek',
  'scallion', 'green onion', 'chive',
  'tomato', 'cucumber', 'zucchini', 'squash', 'eggplant', 'mushroom',
  'asparagus', 'artichoke', 'celery', 'carrot', 'radish', 'turnip', 'beet',
  'green bean', 'snap pea', 'snow pea', 'okra',
  'basil', 'cilantro', 'parsley', 'dill', 'mint', 'oregano', 'thyme', 'rosemary',
];

interface Ingredient {
  name?: string;
  item?: string;
  quantity?: number | string;
  amount?: number | string;
  unit?: string;
}

interface CarbClassification {
  starchyCarbs: number;
  fibrousCarbs: number;
  totalCarbs: number;
  derived: boolean;
}

/**
 * Analyze ingredients and derive starchy/fibrous carb split
 * Called when AI returns 0s but ingredients exist
 */
export function deriveCarbs(
  ingredients: (string | Ingredient)[],
  totalCarbs: number
): CarbClassification {
  if (!ingredients || ingredients.length === 0) {
    return { starchyCarbs: 0, fibrousCarbs: 0, totalCarbs, derived: false };
  }

  let starchyScore = 0;
  let fibrousScore = 0;

  for (const ing of ingredients) {
    const name = (typeof ing === 'string' ? ing : (ing.name || ing.item || '')).toLowerCase();
    
    for (const keyword of STARCHY_KEYWORDS) {
      if (name.includes(keyword)) {
        starchyScore += 1;
        break;
      }
    }
    
    for (const keyword of FIBROUS_KEYWORDS) {
      if (name.includes(keyword)) {
        fibrousScore += 1;
        break;
      }
    }
  }

  const totalScore = starchyScore + fibrousScore;
  
  if (totalScore === 0) {
    return {
      starchyCarbs: Math.round(totalCarbs * 0.6),
      fibrousCarbs: Math.round(totalCarbs * 0.4),
      totalCarbs,
      derived: true,
    };
  }

  const starchyRatio = starchyScore / totalScore;
  const fibrousRatio = fibrousScore / totalScore;

  return {
    starchyCarbs: Math.round(totalCarbs * starchyRatio),
    fibrousCarbs: Math.round(totalCarbs * fibrousRatio),
    totalCarbs,
    derived: true,
  };
}

/**
 * Enforce carb split on a meal object
 * Returns the meal with guaranteed starchyCarbs/fibrousCarbs values
 * 
 * CRITICAL: This function must be called POST-PARSE, BEFORE SAVING
 */
export function enforceCarbs<T extends {
  starchyCarbs?: number;
  fibrousCarbs?: number;
  carbs?: number;
  nutrition?: {
    carbs?: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  ingredients?: (string | Ingredient)[];
}>(meal: T): T {
  const ingredients = meal.ingredients || [];
  
  const existingStarchy = meal.starchyCarbs ?? meal.nutrition?.starchyCarbs ?? 0;
  const existingFibrous = meal.fibrousCarbs ?? meal.nutrition?.fibrousCarbs ?? 0;
  const totalCarbs = meal.carbs ?? meal.nutrition?.carbs ?? 0;
  
  if (existingStarchy > 0 || existingFibrous > 0) {
    return meal;
  }
  
  if (totalCarbs === 0) {
    return meal;
  }
  
  const derived = deriveCarbs(ingredients, totalCarbs);
  
  console.log(`🥕 Carb enforcement: ${totalCarbs}g total → ${derived.starchyCarbs}g starchy, ${derived.fibrousCarbs}g fibrous (derived from ${ingredients.length} ingredients)`);
  
  return {
    ...meal,
    starchyCarbs: derived.starchyCarbs,
    fibrousCarbs: derived.fibrousCarbs,
    nutrition: meal.nutrition ? {
      ...meal.nutrition,
      starchyCarbs: derived.starchyCarbs,
      fibrousCarbs: derived.fibrousCarbs,
    } : undefined,
  };
}
