/**
 * BeachBody Prompt Builder
 * 
 * Builds phase-aware prompts for BeachBody meal generation.
 * Each phase has different macro priorities and ingredient guidance.
 * 
 * When remainingMacros is provided in the request, those values become
 * HARD ceilings in the AI prompt — the AI must generate within them,
 * not just aim for the daily targets.
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
  const blockedList = rules.blockedIngredients.slice(0, 20).join(', ');
  const preferredList = rules.preferredIngredients.slice(0, 12).join(', ');
  const cookingMethods = BEACHBODY_COOKING_METHODS.preferred.join(', ');

  if (isSnack) {
    return buildSnackPrompt(request, phase, rules);
  }

  const remainingMacroBlock = buildRemainingMacroBlock(request);

  return `
BEACHBODY PHYSIQUE MEAL - ${phase.toUpperCase()} PHASE

${phaseDescription}

STRICT REQUIREMENTS:
1. This meal MUST support body recomposition goals
2. Use ONLY lean proteins — chicken breast, turkey breast, egg whites, tilapia, cod, shrimp, lean ground turkey, lean ground chicken, sirloin, flank steak
3. DO NOT use dark meat chicken (thighs, drumsticks, wings), pork belly, pork shoulder, ribs, ground beef, duck, or lamb
4. Use these cooking methods ONLY: ${cookingMethods}
5. Keep portions appropriate for physique goals

DO NOT USE: ${blockedList}
PREFER: ${preferredList}

${getMacroGuidance(phase)}
${remainingMacroBlock}
USER REQUEST: "${request.userInput}"
MEAL TYPE: ${request.mealType}

Generate a physique-optimized ${request.mealType} that follows ${phase} phase rules.
Include precise macros (protein, carbs, fat, calories) and portion sizes.
`.trim();
}

/**
 * Builds the remaining macro constraint block.
 * When present, these are HARD ceilings — not suggestions.
 * The AI must fit the meal inside whatever macros are left today.
 */
function buildRemainingMacroBlock(request: GuardrailRequest): string {
  const rm = request.remainingMacros;
  if (!rm) return '';

  const hasAny = (
    (rm.protein !== undefined && rm.protein > 0) ||
    (rm.carbs !== undefined && rm.carbs > 0) ||
    (rm.fat !== undefined && rm.fat > 0) ||
    (rm.calories !== undefined && rm.calories > 0)
  );

  if (!hasAny) return '';

  const lines: string[] = [];
  if (rm.calories !== undefined && rm.calories > 0) lines.push(`- Calories remaining today: ${Math.round(rm.calories)} kcal MAX`);
  if (rm.protein !== undefined && rm.protein > 0) lines.push(`- Protein remaining today: ${Math.round(rm.protein)}g MAX`);
  if (rm.carbs !== undefined && rm.carbs > 0) lines.push(`- Carbs remaining today: ${Math.round(rm.carbs)}g MAX`);
  if (rm.fat !== undefined && rm.fat > 0) lines.push(`- Fat remaining today: ${Math.round(rm.fat)}g MAX`);

  if (lines.length === 0) return '';

  return `
REMAINING MACRO BUDGET (MANDATORY — this is what the user has left today):
${lines.join('\n')}
This meal MUST fit within the remaining budget above. Do NOT exceed any of these values.
Size portions accordingly. If a macro is very low (e.g. <10g carbs remaining), generate a nearly zero-carb meal.
`;
}

function buildSnackPrompt(request: GuardrailRequest, phase: BeachBodyPhase, rules: any): string {
  const lowCarbPhases = ['lean', 'carb-control'];
  const isLowCarb = lowCarbPhases.includes(phase);
  const remainingMacroBlock = buildRemainingMacroBlock(request);

  return `
BEACHBODY SNACK - ${phase.toUpperCase()} PHASE

Create a physique-friendly snack that supports body recomposition.

${isLowCarb ? 'PHASE FOCUS: Keep carbs minimal, prioritize protein.' : 'PHASE FOCUS: Balanced macros with clean ingredients.'}

ALLOWED SNACKS: Greek yogurt, cottage cheese, protein shake, hard boiled eggs, berries, almonds, rice cakes (phase 3-4 only), beef jerky, turkey slices, vegetables

DO NOT INCLUDE: Cookies, candy, chips, crackers, granola bars, pastries, ice cream, fried snacks, creamy treats
${remainingMacroBlock}
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
- Protein: HIGH — minimum 30g per meal (non-negotiable)
- Carbs: MODERATE (30-40% of calories)
- Fat: LOW — must stay under 25% of meal calories, saturated fat under 8g
- Focus on calorie density - maximize volume with minimal calories`;
    
    case 'carb-control':
      return `
MACRO TARGETS (Phase 2):
- Protein: HIGH — minimum 30g per meal (non-negotiable)
- Carbs: VERY LOW — hard ceiling of 30g per meal. NO starchy carbs.
- Fat: MODERATE (30-40% of calories) — use healthy fats for satiety`;
    
    case 'maintenance':
      return `
MACRO TARGETS (Phase 3):
- Protein: BALANCED (30-35% of calories) — aim for at least 25g per meal
- Carbs: BALANCED (40-45% of calories)
- Fat: BALANCED (25-30% of calories)
- Focus on whole foods and sustainability`;
    
    case 'sculpt':
      return `
MACRO TARGETS (Phase 4):
- Protein: HIGH — minimum 35g per meal (non-negotiable)
- Carbs: HIGHER (45-50% of calories) — clean carbs to fuel training
- Fat: MODERATE (20-25% of calories)
- Slightly larger portions to support lean mass building`;
  }
}
