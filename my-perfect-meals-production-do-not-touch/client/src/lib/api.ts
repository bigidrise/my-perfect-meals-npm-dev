// client/src/lib/api.ts
import { getDeviceId } from "@/utils/deviceId";
import { Capacitor } from '@capacitor/core';

type Json = Record<string, any>;

const NATIVE_API_BASE = 'https://2e4f029e-9abb-4b2b-a953-3126cde586ef-00-36heuk32mpfh5.worf.replit.dev';

const isDev = import.meta.env.DEV;
const ENV_BASE = (import.meta as any).env?.VITE_API_BASE?.trim() || (import.meta as any).env?.VITE_API_BASE_URL?.trim();

function normalize(u?: string | null) {
  return u ? u.replace(/\/+$/, "") : "";
}

function getApiBase(): string {
  if (ENV_BASE) return normalize(ENV_BASE);
  if (Capacitor.isNativePlatform()) return NATIVE_API_BASE;
  if (isDev) return normalize(`http://${location.hostname}:5000`);
  return '';
}

export const API_BASE = getApiBase();

// Build a full URL safely
function url(path: string) {
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  const p = path.startsWith("/") ? path : `/${path}`;
  // Native platforms always need absolute URLs
  if (Capacitor.isNativePlatform()) return `${API_BASE}${p}`;
  // In development on Replit, frontend and backend are on same origin (both served from port 5000)
  // Use relative URLs so it works correctly
  if (isDev && !ENV_BASE) return p;
  return `${API_BASE}${p}`;
}

