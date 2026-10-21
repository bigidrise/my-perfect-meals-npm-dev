import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiRequest } from "@/lib/apiRequest";
import { classifyIngredient } from "@/utils/ingredientClassifier";
import { assertShoppingMetadataEndpoint } from "@/lib/shoppingMetadataTransport";
import {
  makeIngredientMetadata, parseIngredientMetadata, shoppingIdentityKey, mergeIngredientMetadata, preserveRecipeContributions,
} from "@shared/shoppingIngredientMetadata";
import type { ShoppingListItem, ShoppingListStore, UniversalIngredient } from "./shoppingListStore";
import {
  canonicalShoppingIngredient, parseShoppingProductSelection, shoppingIngredientSignature,
  type ShoppingProductSelection,
} from "@shared/shoppingProductSelection";

type State = ShoppingListStore & {
  ownerId: string; lastSyncError: string | null;
  chooseProduct: (ids: string[], selection: ShoppingProductSelection | null) => Promise<void>;
};
const owner = () => typeof localStorage === "undefined" ? "guest" : localStorage.getItem("userId") || "guest";
const cacheKey = (id: string) => `shopping-list-storage:development:${encodeURIComponent(id)}`;
const units: Record<string, [string, number]> = {
  g: ["weight", 1], gram: ["weight", 1], grams: ["weight", 1], kg: ["weight", 1000],
  oz: ["weight", 28.3495], lb: ["weight", 453.592], lbs: ["weight", 453.592],
  ml: ["volume", 1], l: ["volume", 1000], tsp: ["volume", 4.929],
  tbsp: ["volume", 14.787], cup: ["volume", 236.588], cups: ["volume", 236.588],
};
function compatibleUnit(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase() || (units[a.toLowerCase()] && units[b.toLowerCase()] &&
    units[a.toLowerCase()][0] === units[b.toLowerCase()][0]);
}
function combinedQuantity(a: ShoppingListItem, b: ShoppingListItem) {
  return a.quantity + (a.unit.toLowerCase() === b.unit.toLowerCase() ? b.quantity
    : b.quantity * units[b.unit.toLowerCase()][1] / units[a.unit.toLowerCase()][1]);
}
function fromServer(row: any): ShoppingListItem {
  const ingredientMetadata = parseIngredientMetadata(row.ingredientMetadata);
  const name = ingredientMetadata?.ingredient.originalName || row.name;
  const classified = classifyIngredient(name);
  return {
    id: row.id, serverId: row.id, name,
    normalizedName: classified.normalizedName,
    quantity: Number(row.quantity), unit: row.unit || "",
    category: row.category || classified.category,
    isChecked: Boolean(row.checked), isPantryStaple: classified.isPantryStaple,
    productKey: row.productKey || undefined, ingredientMetadata,
    sourceMeals: row.sources?.map((s: any) => s.mealName).filter(Boolean) ||
      ingredientMetadata?.contributions.map(c => c.recipeName).filter((v): v is string => Boolean(v)),
  };
}
function writeShape(item: ShoppingListItem) {
  return {
    name: item.name, quantity: String(item.quantity), unit: item.unit,
    category: item.category, checked: item.isChecked,
    ...(item.ingredientMetadata ? { ingredientMetadata: item.ingredientMetadata } : {}),
  };
}

