/**
 * GLP-1 Guardrails Rules - Phase 3.3
 * 
 * Enforces small portions, low-fat, high-protein, easy-to-digest meals
 * for users on GLP-1 medications (Ozempic, Wegovy, Mounjaro, etc.)
 * 
 * Key principles:
 * - Small portions (never large or heavy)
 * - Low calorie density
 * - Low fat
 * - High protein
 * - Gentle textures
 * - Easy digestion
 * - No nausea triggers
 */

export interface GLP1Rules {
  blockedIngredients: string[];
  preferredIngredients: string[];
  blockedCategories: string[];
  preferredCategories: string[];
  cookingMethods: {
    allowed: string[];
    forbidden: string[];
  };
  portionGuidelines: {
    maxCalories: number;
    maxFatGrams: number;
    minProteinGrams: number;
    preferSmallPortions: boolean;
  };
  textureGuidelines: string[];
}

export const glp1Rules: GLP1Rules = {
  blockedIngredients: [
    // Heavy fats
    'butter', 'cream', 'heavy cream', 'whipping cream', 'sour cream',
    'cream cheese', 'mascarpone', 'brie', 'camembert',
    'mayonnaise', 'mayo', 'aioli',
    'lard', 'shortening', 'margarine',
    
    // Fried foods
    'fried chicken', 'fried fish', 'french fries', 'fries',
    'fried rice', 'fried eggs', 'deep fried', 'breaded',
    'tempura', 'fritters', 'onion rings',
    
    // High-fat meats
    'ribeye', 'prime rib', 't-bone', 'porterhouse',
    'pork belly', 'bacon', 'sausage', 'bratwurst',
    'chorizo', 'kielbasa', 'hot dog', 'frankfurter',
    'salami', 'pepperoni', 'prosciutto', 'pancetta',
    'lamb chop', 'lamb shoulder', 'duck', 'goose',
    '80/20 beef', '70/30 beef', 'ground chuck',
    
    // Full-fat cheeses (except cottage cheese)
    'cheddar', 'mozzarella', 'parmesan', 'swiss',
    'gouda', 'provolone', 'blue cheese', 'feta',
    'american cheese', 'velveeta', 'cheese sauce',
    
    // High-volume/hard-to-digest
    'raw broccoli', 'raw cauliflower', 'raw cabbage',
    'raw brussels sprouts', 'raw kale',
    'dried beans', 'kidney beans', 'black beans', 'pinto beans',
    'chickpeas', 'lentils', 'split peas',
    
    // Ultra-sweet foods
    'honey', 'maple syrup', 'agave', 'molasses',
    'corn syrup', 'high fructose corn syrup',
    'cake', 'cookies', 'brownies', 'pie', 'pastry',
    'donut', 'doughnut', 'muffin', 'croissant',
    'ice cream', 'gelato', 'frozen yogurt',
    'candy', 'chocolate bar', 'caramel',
    'pancakes', 'waffles', 'french toast',
    
    // High-sugar fruits (berries allowed)
    'mango', 'banana', 'grapes', 'pineapple',
    'dried fruit', 'raisins', 'dates', 'figs',
    'fruit juice', 'orange juice', 'apple juice',
    
    // Carbonation
    'soda', 'pop', 'cola', 'sprite', 'sparkling water',
    'carbonated', 'fizzy', 'seltzer', 'tonic water',
    
    // Greasy/heavy sauces
    'alfredo', 'alfredo sauce', 'hollandaise',
    'bearnaise', 'ranch dressing', 'caesar dressing',
    'blue cheese dressing', 'thousand island',
    
    // Large portion indicators
    'giant', 'loaded', 'stuffed', 'double', 'triple',
    'super-sized', 'family size', 'jumbo', 'mega',
    'thick smoothie', 'protein shake gallon',
  ],

  preferredIngredients: [
    // Lean proteins
    'chicken breast', 'turkey breast', 'lean turkey',
    'tilapia', 'cod', 'flounder', 'sole', 'halibut',
    'shrimp', 'scallops', 'crab', 'lobster',
    'egg whites', 'eggs', 'hard boiled egg',
    'greek yogurt', 'plain greek yogurt', 'nonfat greek yogurt',
    'cottage cheese', 'low-fat cottage cheese',
    
    // Soft-texture carbs
    'oatmeal', 'rolled oats', 'cream of wheat',
    'white rice', 'jasmine rice', 'rice porridge',
    'mashed potato', 'sweet potato mash',
    'soft tortilla', 'wrap',
    
    // Cooked vegetables
    'steamed broccoli', 'steamed carrots', 'steamed zucchini',
    'sautéed spinach', 'cooked spinach', 'wilted greens',
    'roasted vegetables', 'soft vegetables',
    'cucumber', 'tomato', 'bell pepper',
    
    // Low-sugar fruits
    'berries', 'strawberries', 'blueberries', 'raspberries',
    'blackberries', 'watermelon', 'cantaloupe', 'honeydew',
    
    // Hydrating ingredients
    'broth', 'chicken broth', 'bone broth', 'vegetable broth',
    'soup', 'clear soup', 'miso soup',
    'cucumber water', 'herbal tea',
    
    // Light seasonings
    'lemon juice', 'lime juice', 'herbs', 'spices',
    'garlic', 'ginger', 'fresh herbs', 'basil', 'cilantro',
    'low-sodium soy sauce', 'rice vinegar',
  ],

  blockedCategories: [
    'fried foods',
    'heavy cream sauces',
    'high-fat desserts',
    'large portion meals',
    'carbonated beverages',
    'greasy foods',
    'ultra-processed foods',
    'high-sugar foods',
    'tough meats',
  ],

  preferredCategories: [
    'lean proteins',
    'soft-texture meals',
    'hydrating foods',
    'small portions',
    'easy digestion',
    'light meals',
    'gentle on stomach',
  ],

  cookingMethods: {
    allowed: [
      'bake', 'baked',
      'steam', 'steamed',
      'poach', 'poached',
      'grill', 'grilled',
      'sauté', 'sautéed', 'saute', 'sauteed',
      'roast', 'roasted',
      'boil', 'boiled',
      'simmer', 'simmered',
      'braise', 'braised',
      'broil', 'broiled',
    ],
    forbidden: [
      'deep fry', 'deep-fry', 'deep fried', 'deep-fried',
      'pan fry', 'pan-fry', 'pan fried', 'pan-fried',
      'fry', 'fried', 'frying',
      'batter', 'battered',
      'bread', 'breaded', 'breading',
    ],
  },

  portionGuidelines: {
    maxCalories: 400,
    maxFatGrams: 12,
    minProteinGrams: 15,
    preferSmallPortions: true,
  },

  textureGuidelines: [
    'soft',
    'tender',
    'smooth',
    'light',
    'gentle',
    'easy to chew',
    'well-cooked',
  ],
};

