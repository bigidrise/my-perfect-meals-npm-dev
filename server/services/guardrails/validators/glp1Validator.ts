/**
 * GLP-1 Validator — Phase 3.3 (updated: resolver-driven targets)
 *
 * Post-generation validation for GLP-1 meals.
 * When resolvedTargets are provided (from resolveGLP1MealTargets), validation
 * compares the meal against the patient-specific targets rather than static
 * glp1Rules constants. Falls back to static baselines only when resolver output
 * is not available.
 *
 * Validator produces three possible outcomes for macro checks:
 *   - Pass: within patient target
 *   - Warning (soft): within tolerated ceiling but above target
 *   - Violation (hard): exceeds the tolerated ceiling or blocked ingredient found
 */

import { glp1Rules } from '../rules/glp1Rules';
import type { ValidationResult } from '../types';
import type { ResolvedGLP1Targets } from '../../glp1/resolveGLP1MealTargets';

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
  isSnack: boolean = false,
  resolvedTargets?: ResolvedGLP1Targets
): ValidationResult {
  const violations: string[] = [];
  const blockedIngredients: string[] = [];
  const warnings: string[] = [];

  const ingredientNames = meal.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

  // ── Blocked ingredient check ───────────────────────────────────────────────
  for (const ing of ingredientNames) {
    for (const blocked of glp1Rules.blockedIngredients) {
      if (ing.includes(blocked.toLowerCase())) {
        violations.push(`Blocked GLP-1 ingredient: "${ing}" (matches "${blocked}")`);
        blockedIngredients.push(ing);
        break;
      }
    }
  }

  // ── Forbidden cooking method check ────────────────────────────────────────
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

  // ── Meal name check ───────────────────────────────────────────────────────
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

  // ── Portion size name check ───────────────────────────────────────────────
  const portionIndicators = ['large', 'big', 'huge', 'mega', 'super', 'jumbo', 'family'];
  for (const indicator of portionIndicators) {
    if (mealNameLower.includes(indicator)) {
      violations.push(`Large portion indicator "${indicator}" not appropriate for GLP-1`);
    }
  }

  // ── Macro validation ──────────────────────────────────────────────────────
  if (meal.macros) {
    if (isSnack) {
      // Snack limits — use resolved targets if available
      const snackCalLimit = resolvedTargets && !resolvedTargets.usedBaseline
        ? resolvedTargets.resolvedSnackCalories
        : 150;
      const snackFatLimit = resolvedTargets && !resolvedTargets.usedBaseline
        ? Math.round(resolvedTargets.maximumToleratedFatGrams * 0.4)
        : 5;
      const snackProteinFloor = resolvedTargets && !resolvedTargets.usedBaseline
        ? Math.max(resolvedTargets.minimumProteinFloor * 0.5, 8)
        : 8;

      if (meal.macros.calories && meal.macros.calories > snackCalLimit) {
        warnings.push(`Snack calories (${meal.macros.calories}) exceed patient target (${snackCalLimit} kcal)`);
      }
      if (meal.macros.fat && meal.macros.fat > snackFatLimit) {
        violations.push(`Snack fat (${meal.macros.fat}g) exceeds patient limit (${snackFatLimit}g)`);
      }
      if (meal.macros.protein && meal.macros.protein < snackProteinFloor) {
        warnings.push(`Snack protein (${meal.macros.protein}g) below patient floor (${Math.round(snackProteinFloor)}g)`);
      }
    } else if (resolvedTargets && !resolvedTargets.usedBaseline) {
      // ── Patient-specific validation (resolver output available) ────────────
      const resolvedCalTarget = resolvedTargets.resolvedMealCalories;
      const resolvedFatCeiling = resolvedTargets.maximumToleratedFatGrams;
      const resolvedProteinTarget = resolvedTargets.targetProteinGrams;
      const proteinFloor = resolvedTargets.minimumProteinFloor;

      // Calories: soft warning at +10%, hard failure at +25% of resolved target
      if (meal.macros.calories) {
        const softLimit = Math.round(resolvedCalTarget * 1.10);
        const hardLimit = Math.round(resolvedCalTarget * 1.25);
        if (meal.macros.calories > hardLimit) {
          violations.push(
            `Calories (${meal.macros.calories} kcal) exceed patient hard limit (${hardLimit} kcal / ${resolvedCalTarget} kcal target +25%)`
          );
        } else if (meal.macros.calories > softLimit) {
          warnings.push(
            `Calories (${meal.macros.calories} kcal) above patient target (${resolvedCalTarget} kcal); within tolerated range`
          );
        }
      }

      // Fat: the resolved ceiling is a hard stop — this is the primary nausea trigger
      if (meal.macros.fat && meal.macros.fat > resolvedFatCeiling) {
        violations.push(
          `Fat (${meal.macros.fat}g) exceeds patient-specific tolerance ceiling (${resolvedFatCeiling}g)`
        );
      } else if (meal.macros.fat && meal.macros.fat > resolvedTargets.targetFatGrams) {
        warnings.push(
          `Fat (${meal.macros.fat}g) above target (${resolvedTargets.targetFatGrams}g) but within tolerated ceiling (${resolvedFatCeiling}g)`
        );
      }

      // Protein: warn if below resolved target; hard fail if below floor
      if (meal.macros.protein) {
        if (meal.macros.protein < proteinFloor) {
          violations.push(
            `Protein (${meal.macros.protein}g) is below patient minimum floor (${proteinFloor}g) — meal does not meet clinical protein requirement`
          );
        } else if (meal.macros.protein < resolvedProteinTarget) {
          warnings.push(
            `Protein (${meal.macros.protein}g) is below patient target (${resolvedProteinTarget}g); meets minimum floor of ${proteinFloor}g`
          );
        }
      }
    } else {
      // ── Static baseline validation (fallback) ─────────────────────────────
      const staticLimits = {
        maxCalories: glp1Rules.portionGuidelines.maxCalories,
        maxFat: glp1Rules.portionGuidelines.maxFatGrams,
        minProtein: glp1Rules.portionGuidelines.minProteinGrams,
      };

      if (meal.macros.calories && meal.macros.calories > staticLimits.maxCalories) {
        warnings.push(`Calories (${meal.macros.calories}) exceed GLP-1 baseline limit (${staticLimits.maxCalories} kcal)`);
      }
      if (meal.macros.fat && meal.macros.fat > staticLimits.maxFat) {
        violations.push(`Fat content (${meal.macros.fat}g) exceeds GLP-1 baseline limit (${staticLimits.maxFat}g)`);
      }
      if (meal.macros.protein && meal.macros.protein < staticLimits.minProtein) {
        warnings.push(`Protein (${meal.macros.protein}g) below GLP-1 baseline minimum (${staticLimits.minProtein}g)`);
      }
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
  snack: GLP1Meal,
  resolvedTargets?: ResolvedGLP1Targets
): ValidationResult {
  const result = validateGLP1Meal(snack, true, resolvedTargets);

  const ingredientNames = snack.ingredients
    .map(ing => (ing.name || ing.item || '').toLowerCase())
    .filter(Boolean);

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