/** Separate Development cache: legacy cache is neither adopted nor uploaded. */
export function createDevelopmentShoppingListStore(request: typeof apiRequest = apiRequest) {
  let queue = Promise.resolve();
  return create<State>()(persist((set, get) => {
    function account() {
      const id = owner();
      if (get().ownerId !== id) {
        let items: ShoppingListItem[] = [];
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
          if (cached?.state?.ownerId === id) items = cached.state.items.map((i: ShoppingListItem) => ({
            ...i, ingredientMetadata: parseIngredientMetadata(i.ingredientMetadata),
          }));
        } catch { /* Invalid cache is never uploaded into a new account. */ }
        set({ ownerId: id, items, isHydrating: false, _clearGen: get()._clearGen + 1, lastSyncError: null });
      }
      return id;
    }
    function enqueue(action: () => Promise<void>, id = account(), rollback?: () => void) {
      queue = queue.then(async () => {
        if (owner() !== id || get().ownerId !== id || id === "guest") return;
        await action();
      }).catch((error: unknown) => {
        if (owner() === id && get().ownerId === id) {
          rollback?.();
          set({ lastSyncError: error instanceof Error ? error.message : "Shopping synchronization failed" });
        }
      });
    }
    function save(id: string, previous?: ShoppingListItem) {
      const accountId = account();
      let snapshot: string;
      enqueue(async () => {
        const item = get().items.find(i => i.id === id);
        if (!item) return;
        const capability = await request("/api/shopping-list-v2/");
        assertShoppingMetadataEndpoint(capability, accountId);
        if (owner() !== accountId || get().ownerId !== accountId) return;
        snapshot = JSON.stringify(writeShape(item));
        if (item.serverId) {
          await request(`/api/shopping-list-v2/${item.serverId}`, {
            method: "PATCH", body: JSON.stringify(writeShape(item)),
          });
        } else {
          const response = await request("/api/shopping-list", {
            method: "POST",
            body: JSON.stringify({ items: [item], scopeType: "adhoc", scopeKey: "cross-device" }),
          });
          const serverId = response.items?.[0]?.id;
          if (!serverId) throw new Error("Shopping save did not return an item identity");
          if (owner() !== accountId || get().ownerId !== accountId) return;
          const current = get().items.find(i => i.id === id);
          if (!current) {
            await request(`/api/shopping-list-v2/${serverId}`, { method: "DELETE" });
            return;
          }
          set({ items: get().items.map(i => i.id === id ? { ...i, serverId } : i) });
          // A second contribution may have arrived during the POST.
          if (JSON.stringify(writeShape(current)) !== snapshot) {
            await request(`/api/shopping-list-v2/${serverId}`, {
              method: "PATCH", body: JSON.stringify(writeShape(current)),
            });
          }
        }
      }, accountId, () => {
        const current = get().items.find(i => i.id === id);
        if (previous && current && JSON.stringify(writeShape(current)) === snapshot) {
          set({ items: get().items.map(i => i.id === id ? previous : i) });
        }
      });
    }
    function add(input: UniversalIngredient & { category?: ShoppingListItem["category"] }) {
      account();
      if (!Number.isFinite(input.quantity) || input.quantity < 0) throw new Error("Invalid shopping quantity");
      const metadata = makeIngredientMetadata({
        ...input, recipeName: input.recipeName || input.sourceMeals?.[0], source: input.notes,
      });
      const name = metadata.ingredient.originalName;
      const classified = classifyIngredient(name);
      const next: ShoppingListItem = {
        ...input, name, id: `item_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        normalizedName: classified.normalizedName, category: input.category || classified.category,
        quantity: input.quantity, unit: input.unit || "",
        isChecked: false, isPantryStaple: classified.isPantryStaple,
        ingredientMetadata: metadata,
        productKey: metadata.selectedProduct?.productKey || input.productKey,
      };
      const index = get().items.findIndex(i => shoppingIdentityKey(i) === shoppingIdentityKey(next) &&
        compatibleUnit(i.unit, next.unit));
      if (index < 0) {
        set({ items: [...get().items, next] });
        save(next.id);
      } else {
        const prior = get().items[index];
        const merged = {
          ...prior, quantity: combinedQuantity(prior, next),
          ingredientMetadata: mergeIngredientMetadata(prior.ingredientMetadata, metadata),
          sourceMeals: [...(prior.sourceMeals || []), ...(next.sourceMeals || [])],
        };
        set({ items: get().items.map((i, n) => n === index ? merged : i) });
        save(prior.id);
      }
    }
    return {
      ownerId: owner(), lastSyncError: null, items: [], isHydrating: false, _clearGen: 0,
      chooseProduct: (ids, input) => {
        const accountId = account();
        const selection = input === null ? null : parseShoppingProductSelection(input);
        const uniqueIds = [...new Set(ids)];
        const result = queue.then(async () => {
          const assertOwner = () => {
            if (accountId === "guest" || owner() !== accountId || get().ownerId !== accountId) {
              throw new Error("Shopping account changed. Nothing else was saved.");
            }
          };
          assertOwner();
          if (!uniqueIds.length) throw new Error("This shopping ingredient is no longer available.");
          const targets = uniqueIds.map(id => get().items.find(item => item.id === id));
          if (targets.some(item => !item?.serverId)) {
            throw new Error("Save and refresh this ingredient before choosing a product.");
          }
          // Validate the WHOLE consolidated group before its first write.
          for (const item of targets as ShoppingListItem[]) {
            const ingredient = canonicalShoppingIngredient({
              originalName: item.ingredientMetadata?.ingredient.originalName || item.name,
              requirements: item.ingredientMetadata?.ingredient.requirements || [],
            });
            if (selection && (
              selection.product.assessment.subjectReference !== accountId ||
              shoppingIngredientSignature(ingredient) !== shoppingIngredientSignature(selection.ingredient)
            )) throw new Error("The product lookup no longer matches this ingredient and account. Look up choices again.");
          }
          const capability = await request("/api/shopping-list-v2/");
          assertOwner();
          assertShoppingMetadataEndpoint(capability, accountId);
          set({ lastSyncError: null });
          for (const prior of targets as ShoppingListItem[]) {
            assertOwner();
            const current = get().items.find(item => item.id === prior.id);
            if (!current || JSON.stringify(writeShape(current)) !== JSON.stringify(writeShape(prior))) {
              throw new Error("The ingredient changed during selection. Refresh before choosing again.");
            }
            const metadata = prior.ingredientMetadata || makeIngredientMetadata({
              name: prior.name, quantity: prior.quantity, unit: prior.unit,
            });
            const ingredientMetadata = { ...metadata, selectedProduct: selection?.product || null };
            const response = await request(`/api/shopping-list-v2/${prior.serverId}`, {
              method: "PATCH", body: JSON.stringify({ ingredientMetadata }),
            });
            assertOwner();
            if (!response?.item || response.item.id !== prior.serverId ||
                response.item.userId !== accountId) {
              throw new Error("The shopping API did not confirm this product save. Refresh the list.");
            }
            const savedMetadata = parseIngredientMetadata(response.item.ingredientMetadata);
            if (!savedMetadata || shoppingIdentityKey({ name: prior.name, ingredientMetadata: savedMetadata }) !==
                shoppingIdentityKey({ name: prior.name, ingredientMetadata }) ||
                JSON.stringify(savedMetadata.selectedProduct) !== JSON.stringify(ingredientMetadata.selectedProduct) ||
                JSON.stringify(savedMetadata.contributions) !== JSON.stringify(metadata.contributions)) {
              throw new Error("The shopping API did not preserve the choice and recipe contributions. Refresh the list.");
            }
            const latest = get().items.find(item => item.id === prior.id);
            if (!latest || JSON.stringify(writeShape(latest)) !== JSON.stringify(writeShape(prior))) {
              throw new Error("The ingredient changed while saving. Refresh the list to check its choice.");
            }
            set({ items: get().items.map(item => item.id === prior.id ? {
              ...item, ingredientMetadata: savedMetadata,
              productKey: selection?.product.productKey || undefined,
            } : item) });
          }
        }).catch((error: unknown) => {
          if (owner() === accountId && get().ownerId === accountId) {
            set({ lastSyncError: `${error instanceof Error ? error.message : "Could not save the product choice."} Some rows may already have saved; refresh before retrying.` });
          }
          throw error;
        });
        // Keep later shopping operations usable; the caller still receives rejection.
        queue = result.catch(() => {});
        return result;
      },
      addItem: add,
      addItems: items => items.forEach(add),
      hydrate: async () => {
        const id = account();
        if (get().isHydrating || id === "guest") return;
        const generation = get()._clearGen;
        set({ isHydrating: true });
        try {
          await queue;
          if (owner() !== id || get().ownerId !== id || generation !== get()._clearGen) return;
          const response = await request("/api/shopping-list-v2/");
          if (!Array.isArray(response.items)) throw new Error("Invalid shopping-list response");
          if (owner() !== id || get().ownerId !== id || generation !== get()._clearGen) return;
          const rows = response.items.map(fromServer);
          const localOnly = get().items.filter(i => !i.serverId);
          // A lost POST response must not duplicate an already-saved contribution.
          const ids = new Set(rows.flatMap((i: ShoppingListItem) => i.ingredientMetadata?.contributions.map(c => c.id) || []));
          const unsaved = localOnly.filter(i => !i.ingredientMetadata?.contributions.every(c => ids.has(c.id)));
          set({ items: [...rows, ...unsaved], isHydrating: false });
          // An older Production API can be read, but never receives metadata writes.
          if (response.shoppingMetadataVersion === 1 && response.ownerUserId === id) unsaved.forEach(i => save(i.id));
        } catch (error) {
          if (owner() === id && get().ownerId === id) set({
            isHydrating: false, lastSyncError: error instanceof Error ? error.message : "Shopping refresh failed",
          });
        }
      },
      updateItem: (id, updates) => {
        account();
        const item = get().items.find(i => i.id === id);
        if (!item) return;
        let metadata = updates.ingredientMetadata
          ? parseIngredientMetadata(updates.ingredientMetadata) : item.ingredientMetadata;
        if (metadata && item.ingredientMetadata) metadata = preserveRecipeContributions(item.ingredientMetadata, metadata);
        if (updates.name !== undefined && updates.name !== item.name && !updates.ingredientMetadata) {
          metadata = {
            ...makeIngredientMetadata({ name: updates.name }),
            contributions: item.ingredientMetadata?.contributions || [],
            selectedProduct: null,
          };
        }
        const name = metadata?.ingredient.originalName || updates.name || item.name;
        const next = {
          ...item, ...updates, id: item.id, serverId: item.serverId, name,
          normalizedName: classifyIngredient(name).normalizedName,
          ingredientMetadata: metadata,
          productKey: metadata ? metadata.selectedProduct?.productKey || undefined : item.productKey,
        };
        set({ items: get().items.map(i => i.id === id ? next : i) });
        save(id, item);
      },
      toggleItem: id => {
        account();
        const item = get().items.find(i => i.id === id);
        if (item) get().updateItem(id, { isChecked: !item.isChecked });
      },
      removeItem: id => {
        account();
        const item = get().items.find(i => i.id === id);
        set({ items: get().items.filter(i => i.id !== id) });
        if (item?.serverId) enqueue(async () => {
          await request(`/api/shopping-list-v2/${item.serverId}`, { method: "DELETE" });
        }, get().ownerId, () => {
          if (!get().items.some(i => i.id === id)) set({ items: [...get().items, item] });
        });
      },
      clearChecked: () => {
        account();
        get().items.filter(i => i.isChecked).forEach(i => get().removeItem(i.id));
      },
      clearAll: async () => {
        const id = account(), previous = get().items;
        set({ items: [], _clearGen: get()._clearGen + 1 });
        enqueue(async () => {
          try { await request("/api/shopping-list-v2/", { method: "DELETE" }); }
          catch (error) {
            if (owner() === id) set({ items: [...previous, ...get().items.filter(i => !previous.some(p => p.id === i.id))] });
            throw error;
          }
        }, id);
        await queue;
      },
      replaceItems: items => {
        account();
        const previous = get().items;
        set({ items });
        for (const old of previous) {
          const next = items.find(i => i.id === old.id);
          if (!next && old.serverId) enqueue(async () => {
            await request(`/api/shopping-list-v2/${old.serverId}`, { method: "DELETE" });
          });
          else if (next && JSON.stringify(writeShape(next)) !== JSON.stringify(writeShape(old))) save(next.id);
        }
      },
      getGroupedByCategory: () => {
        account();
        const grouped = Object.fromEntries(["Produce", "Meat", "Plant Proteins", "Dairy & Eggs", "Grains & Packaged", "Pantry", "Frozen", "Bakery", "Other"]
          .map(c => [c, [] as ShoppingListItem[]])) as Record<ShoppingListItem["category"], ShoppingListItem[]>;
        get().items.forEach(i => (grouped[i.category] || grouped.Other).push(i));
        return grouped;
      },
      getFilteredItems: exclude => { account(); return get().items.filter(i => !exclude || !i.isPantryStaple); },
    };
  }, {
    name: "shopping-list-development",
    storage: createJSONStorage(() => ({
      getItem: () => localStorage.getItem(cacheKey(owner())),
      setItem: (_name, value) => {
        const id = JSON.parse(value).state.ownerId;
        localStorage.setItem(cacheKey(id), value);
      },
      removeItem: () => localStorage.removeItem(cacheKey(owner())),
    })),
    partialize: s => ({ items: s.items, ownerId: s.ownerId }),
    version: 1,
  }));
}
