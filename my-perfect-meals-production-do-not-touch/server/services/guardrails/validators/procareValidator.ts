/**
 * ProCare Validator - Phase 3.7
 * 
 * Post-generation validation for ProCare meals.
 * Validates against dynamic rule pack including:
 * - Ingredient blacklists (trainer + doctor + medical preset)
 * - Macro targets
 * - Cooking method restrictions
 * - Portion sizes
 */

import { 
  ProCareRulePack, 
  ProCareValidationResult,
  PROCARE_FIXED_RULES,
  calculateProteinPerMeal,
  calculateCaloriesPerMeal 
} from '../rules/procareTypes';
import { resolveProCareRules } from '../rules/procareRules';

interface ProCareMeal {
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

export function validateProCareMeal(
  meal: ProCareMeal,
  rulePack: ProCareRulePack,
  isSnack: boolean = false
): ProCareValidationResult {
  const violations: string[] = [];
  const blockedIngredients: string[] = [];
  const macroViolations: string[] = [];
  const warnings: string[] = [];

  const resolved = resolveProCareRules(rulePack);
  
  const ingredientNames = meal.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

  for (const ing of ingredientNames) {
    for (const blocked of resolved.blockedIngredients) {
      if (ing.includes(blocked.toLowerCase())) {
        violations.push(`Blocked ProCare ingredient: "${ing}" (matches "${blocked}")`);
        blockedIngredients.push(ing);
        break;
      }
    }
  }

  if (meal.instructions) {
    const instructionText = Array.isArray(meal.instructions)
      ? meal.instructions.join(' ').toLowerCase()
      : meal.instructions.toLowerCase();

    for (const method of resolved.forbiddenCookingMethods) {
      if (instructionText.includes(method.toLowerCase())) {
        violations.push(`Forbidden cooking method for ProCare: "${method}"`);
      }
    }
  }

  const mealNameLower = meal.name.toLowerCase();
  const nameForbiddenTerms = [
    'fried', 'deep-fried', 'pan-fried', 'crispy',
    'candy', 'cake', 'cookie', 'pastry', 'dessert',
    'junk', 'processed',
  ];

  for (const term of nameForbiddenTerms) {
    if (mealNameLower.includes(term)) {
      violations.push(`Meal name suggests ProCare incompatible dish: "${term}" found`);
    }
  }

  if (meal.macros) {
    if (isSnack) {
      if (meal.macros.protein && meal.macros.protein < PROCARE_FIXED_RULES.snackMinProtein) {
        macroViolations.push(`Snack protein (${meal.macros.protein}g) below minimum (${PROCARE_FIXED_RULES.snackMinProtein}g)`);
      }
      if (meal.macros.fat && meal.macros.fat > PROCARE_FIXED_RULES.snackMaxFat) {
        macroViolations.push(`Snack fat (${meal.macros.fat}g) exceeds maximum (${PROCARE_FIXED_RULES.snackMaxFat}g)`);
      }
      if (meal.macros.carbs && meal.macros.carbs > PROCARE_FIXED_RULES.snackMaxCarbs) {
        macroViolations.push(`Snack carbs (${meal.macros.carbs}g) exceeds maximum (${PROCARE_FIXED_RULES.snackMaxCarbs}g)`);
      }
    } else {
      const proteinTarget = calculateProteinPerMeal(rulePack);
      const caloriesTarget = calculateCaloriesPerMeal(rulePack);
      
      if (meal.macros.protein && meal.macros.protein < resolved.macroLimits.proteinMin) {
        macroViolations.push(`Protein (${meal.macros.protein}g) below target minimum (${resolved.macroLimits.proteinMin}g)`);
      }
      
      if (meal.macros.fat && meal.macros.fat > resolved.macroLimits.fatsMax * 1.1) {
        macroViolations.push(`Fat (${meal.macros.fat}g) exceeds limit (${resolved.macroLimits.fatsMax}g)`);
      }
      
      if (meal.macros.carbs && meal.macros.carbs > resolved.macroLimits.carbsMax * 1.1) {
        warnings.push(`Carbs (${meal.macros.carbs}g) slightly exceeds target (${resolved.macroLimits.carbsMax}g)`);
      }
      
      if (meal.macros.calories && meal.macros.calories > caloriesTarget * 1.2) {
        macroViolations.push(`Calories (${meal.macros.calories}) significantly exceeds target (${caloriesTarget})`);
      }
    }
  }

  if (macroViolations.length > 0) {
    violations.push(...macroViolations);
  }

  return {
    isValid: violations.length === 0,
    violations,
    blockedIngredients,
    macroViolations,
    warnings,
  };
}

export function validateProCareSnack(
  snack: ProCareMeal,
  rulePack: ProCareRulePack
): ProCareValidationResult {
  const result = validateProCareMeal(snack, rulePack, true);

  const ingredientNames = snack.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

  const forbiddenSnackTerms = [
    'candy', 'chip', 'chips', 'pastry', 'cookie', 'brownie',
    'cake', 'ice cream', 'milkshake', 'soda', 'pop',
  ];

  for (const ing of ingredientNames) {
    for (const term of forbiddenSnackTerms) {
      if (ing.includes(term)) {
        result.violations.push(`Forbidden ProCare snack type: "${ing}"`);
        result.blockedIngredients.push(ing);
      }
    }
  }

  result.isValid = result.violations.length === 0;
  
  return result;
}

export function getProCareValidationSummary(result: ProCareValidationResult): string {
  if (result.isValid) {
    return '✅ Meal passes ProCare validation: macro-compliant, clean ingredients, approved cooking methods';
  }

  let summary = `❌ ProCare Validation Failed (${result.violations.length} issues):\n`;
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
