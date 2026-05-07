// shared/staticSnackMappings.ts
// Centralized static snack image mappings (shared by server and client)
// NO DALL-E generation for snacks - all use static images ONLY

export const STATIC_SNACK_MAPPINGS: Record<string, string> = {
  // Existing template images (from /public/images/templates/)
  'air-popped popcorn': '/images/templates/air-popped-popcorn.jpg',
  'popcorn': '/images/templates/air-popped-popcorn.jpg',
  'apple slices': '/images/templates/apple-pb-slices.jpg',
  'apple pb': '/images/templates/apple-pb-slices.jpg',
  'apple slices with almond butter': '/images/templates/apple-pb-slices.jpg',
  'apple + pb slices': '/images/templates/apple-pb-slices.jpg',
  'hummus': '/images/templates/hummus-veg-sticks.jpg',
  'hummus + veg sticks': '/images/templates/hummus-veg-sticks.jpg',
  // NOTE: 'greek yogurt' key intentionally omitted from partial-match scope.
  // "Greek Yogurt Ranch Dip + Veg" is a specific template product — it must match
  // exactly only, never via substring (which would wrongly match "Greek Yogurt Parfait").
  'greek yogurt ranch dip': '/images/templates/yogurt-ranch-dip.jpg',
  'greek yogurt ranch dip + veg': '/images/templates/yogurt-ranch-dip.jpg',
  'energy balls': '/images/templates/energy-balls.jpg',
  'protein energy balls': '/images/templates/energy-balls.jpg',
  'zucchini fries': '/images/templates/zucchini-fries.jpg',
  'zucchini fries (air-fryer)': '/images/templates/zucchini-fries.jpg',

  // Common snacks (use generic fallback for now - user can replace with real images later)
  'almonds': '/images/snacks/default-snack.svg',
  'mixed nuts': '/images/snacks/default-snack.svg',
  'cashews': '/images/snacks/default-snack.svg',
  'walnuts': '/images/snacks/default-snack.svg',
  'peanuts': '/images/snacks/default-snack.svg',
  'pistachios': '/images/snacks/default-snack.svg',
  'protein shake': '/images/snacks/default-snack.svg',
  'protein bar': '/images/snacks/default-snack.svg',
  'rice cakes': '/images/snacks/default-snack.svg',
  'cheese stick': '/images/snacks/default-snack.svg',
  'string cheese': '/images/snacks/default-snack.svg',
  'hard boiled eggs': '/images/snacks/default-snack.svg',
  'cottage cheese': '/images/snacks/default-snack.svg',
  'yogurt': '/images/snacks/default-snack.svg',
  'banana': '/images/snacks/default-snack.svg',
  'berries': '/images/snacks/default-snack.svg',
  'strawberries': '/images/snacks/default-snack.svg',
  'blueberries': '/images/snacks/default-snack.svg',
  'raspberries': '/images/snacks/default-snack.svg',
  'orange': '/images/snacks/default-snack.svg',
  'grapes': '/images/snacks/default-snack.svg',
  'carrots': '/images/snacks/default-snack.svg',
  'celery': '/images/snacks/default-snack.svg',
  'bell pepper': '/images/snacks/default-snack.svg',
  'cucumber': '/images/snacks/default-snack.svg',
  'cherry tomatoes': '/images/snacks/default-snack.svg',
  'edamame': '/images/snacks/default-snack.svg',
  'beef jerky': '/images/snacks/default-snack.svg',
  'turkey jerky': '/images/snacks/default-snack.svg',
  'dark chocolate': '/images/snacks/default-snack.svg',
  'trail mix': '/images/snacks/default-snack.svg',
  'granola': '/images/snacks/default-snack.svg',
  'granola bar': '/images/snacks/default-snack.svg',
  'apple': '/images/snacks/default-snack.svg',
  'pear': '/images/snacks/default-snack.svg',
  'peach': '/images/snacks/default-snack.svg',
  'plum': '/images/snacks/default-snack.svg',
  'kiwi': '/images/snacks/default-snack.svg',
  'mango': '/images/snacks/default-snack.svg',
  'pineapple': '/images/snacks/default-snack.svg',
  'watermelon': '/images/snacks/default-snack.svg',
  'cantaloupe': '/images/snacks/default-snack.svg',
  'honeydew': '/images/snacks/default-snack.svg',
};

