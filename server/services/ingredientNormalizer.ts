// server/services/ingredientNormalizer.ts
// Normalizes AI-generated ingredients to the unified U.S. measurement contract
// Converts metric units, strips macros, validates format
// Layer 3 of the ingredient precision system — fixes borderline cases before display

import { Ingredient, LegacyIngredient, US_SOLID_UNITS } from '@shared/types';

const METRIC_TO_US: Record<string, { factor: number; unit: string }> = {
  'g': { factor: 0.035274, unit: 'oz' },
  'gram': { factor: 0.035274, unit: 'oz' },
  'grams': { factor: 0.035274, unit: 'oz' },
  'kg': { factor: 2.20462, unit: 'lb' },
  'kilogram': { factor: 2.20462, unit: 'lb' },
  'ml': { factor: 0.033814, unit: 'fl oz' },
  'milliliter': { factor: 0.033814, unit: 'fl oz' },
  'milliliters': { factor: 0.033814, unit: 'fl oz' },
  'l': { factor: 4.22675, unit: 'cup' },
  'liter': { factor: 4.22675, unit: 'cup' },
  'liters': { factor: 4.22675, unit: 'cup' },
};

const PROTEIN_INGREDIENTS = [
  'chicken', 'beef', 'steak', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
  'turkey', 'lamb', 'duck', 'bacon', 'sausage', 'ham', 'tilapia', 'cod',
  'halibut', 'ribeye', 'sirloin', 'filet', 'tenderloin', 'brisket',
  'thigh', 'breast', 'drumstick', 'wing', 'ground beef', 'ground turkey'
];

const DAIRY_INGREDIENTS = [
  'yogurt', 'milk', 'cheese', 'cream', 'butter', 'sour cream', 'cottage cheese'
];

// Protein powder / supplement powder keywords — these MUST stay in scoops, not weight
const PROTEIN_POWDER_PATTERN = /\b(protein\s+powder|whey\s+protein|casein\s+protein|plant[- ]based\s+protein|vegan\s+protein|pea\s+protein|soy\s+protein|rice\s+protein|collagen\s+powder|collagen\s+peptides|pre[- ]workout|creatine|bcaa|mass\s+gainer|weight\s+gainer|supplement\s+powder|protein\s+shake\s+powder)\b/i;

// Egg keywords (name-based detection)
const EGG_PATTERN = /\begg(s)?\b/i;
const EGG_SIZE_PATTERN = /\b(large|medium|small|jumbo|extra-large|xl)\b/i;

// Potato/yam keywords
const POTATO_PATTERN = /\b(potato|potatoes|yam|yams|sweet potato|sweet potatoes)\b/i;

// Onion / shallot / aromatic keywords — convert size-described counts to cup
const ONION_PATTERN = /\b(onion|onions|shallot|shallots|leek|leeks)\b/i;

// Garlic
const GARLIC_PATTERN = /\bgarlic\b/i;

// Bell pepper / whole vegetable that stays whole (stuffed context)
const WHOLE_VEG_PATTERN = /\b(bell pepper|bell peppers|pepper|peppers)\b/i;

// Size qualifier words — strip these from unit field
const SIZE_UNIT_PATTERN = /^(medium|large|small|whole)$/i;

// Vague unit set
const VAGUE_UNITS = new Set(['serving', 'servings', 'handful', 'handfuls']);

function isProteinPowder(name: string): boolean {
  return PROTEIN_POWDER_PATTERN.test(name);
}

function isProtein(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTEIN_INGREDIENTS.some(p => lower.includes(p));
}

function isDairy(name: string): boolean {
  const lower = name.toLowerCase();
  return DAIRY_INGREDIENTS.some(d => lower.includes(d));
}

function isEgg(name: string): boolean {
  return EGG_PATTERN.test(name);
}

function isPotato(name: string): boolean {
  return POTATO_PATTERN.test(name);
}

function hasEggSize(name: string): boolean {
  return EGG_SIZE_PATTERN.test(name);
}

function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 2) {
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
    }
    return parseFloat(value) || 0;
  }
  return 0;
}

function formatAmount(num: number): string {
  if (num === 0) return '0';
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.33: '1/3',
    0.5: '1/2',
    0.67: '2/3',
    0.75: '3/4',
  };
  const whole = Math.floor(num);
  const decimal = num - whole;
  const roundedDecimal = Math.round(decimal * 100) / 100;
  
  for (const [key, frac] of Object.entries(fractions)) {
    if (Math.abs(roundedDecimal - parseFloat(key)) < 0.05) {
      return whole > 0 ? `${whole} ${frac}` : frac;
    }
  }
  
  if (decimal === 0) return whole.toString();
  return num.toFixed(1).replace(/\.0$/, '');
}

