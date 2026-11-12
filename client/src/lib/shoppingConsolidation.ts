/**
 * shoppingConsolidation.ts
 *
 * The grocery consolidation engine.
 *
 * Pipeline:
 *   raw ShoppingListItem[]
 *     → filter (remove checked + placeholders)
 *     → group by normalizedName
 *     → accumulate dimensional totals (grams / mL / count)
 *     → emit one ConsolidatedItem per unique ingredient
 *
 * The underlying store is never mutated. ConsolidatedItem extends
 * ShoppingListItem so it drops straight into getRetailQuantity().
 *
 * Unit-type mismatch handling:
 *   "71 g zucchini" + "½ cup zucchini"
 *   → totalGrams = 71, totalMl = 118
 *   → canonicalQty = 71 + 118 (mL treated as ≈ g for plant matter)
 *   → getRetailQuantity sees 189 g zucchini → produce → count estimate
 */

import type { ShoppingListItem } from '@/stores/shoppingListStore';
import type { IngredientCategory } from '@/data/ingredientCategories';
import { shoppingMetadataEnabled } from "@/lib/shoppingMetadataGate";
import { developmentShoppingGroups, mergeDevelopmentShoppingMetadata } from "@shared/developmentShoppingMerge";

// ── Unit conversion tables ────────────────────────────────────────────────────
// (Local copies to avoid circular imports with the store)

const WEIGHT_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  cup: 236.588, cups: 236.588,
  'fl oz': 29.574, 'fluid oz': 29.574, 'fluid ounce': 29.574,
  pt: 473.176, pint: 473.176, pints: 473.176,
  qt: 946.353, quart: 946.353, quarts: 946.353,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
};


function toGrams(qty: number, unit: string): number | null {
  const factor = WEIGHT_TO_G[unit.toLowerCase().trim()];
  return factor !== undefined ? qty * factor : null;
}

function toMl(qty: number, unit: string): number | null {
  const factor = VOLUME_TO_ML[unit.toLowerCase().trim()];
  return factor !== undefined ? qty * factor : null;
}


function quantityDimension(unit: string): string {
  const u = (unit || "").trim().toLowerCase();
  if (toGrams(1, u) !== null) return "weight";
  if (toMl(1, u) !== null) return "volume";
  if (["", "unit", "units", "piece", "pieces", "whole", "each", "count"].includes(u)) return "count";
  return `count:${u.replace(/s$/, "")}`;
}

// ── Placeholder filter ────────────────────────────────────────────────────────

const PLACEHOLDER_PATTERN =
  /^(scanned item|item|unknown item|grocery item|scan|ingredient|food item|add item|new item)$/i;

function isValidItem(item: ShoppingListItem): boolean {
  return (
    !!item.name &&
    item.name.trim().length > 1 &&
    !PLACEHOLDER_PATTERN.test(item.name.trim())
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A ShoppingListItem-compatible object that represents one merged group.
 * quantity/unit are set to the best canonical representation for
 * getRetailQuantity() in retailIntelligence.ts.
 */
export interface ConsolidatedItem extends ShoppingListItem {
  /** Exact stored requirements, before retail estimates or package rounding. */
  requiredAmounts: { quantity: number; unit: string }[];
  /** Number of original store rows merged into this consolidated item */
  mergedCount: number;
  /** All original store IDs (used for "opened" tracking in the modal) */
  allIds: string[];
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Consolidates ShoppingListItem[] into one item per unique ingredient.
 *
 * @param items      - Raw items from the store
 * @param options    - excludeChecked (default true)
 * @returns          - Deduplicated, consolidated items ready for retail display
 */
export function buildConsolidatedItems(
  items: ShoppingListItem[],
  options: { excludeChecked?: boolean } = {},
): ConsolidatedItem[] {
  const { excludeChecked = true } = options;

  // 1. Filter
  const filtered = items.filter(
    (i) => isValidItem(i) && (!excludeChecked || !i.isChecked),
  );

  // 2. Group by normalizedName (case-insensitive)
  const groups = new Map<string, ShoppingListItem[]>();
  for (const item of filtered) {
    // Production keeps selected recipe rows distinct; do not let a display
    // consolidation hide another ingredient's product or contribution.
    const identity = item.ingredientMetadata
      ? `selected:${item.id}`
      : (item.normalizedName || item.name).toLowerCase().trim();
    const key = `${identity}|${quantityDimension(item.unit)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  // 3. Consolidate each group into one ConsolidatedItem
  const result: ConsolidatedItem[] = [];

  const displayGroups = shoppingMetadataEnabled
    ? developmentShoppingGroups(filtered, (a, b) => {
      // Preserve legacy dimensional grouping for unrelated exact identities.
      return quantityDimension(a.unit) === quantityDimension(b.unit);
    })
    : [...groups.values()];
  for (const group of displayGroups) {
    // Canonical representative: longest name (most specific) or first
    const canonical = group.reduce(
      (best, cur) => (cur.name.length > best.name.length ? cur : best),
      group[0],
    );

    // Category: first non-Other wins; fall back to Other
    const category: IngredientCategory =
      group.find((i) => i.category !== 'Other')?.category ?? 'Other';

    // Accumulate dimensional totals
    let totalGrams = 0;
    let totalMl = 0;
    let totalCount = 0;
    let hasGrams = false;
    let hasMl = false;

    for (const item of group) {
      const qty = item.quantity ?? 0;
      if (qty <= 0) continue;
      const unit = item.unit ?? '';

      const g = toGrams(qty, unit);
      if (g !== null) {
        totalGrams += g;
        hasGrams = true;
        continue;
      }

      const ml = toMl(qty, unit);
      if (ml !== null) {
        totalMl += ml;
        hasMl = true;
        continue;
      }

      totalCount += qty;
    }

    // Choose canonical quantity/unit for getRetailQuantity.
    // Priority: weight > volume > count.
    // Different dimensions remain separate unless a food-specific conversion
    // exists. Never add mL to grams or multiply these totals by servings.
    let canonicalQty: number;
    let canonicalUnit: string;

    if (hasGrams) {
      canonicalQty = totalGrams;
      canonicalUnit = 'g';
    } else if (hasMl) {
      canonicalQty = totalMl;
      canonicalUnit = 'ml';
    } else {
      // Fractional recipe requirements stay fractional; purchasing rounds later.
      canonicalQty = totalCount;
      canonicalUnit = canonical.unit;
    }

    result.push({
      ...canonical,
      name: canonical.name,
      normalizedName: canonical.normalizedName,
      category,
      quantity: canonicalQty,
      unit: canonicalUnit,
      isChecked: group.every((i) => i.isChecked),
      requiredAmounts: [...group.reduce((amounts, item) => {
        const unit = item.unit || "";
        amounts.set(unit, (amounts.get(unit) || 0) + item.quantity);
        return amounts;
      }, new Map<string, number>())].map(([unit, quantity]) => ({ quantity, unit })),
      mergedCount: group.reduce((count, item) => count + (item.sourceRowCount ?? 1), 0),
      allIds: group.map((i) => i.id),
      ...(shoppingMetadataEnabled ? {
        ingredientMetadata: group.reduce((m, i) => mergeDevelopmentShoppingMetadata(m, i.ingredientMetadata),
          undefined as ShoppingListItem["ingredientMetadata"]),
        productKey: group.find(i => i.ingredientMetadata?.selectedProduct)?.ingredientMetadata?.selectedProduct?.productKey ||
          canonical.productKey,
      } : {}),
    });
  }

  return result;
}
