/**
 * Guardrail Orchestrator
 * 
 * Main entry point for diet-specific guardrails.
 * Coordinates prompt modification and post-generation validation.
 */

import type { DietType, GuardrailRequest, GuardrailResult, ValidationResult, BeachBodyPhase } from './types';
import { antiInflammatoryRules } from './rules/antiInflammatoryRules';
import { buildAntiInflammatoryPrompt, buildAntiInflammatorySnackPrompt, getAntiInflammatorySystemPrompt } from './prompt/antiInflammatoryPromptBuilder';
import { validateAntiInflammatoryMeal, getValidationSummary } from './validators/antiInflammatoryValidator';
import { diabeticRules } from './rules/diabeticRules';
import { buildDiabeticPromptConditions, buildDiabeticSnackPromptConditions } from './prompt/diabeticPromptBuilder';
import { validateDiabeticMeal } from './validators/diabeticValidator';
import { getBeachBodyRules } from './rules/beachbodyRules';
import { buildBeachBodyPrompt } from './prompt/beachbodyPromptBuilder';
import { validateBeachBodyMeal } from './validators/beachbodyValidator';
import { generalNutritionRules } from './rules/generalNutritionRules';
import { buildGeneralNutritionPrompt, getGeneralNutritionSystemPrompt } from './prompt/generalNutritionPromptBuilder';
import { validateGeneralNutritionMeal } from './validators/generalNutritionValidator';
import { performanceRules } from './rules/performanceRules';
import { buildPerformancePrompt, getPerformanceSystemPrompt, type CompetitionPhase } from './prompt/performancePromptBuilder';
import { validatePerformanceMeal } from './validators/performanceValidator';
import { glp1Rules, getGLP1SystemPrompt } from './rules/glp1Rules';
import { buildGLP1Prompt, buildGLP1SnackPrompt } from './prompt/glp1PromptBuilder';
import { validateGLP1Meal, validateGLP1Snack } from './validators/glp1Validator';
import { ProCareRulePack, PROCARE_FIXED_RULES } from './rules/procareTypes';
import { resolveProCareRules, getProCareSystemPrompt } from './rules/procareRules';
import { buildProCarePrompt, buildProCareSnackPrompt } from './prompt/procarePromptBuilder';
import { validateProCareMeal, validateProCareSnack } from './validators/procareValidator';

/**
 * Apply diet-specific guardrails to a meal generation request
 * Returns modified prompt with diet-specific guidance injected
 */
export function applyGuardrails(
  basePrompt: string,
  dietType: DietType,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  dietPhase?: BeachBodyPhase
): GuardrailResult {
  // No guardrails for null/undefined diet type (Weekly Meal Board)
  if (!dietType) {
    return {
      modifiedPrompt: basePrompt,
      appliedRules: [],
      warnings: []
    };
  }

  const appliedRules: string[] = [];
  const warnings: string[] = [];
  let modifiedPrompt = basePrompt;

  switch (dietType) {
    case 'anti-inflammatory':
      if (mealType === 'snack') {
        modifiedPrompt = buildAntiInflammatorySnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildAntiInflammatoryPrompt(basePrompt);
      }
      appliedRules.push('anti-inflammatory-ingredient-filter');
      appliedRules.push('anti-inflammatory-oil-restriction');
      appliedRules.push('anti-inflammatory-protein-guidance');
      console.log(`🛡️ Guardrails: Applied anti-inflammatory rules for ${mealType}`);
      break;

    case 'diabetic':
      if (mealType === 'snack') {
        modifiedPrompt = `${basePrompt}\n\n${buildDiabeticSnackPromptConditions()}`;
      } else {
        modifiedPrompt = `${basePrompt}\n\n${buildDiabeticPromptConditions()}`;
      }
      appliedRules.push('diabetic-glycemic-control');
      appliedRules.push('diabetic-sugar-restriction');
      appliedRules.push('diabetic-carb-control');
      appliedRules.push('diabetic-fiber-priority');
      console.log(`🛡️ Guardrails: Applied diabetic rules for ${mealType}`);
      break;

    case 'glp1':
      if (mealType === 'snack') {
        modifiedPrompt = buildGLP1SnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildGLP1Prompt({ mealType, userRequest: basePrompt });
      }
      appliedRules.push('glp1-small-portions');
      appliedRules.push('glp1-low-fat');
      appliedRules.push('glp1-high-protein');
      appliedRules.push('glp1-easy-digestion');
      console.log(`🛡️ Guardrails: Applied GLP-1 rules for ${mealType}`);
      break;

    case 'beachbody':
      const phase = dietPhase || 'lean';
      modifiedPrompt = buildBeachBodyPrompt({
        dietType: 'beachbody',
        mealType,
        userInput: basePrompt,
        dietPhase: phase
      });
      appliedRules.push(`beachbody-${phase}-phase-rules`);
      appliedRules.push('beachbody-macro-control');
      appliedRules.push('beachbody-cooking-methods');
      console.log(`🛡️ Guardrails: Applied BeachBody ${phase} phase rules for ${mealType}`);
      break;

    case 'performance':
      modifiedPrompt = buildPerformancePrompt({
        dietType: 'performance',
        mealType,
        userInput: basePrompt,
        carbPhase: (dietPhase as unknown as CompetitionPhase) || 'carb',
      });
      appliedRules.push('performance-strict-ingredient-filter');
      appliedRules.push('performance-macro-control');
      appliedRules.push('performance-cooking-method-restriction');
      appliedRules.push('performance-sodium-control');
      console.log(`🛡️ Guardrails: Applied STRICT performance/competition rules for ${mealType}`);
      break;

    case 'general-nutrition':
      modifiedPrompt = buildGeneralNutritionPrompt({
        dietType: 'general-nutrition',
        mealType,
        userInput: basePrompt
      });
      appliedRules.push('general-nutrition-clean-eating');
      appliedRules.push('general-nutrition-balance');
      appliedRules.push('general-nutrition-wholefood-priority');
      console.log(`🛡️ Guardrails: Applied general nutrition rules for ${mealType}`);
      break;

    case 'procare':
      appliedRules.push('procare-dynamic-rules');
      appliedRules.push('procare-macro-compliance');
      appliedRules.push('procare-professional-supervision');
      console.log(`🏥 Guardrails: ProCare mode active - use applyProCareGuardrails() with rulePack for full enforcement`);
      break;

    default:
      console.log(`⚠️ Unknown diet type: ${dietType}, no guardrails applied`);
  }

  return {
    modifiedPrompt,
    appliedRules,
    warnings
  };
}

