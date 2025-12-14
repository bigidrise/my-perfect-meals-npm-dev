/**
 * General Nutrition Guardrail Rules
 * 
 * Basic "clean eating" rules for everyday healthy meals.
 * Not as strict as medical diets, but ensures sensible, balanced meals.
 */

import type { GuardrailRules } from '../types';

export const generalNutritionRules: GuardrailRules = {
  dietType: 'general-nutrition',
  blockedIngredients: [
    'deep fried', 'fried chicken', 'fried fish', 'onion rings', 'french fries',
    'donut', 'doughnut', 'cake', 'brownie', 'candy', 'cookies',
    'soda', 'cola', 'energy drink', 'sweetened beverage',
    'hot dog', 'bologna', 'spam', 'processed meat',
    'margarine', 'shortening', 'lard',
    'sugary cereal', 'frosted flakes', 'lucky charms',
    'heavy cream sauce', 'alfredo', 'loaded nachos',
    'ice cream sundae', 'milkshake',
    'fast food', 'big mac', 'whopper'
  ],
  preferredIngredients: [
    'chicken breast', 'turkey', 'salmon', 'tilapia', 'cod', 'shrimp',
    'eggs', 'egg whites', 'lean beef', 'sirloin',
    'brown rice', 'quinoa', 'oats', 'oatmeal', 'whole wheat',
    'sweet potato', 'regular potato', 'whole grain bread',
    'spinach', 'broccoli', 'kale', 'mixed greens', 'asparagus',
    'bell peppers', 'tomatoes', 'cucumbers', 'zucchini',
    'berries', 'apple', 'banana', 'orange', 'grapes',
    'olive oil', 'avocado', 'almonds', 'walnuts', 'peanut butter',
    'greek yogurt', 'cottage cheese', 'low-fat cheese'
  ],
  macroGuidelines: {
    proteinPriority: 'moderate-high',
    carbLimit: 'moderate',
    fatBalance: 'moderate',
    evenMacroDistribution: true
  }
};

export const GENERAL_NUTRITION_SNACK_RULES = {
  allowed: [
    'greek yogurt', 'cottage cheese', 'protein bar', 'protein shake',
    'fruit', 'apple', 'banana', 'berries', 'orange',
    'nuts', 'almonds', 'walnuts', 'cashews', 'peanuts',
    'hummus', 'vegetables', 'carrots', 'celery', 'cucumber',
    'rice cakes', 'whole grain crackers', 'cheese stick',
    'hard boiled eggs', 'turkey slices', 'beef jerky'
  ],
  blocked: [
    'candy', 'chocolate bar', 'chips', 'potato chips', 'doritos',
    'cookies', 'oreos', 'donuts', 'pastries', 'muffins',
    'soda', 'energy drinks', 'sugary drinks',
    'ice cream', 'milkshake', 'cake', 'pie'
  ]
};

export const GENERAL_NUTRITION_PRINCIPLES = {
  mealBalance: 'Every meal should include protein, vegetables or fiber, and reasonable carbs',
  portionControl: 'Portions should be realistic for everyday eating',
  wholefoods: 'Prioritize whole, minimally processed foods',
  cravingTransform: 'Transform junk food cravings into healthier versions'
};
