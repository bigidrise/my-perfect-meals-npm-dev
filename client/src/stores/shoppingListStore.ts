import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { classifyIngredient, normalizeIngredientName } from '@/utils/ingredientClassifier';
import { normalizeIngredient } from '@shared/ingredientNormalizer';
import type { IngredientCategory } from '@/data/ingredientCategories';

export interface UniversalIngredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  sourceMeals?: string[];
  category?: IngredientCategory;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  isPantryStaple: boolean;
  isChecked: boolean;
  notes?: string;
  sourceMeals?: string[];
}

interface ShoppingListStore {
  items: ShoppingListItem[];
  addItem: (item: Omit<ShoppingListItem, 'id' | 'isChecked' | 'normalizedName' | 'category' | 'isPantryStaple'> & { category?: IngredientCategory }) => void;
  addItems: (items: UniversalIngredient[]) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  updateItem: (id: string, updates: Partial<ShoppingListItem>) => void;
  replaceItems: (items: ShoppingListItem[]) => void;
  getGroupedByCategory: () => Record<IngredientCategory, ShoppingListItem[]>;
  getFilteredItems: (excludePantryStaples: boolean) => ShoppingListItem[];
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Unit normalization: convert to larger units when thresholds are met.
 * Runs before aggregation AND after merging to keep quantities clean.
 * Only converts oz, tsp, tbsp — never grams or milliliters.
 */
function normalizeUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const u = unit.toLowerCase().trim();

  if ((u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') && quantity >= 3) {
    return normalizeUnit(quantity / 3, 'tbsp');
  }

  if ((u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') && quantity >= 16) {
    return normalizeUnit(quantity / 16, 'cup');
  }

  if (u === 'oz' && quantity >= 16) {
    return { quantity: quantity / 16, unit: 'lb' };
  }

  return { quantity, unit };
}

/**
 * Full aggregation-order normalization for a single incoming item.
 * Step 1: normalize ingredient name (canonical food name)
 * Step 2: normalize unit (convert up at thresholds)
 * Returns values ready for canMerge check.
 */
function normalizeForAggregation(name: string, quantity: number, unit: string) {
  const canonicalName = normalizeIngredient(name);
  const { quantity: normQty, unit: normUnit } = normalizeUnit(quantity, unit);
  const classified = classifyIngredient(canonicalName);
  return {
    canonicalName,
    normalizedName: classified.normalizedName,
    normQty,
    normUnit,
    category: classified.category,
    isPantryStaple: classified.isPantryStaple,
  };
}

const canMerge = (a: ShoppingListItem, b: { normalizedName: string; unit: string }): boolean => {
  return a.normalizedName === b.normalizedName && a.unit.toLowerCase() === b.unit.toLowerCase();
};

function createShoppingItem(input: UniversalIngredient): ShoppingListItem {
  const { canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
    normalizeForAggregation(input.name, input.quantity || 1, input.unit || '');

  return {
    id: generateId(),
    name: canonicalName,
    normalizedName,
    quantity: normQty,
    unit: normUnit,
    category: input.category || category,
    isPantryStaple,
    isChecked: false,
    notes: input.notes,
    sourceMeals: input.sourceMeals,
  };
}

export const useShoppingListStore = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          // Aggregation order: 1. normalize name  2. normalize unit  3. aggregate  4. format (display layer)
          const { canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
            normalizeForAggregation(item.name, item.quantity, item.unit);

          const existingIndex = state.items.findIndex((existing) =>
            canMerge(existing, { normalizedName, unit: normUnit })
          );

          if (existingIndex !== -1) {
            const updated = [...state.items];
            const merged = updated[existingIndex].quantity + normQty;
            const { quantity: finalQty, unit: finalUnit } = normalizeUnit(merged, normUnit);
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: finalQty,
              unit: finalUnit,
              sourceMeals: item.sourceMeals
                ? [...(updated[existingIndex].sourceMeals || []), ...item.sourceMeals]
                : updated[existingIndex].sourceMeals,
              notes: item.notes
                ? `${updated[existingIndex].notes || ''}${updated[existingIndex].notes ? ', ' : ''}${item.notes}`
                : updated[existingIndex].notes,
            };
            return { items: updated };
          }

          return {
            items: [
              ...state.items,
              {
                ...item,
                id: generateId(),
                name: canonicalName,
                normalizedName,
                quantity: normQty,
                unit: normUnit,
                category: item.category || category,
                isPantryStaple,
                isChecked: false,
              },
            ],
          };
        });
      },

      addItems: (newItems) => {
        set((state) => {
          const updatedItems = [...state.items];

          newItems.forEach((newItem) => {
            // Aggregation order: 1. normalize name  2. normalize unit  3. aggregate  4. format (display layer)
            const { canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
              normalizeForAggregation(newItem.name, newItem.quantity || 1, newItem.unit || '');

            const existingIndex = updatedItems.findIndex((existing) =>
              canMerge(existing, { normalizedName, unit: normUnit })
            );

            if (existingIndex !== -1) {
              const merged = updatedItems[existingIndex].quantity + normQty;
              const { quantity: finalQty, unit: finalUnit } = normalizeUnit(merged, normUnit);
              updatedItems[existingIndex] = {
                ...updatedItems[existingIndex],
                quantity: finalQty,
                unit: finalUnit,
                notes: newItem.notes
                  ? `${updatedItems[existingIndex].notes || ''}${updatedItems[existingIndex].notes ? ', ' : ''}${newItem.notes}`
                  : updatedItems[existingIndex].notes,
                sourceMeals: newItem.sourceMeals
                  ? [...(updatedItems[existingIndex].sourceMeals || []), ...newItem.sourceMeals]
                  : updatedItems[existingIndex].sourceMeals,
              };
            } else {
              updatedItems.push({
                id: generateId(),
                name: canonicalName,
                normalizedName,
                quantity: normQty,
                unit: normUnit,
                category: newItem.category || category,
                isPantryStaple,
                isChecked: false,
                notes: newItem.notes,
                sourceMeals: newItem.sourceMeals,
              });
            }
          });

          return { items: updatedItems };
        });
      },

      toggleItem: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, isChecked: !item.isChecked } : item
          ),
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      clearChecked: () => {
        set((state) => ({
          items: state.items.filter((item) => !item.isChecked),
        }));
      },

      clearAll: () => {
        set({ items: [] });
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      replaceItems: (items) => {
        set({ items });
      },

      getGroupedByCategory: () => {
        const items = get().items;
        const grouped: Record<IngredientCategory, ShoppingListItem[]> = {
          Produce: [],
          Meat: [],
          Dairy: [],
          Pantry: [],
          Frozen: [],
          Bakery: [],
          Other: []
        };

        items.forEach(item => {
          const category = item.category || 'Other';
          if (grouped[category]) {
            grouped[category].push(item);
          } else {
            grouped.Other.push(item);
          }
        });

        return grouped;
      },

      getFilteredItems: (excludePantryStaples: boolean) => {
        const items = get().items;
        if (!excludePantryStaples) return items;
        return items.filter(item => !item.isPantryStaple);
      }
    }),
    {
      name: 'shopping-list-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          const oldItems = persistedState?.items || [];
          const migratedItems = oldItems.map((item: any) => {
            const classified = classifyIngredient(item.name || '');
            return {
              ...item,
              id: item.id || generateId(),
              normalizedName: classified.normalizedName,
              category: item.category || classified.category,
              isPantryStaple: classified.isPantryStaple,
              isChecked: item.isChecked || false
            };
          });
          return { ...persistedState, items: migratedItems };
        }
        return persistedState as ShoppingListStore;
      }
    }
  )
);
