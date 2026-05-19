const STORAGE_KEY = "mpm.shopping.savedProducts";

export type UserDecision = "added" | "saved" | "skipped";

export interface SavedProductScan {
  id: string;
  productName: string;
  barcode?: string;
  ingredients: string[];
  score: string;
  householdFlags: string[];
  scanDate: string;
  userDecision: UserDecision;
  category?: string;
  image?: string;
  scanSource: "shopping" | "biometrics";
  overallSummary?: string;
  considerations?: string[];
}

function readAll(): SavedProductScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProductScan[]) : [];
  } catch {
    return [];
  }
}

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getSavedProducts(): SavedProductScan[] {
  return readAll();
}

/** Returns only shopping scans from today — the active session view. */
export function getTodayShoppingScans(): SavedProductScan[] {
  const today = todayLocalDate();
  return readAll().filter(
    (s) => s.scanSource === "shopping" && s.scanDate.slice(0, 10) === today
  );
}

export function saveProductScan(scan: Omit<SavedProductScan, "id">): SavedProductScan {
  const entry: SavedProductScan = {
    ...scan,
    id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const existing = readAll();
  const updated = [entry, ...existing].slice(0, 200);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return entry;
}

/**
 * Removes shopping scans that are not from today.
 * Shopping scans are session memory — active grocery intelligence,
 * not a permanent archive. Called on shopping page mount.
 * Biometrics scans are left untouched (different retention needs).
 */
export function clearExpiredShoppingScans(): void {
  const today = todayLocalDate();
  const all = readAll();
  const kept = all.filter(
    (s) => s.scanSource !== "shopping" || s.scanDate.slice(0, 10) === today
  );
  if (kept.length !== all.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {}
  }
}

export function deleteProductScan(id: string): void {
  const kept = readAll().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {}
}

export function clearSavedProducts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
