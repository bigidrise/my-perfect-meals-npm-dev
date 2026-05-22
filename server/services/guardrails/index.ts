/**
 * Guardrail Orchestrator
 * 
 * Main entry point for diet-specific guardrails.
 * Coordinates prompt modification and post-generation validation.
 */

import type { DietType, BuilderMode, GuardrailRequest, GuardrailResult, ValidationResult, BeachBodyPhase } from './types';
import { INGREDIENT_PRECISION_PROMPT_BLOCK, validateIngredientPrecision } from './ingredientPrecision';
import { validateDietaryRestriction, type DietaryMode } from './validators/dietaryRestrictionValidator';
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
import { liverSupportRules } from './rules/liverSupportRules';
import { buildLiverSupportPrompt, buildLiverSupportSnackPrompt, getLiverSupportSystemPrompt } from './prompt/liverSupportPromptBuilder';
import { validateLiverSupportMeal } from './validators/liverSupportValidator';
import { buildOncologySupportPrompt, ONCOLOGY_HARD_BLOCKED_INGREDIENTS } from './prompt/oncologySupportPromptBuilder';
import {
  buildKidneyDiseasePrompt, buildKidneyDiseaseSnackPrompt, getKidneyDiseaseSystemPrompt,
  kidneyDiseaseBlockedIngredients, kidneyDiseasePreferredIngredients,
} from './prompt/kidneyDiseasePromptBuilder';
import {
  buildHeartFailurePrompt, buildHeartFailureSnackPrompt, getHeartFailureSystemPrompt,
  heartFailureBlockedIngredients, heartFailurePreferredIngredients,
} from './prompt/heartFailurePromptBuilder';
import {
  buildLiverDiseasePrompt, buildLiverDiseaseSnackPrompt, getLiverDiseaseSystemPrompt,
  liverDiseaseBlockedIngredients, liverDiseasePreferredIngredients,
} from './prompt/liverDiseasePromptBuilder';

/**
 * Builds a mode-aware macro budget block to append to non-BeachBody prompts.
 * BeachBody handles its own macro block internally in beachbodyPromptBuilder.ts.
 */
function buildMacroBudgetBlock(
  remainingMacros: { protein?: number; carbs?: number; fat?: number; calories?: number },
  builderMode: BuilderMode
): string {
  const lines: string[] = [];
  if (remainingMacros.calories !== undefined && remainingMacros.calories > 0)
    lines.push(`- Calories remaining today: ${Math.round(remainingMacros.calories)} kcal`);
  if (remainingMacros.protein !== undefined && remainingMacros.protein > 0)
    lines.push(`- Protein remaining today: ${Math.round(remainingMacros.protein)}g`);
  if (remainingMacros.carbs !== undefined && remainingMacros.carbs > 0)
    lines.push(`- Carbs remaining today: ${Math.round(remainingMacros.carbs)}g`);
  if (remainingMacros.fat !== undefined && remainingMacros.fat > 0)
    lines.push(`- Fat remaining today: ${Math.round(remainingMacros.fat)}g`);

  if (lines.length === 0) return '';

  switch (builderMode) {
    case 'targeted':
      return `\n\nUser remaining macros:\n${lines.join('\n')}\n\nMODE: STRICT\nYou MUST generate a meal that stays within these values. Do not exceed any macro listed above. Hard ceiling — no exceptions.`;
    case 'lifestyle':
      return `\n\nUser remaining macros:\n${lines.join('\n')}\n\nMODE: AWARENESS\nAim to stay within these values. If the user's request naturally exceeds them, still generate a balanced, realistic, high-quality meal. Do not restrict food choices based on these numbers.`;
    case 'hybrid':
      return `\n\nUser remaining macros:\n${lines.join('\n')}\n\nMODE: PERFORMANCE\nStrongly aim to stay within these values. Small deviations of 5–10% are acceptable if needed for performance nutrition quality. Prioritize protein targets above all other macros.`;
    default:
      return '';
  }
}

