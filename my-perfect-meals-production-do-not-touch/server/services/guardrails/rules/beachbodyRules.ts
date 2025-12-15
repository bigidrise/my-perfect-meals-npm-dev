/**
 * BeachBody Guardrail Rules
 * 
 * Phase-dependent rules for body physique and recomposition users.
 * Each phase has different macro targets and ingredient restrictions.
 */

import type { GuardrailRules, BeachBodyPhase } from '../types';

const COMMON_BLOCKED = [
  'cookies', 'candy', 'chips', 'granola bar', 'bakery', 'donut', 'pastry',
  'ice cream', 'cake', 'brownie', 'muffin', 'croissant', 'deep fried',
  'soda', 'sugary drinks', 'alcohol', 'beer', 'wine', 'cocktail'
];

const PHASE_1_LEAN: GuardrailRules = {
  dietType: 'beachbody',
  blockedIngredients: [
    ...COMMON_BLOCKED,
    'fried', 'deep-fried', 'pan-fried',
    'heavy cream', 'cream sauce', 'alfredo', 'bechamel',
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'brie',
    'butter', 'margarine',
    'white rice', 'white pasta', 'regular pasta',
    'bacon', 'sausage', 'hot dog', 'salami', 'pepperoni',
    'ribeye', 'prime rib', 't-bone', 'fatty cuts',
    'mayonnaise', 'ranch', 'creamy dressing',
    'added sugar', 'honey', 'maple syrup', 'agave'
  ],
  preferredIngredients: [
    'chicken breast', 'turkey breast', 'egg whites', 'tilapia', 'cod', 'shrimp',
    'lean ground turkey', 'lean ground chicken',
    'spinach', 'broccoli', 'asparagus', 'green beans', 'zucchini', 'bell peppers',
    'cauliflower rice', 'quinoa', 'sweet potato',
    'greek yogurt', 'cottage cheese',
    'olive oil spray', 'cooking spray'
  ],
  macroConstraints: {
    minProtein_g: 30,
    maxSaturatedFat_g: 8
  },
  macroGuidelines: {
    proteinPriority: 'high',
    fatBalance: 'low',
    carbLimit: 'moderate'
  }
};

const PHASE_2_CARB_CONTROL: GuardrailRules = {
  dietType: 'beachbody',
  blockedIngredients: [
    ...COMMON_BLOCKED,
    'bread', 'toast', 'bagel', 'bun', 'roll',
    'pasta', 'spaghetti', 'penne', 'noodles',
    'rice', 'white rice', 'brown rice', 'jasmine rice',
    'tortilla', 'wrap', 'pita',
    'potato', 'french fries', 'mashed potatoes', 'hash browns',
    'banana', 'mango', 'pineapple', 'grapes', 'dried fruit',
    'corn', 'peas', 'carrots', 'beets',
    'oatmeal', 'cereal', 'granola'
  ],
  preferredIngredients: [
    'chicken breast', 'turkey', 'egg whites', 'salmon', 'cod', 'shrimp',
    'lean beef', 'sirloin', 'flank steak',
    'cauliflower rice', 'zucchini noodles', 'shirataki noodles',
    'lettuce wraps', 'cabbage wraps',
    'spinach', 'kale', 'arugula', 'broccoli', 'asparagus', 'cucumber',
    'berries', 'strawberries', 'blueberries', 'raspberries',
    'avocado', 'olive oil', 'coconut oil', 'nuts', 'almonds'
  ],
  macroConstraints: {
    minProtein_g: 30,
    maxCarbs_g: 30
  },
  macroGuidelines: {
    proteinPriority: 'high',
    fatBalance: 'moderate',
    carbLimit: 'low',
    lowGlycemicImpact: true
  }
};

const PHASE_3_MAINTENANCE: GuardrailRules = {
  dietType: 'beachbody',
  blockedIngredients: [
    ...COMMON_BLOCKED,
    'fried', 'deep-fried',
    'heavy cream', 'cream sauce', 'alfredo',
    'excessive cheese', 'cheese-heavy',
    'fatty desserts', 'cheesecake', 'tiramisu'
  ],
  preferredIngredients: [
    'chicken', 'turkey', 'fish', 'salmon', 'lean beef', 'eggs',
    'brown rice', 'quinoa', 'whole wheat pasta', 'sweet potato', 'oats',
    'all vegetables', 'broccoli', 'spinach', 'mixed greens',
    'all fruits', 'banana', 'apple', 'berries', 'orange',
    'greek yogurt', 'cottage cheese', 'low-fat cheese'
  ],
  macroConstraints: {
    minProtein_g: 25
  },
  macroGuidelines: {
    proteinPriority: 'balanced',
    fatBalance: 'balanced',
    carbLimit: 'balanced',
    evenMacroDistribution: true
  }
};

const PHASE_4_SCULPT: GuardrailRules = {
  dietType: 'beachbody',
  blockedIngredients: [
    ...COMMON_BLOCKED,
    'ultra-processed', 'artificial sweeteners',
    'fried', 'greasy', 'fast food',
    'heavy desserts', 'sugary cereals'
  ],
  preferredIngredients: [
    'chicken breast', 'lean beef', 'salmon', 'tilapia', 'eggs', 'egg whites',
    'oatmeal', 'sweet potato', 'brown rice', 'quinoa', 'whole grain bread',
    'banana', 'apple', 'berries', 'orange', 'fruit',
    'broccoli', 'spinach', 'asparagus', 'mixed vegetables',
    'greek yogurt', 'cottage cheese', 'protein shake',
    'almonds', 'peanut butter', 'avocado'
  ],
  macroConstraints: {
    minProtein_g: 35
  },
  macroGuidelines: {
    proteinPriority: 'high',
    fatBalance: 'moderate',
    carbLimit: 'higher'
  }
};

export function getBeachBodyRules(phase: BeachBodyPhase = 'lean'): GuardrailRules {
  switch (phase) {
    case 'lean':
      return PHASE_1_LEAN;
    case 'carb-control':
      return PHASE_2_CARB_CONTROL;
    case 'maintenance':
      return PHASE_3_MAINTENANCE;
    case 'sculpt':
      return PHASE_4_SCULPT;
    default:
      return PHASE_1_LEAN;
  }
}

export const BEACHBODY_SNACK_RULES = {
  allowed: [
    'greek yogurt', 'cottage cheese', 'protein shake', 'protein bar',
    'rice cakes', 'berries', 'apple', 'almonds', 'hard boiled eggs',
    'beef jerky', 'turkey slices', 'celery', 'cucumber', 'carrots'
  ],
  blocked: [
    'cookies', 'candy', 'chips', 'crackers', 'granola bars',
    'bakery items', 'pastries', 'ice cream', 'creamy treats',
    'fried snacks', 'cheese puffs', 'popcorn with butter'
  ]
};

export const BEACHBODY_COOKING_METHODS = {
  preferred: ['grilled', 'baked', 'air-fried', 'steamed', 'roasted', 'poached'],
  avoid: ['deep-fried', 'pan-fried in oil', 'sauteed in butter']
};
