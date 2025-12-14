// Robust ingredient parsing utility for shopping list system

export type ParsedIngredient = {
  name: string;
  qty?: number | string;
  unit?: string;
};

// Parse quantity from various formats: "2", "1/2", "½", "1.5", "2 1/2"
export function parseQuantity(qtyStr: string | number | undefined): number | undefined {
  if (qtyStr === undefined || qtyStr === null || qtyStr === '') return undefined;
  
  // Already a number
  if (typeof qtyStr === 'number') return qtyStr;
  
  const str = String(qtyStr).trim().toLowerCase();
  
  // Handle fractions: "1/2", "1/4", "3/4"
  if (str.includes('/')) {
    const parts = str.split(/\s+/); // Handle "1 1/2" format
    let total = 0;
    
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, denom] = part.split('/').map(Number);
        if (num && denom) total += num / denom;
      } else {
        const n = Number(part);
        if (!isNaN(n)) total += n;
      }
    }
    
    return total > 0 ? total : undefined;
  }
  
  // Handle unicode fractions: "½", "¼", "¾", "⅓", "⅔", "⅛"
  const fractionMap: Record<string, number> = {
    '½': 0.5, '¼': 0.25, '¾': 0.75,
    '⅓': 0.333, '⅔': 0.667, '⅛': 0.125,
    '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };
  
  for (const [frac, val] of Object.entries(fractionMap)) {
    if (str.includes(frac)) {
      const rest = str.replace(frac, '').trim();
      const whole = rest ? Number(rest) : 0;
      return !isNaN(whole) ? whole + val : val;
    }
  }
  
  // Regular number
  const num = parseFloat(str.replace(/,/g, ''));
  return !isNaN(num) ? num : undefined;
}

// Parse ingredient from string format: "2 cups flour", "1 lb chicken breast"
export function parseIngredientString(ingredientStr: string): ParsedIngredient {
  const str = ingredientStr.trim();
  
  // Try to extract quantity and unit from start of string
  const match = str.match(/^([0-9.,½¼¾⅓⅔⅛⅜⅝⅞\/\s]+)?\s*([a-z]+)?\s*(.+)?$/i);
  
  if (!match) {
    return { name: str };
  }
  
  const [, qtyPart, unitPart, namePart] = match;
  
  const qty = parseQuantity(qtyPart);
  const unit = unitPart?.trim();
  const name = namePart?.trim() || (unitPart && !namePart ? str : str);
  
  return {
    name: name || str,
    qty,
    unit
  };
}

// Parse ingredient from object formats used across meal builders
export function parseIngredientObject(ing: any): ParsedIngredient {
  // Handle object with { item, amount, unit } or { item, amountOz, unit }
  if (typeof ing === 'object') {
    const name = ing.item || ing.name || String(ing);
    const qtyRaw = ing.qty || ing.amount || ing.amountOz || ing.quantity;
    
    // If amount is a string like "2 cups", parse it
    if (typeof qtyRaw === 'string' && qtyRaw.includes(' ')) {
      const parsed = parseIngredientString(qtyRaw);
      return {
        name,
        qty: parsed.qty,
        unit: ing.unit || parsed.unit
      };
    }
    
    return {
      name,
      qty: parseQuantity(qtyRaw),
      unit: ing.unit
    };
  }
  
  // Handle string format
  if (typeof ing === 'string') {
    return parseIngredientString(ing);
  }
  
  return { name: String(ing) };
}

// Convert multiple ingredient formats to normalized shopping list format
export function normalizeIngredients(ingredients: any[]): ParsedIngredient[] {
  return ingredients.map(parseIngredientObject).filter(ing => ing.name && ing.name.trim());
}
