import crypto from 'crypto';

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
