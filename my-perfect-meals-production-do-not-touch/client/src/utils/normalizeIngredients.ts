
/**
 * Universal Ingredient Parser & Normalizer
 * 
 * Standardizes all ingredient formats across the app to:
 * { name: string; quantity: number; unit: string; notes?: string }
 */

// ========== UNIT NORMALIZATION MAP ==========
const UNIT_MAP: Record<string, string> = {
  // Volume
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'tsp': 'tsp',
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'tbsp': 'tbsp',
  'cup': 'cup',
  'cups': 'cup',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl oz': 'fl oz',
  'pint': 'pint',
  'pints': 'pint',
  'quart': 'quart',
  'quarts': 'quart',
  'gallon': 'gallon',
  'gallons': 'gallon',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'ml': 'ml',
  'liter': 'l',
  'liters': 'l',
  'l': 'l',

  // Weight
  'ounce': 'oz',
  'ounces': 'oz',
  'oz': 'oz',
  'pound': 'lb',
  'pounds': 'lb',
  'lb': 'lb',
  'lbs': 'lb',
  'gram': 'g',
  'grams': 'g',
  'g': 'g',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'kg': 'kg',

  // Count
  'piece': 'piece',
  'pieces': 'piece',
  'whole': 'whole',
  'clove': 'clove',
  'cloves': 'clove',
  'slice': 'slice',
  'slices': 'slice',
  'can': 'can',
  'cans': 'can',
  'jar': 'jar',
  'jars': 'jar',
  'packet': 'packet',
  'packets': 'packet',
  'bunch': 'bunch',
  'bunches': 'bunch',
  'head': 'head',
  'heads': 'head',

  // Special
  'pinch': 'pinch',
  'dash': 'dash',
  'to taste': 'to taste',
};

// ========== FRACTION MAP ==========
const FRACTION_MAP: Record<string, number> = {
  '½': 0.5,
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 0.167,
  '⅚': 0.833,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

// ========== DESCRIPTORS TO EXTRACT ==========
const DESCRIPTORS = [
  'diced', 'chopped', 'minced', 'sliced', 'grated', 'shredded',
  'fresh', 'dried', 'frozen', 'cooked', 'raw', 'canned',
  'boneless', 'skinless', 'whole', 'halved', 'quartered',
  'peeled', 'unpeeled', 'trimmed', 'large', 'medium', 'small',
  'ripe', 'optional', 'to taste', 'or to taste',
];

/**
 * Parse quantity string to number
 * Handles: "1", "1/2", "1 1/2", "½", "1.5", "2 cups"
 */
export function parseQuantity(qtyStr: string | number | undefined): number {
  if (qtyStr === undefined || qtyStr === null || qtyStr === '') return 1;
  if (typeof qtyStr === 'number') return qtyStr;

  const str = String(qtyStr).trim().toLowerCase();

  // Handle unicode fractions first
  for (const [symbol, value] of Object.entries(FRACTION_MAP)) {
    if (str.includes(symbol)) {
      const rest = str.replace(symbol, '').trim();
      const whole = rest ? parseFloat(rest) : 0;
      return !isNaN(whole) ? whole + value : value;
    }
  }

  // Handle "1 1/2" or "1/2" formats
  if (str.includes('/')) {
    const parts = str.split(/\s+/);
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, denom] = part.split('/').map(Number);
        if (num && denom) total += num / denom;
      } else {
        const n = parseFloat(part);
        if (!isNaN(n)) total += n;
      }
    }
    return total > 0 ? total : 1;
  }

  // Handle regular number
  const num = parseFloat(str.replace(/,/g, ''));
  return !isNaN(num) && num > 0 ? num : 1;
}

/**
 * Normalize unit string
 */
export function normalizeUnit(unit: string | undefined): string {
  if (!unit) return '';
  const normalized = unit.trim().toLowerCase();
  return UNIT_MAP[normalized] || normalized;
}

/**
 * Extract descriptors from ingredient name
 * Returns: { name: string; notes: string }
 */
export function extractDescriptors(name: string): { name: string; notes: string } {
  let cleanName = name.trim();
  const foundDescriptors: string[] = [];

  // Extract parenthetical notes first
  const parenMatch = cleanName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    foundDescriptors.push(parenMatch[1]);
    cleanName = cleanName.replace(/\([^)]+\)/g, '').trim();
  }

  // Extract known descriptors
  for (const descriptor of DESCRIPTORS) {
    const regex = new RegExp(`\\b${descriptor}\\b`, 'gi');
    if (regex.test(cleanName)) {
      foundDescriptors.push(descriptor);
      cleanName = cleanName.replace(regex, '').trim();
    }
  }

  // Clean up multiple spaces
  cleanName = cleanName.replace(/\s{2,}/g, ' ').trim();

  return {
    name: cleanName,
    notes: foundDescriptors.join(', '),
  };
}

/**
 * Parse ingredient from various formats into standardized format
 */
export function normalizeIngredient(ing: any): {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
} {
  // Handle string format: "2 cups flour"
  if (typeof ing === 'string') {
    const match = ing.match(/^([0-9.,½¼¾⅓⅔⅛⅜⅝⅞\/\s]+)?\s*([a-z]+)?\s*(.+)?$/i);
    if (!match) {
      return { name: ing.trim(), quantity: 1, unit: '' };
    }

    const [, qtyPart, unitPart, namePart] = match;
    const quantity = parseQuantity(qtyPart);
    const unit = normalizeUnit(unitPart);
    const { name, notes } = extractDescriptors(namePart || ing);

    return {
      name,
      quantity,
      unit,
      ...(notes && { notes }),
    };
  }

  // Handle object formats
  const rawName = ing.item || ing.name || String(ing);
  const rawQty = ing.qty || ing.quantity || ing.amount || ing.amountOz || 1;
  const rawUnit = ing.unit || '';

  // If amount is a string like "2 cups", parse it
  if (typeof rawQty === 'string' && rawQty.includes(' ')) {
    const parsed = normalizeIngredient(rawQty);
    const { name, notes } = extractDescriptors(rawName);
    return {
      name,
      quantity: parsed.quantity,
      unit: rawUnit || parsed.unit,
      ...(notes || ing.notes ? { notes: [notes, ing.notes].filter(Boolean).join('; ') } : {}),
    };
  }

  const { name, notes } = extractDescriptors(rawName);
  return {
    name,
    quantity: parseQuantity(rawQty),
    unit: normalizeUnit(rawUnit),
    ...(notes || ing.notes ? { notes: [notes, ing.notes].filter(Boolean).join('; ') } : {}),
  };
}

/**
 * Normalize array of ingredients
 */
export function normalizeIngredients(ingredients: any[]): Array<{
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}> {
  return ingredients
    .map(normalizeIngredient)
    .filter(ing => ing.name && ing.name.trim());
}
