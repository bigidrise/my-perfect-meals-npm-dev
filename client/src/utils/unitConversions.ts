
import { INGREDIENT_MACROS } from "@/data/ingredients.nutrition";

// Convert oz to grams (weight)
const ozToGrams = (oz: number) => Math.round(oz * 28.35);

// Convert common units to grams for nutrition lookup
function convertToGrams(amount: number, unit: string): number {
  const unitLower = unit.toLowerCase();
  
  if (unitLower === 'g' || unitLower === 'grams' || unitLower === 'gram') {
    return amount;
  }
  if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') {
    return ozToGrams(amount);
  }
  if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') {
    return amount * 453.59;
  }
  // For cups, use rough estimates - will vary by ingredient
  if (unitLower === 'cup' || unitLower === 'cups') {
    return amount * 240; // default for liquids
  }
  
  return amount; // fallback
}

// Find matching ingredient in nutrition database
function findIngredientNutrition(ingredientName: string) {
  const searchName = ingredientName.toLowerCase().trim();
  
  // Direct match
  if (INGREDIENT_MACROS[searchName]) {
    return INGREDIENT_MACROS[searchName];
  }
  
  // Partial match - find first ingredient that contains the search term
  for (const [key, value] of Object.entries(INGREDIENT_MACROS)) {
    if (key.includes(searchName) || searchName.includes(key)) {
      return value;
    }
  }
  
  return null;
}

// Determine which macro to display (protein for proteins, carbs for carbs, fat for fats)
function getPrimaryMacro(ingredientName: string, nutrition: any): { macro: string; value: number } | null {
  const name = ingredientName.toLowerCase();
  
  // Protein sources
  if (name.includes('chicken') || name.includes('turkey') || name.includes('beef') || 
      name.includes('fish') || name.includes('salmon') || name.includes('cod') ||
      name.includes('shrimp') || name.includes('tofu') || name.includes('egg')) {
    return { macro: 'protein', value: nutrition.protein };
  }
  
  // Carb sources
  if (name.includes('rice') || name.includes('quinoa') || name.includes('pasta') || 
      name.includes('potato') || name.includes('yam') || name.includes('oat') ||
      name.includes('bread') || name.includes('tortilla')) {
    return { macro: 'carbs', value: nutrition.carbs };
  }
  
  // Fat sources
  if (name.includes('oil') || name.includes('avocado') || name.includes('butter') ||
      name.includes('nut') || name.includes('almond')) {
    return { macro: 'fat', value: nutrition.fat };
  }
  
  // Default to highest macro
  const maxMacro = Math.max(nutrition.protein, nutrition.carbs, nutrition.fat);
  if (maxMacro === nutrition.protein) return { macro: 'protein', value: nutrition.protein };
  if (maxMacro === nutrition.carbs) return { macro: 'carbs', value: nutrition.carbs };
  if (maxMacro === nutrition.fat) return { macro: 'fat', value: nutrition.fat };
  
  return null;
}

/**
 * Format ingredient display text (amount, unit, item name only)
 * 
 * NOTE: Ingredient-level macros removed for accuracy/trust reasons.
 * Macros are shown at meal and day level only where they are validated.
 * 
 * Examples:
 * - "4 oz chicken"
 * - "8 oz yams"
 * - "1 tbsp olive oil"
 */
export function formatIngredientWithGrams(
  amount: string | number,
  unit: string,
  item: string
): string {
  // Skip if no amount/unit
  if (!amount || !unit) {
    return `${amount || ''} ${unit || ''} ${item}`.trim();
  }
  
  // Return formatted ingredient without macro suffix
  return `${amount} ${unit} ${item}`;
}
