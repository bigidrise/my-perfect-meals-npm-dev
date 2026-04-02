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
import { FIBROUS_KEYWORDS } from '../../shared/fibrousKeywords';

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

  if (starchyScore === 0 && fibrousScore === 0) {
    return { starchyCarbs: 0, fibrousCarbs: totalCarbs, totalCarbs, derived: true };
  }

  if (starchyScore === 0) {
    return { starchyCarbs: 0, fibrousCarbs: totalCarbs, totalCarbs, derived: true };
  }

  if (fibrousScore === 0) {
    return { starchyCarbs: totalCarbs, fibrousCarbs: 0, totalCarbs, derived: true };
  }

  // Starchy ingredients are the dominant carb driver — one portion of rice/potato
  // carries ~35-40g of carbs while a full cup of vegetables carries only ~5-8g.
  // A simple ingredient count ratio severely under-allocates starchy carbs.
  // Apply a minimum 80% floor: starchy always gets at least 80% when both exist.
  const proportional = starchyScore / (starchyScore + fibrousScore);
  const starchyRatio = Math.max(0.80, proportional);
  const starchyCarbs = Math.round(totalCarbs * starchyRatio);

  return {
    starchyCarbs,
    fibrousCarbs: totalCarbs - starchyCarbs,
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
