/**
 * General Nutrition Validator
 * 
 * Validates generated meals against basic clean eating principles.
 * Flags obvious junk food and imbalanced meals.
 */

import type { ValidationResult, GeneratedMeal } from '../types';
import { generalNutritionRules, GENERAL_NUTRITION_SNACK_RULES } from '../rules/generalNutritionRules';

export function validateGeneralNutritionMeal(
  meal: GeneratedMeal,
  isSnack: boolean = false
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const blockedFound: string[] = [];
  
  const mealText = getMealText(meal).toLowerCase();

  if (isSnack) {
    return validateSnack(meal);
  }

  for (const blocked of generalNutritionRules.blockedIngredients) {
    const pattern = new RegExp(`\\b${escapeRegex(blocked)}\\b`, 'i');
    if (pattern.test(mealText)) {
      if (!hasHealthyContext(mealText, blocked)) {
        blockedFound.push(blocked);
        violations.push(`Contains "${blocked}" - consider a healthier version`);
      }
    }
  }

  const junkPatterns = [
    /deep[\s-]?fried/i,
    /loaded\s+nachos/i,
    /\bfast\s*food\b/i,
    /\bice\s*cream\s*sundae\b/i
  ];
  
  for (const pattern of junkPatterns) {
    if (pattern.test(mealText)) {
      violations.push('Meal appears to be junk food - needs healthier version');
    }
  }

  const hasProtein = generalNutritionRules.preferredIngredients
    .filter(i => ['chicken', 'turkey', 'salmon', 'beef', 'eggs', 'fish', 'shrimp', 'tofu'].some(p => i.includes(p)))
    .some(protein => mealText.includes(protein.toLowerCase()));
  
  if (!hasProtein) {
    warnings.push('Consider adding a protein source for better balance');
  }

  const hasVegetables = ['spinach', 'broccoli', 'kale', 'peppers', 'tomatoes', 'zucchini', 'asparagus', 'salad', 'greens', 'vegetables']
    .some(veg => mealText.includes(veg));
  
  if (!hasVegetables && !isSnack) {
    warnings.push('Consider adding vegetables for better nutrition');
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients: blockedFound,
    warnings,
    dietType: 'general-nutrition'
  };
}

function validateSnack(meal: GeneratedMeal): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const blockedFound: string[] = [];
  
  const mealText = getMealText(meal).toLowerCase();

  for (const blocked of GENERAL_NUTRITION_SNACK_RULES.blocked) {
    if (mealText.includes(blocked.toLowerCase())) {
      blockedFound.push(blocked);
      violations.push(`Snack contains "${blocked}" - create a healthier version`);
    }
  }

  if (meal.macros && meal.macros.calories && meal.macros.calories > 300) {
    warnings.push('Snack calories are high - consider a smaller portion');
  }

  const emptyCaloriePatterns = [
    /pure\s+sugar/i,
    /candy\s+bar/i,
    /\bsoda\b/i
  ];
  
  for (const pattern of emptyCaloriePatterns) {
    if (pattern.test(mealText)) {
      violations.push('Snack is empty calories - needs protein or fiber');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients: blockedFound,
    warnings,
    dietType: 'general-nutrition'
  };
}

function hasHealthyContext(text: string, ingredient: string): boolean {
  const healthyTransforms: Record<string, string[]> = {
    'fried': ['air-fried', 'air fried', 'oven-fried', 'baked'],
    'chips': ['baked chips', 'veggie chips', 'kale chips'],
    'ice cream': ['frozen yogurt', 'nice cream', 'protein ice cream']
  };

  const transforms = healthyTransforms[ingredient];
  if (transforms) {
    return transforms.some(t => text.includes(t.toLowerCase()));
  }
  
  return false;
}

function getMealText(meal: GeneratedMeal): string {
  const parts: string[] = [meal.name];
  
  if (meal.description) parts.push(meal.description);
  
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (typeof ing === 'string') {
        parts.push(ing);
      } else {
        parts.push(ing.name || ing.item || '');
      }
    }
  }
  
  if (meal.instructions) {
    if (Array.isArray(meal.instructions)) {
      parts.push(...meal.instructions);
    } else {
      parts.push(meal.instructions);
    }
  }
  
  return parts.join(' ');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
