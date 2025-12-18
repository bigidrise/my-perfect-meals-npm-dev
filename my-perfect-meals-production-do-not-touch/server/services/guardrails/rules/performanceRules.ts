/**
 * Performance & Competition Guardrails - Rules Module
 * 
 * THE STRICTEST GUARDRAIL SYSTEM
 * For athletes in competition prep - stage-safe, prep-safe, coach-safe meals.
 * Every meal must be predictable, boring, repeatable, and competition-safe.
 * 
 * NO creativity. NO fun meals. NO cheat meals.
 */

import type { GuardrailRules } from '../types';

/**
 * Competition phase types for carb cycling
 */
export type CompetitionPhase = 'carb' | 'low-carb' | 'no-carb' | 'refeed' | 'offseason';

/**
 * Core performance rules - applies to ALL competition phases
 */
export const performanceRules: GuardrailRules = {
  dietType: 'performance',
  promptGuidance: 'Strictest guardrails for athletes in competition prep. Stage-safe, prep-safe, coach-safe.',
  
  // ABSOLUTELY FORBIDDEN - Never allowed in any competition meal
  blockedIngredients: [
    // HIGH FAT FOODS
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'cream cheese', 'brie',
    'cream', 'heavy cream', 'whipping cream', 'sour cream', 'half and half',
    'butter', 'margarine', 'ghee',
    'bacon', 'sausage', 'pork shoulder', 'pork belly', 'pork ribs',
    'fatty beef', 'ribeye', 'prime rib', 'beef brisket', 'ground beef 80/20',
    'chicken thighs', 'chicken wings', 'dark meat chicken', 'chicken skin',
    'duck', 'lamb', 'goat',
    
    // HIGH SODIUM / PROCESSED
    'deli meat', 'lunch meat', 'cold cuts', 'salami', 'pepperoni', 'prosciutto',
    'cured meats', 'jerky', 'beef jerky', 'turkey jerky',
    'canned soup', 'canned chili', 'canned stew',
    'soy sauce', 'teriyaki sauce', 'hoisin sauce', 'oyster sauce',
    'worcestershire sauce', 'fish sauce', 'miso paste',
    'bouillon', 'stock cubes', 'instant broth',
    'pickles', 'olives', 'capers', 'anchovies',
    'hot dogs', 'bratwurst', 'kielbasa',
    
    // HIGH SUGAR
    'honey', 'maple syrup', 'agave', 'corn syrup', 'molasses',
    'fruit juice', 'orange juice', 'apple juice', 'grape juice',
    'grapes', 'banana', 'mango', 'pineapple', 'dried fruit', 'raisins', 'dates',
    'dessert', 'cake', 'cookies', 'brownies', 'ice cream', 'frozen yogurt',
    'candy', 'chocolate', 'sweetened yogurt', 'flavored yogurt',
    'granola', 'granola bars', 'protein bars', 'energy bars',
    'jam', 'jelly', 'preserves', 'marmalade',
    'sugar', 'brown sugar', 'powdered sugar', 'cane sugar',
    
    // HIGH FAT PLANT FOODS
    'nuts', 'almonds', 'walnuts', 'pecans', 'cashews', 'macadamia', 'pistachios',
    'peanut butter', 'almond butter', 'nut butter',
    'coconut', 'coconut milk', 'coconut cream', 'coconut oil',
    'avocado', 'guacamole',
    'tahini', 'hummus',
    
    // STARCH BOMBS / FORBIDDEN CARBS
    'pasta', 'spaghetti', 'linguine', 'fettuccine', 'penne', 'macaroni', 'noodles',
    'white potato', 'french fries', 'mashed potatoes', 'potato chips',
    'pizza', 'pizza dough', 'flatbread',
    'tortilla', 'taco shell', 'burrito wrap',
    'bread', 'bagel', 'croissant', 'biscuit', 'muffin', 'roll',
    'cereal', 'pancakes', 'waffles', 'french toast',
    
    // SAUCES & CONDIMENTS (except allowed list)
    'mayonnaise', 'mayo', 'aioli', 'ranch', 'blue cheese dressing',
    'caesar dressing', 'thousand island', 'french dressing',
    'bbq sauce', 'ketchup', 'tartar sauce',
    'alfredo sauce', 'cream sauce', 'cheese sauce',
    
    // COOKING METHODS (blocked)
    'deep fried', 'fried', 'pan fried', 'sautéed in oil', 'battered',
    'breaded', 'crusted', 'coated',
  ],
  
  // STRICT ALLOWED INGREDIENTS
  preferredIngredients: [
    // PROTEIN (core)
    'chicken breast', 'skinless chicken breast', 'grilled chicken',
    'ground turkey 93%', 'ground turkey 99%', 'lean ground turkey',
    'turkey breast', 'turkey tenderloin',
    'tilapia', 'cod', 'mahi mahi', 'halibut', 'sole', 'flounder', 'white fish',
    'egg whites', 'liquid egg whites',
    'whey protein', 'casein protein', 'protein powder',
    'tuna', 'tuna packet', 'canned tuna in water',
    'shrimp', 'scallops', 'crab',
    'cottage cheese', 'greek yogurt plain', 'nonfat greek yogurt',
    
    // CARBS (phase dependent but core allowed)
    'white rice', 'jasmine rice', 'basmati rice',
    'oats', 'oatmeal', 'rolled oats', 'steel cut oats',
    'sweet potato', 'yam',
    'cream of rice', 'cream of wheat',
    'rice cakes', 'plain rice cakes',
    'quinoa',
    
    // VEG / FIBER
    'asparagus', 'grilled asparagus', 'steamed asparagus',
    'green beans', 'string beans',
    'broccoli', 'steamed broccoli',
    'zucchini', 'grilled zucchini',
    'bell pepper', 'red pepper', 'green pepper',
    'spinach', 'baby spinach',
    'cucumber', 'celery', 'lettuce', 'romaine',
    'mushrooms', 'tomatoes', 'onion', 'garlic',
    
    // ALLOWED CONDIMENTS (minimal)
    'mustard', 'yellow mustard', 'dijon mustard',
    'sugar-free ketchup', 'low-sugar ketchup',
    'hot sauce', 'low-sodium hot sauce', 'sriracha',
    'lemon juice', 'lime juice', 'vinegar', 'apple cider vinegar',
    'salt-free seasoning', 'herbs', 'spices', 'black pepper',
    'garlic powder', 'onion powder', 'paprika', 'cumin',
    
    // COOKING METHODS (allowed)
    'air fried', 'air fryer', 'baked', 'grilled', 'steamed',
    'pan spray', 'cooking spray', 'nonstick',
  ],
  
  macroConstraints: {
    maxSaturatedFat_g: 10,
    minProtein_g: 30,
  },
};

