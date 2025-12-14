/**
 * Anti-Inflammatory Validator
 * 
 * Post-generation validation to ensure AI-generated meals
 * comply with anti-inflammatory diet requirements.
 */

import type { ValidationResult } from '../types';
import { antiInflammatoryRules, isBlockedIngredient } from '../rules/antiInflammatoryRules';

interface MealToValidate {
  name: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
}

/**
 * Validate a generated meal against anti-inflammatory rules
 */
export function validateAntiInflammatoryMeal(meal: MealToValidate): ValidationResult {
  const violations: string[] = [];
  const blockedIngredients: string[] = [];
  
  // Check each ingredient against blocklist
  for (const ingredient of meal.ingredients) {
    if (isBlockedIngredient(ingredient.name)) {
      blockedIngredients.push(ingredient.name);
      violations.push(`Blocked ingredient: ${ingredient.name}`);
    }
  }
  
  // Check meal name for red flags
  const mealNameLower = meal.name.toLowerCase();
  const redFlagTerms = ['fried', 'bacon', 'sausage', 'beef', 'pork', 'ham'];
  for (const term of redFlagTerms) {
    if (mealNameLower.includes(term)) {
      violations.push(`Meal name contains blocked term: ${term}`);
    }
  }
  
  // Check instructions for blocked cooking methods/ingredients
  if (meal.instructions) {
    const instructionsText = Array.isArray(meal.instructions) 
      ? meal.instructions.join(' ') 
      : meal.instructions;
    const instructionsLower = instructionsText.toLowerCase();
    
    // Check for seed oils in instructions
    const oilTerms = ['canola oil', 'vegetable oil', 'corn oil', 'soybean oil'];
    for (const oil of oilTerms) {
      if (instructionsLower.includes(oil)) {
        violations.push(`Instructions mention blocked oil: ${oil}`);
      }
    }
    
    // Check for deep frying
    if (instructionsLower.includes('deep fry') || instructionsLower.includes('deep-fry')) {
      violations.push('Instructions include deep frying method');
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients
  };
}

/**
 * Attempt to fix minor violations by substituting ingredients
 */
export function suggestSubstitutions(blockedIngredient: string): string | null {
  const substitutions: Record<string, string> = {
    'canola oil': 'olive oil',
    'vegetable oil': 'olive oil',
    'corn oil': 'avocado oil',
    'soybean oil': 'olive oil',
    'butter': 'olive oil',
    'beef': 'salmon',
    'ground beef': 'ground turkey',
    'bacon': 'turkey bacon or omit',
    'sausage': 'chicken sausage',
    'pork': 'chicken breast',
    'white rice': 'brown rice',
    'white bread': 'whole grain bread',
    'white pasta': 'whole grain pasta',
    'cream cheese': 'hummus',
    'heavy cream': 'coconut cream',
    'white sugar': 'honey or maple syrup (small amount)',
  };
  
  const normalized = blockedIngredient.toLowerCase().trim();
  return substitutions[normalized] || null;
}

/**
 * Get a summary of validation results for logging
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return '✅ Meal passes anti-inflammatory validation';
  }
  
  return `❌ Anti-inflammatory validation failed:
  - ${result.violations.length} violations found
  - Blocked ingredients: ${result.blockedIngredients.join(', ') || 'none detected'}
  - Issues: ${result.violations.join('; ')}`;
}
