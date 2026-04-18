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
- RED MEAT OVERRIDE RULE (applies whenever the user requests beef, steak, lamb, or pork):
  You MUST use a lean cut: sirloin, tenderloin, eye of round, or filet mignon.
  Do NOT use ribeye, T-bone, porterhouse, brisket, or any high-fat cut — these are too inflammatory for this protocol regardless of what was requested.
  EXCEPTION: If the user explicitly names a specific cut (e.g., "make me a ribeye"), honor that cut but still enforce 6–8 oz and use anti-inflammatory preparation (grilled or broiled, not fried) with anti-inflammatory sides.
  Portion MUST be between 6–8 oz. Default to 6 oz unless the user explicitly requests more.
- If any requested ingredient conflicts with this protocol, include it — but optimize the preparation method, portion size, and pairing to minimize inflammatory impact.
- NEVER use processed meats: bacon, sausage, hot dogs, salami, pepperoni
- No fried foods, no refined sugars, no white flour products`;
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
6. No processed foods or seed oils
7. Red meat: limit by default. If requested, you MUST use lean cuts only (sirloin, tenderloin, eye of round, filet mignon). NEVER use ribeye, T-bone, porterhouse, or brisket — too inflammatory. Portion MUST be 6–8 oz, default 6 oz. If user explicitly names a cut, honor it but still enforce portion and anti-inflammatory preparation.

Every meal you create must be:
- Delicious and satisfying
- Inflammation-reducing where possible
- Free of seed oils and processed ingredients
- Rich in anti-inflammatory compounds
- Respectful of what the user actually asked for`;
}
