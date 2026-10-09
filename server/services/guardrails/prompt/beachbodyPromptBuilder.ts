/**
 * BeachBody Prompt Builder
 *
 * Builds phase-aware prompts for BeachBody meal generation.
 * Each phase has different macro priorities and ingredient guidance.
 *
 * When remainingMacros is provided:
 * Remaining ordinary macros are personalization guidance, never hard ceilings.
 * Independent phase, starch, and clinical requirements are preserved.
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
 * Builds tracking guidance without converting daily goals into hard limits.
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
  if (rm.calories !== undefined && rm.calories > 0) lines.push(`- Calories remaining today: ${Math.round(rm.calories)} kcal`);
  if (rm.protein !== undefined && rm.protein > 0) lines.push(`- Protein remaining today: ${Math.round(rm.protein)}g`);
  if (rm.carbs !== undefined && rm.carbs > 0) lines.push(`- Carbs remaining today: ${Math.round(rm.carbs)}g`);
  if (rm.fat !== undefined && rm.fat > 0) lines.push(`- Fat remaining today: ${Math.round(rm.fat)}g`);

  if (lines.length === 0) return '';

  // Protein supports personalization without capping ordinary calories or fat.
  const proteinTarget = rm.protein !== undefined ? rm.protein : null;
  const proteinAimLow = proteinTarget !== null ? Math.round(proteinTarget * 0.85) : null;
  const proteinAimHigh = proteinTarget !== null ? Math.round(proteinTarget) : null;
  const proteinExample = proteinTarget !== null
    ? `Aim for ${proteinAimLow}–${proteinAimHigh}g protein, not ${Math.round(proteinTarget * 0.5)}g.`
    : '';

  return `
REMAINING ORDINARY MACRO GOALS (guidance only):
${lines.join('\n')}
Use these goals to personalize a realistic meal, not as rejection ceilings.
${proteinExample}
Do not refuse, shrink, or replace a requested meal solely for ordinary macro overages.
Report honest nutrition. Strict starchy-carbohydrate allowances and independent
clinical or explicitly requested restrictions still apply.
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
