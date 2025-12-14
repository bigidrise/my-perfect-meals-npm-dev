// Carb split helper - classifies ingredients into starchy vs fibrous carbs
// Starchy: grains, rice, pasta, bread, potatoes, corn, beans, lentils
// Fibrous: vegetables, leafy greens, most fruits (except bananas/dried fruit)

const STARCHY_KEYWORDS = [
  'rice', 'pasta', 'bread', 'potato', 'potatoes', 'noodle', 'noodles',
  'corn', 'tortilla', 'wrap', 'pita', 'bagel', 'roll', 'bun',
  'oat', 'oats', 'oatmeal', 'cereal', 'granola', 'quinoa', 'couscous',
  'barley', 'wheat', 'flour', 'cracker', 'crackers', 'chip', 'chips',
  'bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas',
  'pea', 'peas', 'hummus', 'falafel',
  'sweet potato', 'yam', 'plantain', 'cassava', 'taro',
  'polenta', 'grits', 'cornmeal', 'breadcrumb', 'panko', 'crouton',
  'banana', 'dried fruit', 'raisin', 'date', 'fig',
  'muffin', 'biscuit', 'pancake', 'waffle', 'french toast',
];

const FIBROUS_KEYWORDS = [
  'spinach', 'kale', 'lettuce', 'arugula', 'cabbage', 'broccoli',
  'cauliflower', 'brussels sprout', 'asparagus', 'celery', 'cucumber',
  'zucchini', 'squash', 'eggplant', 'bell pepper', 'pepper', 'tomato',
  'onion', 'garlic', 'mushroom', 'carrot', 'radish', 'turnip',
  'green bean', 'snap pea', 'snow pea', 'artichoke', 'fennel',
  'leek', 'scallion', 'chard', 'collard', 'bok choy', 'watercress',
  'endive', 'radicchio', 'escarole', 'beet greens', 'mustard greens',
  'apple', 'orange', 'berry', 'berries', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'grape', 'grapefruit', 'lemon', 'lime',
  'peach', 'pear', 'plum', 'cherry', 'melon', 'watermelon', 'cantaloupe',
  'kiwi', 'mango', 'papaya', 'pineapple', 'avocado',
  'salad', 'greens', 'vegetable', 'veggie',
];

export interface CarbSplitResult {
  starchyGrams: number;
  fibrousGrams: number;
}

export function classifyIngredient(ingredientName: string): 'starchy' | 'fibrous' | 'unknown' {
  const name = ingredientName.toLowerCase();
  
  for (const keyword of STARCHY_KEYWORDS) {
    if (name.includes(keyword)) {
      return 'starchy';
    }
  }
  
  for (const keyword of FIBROUS_KEYWORDS) {
    if (name.includes(keyword)) {
      return 'fibrous';
    }
  }
  
  return 'unknown';
}

export function deriveCarbSplit(
  ingredients: Array<{ name?: string; item?: string; carbs?: number }> | undefined,
  totalCarbs: number
): CarbSplitResult {
  if (!ingredients || ingredients.length === 0) {
    return { starchyGrams: 0, fibrousGrams: totalCarbs };
  }

  let starchyCount = 0;
  let fibrousCount = 0;
  let unknownCount = 0;

  for (const ing of ingredients) {
    const name = ing.name || ing.item || '';
    const classification = classifyIngredient(name);
    
    if (classification === 'starchy') {
      starchyCount++;
    } else if (classification === 'fibrous') {
      fibrousCount++;
    } else {
      unknownCount++;
    }
  }

  const totalClassified = starchyCount + fibrousCount;
  
  if (totalClassified === 0) {
    return { starchyGrams: Math.round(totalCarbs * 0.6), fibrousGrams: Math.round(totalCarbs * 0.4) };
  }

  const starchyRatio = starchyCount / (totalClassified || 1);
  const fibrousRatio = fibrousCount / (totalClassified || 1);

  return {
    starchyGrams: Math.round(totalCarbs * starchyRatio),
    fibrousGrams: Math.round(totalCarbs * fibrousRatio),
  };
}
