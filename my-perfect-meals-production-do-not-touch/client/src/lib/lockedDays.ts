import { apiRequest } from "./queryClient";

export interface SlotMacros {
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface LockedDaySnapshot {
  dateISO: string;
  lockedAt: string;
  targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  slots: {
    breakfast: SlotMacros;
    lunch: SlotMacros;
    dinner: SlotMacros;
    snacks: SlotMacros;
  };
}

export interface LockDayResult {
  success: boolean;
  alreadyLocked?: boolean;
  message: string;
}

let lockedDaysCache: Record<string, LockedDaySnapshot> = {};
let cacheUserId: string | null = null;
let cacheInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initLockedDaysCache(userId?: string): Promise<void> {
  if (!userId) return;
  
  if (cacheInitialized && cacheUserId === userId) {
    return;
  }
  
  if (initPromise && cacheUserId === userId) {
    return initPromise;
  }
  
  cacheUserId = userId;
  
  initPromise = (async () => {
    try {
      const res = await apiRequest("/api/locked-days") as { lockedDays: Record<string, LockedDaySnapshot> };
      lockedDaysCache = res.lockedDays || {};
      cacheInitialized = true;
      console.log("✅ Locked days cache initialized from server:", Object.keys(lockedDaysCache).length, "days");
    } catch (error) {
      console.error("❌ Failed to fetch locked days from server:", error);
      lockedDaysCache = {};
    }
  })();
  
  return initPromise;
}

export function getLockedDays(userId?: string): Record<string, LockedDaySnapshot> {
  return lockedDaysCache;
}

export function getLockedDay(dateISO: string, userId?: string): LockedDaySnapshot | null {
  return lockedDaysCache[dateISO] ?? null;
}

export function isDayLocked(dateISO: string, userId?: string): boolean {
  return getLockedDay(dateISO, userId) !== null;
}

export function getLockedDaysInWeek(weekStartISO: string, userId?: string): string[] {
  const lockedDates: string[] = [];
  const start = new Date(weekStartISO + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (lockedDaysCache[iso]) {
      lockedDates.push(iso);
    }
  }
  return lockedDates;
}

export function hasLockedDaysInWeek(weekStartISO: string, userId?: string): boolean {
  return getLockedDaysInWeek(weekStartISO, userId).length > 0;
}

export async function lockDay(
  snapshot: Omit<LockedDaySnapshot, "lockedAt">,
  userId?: string
): Promise<LockDayResult> {
  if (!userId) {
    return { success: false, message: "User ID required" };
  }
  
  if (isDayLocked(snapshot.dateISO, userId)) {
    return {
      success: false,
      alreadyLocked: true,
      message: "This day has already been locked.",
    };
  }

  try {
    const res = await apiRequest(
      "/api/locked-days",
      {
        method: "POST",
        body: JSON.stringify(snapshot),
      }
    ) as { success?: boolean; alreadyLocked?: boolean; error?: string };
    
    if (res.alreadyLocked) {
      return { success: false, alreadyLocked: true, message: "This day has already been locked." };
    }
    
    if (res.success) {
      lockedDaysCache[snapshot.dateISO] = {
        ...snapshot,
        lockedAt: new Date().toISOString(),
      };
      console.log("✅ Day locked on server:", snapshot.dateISO);
      return { success: true, message: "Day saved to biometrics and locked." };
    }
    
    return { success: false, message: res.error || "Failed to lock day" };
  } catch (error) {
    console.error("❌ Failed to lock day on server:", error);
    return { success: false, message: "Failed to lock day" };
  }
}

export async function unlockDay(dateISO: string, userId?: string): Promise<void> {
  if (!userId) return;
  
  try {
    await apiRequest(`/api/locked-days?dateISO=${encodeURIComponent(dateISO)}`, {
      method: "DELETE",
    });
    delete lockedDaysCache[dateISO];
    console.log("✅ Day unlocked on server:", dateISO);
  } catch (error) {
    console.error("❌ Failed to unlock day on server:", error);
  }
}

export function getRecentLockedDays(
  days: number,
  userId?: string
): LockedDaySnapshot[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  
  return Object.values(lockedDaysCache)
    .filter((snap) => new Date(snap.dateISO) >= cutoff)
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

export async function checkDayLockedOnServer(dateISO: string, userId?: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const res = await apiRequest(
      `/api/locked-days/check?dateISO=${encodeURIComponent(dateISO)}`
    ) as { locked: boolean };
    return res.locked;
  } catch (error) {
    console.error("❌ Failed to check locked day on server:", error);
    return isDayLocked(dateISO, userId);
  }
}

export async function checkWeekLockedOnServer(weekStartISO: string, userId?: string): Promise<{
  lockedDays: string[];
  hasLockedDays: boolean;
}> {
  if (!userId) return { lockedDays: [], hasLockedDays: false };
  
  try {
    const res = await apiRequest(
      `/api/locked-days/week?weekStartISO=${encodeURIComponent(weekStartISO)}`
    ) as { lockedDays: string[]; hasLockedDays: boolean };
    return res;
  } catch (error) {
    console.error("❌ Failed to check week locked days on server:", error);
    return { lockedDays: getLockedDaysInWeek(weekStartISO, userId), hasLockedDays: hasLockedDaysInWeek(weekStartISO, userId) };
  }
}

export function clearCache(): void {
  lockedDaysCache = {};
  cacheUserId = null;
  cacheInitialized = false;
  initPromise = null;
}
