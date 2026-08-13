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
import { buildGLP1Prompt, buildGLP1SnackPrompt, buildGLP1ConstraintOverlay } from './prompt/glp1PromptBuilder';
import { validateGLP1Meal, validateGLP1Snack } from './validators/glp1Validator';
import type { ResolvedGLP1Targets } from '../glp1/resolveGLP1MealTargets';
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
  builderMode?: BuilderMode,
  dailyProteinTarget?: number,
  glp1Targets?: ResolvedGLP1Targets
): GuardrailResult {
  // No primary-diet guardrails for null/undefined diet type (Weekly Meal Board,
  // Create With Chef with no builder selection, etc.).
  // GLP-1 is a mandatory medical protocol — still inject overlay when targets
  // are present, regardless of whether a primary diet type was selected.
  if (!dietType) {
    const nullDietRules: string[] = ['ingredient-precision'];
    let nullDietPrompt = basePrompt;
    if (glp1Targets) {
      nullDietPrompt = basePrompt + buildGLP1ConstraintOverlay(mealType, glp1Targets);
      nullDietRules.unshift('glp1-medical-overlay', 'glp1-small-portions', 'glp1-low-fat', 'glp1-high-protein');
      if (!glp1Targets.usedBaseline) nullDietRules.push('glp1-personalized-targets');
      console.log(
        `💊 GLP-1 medical overlay on null-diet ${mealType} ` +
        `[${glp1Targets.resolvedMealCalories}kcal / ${glp1Targets.maximumToleratedFatGrams}g fat-ceiling]`
      );
    }
    return {
      modifiedPrompt: nullDietPrompt + '\n\n' + INGREDIENT_PRECISION_PROMPT_BLOCK,
      appliedRules: nullDietRules,
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
        modifiedPrompt = buildGLP1SnackPrompt(basePrompt, glp1Targets);
      } else {
        modifiedPrompt = buildGLP1Prompt({ mealType, userRequest: basePrompt }, glp1Targets);
      }
      appliedRules.push('glp1-small-portions');
      appliedRules.push('glp1-low-fat');
      appliedRules.push('glp1-high-protein');
      appliedRules.push('glp1-easy-digestion');
      if (glp1Targets && !glp1Targets.usedBaseline) {
        appliedRules.push('glp1-personalized-targets');
        console.log(`🛡️ Guardrails: Applied GLP-1 rules for ${mealType} [PERSONALIZED: ${glp1Targets.resolvedMealCalories}kcal / ${glp1Targets.targetProteinGrams}g protein / ${glp1Targets.maximumToleratedFatGrams}g fat — phase: ${glp1Targets.treatmentPhase}]`);
      } else {
        console.log(`🛡️ Guardrails: Applied GLP-1 rules for ${mealType} [baseline fallback]`);
      }
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

    case 'performance': {
      const perfProteinTarget = dailyProteinTarget ?? (() => {
        console.warn('[guardrails] buildPerformancePrompt called without dailyProteinTarget — call site should supply live DB value. Using 160g fallback for meal generation.');
        return 160;
      })();
      modifiedPrompt = buildPerformancePrompt({
        dietType: 'performance',
        mealType,
        userInput: basePrompt,
        carbPhase: (dietPhase as unknown as CompetitionPhase) || 'carb',
        dailyProteinTarget: perfProteinTarget,
      });
      appliedRules.push('performance-strict-ingredient-filter');
      appliedRules.push('performance-macro-control');
      appliedRules.push('performance-cooking-method-restriction');
      appliedRules.push('performance-sodium-control');
      console.log(`🛡️ Guardrails: Applied STRICT performance/competition rules for ${mealType}`);
      break;
    }

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

  // GLP-1 stacking overlay: when resolved targets are provided but the primary
  // diet type is not 'glp1', append GLP-1 constraints as a mandatory medical
  // protocol additive layer (does not replace the primary diet's prompt).
  //
  // Activation: any source — selectedMealBuilder, medicalConditions,
  // specialtyConditions, preferredBuilder, or glp1_profile row — triggers
  // this overlay. The overlay carries the patient-specific calorie/protein/fat
  // ceilings from resolveGLP1MealTargets, or baseline values on fallback.
  if (glp1Targets && dietType !== 'glp1') {
    modifiedPrompt = modifiedPrompt + buildGLP1ConstraintOverlay(mealType, glp1Targets);
    appliedRules.push('glp1-medical-overlay');
    appliedRules.push('glp1-small-portions');
    appliedRules.push('glp1-low-fat');
    appliedRules.push('glp1-high-protein');
    if (glp1Targets && !glp1Targets.usedBaseline) {
      appliedRules.push('glp1-personalized-targets');
      console.log(
        `💊 GLP-1 medical overlay stacked on ${dietType} for ${mealType} ` +
        `[${glp1Targets.resolvedMealCalories}kcal / ${glp1Targets.targetProteinGrams}g prot / ` +
        `${glp1Targets.maximumToleratedFatGrams}g fat-ceiling — phase: ${glp1Targets.treatmentPhase}]`
      );
    } else {
      console.log(`💊 GLP-1 medical overlay stacked on ${dietType} for ${mealType} [baseline fallback]`);
    }
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
    macros?: { calories?: number; protein?: number; fat?: number; carbs?: number };
  },
  dietType: DietType,
  dietPhase?: BeachBodyPhase,
  isSnack: boolean = false,
  glp1Targets?: ResolvedGLP1Targets
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

  // No primary-diet validation for null diet type, but GLP-1 is a mandatory
  // medical protocol — still run overlay validator when targets are present.
  if (!dietType) {
    if (glp1Targets) {
      const glp1MealObj = { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions, macros: meal.macros };
      const glp1Result = isSnack
        ? validateGLP1Snack(glp1MealObj, glp1Targets)
        : validateGLP1Meal(glp1MealObj, false, glp1Targets);
      if (glp1Result.violations.length > 0) {
        console.log(
          `💊 GLP-1 validation on null-diet ${isSnack ? 'snack' : 'meal'}: ` +
          `${glp1Result.violations.length} violation(s)`
        );
        glp1Result.violations.forEach(v => console.log(`  ⚠️ ${v}`));
      }
      return mergeWithPrecision(glp1Result);
    }
    return mergeWithPrecision({ isValid: true, violations: [], blockedIngredients: [] });
  }

  // ── Primary diet validation ────────────────────────────────────────────────
  // Run the diet-specific validator first, then optionally stack GLP-1 overlay.
  // Extracted into an inner function so the GLP-1 overlay can be applied after
  // any diet type without duplicating each case's return statement.
  function runPrimaryValidation(): ValidationResult {
    switch (dietType as any) {
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
        const glp1MealObj = { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions, macros: meal.macros };
        const glp1Result = isSnack
          ? validateGLP1Snack(glp1MealObj, glp1Targets)
          : validateGLP1Meal(glp1MealObj, false, glp1Targets);
        if (glp1Targets && !glp1Targets.usedBaseline) {
          console.log(`💊 GLP-1 Validation [personalized: ${glp1Targets.resolvedMealCalories}kcal / ${glp1Targets.maximumToleratedFatGrams}g fat / ${glp1Targets.targetProteinGrams}g protein]: ${glp1Result.violations.length} violations, ${glp1Result.warnings?.length ?? 0} warnings`);
        } else {
          console.log(`💊 GLP-1 Validation [baseline]: ${glp1Result.violations.length} violations, ${glp1Result.warnings?.length ?? 0} warnings`);
        }
        if (glp1Result.violations.length > 0) {
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
          const dLabel = (dietType as string).charAt(0).toUpperCase() + (dietType as string).slice(1);
          console.log(`🌿 ${dLabel} Validation: ${dietaryResult.violations.length} violation(s) found — confidence: ${dietaryResult.confidence}`);
          dietaryResult.dietaryViolations.forEach(v =>
            console.log(`  ⚠️ [${v.severity.toUpperCase()}] ${v.reason}`)
          );
        } else {
          const dLabel = (dietType as string).charAt(0).toUpperCase() + (dietType as string).slice(1);
          console.log(`✅ ${dLabel} Validation: passed — confidence: ${dietaryResult.confidence}`);
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

  const primaryResult = runPrimaryValidation();

  // ── GLP-1 stacking validation overlay ────────────────────────────────────
  // When resolved targets are provided but the primary diet is not 'glp1',
  // the patient is GLP-1 active from a non-builder source (medical conditions,
  // specialtyConditions, glp1_profile row, etc.).  Run the GLP-1 validator as
  // a stacking overlay and merge any violations into the primary result.
  //
  // The 'glp1' case above already handles the direct path — skip it here.
  if (glp1Targets && dietType !== 'glp1') {
    const glp1MealObj = {
      name: meal.name,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      macros: meal.macros,
    };
    const glp1Overlay = isSnack
      ? validateGLP1Snack(glp1MealObj, glp1Targets)
      : validateGLP1Meal(glp1MealObj, false, glp1Targets);

    if (glp1Overlay.violations.length > 0) {
      const phaseNote = !glp1Targets.usedBaseline ? ` [${glp1Targets.treatmentPhase}]` : ' [baseline]';
      console.log(
        `💊 GLP-1 stacking overlay validation${phaseNote} on ${dietType}: ` +
        `${glp1Overlay.violations.length} additional violation(s)`
      );
      glp1Overlay.violations.forEach(v => console.log(`  ⚠️ [GLP-1 overlay] ${v}`));

      // Merge overlay violations into primary result
      const mergedViolations = [...primaryResult.violations, ...glp1Overlay.violations];
      return {
        isValid: mergedViolations.length === 0,
        violations: mergedViolations,
        blockedIngredients: [
          ...(primaryResult.blockedIngredients ?? []),
          ...(glp1Overlay.blockedIngredients ?? []),
        ],
        warnings: [
          ...(primaryResult.warnings ?? []),
          ...(glp1Overlay.warnings ?? []),
        ],
      };
    }
  }

  return primaryResult;
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
