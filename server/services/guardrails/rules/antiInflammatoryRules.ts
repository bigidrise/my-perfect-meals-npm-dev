/**
 * Anti-Inflammatory Guardrail Rules
 * 
 * Defines blocked and preferred ingredients for anti-inflammatory diet.
 * Used by the guardrail engine to filter AI meal generation.
 */

import type { GuardrailRules } from '../types';

export const antiInflammatoryRules: GuardrailRules = {
  dietType: 'anti-inflammatory',
  
  blockedIngredients: [
    // Seed oils and inflammatory fats
    'canola oil',
    'soybean oil',
    'corn oil',
    'vegetable oil',
    'vegetable blend oil',
    'margarine',
    'shortening',
    'hydrogenated oil',
    'partially hydrogenated oil',
    
    // Inflammatory dairy
    'heavy cream',
    'cream cheese',
    'processed cheese',
    'american cheese',
    'cheese whiz',
    'velveeta',
    
    // Red meat
    'beef',
    'steak',
    'ground beef',
    'ribeye',
    'sirloin',
    'brisket',
    'lamb',
    'lamb chops',
    'pork',
    'pork chops',
    'pork belly',
    'bacon',
    'ham',
    'sausage',
    'hot dog',
    'bratwurst',
    'salami',
    'pepperoni',
    'bologna',
    'prosciutto',
    'pancetta',
    
    // Refined sugars
    'white sugar',
    'granulated sugar',
    'brown sugar',
    'corn syrup',
    'high fructose corn syrup',
    'agave nectar',
    'candy',
    'gummy',
    
    // Refined flour products
    'white flour',
    'all-purpose flour',
    'white bread',
    'white pasta',
    'white rice',
    
    // Fried and processed foods
    'french fries',
    'fried chicken',
    'fried fish',
    'onion rings',
    'chips',
    'potato chips',
    'doritos',
    'cheetos',
    'crackers',
    
    // Processed snacks
    'cookies',
    'cake',
    'pastry',
    'donut',
    'muffin',
    'croissant'
  ],
  
  preferredIngredients: [
    // Anti-inflammatory proteins
    'salmon',
    'wild salmon',
    'tuna',
    'sardines',
    'mackerel',
    'anchovies',
    'chicken breast',
    'turkey breast',
    'turkey',
    'eggs',
    
    // Healthy fats
    'olive oil',
    'extra virgin olive oil',
    'avocado oil',
    'avocado',
    'almonds',
    'walnuts',
    'cashews',
    'chia seeds',
    'flax seeds',
    'hemp seeds',
    
    // Berries and fruits
    'blueberries',
    'strawberries',
    'raspberries',
    'blackberries',
    'cherries',
    'oranges',
    'grapefruit',
    'kiwi',
    'pomegranate',
    
    // Leafy greens and vegetables
    'spinach',
    'kale',
    'arugula',
    'swiss chard',
    'collard greens',
    'broccoli',
    'cauliflower',
    'brussels sprouts',
    'cabbage',
    'bok choy',
    'bell peppers',
    'tomatoes',
    'carrots',
    'beets',
    'sweet potatoes',
    
    // Anti-inflammatory spices
    'turmeric',
    'ginger',
    'garlic',
    'cinnamon',
    'basil',
    'oregano',
    'rosemary',
    'thyme',
    'black pepper',
    
    // Whole grains
    'quinoa',
    'brown rice',
    'farro',
    'oats',
    'steel cut oats',
    'buckwheat',
    
    // Legumes
    'lentils',
    'chickpeas',
    'black beans',
    'kidney beans'
  ],
  
  promptGuidance: `
ANTI-INFLAMMATORY DIET REQUIREMENTS:
- Use ONLY anti-inflammatory cooking oils (olive oil, avocado oil)
- NEVER use seed oils (canola, soybean, corn, vegetable oil)
- Focus on fatty fish (salmon, tuna, sardines) as primary protein
- Use chicken or turkey as alternative protein (no red meat)
- Include colorful vegetables and berries
- Use anti-inflammatory spices (turmeric, ginger, garlic)
- Choose whole grains over refined (quinoa, brown rice, oats)
- Avoid all processed foods, fried foods, and refined sugars
- Limit dairy; if using, choose fermented options (Greek yogurt)
`
};

/**
 * Check if an ingredient is blocked for anti-inflammatory diet
 */
export function isBlockedIngredient(ingredient: string): boolean {
  const normalized = ingredient.toLowerCase().trim();
  return antiInflammatoryRules.blockedIngredients.some(blocked => 
    normalized.includes(blocked.toLowerCase()) || 
    blocked.toLowerCase().includes(normalized)
  );
}

/**
 * Check if an ingredient is preferred for anti-inflammatory diet
 */
export function isPreferredIngredient(ingredient: string): boolean {
  const normalized = ingredient.toLowerCase().trim();
  return antiInflammatoryRules.preferredIngredients.some(preferred => 
    normalized.includes(preferred.toLowerCase()) || 
    preferred.toLowerCase().includes(normalized)
  );
}

/**
 * Filter a list of ingredients, removing blocked ones
 */
export function filterBlockedIngredients(ingredients: string[]): {
  allowed: string[];
  blocked: string[];
} {
  const allowed: string[] = [];
  const blocked: string[] = [];
  
  for (const ingredient of ingredients) {
    if (isBlockedIngredient(ingredient)) {
      blocked.push(ingredient);
    } else {
      allowed.push(ingredient);
    }
  }
  
  return { allowed, blocked };
}
