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
}

function readAll(): SavedProductScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProductScan[]) : [];
  } catch {
    return [];
  }
}

export function getSavedProducts(): SavedProductScan[] {
  return readAll();
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
  } catch {
  }
  return entry;
}

export function clearSavedProducts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