export function getGLP1SystemPrompt(): string {
  return `CRITICAL GLP-1 MEDICATION DIETARY REQUIREMENTS:
The user is on GLP-1 medication (such as Ozempic, Wegovy, or Mounjaro).
All meals MUST follow these strict guidelines:

PORTION SIZE: Small portions ONLY. Never large, heavy, or high-volume meals.
TEXTURE: Soft, gentle, easy-to-digest textures. Well-cooked vegetables.
PROTEIN: High protein content (minimum 15g per meal) from lean sources.
FAT: Very low fat (maximum 12g per meal). No heavy creams, oils, or fatty meats.
DIGESTION: Focus on easy-to-digest foods. Avoid raw cruciferous vegetables.

ABSOLUTELY FORBIDDEN:
- Fried foods of any kind
- Heavy cream sauces (alfredo, hollandaise)
- High-fat meats (bacon, sausage, ribeye)
- Large portions or high-volume meals
- Carbonated beverages
- High-sugar foods and syrups
- Raw cruciferous vegetables (raw broccoli, raw cabbage)
- Large amounts of beans or lentils

PRIORITIZE:
- Lean proteins: chicken breast, fish, egg whites, Greek yogurt
- Soft textures: scrambles, wraps, soups, well-cooked vegetables
- Hydrating ingredients: broths, water-rich vegetables
- Simple seasonings: herbs, lemon, ginger
- Small, light portions that won't cause nausea

Generate small, light, high-protein, low-fat meals that are gentle on the stomach.`;
}
