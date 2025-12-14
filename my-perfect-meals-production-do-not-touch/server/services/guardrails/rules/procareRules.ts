/**
 * ProCare Rules Engine - Phase 3.7
 * 
 * Dynamic rule resolution system that merges:
 * - Trainer-defined macros
 * - Doctor-defined medical exclusions  
 * - Medical presets (diabetic, cardiac, GLP-1, etc.)
 * - Custom ingredient blacklists/whitelists
 * - Cooking method restrictions
 */

import { 
  ProCareRulePack, 
  ProCareGuardrailRequest,
  PROCARE_FIXED_RULES,
  calculateProteinPerMeal,
  calculateCaloriesPerMeal 
} from './procareTypes';
import { diabeticRules } from './diabeticRules';
import { antiInflammatoryRules } from './antiInflammatoryRules';
import { glp1Rules } from './glp1Rules';

export interface ResolvedProCareRules {
  blockedIngredients: string[];
  preferredIngredients: string[];
  allowedCookingMethods: string[];
  forbiddenCookingMethods: string[];
  macroLimits: {
    proteinMin: number;
    proteinMax: number;
    carbsMax: number;
    fatsMax: number;
    caloriesMax: number;
  };
  portionMultiplier: number;
  customNotes: string[];
}

export function resolveProCareRules(rulePack: ProCareRulePack): ResolvedProCareRules {
  const blockedIngredients: string[] = [
    ...PROCARE_FIXED_RULES.universalBlacklist,
    ...rulePack.ingredientBlacklist,
  ];

  const preferredIngredients: string[] = rulePack.ingredientWhitelist || [];
  const customNotes: string[] = [];

  if (rulePack.medicalPreset) {
    const presetRules = getMedicalPresetRules(rulePack.medicalPreset);
    blockedIngredients.push(...presetRules.blockedIngredients);
    preferredIngredients.push(...presetRules.preferredIngredients);
    customNotes.push(`Medical preset active: ${rulePack.medicalPreset}`);
  }

  if (rulePack.doctorRestrictions) {
    blockedIngredients.push(...rulePack.doctorRestrictions);
    customNotes.push('Doctor restrictions applied');
  }

  if (rulePack.coachCustomNotes) {
    customNotes.push(rulePack.coachCustomNotes);
  }

  const proteinPerMeal = calculateProteinPerMeal(rulePack);
  const caloriesPerMeal = calculateCaloriesPerMeal(rulePack);
  const carbsPerMeal = Math.round(rulePack.macroTargets.carbs / rulePack.mealFrequency);
  const fatsPerMeal = Math.round(rulePack.macroTargets.fats / rulePack.mealFrequency);

  let allowedMethods = [...PROCARE_FIXED_RULES.allowedCookingMethods];
  let forbiddenMethods = [...PROCARE_FIXED_RULES.forbiddenCookingMethods];

  if (rulePack.cookingConstraints) {
    for (const constraint of rulePack.cookingConstraints) {
      const lowerConstraint = constraint.toLowerCase();
      if (lowerConstraint.includes('no oil') || lowerConstraint.includes('oil-free')) {
        forbiddenMethods.push('sauté', 'sautéed', 'saute', 'sauteed');
        customNotes.push('Oil-free cooking required');
      }
      if (lowerConstraint.includes('low sodium') || lowerConstraint.includes('low-sodium')) {
        customNotes.push('Low sodium preparation required');
      }
    }
  }

  return {
    blockedIngredients: Array.from(new Set(blockedIngredients)),
    preferredIngredients: Array.from(new Set(preferredIngredients)),
    allowedCookingMethods: allowedMethods,
    forbiddenCookingMethods: Array.from(new Set(forbiddenMethods)),
    macroLimits: {
      proteinMin: Math.round(proteinPerMeal * 0.9),
      proteinMax: Math.round(proteinPerMeal * 1.2),
      carbsMax: carbsPerMeal,
      fatsMax: fatsPerMeal,
      caloriesMax: caloriesPerMeal,
    },
    portionMultiplier: rulePack.portionMultiplier || 1.0,
    customNotes,
  };
}

function getMedicalPresetRules(preset: string): { blockedIngredients: string[]; preferredIngredients: string[] } {
  switch (preset) {
    case 'diabetic':
      return {
        blockedIngredients: diabeticRules.blockedIngredients,
        preferredIngredients: diabeticRules.preferredIngredients,
      };
    case 'anti-inflammatory':
      return {
        blockedIngredients: antiInflammatoryRules.blockedIngredients,
        preferredIngredients: antiInflammatoryRules.preferredIngredients,
      };
    case 'glp1':
      return {
        blockedIngredients: glp1Rules.blockedIngredients,
        preferredIngredients: glp1Rules.preferredIngredients,
      };
    case 'cardiac':
      return {
        blockedIngredients: [
          'salt', 'sodium', 'bacon', 'sausage', 'processed meat',
          'fried', 'butter', 'cream', 'cheese', 'full-fat dairy',
          'red meat', 'organ meat', 'shellfish',
        ],
        preferredIngredients: [
          'salmon', 'mackerel', 'sardines', 'olive oil', 'avocado',
          'nuts', 'seeds', 'leafy greens', 'berries', 'oats',
          'legumes', 'whole grains',
        ],
      };
    case 'renal':
      return {
        blockedIngredients: [
          'banana', 'orange', 'potato', 'tomato', 'spinach',
          'dairy', 'cheese', 'nuts', 'beans', 'lentils',
          'processed foods', 'canned foods', 'deli meat',
        ],
        preferredIngredients: [
          'egg whites', 'chicken breast', 'fish', 'rice',
          'cabbage', 'peppers', 'onions', 'berries', 'apples',
        ],
      };
    default:
      return { blockedIngredients: [], preferredIngredients: [] };
  }
}

export function getProCareSystemPrompt(rulePack: ProCareRulePack): string {
  const resolved = resolveProCareRules(rulePack);
  const proteinPerMeal = calculateProteinPerMeal(rulePack);
  const caloriesPerMeal = calculateCaloriesPerMeal(rulePack);

  return `PROCARE PROFESSIONAL SUPERVISION MODE - STRICT COMPLIANCE REQUIRED

This user is under professional supervision (trainer/doctor/clinic).
All meals MUST strictly follow the assigned rule pack.

MACRO TARGETS PER MEAL:
- Protein: ${proteinPerMeal}g (±10%)
- Carbs: Maximum ${resolved.macroLimits.carbsMax}g
- Fats: Maximum ${resolved.macroLimits.fatsMax}g
- Calories: Maximum ${caloriesPerMeal}

ABSOLUTELY FORBIDDEN INGREDIENTS:
${resolved.blockedIngredients.slice(0, 30).join(', ')}

COOKING METHODS ALLOWED ONLY:
${resolved.allowedCookingMethods.join(', ')}

COOKING METHODS FORBIDDEN:
${resolved.forbiddenCookingMethods.join(', ')}

${resolved.preferredIngredients.length > 0 ? `PREFERRED INGREDIENTS:\n${resolved.preferredIngredients.slice(0, 20).join(', ')}` : ''}

${resolved.customNotes.length > 0 ? `SPECIAL NOTES:\n${resolved.customNotes.join('\n')}` : ''}

REQUIREMENTS:
- HIGH PROTEIN meals - protein must be prioritized
- CLEAN INGREDIENTS - no junk foods, desserts, or processed meals
- LOW-MODERATE FAT unless doctor overrides
- STRICT macro accuracy - this is medical/professional supervision
- Generate meals that are simple, clean, and macro-compliant`;
}
