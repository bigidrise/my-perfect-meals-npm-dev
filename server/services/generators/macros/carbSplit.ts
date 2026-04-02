/**
 * Carb split helper - classifies ingredients into starchy vs fibrous carbs
 * 
 * USES SHARED SOURCE OF TRUTH: shared/starchKeywords.ts
 */

import { STARCHY_KEYWORDS } from '../../../../shared/starchKeywords';
import { FIBROUS_KEYWORDS } from '../../../../shared/fibrousKeywords';

export interface CarbSplitResult {
  starchyGrams: number;
  fibrousGrams: number;
}

export function classifyIngredient(ingredientName: string): 'starchy' | 'fibrous' | 'unknown' {
  const name = ingredientName.toLowerCase();
  
  for (const keyword of STARCHY_KEYWORDS) {
    if (name.includes(keyword)) {
      return 'starchy';
    }
  }
  
  for (const keyword of FIBROUS_KEYWORDS) {
    if (name.includes(keyword)) {
      return 'fibrous';
    }
  }
  
  return 'unknown';
}

export function deriveCarbSplit(
  ingredients: Array<{ name?: string; item?: string; carbs?: number }> | undefined,
  totalCarbs: number
): CarbSplitResult {
  if (!ingredients || ingredients.length === 0) {
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  let starchyCount = 0;
  let fibrousCount = 0;

  for (const ing of ingredients) {
    const name = ing.name || ing.item || '';
    const classification = classifyIngredient(name);
    
    if (classification === 'starchy') {
      starchyCount++;
    } else if (classification === 'fibrous') {
      fibrousCount++;
    }
  }

  if (starchyCount === 0 && fibrousCount === 0) {
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  if (starchyCount === 0) {
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  if (fibrousCount === 0) {
    return { starchyGrams: totalCarbs, fibrousGrams: 0 };
  }

  // Starchy ingredients are the dominant carb driver — one portion of rice/potato
  // carries ~35-40g of carbs while a full cup of vegetables carries only ~5-8g.
  // Apply a minimum 80% floor: starchy always gets at least 80% when both exist.
  const proportional = starchyCount / (starchyCount + fibrousCount);
  const starchyRatio = Math.max(0.80, proportional);
  const starchyGrams = Math.round(totalCarbs * starchyRatio);

  return {
    starchyGrams,
    fibrousGrams: totalCarbs - starchyGrams,
  };
}
