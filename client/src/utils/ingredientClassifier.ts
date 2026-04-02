import {
  IngredientCategory,
  MEAT_KEYWORDS,
  PRODUCE_KEYWORDS,
  DAIRY_KEYWORDS,
  FROZEN_KEYWORDS,
  BAKERY_KEYWORDS,
  PANTRY_KEYWORDS,
  PANTRY_STAPLES
} from '@/data/ingredientCategories';

import { STARCHY_KEYWORDS } from '../../../shared/starchKeywords';
import { FIBROUS_KEYWORDS } from '../../../shared/fibrousKeywords';

export { STARCHY_KEYWORDS, FIBROUS_KEYWORDS };

export interface ClassifiedIngredient {
  name: string;
  normalizedName: string;
  category: IngredientCategory;
  isPantryStaple: boolean;
}

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/,.*$/, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim();
}

function matchesKeywords(normalizedName: string, keywords: string[]): boolean {
  const nameWords = normalizedName.split(/\s+/);
  
  for (const keyword of keywords) {
    if (normalizedName === keyword) return true;
    
    const keywordWords = keyword.split(/\s+/);
    
    if (keywordWords.length === 1) {
      if (nameWords.includes(keyword)) return true;
    } else {
      if (normalizedName.includes(keyword)) return true;
    }
  }
  return false;
}

export function classifyIngredient(name: string): ClassifiedIngredient {
  const normalizedName = normalizeIngredientName(name);
  
  let category: IngredientCategory = 'Other';
  
  if (matchesKeywords(normalizedName, FROZEN_KEYWORDS)) {
    category = 'Frozen';
  } else if (matchesKeywords(normalizedName, MEAT_KEYWORDS)) {
    category = 'Meat';
  } else if (matchesKeywords(normalizedName, DAIRY_KEYWORDS)) {
    category = 'Dairy';
  } else if (matchesKeywords(normalizedName, PRODUCE_KEYWORDS)) {
    category = 'Produce';
  } else if (matchesKeywords(normalizedName, BAKERY_KEYWORDS)) {
    category = 'Bakery';
  } else if (matchesKeywords(normalizedName, PANTRY_KEYWORDS)) {
    category = 'Pantry';
  }
  
  const isPantryStaple = matchesKeywords(normalizedName, PANTRY_STAPLES);
  
  return {
    name,
    normalizedName,
    category,
    isPantryStaple
  };
}

export function classifyIngredients(names: string[]): ClassifiedIngredient[] {
  return names.map(classifyIngredient);
}

export interface StarchDetectionResult {
  hasStarchy: boolean;
  matchedTerms: string[];
}

/**
 * Detect starchy ingredients in user input text.
 * Uses the SHARED STARCHY_KEYWORDS list — same source of truth as the
 * server-side Starch Game Plan and client-side Starch Meal Classifier.
 * ALL starchy carbs (high-GI and moderate-GI) are detected identically.
 */
export function detectStarchyIngredients(input: string | string[]): StarchDetectionResult {
  const inputs = Array.isArray(input) ? input : [input];
  const matchedTerms: string[] = [];
  
  for (const text of inputs) {
    const normalized = text.toLowerCase().trim();
    
    for (const keyword of STARCHY_KEYWORDS) {
      if (keyword.length <= 4) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(normalized) && !matchedTerms.includes(keyword)) {
          matchedTerms.push(keyword);
        }
      } else {
        if (normalized.includes(keyword) && !matchedTerms.includes(keyword)) {
          matchedTerms.push(keyword);
        }
      }
    }
  }
  
  return {
    hasStarchy: matchedTerms.length > 0,
    matchedTerms,
  };
}

/**
 * Derive starchy and fibrous carb split from a meal's ingredients.
 * Client-side port of server/utils/carbClassifier.ts deriveCarbs —
 * uses the same shared keyword lists for identical classification.
 *
 * Supports both { name } and { item } ingredient shapes used across
 * template meals and premade meal data files.
 *
 * Returns { starchyCarbs: 0, fibrousCarbs: 0 } when no ingredients
 * are provided — caller should omit or keep those fields as-is.
 */
export function deriveSplitCarbs(
  ingredients: Array<{ name?: string; item?: string } | string>,
  totalCarbs: number,
): { starchyCarbs: number; fibrousCarbs: number } {
  if (!ingredients || ingredients.length === 0 || totalCarbs <= 0) {
    return { starchyCarbs: 0, fibrousCarbs: 0 };
  }

  let starchyScore = 0;
  let fibrousScore = 0;

  for (const ing of ingredients) {
    const raw = typeof ing === 'string' ? ing : (ing.name || (ing as any).item || '');
    const name = raw.toLowerCase().trim();

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
    return { starchyCarbs: 0, fibrousCarbs: totalCarbs };
  }

  return {
    starchyCarbs: Math.round(totalCarbs * (starchyScore / totalScore)),
    fibrousCarbs: Math.round(totalCarbs * (fibrousScore / totalScore)),
  };
}
