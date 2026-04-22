/**
 * Guardrail Types
 * 
 * Shared type definitions for the diet-specific guardrail system.
 * Each diet type (anti-inflammatory, diabetic, GLP-1, etc.) uses these
 * common interfaces for consistent filtering and validation.
 */

export type DietType = 
  | 'anti-inflammatory'
  | 'liver-support'
  | 'diabetic'
  | 'glp1'
  | 'beachbody'
  | 'performance'
  | 'general-nutrition'
  | 'procare'
  | 'vegan'
  | 'vegetarian'
  | 'pescatarian'
  | null; // null = no guardrails (Weekly Meal Board)

export type BeachBodyPhase = 'lean' | 'carb-control' | 'maintenance' | 'sculpt';

export interface ExplicitOverride {
  item: string;
  confirmed: boolean;
}

export interface GuardrailRequest {
  dietType: DietType;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  userInput: string;
  dietPhase?: BeachBodyPhase;
  macroTargets?: {
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    calories?: number;
  };
  /**
   * Remaining macro budget for today. When provided, the AI MUST generate
   * within these numbers — not the baseline daily targets.
   * Only inject this when the user has active macro tracking and has eaten today.
   */
  remainingMacros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    calories?: number;
  };
  explicitOverride?: ExplicitOverride;
}

export interface GuardrailRules {
  dietType: DietType;
  blockedIngredients: string[];
  preferredIngredients: string[];
  promptGuidance?: string;
  macroConstraints?: {
    maxSugar_g?: number;
    maxSaturatedFat_g?: number;
    minProtein_g?: number;
    maxCarbs_g?: number;
    minFiber_g?: number;
  };
  substitutions?: Record<string, string>;
  macroGuidelines?: {
    lowGlycemicImpact?: boolean;
    proteinPriority?: string;
    fiberPriority?: string;
    carbLimit?: string;
    fatBalance?: string;
    evenMacroDistribution?: boolean;
  };
  snackRules?: {
    lowCarb?: boolean;
    highProteinOrFiber?: boolean;
    lowSugar?: boolean;
    minimalGlycemicLoad?: boolean;
  };
}

export interface GeneratedMeal {
  name: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string; quantity?: string; unit?: string } | string>;
  instructions?: string | string[];
  macros?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
}

export interface GuardrailResult {
  modifiedPrompt: string;
  appliedRules: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  blockedIngredients?: string[];
  warnings?: string[];
  dietType?: DietType;
}
