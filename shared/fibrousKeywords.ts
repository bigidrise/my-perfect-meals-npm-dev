/**
 * FIBROUS KEYWORDS — SINGLE SOURCE OF TRUTH
 *
 * Used by BOTH carbSplit.ts and carbClassifier.ts to ensure
 * identical fibrous carb detection across the meal generation pipeline.
 *
 * If you add/remove a keyword here, it affects:
 * 1. Server: carbSplit.ts — ingredient-level carb split in macro helpers
 * 2. Server: carbClassifier.ts — enforceCarbs post-parse classification
 *
 * Mirror pattern of shared/starchKeywords.ts
 *
 * PHRASE-LEVEL OVERRIDES (listed first so they match before shorter keywords):
 * Vegetable-based preparations that contain starchy-sounding words in their name
 * (e.g. "cauliflower rice") must appear here to be hard-locked as fibrous.
 * These are checked before starchy keywords in every classifier.
 */

export const FIBROUS_KEYWORDS = [
  // Phrase-level overrides — vegetable-based preparations that look starchy
  'cauliflower rice', 'cauliflower mash', 'cauliflower mashed',
  'broccoli rice', 'broccoli slaw',
  'zucchini noodles', 'zucchini pasta', 'zucchini spirals', 'zucchini ribbons',
  'spaghetti squash', 'butternut squash', 'acorn squash', 'delicata squash',
  'vegetable noodles', 'veggie noodles', 'vegetable pasta', 'veggie pasta',
  'vegetable rice', 'veggie rice',
  'hearts of palm', 'hearts of palm pasta', 'hearts of palm noodles',
  'shirataki', 'konjac',

  // Leafy greens
  'spinach', 'kale', 'lettuce', 'arugula', 'chard', 'collard', 'romaine',
  'mixed greens', 'spring mix', 'salad', 'cabbage', 'bok choy', 'watercress',
  'endive', 'radicchio', 'escarole', 'beet greens', 'mustard greens',

  // Cruciferous & stem vegetables
  'broccoli', 'cauliflower', 'brussels sprout', 'kohlrabi',
  'asparagus', 'artichoke', 'celery', 'carrot', 'radish', 'turnip', 'beet',

  // Peppers & aromatics
  'pepper', 'bell pepper', 'jalapeno', 'peppers',
  'onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion', 'chive',

  // Other vegetables
  'tomato', 'cucumber', 'zucchini', 'squash', 'eggplant', 'mushroom', 'mushrooms',

  // Pods & specialty
  'green bean', 'green beans', 'snap pea', 'snow pea', 'okra', 'fennel',

  // Herbs
  'basil', 'cilantro', 'parsley', 'dill', 'mint', 'oregano', 'thyme', 'rosemary',

  // Generic vegetable terms
  'vegetable', 'vegetables', 'veggie', 'veggies',
  'mixed vegetables', 'garden vegetables', 'garden veggies',
  'steamed vegetables', 'roasted vegetables', 'stir fry vegetables',
  'sautéed greens', 'sauteed greens',
  'greens', 'leafy greens',

  // NOTE: Fruits (berries, apple, mango, etc.) are intentionally EXCLUDED.
  // Fruits are sugary/starchy carbs, not fibrous carbs.
  // Fibrous carbs = non-starchy vegetables ONLY.
];
