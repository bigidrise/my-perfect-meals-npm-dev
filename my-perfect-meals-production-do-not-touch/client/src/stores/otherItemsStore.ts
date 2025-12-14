// Store for non-meal household items (paper towels, pet food, etc.)
export type OtherItem = {
  id: string;
  name: string;          // "Paper Towels"
  brand?: string;        // "Bounty"
  qty: number;           // default 1
  unit: string;          // "pack", "bottle", "unit"
  category: "Household" | "Personal Care" | "Pets" | "Baby" | "Pharmacy" | "Misc";
  notes?: string;
  checked?: boolean;
};

type OtherItemsStore = {
  items: OtherItem[];
  updatedAt: string;
};

const KEY = "other_items_v1";

const uid = () => `other_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`;

// ---------- Store operations ----------
export function readOtherItems(): OtherItemsStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return { items: [], updatedAt: new Date().toISOString() };
    return parsed;
  } catch {
    return { items: [], updatedAt: new Date().toISOString() };
  }
}

export function writeOtherItems(next: OtherItemsStore) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event("other:items:updated"));
}

export function addOtherItem(item: Omit<OtherItem, "id" | "checked">) {
  const store = readOtherItems();
  const newItem: OtherItem = {
    id: uid(),
    ...item,
    checked: false
  };
  store.items.push(newItem);
  writeOtherItems({ ...store, updatedAt: new Date().toISOString() });
}

export function updateOtherItem(id: string, patch: Partial<OtherItem>) {
  const store = readOtherItems();
  const items = store.items.map(i => i.id === id ? { ...i, ...patch } : i);
  writeOtherItems({ items, updatedAt: new Date().toISOString() });
}

export function deleteOtherItem(id: string) {
  const store = readOtherItems();
  const items = store.items.filter(i => i.id !== id);
  writeOtherItems({ items, updatedAt: new Date().toISOString() });
}

export function toggleOtherItemChecked(id: string, checked?: boolean) {
  const store = readOtherItems();
  const items = store.items.map(i => i.id === id ? { ...i, checked: checked ?? !i.checked } : i);
  writeOtherItems({ items, updatedAt: new Date().toISOString() });
}

export function clearAllOtherItems() {
  writeOtherItems({ items: [], updatedAt: new Date().toISOString() });
}

export function clearCheckedOtherItems() {
  const store = readOtherItems();
  const items = store.items.filter(i => !i.checked);
  writeOtherItems({ items, updatedAt: new Date().toISOString() });
}
