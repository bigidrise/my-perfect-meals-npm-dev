import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { classifyIngredient, normalizeIngredientName } from '@/utils/ingredientClassifier';
import { normalizeIngredient } from '@shared/ingredientNormalizer';
import type { IngredientCategory } from '@/data/ingredientCategories';

// ── Cross-unit conversion tables ──────────────────────────────────────────────
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  'fl oz': 29.574, 'fluid oz': 29.574, 'fluid ounce': 29.574,
  cup: 236.588, cups: 236.588,
  pt: 473.176, pint: 473.176, pints: 473.176,
  qt: 946.353, quart: 946.353, quarts: 946.353,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

function getUnitType(unit: string): 'volume' | 'weight' | 'count' {
  const u = (unit || '').toLowerCase().trim();
  if (VOLUME_TO_ML[u] !== undefined) return 'volume';
  if (WEIGHT_TO_G[u] !== undefined) return 'weight';
  return 'count';
}

/**
 * Converts quantity from one unit to another if they share the same measurement type.
 * Returns null if the units are incompatible.
 */
function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = (fromUnit || '').toLowerCase().trim();
  const to = (toUnit || '').toLowerCase().trim();
  if (from === to) return quantity;
  if (VOLUME_TO_ML[from] !== undefined && VOLUME_TO_ML[to] !== undefined) {
    return (quantity * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to];
  }
  if (WEIGHT_TO_G[from] !== undefined && WEIGHT_TO_G[to] !== undefined) {
    return (quantity * WEIGHT_TO_G[from]) / WEIGHT_TO_G[to];
  }
  return null;
}

/**
 * Finds an existing item that can be merged with an incoming item.
 * Tries exact unit match first, then cross-unit match within the same measurement type.
 */
function findMergeable(
  items: ShoppingListItem[],
  normalizedName: string,
  unit: string,
): number {
  const u = (unit || '').toLowerCase().trim();
  // Exact name + unit match
  const exact = items.findIndex(
    e => e.normalizedName === normalizedName && (e.unit || '').toLowerCase().trim() === u,
  );
  if (exact !== -1) return exact;

  // Cross-unit match (same measurement type)
  const incomingType = getUnitType(unit);
  if (incomingType === 'count') return -1; // unitless — don't cross-merge
  return items.findIndex(
    e => e.normalizedName === normalizedName && getUnitType(e.unit) === incomingType,
  );
}

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
  /** DB UUID — set when this item is synced to the server */
  serverId?: string;
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
  /** True while fetching from server on mount */
  isHydrating: boolean;
  /** True once the first server hydration has completed this session */
  hydrated: boolean;
  addItem: (item: Omit<ShoppingListItem, 'id' | 'isChecked' | 'normalizedName' | 'category' | 'isPantryStaple'> & { category?: IngredientCategory }) => void;
  addItems: (items: UniversalIngredient[]) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  updateItem: (id: string, updates: Partial<ShoppingListItem>) => void;
  replaceItems: (items: ShoppingListItem[]) => void;
  /** Fetch from server, merge with local cache, push local-only items to server */
  hydrate: () => Promise<void>;
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

// canMerge kept for migration compatibility — new code uses findMergeable
const canMerge = (a: ShoppingListItem, b: { normalizedName: string; unit: string }): boolean => {
  return a.normalizedName === b.normalizedName && a.unit.toLowerCase() === b.unit.toLowerCase();
};

/**
 * Merge an incoming qty+unit into an existing item.
 * Converts units when they are the same measurement type (e.g. cups + oz → cups).
 * Returns the merged {quantity, unit} after normalizing upward at thresholds.
 */
function mergeIntoExisting(
  existingQty: number,
  existingUnit: string,
  incomingQty: number,
  incomingUnit: string,
): { quantity: number; unit: string } {
  const converted = convertUnit(incomingQty, incomingUnit, existingUnit);
  if (converted !== null) {
    // Same measurement type — add in existing unit
    const merged = existingQty + converted;
    return normalizeUnit(merged, existingUnit);
  }
  // Same unit string (exact match case) — just add
  const merged = existingQty + incomingQty;
  return normalizeUnit(merged, existingUnit);
}

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

