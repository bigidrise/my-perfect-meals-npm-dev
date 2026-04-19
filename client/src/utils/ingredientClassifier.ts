import {
  IngredientCategory,
  MEAT_KEYWORDS,
  PLANT_PROTEIN_KEYWORDS,
  PRODUCE_KEYWORDS,
  DAIRY_KEYWORDS,
  FROZEN_KEYWORDS,
  BAKERY_KEYWORDS,
  PANTRY_KEYWORDS,
  PANTRY_STAPLES,
  PANTRY_SPICE_OVERRIDES,
} from '@/data/ingredientCategories';

import { STARCHY_KEYWORDS, EXPLICIT_STARCH_KEYWORDS } from '../../../shared/starchKeywords';
import { FIBROUS_KEYWORDS } from '../../../shared/fibrousKeywords';

export { STARCHY_KEYWORDS, EXPLICIT_STARCH_KEYWORDS, FIBROUS_KEYWORDS };

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
    // Strip comma-separated descriptors: "quinoa, cooked" → "quinoa"
    .replace(/,.*$/, '')
    // Strip parenthetical notes: "olive oil (extra virgin)" → "olive oil"
    .replace(/\s*\([^)]*\)\s*/g, '')
    // Strip cooking-state prefix/suffix that don't affect what to buy
    // "cooked quinoa" → "quinoa", "raw almonds" → "almonds"
    .replace(/\b(cooked|raw)\b/g, '')
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
  
  if (matchesKeywords(normalizedName, PLANT_PROTEIN_KEYWORDS)) {
    category = 'Plant Proteins';
  } else if (matchesKeywords(normalizedName, FROZEN_KEYWORDS)) {
    category = 'Frozen';
  } else if (matchesKeywords(normalizedName, MEAT_KEYWORDS)) {
    category = 'Meat';
  } else if (matchesKeywords(normalizedName, DAIRY_KEYWORDS)) {
    category = 'Dairy & Eggs';
  } else if (matchesKeywords(normalizedName, PANTRY_SPICE_OVERRIDES)) {
    // Spice/powder overrides come BEFORE produce so "garlic powder" → Pantry
    // instead of being grabbed by the "garlic" produce keyword
    category = 'Pantry';
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

    // No fibrous suppression here — this function scans free-text user
    // descriptions, not individual ingredient names. A request like
    // "brown rice with broccoli" legitimately contains BOTH starchy and
    // fibrous words; the starchy term must still be detected.
    // Fibrous-first logic belongs only in per-ingredient scorers
    // (deriveSplitCarbs, containsStarch) where each item is evaluated alone.

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
 * Detect whether a free-text user description contains an explicit, named
 * starch request that should auto-override the starch slot guard.
 *
 * Uses EXPLICIT_STARCH_KEYWORDS (unambiguous starch foods) and respects
 * fibrous-first protection — if the starch keyword appears inside a known
 * fibrous phrase (e.g. "cauliflower rice"), it is NOT counted as explicit.
 *
 * Returns true  → clear starch intent: auto-override, skip dialog
 * Returns false → vague/ambiguous: keep dialog path
 */
export function hasExplicitStarchRequest(description: string): boolean {
  const descLower = description.toLowerCase().trim();

  for (const keyword of EXPLICIT_STARCH_KEYWORDS) {
    // Check presence with word-boundary protection for short keywords
    const present =
      keyword.length <= 4
        ? new RegExp(`\\b${keyword}\\b`, 'i').test(descLower)
        : descLower.includes(keyword);

    if (!present) continue;

    // Fibrous-first: if this keyword sits inside a known fibrous phrase
    // that is also present in the description, it is overridden — skip it.
    // Example: "rice" in "cauliflower rice" → overridden, not explicit starch.
    const overridden = FIBROUS_KEYWORDS.some(
      (fk) => fk.includes(keyword) && descLower.includes(fk),
    );

    if (!overridden) return true;
  }

  return false;
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

    // Fibrous is checked first and wins — vegetable/produce ingredients are
    // always fibrous regardless of any starchy-sounding word in their name
    // (e.g. "cauliflower rice" is fibrous; "rice" is never evaluated for it)
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

  const totalScore = starchyScore + fibrousScore;

  if (totalScore === 0) {
    return { starchyCarbs: 0, fibrousCarbs: totalCarbs };
  }

  return {
    starchyCarbs: Math.round(totalCarbs * (starchyScore / totalScore)),
    fibrousCarbs: Math.round(totalCarbs * (fibrousScore / totalScore)),
  };
}
