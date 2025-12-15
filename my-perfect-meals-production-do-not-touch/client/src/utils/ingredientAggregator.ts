/**
 * Ingredient Aggregation Utility
 * 
 * Aggregates ingredients from multiple meals into a consolidated shopping list.
 * Handles quantity parsing, unit conversion, and duplicate ingredient grouping.
 */

export type ParsedIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  originalText: string;
};

export type AggregatedIngredient = {
  name: string;
  totalQuantity: number | null;
  unit: string | null;
  occurrences: number;
  displayText: string;
  stableKey: string; // Stable identifier for checkbox persistence
  checked: boolean;
};

/**
 * Normalize units to handle plural/singular and common aliases
 * Maps variations to canonical forms
 */
function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  
  const normalized = unit.toLowerCase().trim();
  
  // Unit aliases map - maps variations to canonical form
  const unitAliases: Record<string, string> = {
    // Volume
    'cup': 'cup',
    'cups': 'cup',
    'c': 'cup',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tbsp': 'tbsp',
    'tbs': 'tbsp',
    'tb': 'tbsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'tsp': 'tsp',
    'fluid ounce': 'fl oz',
    'fluid ounces': 'fl oz',
    'fl oz': 'fl oz',
    'floz': 'fl oz',
    'pint': 'pint',
    'pints': 'pint',
    'pt': 'pint',
    'quart': 'quart',
    'quarts': 'quart',
    'qt': 'quart',
    'gallon': 'gallon',
    'gallons': 'gallon',
    'gal': 'gallon',
    'liter': 'liter',
    'liters': 'liter',
    'l': 'liter',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'ml': 'ml',
    
    // Weight
    'pound': 'lb',
    'pounds': 'lb',
    'lb': 'lb',
    'lbs': 'lb',
    'ounce': 'oz',
    'ounces': 'oz',
    'oz': 'oz',
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
    'can': 'can',
    'cans': 'can',
    'jar': 'jar',
    'jars': 'jar',
    'package': 'pkg',
    'packages': 'pkg',
    'pkg': 'pkg',
    'slice': 'slice',
    'slices': 'slice',
  };
  
  return unitAliases[normalized] || normalized;
}

/**
 * Parse a quantity string that may include fractions or mixed numbers
 * Examples: "2", "1/2", "1.5", "1 1/2" → numeric value
 */
function parseQuantityString(qtyStr: string): number | null {
  if (!qtyStr || typeof qtyStr !== "string") {
    return null;
  }

  const trimmed = qtyStr.trim();
  
  // Handle mixed numbers like "1 1/2" or "2 1/4"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const [, whole, num, denom] = mixedMatch.map(Number);
    return whole + (num / denom);
  }
  
  // Handle simple fractions like "1/2" or "3/4"
  if (trimmed.includes("/")) {
    const [num, denom] = trimmed.split("/").map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return num / denom;
    }
    return null;
  }
  
  // Handle decimal numbers like "1.5" or "2.25"
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Parse an ingredient string or object into structured data
 * Handles both string format ("2 cups rice") and object format ({ quantity: "2", unit: "cups", name: "rice" })
 */