export async function apiJSON<T = any>(
  path: string,
  init: RequestInit & { json?: Json } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const body = json ? JSON.stringify(json) : init.body;
  const deviceId = getDeviceId();

  const res = await fetch(url(path), {
    credentials: "include", // allow cookies/sessions if you use them
    headers: {
      "Content-Type": json ? "application/json" : (headers as any)?.["Content-Type"] ?? "application/json",
      "X-Device-Id": deviceId,
      ...(headers || {}),
    },
    ...rest,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText} → ${text || "(no body)"}`);
  }
  // Try JSON; fall back to text
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? ((await res.json()) as T) : ((await res.text()) as unknown as T);
}

// Convenience helpers
export const get = <T = any>(path: string, init: RequestInit = {}) =>
  apiJSON<T>(path, { ...init, method: "GET" });

export const post = <T = any>(path: string, json?: Json, init: RequestInit = {}) =>
  apiJSON<T>(path, { ...init, method: "POST", json });

export const put = <T = any>(path: string, json?: Json, init: RequestInit = {}) =>
  apiJSON<T>(path, { ...init, method: "PUT", json });

export const del = <T = any>(path: string, init: RequestInit = {}) =>
  apiJSON<T>(path, { ...init, method: "DELETE" });

export const patch = <T = any>(path: string, json?: Json, init: RequestInit = {}) =>
  apiJSON<T>(path, { ...init, method: "PATCH", json });

// Legacy compatibility - keep existing code working
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return get(path, init);
}

export async function apiPost<T = any>(urlPath: string, body: any): Promise<T> {
  return post(urlPath, body);
}

// Weekly Calendar API functions
import type { Meal } from "@/components/MealCard";

export async function getWeekPlan(): Promise<Record<string, Record<string, Meal | null>>> {
  return get("/api/weekly-calendar");
}

export async function saveWeekMeal({ date, slot, meal }: { date: string; slot: string; meal: Meal }) {
  return put(`/api/weekly-calendar/${date}/${slot}`, { meal });
}

export async function deleteWeekMeal({ date, slot }: { date: string; slot: string }) {
  return del(`/api/weekly-calendar/${date}/${slot}`);
}

export async function addMealToMacros({ date, slot, meal }: { date: string; slot: string; meal: Meal }) {
  // Use the same working pattern as craving creator
  console.log("📊 Adding meal to macros:", { date, slot, meal: meal.title });
  
  const logEntry = {
    id: meal.id || crypto.randomUUID(),
    name: `${meal.title} (${meal.servings || 1} serving${meal.servings !== 1 ? "s" : ""})`,
    date: date || new Date().toISOString().split("T")[0], // YYYY-MM-DD format
    time: new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    }),
    calories: meal.nutrition.calories,
    protein: meal.nutrition.protein,
    carbs: meal.nutrition.carbs,
    fat: meal.nutrition.fat,
    fiber: 0, // Default values for missing fields
    sugar: 0,
    sodium: 0,
    meal_type: slot || 'lunch',
    timestamp: new Date().toISOString(),
  };

  console.log("📝 Sending log entry:", logEntry);

  const result = await post("/api/food-logs", logEntry);
  
  // Trigger macro refresh in Biometrics dashboard
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("macros:updated"));
  }

  console.log("✅ Successfully added to macros:", result);
  return result;
}

export async function regenerateMealCard({ date, slot, baseMeal }: { date: string; slot: string; baseMeal: Meal }) {
  // For week board system, we'll generate a new random meal from templates
  // This is a client-side regeneration that picks a different template
  const { TEMPLATE_SETS } = await import('@/data/templateSets');
  
  // Map slot to template list
  const listName = slot as "breakfast"|"lunch"|"dinner"|"snacks";
  const templates = TEMPLATE_SETS[listName] || [];
  
  // Filter out current meal and pick random different one
  const others = templates.filter(t => t.id !== baseMeal.id);
  const pick = others[Math.floor(Math.random() * others.length)];
  
  if (!pick) throw new Error('No alternative meals available');
  
  // Return with new ID to avoid conflicts
  return {
    ...pick,
    id: 'regen_' + Math.random().toString(36).slice(2)
  };
}

export async function replaceMealWithCraving({ date, slot }: { date: string; slot: string }) {
  // Store return info for craving creator navigation
  localStorage.setItem('cravingReturn', JSON.stringify({
    returnTo: 'weekly-meal-board',
    date,
    slot,
    timestamp: Date.now()
  }));
  
  // Navigate to craving creator
  window.location.href = '/craving-creator';
  
  // Return placeholder since we're navigating away
  return { navigated: true };
}

export async function replaceMealWithFridge({ date, slot }: { date: string; slot: string }) {
  // Store return info for fridge rescue navigation
  localStorage.setItem('fridgeReturn', JSON.stringify({
    returnTo: 'weekly-meal-board',
    date,
    slot,
    timestamp: Date.now()
  }));
  
  // Navigate to fridge rescue
  window.location.href = '/fridge-rescue';
  
  // Return placeholder since we're navigating away
  return { navigated: true };
}

/** Bulk upsert meals into the weekly calendar (server source of truth). */
export async function upsertWeekPlanBulk(payload: {
  startDate: string;
  items: Array<{ date: string; slot: "breakfast"|"lunch"|"dinner"; meal: Meal }>;
}) {
  // Debug: log payload size so we know items isn't empty
  if (!payload?.items?.length) {
    throw new Error("No items to save (payload.items is empty). Check Classic Builder output.");
  }

  return post("/api/weekly-calendar/bulk-upsert", payload);
}

/** Fetch server plan first; if empty and legacy local data exists, migrate it once. */
export async function getWeekPlanWithMigration(): Promise<Record<string, Record<string, Meal | null>>> {
  // 1) Try server
  let data = await get<Record<string, Record<string, Meal | null>>>("/api/weekly-calendar");

  // If server has data, return it
  if (data && Object.keys(data).length > 0) return data;

  // 2) Check legacy Classic Builder localStorage (adjust keys to your actual ones)
  const legacy = window.localStorage.getItem("weeklyPlan:00000000-0000-0000-0000-000000000001"); // PlanMeal[] JSON
  const legacyWeek = window.localStorage.getItem("weeklyPlan");

  if (!legacy && !legacyWeek) return data; // nothing to migrate

  // 3) Transform and push to server
  try {
    let parsed: any[] = [];
    if (legacy) {
      const legacyData = JSON.parse(legacy);
      parsed = legacyData.meals || [];
    } else if (legacyWeek) {
      parsed = JSON.parse(legacyWeek);
    }
    
    const sd = new Date().toISOString().slice(0,10);
    const items = transformLegacyPlanMealsToCalendarItems(parsed, sd);
    if (items.length) {
      await upsertWeekPlanBulk({ startDate: sd, items });
      // Re-fetch
      data = await get("/api/weekly-calendar");
      // Clear legacy so it doesn't repeat
      window.localStorage.removeItem("weeklyPlan:00000000-0000-0000-0000-000000000001");
      window.localStorage.removeItem("weeklyPlan");
    }
  } catch (e) {
    console.log("Migration skipped due to data format:", e);
    // if bad data, just ignore
  }

  return data;
}

/** Map legacy PlanMeal[] to server calendar items */
export function transformLegacyPlanMealsToCalendarItems(
  planMeals: Array<{
    name?: string;
    title?: string;
    type?: string;          // sometimes used instead of mealType
    mealType?: string;      // "Breakfast" | "Lunch" | "Dinner" | etc
    dayIndex?: number;      // 0..6
    servings?: number;
    nutrition?: { calories:number; protein:number; carbs:number; fat:number } | any;
    ingredients?: Array<{ item?: string; name?: string; amount?: string } | string> | any;
    instructions?: string[];
    badges?: string[];
  }>,
  startDate: string
) {
  const slotMap: Record<string, "breakfast"|"lunch"|"dinner"> = {
    breakfast: "breakfast",
    lunch: "lunch",
    dinner: "dinner",
  };

  const items: Array<{ date: string; slot: "breakfast"|"lunch"|"dinner"; meal: Meal }> = [];

  for (const pm of planMeals || []) {
    const idx = Number.isFinite(pm.dayIndex) ? (pm.dayIndex as number) : 0;
    const date = isoDateAddDays(startDate, idx);

    // accept mealType OR type, case-insensitive; fallback to dinner
    const rawSlot = (pm.mealType ?? pm.type ?? "").toString().toLowerCase();
    const slot = slotMap[rawSlot] ?? "dinner";

    const meal: Meal = {
      id: cryptoRandomId(),
      title: (pm.title || pm.name || "Generated Meal").toString().trim(),
      servings: Math.max(1, pm.servings ?? 1),
      ingredients: normalizeIngredients(pm.ingredients),
      instructions: Array.isArray(pm.instructions) ? pm.instructions.filter(Boolean) : [],
      nutrition: normalizeNutrition(pm.nutrition),
      badges: Array.isArray(pm.badges) ? pm.badges.filter(Boolean) : [],
    };

    items.push({ date, slot, meal });
  }

  return items;
}

/** Accepts mixed shapes → { item, amount }[] */
function normalizeIngredients(raw: any): { item: string; amount: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { item: string; amount: string }[] = [];
  for (const ing of raw) {
    if (!ing) continue;
    if (typeof ing === "string") { out.push({ item: ing.trim(), amount: "" }); continue; }
    const item = (ing.item ?? ing.name ?? "").toString().trim();
    const amount = (ing.amount ?? "").toString().trim();
    if (item) out.push({ item, amount });
  }
  return out;
}

function normalizeNutrition(nut: any): { calories:number; protein:number; carbs:number; fat:number } {
  const num = (n:any) => (Number.isFinite(+n) ? +n : 0);
  if (!nut || typeof nut !== "object") return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return { calories: num(nut.calories), protein: num(nut.protein), carbs: num(nut.carbs), fat: num(nut.fat) };
}

function isoDateAddDays(iso: string, days: number) {
  const d = new Date(iso+"T00:00:00"); d.setDate(d.getDate() + (days|0)); return d.toISOString().slice(0,10);
}
function cryptoRandomId() {
  try { return (crypto as any).randomUUID?.() || "id_"+Math.random().toString(36).slice(2); }
  catch { return "id_"+Math.random().toString(36).slice(2); }
}