/**
 * Apply diet-specific guardrails to a meal generation request
 * Returns modified prompt with diet-specific guidance injected
 */
export function applyGuardrails(
  basePrompt: string,
  dietType: DietType,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  dietPhase?: BeachBodyPhase,
  remainingMacros?: { protein?: number; carbs?: number; fat?: number; calories?: number },
  builderMode?: BuilderMode
): GuardrailResult {
  // No diet-specific guardrails for null/undefined diet type (Weekly Meal Board),
  // but still inject ingredient precision block.
  if (!dietType) {
    return {
      modifiedPrompt: basePrompt + '\n\n' + INGREDIENT_PRECISION_PROMPT_BLOCK,
      appliedRules: ['ingredient-precision'],
      warnings: []
    };
  }

  const appliedRules: string[] = [];
  const warnings: string[] = [];
  let modifiedPrompt = basePrompt;

  switch (dietType) {
    case 'oncology-support': {
      // Cancer protocol: build on anti-inflammatory base + inject forbidden ingredient hard-block
      const antiInflamBase = mealType === 'snack'
        ? buildAntiInflammatorySnackPrompt(basePrompt)
        : buildAntiInflammatoryPrompt(basePrompt);
      const forbiddenList = ONCOLOGY_HARD_BLOCKED_INGREDIENTS.join(', ');
      modifiedPrompt = antiInflamBase +
        `\n\nCANCER SUPPORT NUTRITION — HARD RULES (NON-NEGOTIABLE):\n` +
        `The following ingredients are STRICTLY FORBIDDEN and must NEVER appear in any meal name, ingredient list, or instruction:\n` +
        `${forbiddenList}\n` +
        `This includes ALL processed meats, cured meats, deli meats, and pork products. ` +
        `No exceptions. If the user's description mentions any forbidden item, substitute a safe alternative silently.\n\n` +
        `INGREDIENT TIER SYSTEM:\n` +
        `GREEN TIER (default — use freely): fresh fish, eggs, chicken breast, turkey breast, legumes, tofu, Greek yogurt.\n` +
        `YELLOW TIER (occasional only — do NOT default to these): smoked salmon, canned fish, aged cheese.\n` +
        `Always prefer fresh over smoked/cured/preserved. Never use smoked salmon as a default protein.\n\n` +
        `MANDATORY FIBER ANCHOR: Every meal must include at least one meaningful fiber source:\n` +
        `legumes, whole grains (oats/quinoa/brown rice), sweet potato, berries, or cruciferous vegetables.\n` +
        `Spinach alone does not count as a fiber anchor.\n\n` +
        `PRIORITY FOODS: fresh salmon, eggs, leafy greens, berries, cruciferous vegetables, ` +
        `legumes, nuts, seeds, olive oil, turmeric, ginger, and other anti-cancer whole foods.\n\n` +
        `QUALITY CHECKLIST — every meal MUST include ALL FIVE or it will be rejected:\n` +
        `1. PROTEIN ≥ 20g — fresh salmon/chicken/eggs/lentils/tofu as the anchor (not a side)\n` +
        `2. FIBER ANCHOR — quinoa, oats, lentils, sweet potato, brown rice, or berries (greens alone don't count)\n` +
        `3. ANTI-INFLAMMATORY VEGETABLE — broccoli, kale, mushrooms, bell peppers, or Brussels sprouts\n` +
        `4. HEALTHY FAT — olive oil, avocado, tahini, walnuts, or almonds\n` +
        `5. THERAPEUTIC BOOSTER — garlic, turmeric, ginger, lemon, or fresh herbs\n`;
      appliedRules.push('oncology-anti-inflammatory-base');
      appliedRules.push('oncology-processed-meat-hard-block');
      appliedRules.push('oncology-priority-foods');
      console.log(`🔬 Guardrails: Applied oncology-support rules for ${mealType}`);
      break;
    }

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

    case 'liver-support':
      if (mealType === 'snack') {
        modifiedPrompt = buildLiverSupportSnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildLiverSupportPrompt(basePrompt);
      }
      appliedRules.push('liver-support-alcohol-block');
      appliedRules.push('liver-support-fried-food-block');
      appliedRules.push('liver-support-sugar-restriction');
      appliedRules.push('liver-support-omega3-priority');
      console.log(`🛡️ Guardrails: Applied liver-support rules for ${mealType}`);
      break;

    case 'kidney-disease':
      if (mealType === 'snack') {
        modifiedPrompt = buildKidneyDiseaseSnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildKidneyDiseasePrompt(basePrompt);
      }
      appliedRules.push('kidney-disease-low-potassium');
      appliedRules.push('kidney-disease-low-phosphorus');
      appliedRules.push('kidney-disease-low-sodium');
      appliedRules.push('kidney-disease-moderate-protein');
      console.log(`🩺 Guardrails: Applied kidney-disease (renal diet) rules for ${mealType}`);
      break;

    case 'heart-failure':
      if (mealType === 'snack') {
        modifiedPrompt = buildHeartFailureSnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildHeartFailurePrompt(basePrompt);
      }
      appliedRules.push('heart-failure-very-low-sodium');
      appliedRules.push('heart-failure-no-processed-meats');
      appliedRules.push('heart-failure-no-alcohol');
      appliedRules.push('heart-failure-heart-healthy-fats');
      console.log(`🩺 Guardrails: Applied heart-failure (cardiac diet) rules for ${mealType}`);
      break;

    case 'liver-disease':
      if (mealType === 'snack') {
        modifiedPrompt = buildLiverDiseaseSnackPrompt(basePrompt);
      } else {
        modifiedPrompt = buildLiverDiseasePrompt(basePrompt);
      }
      appliedRules.push('liver-disease-no-alcohol-absolute');
      appliedRules.push('liver-disease-no-raw-shellfish');
      appliedRules.push('liver-disease-low-sodium');
      appliedRules.push('liver-disease-no-fried-food');
      appliedRules.push('liver-disease-moderate-protein');
      console.log(`🩺 Guardrails: Applied liver-disease (hepatic diet) rules for ${mealType}`);
      break;

    case 'diabetic':
      // ⚠️ GATED: Diabetic prompt conditioning is handled exclusively by the
      // diabeticHubModule in hubCoupling. This legacy path is intentionally
      // disabled to prevent double-prompting. Do not re-enable without removing
      // the hub module path first.
      console.log(`🛡️ Guardrails: Diabetic handled by hub module — legacy path skipped for ${mealType}`);
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
        dietPhase: phase,
        remainingMacros,
      });
      appliedRules.push(`beachbody-${phase}-phase-rules`);
      appliedRules.push('beachbody-macro-control');
      appliedRules.push('beachbody-cooking-methods');
      if (remainingMacros) appliedRules.push('beachbody-remaining-budget-enforcement');
      console.log(`🛡️ Guardrails: Applied BeachBody ${phase} phase rules for ${mealType}${remainingMacros ? ' + remaining budget' : ''}`);
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

  // Inject mode-aware macro budget block for all non-BeachBody builders.
  // BeachBody handles its own macro block internally in beachbodyPromptBuilder.ts.
  if (remainingMacros && builderMode && dietType !== 'beachbody') {
    const macroBlock = buildMacroBudgetBlock(remainingMacros, builderMode);
    if (macroBlock) {
      modifiedPrompt = modifiedPrompt + macroBlock;
      appliedRules.push(`macro-budget-${builderMode}`);
      console.log(`📊 Macro budget injected (${builderMode} mode) for ${dietType || 'null'}`);
    }
  }

  // Append ingredient precision block to ALL diet-specific prompts (Layer 1).
  modifiedPrompt = modifiedPrompt + '\n\n' + INGREDIENT_PRECISION_PROMPT_BLOCK;
  appliedRules.push('ingredient-precision');

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
    case 'liver-support':
      return getLiverSupportSystemPrompt();
    case 'kidney-disease':
      return getKidneyDiseaseSystemPrompt();
    case 'heart-failure':
      return getHeartFailureSystemPrompt();
    case 'liver-disease':
      return getLiverDiseaseSystemPrompt();
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
  // Helper: merge ingredient precision violations into any diet result
  function mergeWithPrecision(dietResult: ValidationResult): ValidationResult {
    const precisionCheck = validateIngredientPrecision(meal.ingredients);
    if (precisionCheck.isValid) return dietResult;
    console.log(`📏 Ingredient Precision: ${precisionCheck.violations.length} violation(s) found`);
    precisionCheck.violations.forEach(v => console.log(`  ⚠️ ${v}`));
    return {
      isValid: false,
      violations: [...dietResult.violations, ...precisionCheck.violations],
      blockedIngredients: [...(dietResult.blockedIngredients ?? [])],
      warnings: dietResult.warnings,
    };
  }

  // No diet-specific validation for null diet type, but still check ingredient precision
  if (!dietType) {
    return mergeWithPrecision({ isValid: true, violations: [], blockedIngredients: [] });
  }

  switch (dietType) {
    case 'anti-inflammatory': {
      const antiInflamResult = validateAntiInflammatoryMeal(meal);
      console.log(getValidationSummary(antiInflamResult));
      return mergeWithPrecision(antiInflamResult);
    }

    case 'liver-support': {
      const liverResult = validateLiverSupportMeal(meal);
      if (liverResult.violations.length > 0) {
        console.log(`🛡️ Liver Support Validation: ${liverResult.violations.length} violations found`);
        liverResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(liverResult);
    }

    case 'kidney-disease': {
      const blocked = kidneyDiseaseBlockedIngredients;
      const violations: string[] = [];
      for (const ing of meal.ingredients) {
        const name = (ing.name || '').toLowerCase();
        const match = blocked.find(b => name.includes(b.toLowerCase()));
        if (match) violations.push(`Ingredient "${ing.name}" is not safe for kidney disease diet (high potassium/phosphorus/sodium)`);
      }
      if (violations.length > 0) {
        console.log(`🩺 Kidney Disease Validation: ${violations.length} violation(s) found`);
        violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision({ isValid: violations.length === 0, violations, blockedIngredients: violations.map(v => v.split('"')[1] || v) });
    }

    case 'heart-failure': {
      const blocked = heartFailureBlockedIngredients;
      const violations: string[] = [];
      for (const ing of meal.ingredients) {
        const name = (ing.name || '').toLowerCase();
        const match = blocked.find(b => name.includes(b.toLowerCase()));
        if (match) violations.push(`Ingredient "${ing.name}" is not safe for heart failure diet (high sodium/saturated fat/alcohol)`);
      }
      if (violations.length > 0) {
        console.log(`🩺 Heart Failure Validation: ${violations.length} violation(s) found`);
        violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision({ isValid: violations.length === 0, violations, blockedIngredients: violations.map(v => v.split('"')[1] || v) });
    }

    case 'liver-disease': {
      const blocked = liverDiseaseBlockedIngredients;
      const violations: string[] = [];
      for (const ing of meal.ingredients) {
        const name = (ing.name || '').toLowerCase();
        const match = blocked.find(b => name.includes(b.toLowerCase()));
        if (match) violations.push(`Ingredient "${ing.name}" is not safe for liver disease diet (alcohol/raw shellfish/high sodium/fried)`);
      }
      if (violations.length > 0) {
        console.log(`🩺 Liver Disease Validation: ${violations.length} violation(s) found`);
        violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision({ isValid: violations.length === 0, violations, blockedIngredients: violations.map(v => v.split('"')[1] || v) });
    }

    case 'diabetic': {
      const diabeticResult = validateDiabeticMeal({
        name: meal.name,
        ingredients: meal.ingredients,
        description: '',
      });
      if (diabeticResult.violations.length > 0) {
        console.log(`🛡️ Diabetic Validation: ${diabeticResult.violations.length} violations found`);
        diabeticResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision({
        isValid: diabeticResult.isValid,
        violations: diabeticResult.violations,
        blockedIngredients: diabeticResult.violations.map(v => v.split('"')[1] || v),
      });
    }

    case 'beachbody': {
      const bbPhase = dietPhase || 'lean';
      const beachbodyResult = validateBeachBodyMeal(
        { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions },
        bbPhase,
        isSnack
      );
      if (beachbodyResult.violations.length > 0) {
        console.log(`🛡️ BeachBody Validation (${bbPhase}): ${beachbodyResult.violations.length} violations found`);
        beachbodyResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(beachbodyResult);
    }

    case 'general-nutrition': {
      const generalResult = validateGeneralNutritionMeal(
        { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions },
        isSnack
      );
      if (generalResult.violations.length > 0) {
        console.log(`🛡️ General Nutrition Validation: ${generalResult.violations.length} violations found`);
        generalResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(generalResult);
    }

    case 'performance': {
      const perfResult = validatePerformanceMeal(
        { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions },
        (dietPhase as unknown as CompetitionPhase) || 'carb',
        isSnack
      );
      if (perfResult.violations.length > 0) {
        console.log(`🏆 Performance Validation: ${perfResult.violations.length} violations found`);
        perfResult.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(perfResult);
    }

    case 'glp1': {
      const glp1Result = isSnack
        ? validateGLP1Snack({ name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions })
        : validateGLP1Meal({ name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions });
      if (glp1Result.violations.length > 0) {
        console.log(`💊 GLP-1 Validation: ${glp1Result.violations.length} violations found`);
        glp1Result.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(glp1Result);
    }

    case 'carnivore':
    case 'vegan':
    case 'vegetarian':
    case 'pescatarian': {
      const dietaryResult = validateDietaryRestriction(
        { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions },
        dietType as DietaryMode,
      );
      if (dietaryResult.violations.length > 0) {
        console.log(`🌿 ${dietType.charAt(0).toUpperCase() + dietType.slice(1)} Validation: ${dietaryResult.violations.length} violation(s) found — confidence: ${dietaryResult.confidence}`);
        dietaryResult.dietaryViolations.forEach(v =>
          console.log(`  ⚠️ [${v.severity.toUpperCase()}] ${v.reason}`)
        );
      } else {
        console.log(`✅ ${dietType.charAt(0).toUpperCase() + dietType.slice(1)} Validation: passed — confidence: ${dietaryResult.confidence}`);
      }
      return mergeWithPrecision({
        isValid: dietaryResult.isValid && dietaryResult.confidence !== 'low',
        violations: dietaryResult.violations,
        blockedIngredients: dietaryResult.blockedIngredients ?? [],
        warnings: dietaryResult.confidence === 'low'
          ? ['Meal contains unverifiable ingredients — compliance cannot be confirmed']
          : undefined,
      });
    }

    default:
      return mergeWithPrecision({ isValid: true, violations: [], blockedIngredients: [] });
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
    case 'liver-support':
      return liverSupportRules.blockedIngredients;
    case 'kidney-disease':
      return kidneyDiseaseBlockedIngredients;
    case 'heart-failure':
      return heartFailureBlockedIngredients;
    case 'liver-disease':
      return liverDiseaseBlockedIngredients;
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
    case 'liver-support':
      return liverSupportRules.preferredIngredients;
    case 'kidney-disease':
      return kidneyDiseasePreferredIngredients;
    case 'heart-failure':
      return heartFailurePreferredIngredients;
    case 'liver-disease':
      return liverDiseasePreferredIngredients;
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

export type { DietType, BuilderMode, GuardrailRequest, GuardrailResult, ValidationResult, BeachBodyPhase };
export type { ProCareRulePack } from './rules/procareTypes';
