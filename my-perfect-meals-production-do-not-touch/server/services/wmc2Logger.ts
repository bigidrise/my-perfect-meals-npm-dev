// server/services/wmc2Logger.ts
// Thin logger that posts to existing (locked) meal logs API.
export type LogMealInput = {
  userId: string;
  iso: string;           // ISO timestamp
  timezone: string;      // e.g., "America/Chicago"
  mealType: string;      // Breakfast | Lunch | Dinner | Snack
  name: string;
  ingredients: Array<{ name: string; amount: string }>;
  calories?: number | null; 
  protein?: number | null; 
  carbs?: number | null; 
  fats?: number | null;
  source?: string;       // e.g., "ai-meal-creator"
};

const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";

async function postJSON(url: string, body: any, ms = 15000) {
  const ctrl = new AbortController(); 
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(body), 
      signal: ctrl.signal 
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally { 
    clearTimeout(t); 
  }
}

export async function logMealViaLockedAPI(input: LogMealInput) {
  // Call the locked meal logging API safely
  const url = `${INTERNAL_API_BASE}/api/mealLogs/log`;
  const payload = {
    userId: input.userId,
    timestamp: input.iso,
    timezone: input.timezone,
    mealType: input.mealType,
    name: input.name,
    ingredients: input.ingredients,
    calories: input.calories ?? null,
    protein: input.protein ?? null,
    carbs: input.carbs ?? null,
    fats: input.fats ?? null,
    source: input.source ?? "ai-meal-creator",
  };
  return postJSON(url, payload, 15000);
}