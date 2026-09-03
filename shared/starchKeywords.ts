/**
 * STARCH KEYWORDS — SINGLE SOURCE OF TRUTH
 * 
 * Used by BOTH the client-side Starch Meal Classifier (DailyStarchIndicator)
 * AND the server-side Starch Game Plan (unifiedMealPipeline) to ensure
 * identical logic for what counts as a "starchy carb."
 * 
 * If you add/remove a keyword here, it affects:
 * 1. Client: DailyStarchIndicator shows starch slot as used
 * 2. Server: AI prompt includes/excludes starchy ingredients
 * 3. Server: Auto-detection of user-requested starchy foods
 */

/**
 * EXPLICIT_STARCH_KEYWORDS — intent-aware auto-override list
 *
 * A curated subset of STARCHY_KEYWORDS covering unambiguously named starch
 * foods. When a user's free-text description matches one of these terms
 * (and it is not overridden by a fibrous phrase), the starch slot guard
 * auto-overrides silently — no dialog shown — because user intent is clear.
 *
 * Deliberately EXCLUDED:
 *   - pizza, sandwich, burger, muffin, cracker  (ambiguous composition)
 *   - beans, lentils, chickpeas, hummus         (legumes stay in general carb detection only)
 *   - pea/peas, roll, wrap, corn                (too short / too vague)
 */
export const EXPLICIT_STARCH_KEYWORDS: string[] = [
  // Potatoes
  'potato', 'potatoes', 'hash brown', 'hashbrown',
  'fries', 'french fries', 'mashed potato', 'baked potato',
  'sweet potato', 'yam',

  // Rice
  'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'wild rice',

  // Pasta (named varieties — generic "noodles" kept out intentionally)
  'pasta', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'lasagna', 'ramen',

  // Bread / baked
  'bread', 'toast', 'bagel', 'bun', 'croissant', 'biscuit',

  // Flatbreads / breakfast starch
  'tortilla', 'flour tortilla', 'pancake', 'waffle', 'crepe', 'pita', 'flatbread',

  // Grains
  'oats', 'oatmeal', 'steel cut oats', 'rolled oats',
  'quinoa', 'couscous', 'polenta', 'grits',
  'barley', 'bulgur', 'farro', 'millet',

  // Cereal
  'cereal', 'granola', 'cornflakes', 'rice krispies', 'puffed rice',

  // Corn — explicit forms only
  'corn tortilla', 'popcorn',
];

export const STARCHY_KEYWORDS = [
  'potato', 'potatoes', 'tater', 'hash brown', 'hashbrown',
  'french fries', 'fries', 'mashed potato', 'baked potato',

  'rice', 'white rice', 'jasmine rice', 'basmati rice',
  'brown rice', 'wild rice',

  'bread', 'toast', 'bagel', 'bun', 'roll', 'croissant', 'biscuit',
  'pasta', 'spaghetti', 'noodle', 'noodles', 'macaroni', 'penne', 'fettuccine',
  'lasagna', 'ramen',
  'flour tortilla', 'white tortilla', 'tortilla', 'wrap',
  'pancake', 'waffle', 'crepe',

  'cornflakes', 'rice krispies', 'puffed rice',
  'couscous', 'polenta', 'grits',

  'corn', 'corn tortilla', 'popcorn',

  'sweet potato', 'yam',

  'bean', 'beans', 'black bean', 'kidney bean', 'pinto bean',
  'navy bean', 'cannellini', 'chickpea', 'hummus',
  'lentil', 'lentils', 'pea', 'peas', 'edamame',

  'oat', 'oats', 'oatmeal', 'steel cut oat', 'rolled oat',
  'cereal', 'granola',
  'quinoa', 'barley', 'bulgur', 'farro', 'millet',

  'sandwich', 'burger', 'muffin',
  'pizza', 'flatbread', 'pita', 'cracker',
];
