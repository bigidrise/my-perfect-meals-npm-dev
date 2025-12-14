/**
 * ProCare Guardrails Types - Phase 3.7
 * 
 * Dynamic rule system for professional supervision environments.
 * Trainers, doctors, and clinics can set custom rules per client.
 * 
 * This is the ONLY fully dynamic guardrail system - all others use fixed presets.
 */

export interface ProCareMacroTargets {
  protein: number;
  carbs: number;
  fats: number;
  caloriesPerDay: number;
  caloriesPerMeal?: number;
}

export interface ProCareRulePack {
  dietType?: string;
  macroTargets: ProCareMacroTargets;
  ingredientBlacklist: string[];
  ingredientWhitelist?: string[];
  portionMultiplier?: number;
  cookingConstraints?: string[];
  mealFrequency: number;
  proteinPerMeal?: number;
  coachCustomNotes?: string;
  doctorRestrictions?: string[];
  medicalPreset?: 'diabetic' | 'cardiac' | 'glp1' | 'anti-inflammatory' | 'renal' | null;
  sodiumLimit?: number;
}

export interface ProCareGuardrailRequest {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  rulePack: ProCareRulePack;
  userRequest?: string;
  selectedIngredients?: string[];
}

export interface ProCareValidationResult {
  isValid: boolean;
  violations: string[];
  blockedIngredients: string[];
  macroViolations: string[];
  warnings: string[];
}

export const DEFAULT_PROCARE_RULES: Partial<ProCareRulePack> = {
  cookingConstraints: ['no deep frying', 'minimal oil'],
  portionMultiplier: 1.0,
  mealFrequency: 4,
};

export const PROCARE_FIXED_RULES = {
  allowedCookingMethods: ['grill', 'grilled', 'bake', 'baked', 'steam', 'steamed', 'air fry', 'air-fry', 'air fried', 'broil', 'broiled', 'poach', 'poached'],
  forbiddenCookingMethods: ['deep fry', 'deep-fry', 'deep fried', 'pan fry', 'pan-fry', 'fried'],
  universalBlacklist: [
    'candy', 'cookies', 'cake', 'pastry', 'donut', 'doughnut',
    'chips', 'french fries', 'fried chicken', 'hot dog',
    'ice cream', 'milkshake', 'soda', 'pop',
    'sugar', 'corn syrup', 'high fructose',
  ],
  snackMinProtein: 8,
  snackMaxFat: 8,
  snackMaxCarbs: 20,
};

export function calculateProteinPerMeal(rulePack: ProCareRulePack): number {
  if (rulePack.proteinPerMeal) {
    return rulePack.proteinPerMeal;
  }
  return Math.round(rulePack.macroTargets.protein / rulePack.mealFrequency);
}

export function calculateCaloriesPerMeal(rulePack: ProCareRulePack): number {
  if (rulePack.macroTargets.caloriesPerMeal) {
    return rulePack.macroTargets.caloriesPerMeal;
  }
  return Math.round(rulePack.macroTargets.caloriesPerDay / rulePack.mealFrequency);
}
