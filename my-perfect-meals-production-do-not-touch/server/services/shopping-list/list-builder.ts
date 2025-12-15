// server/services/shopping-list/list-builder.ts
import { isPantryItem } from './pantry';
import { canonicalName } from './normalizer';
import { convertToPreferred } from './unit-converter';

type Ingredient = { item: string; amount: string }; // from your Meal type
type Meal = {
  title: string;
  ingredients: Ingredient[];
  entryType?: 'quick' | 'recipe';
  includeInShoppingList?: boolean;
  voided?: boolean;   // marked "not used"
  voidNote?: string;  // e.g., "Replaced on 2025-09-09"
};
type WeekBoard = {
  lists: { breakfast: Meal[]; lunch: Meal[]; dinner: Meal[]; snacks: Meal[] };
};

type Qty = { amount: number; unit?: string };
type GroceryRow = { name: string; qty?: Qty };

export type ShoppingList = {
  pantry: string[];                 // list once, no amounts
  groceries: Array<{ name: string; quantity?: string; unit?: string; amount?: string }>; // user-facing with separate quantity/unit
};

// Robust parser: handles fractions, decimals, mixed numbers, and units
function parseAmount(raw: string): Qty & { rest: string } {
  const s = (raw || '').trim();
  if (!s) return { amount: 0, unit: undefined, rest: '' };
  
  // Helper: convert fraction string to decimal
  const parseFraction = (frac: string): number => {
    const parts = frac.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den !== 0 && !isNaN(num) && !isNaN(den)) return num / den;
    }
    return NaN;
  };
  
  // Pattern 1: Mixed number with fraction "1 1/2 cups" → 1.5
  let m = s.match(/^(\d+)\s+(\d+\/\d+)\s*([a-zA-Z]+)?\b(.*)$/);
  if (m) {
    const whole = parseInt(m[1]);
    const fracValue = parseFraction(m[2]);
    if (!isNaN(whole) && !isNaN(fracValue)) {
      const amount = whole + fracValue;
      const unit = m[3] || undefined;
      const rest = (m[4] || '').trim();
      return { amount, unit, rest };
    }
  }
  
  // Pattern 2: Just a fraction "3/4 cup" → 0.75
  m = s.match(/^(\d+\/\d+)\s*([a-zA-Z]+)?\b(.*)$/);
  if (m) {
    const fracValue = parseFraction(m[1]);
    if (!isNaN(fracValue)) {
      const amount = fracValue;
      const unit = m[2] || undefined;
      const rest = (m[3] || '').trim();
      return { amount, unit, rest };
    }
  }
  
  // Pattern 3: Decimal or whole number "1.5 cups" or "3 cups" or "16 oz"
  m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\b(.*)$/);
  if (m) {
    const amount = parseFloat(m[1]);
    const unit = m[2] || undefined;
    const rest = (m[3] || '').trim();
    if (!isNaN(amount)) {
      return { amount, unit, rest };
    }
  }
  
  // No parseable amount found
  return { amount: 0, unit: undefined, rest: s };
}

export function buildShoppingList(week: WeekBoard, excludedItems?: string[]): ShoppingList {
  const pantrySet = new Set<string>();
  // name → aggregated Qty[] (we keep separate buckets for different units)
  const buckets: Record<string, GroceryRow[]> = {};
  const excluded = new Set(excludedItems || []);

  const allMeals: Array<Meal & { _list: 'breakfast'|'lunch'|'dinner'|'snacks' }> = [
    ...week.lists.breakfast.map(m => ({ ...m, _list: 'breakfast' as const })),
    ...week.lists.lunch.map(m => ({ ...m, _list: 'lunch' as const })),
    ...week.lists.dinner.map(m => ({ ...m, _list: 'dinner' as const })),
    ...week.lists.snacks.map(m => ({ ...m, _list: 'snacks' as const })),
  ];

  // Filter out voided meals before aggregating ingredients
  const activeMeals = allMeals.filter(m => !m?.voided);

  for (const meal of activeMeals) {
    // Skip most quick snacks unless explicitly marked for shopping list
    if (meal.entryType === 'quick' && meal.includeInShoppingList !== true) {
      continue;
    }
    
    for (const ing of (meal.ingredients || [])) {
      const nameCanon = canonicalName(ing.item);
      
      // Check if this pantry item is excluded
      if (isPantryItem(nameCanon)) {
        const pantryKey = `pantry||${nameCanon}`;
        if (!excluded.has(pantryKey)) {
          pantrySet.add(nameCanon);
        }
        continue;
      }

      const parsed = parseAmount(ing.amount);
      // If we can’t parse a numeric amount, just store as text (no aggregation)
      if (!parsed.amount || Number.isNaN(parsed.amount) || parsed.amount <= 0) {
        if (!buckets[nameCanon]) buckets[nameCanon] = [];
        buckets[nameCanon].push({ name: nameCanon, qty: undefined });
        continue;
      }

      // Convert to preferred units (e.g., 16 oz → 1 lb)
      const converted = convertToPreferred(nameCanon, parsed.amount, parsed.unit || '');
      const qty = { amount: converted.quantity, unit: converted.unit };

      // Try to aggregate into an existing same-unit bucket for this item
      if (!buckets[nameCanon]) buckets[nameCanon] = [];
      const existingIdx = buckets[nameCanon].findIndex(r => r.qty && (r.qty.unit || '') === (qty.unit || ''));
      if (existingIdx >= 0 && buckets[nameCanon][existingIdx].qty) {
        const mergedAmount = (buckets[nameCanon][existingIdx].qty?.amount || 0) + (qty.amount || 0);
        const mergedUnit = qty.unit || buckets[nameCanon][existingIdx].qty?.unit || '';
        const convertedMerged = convertToPreferred(nameCanon, mergedAmount, mergedUnit);
        buckets[nameCanon][existingIdx].qty = { amount: convertedMerged.quantity, unit: convertedMerged.unit };
      } else {
        buckets[nameCanon].push({ name: nameCanon, qty });
      }
    }
  }

  // Flatten buckets to user-facing format with separate quantity and unit, filtering out excluded items
  const groceries: Array<{ name: string; quantity?: string; unit?: string; amount?: string }> = [];
  for (const [name, rows] of Object.entries(buckets)) {
    for (const r of rows) {
      const amount = !r.qty ? undefined : 
        r.qty.unit ? `${(Math.round(r.qty.amount * 100) / 100)} ${r.qty.unit}` : 
        (Math.round(r.qty.amount * 100) / 100).toString();
      
      // Check if this grocery item is excluded
      const groceryKey = `groceries||${name}||${amount ?? ''}`;
      if (!excluded.has(groceryKey)) {
        if (!r.qty) {
          groceries.push({ name, quantity: undefined, unit: undefined, amount: undefined });
        } else {
          const qty = (Math.round(r.qty.amount * 100) / 100).toString(); // 2 decimals max
          groceries.push({ 
            name, 
            quantity: qty,
            unit: r.qty.unit || undefined,
            amount: r.qty.unit ? `${qty} ${r.qty.unit}` : qty  // Keep for backward compatibility
          });
        }
      }
    }
  }

  // Deduplicate pantry, turn into sorted array
  const pantry = Array.from(pantrySet).sort((a, b) => a.localeCompare(b));

  // Optional: sort groceries alpha by name
  groceries.sort((a, b) => a.name.localeCompare(b.name));

  return { pantry, groceries };
}
