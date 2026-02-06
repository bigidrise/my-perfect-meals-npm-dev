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

export { STARCHY_KEYWORDS };

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
