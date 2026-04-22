/**
 * BeachBody Validator
 * 
 * Validates generated meals against BeachBody phase-specific rules.
 * Checks ingredients, macros, and cooking methods.
 * 
 * ENFORCEMENT NOTE:
 * Macro violations (fat ceiling, protein floor, carb ceiling) are HARD violations
 * that set isValid=false and trigger the retry engine. They are NOT soft warnings.
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
    const macroResult = validatePhaseMacros(meal.macros, phase);
    violations.push(...macroResult.violations);
    warnings.push(...macroResult.warnings);
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

/**
 * Validates macro compliance per phase.
 * HARD violations trigger the retry engine (isValid = false).
 * Soft warnings are informational only and do not block the meal.
 */
function validatePhaseMacros(
  macros: { calories?: number; protein?: number; carbs?: number; fat?: number },
  phase: BeachBodyPhase
): { violations: string[]; warnings: string[] } {
  const violations: string[] = [];
  const warnings: string[] = [];
  
  switch (phase) {
    case 'lean':
      // HARD: fat % ceiling — Phase 1 is a fat-loss phase, fat >30% is a violation
      if (macros.fat && macros.calories && (macros.fat * 9 / macros.calories) > 0.30) {
        violations.push(`Fat is ${Math.round(macros.fat * 9 / macros.calories * 100)}% of calories — Phase 1 (Lean) requires fat under 25%. Regenerate with a leaner protein source.`);
      }
      // HARD: protein floor — must hit minimum for muscle preservation during cut
      if (macros.protein !== undefined && macros.protein < 30) {
        violations.push(`Protein is ${macros.protein}g — Phase 1 (Lean) requires at least 30g per meal. Increase lean protein portion.`);
      }
      break;
    
    case 'carb-control':
      // HARD: carb ceiling — this phase is keto-adjacent, >35g carbs is a violation
      if (macros.carbs !== undefined && macros.carbs > 35) {
        violations.push(`Carbs are ${macros.carbs}g — Phase 2 (Carb-Control) requires under 30g per meal. Remove starchy carb sources.`);
      }
      // HARD: protein floor
      if (macros.protein !== undefined && macros.protein < 30) {
        violations.push(`Protein is ${macros.protein}g — Phase 2 (Carb-Control) requires at least 30g per meal. Increase lean protein portion.`);
      }
      break;
    
    case 'sculpt':
      // HARD: protein floor — muscle building phase needs sufficient protein
      if (macros.protein !== undefined && macros.protein < 30) {
        violations.push(`Protein is ${macros.protein}g — Phase 4 (Sculpt) requires at least 35g per meal. Add more lean protein.`);
      }
      // Soft: inform if carbs are low for muscle building
      if (macros.carbs !== undefined && macros.carbs < 30) {
        warnings.push('Carbs are low for sculpt phase — consider adding a clean carb source to fuel training');
      }
      break;

    case 'maintenance':
      // Soft only — maintenance is the balanced phase, no hard macro blocks
      if (macros.protein !== undefined && macros.protein < 25) {
        warnings.push('Protein is below 25g — aim for at least 25g per meal during maintenance');
      }
      break;
  }

  return { violations, warnings };
}

function hasAllowedContext(text: string, ingredient: string, phase: BeachBodyPhase): boolean {
  const allowedContexts: Record<string, string[]> = {
    'cheese': ['low-fat cheese', 'fat-free cheese', 'cottage cheese'],
    'pasta': ['protein pasta', 'chickpea pasta', 'lentil pasta', 'zucchini noodles'],
    'rice': ['cauliflower rice'],
    'cream': ['greek yogurt', 'cream of tartar'],
    'ground beef': ['lean ground beef', '96% lean', '95% lean', '93% lean'],
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
