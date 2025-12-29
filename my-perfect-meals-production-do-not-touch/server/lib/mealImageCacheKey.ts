import crypto from 'crypto';

/**
 * CACHE VERSION - Bump this to invalidate all cached meal images
 * 
 * When to bump:
 * - After changing AI image generation prompts
 * - After updating DALL-E prompt templates
 * - After fixing image-meal alignment issues
 * 
 * History:
 * - v1: Original implementation
 * - v2: Added Canva-style prompts with meal context
 * - v3: Force refresh after production cache mismatch (Dec 2024)
 */
export const MEAL_IMAGE_CACHE_VERSION = 'v3';

export interface MealImageCacheKeyInput {
  name: string;
  ingredients?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  description?: string;
}

export function buildMealImageCacheKey(input: MealImageCacheKeyInput): string {
  const normalizedPayload = {
    version: MEAL_IMAGE_CACHE_VERSION,
    name: input.name.toLowerCase().trim(),
    ingredients: (input.ingredients || [])
      .map(ing => ing.toLowerCase().trim())
      .sort(),
    macros: {
      calories: Math.round(input.calories || 0),
      protein: Math.round(input.protein || 0),
      carbs: Math.round(input.carbs || 0),
      fat: Math.round(input.fat || 0),
    },
  };

  const payloadString = JSON.stringify(normalizedPayload);
  
  const hash = crypto
    .createHash('sha256')
    .update(payloadString)
    .digest('hex')
    .substring(0, 16);

  return hash;
}
