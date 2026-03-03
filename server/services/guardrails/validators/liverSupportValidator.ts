import type { ValidationResult } from '../types';
import { isBlockedIngredientLiverSupport } from '../rules/liverSupportRules';

interface MealToValidate {
  name: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
}

export function validateLiverSupportMeal(meal: MealToValidate): ValidationResult {
  const violations: string[] = [];
  const blockedIngredients: string[] = [];

  for (const ingredient of meal.ingredients) {
    if (isBlockedIngredientLiverSupport(ingredient.name)) {
      blockedIngredients.push(ingredient.name);
      violations.push(`Blocked ingredient: ${ingredient.name}`);
    }
  }

  const mealNameLower = meal.name.toLowerCase();
  const redFlagTerms = ['fried', 'alcohol', 'beer', 'wine', 'cocktail', 'soda', 'candy', 'donut', 'pastry'];
  for (const term of redFlagTerms) {
    if (mealNameLower.includes(term)) {
      violations.push(`Meal name contains blocked term: ${term}`);
    }
  }

  if (meal.instructions) {
    const instructionsText = Array.isArray(meal.instructions)
      ? meal.instructions.join(' ')
      : meal.instructions;
    const instructionsLower = instructionsText.toLowerCase();

    if (instructionsLower.includes('deep fry') || instructionsLower.includes('deep-fry')) {
      violations.push('Instructions include deep frying method');
    }
    if (instructionsLower.includes('alcohol') || instructionsLower.includes('wine') || instructionsLower.includes('beer')) {
      violations.push('Instructions reference alcohol');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients,
  };
}
