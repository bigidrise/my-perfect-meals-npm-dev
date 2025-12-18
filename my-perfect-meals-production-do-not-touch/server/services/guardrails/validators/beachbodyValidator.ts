/**
 * BeachBody Validator
 * 
 * Validates generated meals against BeachBody phase-specific rules.
 * Checks ingredients, macros, and cooking methods.
 */

import type { ValidationResult, GeneratedMeal, BeachBodyPhase } from '../types';
import { getBeachBodyRules, BEACHBODY_SNACK_RULES, BEACHBODY_COOKING_METHODS } from '../rules/beachbodyRules';

export function validateBeachBodyMeal(
  meal: GeneratedMeal, 
  phase: BeachBodyPhase = 'lean',
  isSnack: boolean = false
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const blockedFound: string[] = [];
  
  const rules = getBeachBodyRules(phase);
  const mealText = getMealText(meal).toLowerCase();

  if (isSnack) {
    return validateSnack(meal, phase);
  }

  for (const blocked of rules.blockedIngredients) {
    const pattern = new RegExp(`\\b${escapeRegex(blocked)}\\b`, 'i');
    if (pattern.test(mealText)) {
      if (!hasAllowedContext(mealText, blocked, phase)) {
        blockedFound.push(blocked);
        violations.push(`Contains "${blocked}" which is not allowed in ${phase} phase`);
      }
    }
  }

  for (const avoidMethod of BEACHBODY_COOKING_METHODS.avoid) {
    if (mealText.includes(avoidMethod.toLowerCase())) {
      violations.push(`Uses cooking method "${avoidMethod}" - prefer grilling, baking, or air-frying`);
    }
  }

  if (meal.macros) {
    const macroWarnings = validatePhaseMacros(meal.macros, phase);
    warnings.push(...macroWarnings);
  }

  const hasPreferred = rules.preferredIngredients.some(pref => 
    mealText.includes(pref.toLowerCase())
  );
  if (!hasPreferred) {
    warnings.push('Consider including more lean proteins or preferred vegetables');
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients: blockedFound,
    warnings,
    dietType: 'beachbody'
  };
}

function validateSnack(meal: GeneratedMeal, phase: BeachBodyPhase): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const blockedFound: string[] = [];
  
  const mealText = getMealText(meal).toLowerCase();

  for (const blocked of BEACHBODY_SNACK_RULES.blocked) {
    if (mealText.includes(blocked.toLowerCase())) {
      blockedFound.push(blocked);
      violations.push(`Snack contains "${blocked}" which is not BeachBody-approved`);
    }
  }

  if (phase === 'lean' || phase === 'carb-control') {
    const highCarbSnacks = ['rice cake', 'banana', 'oatmeal', 'granola'];
    for (const item of highCarbSnacks) {
      if (mealText.includes(item)) {
        if (phase === 'carb-control') {
          violations.push(`"${item}" is too high-carb for carb-control phase`);
        } else {
          warnings.push(`"${item}" is moderate-carb - keep portions small in lean phase`);
        }
      }
    }
  }

  if (meal.macros && meal.macros.calories && meal.macros.calories > 250) {
    warnings.push('Snack calories are high - consider smaller portion for physique goals');
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients: blockedFound,
    warnings,
    dietType: 'beachbody'
  };
}

function validatePhaseMacros(
  macros: { calories?: number; protein?: number; carbs?: number; fat?: number },
  phase: BeachBodyPhase
): string[] {
  const warnings: string[] = [];
  
  switch (phase) {
    case 'lean':
      if (macros.fat && macros.calories && (macros.fat * 9 / macros.calories) > 0.30) {
        warnings.push('Fat percentage is high for lean phase - aim for under 25%');
      }
      break;
    
    case 'carb-control':
      if (macros.carbs && macros.carbs > 35) {
        warnings.push('Carbs exceed 35g - consider reducing for carb-control phase');
      }
      break;
    
    case 'sculpt':
      if (macros.protein && macros.protein < 25) {
        warnings.push('Protein is low for sculpt phase - aim for 30g+');
      }
      break;
  }

  return warnings;
}

function hasAllowedContext(text: string, ingredient: string, phase: BeachBodyPhase): boolean {
  const allowedContexts: Record<string, string[]> = {
    'cheese': ['low-fat cheese', 'fat-free cheese', 'cottage cheese'],
    'pasta': ['protein pasta', 'chickpea pasta', 'lentil pasta', 'zucchini noodles'],
    'rice': ['cauliflower rice'],
    'cream': ['greek yogurt', 'cream of tartar']
  };

  const contexts = allowedContexts[ingredient];
  if (contexts) {
    return contexts.some(ctx => text.includes(ctx.toLowerCase()));
  }

  if (phase === 'maintenance' || phase === 'sculpt') {
    const allowedInLaterPhases = ['brown rice', 'quinoa', 'sweet potato', 'oatmeal'];
    if (allowedInLaterPhases.some(item => text.includes(item))) {
      return true;
    }
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
