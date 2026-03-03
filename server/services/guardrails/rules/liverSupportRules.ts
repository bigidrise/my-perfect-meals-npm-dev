import type { GuardrailRules } from '../types';
import { getGuardrails } from '../../../../shared/clinical/guardrails';

const sharedRules = getGuardrails('liver-support');

export const liverSupportRules: GuardrailRules = {
  dietType: 'liver-support',

  blockedIngredients: [
    ...sharedRules.hardBlock,
    ...sharedRules.softDiscourage,
  ],

  preferredIngredients: [
    ...sharedRules.prioritize,
    'turmeric',
    'ginger',
    'garlic',
    'berries',
    'blueberries',
    'strawberries',
    'green tea',
    'chicken breast',
    'turkey breast',
    'eggs',
    'sweet potatoes',
    'beets',
    'artichoke',
    'dandelion greens',
  ],

  promptGuidance: `
LIVER SUPPORT DIET REQUIREMENTS:
- NEVER include alcohol (beer, wine, liquor, cocktails)
- NEVER include deep fried foods
- Avoid high added sugar (candy, donuts, pastries, soda, energy drinks)
- Avoid ultra-processed and fast food
- Limit processed meats (bacon, sausage, hot dogs, deli meat)
- Limit heavy butter/cream-based dishes
- Limit high sodium foods (jerky, heavily salted items, ramen)
- Use olive oil or avocado oil as primary cooking fat
- Focus on omega-3 rich proteins (salmon, sardines, tuna)
- Include cruciferous vegetables (broccoli, cauliflower, brussels sprouts)
- Include leafy greens (spinach, kale, arugula)
- Use whole grains (oats, quinoa, brown rice) over refined
- Include legumes (beans, lentils)
- Healthy fats from olive oil, avocado, walnuts, chia, flax
`,
};

export function isBlockedIngredientLiverSupport(ingredient: string): boolean {
  const normalized = ingredient.toLowerCase().trim();
  return liverSupportRules.blockedIngredients.some(blocked =>
    normalized.includes(blocked.toLowerCase()) ||
    blocked.toLowerCase().includes(normalized)
  );
}

export function isPreferredIngredientLiverSupport(ingredient: string): boolean {
  const normalized = ingredient.toLowerCase().trim();
  return liverSupportRules.preferredIngredients.some(preferred =>
    normalized.includes(preferred.toLowerCase()) ||
    preferred.toLowerCase().includes(normalized)
  );
}
