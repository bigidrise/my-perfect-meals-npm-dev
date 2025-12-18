/**
 * BeachBody Prompt Builder
 * 
 * Builds phase-aware prompts for BeachBody meal generation.
 * Each phase has different macro priorities and ingredient guidance.
 */

import type { GuardrailRequest, BeachBodyPhase } from '../types';
import { getBeachBodyRules, BEACHBODY_COOKING_METHODS } from '../rules/beachbodyRules';

const PHASE_DESCRIPTIONS: Record<BeachBodyPhase, string> = {
  'lean': 'Phase 1 - Lean/Fat Loss: High protein, low fat, moderate carbs. Focus on calorie-controlled, lean meals that support fat loss while preserving muscle.',
  'carb-control': 'Phase 2 - Carb Control: High protein, very low carbs, moderate healthy fats. Keto-adjacent approach to accelerate fat loss and reset insulin sensitivity.',
  'maintenance': 'Phase 3 - Maintenance: Balanced macros with clean whole foods. Sustainable eating for maintaining physique.',
  'sculpt': 'Phase 4 - Muscle Sculpt: High protein, higher carbs, moderate fats. Larger portions with clean carbs to support lean mass building.'
};

export function buildBeachBodyPrompt(request: GuardrailRequest): string {
  const phase = request.dietPhase || 'lean';
  const rules = getBeachBodyRules(phase);
  const isSnack = request.mealType === 'snack';
  
  const phaseDescription = PHASE_DESCRIPTIONS[phase];
  const blockedList = rules.blockedIngredients.slice(0, 15).join(', ');
  const preferredList = rules.preferredIngredients.slice(0, 12).join(', ');
  const cookingMethods = BEACHBODY_COOKING_METHODS.preferred.join(', ');

  if (isSnack) {
    return buildSnackPrompt(request, phase, rules);
  }

  return `
BEACHBODY PHYSIQUE MEAL - ${phase.toUpperCase()} PHASE

${phaseDescription}

STRICT REQUIREMENTS:
1. This meal MUST support body recomposition goals
2. Prioritize lean proteins and clean ingredients
3. Use these cooking methods: ${cookingMethods}
4. Keep portions appropriate for physique goals

DO NOT USE: ${blockedList}
PREFER: ${preferredList}

${getMacroGuidance(phase)}

USER REQUEST: "${request.userInput}"
MEAL TYPE: ${request.mealType}

Generate a physique-optimized ${request.mealType} that follows ${phase} phase rules.
Include precise macros (protein, carbs, fat, calories) and portion sizes.
`.trim();
}

function buildSnackPrompt(request: GuardrailRequest, phase: BeachBodyPhase, rules: any): string {
  const lowCarbPhases = ['lean', 'carb-control'];
  const isLowCarb = lowCarbPhases.includes(phase);

  return `
BEACHBODY SNACK - ${phase.toUpperCase()} PHASE

Create a physique-friendly snack that supports body recomposition.

${isLowCarb ? 'PHASE FOCUS: Keep carbs minimal, prioritize protein.' : 'PHASE FOCUS: Balanced macros with clean ingredients.'}

ALLOWED SNACKS: Greek yogurt, cottage cheese, protein shake, hard boiled eggs, berries, almonds, rice cakes (phase 3-4 only), beef jerky, turkey slices, vegetables

DO NOT INCLUDE: Cookies, candy, chips, crackers, granola bars, pastries, ice cream, fried snacks, creamy treats

USER CRAVING: "${request.userInput}"

Transform this into a BeachBody-approved snack.
Keep portions controlled and include exact macros.
`.trim();
}

function getMacroGuidance(phase: BeachBodyPhase): string {
  switch (phase) {
    case 'lean':
      return `
MACRO TARGETS (Phase 1):
- Protein: HIGH (35-45% of calories)
- Carbs: MODERATE (30-40% of calories)
- Fat: LOW (15-25% of calories)
- Focus on calorie density - maximize volume with minimal calories`;
    
    case 'carb-control':
      return `
MACRO TARGETS (Phase 2):
- Protein: HIGH (40-50% of calories)
- Carbs: VERY LOW (under 20% of calories, <30g per meal)
- Fat: MODERATE (30-40% of calories)
- Use healthy fats for satiety`;
    
    case 'maintenance':
      return `
MACRO TARGETS (Phase 3):
- Protein: BALANCED (30-35% of calories)
- Carbs: BALANCED (40-45% of calories)
- Fat: BALANCED (25-30% of calories)
- Focus on whole foods and sustainability`;
    
    case 'sculpt':
      return `
MACRO TARGETS (Phase 4):
- Protein: HIGH (30-40% of calories)
- Carbs: HIGHER (45-50% of calories)
- Fat: MODERATE (20-25% of calories)
- Slightly larger portions to support muscle growth`;
  }
}
