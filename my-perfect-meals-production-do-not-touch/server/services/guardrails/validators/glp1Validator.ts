/**
 * GLP-1 Validator - Phase 3.3
 * 
 * Post-generation validation for GLP-1 meals
 * Ensures meals are small, low-fat, high-protein, and easy to digest
 */

import { glp1Rules } from '../rules/glp1Rules';
import type { ValidationResult } from '../types';

interface GLP1Meal {
  name: string;
  ingredients: Array<{ name?: string; item?: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
  macros?: {
    calories?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  };
}

export function validateGLP1Meal(
  meal: GLP1Meal,
  isSnack: boolean = false
): ValidationResult {
  const violations: string[] = [];
  const blockedIngredients: string[] = [];
  const warnings: string[] = [];

  const ingredientNames = meal.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

  // Check for blocked ingredients
  for (const ing of ingredientNames) {
    for (const blocked of glp1Rules.blockedIngredients) {
      if (ing.includes(blocked.toLowerCase())) {
        violations.push(`Blocked GLP-1 ingredient: "${ing}" (matches "${blocked}")`);
        blockedIngredients.push(ing);
        break;
      }
    }
  }

  // Check for forbidden cooking methods in instructions
  if (meal.instructions) {
    const instructionText = Array.isArray(meal.instructions) 
      ? meal.instructions.join(' ').toLowerCase()
      : meal.instructions.toLowerCase();

    for (const method of glp1Rules.cookingMethods.forbidden) {
      if (instructionText.includes(method.toLowerCase())) {
        violations.push(`Forbidden cooking method for GLP-1: "${method}"`);
      }
    }
  }

  // Check meal name for forbidden terms
  const mealNameLower = meal.name.toLowerCase();
  const nameForbiddenTerms = [
    'fried', 'deep-fried', 'pan-fried', 'crispy',
    'loaded', 'stuffed', 'giant', 'double', 'triple',
    'creamy', 'alfredo', 'cheesy', 'buttery',
  ];

  for (const term of nameForbiddenTerms) {
    if (mealNameLower.includes(term)) {
      violations.push(`Meal name suggests GLP-1 incompatible dish: "${term}" found in "${meal.name}"`);
    }
  }

  // Macro validation if available
  if (meal.macros) {
    const limits = isSnack 
      ? { maxCalories: 150, maxFat: 5, minProtein: 8 }
      : { 
          maxCalories: glp1Rules.portionGuidelines.maxCalories,
          maxFat: glp1Rules.portionGuidelines.maxFatGrams,
          minProtein: glp1Rules.portionGuidelines.minProteinGrams 
        };

    if (meal.macros.calories && meal.macros.calories > limits.maxCalories) {
      warnings.push(`Calories (${meal.macros.calories}) exceed GLP-1 limit (${limits.maxCalories})`);
    }

    if (meal.macros.fat && meal.macros.fat > limits.maxFat) {
      violations.push(`Fat content (${meal.macros.fat}g) exceeds GLP-1 limit (${limits.maxFat}g)`);
    }

    if (meal.macros.protein && meal.macros.protein < limits.minProtein) {
      warnings.push(`Protein (${meal.macros.protein}g) below GLP-1 minimum (${limits.minProtein}g)`);
    }
  }

  // Check for heavy/large portion indicators
  const portionIndicators = ['large', 'big', 'huge', 'mega', 'super', 'jumbo', 'family'];
  for (const indicator of portionIndicators) {
    if (mealNameLower.includes(indicator)) {
      violations.push(`Large portion indicator "${indicator}" not appropriate for GLP-1`);
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients,
    warnings,
  };
}

export function validateGLP1Snack(
  snack: GLP1Meal
): ValidationResult {
  const result = validateGLP1Meal(snack, true);
  
  // Additional snack-specific checks
  const ingredientNames = snack.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

  // Check for forbidden snack categories
  const forbiddenSnackTerms = [
    'candy', 'chip', 'chips', 'pastry', 'cookie', 'brownie',
    'thick smoothie', 'milkshake', 'ice cream',
  ];

  for (const ing of ingredientNames) {
    for (const term of forbiddenSnackTerms) {
      if (ing.includes(term)) {
        result.violations.push(`Forbidden GLP-1 snack type: "${ing}"`);
        if (result.blockedIngredients) {
          result.blockedIngredients.push(ing);
        }
      }
    }
  }

  // Recalculate validity
  result.isValid = result.violations.length === 0;
  
  return result;
}

export function getGLP1ValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return '✅ Meal passes GLP-1 validation: small portion, low-fat, high-protein, easy to digest';
  }

  let summary = `❌ GLP-1 Validation Failed (${result.violations.length} issues):\n`;
  result.violations.forEach((v, i) => {
    summary += `  ${i + 1}. ${v}\n`;
  });

  if (result.warnings && result.warnings.length > 0) {
    summary += `⚠️ Warnings:\n`;
    result.warnings.forEach((w, i) => {
      summary += `  ${i + 1}. ${w}\n`;
    });
  }

  return summary;
}
