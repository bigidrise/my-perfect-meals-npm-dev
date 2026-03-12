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
 */

export const FIBROUS_KEYWORDS = [
  'spinach', 'kale', 'lettuce', 'arugula', 'chard', 'collard', 'romaine',
  'mixed greens', 'spring mix', 'salad', 'cabbage', 'bok choy', 'watercress',
  'endive', 'radicchio', 'escarole', 'beet greens', 'mustard greens',

  'broccoli', 'cauliflower', 'brussels sprout', 'kohlrabi',
  'asparagus', 'artichoke', 'celery', 'carrot', 'radish', 'turnip', 'beet',

  'pepper', 'bell pepper', 'jalapeno', 'peppers',
  'onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion', 'chive',

  'tomato', 'cucumber', 'zucchini', 'squash', 'eggplant', 'mushroom', 'mushrooms',

  'green bean', 'green beans', 'snap pea', 'snow pea', 'okra', 'fennel',

  'basil', 'cilantro', 'parsley', 'dill', 'mint', 'oregano', 'thyme', 'rosemary',

  'vegetable', 'vegetables', 'veggie', 'veggies',
  'mixed vegetables', 'garden vegetables', 'garden veggies',
  'steamed vegetables', 'roasted vegetables', 'stir fry vegetables',
  'sautéed greens', 'sauteed greens',
  'greens', 'leafy greens',

  'apple', 'orange', 'berry', 'berries', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'grape', 'grapefruit', 'lemon', 'lime',
  'peach', 'pear', 'plum', 'cherry', 'melon', 'watermelon', 'cantaloupe',
  'kiwi', 'mango', 'papaya', 'pineapple', 'avocado',
];
