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

/**
 * HIGH-GLYCEMIC STARCHES ONLY
 * 
 * These are the starches that spike insulin and cause weight gain.
 * Real nutrition people know the difference:
 * 
 * BLOCK: White potato, white rice, refined bread/pasta (GI 70-90+)
 * ALLOW: Corn, beans, sweet potato, oats, quinoa (GI 20-55, high fiber)
 * 
 * The goal is insulin/glucose management for weight control.
 */
export const STARCHY_KEYWORDS = [
  // White potato products (HIGH GI ~80-90) - THE #1 PROBLEM
  'potato', 'potatoes', 'tater', 'hash brown', 'hashbrown',
  'french fries', 'fries', 'mashed potato', 'baked potato',
  
  // White rice (HIGH GI ~70-90)
  'rice', // generic rice assumed white (brown rice handled separately)
  
  // Refined wheat/flour products (HIGH GI ~70-85)
  'bread', 'toast', 'bagel', 'bun', 'roll', 'croissant', 'biscuit',
  'pasta', 'spaghetti', 'noodle', 'noodles', 'macaroni', 'penne', 'fettuccine', 'linguine',
  'pancake', 'waffle', 'crepe',
  
  // Refined grains (HIGH GI)
  'couscous', 'polenta', 'grits',
];

// These OVERRIDE the starchy keywords - they're safe
export const ALLOWED_CARBS = [
  // Sweet potato (Moderate GI, high fiber)
  'sweet potato', 'yam',
  // Brown/wild rice (Lower GI due to fiber)
  'brown rice', 'wild rice',
  // Corn (Moderate GI, high fiber - won't spike like rice/potato)
  'corn',
  // Legumes (LOW GI 20-40, high protein + fiber)
  'bean', 'beans', 'lentil', 'chickpea', 'pea', 'edamame',
  // Whole grains (Moderate GI, fiber)
  'oat', 'oatmeal', 'quinoa', 'barley', 'bulgur', 'farro', 'millet',
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
    
    // First check if any ALLOWED carbs are present - these override starchy detection
    // e.g., "sweet potato" should NOT trigger "potato" match
    // e.g., "brown rice" should NOT trigger "rice" match
    // e.g., "corn" should never be blocked
    let hasAllowedCarb = false;
    for (const allowed of ALLOWED_CARBS) {
      const allowedParts = allowed.split(' ');
      if (allowedParts.length === 1) {
        if (words.includes(allowed)) {
          hasAllowedCarb = true;
        }
      } else {
        if (normalized.includes(allowed)) {
          hasAllowedCarb = true;
        }
      }
    }
    
    // If user mentions an allowed carb alongside a starchy one, 
    // we need smarter matching. Check each starchy keyword.
    for (const keyword of STARCHY_KEYWORDS) {
      const keywordParts = keyword.split(' ');
      let foundMatch = false;
      
      if (keywordParts.length === 1) {
        if (words.includes(keyword)) {
          foundMatch = true;
        }
      } else {
        const pattern = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (pattern.test(normalized)) {
          foundMatch = true;
        }
      }
      
      if (foundMatch) {
        // Check if this specific match is overridden by an allowed carb
        // e.g., "rice" is overridden if "brown rice" or "wild rice" is present
        // e.g., "potato" is overridden if "sweet potato" is present
        let isOverridden = false;
        
        for (const allowed of ALLOWED_CARBS) {
          // If the allowed carb contains this keyword, check if user used the allowed version
          if (allowed.includes(keyword)) {
            if (normalized.includes(allowed)) {
              isOverridden = true;
              break;
            }
          }
        }
        
        if (!isOverridden && !matchedTerms.includes(keyword)) {
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
