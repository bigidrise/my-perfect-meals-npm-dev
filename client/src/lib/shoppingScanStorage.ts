// Never import unowned legacy history into the currently signed-in account.
const STORAGE_KEY = "mpm.shopping.savedProducts";
const storageKey = (owner: string) => `${STORAGE_KEY}:${owner}`;

export type UserDecision = "added" | "saved" | "skipped";

export interface SavedProductScan {
  id: string;
  productName: string;
  barcode?: string;
  ingredients: string[];
  score: string;
  /** False when the grade was never actually calculated (failed scan, unreadable image, etc.) */
  gradeCalculated?: boolean;
  householdFlags: string[];
  scanDate: string;
  userDecision: UserDecision;
  category?: string;
  image?: string;
  scanSource: "shopping" | "biometrics";
  overallSummary?: string;
  considerations?: string[];
  /**
   * Full IngredientScanResult serialized as JSON — used to restore the exact
   * analysis when the user reopens a scan from Recent Scans. Shopping scans
   * are cleared nightly so this is effectively session-scoped storage.
   * Contains only AI-generated analysis output and product data.
   */
  fullResult?: string;
}

function readAll(owner?: string | null): SavedProductScan[] {
  if (!owner) return [];
  try {
    const raw = localStorage.getItem(storageKey(owner));
    return raw ? (JSON.parse(raw) as SavedProductScan[]) : [];
  } catch {
    return [];
  }
}

function todayLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getSavedProducts(owner?: string | null): SavedProductScan[] {
  return readAll(owner);
}

/** Returns only shopping scans from today — the active session view. */
export function getTodayShoppingScans(owner?: string | null): SavedProductScan[] {
  const today = todayLocalDate();
  return readAll(owner).filter(
    (s) => s.scanSource === "shopping" && s.scanDate.slice(0, 10) === today
  );
}

export function saveProductScan(scan: Omit<SavedProductScan, "id">, owner?: string | null): SavedProductScan {
  if (!owner) throw new Error("Sign in before storing scan history.");
  const entry: SavedProductScan = {
    ...scan,
    id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  const existing = readAll(owner);
  const updated = [entry, ...existing].slice(0, 200);
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(updated));
  } catch {}
  return entry;
}

/**
 * Removes shopping scans that are not from today.
 * Shopping scans are session memory — active grocery intelligence,
 * not a permanent archive. Called on shopping page mount.
 * Biometrics scans are left untouched (different retention needs).
 */
export function clearExpiredShoppingScans(owner?: string | null): void {
  if (!owner) return;
  const today = todayLocalDate();
  const all = readAll(owner);
  const kept = all.filter(
    (s) => s.scanSource !== "shopping" || s.scanDate.slice(0, 10) === today
  );
  if (kept.length !== all.length) {
    try {
      localStorage.setItem(storageKey(owner), JSON.stringify(kept));
    } catch {}
  }
}

export function deleteProductScan(id: string, owner?: string | null): void {
  if (!owner) return;
  const kept = readAll(owner).filter((s) => s.id !== id);
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(kept));
  } catch {}
}

export function clearSavedProducts(owner?: string | null): void {
  if (!owner) return;
  try {
    localStorage.removeItem(storageKey(owner));
  } catch {}
}
