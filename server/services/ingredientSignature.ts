/**
 * Ingredient Signature Hashing
 * 
 * Creates deterministic cache keys from ingredient combinations.
 * This allows us to:
 * 1. Look up previously generated meals by ingredient combo
 * 2. Match to pre-computed template meals
 * 3. Cache AI-generated meals for reuse
 */

export interface IngredientSignatureInput {
  ingredients: string[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cookingMethods?: Record<string, string>;
  /** Primary diet mode (vegan/vegetarian/pescatarian/none). Ensures diet-specific meals are cached separately. */
  primaryDiet?: string;
  /**
   * Macro policy version — bump this when changing how macros are generated/stored
   * so contaminated cache entries from prior behavior are automatically invalidated.
   * Current: "mtp1" (Macro Truth Policy v1 — removes baseline injection + numeric fallbacks)
   */
  policyVersion?: string;
}

/**
 * Normalize ingredient name for consistent matching
 * - lowercase
 * - remove extra spaces
 * - remove common modifiers (fresh, organic, etc.)
 */
function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^(fresh_|organic_|raw_|cooked_|frozen_)/, '')
    .replace(/_(fresh|organic|raw|cooked|frozen)$/, '');
}

/**
 * Create a deterministic signature from ingredients
 * Sorted alphabetically so order doesn't matter
 */
export function createIngredientSignature(input: IngredientSignatureInput): string {
  const { ingredients, mealType, cookingMethods, primaryDiet, policyVersion } = input;
  
  const normalizedIngredients = ingredients
    .map(normalizeIngredient)
    .filter(i => i.length > 0)
    .sort();
  
  const ingredientPart = normalizedIngredients.join('+');
  
  const methodPart = cookingMethods 
    ? Object.entries(cookingMethods)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${normalizeIngredient(k)}:${v.toLowerCase()}`)
        .join(',')
    : '';
  
  // Include primaryDiet in the signature so vegan/vegetarian/pescatarian meals
  // are cached separately from unrestricted meals — prevents diet bypass via cache
  const dietPart = primaryDiet ? primaryDiet.toLowerCase() : 'none';
  
  // Include policy version so cache entries generated before macro policy changes
  // are automatically invalidated when the version is bumped
  const versionPart = policyVersion ?? 'mtp1';
  
  const base = methodPart 
    ? `${mealType}|${ingredientPart}|${methodPart}`
    : `${mealType}|${ingredientPart}`;
  
  return `${base}|diet:${dietPart}|v:${versionPart}`;
}

/**
 * Create a simple hash for shorter cache keys (for database storage)
 */
export function hashSignature(signature: string): string {
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract primary ingredients from a signature
 * Useful for template matching when exact match fails
 */
export function extractPrimaryIngredients(signature: string): string[] {
  const parts = signature.split('|');
  if (parts.length < 2) return [];
  
  return parts[1].split('+');
}

/**
 * Calculate similarity score between two signatures
 * Returns 0-1 where 1 is perfect match
 */
export function calculateSignatureSimilarity(sig1: string, sig2: string): number {
  const ingredients1 = new Set(extractPrimaryIngredients(sig1));
  const ingredients2 = new Set(extractPrimaryIngredients(sig2));
  
  if (ingredients1.size === 0 || ingredients2.size === 0) return 0;
  
  let matches = 0;
  Array.from(ingredients1).forEach(ing => {
    if (ingredients2.has(ing)) matches++;
  });
  
  const total = Math.max(ingredients1.size, ingredients2.size);
  return matches / total;
}
