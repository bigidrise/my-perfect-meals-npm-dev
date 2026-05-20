import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { classifyIngredient, normalizeIngredientName } from '@/utils/ingredientClassifier';
import { normalizeIngredient } from '@shared/ingredientNormalizer';
import type { IngredientCategory } from '@/data/ingredientCategories';
import { getAuthHeaders } from '@/lib/auth';

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

function findMergeable(
  items: ShoppingListItem[],
  normalizedName: string,
  unit: string,
): number {
  const u = (unit || '').toLowerCase().trim();
  const exact = items.findIndex(
    e => e.normalizedName === normalizedName && (e.unit || '').toLowerCase().trim() === u,
  );
  if (exact !== -1) return exact;
  const incomingType = getUnitType(unit);
  if (incomingType === 'count') return -1;
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
  /** DB UUID — present once this item has been synced to the server */
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
  /** True while the initial server fetch is in progress */
  isHydrating: boolean;
  addItem: (item: Omit<ShoppingListItem, 'id' | 'isChecked' | 'normalizedName' | 'category' | 'isPantryStaple'> & { category?: IngredientCategory }) => void;
  addItems: (items: UniversalIngredient[]) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  updateItem: (id: string, updates: Partial<ShoppingListItem>) => void;
  replaceItems: (items: ShoppingListItem[]) => void;
  /**
   * Fetch grocery list from server, deduplicate, merge with local-only items,
   * and push any local-only items up to the server.
   * Runs on every shopping list page open — server is always the source of truth.
   */
  hydrate: () => Promise<void>;
  getGroupedByCategory: () => Record<IngredientCategory, ShoppingListItem[]>;
  getFilteredItems: (excludePantryStaples: boolean) => ShoppingListItem[];
}

const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

// canMerge kept for migration compatibility
const canMerge = (a: ShoppingListItem, b: { normalizedName: string; unit: string }): boolean => {
  return a.normalizedName === b.normalizedName && a.unit.toLowerCase() === b.unit.toLowerCase();
};

function mergeIntoExisting(
  existingQty: number,
  existingUnit: string,
  incomingQty: number,
  incomingUnit: string,
): { quantity: number; unit: string } {
  const converted = convertUnit(incomingQty, incomingUnit, existingUnit);
  if (converted !== null) {
    return normalizeUnit(existingQty + converted, existingUnit);
  }
  return normalizeUnit(existingQty + incomingQty, existingUnit);
}

/** Map a raw server DB row to the client ShoppingListItem shape */
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

/**
 * Deduplicate an array of server items by normalizedName + unit (sum quantities).
 * The server can have multiple rows for the same ingredient — normalize them first.
 */
function deduplicateServerItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const deduped: ShoppingListItem[] = [];
  for (const si of items) {
    const existingIdx = deduped.findIndex(
      e =>
        e.normalizedName === si.normalizedName &&
        (e.unit || '').toLowerCase() === (si.unit || '').toLowerCase(),
    );
    if (existingIdx !== -1) {
      deduped[existingIdx] = {
        ...deduped[existingIdx],
        quantity: deduped[existingIdx].quantity + si.quantity,
        // Only mark checked if ALL duplicates are checked
        isChecked: deduped[existingIdx].isChecked && si.isChecked,
      };
    } else {
      deduped.push(si);
    }
  }
  return deduped;
}

/** Fire-and-forget POST of items to the server */
function serverPost(items: ShoppingListItem[]) {
  if (items.length === 0) return;
  fetch('/api/shopping-list', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      items,
      scopeType: 'adhoc',
      scopeKey: 'cross-device',
    }),
  }).catch(() => {
    // Fail silently — hydration on page open will recover any missed writes
  });
}

