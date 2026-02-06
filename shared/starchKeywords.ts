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