/**
 * Get diet-specific system prompt addition
 */
export function getSystemPromptForDiet(dietType: DietType): string | null {
  if (!dietType) return null;

  switch (dietType) {
    case 'anti-inflammatory':
      return getAntiInflammatorySystemPrompt();
    case 'diabetic':
      return buildDiabeticPromptConditions();
    case 'general-nutrition':
      return getGeneralNutritionSystemPrompt();
    case 'performance':
      return getPerformanceSystemPrompt();
    case 'glp1':
      return getGLP1SystemPrompt();
    default:
      return null;
  }
}

/**
 * Validate a generated meal against diet-specific rules
 */
export function validateMealForDiet(
  meal: {
    name: string;
    ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
    instructions?: string | string[];
  },
  dietType: DietType,
  dietPhase?: BeachBodyPhase,
  isSnack: boolean = false
): ValidationResult {
  // No validation needed for null diet type
  if (!dietType) {
    return {
      isValid: true,
      violations: [],
      blockedIngredients: []
    };
  }

  switch (dietType) {
    case 'anti-inflammatory':
      const antiInflamResult = validateAntiInflammatoryMeal(meal);
      console.log(getValidationSummary(antiInflamResult));
      return antiInflamResult;

    case 'diabetic':
      const diabeticResult = validateDiabeticMeal({
        name: meal.name,
        ingredients: meal.ingredients,
        description: '',
      });
      if (diabeticResult.violations.length > 0) {
        console.log(`🛡️ Diabetic Validation: ${diabeticResult.violations.length} violations found`);
        diabeticResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return {
        isValid: diabeticResult.isValid,
        violations: diabeticResult.violations,
        blockedIngredients: diabeticResult.violations.map(v => v.split('"')[1] || v),
      };

    case 'beachbody':
      const bbPhase = dietPhase || 'lean';
      const beachbodyResult = validateBeachBodyMeal(
        {
          name: meal.name,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
        },
        bbPhase,
        isSnack
      );
      if (beachbodyResult.violations.length > 0) {
        console.log(`🛡️ BeachBody Validation (${bbPhase}): ${beachbodyResult.violations.length} violations found`);
        beachbodyResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return beachbodyResult;

    case 'general-nutrition':
      const generalResult = validateGeneralNutritionMeal(
        {
          name: meal.name,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
        },
        isSnack
      );
      if (generalResult.violations.length > 0) {
        console.log(`🛡️ General Nutrition Validation: ${generalResult.violations.length} violations found`);
        generalResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return generalResult;

    case 'performance':
      const perfResult = validatePerformanceMeal(
        {
          name: meal.name,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
        },
        (dietPhase as unknown as CompetitionPhase) || 'carb',
        isSnack
      );
      if (perfResult.violations.length > 0) {
        console.log(`🏆 Performance Validation: ${perfResult.violations.length} violations found`);
        perfResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return perfResult;

    case 'glp1':
      const glp1Result = isSnack
        ? validateGLP1Snack({
            name: meal.name,
            ingredients: meal.ingredients,
            instructions: meal.instructions,
          })
        : validateGLP1Meal({
            name: meal.name,
            ingredients: meal.ingredients,
            instructions: meal.instructions,
          });
      if (glp1Result.violations.length > 0) {
        console.log(`💊 GLP-1 Validation: ${glp1Result.violations.length} violations found`);
        glp1Result.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return glp1Result;

    default:
      return {
        isValid: true,
        violations: [],
        blockedIngredients: []
      };
  }
}

/**
 * Get blocked ingredient list for a diet type
 */
export function getBlockedIngredientsForDiet(dietType: DietType, dietPhase?: BeachBodyPhase): string[] {
  if (!dietType) return [];

  switch (dietType) {
    case 'anti-inflammatory':
      return antiInflammatoryRules.blockedIngredients;
    case 'diabetic':
      return diabeticRules.blockedIngredients;
    case 'beachbody':
      return getBeachBodyRules(dietPhase || 'lean').blockedIngredients;
    case 'general-nutrition':
      return generalNutritionRules.blockedIngredients;
    case 'performance':
      return performanceRules.blockedIngredients;
    case 'glp1':
      return glp1Rules.blockedIngredients;
    case 'procare':
      return PROCARE_FIXED_RULES.universalBlacklist;
    default:
      return [];
  }
}

/**
 * Get preferred ingredient list for a diet type
 */
export function getPreferredIngredientsForDiet(dietType: DietType, dietPhase?: BeachBodyPhase): string[] {
  if (!dietType) return [];

  switch (dietType) {
    case 'anti-inflammatory':
      return antiInflammatoryRules.preferredIngredients;
    case 'diabetic':
      return diabeticRules.preferredIngredients;
    case 'beachbody':
      return getBeachBodyRules(dietPhase || 'lean').preferredIngredients;
    case 'general-nutrition':
      return generalNutritionRules.preferredIngredients;
    case 'performance':
      return performanceRules.preferredIngredients;
    case 'glp1':
      return glp1Rules.preferredIngredients;
    case 'procare':
      return [];
    default:
      return [];
  }
}

/**
 * Apply ProCare-specific guardrails with full rule pack
 * This is the main entry point for ProCare meal generation
 */
export function applyProCareGuardrails(
  basePrompt: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  rulePack: ProCareRulePack
): GuardrailResult {
  const appliedRules: string[] = [];
  const warnings: string[] = [];
  let modifiedPrompt: string;

  if (mealType === 'snack') {
    modifiedPrompt = buildProCareSnackPrompt(rulePack, basePrompt);
  } else {
    modifiedPrompt = buildProCarePrompt({
      mealType,
      rulePack,
      userRequest: basePrompt,
    });
  }

  appliedRules.push('procare-dynamic-rules');
  appliedRules.push('procare-macro-compliance');
  appliedRules.push('procare-professional-supervision');

  if (rulePack.medicalPreset) {
    appliedRules.push(`procare-medical-preset-${rulePack.medicalPreset}`);
  }

  if (rulePack.doctorRestrictions && rulePack.doctorRestrictions.length > 0) {
    appliedRules.push('procare-doctor-restrictions');
  }

  if (rulePack.ingredientBlacklist && rulePack.ingredientBlacklist.length > 0) {
    appliedRules.push('procare-coach-blacklist');
  }

  console.log(`🏥 Guardrails: Applied ProCare rules for ${mealType} (${appliedRules.length} rules active)`);

  return {
    modifiedPrompt,
    appliedRules,
    warnings
  };
}

/**
 * Validate a ProCare meal against the client's rule pack
 */
export function validateProCareMealForRulePack(
  meal: {
    name: string;
    ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
    instructions?: string | string[];
    macros?: { calories?: number; protein?: number; fat?: number; carbs?: number };
  },
  rulePack: ProCareRulePack,
  isSnack: boolean = false
): ValidationResult {
  const result = isSnack
    ? validateProCareSnack(meal, rulePack)
    : validateProCareMeal(meal, rulePack, isSnack);

  if (result.violations.length > 0) {
    console.log(`🏥 ProCare Validation: ${result.violations.length} violations found`);
    result.violations.forEach(v => console.log(`  ⚠️ ${v}`));
  }

  return {
    isValid: result.isValid,
    violations: result.violations,
    blockedIngredients: result.blockedIngredients,
  };
}

/**
 * Get resolved ProCare rules for a client
 */
export function getResolvedProCareRules(rulePack: ProCareRulePack) {
  return resolveProCareRules(rulePack);
}

export type { DietType, GuardrailRequest, GuardrailResult, ValidationResult, BeachBodyPhase };
export type { ProCareRulePack } from './rules/procareTypes';