/** Fire-and-forget PATCH of a quantity update to an existing server item */
function serverPatch(serverId: string, quantity: number, unit: string) {
  fetch(`/api/shopping-list-v2/${serverId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ quantity: quantity.toString(), unit }),
  }).catch(() => {});
}

export const useShoppingListStore = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: [],
      isHydrating: false,

      // ── HYDRATE ────────────────────────────────────────────────────────────
      /**
       * Fetch from server on every shopping list page open.
       * Server is source of truth. Local cache is merged in for items not yet on server.
       * Only blocked if a hydration is already in progress.
       */
      hydrate: async () => {
        if (get().isHydrating) return;
        set({ isHydrating: true });

        try {
          const res = await fetch('/api/shopping-list-v2/', { credentials: 'include', headers: getAuthHeaders() });
          if (!res.ok) {
            set({ isHydrating: false });
            return;
          }

          const { items: serverItems } = await res.json() as { items: any[] };

          // Map and deduplicate server rows (server can have multiple rows per ingredient)
          const rawServer: ShoppingListItem[] = serverItems.map(mapServerItem);
          const dedupedServer = deduplicateServerItems(rawServer);

          // Merge local-only items (no serverId = never been pushed to server)
          const localItems = get().items;
          const merged = [...dedupedServer];
          const localOnly: ShoppingListItem[] = [];

          for (const local of localItems) {
            if (local.serverId) continue; // already on server, skip

            const serverIdx = merged.findIndex(
              s =>
                s.normalizedName === local.normalizedName &&
                (s.unit || '').toLowerCase() === (local.unit || '').toLowerCase(),
            );

            if (serverIdx !== -1) {
              // Same ingredient on server — sum quantities (dedup rule)
              merged[serverIdx] = {
                ...merged[serverIdx],
                quantity: merged[serverIdx].quantity + local.quantity,
              };
            } else {
              localOnly.push(local);
            }
          }

          // Push local-only items to server so other devices can see them
          if (localOnly.length > 0) {
            try {
              await fetch('/api/shopping-list', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                  items: localOnly,
                  scopeType: 'adhoc',
                  scopeKey: 'cross-device',
                }),
              });

              // Re-fetch to get server UUIDs for all items (including just-pushed ones)
              const res2 = await fetch('/api/shopping-list-v2/', { credentials: 'include', headers: getAuthHeaders() });
              if (res2.ok) {
                const { items: refreshed } = await res2.json() as { items: any[] };
                const all = deduplicateServerItems(refreshed.map(mapServerItem));
                set({ items: all, isHydrating: false });
                return;
              }
            } catch {
              // Push failed — show merged with local items (no serverIds for those)
            }
            set({ items: [...merged, ...localOnly], isHydrating: false });
            return;
          }

          set({ items: dedupedServer, isHydrating: false });
        } catch {
          // Fail open — keep local state so the user can still use the list offline
          set({ isHydrating: false });
        }
      },

      // ── MUTATIONS ─────────────────────────────────────────────────────────

      /**
       * Add a single item locally and immediately write to server.
       * If an identical item exists, merge quantities and PATCH the server item.
       */
      addItem: (item) => {
        let created: ShoppingListItem | null = null;
        let mergedServerId: string | null = null;
        let mergedQty = 0;
        let mergedUnit = '';

        set((state) => {
          // For manually-entered items (category: "Other"), skip ingredient normalization
          // so that brand names like "Planters cashews" are preserved verbatim and never
          // collapsed into an existing "cashews" entry via deduplication.
          const isManualEntry = item.category === 'Other';
          const rawName = item.name.trim();
          let canonicalName: string, normalizedName: string, normQty: number, normUnit: string, category: IngredientCategory, isPantryStaple: boolean;
          if (isManualEntry) {
            const nu = normalizeUnit(item.quantity, item.unit);
            canonicalName = rawName;
            normalizedName = rawName.toLowerCase();
            normQty = nu.quantity;
            normUnit = nu.unit;
            category = 'Other';
            isPantryStaple = false;
          } else {
            ({ canonicalName, normalizedName, normQty, normUnit, category, isPantryStaple } =
              normalizeForAggregation(item.name, item.quantity, item.unit));
          }

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
            if (existing.serverId) {
              mergedServerId = existing.serverId;
              mergedQty = finalQty;
              mergedUnit = finalUnit;
            }
            return { items: updated };
          }

          const newEntry: ShoppingListItem = {
            ...item,
            id: generateId(),
            name: canonicalName,
            normalizedName,
            quantity: normQty,
            unit: normUnit,
            category: item.category || category,
            isPantryStaple,
            isChecked: false,
          };
          created = newEntry;
          return { items: [...state.items, newEntry] };
        });

        // Server sync (fire-and-forget)
        if (created) {
          serverPost([created]);
        } else if (mergedServerId) {
          serverPatch(mergedServerId, mergedQty, mergedUnit);
        }
      },

      /**
       * Add multiple items locally and immediately write new ones to server.
       * Merged items (quantity updates) trigger a server PATCH.
       */
      addItems: (newItems) => {
        const toPost: ShoppingListItem[] = [];
        const toMergePatch: Array<{ serverId: string; quantity: number; unit: string }> = [];

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
              if (existing.serverId) {
                toMergePatch.push({ serverId: existing.serverId, quantity: finalQty, unit: finalUnit });
              }
            } else {
              const newEntry: ShoppingListItem = {
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
              };
              updatedItems.push(newEntry);
              toPost.push(newEntry);
            }
          });

          return { items: updatedItems };
        });

        // Server sync (fire-and-forget)
        serverPost(toPost);
        toMergePatch.forEach(({ serverId, quantity, unit }) => serverPatch(serverId, quantity, unit));
      },

      /**
       * Optimistic toggle + server PATCH. Rolls back locally if server fails.
       */
      toggleItem: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item) return;

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isChecked: !i.isChecked } : i
          ),
        }));

        if (item.serverId) {
          fetch(`/api/shopping-list-v2/${item.serverId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checked: !item.isChecked }),
          }).catch(() => {
            set((state) => ({
              items: state.items.map((i) =>
                i.id === id ? { ...i, isChecked: item.isChecked } : i
              ),
            }));
          });
        }
      },

      /**
       * Optimistic remove + server DELETE. Rolls back by re-inserting if server fails.
       */
      removeItem: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item) return;

        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));

        if (item.serverId) {
          fetch(`/api/shopping-list-v2/${item.serverId}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {
            set((state) => ({ items: [...state.items, item] }));
          });
        }
      },

      /**
       * Optimistic clear-checked + server DELETE for each checked server item.
       * Rolls back all checked items if any server call fails.
       */
      clearChecked: () => {
        const checkedItems = get().items.filter(i => i.isChecked);
        const serverChecked = checkedItems.filter(i => i.serverId);

        set((state) => ({ items: state.items.filter((i) => !i.isChecked) }));

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
              set((state) => ({ items: [...state.items, ...checkedItems] }));
            }
          })();
        }
      },

      /**
       * Optimistic clear-all + server DELETE all. Full list restore on failure.
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
      // Only persist items — isHydrating is ephemeral session state
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
          const oldItems = persistedState?.items || [];
          const migratedItems = oldItems.map((item: any) => ({
            ...item,
            category: item.category === 'Dairy' ? 'Dairy & Eggs' : item.category
          }));
          return { ...persistedState, items: migratedItems };
        }
        if (version < 4) {
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
