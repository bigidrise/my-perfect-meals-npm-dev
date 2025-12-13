import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { classifyIngredient, normalizeIngredientName } from '@/utils/ingredientClassifier';
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

const canMerge = (a: ShoppingListItem, b: { normalizedName: string; unit: string }): boolean => {
  return a.normalizedName === b.normalizedName && a.unit === b.unit;
};

function createShoppingItem(input: UniversalIngredient): ShoppingListItem {
  const classified = classifyIngredient(input.name);
  
  return {
    id: generateId(),
    name: input.name,
    normalizedName: classified.normalizedName,
    quantity: input.quantity || 1,
    unit: input.unit || '',
    category: input.category || classified.category,
    isPantryStaple: classified.isPantryStaple,
    isChecked: false,
    notes: input.notes,
    sourceMeals: input.sourceMeals
  };
}

export const useShoppingListStore = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const classified = classifyIngredient(item.name);
          const normalizedName = classified.normalizedName;
          
          const existingIndex = state.items.findIndex((existing) => 
            canMerge(existing, { normalizedName, unit: item.unit })
          );

          if (existingIndex !== -1) {
            const updated = [...state.items];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + item.quantity,
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
                normalizedName,
                category: item.category || classified.category,
                isPantryStaple: classified.isPantryStaple,
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
            const classified = classifyIngredient(newItem.name);
            const normalizedName = classified.normalizedName;
            
            const existingIndex = updatedItems.findIndex((existing) => 
              canMerge(existing, { normalizedName, unit: newItem.unit })
            );

            if (existingIndex !== -1) {
              updatedItems[existingIndex] = {
                ...updatedItems[existingIndex],
                quantity: updatedItems[existingIndex].quantity + newItem.quantity,
                notes: newItem.notes 
                  ? `${updatedItems[existingIndex].notes || ''}${updatedItems[existingIndex].notes ? ', ' : ''}${newItem.notes}` 
                  : updatedItems[existingIndex].notes,
                sourceMeals: newItem.sourceMeals
                  ? [...(updatedItems[existingIndex].sourceMeals || []), ...newItem.sourceMeals]
                  : updatedItems[existingIndex].sourceMeals,
              };
            } else {
              updatedItems.push(createShoppingItem(newItem));
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