// Reference scoop size for weight→scoop fallback (grams). Scoop sizes vary widely by brand
// (typically 25–42g for whey, 28–50g for vegan blends). We use 30g as a conservative
// midpoint. This fallback only runs when the AI ignored the prompt rule; the prompt itself
// is the primary enforcement mechanism.
const REFERENCE_SCOOP_GRAMS = 30;

function weightToScoops(grams: number): string {
  const scoops = Math.round((grams / REFERENCE_SCOOP_GRAMS) * 2) / 2; // round to nearest 0.5
  if (scoops <= 0.5) return '1/2';
  if (scoops === 1.5) return '1 1/2';
  return String(Math.round(scoops));
}

function convertUnit(amount: number, unit: string, ingredientName: string): { amount: string; unit: string } {
  const lowerUnit = unit.toLowerCase().trim();

  // ── Protein powder / supplement powder: always preserve scoops ────────────
  // The AI prompt instructs scoop usage, but this is a post-generation safety net
  // in case the AI returned a weight unit anyway. We convert weight → scoop count
  // using a reference scoop size with a note that users should adjust to their brand.
  if (isProteinPowder(ingredientName)) {
    // Already in scoops — pass through unchanged
    if (lowerUnit === 'scoop' || lowerUnit === 'scoops') {
      return { amount: formatAmount(amount), unit: amount === 1 ? 'scoop' : 'scoops' };
    }
    // Weight units: convert to approximate scoop count
    let grams = amount;
    if (lowerUnit === 'oz' || lowerUnit === 'ounce' || lowerUnit === 'ounces') grams = amount * 28.3495;
    else if (lowerUnit === 'lb' || lowerUnit === 'lbs') grams = amount * 453.592;
    else if (lowerUnit === 'kg') grams = amount * 1000;
    // g / grams: already in grams
    const scoopAmount = weightToScoops(grams);
    const scoopCount = parseFloat(scoopAmount.replace(' 1/2', '.5').replace('1/2', '0.5'));
    return { amount: scoopAmount, unit: scoopCount === 1 ? 'scoop' : 'scoops' };
  }

  if (METRIC_TO_US[lowerUnit]) {
    const conversion = METRIC_TO_US[lowerUnit];
    let convertedAmount = amount * conversion.factor;
    let targetUnit = conversion.unit;
    
    if (isProtein(ingredientName)) {
      targetUnit = 'oz';
      if (lowerUnit === 'g' || lowerUnit === 'gram' || lowerUnit === 'grams') {
        convertedAmount = amount * 0.035274;
      }
      if (convertedAmount >= 16) {
        convertedAmount = convertedAmount / 16;
        targetUnit = 'lb';
      }
    } else if (isDairy(ingredientName) && convertedAmount > 8) {
      convertedAmount = convertedAmount / 8;
      targetUnit = 'cup';
    }
    
    return { amount: formatAmount(convertedAmount), unit: targetUnit };
  }
  
  // "piece"/"pieces" — convert to oz for proteins, estimate for others
  if (lowerUnit === 'piece' || lowerUnit === 'pieces') {
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    if (isPotato(ingredientName)) {
      // 1 medium potato ≈ 5 oz
      return { amount: formatAmount(amount * 5), unit: 'oz' };
    }
    // Generic non-protein solid: treat as ~4 oz per piece
    return { amount: formatAmount(amount * 4), unit: 'oz' };
  }

  // "unit"/"units" — forbidden by prompt rules; treat same as "each"
  if (lowerUnit === 'unit' || lowerUnit === 'units') {
    if (GARLIC_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'cloves' };
    }
    if (ONION_PATTERN.test(ingredientName)) {
      // 1 medium onion ≈ 0.5 cup diced
      return { amount: formatAmount(amount * 0.5), unit: 'cup' };
    }
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    if (isPotato(ingredientName)) {
      return { amount: formatAmount(amount * 5), unit: 'oz' };
    }
    if (WHOLE_VEG_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'whole' };
    }
    return { amount: formatAmount(amount), unit: 'each' };
  }

  // "medium"/"large"/"small"/"whole" as the unit field — size descriptor leaked into unit
  if (SIZE_UNIT_PATTERN.test(lowerUnit)) {
    if (GARLIC_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'cloves' };
    }
    if (ONION_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount * 0.5), unit: 'cup' };
    }
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    if (isPotato(ingredientName)) {
      return { amount: formatAmount(amount * 5), unit: 'oz' };
    }
    if (WHOLE_VEG_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'whole' };
    }
    return { amount: formatAmount(amount), unit: 'each' };
  }

  // "each" — route by ingredient type
  if (lowerUnit === 'each') {
    if (GARLIC_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'cloves' };
    }
    if (ONION_PATTERN.test(ingredientName)) {
      // 1 medium onion ≈ 0.5 cup diced
      return { amount: formatAmount(amount * 0.5), unit: 'cup' };
    }
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    if (isPotato(ingredientName)) {
      // 1 medium potato ≈ 5 oz
      return { amount: formatAmount(amount * 5), unit: 'oz' };
    }
    if (WHOLE_VEG_PATTERN.test(ingredientName)) {
      return { amount: formatAmount(amount), unit: 'whole' };
    }
    return { amount: formatAmount(amount), unit: 'each' };
  }

  // "serving"/"servings" — convert to approximate oz
  if (VAGUE_UNITS.has(lowerUnit)) {
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    // Generic: ~4 oz per serving
    return { amount: formatAmount(amount * 4), unit: 'oz' };
  }

  // "handful"/"handfuls" → ~1 oz per handful
  if (lowerUnit === 'handful' || lowerUnit === 'handfuls') {
    return { amount: formatAmount(amount), unit: 'oz' };
  }
  
  const validUnits = ['oz', 'lb', 'cup', 'cups', 'tbsp', 'tsp', 'fl oz', 'cloves', 'whole'];
  if (validUnits.includes(lowerUnit) || lowerUnit === 'tablespoon' || lowerUnit === 'teaspoon') {
    let normalizedUnit = lowerUnit;
    if (lowerUnit === 'cups') normalizedUnit = 'cup';
    if (lowerUnit === 'tablespoon' || lowerUnit === 'tablespoons') normalizedUnit = 'tbsp';
    if (lowerUnit === 'teaspoon' || lowerUnit === 'teaspoons') normalizedUnit = 'tsp';
    return { amount: formatAmount(amount), unit: normalizedUnit };
  }
  
  return { amount: formatAmount(amount), unit: lowerUnit };
}

