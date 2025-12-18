/**
 * General Nutrition Prompt Builder
 * 
 * Builds prompts for balanced, everyday healthy meal generation.
 * Not clinical, but sensible and clean.
 */

import type { GuardrailRequest } from '../types';
import { generalNutritionRules, GENERAL_NUTRITION_SNACK_RULES } from '../rules/generalNutritionRules';

export function buildGeneralNutritionPrompt(request: GuardrailRequest): string {
  const isSnack = request.mealType === 'snack';
  
  if (isSnack) {
    return buildSnackPrompt(request);
  }
  
  const blockedList = generalNutritionRules.blockedIngredients.slice(0, 12).join(', ');
  const preferredList = generalNutritionRules.preferredIngredients.slice(0, 12).join(', ');

  return `
GENERAL NUTRITION MEAL - BALANCED HEALTHY EATING

Create a balanced, wholesome meal that a sensible nutrition coach would approve of.

REQUIREMENTS:
1. Include a lean protein source in every meal
2. Include vegetables or fiber-rich foods
3. Use whole-food carbs where appropriate
4. Keep portions realistic for everyday eating
5. Avoid ultra-processed and deep-fried foods

DO NOT USE: ${blockedList}
PREFER: ${preferredList}

MACRO BALANCE:
- Protein: Present in meaningful amount
- Carbs: Moderate, paired with fiber or protein
- Fats: Moderate, from healthy sources
- Fiber: Regular presence

If the user requests junk food, create a HEALTHIER VERSION that satisfies the craving but uses better ingredients and cooking methods.

USER REQUEST: "${request.userInput}"
MEAL TYPE: ${request.mealType}

Generate a balanced, healthy ${request.mealType} with precise macros and realistic portions.
`.trim();
}

function buildSnackPrompt(request: GuardrailRequest): string {
  return `
GENERAL NUTRITION SNACK - SMART SNACKING

Create a healthy, satisfying snack that provides real nutrition.

SNACK PRIORITIES:
- Include some protein or fiber for satiety
- Keep calories reasonable (100-250 calories)
- Use whole, minimally processed ingredients
- Avoid empty calories and pure sugar

GOOD SNACK OPTIONS: ${GENERAL_NUTRITION_SNACK_RULES.allowed.slice(0, 10).join(', ')}

DO NOT CREATE: ${GENERAL_NUTRITION_SNACK_RULES.blocked.slice(0, 8).join(', ')}

If the user craves junk food, transform it into a healthier version:
- Chips craving → baked veggie chips or rice cakes with hummus
- Candy craving → fruit with dark chocolate drizzle or frozen grapes
- Cookie craving → protein ball or greek yogurt with granola

USER CRAVING: "${request.userInput}"

Create a satisfying, healthy snack with exact macros.
`.trim();
}

export function getGeneralNutritionSystemPrompt(): string {
  return `You are creating meals for a General Nutrition builder. 
Every meal should be balanced, realistic, and health-focused. 
Prioritize lean proteins, vegetables, whole grains, and healthy fats. 
Avoid deep-fried foods, heavy cream-based dishes, and ultra-processed junk. 
If the user requests unhealthy food, create a healthier version that satisfies the craving.`;
}
