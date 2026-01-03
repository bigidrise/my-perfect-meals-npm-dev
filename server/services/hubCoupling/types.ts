import type { UnifiedMeal } from '../unifiedMealPipeline';

export type HubType = 
  | 'diabetic'
  | 'glp1'
  | 'anti-inflammatory'
  | 'competition-pro'
  | 'beachbody'
  | 'general-nutrition'
  | 'procare';

export type ValidationSeverity = 'hard' | 'soft';

export interface HubContext {
  hubType: HubType;
  userId: string;
  data: Record<string, unknown>;
}

export interface HubGuardrails {
  hubType: HubType;
  proteinFloor?: number;
  carbCeiling?: number;
  fatCeiling?: number;
  fatFloor?: number;
  fiberMin?: number;
  giCap?: number;
  portionCap?: number;
  blockedIngredients?: string[];
  blockedCookingMethods?: string[];
  preferredIngredients?: string[];
  customRules?: Record<string, unknown>;
}

export interface PromptFragment {
  systemPrompt?: string;
  userPromptAddition: string;
  priority: number;
}

export interface ValidationViolation {
  rule: string;
  message: string;
  severity: ValidationSeverity;
  actualValue?: number | string;
  expectedValue?: number | string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: string[];
  fixHint?: string;
}

export interface HubModule {
  hubType: HubType;
  
  getContext?(userId: string): Promise<HubContext | null>;
  
  getGuardrails(userId: string): Promise<HubGuardrails>;
  
  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment;
  
  validate(
    meal: UnifiedMeal,
    guardrails: HubGuardrails
  ): ValidationResult;
  
  getFixHint?(violations: ValidationViolation[]): string;
}

export interface HubCouplingResult {
  context: HubContext | null;
  guardrails: HubGuardrails;
  promptFragment: PromptFragment;
}

export interface MealGenerationWithHub {
  meal: UnifiedMeal;
  hubType: HubType;
  validationResult: ValidationResult;
  wasRegenerated: boolean;
  regenerationAttempts: number;
}