export function parseIngredient(ingredient: any): ParsedIngredient {
  let text = "";
  let parsedQuantity: number | null = null;
  let parsedUnit: string | null = null;
  let parsedName = "";
  
  // Handle object formats with structured fields
  if (ingredient && typeof ingredient === "object") {
    // Format: { quantity, unit, name } or { amount, unit, ingredient }
    const qty = ingredient.quantity || ingredient.amount;
    const unit = ingredient.unit;
    const name = ingredient.name || ingredient.ingredient;
    
    if (qty !== undefined && qty !== null && qty !== "") {
      // Handle numeric values and string fractions/mixed numbers
      if (typeof qty === "string") {
        parsedQuantity = parseQuantityString(qty);
      } else if (typeof qty === "number") {
        parsedQuantity = isNaN(qty) ? null : qty;
      }
    }
    
    if (unit && typeof unit === "string") {
      parsedUnit = normalizeUnit(unit);
    }
    
    if (name && typeof name === "string") {
      parsedName = name.trim();
    }
    
    // Build text representation
    text = [qty, unit, name].filter(Boolean).join(" ").trim();
    
    if (parsedName) {
      return {
        name: parsedName,
        quantity: parsedQuantity,
        unit: parsedUnit,
        originalText: text || parsedName,
      };
    }
  }
  
  // Handle string format
  if (typeof ingredient === "string") {
    text = ingredient;
  } else if (!text) {
    text = String(ingredient || "");
  }

  text = text.trim();
  if (!text) {
    return { name: "", quantity: null, unit: null, originalText: "" };
  }

  // Regex to match quantity + unit + name
  // Updated to handle multi-word units (e.g., "fl oz", "fluid ounce")
  // Matches: "2 cups rice", "1.5 lb chicken", "1/2 cup milk", "8 fl oz water"
  const regex = /^([\d.\/\s]+?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(.+)$/;
  const match = text.match(regex);

  if (match) {
    const [, qtyStr, unit, name] = match;
    const quantity = parseQuantityString(qtyStr);

    return {
      name: name.trim(),
      quantity,
      unit: normalizeUnit(unit.trim()) || null,
      originalText: text,
    };
  }

  // Try simpler pattern without unit (e.g., "3 eggs")
  const simpleMatch = text.match(/^([\d.\/\s]+?)\s+(.+)$/);
  if (simpleMatch) {
    const [, qtyStr, name] = simpleMatch;
    const quantity = parseQuantityString(qtyStr);
    
    return {
      name: name.trim(),
      quantity,
      unit: null,
      originalText: text,
    };
  }

  // No quantity/unit found - treat entire text as ingredient name
  return {
    name: text,
    quantity: null,
    unit: null,
    originalText: text,
  };
}

/**
 * Normalize ingredient name for grouping
 * Handles plural/singular, case differences, descriptor words
 */
function normalizeIngredientName(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  // Remove common descriptor words that don't matter for grouping
  const cleaned = normalized
    .replace(/\b(fresh|frozen|chopped|diced|minced|sliced|grated|shredded|raw|cooked|canned|dried|whole|ground)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Simple plural handling - remove trailing 's' or 'es'
  let singular = cleaned;
  if (singular.endsWith("ies")) {
    singular = singular.slice(0, -3) + "y"; // berries → berry
  } else if (singular.endsWith("oes")) {
    singular = singular.slice(0, -2); // tomatoes → tomato
  } else if (singular.endsWith("es") && singular.length > 4) {
    singular = singular.slice(0, -2); // peaches → peach
  } else if (singular.endsWith("s") && singular.length > 3 && !singular.endsWith("ss")) {
    singular = singular.slice(0, -1); // carrots → carrot (but not 'lettuce' → 'lettuc')
  }

  return singular;
}

/**
 * Create a stable key for ingredient persistence
 * Uses normalized name + canonical unit
 */
function createStableKey(name: string, unit: string | null): string {
  const normalizedName = normalizeIngredientName(name);
  const normalizedUnit = normalizeUnit(unit);
  return normalizedUnit ? `${normalizedName}::${normalizedUnit}` : normalizedName;
}

/**
 * Aggregate ingredients from multiple meals
 * Groups duplicates and sums quantities where possible
 */
export function aggregateIngredients(
  meals: Array<{ ingredients?: any[] }>
): AggregatedIngredient[] {
  const ingredientMap = new Map<string, AggregatedIngredient>();

  // Collect and parse all ingredients
  meals.forEach((meal) => {
    if (!meal.ingredients || !Array.isArray(meal.ingredients)) return;

    meal.ingredients.forEach((ing) => {
      const parsed = parseIngredient(ing);
      if (!parsed.name) return;

      const stableKey = createStableKey(parsed.name, parsed.unit);

      if (ingredientMap.has(stableKey)) {
        // Update existing ingredient
        const existing = ingredientMap.get(stableKey)!;
        existing.occurrences++;

        // Sum quantities if both have quantities (units already normalized and match via key)
        if (parsed.quantity !== null && existing.totalQuantity !== null) {
          existing.totalQuantity += parsed.quantity;
        } else if (parsed.quantity !== null && existing.totalQuantity === null) {
          // First occurrence with a quantity
          existing.totalQuantity = parsed.quantity;
        }
      } else {
        // New ingredient
        ingredientMap.set(stableKey, {
          name: parsed.name, // Use original name for display
          totalQuantity: parsed.quantity,
          unit: parsed.unit, // Already normalized
          occurrences: 1,
          displayText: formatIngredientDisplay(parsed.quantity, parsed.unit, parsed.name),
          stableKey,
          checked: false,
        });
      }
    });
  });

  // Convert map to array and update display text with aggregated quantities
  const results = Array.from(ingredientMap.values()).map((ing) => {
    ing.displayText = formatIngredientDisplay(ing.totalQuantity, ing.unit, ing.name);
    return ing;
  });

  // Sort alphabetically by name
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Format ingredient for display
 */
function formatIngredientDisplay(
  quantity: number | null,
  unit: string | null,
  name: string
): string {
  if (quantity === null) {
    return name;
  }

  // Format quantity nicely (avoid .00, show fractions for common values)
  let qtyStr: string;
  if (quantity % 1 === 0) {
    qtyStr = quantity.toString();
  } else if (quantity === 0.5) {
    qtyStr = "1/2";
  } else if (quantity === 0.25) {
    qtyStr = "1/4";
  } else if (quantity === 0.75) {
    qtyStr = "3/4";
  } else if (quantity === 0.33 || quantity === 0.333 || quantity === 0.3333) {
    qtyStr = "1/3";
  } else if (quantity === 0.67 || quantity === 0.666 || quantity === 0.6667) {
    qtyStr = "2/3";
  } else {
    qtyStr = quantity.toFixed(1).replace(/\.0$/, "");
  }

  if (unit) {
    return `${qtyStr} ${unit} ${name}`;
  }

  return `${qtyStr} ${name}`;
}