// Size words that should be stripped from ingredient names
const NAME_SIZE_PREFIX = /\b(medium|large|small|extra large|xl)\s+/gi;

/**
 * Layer 3 failsafe: normalize ingredient name for precision.
 * - Eggs missing size qualifier → prefix "large" to name
 * - Potatoes with "each" or no weight unit → handled in convertUnit
 * - Size words in name (e.g. "medium yellow onion") → stripped to "yellow onion"
 */
function normalizeName(name: string, unit: string): string {
  // Eggs: if name has no size qualifier, add "large" as default
  if (isEgg(name) && !hasEggSize(name)) {
    return name.replace(EGG_PATTERN, (match) =>
      match.toLowerCase().startsWith('eggs') || match.endsWith('s')
        ? 'large eggs'
        : 'large egg'
    );
  }

  // Strip leading size descriptors from non-egg ingredients
  // "medium yellow onion" → "yellow onion", "large garlic cloves" → "garlic cloves"
  if (!isEgg(name)) {
    const stripped = name.replace(NAME_SIZE_PREFIX, '').trim();
    if (stripped && stripped !== name) {
      return stripped;
    }
  }

  return name;
}

export function normalizeIngredient(raw: any): Ingredient {
  const rawName = String(raw.name || raw.item || '').trim();
  const rawAmount = raw.amount ?? raw.quantity ?? 1;
  const rawUnit = String(raw.unit || 'oz').trim();
  const prep = raw.preparationNote || raw.notes || undefined;
  
  const numericAmount = parseAmount(rawAmount);
  const converted = convertUnit(numericAmount, rawUnit, rawName);
  const normalizedName = normalizeName(rawName, rawUnit);
  
  const result: Ingredient = {
    name: normalizedName,
    amount: converted.amount,
    unit: converted.unit,
  };
  
  if (prep && typeof prep === 'string' && prep.trim()) {
    result.preparationNote = prep.trim();
  }
  
  return result;
}

export function normalizeIngredients(rawIngredients: any[]): Ingredient[] {
  if (!Array.isArray(rawIngredients)) return [];
  return rawIngredients.map(normalizeIngredient).filter(i => i.name);
}

export function formatIngredientForDisplay(ingredient: Ingredient): string {
  const parts = [ingredient.amount, ingredient.unit, ingredient.name];
  if (ingredient.preparationNote) {
    parts.push(`(${ingredient.preparationNote})`);
  }
  return parts.join(' ');
}

export function ingredientsToStringArray(ingredients: Ingredient[]): string[] {
  return ingredients.map(formatIngredientForDisplay);
}