// Default fallback for unmapped snacks
export const DEFAULT_SNACK_IMAGE = '/images/snacks/default-snack.svg';

// Words that indicate a COMPLEX DISH built FROM an ingredient — not the ingredient itself.
// If a snack name contains any of these, skip partial static mapping and return the
// neutral placeholder so DALL-E can generate the correct visual (e.g., "Greek Yogurt Parfait"
// contains "yogurt" but it is NOT a plain yogurt snack — it deserves a proper generated image).
const COMPLEX_DISH_OVERRIDES = [
  'parfait', 'bowl', 'plate', 'smoothie', 'shake', 'pudding', 'mousse',
  'salad', 'wrap', 'sandwich', 'burrito', 'taco', 'stir', 'soup', 'stew',
  'curry', 'pasta', 'noodle', 'oatmeal', 'porridge', 'casserole', 'bake',
];

/**
 * Get static image for a snack (case-insensitive, word-boundary-safe)
 * Returns DEFAULT_SNACK_IMAGE if no match found or if the name describes a complex dish.
 */
export function getStaticSnackImage(snackName: string): string {
  const normalized = snackName.toLowerCase().trim();

  // If the name describes a complex dish built from ingredients, skip static matching.
  // A "Strawberry Greek Yogurt Parfait" is not a "yogurt" — DALL-E should generate it.
  if (COMPLEX_DISH_OVERRIDES.some(term => normalized.includes(term))) {
    return DEFAULT_SNACK_IMAGE;
  }

  // Exact match first
  if (STATIC_SNACK_MAPPINGS[normalized]) {
    return STATIC_SNACK_MAPPINGS[normalized];
  }

  // Partial match — key must represent a standalone item, not a complex dish.
  // Use word-boundary check: key must appear as whole word(s), not a substring of a longer phrase
  // that changes meaning (e.g., "yogurt" in "greek yogurt parfait" should not match).
  // We enforce this by only matching when the remaining text after stripping the key is
  // very short (≤ 8 chars, e.g., an adjective or brand modifier like "raw" or "roasted").
  for (const [key, imagePath] of Object.entries(STATIC_SNACK_MAPPINGS)) {
    if (normalized === key) return imagePath; // already caught above, but belt-and-suspenders

    if (normalized.includes(key)) {
      const remainder = normalized.replace(key, '').trim().replace(/[^a-z\s]/g, '').trim();
      if (remainder.length <= 8) {
        return imagePath;
      }
    }

    if (key.includes(normalized) && key.length - normalized.length <= 8) {
      return imagePath;
    }
  }

  // No meaningful match — return neutral placeholder
  return DEFAULT_SNACK_IMAGE;
}

/**
 * Check if a meal name is a snack (deterministic + pattern-based)
 * LAYER 1: Check if name exists in static mappings (deterministic, catches all mapped snacks)
 * LAYER 2: Keyword matching for unmapped snacks (pattern-based fallback)
 * This helps identify snacks even when mealType isn't explicitly set
 */
export function isLikelySnack(mealName: string): boolean {
  const normalized = mealName.toLowerCase().trim();

  // LAYER 1: Deterministic check - if it's in our mapping, it's a snack
  // This catches ALL mapped snacks (almonds, cottage cheese, trail mix, etc.)
  for (const snackKey of Object.keys(STATIC_SNACK_MAPPINGS)) {
    if (normalized.includes(snackKey) || snackKey.includes(normalized)) {
      return true;
    }
  }

  // LAYER 2: Conservative keyword fallback (avoids false positives)
  // NOTE: Removed broad keywords like "smoothie", "shake" to avoid blocking breakfast meals
  // If mealType is missing, some snacks may still slip through - that's acceptable
  const snackKeywords = [
    ' snack', 'trail mix', 'protein bar', 'energy ball', 'energy balls',
    'beef jerky', 'turkey jerky', 'cheese stick', 'string cheese',
    'rice cake', 'rice cakes', 'granola bar'
  ];

  return snackKeywords.some(keyword => normalized.includes(keyword));
}
