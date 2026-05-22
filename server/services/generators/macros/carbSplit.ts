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
      console.log('[CLASSIFY]', JSON.stringify(ingredientName), '→ starchy (matched:', JSON.stringify(keyword), ')');
      return 'starchy';
    }
  }
  
  for (const keyword of FIBROUS_KEYWORDS) {
    if (name.includes(keyword)) {
      console.log('[CLASSIFY]', JSON.stringify(ingredientName), '→ fibrous (matched:', JSON.stringify(keyword), ')');
      return 'fibrous';
    }
  }
  
  console.log('[CLASSIFY]', JSON.stringify(ingredientName), '→ unknown (no match)');
  return 'unknown';
}

export function deriveCarbSplit(
  ingredients: Array<{ name?: string; item?: string; carbs?: number }> | undefined,
  totalCarbs: number
): CarbSplitResult {
  if (!ingredients || ingredients.length === 0) {
    console.log('[CARB_SPLIT] no ingredients → fallback starchy=0 fibrous=%d', totalCarbs);
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  let starchyCount = 0;
  let fibrousCount = 0;
  const perIngredient: Array<{ name: string; result: string }> = [];

  for (const ing of ingredients) {
    const name = ing.name || ing.item || '';
    const classification = classifyIngredient(name);
    perIngredient.push({ name, result: classification });
    
    if (classification === 'starchy') {
      starchyCount++;
    } else if (classification === 'fibrous') {
      fibrousCount++;
    }
  }

  const totalClassified = starchyCount + fibrousCount;

  if (totalClassified === 0) {
    console.log('[CARB_SPLIT] totalClassified=0 (all unknown) → fallback starchy=0 fibrous=%d | ingredients=%j', totalCarbs, perIngredient);
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  const starchyRatio = starchyCount / totalClassified;
  const fibrousRatio = fibrousCount / totalClassified;
  const result = {
    starchyGrams: Math.round(totalCarbs * starchyRatio),
    fibrousGrams: Math.round(totalCarbs * fibrousRatio),
  };

  console.log('[CARB_SPLIT] totalCarbs=%d starchyCount=%d fibrousCount=%d starchyRatio=%s fibrousRatio=%s → starchy=%d fibrous=%d | ingredients=%j',
    totalCarbs, starchyCount, fibrousCount,
    starchyRatio.toFixed(2), fibrousRatio.toFixed(2),
    result.starchyGrams, result.fibrousGrams,
    perIngredient
  );

  return result;
}