/**
 * Get carb-phase specific rules
 */
export function getCompetitionPhaseRules(phase: CompetitionPhase): {
  carbsAllowed: boolean;
  maxCarbsPerMeal: number;
  maxFatPerMeal: number;
  notes: string;
} {
  switch (phase) {
    case 'carb':
      return {
        carbsAllowed: true,
        maxCarbsPerMeal: 60,
        maxFatPerMeal: 8,
        notes: 'Carb day - clean carbs with each meal, very low fat',
      };
    case 'low-carb':
      return {
        carbsAllowed: true,
        maxCarbsPerMeal: 25,
        maxFatPerMeal: 10,
        notes: 'Low carb day - minimal carbs, slightly higher fat allowed',
      };
    case 'no-carb':
      return {
        carbsAllowed: false,
        maxCarbsPerMeal: 10,  // Only incidental carbs from veggies
        maxFatPerMeal: 12,
        notes: 'No carb day - protein + veggies only, no starchy carbs',
      };
    case 'refeed':
      return {
        carbsAllowed: true,
        maxCarbsPerMeal: 80,
        maxFatPerMeal: 5,
        notes: 'Refeed day - high carbs, extremely low fat',
      };
    case 'offseason':
      return {
        carbsAllowed: true,
        maxCarbsPerMeal: 70,
        maxFatPerMeal: 15,
        notes: 'Offseason - more flexibility but still clean eating',
      };
    default:
      return {
        carbsAllowed: true,
        maxCarbsPerMeal: 50,
        maxFatPerMeal: 8,
        notes: 'Default competition rules',
      };
  }
}

/**
 * Calculate protein per meal based on daily target and meal frequency
 */
export function calculateProteinPerMeal(dailyProtein: number, mealFrequency: number): number {
  return Math.round(dailyProtein / mealFrequency);
}

/**
 * Get allowed carb sources based on phase
 */
export function getAllowedCarbSources(phase: CompetitionPhase): string[] {
  const baseCarbSources = [
    'white rice', 'jasmine rice',
    'oats', 'oatmeal',
    'sweet potato',
    'cream of rice',
    'rice cakes',
  ];
  
  if (phase === 'no-carb') {
    // Only fibrous veggies allowed
    return [];
  }
  
  if (phase === 'refeed') {
    // Add extra carb sources for refeed
    return [...baseCarbSources, 'quinoa', 'basmati rice'];
  }
  
  return baseCarbSources;
}

/**
 * Snack-specific rules for competition prep
 */
export const performanceSnackRules = {
  allowed: [
    'greek yogurt plain', 'nonfat greek yogurt',
    'cottage cheese', 'low fat cottage cheese',
    'rice cakes', 'plain rice cakes',
    'protein shake', 'whey protein', 'casein protein',
    'egg whites', 'hard boiled egg whites',
    'chicken bites', 'grilled chicken strips',
    'tuna packet', 'canned tuna in water',
    'berries', 'strawberries', 'blueberries', 'raspberries',
  ],
  
  forbidden: [
    'protein bars', 'energy bars', 'granola bars',
    'nuts', 'trail mix', 'nut butter',
    'chips', 'crackers', 'pretzels',
    'fruit', 'dried fruit', 'banana', 'apple',
    'yogurt with fruit', 'flavored yogurt',
  ],
};

export { performanceRules as default };
