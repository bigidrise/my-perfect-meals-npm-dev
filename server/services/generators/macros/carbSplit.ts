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

  const totalClassified = starchyCount + fibrousCount;
  
  if (totalClassified === 0) {
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  const starchyRatio = starchyCount / (totalClassified || 1);
  const fibrousRatio = fibrousCount / (totalClassified || 1);

  return {
    starchyGrams: Math.round(totalCarbs * starchyRatio),
    fibrousGrams: Math.round(totalCarbs * fibrousRatio),
  };
}
