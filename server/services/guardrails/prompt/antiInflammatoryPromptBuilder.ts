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
- RED MEAT DEFAULT RULE: When beef, steak, lamb, or pork is included and the user has not named a specific cut, always default to a lean cut — rotate through: sirloin, tenderloin, eye of round, flank steak, or filet mignon (vary the cut, do not always pick the same one). Default portion is 4–6 oz.
- If the user explicitly names a cut (e.g., "ribeye", "T-bone"), use that cut — do not substitute it. Naming a cut only overrides the cut choice, NOT the portion. Portion still defaults to 4–6 oz regardless of the cut, unless the user also specifies a different amount (e.g., "12 oz ribeye"). Optimize preparation method (grilled or broiled preferred) and pair with anti-inflammatory sides.
- If any requested ingredient conflicts with this protocol, include it — but optimize preparation method, portion, and pairing to reduce inflammatory impact where possible.
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
7. Red meat: limit by default. When no cut is specified, default to lean cuts (sirloin, tenderloin, eye of round, filet mignon) at 4–6 oz. If the user explicitly names a cut or requests a specific item, honor it exactly — optimize preparation and sides, but never substitute or block the request.

Every meal you create must be:
- Delicious and satisfying
- Inflammation-reducing where possible
- Free of seed oils and processed ingredients
- Rich in anti-inflammatory compounds
- Respectful of what the user actually asked for`;
}
