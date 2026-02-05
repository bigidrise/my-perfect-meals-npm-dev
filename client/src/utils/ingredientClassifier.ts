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

export const STARCHY_KEYWORDS = [
  // Grains & Starches - actual carb-dense starches only
  'rice', 'pasta', 'noodle', 'bread', 'toast', 'bagel', 'bun', 'croissant',
  'oat', 'oatmeal', 'cereal', 'granola', 'wheat', 'barley', 'quinoa',
  'couscous', 'bulgur', 'farro', 'millet', 'polenta', 'grits', 'cornmeal',
  // Potatoes & Tubers
  'potato', 'potatoes', 'sweet potato', 'yam', 'tater', 'hash brown', 'fries', 'french fries',
  // Legumes (starchy)
  'lentil', 'lentils', 'chickpea', 'chickpeas', 'black bean', 'kidney bean',
  'pinto bean', 'navy bean', 'cannellini',
  // Corn & Starchy Vegetables
  'corn', 'tortilla', 'popcorn',
  // Note: Removed sweeteners (honey, sugar) and cooking methods (fried, breaded)
  // Those don't count toward starchy carb budget
];

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

export function detectStarchyIngredients(input: string | string[]): StarchDetectionResult {
  const inputs = Array.isArray(input) ? input : [input];
  const matchedTerms: string[] = [];
  
  for (const text of inputs) {
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/[\s,;.!?]+/).filter(Boolean);
    
    for (const keyword of STARCHY_KEYWORDS) {
      const keywordParts = keyword.split(' ');
      
      if (keywordParts.length === 1) {
        if (words.includes(keyword)) {
          if (!matchedTerms.includes(keyword)) {
            matchedTerms.push(keyword);
          }
        }
      } else {
        const pattern = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (pattern.test(normalized)) {
          if (!matchedTerms.includes(keyword)) {
            matchedTerms.push(keyword);
          }
        }
      }
    }
  }
  
  return {
    hasStarchy: matchedTerms.length > 0,
    matchedTerms,
  };
}
