/**
 * Anti-Inflammatory Prompt Builder
 * 
 * Generates diet-specific prompt guidance for AI meal generation.
 * Injects anti-inflammatory requirements into the AI prompt.
 */

import { antiInflammatoryRules } from '../rules/antiInflammatoryRules';

/**
 * Build anti-inflammatory prompt additions for meal generation
 */
export function buildAntiInflammatoryPrompt(basePrompt: string): string {
  const guidance = antiInflammatoryRules.promptGuidance;
  
  return `${guidance}

${basePrompt}

CRITICAL RESTRICTIONS:
- Do NOT include any of these blocked ingredients: ${antiInflammatoryRules.blockedIngredients.slice(0, 20).join(', ')}
- PREFER these anti-inflammatory ingredients: ${antiInflammatoryRules.preferredIngredients.slice(0, 15).join(', ')}
- All cooking oils MUST be olive oil or avocado oil
- No red meat, no processed meats, no fried foods
- No refined sugars or white flour products`;
}

/**
 * Build anti-inflammatory prompt for snack generation
 */
export function buildAntiInflammatorySnackPrompt(basePrompt: string): string {
  return `${antiInflammatoryRules.promptGuidance}

${basePrompt}

SNACK-SPECIFIC ANTI-INFLAMMATORY RULES:
- Focus on berries, nuts, seeds, and vegetables
- Use olive oil or avocado as fat sources
- No processed snacks, chips, or crackers
- No refined sugars - use natural sweetness from fruits
- No red meat or processed meats
- Greek yogurt is acceptable if dairy is needed
- Prefer raw or lightly prepared options`;
}

/**
 * Get the core anti-inflammatory system prompt
 */
export function getAntiInflammatorySystemPrompt(): string {
  return `You are a nutrition expert specializing in anti-inflammatory diets.
Your role is to create delicious, satisfying meals that reduce inflammation.

KEY PRINCIPLES:
1. Omega-3 rich foods (fatty fish, walnuts, flax)
2. Colorful antioxidant-rich vegetables
3. Anti-inflammatory spices (turmeric, ginger, garlic)
4. Healthy fats (olive oil, avocado)
5. Whole grains over refined
6. No processed foods, seed oils, or red meat

Every meal you create must be:
- Delicious and satisfying
- Inflammation-reducing
- Free of seed oils and processed ingredients
- Rich in anti-inflammatory compounds`;
}
