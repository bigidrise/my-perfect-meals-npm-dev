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

    // Fibrous is checked first and wins — vegetable/produce ingredients are
    // always fibrous regardless of any starchy-sounding word in their name
    // (e.g. "cauliflower rice" matches fibrous via "cauliflower", so "rice"
    // is never evaluated and the ingredient is not dual-classified)
    let isFibrous = false;
    for (const keyword of FIBROUS_KEYWORDS) {
      if (name.includes(keyword)) {
        isFibrous = true;
        fibrousScore += 1;
        break;
      }
    }

    // Starchy check only runs when the ingredient is not already fibrous
    if (!isFibrous) {
      for (const keyword of STARCHY_KEYWORDS) {
        if (name.includes(keyword)) {
          starchyScore += 1;
          break;
        }
      }
    }
  }

  // ── Density-weighted attribution ───────────────────────────────────────────
  // Starchy ingredients (rice, potato, pasta) carry ~6× the carb density of
  // fibrous vegetables (broccoli, spinach, kale). Using a flat ingredient-count
  // ratio (1:1) incorrectly splits a "rice + broccoli" meal 50/50 even though
  // virtually all the carbs come from the rice. The 6:1 density weight produces
  // a calibrated estimate that reflects actual carb contribution:
  //   1 starch + 1 fibrous → 85.7% starchy  (was 50%)
  //   1 starch + 3 fibrous → 66.7% starchy  (was 25%)
  //   0 starch + N fibrous → 0% starchy     (unchanged)
  // Reference: cooked rice ~28g/100g, broccoli ~5g/100g → ratio ≈ 5.6 ≈ 6.
  const STARCHY_DENSITY = 6;
  const FIBROUS_DENSITY = 1;

  const weightedStarchy = starchyScore * STARCHY_DENSITY;
  const weightedFibrous = fibrousScore * FIBROUS_DENSITY;
  const totalWeight = weightedStarchy + weightedFibrous;

  if (totalWeight === 0) {
    // No classifiable ingredients — treat all carbs as starchy (conservative for
    // the starch budget: never silently zero-out starchy carbs when the split is unknown).
    return {
      starchyCarbs: totalCarbs,
      fibrousCarbs: 0,
      totalCarbs,
      derived: true,
    };
  }

  const starchyCarbs = Math.round(totalCarbs * (weightedStarchy / totalWeight));
  const fibrousCarbs = Math.max(0, totalCarbs - starchyCarbs);

  return {
    starchyCarbs,
    fibrousCarbs,
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
