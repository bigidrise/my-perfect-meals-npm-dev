
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
const PROTEIN_KEYWORDS = [
  'chicken', 'beef', 'steak', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
  'turkey', 'lamb', 'duck', 'bacon', 'sausage', 'ham', 'tilapia', 'cod',
  'halibut', 'ribeye', 'sirloin', 'filet', 'tenderloin', 'brisket',
  'thigh', 'breast', 'drumstick', 'wing', 'ground beef', 'ground turkey',
  'tofu', 'tempeh', 'seitan', 'lentil', 'chickpea',
];

function isProteinItem(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTEIN_KEYWORDS.some(p => lower.includes(p));
}

function formatAmount(num: number): string {
  if (num === 0) return '0';
  const fractions: Record<number, string> = {
    0.25: '1/4', 0.33: '1/3', 0.5: '1/2', 0.67: '2/3', 0.75: '3/4',
  };
  const whole = Math.floor(num);
  const decimal = num - whole;
  const rounded = Math.round(decimal * 100) / 100;
  for (const [key, frac] of Object.entries(fractions)) {
    if (Math.abs(rounded - parseFloat(key)) < 0.05) {
      return whole > 0 ? `${whole} ${frac}` : frac;
    }
  }
  if (decimal === 0) return whole.toString();
  return num.toFixed(1).replace(/\.0$/, '');
}

function convertMetricToUS(rawAmount: string | number, rawUnit: string, itemName: string): { amount: string; unit: string } {
  const lower = rawUnit.toLowerCase().trim();
  const num = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount)) || 0;

  if (lower === 'g' || lower === 'gram' || lower === 'grams') {
    const oz = num * 0.035274;
    if (oz >= 16) return { amount: formatAmount(oz / 16), unit: 'lb' };
    return { amount: formatAmount(oz), unit: 'oz' };
  }
  if (lower === 'kg' || lower === 'kilogram' || lower === 'kilograms') {
    const lb = num * 2.20462;
    return { amount: formatAmount(lb), unit: 'lb' };
  }
  if (lower === 'ml' || lower === 'milliliter' || lower === 'milliliters') {
    const floz = num * 0.033814;
    if (floz >= 8) return { amount: formatAmount(floz / 8), unit: 'cup' };
    return { amount: formatAmount(floz), unit: 'fl oz' };
  }
  if (lower === 'l' || lower === 'liter' || lower === 'liters') {
    return { amount: formatAmount(num * 4.22675), unit: 'cup' };
  }

  return { amount: typeof rawAmount === 'number' ? formatAmount(rawAmount) : String(rawAmount), unit: rawUnit };
}

export function formatIngredientWithGrams(
  amount: string | number,
  unit: string,
  item: string
): string {
  if (!amount || !unit) {
    return `${amount || ''} ${unit || ''} ${item}`.trim();
  }

  const { amount: displayAmount, unit: displayUnit } = convertMetricToUS(amount, unit, item);
  return `${displayAmount} ${displayUnit} ${item}`;
}
