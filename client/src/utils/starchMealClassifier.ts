/**
 * Starch Meal Classifier
 * 
 * Categorical classification of meals as "Starch Meal" or "Fiber-Based Meal"
 * for the Daily Starch Meal coaching system on meal boards.
 * 
 * IMPORTANT: Only TRUE high-glycemic starches that spike insulin.
 * Real nutrition people know the difference - corn, beans, sweet potato
 * are NOT the same as white rice and white potatoes.
 * 
 * Classification is based on ingredient keywords for behavioral guidance.
 */

// HIGH-GLYCEMIC STARCHES - These spike insulin and cause weight gain
// These are the REAL problem starches that need to be limited
const HIGH_GI_STARCHES = [
  // White potato products (HIGH GI ~80-90)
  'potato', 'potatoes', 'tater', 'hash brown', 'hashbrown',
  'french fries', 'fries', 'mashed potato', 'baked potato',
  
  // White rice (HIGH GI ~70-90)
  'white rice', 'jasmine rice', 'basmati rice',
  'rice', // generic rice assumed white
  
  // Refined wheat/flour products (HIGH GI ~70-85)
  'bread', 'toast', 'bagel', 'bun', 'roll', 'croissant', 'biscuit',
  'pasta', 'spaghetti', 'noodle', 'noodles', 'macaroni', 'penne', 'fettuccine',
  'flour tortilla', 'white tortilla',
  'pancake', 'waffle', 'crepe',
  
  // Refined cereals (HIGH GI ~70+)
  'cornflakes', 'rice krispies', 'puffed rice',
  
  // White flour-based (HIGH GI)
  'couscous', 'polenta', 'grits',
];

// MODERATE STARCHES - These have fiber/protein, lower insulin impact
// Do NOT block these - they're fine for weight management
const ALLOWED_STARCHES = [
  // Corn (Moderate GI ~50-60, high fiber)
  'corn', 'corn tortilla', 'popcorn',
  
  // Sweet potato (Moderate GI ~50-60, high fiber)
  'sweet potato', 'yam',
  
  // Legumes (LOW GI ~20-40, high fiber + protein)
  'bean', 'beans', 'black bean', 'kidney bean', 'pinto bean',
  'navy bean', 'cannellini', 'chickpea', 'hummus',
  'lentil', 'lentils', 'pea', 'peas', 'edamame',
  
  // Whole grains with fiber (Moderate GI ~40-55)
  'oat', 'oatmeal', 'steel cut oat', 'rolled oat',
  'quinoa', 'barley', 'bulgur', 'farro', 'millet',
  'brown rice', 'wild rice',
  
  // Note: These are allowed because the fiber slows glucose absorption
];

interface Ingredient {
  name?: string;
  item?: string;
  quantity?: string | number;
  unit?: string;
}

interface MealLike {
  name?: string;
  ingredients?: (string | Ingredient)[];
}

export interface StarchClassification {
  isStarchMeal: boolean;
  label: string;
  emoji: string;
  matchedStarch?: string; // What triggered it
}

/**
 * Check if an ingredient contains a high-GI starch
 * Uses smarter matching to avoid false positives
 */
function containsHighGIStarch(ingredientName: string): string | null {
  const name = ingredientName.toLowerCase().trim();
  
  // First check if it's an ALLOWED starch (takes priority)
  // These override the generic matches
  for (const allowed of ALLOWED_STARCHES) {
    if (name.includes(allowed)) {
      // If it explicitly contains an allowed starch, don't flag it
      // e.g., "sweet potato" shouldn't match "potato"
      // e.g., "brown rice" shouldn't match "rice"
      // e.g., "corn tortilla" shouldn't match "tortilla"
      return null;
    }
  }
  
  // Now check for high-GI starches
  for (const starch of HIGH_GI_STARCHES) {
    // Use word boundary matching for short keywords to avoid partial matches
    if (starch.length <= 4) {
      // For short words like 'rice', 'bun', require word boundaries
      const regex = new RegExp(`\\b${starch}\\b`, 'i');
      if (regex.test(name)) {
        return starch;
      }
    } else {
      // For longer terms, simple includes is fine
      if (name.includes(starch)) {
        return starch;
      }
    }
  }
  
  return null;
}

/**
 * Classify a meal as Starch or Fiber-Based
 * Only flags HIGH-GI starches that actually spike insulin
 */
export function classifyMeal(meal: MealLike): StarchClassification {
  const ingredients = meal.ingredients || [];
  
  for (const ing of ingredients) {
    const name = typeof ing === 'string' ? ing : (ing.name || ing.item || '');
    const matchedStarch = containsHighGIStarch(name);
    
    if (matchedStarch) {
      return {
        isStarchMeal: true,
        label: 'Starch Meal',
        emoji: '🟠',
        matchedStarch,
      };
    }
  }
  
  return {
    isStarchMeal: false,
    label: 'Fiber-Based',
    emoji: '🟢',
  };
}

/**
 * Check if a day has used its starch meal allocation
 * @param meals - List of meals for the day
 * @param maxSlots - Maximum starch meals allowed (1 = "one" strategy, 2 = "flex" strategy)
 */
export function getDayStarchStatus(meals: MealLike[], maxSlots: number = 1): {
  isUsed: boolean;
  starchMealCount: number;
  slotsRemaining: number;
  maxSlots: number;
  label: string;
} {
  let starchMealCount = 0;
  
  for (const meal of meals) {
    if (classifyMeal(meal).isStarchMeal) {
      starchMealCount++;
    }
  }
  
  const slotsRemaining = Math.max(0, maxSlots - starchMealCount);
  const isUsed = slotsRemaining === 0;
  
  // Generate label based on slots
  let label: string;
  if (maxSlots === 1) {
    label = starchMealCount > 0 ? 'Used' : 'Available';
  } else {
    // Flex mode: show remaining slots
    if (slotsRemaining === 0) {
      label = 'Both Used';
    } else if (slotsRemaining === maxSlots) {
      label = `${maxSlots} Available`;
    } else {
      label = `${slotsRemaining} Remaining`;
    }
  }
  
  return {
    isUsed,
    starchMealCount,
    slotsRemaining,
    maxSlots,
    label,
  };
}