/** Map a raw server item (shoppingListItems row) to the client ShoppingListItem shape */
function mapServerItem(si: any): ShoppingListItem {
  const classified = classifyIngredient(si.name || '');
  return {
    id: si.id,
    serverId: si.id,
    name: si.name || '',
    normalizedName: classified.normalizedName,
    quantity: parseFloat(String(si.quantity)) || 1,
    unit: si.unit || '',
    category: (si.category as IngredientCategory) || classified.category,
    isPantryStaple: classified.isPantryStaple,
    isChecked: Boolean(si.checked),
    notes: si.notes ?? undefined,
    sourceMeals: si.sources?.map((s: any) => s.mealName).filter(Boolean) ?? undefined,
  };
}

export const useShoppingListStore = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: [],
      isHydrating: false,
      hydrated: false,

      // ── HYDRATE ────────────────────────────────────────────────────────────
      hydrate: async () => {
        if (get().hydrated || get().isHydrating) return;
        set({ isHydrating: true });

        try {
          const res = await fetch('/api/shopping-list-v2/', { credentials: 'include' });
          if (!res.ok) {
            set({ isHydrating: false, hydrated: true });
            return;
          }

          const { items: serverItems } = await res.json() as { items: any[] };
          const mappedServer: ShoppingListItem[] = serverItems.map(mapServerItem);

          // ── Guardrail 1 & 2: Merge local+server, dedup by normalizedName+unit, sum quantities
          const localItems = get().items;
          const merged = [...mappedServer];
          const localOnly: ShoppingListItem[] = [];

          for (const local of localItems) {
            // Items with serverId are already on the server from a previous session — skip
            if (local.serverId) continue;

            // Truly new local item: find server counterpart by normalizedName+unit
            const serverIdx = merged.findIndex(
              s =>
                s.normalizedName === local.normalizedName &&
                (s.unit || '').toLowerCase() === (local.unit || '').toLowerCase(),
            );

            if (serverIdx !== -1) {
              // Duplicate found — sum quantities (guardrail 2)
              merged[serverIdx] = {
                ...merged[serverIdx],
                quantity: merged[serverIdx].quantity + local.quantity,
              };
            } else {
              // Truly new — push to server
              localOnly.push(local);
            }
          }

          // Push local-only items to server (migration: first sync)
          if (localOnly.length > 0) {
            try {
              await fetch('/api/shopping-list', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: localOnly,
                  scopeType: 'adhoc',
                  scopeKey: 'cross-device',
                }),
              });

              // Re-fetch so all items (including newly pushed) have server UUIDs
              const res2 = await fetch('/api/shopping-list-v2/', { credentials: 'include' });
              if (res2.ok) {
                const { items: refreshed } = await res2.json() as { items: any[] };
                set({ items: refreshed.map(mapServerItem), isHydrating: false, hydrated: true });
                return;
              }
            } catch {
              // Push failed — continue with best-effort merged list (local items keep local IDs)
            }
            // Fallback: server empty + push failed → show merged (local items without serverIds)
            set({ items: [...merged, ...localOnly], isHydrating: false, hydrated: true });
            return;
          }

          set({ items: mappedServer, isHydrating: false, hydrated: true });
        } catch {
          // Fail open: keep existing local state so the user can still use the list offline
          set({ isHydrating: false, hydrated: true });
        }
      },

      // ── MUTATIONS ─────────────────────────────────────────────────────────

      addItem: (item) => {
        set((state) => {
          const { canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
            normalizeForAggregation(item.name, item.quantity, item.unit);

          const existingIndex = findMergeable(state.items, normalizedName, normUnit);

          if (existingIndex !== -1) {
            const updated = [...state.items];
            const existing = updated[existingIndex];
            const { quantity: finalQty, unit: finalUnit } = mergeIntoExisting(
              existing.quantity, existing.unit, normQty, normUnit,
            );
            updated[existingIndex] = {
              ...existing,
              quantity: finalQty,
              unit: finalUnit,
              sourceMeals: item.sourceMeals
                ? [...(existing.sourceMeals || []), ...item.sourceMeals]
                : existing.sourceMeals,
              notes: item.notes
                ? `${existing.notes || ''}${existing.notes ? ', ' : ''}${item.notes}`
                : existing.notes,
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
            const { canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
              normalizeForAggregation(newItem.name, newItem.quantity || 1, newItem.unit || '');

            const existingIndex = findMergeable(updatedItems, normalizedName, normUnit);

            if (existingIndex !== -1) {
              const existing = updatedItems[existingIndex];
              const { quantity: finalQty, unit: finalUnit } = mergeIntoExisting(
                existing.quantity, existing.unit, normQty, normUnit,
              );
              updatedItems[existingIndex] = {
                ...existing,
                quantity: finalQty,
                unit: finalUnit,
                notes: newItem.notes
                  ? `${existing.notes || ''}${existing.notes ? ', ' : ''}${newItem.notes}`
                  : existing.notes,
                sourceMeals: newItem.sourceMeals
                  ? [...(existing.sourceMeals || []), ...newItem.sourceMeals]
                  : existing.sourceMeals,
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

      /**
       * Optimistic toggle + server PATCH.
       * Rolls back locally if the server call fails.
       */
      toggleItem: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item) return;

        // Optimistic local update
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isChecked: !i.isChecked } : i
          ),
        }));

        // Mirror to server if this item is synced
        if (item.serverId) {
          fetch(`/api/shopping-list-v2/${item.serverId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checked: !item.isChecked }),
          }).catch(() => {
            // Rollback (guardrail 4)
            set((state) => ({
              items: state.items.map((i) =>
                i.id === id ? { ...i, isChecked: item.isChecked } : i
              ),
            }));
          });
        }
      },

      /**
       * Optimistic remove + server DELETE.
       * Rolls back by re-inserting the item if the server call fails.
       */
      removeItem: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item) return;

        // Optimistic local removal
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));

        // Mirror to server if synced
        if (item.serverId) {
          fetch(`/api/shopping-list-v2/${item.serverId}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {
            // Rollback (guardrail 4)
            set((state) => ({ items: [...state.items, item] }));
          });
        }
      },

      /**
       * Optimistic clear-checked + server DELETE for each checked server item.
       * Rolls back all items if any server call fails.
       */
      clearChecked: () => {
        const checkedItems = get().items.filter(i => i.isChecked);
        const serverChecked = checkedItems.filter(i => i.serverId);

        // Optimistic local clear
        set((state) => ({ items: state.items.filter((i) => !i.isChecked) }));

        // Mirror to server
        if (serverChecked.length > 0) {
          (async () => {
            const results = await Promise.allSettled(
              serverChecked.map(item =>
                fetch(`/api/shopping-list-v2/${item.serverId}`, {
                  method: 'DELETE',
                  credentials: 'include',
                })
              )
            );
            if (results.some(r => r.status === 'rejected')) {
              // Rollback (guardrail 4)
              set((state) => ({ items: [...state.items, ...checkedItems] }));
            }
          })();
        }
      },

      /**
       * Optimistic clear-all + server DELETE all.
       * Rolls back full list if the server call fails.
       */
      clearAll: () => {
        const prevItems = get().items;
        const hadServerItems = prevItems.some(i => i.serverId);

        set({ items: [] });

        if (hadServerItems) {
          fetch('/api/shopping-list-v2/', {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {
            // Rollback (guardrail 4)
            set({ items: prevItems });
          });
        }
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
          'Plant Proteins': [],
          'Dairy & Eggs': [],
          'Grains & Packaged': [],
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
      version: 4,
      // Only persist items — isHydrating and hydrated are ephemeral session state
      partialize: (state) => ({ items: state.items }),
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
        if (version < 3) {
          // Rename "Dairy" category to "Dairy & Eggs"
          const oldItems = persistedState?.items || [];
          const migratedItems = oldItems.map((item: any) => ({
            ...item,
            category: item.category === 'Dairy' ? 'Dairy & Eggs' : item.category
          }));
          return { ...persistedState, items: migratedItems };
        }
        if (version < 4) {
          // Re-classify tofu/tempeh/seitan from Meat/Other → Plant Proteins
          const plantProteinNames = ['tofu', 'tempeh', 'seitan', 'edamame', 'nutritional yeast', 'nooch', 'tvp', 'jackfruit'];
          const oldItems = persistedState?.items || [];
          const migratedItems = oldItems.map((item: any) => {
            const n = (item.name || '').toLowerCase();
            const isPlant = plantProteinNames.some(p => n.includes(p));
            return {
              ...item,
              category: isPlant ? 'Plant Proteins' : item.category
            };
          });
          return { ...persistedState, items: migratedItems };
        }
        return persistedState as ShoppingListStore;
      }
    }
  )
);
