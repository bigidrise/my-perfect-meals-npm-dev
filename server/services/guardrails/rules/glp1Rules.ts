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
 *
 * ── GOVERNANCE ────────────────────────────────────────────────────────────────
 * All ingredient lists and portion guidelines are governed by the Clinical Rule
 * Registry at server/services/glp1/ruleRegistry.ts.
 *
 * portionGuidelines.maxCalories (400): Static fallback baseline used ONLY when
 *   the user has no macro target. NOT a universal clinical ceiling. Supported
 *   directionally by PMID_36614945 (smaller meals). Specific value is an
 *   engineering default pending RD review. Rule: glp1_smaller_portions.
 *
 * portionGuidelines.maxFatGrams (12): Conservative default ceiling when no
 *   provider guardrail exists. Lower fat is supported by PMID_36614945; the
 *   specific 12g value has no peer-reviewed source — it is a conservative
 *   engineering default. Provider-configured guardrails override this.
 *   Rule: glp1_lower_fat (approved — directional). Specific value: pending_review.
 *
 * portionGuidelines.minProteinGrams (15): Protein priority is supported by
 *   PMID_36614945 and AND_GLP1_NUTRITION. The 15g floor is a conservative
 *   engineering default when no macro target exists. Rule: glp1_protein_priority.
 *
 * Remaining ingredient blocks (raw cruciferous, legumes, carbonation, fried foods):
 * Each category is governed by an
 * approved rule in the registry. See ruleRegistry.ts for per-category sources.
 * Dessert names and common baking fats/sweeteners are composition-sensitive
 * guidance, not universal exclusions. Their per-serving nutrition must still
 * pass the resolved allowance and every independent safety restriction.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface GLP1Rules {
  blockedIngredients: string[];
  compositionSensitiveIngredients: string[];
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
    // Other existing ingredient safeguards are unchanged by the dessert review.
    'brie', 'camembert',
    'mayonnaise', 'mayo', 'aioli',
    
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
    
    // Concentrated sugars and processed fruit — whole fresh fruit is allowed in portions
    'dried fruit', 'raisins', 'dates', 'figs', 'dried mango', 'dried banana chips',
    'fruit juice', 'orange juice', 'apple juice', 'grape juice', 'mango juice',
    'fruit punch', 'fruit syrup', 'fruit leather',
    
    // Carbonation
    'soda', 'pop', 'cola', 'sprite', 'sparkling water',
    'carbonated', 'fizzy', 'seltzer', 'tonic water',
    
    // Greasy/heavy sauces
    'alfredo', 'alfredo sauce', 'hollandaise',
    'bearnaise', 'ranch dressing', 'caesar dressing',
    'blue cheese dressing', 'thousand island',
    
    // Existing beverage safeguards
    'thick smoothie', 'protein shake gallon',
  ],

  // Presence alone does not establish incompatibility. Evaluate actual fat,
  // sugar contribution, portions, and tolerability without changing dish identity.
  compositionSensitiveIngredients: [
    'butter', 'cream', 'cream cheese', 'mascarpone', 'lard', 'shortening', 'margarine',
    'sugar', 'icing', 'frosting', 'honey', 'maple syrup', 'agave', 'molasses',
    'corn syrup', 'high fructose corn syrup',
    'cake', 'cookie', 'brownie', 'pie', 'pastry', 'donut', 'doughnut',
    'muffin', 'croissant', 'ice cream', 'gelato', 'frozen yogurt',
    'candy', 'chocolate bar', 'caramel', 'pancake', 'waffle', 'french toast',
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
    'large portion meals',
    'carbonated beverages',
    'greasy foods',
    'ultra-processed foods',
    'concentrated fruit products',
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
  return `CRITICAL METABOLIC MEDICATION DIETARY REQUIREMENTS:
The user is on a metabolic medication (such as Ozempic, Wegovy, Mounjaro, Zepbound, Rybelsus, or a similar GLP-1, dual-agonist, or triple-agonist drug).
All meals MUST follow these strict guidelines:

PORTION SIZE: Small portions ONLY. Never large, heavy, or high-volume meals.
TEXTURE: Soft, gentle, easy-to-digest textures. Well-cooked vegetables.
PROTEIN: Prioritize lean protein and use the resolved occasion-specific targets supplied below.
FAT: Moderate total fat per serving within the supplied allowance; adapt rich ingredients rather than banning an ingredient name.
DIGESTION: Focus on easy-to-digest foods. Avoid raw cruciferous vegetables.

REQUESTED FOOD IDENTITY:
- Desserts and pastries, including Napoleon/mille-feuille, are eligible for a recognizable smaller-portion or lower-fat adaptation.
- Evaluate actual ingredient quantities, per-serving fat, added sugar, protein, and individual symptom/tolerability context.
- Butter, cream, sugar, pastry, cake, and descriptions such as creamy or crispy are not universal prohibitions.
- Moderate added sugar; do not invent a universal sugar threshold or substitute an unrelated protein bowl.
- Applicable allergies, dietary exclusions, verified clinician directives, and independently configured hard limits remain mandatory.
- Do not guarantee acceptance when the final recipe fails its real requirements.

ABSOLUTELY FORBIDDEN:
- Fried foods of any kind
- Heavy cream sauces (alfredo, hollandaise)
- High-fat meats (bacon, sausage, ribeye)
- Large portions or high-volume meals
- Carbonated beverages
- Dried fruit, fruit juice, and concentrated fruit products (high sugar density)
- Raw cruciferous vegetables (raw broccoli, raw cabbage)
- Large amounts of beans or lentils

WHOLE FRUIT GUIDANCE:
- Fresh whole fruit is acceptable in appropriate portions (not forbidden)
- Prefer lower-sugar options: berries, melon, citrus segments
- Moderate portions of banana, mango, grapes, or pineapple are acceptable if within macro targets
- Avoid large servings of high-sugar fruit (prioritize portion awareness, not blanket prohibition)

PRIORITIZE:
- Lean proteins: chicken breast, fish, egg whites, Greek yogurt
- Soft textures: scrambles, wraps, soups, well-cooked vegetables
- Hydrating ingredients: broths, water-rich vegetables
- Simple seasonings: herbs, lemon, ginger
- Small, light portions that won't cause nausea

Generate small, light, high-protein, low-fat meals that are gentle on the stomach.`;
}
