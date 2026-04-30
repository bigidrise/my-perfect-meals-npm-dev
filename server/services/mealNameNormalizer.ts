/**
 * mealNameNormalizer.ts
 *
 * Global dish name normalization — runs BEFORE image generation on every path.
 * Rule: If a name sounds like raw ingredients, convert it to a proper dish name.
 * This must be called before cache key derivation AND before prompt construction.
 */

// Keywords that confirm a name is already a recognizable dish
const DISH_KEYWORDS = [
  // Proteins / proteins with cooking method
  'chicken', 'beef', 'salmon', 'tuna', 'shrimp', 'prawn', 'pork', 'lamb',
  'turkey', 'steak', 'fillet', 'loin', 'chop', 'thigh', 'breast', 'ribs',
  'tofu', 'tempeh', 'lentil', 'bean',
  // Dish types
  'soup', 'stew', 'chili', 'curry', 'bisque', 'broth', 'chowder',
  'salad', 'slaw',
  'pasta', 'noodle', 'spaghetti', 'linguine', 'penne', 'fettuccine', 'ramen', 'udon',
  'rice', 'risotto', 'pilaf', 'fried rice',
  'bowl', 'plate',
  'sandwich', 'sub', 'hoagie', 'panini', 'wrap', 'taco', 'burrito', 'quesadilla',
  'burger', 'slider',
  'pizza', 'flatbread',
  'omelet', 'omelette', 'scramble', 'frittata', 'quiche',
  'pancake', 'waffle', 'crepe',
  'smoothie', 'shake', 'juice',
  // Baked goods (existing names that are already complete)
  'cookie', 'cookies', 'brownie', 'brownies', 'blondie', 'blondies',
  'bar', 'bars', 'biscotti',
  'muffin', 'muffins', 'cupcake', 'cupcakes',
  'cake', 'cheesecake', 'bundt', 'torte',
  'bread', 'loaf', 'roll', 'biscuit', 'scone',
  'pie', 'tart', 'cobbler', 'crisp', 'crumble', 'galette',
  'pudding', 'mousse', 'soufflé', 'souffle', 'custard', 'flan',
  'ice cream', 'sorbet', 'gelato',
  // Cooking methods that imply a finished dish
  'grilled', 'roasted', 'baked', 'braised', 'seared', 'fried', 'poached',
  'sautéed', 'sauteed', 'steamed', 'smoked', 'stuffed', 'glazed',
  // Meal types as dish anchors
  'breakfast', 'brunch', 'lunch', 'dinner',
  'casserole', 'skillet', 'hash', 'stir-fry', 'stir fry',
  'enchilada', 'tamale', 'fajita', 'bibimbap', 'pho', 'pad thai',
  'hummus', 'dip', 'spread', 'guacamole',
];

// Baked goods ingredient signals — these indicate an ingredient-list name that needs a dish suffix
const BAKED_GOODS_INGREDIENT_SIGNALS = [
  'chocolate chip', 'choc chip',
  'almond flour', 'oat flour', 'coconut flour', 'cassava flour',
  'cocoa powder', 'cacao',
  'maple syrup', 'honey', 'agave',
  'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter',
  'protein powder', 'collagen',
];

// If a name contains these baked goods signals + no dish keyword → infer the dish type
function inferBakedGoodDish(lower: string): string | null {
  const hasBakedSignal = BAKED_GOODS_INGREDIENT_SIGNALS.some(sig => lower.includes(sig));
  if (!hasBakedSignal) return null;

  if (lower.includes('chocolate chip') || lower.includes('choc chip')) return 'Cookies';
  if (lower.includes('cocoa') || lower.includes('cacao')) return 'Brownies';
  if (lower.includes('peanut butter') || lower.includes('almond butter') || lower.includes('cashew butter') || lower.includes('sunflower butter')) return 'Energy Bars';
  if (lower.includes('protein powder') || lower.includes('collagen')) return 'Protein Bars';
  if (lower.includes('banana')) return 'Banana Bread';
  if (lower.includes('blueberry') || lower.includes('cranberry') || lower.includes('raspberry')) return 'Muffins';
  if (lower.includes('lemon') || lower.includes('lime')) return 'Bars';

  // Generic baked good
  return 'Baked Goods';
}

// Ingredient-pattern heuristic — returns true if name reads like a raw ingredient list
function looksLikeIngredientList(name: string): boolean {
  const lower = name.toLowerCase();

  // Raw ingredient words that on their own don't describe a dish
  const rawIngredientWords = [
    'flour', 'chips', 'oats', 'butter', 'sugar', 'eggs', 'milk', 'cream',
    'oil', 'powder', 'extract', 'syrup', 'seeds', 'nuts', 'flakes',
  ];

  const matchCount = rawIngredientWords.filter(w => lower.includes(w)).length;
  return matchCount >= 2;
}

/**
 * culturalNameTransform
 *
 * Post-generation name cleanup for cuisine-active meals.
 * The AI tends to package culturally authentic dishes inside generic modern format
 * labels ("Bowl", "Wrap") even when the ingredients and structure are correct.
 * This strips those labels and removes the "-Style" suffix from cuisine prefixes.
 *
 * Applied after AI generation, only when a cuisinePreference is set.
 *
 * @param name    - Raw AI-generated meal name
 * @param cuisine - The active cuisine preference (e.g. "Cambodian", "Ethiopian")
 * @returns Name with generic format labels and "-Style" suffix removed
 */
export function culturalNameTransform(name: string, cuisine?: string): string {
  if (!name || !name.trim() || !cuisine) return name;

  let result = name.trim();

  // "Cambodian-Style …" → "Cambodian …"
  // The "-Style" suffix signals the AI couldn't commit to authenticity
  result = result.replace(/-Style\b/gi, '');

  // Strip trailing generic format words that the AI uses as safe containers.
  // These are nearly never part of a genuine dish name in any cultural tradition.
  // Trailing position only (end of string, optional punctuation) — avoids
  // stripping "bowl" from legitimate dish names like "Bún bò Huế bowl soup".
  const genericSuffixes = [
    /\s+Bowl\s*$/i,
    /\s+Wrap\s*$/i,
  ];
  for (const pattern of genericSuffixes) {
    result = result.replace(pattern, '');
  }

  // Clean up any double spaces created by the removals
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result || name.trim();
}

/**
 * normalizeMealName
 *
 * Converts ingredient-sounding meal names into proper dish names before image generation.
 * Must be called at every image generation ingress point.
 *
 * @param name - Raw meal name from the AI generator
 * @returns Normalized dish name safe to pass to image generation
 */
export function normalizeMealName(name: string): string {
  if (!name || !name.trim()) return name;

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // If the name already contains a dish keyword, it's already a proper dish name
  for (const keyword of DISH_KEYWORDS) {
    if (lower.includes(keyword)) return trimmed;
  }

  // Check if it matches baked goods ingredient patterns
  const bakedGoodSuffix = inferBakedGoodDish(lower);
  if (bakedGoodSuffix) {
    // Avoid double-appending
    if (!lower.endsWith(bakedGoodSuffix.toLowerCase())) {
      return `${trimmed} ${bakedGoodSuffix}`;
    }
    return trimmed;
  }

  // Looks like a raw ingredient list with no dish keyword
  if (looksLikeIngredientList(lower)) {
    // We don't know the dish type — best we can do is signal "prepared dish"
    return `${trimmed} (Prepared Dish)`;
  }

  // Name is short and ambiguous — return as-is, let classification handle it
  return trimmed;
}
