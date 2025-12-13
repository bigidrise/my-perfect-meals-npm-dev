/**
 * Performance & Competition Validator
 * 
 * Post-generation validation to ensure meals are 100% competition-safe.
 * Rejects any meal containing forbidden ingredients or violating macro rules.
 */

import type { ValidationResult } from '../types';
import { performanceRules, performanceSnackRules, getCompetitionPhaseRules, type CompetitionPhase } from '../rules/performanceRules';

interface MealToValidate {
  name: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
  macros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    calories?: number;
  };
}

/**
 * Validate a generated meal against performance/competition rules
 */
export function validatePerformanceMeal(
  meal: MealToValidate,
  carbPhase: CompetitionPhase = 'carb',
  isSnack: boolean = false
): ValidationResult {
  const violations: string[] = [];
  const blockedFound: string[] = [];
  
  const phaseRules = getCompetitionPhaseRules(carbPhase);
  const blockedList = performanceRules.blockedIngredients;
  const snackForbidden = isSnack ? performanceSnackRules.forbidden : [];
  
  // Combine all text for checking
  const allText = [
    meal.name.toLowerCase(),
    ...meal.ingredients.map(i => i.name.toLowerCase()),
    ...(Array.isArray(meal.instructions) 
      ? meal.instructions.map(s => s.toLowerCase()) 
      : typeof meal.instructions === 'string' 
        ? [meal.instructions.toLowerCase()] 
        : [])
  ].join(' ');
  
  // Check blocked ingredients
  for (const blocked of blockedList) {
    const regex = new RegExp(`\\b${blocked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(allText)) {
      violations.push(`BLOCKED: "${blocked}" is not allowed in competition meals`);
      blockedFound.push(blocked);
    }
  }
  
  // Check snack-specific forbidden items
  if (isSnack) {
    for (const forbidden of snackForbidden) {
      const regex = new RegExp(`\\b${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(allText)) {
        violations.push(`BLOCKED: "${forbidden}" is not allowed in competition snacks`);
        blockedFound.push(forbidden);
      }
    }
  }
  
  // Check cooking methods
  const blockedMethods = ['deep fried', 'fried', 'pan fried', 'sautéed', 'sauteed', 'battered', 'breaded', 'crusted'];
  for (const method of blockedMethods) {
    if (allText.includes(method)) {
      violations.push(`COOKING: "${method}" cooking method not allowed - use air fry, bake, grill, or steam`);
    }
  }
  
  // Check for oil usage (except spray)
  if (allText.includes('oil') && !allText.includes('spray') && !allText.includes('cooking spray')) {
    const oilTerms = ['olive oil', 'vegetable oil', 'coconut oil', 'canola oil', 'butter', 'margarine'];
    for (const oil of oilTerms) {
      if (allText.includes(oil)) {
        violations.push(`FAT: "${oil}" not allowed - use cooking spray only`);
        blockedFound.push(oil);
      }
    }
  }
  
  // Check no-carb phase compliance
  if (carbPhase === 'no-carb') {
    const starchyCarbs = ['rice', 'oats', 'oatmeal', 'sweet potato', 'potato', 'quinoa', 'cream of rice'];
    for (const carb of starchyCarbs) {
      if (allText.includes(carb)) {
        violations.push(`CARBS: "${carb}" not allowed on NO-CARB days - vegetables only`);
      }
    }
  }
  
  // Validate macros if provided
  if (meal.macros) {
    // Fat check
    if (meal.macros.fat !== undefined && meal.macros.fat > phaseRules.maxFatPerMeal) {
      violations.push(`MACROS: Fat too high (${meal.macros.fat}g) - maximum ${phaseRules.maxFatPerMeal}g for ${carbPhase} phase`);
    }
    
    // Carb check
    if (meal.macros.carbs !== undefined && meal.macros.carbs > phaseRules.maxCarbsPerMeal) {
      violations.push(`MACROS: Carbs too high (${meal.macros.carbs}g) - maximum ${phaseRules.maxCarbsPerMeal}g for ${carbPhase} phase`);
    }
    
    // Protein floor check (for meals, not snacks)
    if (!isSnack && meal.macros.protein !== undefined && meal.macros.protein < 25) {
      violations.push(`MACROS: Protein too low (${meal.macros.protein}g) - competition meals need 30-50g protein`);
    }
  }
  
  // Check for sauce violations
  const forbiddenSauces = ['mayo', 'mayonnaise', 'ranch', 'caesar', 'alfredo', 'cream sauce', 'cheese sauce', 'bbq sauce', 'barbecue'];
  for (const sauce of forbiddenSauces) {
    if (allText.includes(sauce)) {
      violations.push(`SAUCE: "${sauce}" not allowed - use mustard, hot sauce, or lemon only`);
      blockedFound.push(sauce);
    }
  }
  
  // Check for dessert/treat violations
  const dessertTerms = ['dessert', 'treat', 'indulgent', 'decadent', 'sweet', 'chocolate', 'caramel', 'ice cream'];
  for (const term of dessertTerms) {
    if (allText.includes(term)) {
      violations.push(`FORBIDDEN: "${term}" - no desserts or treats in competition prep`);
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients: Array.from(new Set(blockedFound)),
    warnings: violations.length > 0 
      ? [`Meal "${meal.name}" has ${violations.length} competition rule violation(s)`] 
      : [],
  };
}

/**
 * Get validation summary for logging
 */
export function getPerformanceValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return '🏆 Performance Validation: PASSED - Meal is competition-safe';
  }
  
  return `⚠️ Performance Validation: FAILED
${result.violations.map(v => `  - ${v}`).join('\n')}`;
}
