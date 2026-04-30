import type { Meal } from "@/components/MealCard";
import { get, put, post } from "@/lib/api";
import { weekDatesInTZ } from "@/utils/midnight";

// ---------- Types (extend existing) ----------
export type Ingredient = { item: string; amount: string };

// Extended Meal type to support unlimited snacks with ordering and quick entry
export type ExtendedMeal = Meal & {
  // Existing (from earlier)
  orderIndex?: number;  // for snacks ordering
  name?: string;        // "Snack 2", "Post-Workout", etc.

  // NEW (snack quick-log support)
  entryType?: 'quick' | 'recipe';     // default 'quick' for snacks
  brand?: string;                     // optional brand (e.g., Quest)
  servingDesc?: string;               // "1 bar (40g)", "1 medium (182g)"
  includeInShoppingList?: boolean;    // default false for quick snacks
};

export type WeekLists = {
  breakfast: ExtendedMeal[];
  lunch: ExtendedMeal[];
  dinner: ExtendedMeal[];
  snacks: ExtendedMeal[];
  meal4: ExtendedMeal[];
  meal5: ExtendedMeal[];
  meal6: ExtendedMeal[];
};

export type WeekBoard = {
  id: string;
  version: number;
  // BACKWARD-COMPAT: legacy single-day lists still supported
  lists: WeekLists;
  // NEW: per-day lists keyed by date (YYYY-MM-DD) for this week (Mon..Sun)
  days?: Record<string, WeekLists>;
  meta: { createdAt: string; lastUpdatedAt: string };
};

export type WeekBoardResponse = {
  weekStartISO: string; // 'YYYY-MM-DD' monday of the week
  week: WeekBoard;
};

export type ShoppingList = {
  pantry: string[]; // list once, no amounts
  groceries: Array<{ name: string; quantity?: string; unit?: string; amount?: string }>;
};

export type ShoppingListResponse = {
  weekStartISO: string;
  list: ShoppingList;
};

export async function getWeekBoard(): Promise<WeekBoard> {
  return get<WeekBoard>("/api/week-board");
}

export async function saveWeekBoard(board: WeekBoard): Promise<WeekBoard> {
  return put<WeekBoard>("/api/week-board", board);
}

export async function addMealToList(list: "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal: Meal, dateISO?: string): Promise<WeekBoard> {
  const body = dateISO ? { list, meal, dateISO } : { list, meal };
  return post<WeekBoard>("/api/week-board/add", body);
}

export async function removeMealFromList(list: "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", mealId: string, dateISO?: string): Promise<WeekBoard> {
  const body = dateISO ? { list, mealId, dateISO } : { list, mealId };
  return post<WeekBoard>("/api/week-board/remove", body);
}

// ---------- Helpers ----------
async function apiGet<T>(url: string): Promise<T> {
  return get<T>(url);
}

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  return put<T>(url, body as any);
}

// ---------- NEW Week-aware API ----------
/** Get current week board (server computes Monday in America/Chicago). */
export function getCurrentWeekBoard(proClientId?: string): Promise<WeekBoardResponse> {
  if (proClientId) {
    return apiGet<WeekBoardResponse>(`/api/pro/week-boards/${proClientId}/current-week`);
  }
  return apiGet<WeekBoardResponse>('/api/week-boards/current-week');
}

/** Get a specific week by its Monday ISO date (YYYY-MM-DD). */
export function getWeekBoardByDate(weekStartISO: string, proClientId?: string): Promise<WeekBoardResponse> {
  if (proClientId) {
    return apiGet<WeekBoardResponse>(`/api/pro/week-board/${proClientId}/${weekStartISO}`);
  }
  return apiGet<WeekBoardResponse>(`/api/week-board/${weekStartISO}`);
}

/** Save/replace a specific week (expects WeekBoard shape under 'week'). */
export function putWeekBoard(
  weekStartISO: string,
  week: WeekBoard,
  proClientId?: string,
  namespace?: string
): Promise<WeekBoardResponse> {
  if (proClientId) {
    const btPart = namespace ? `?bt=${encodeURIComponent(namespace)}` : '';
    return apiPut<WeekBoardResponse>(`/api/pro/week-board/${proClientId}/${weekStartISO}${btPart}`, { week });
  }
  const url = namespace
    ? `/api/weekly-board?week=${encodeURIComponent(weekStartISO)}&bt=${encodeURIComponent(namespace)}`
    : `/api/week-board/${weekStartISO}`;
  return apiPut<WeekBoardResponse>(url, { week });
}

/** Build shopping list for a given week (view-only list). */
export function getShoppingList(weekStartISO: string, dateISO?: string): Promise<ShoppingListResponse> {
  const url = dateISO 
    ? `/api/shopping-list/${weekStartISO}?dateISO=${dateISO}`
    : `/api/shopping-list/${weekStartISO}`;
  return apiGet<ShoppingListResponse>(url);
}

// ---------- 7-Day Planning Helpers ----------

/** Generate 7 consecutive date strings (Mon-Sun) for a week starting on weekStartISO
 *  Uses noon UTC anchor pattern for timezone safety (Chicago Calendar Fix v1.0)
 */
export function weekDates(weekStartISO: string): string[] {
  return weekDatesInTZ(weekStartISO);
}

/** Get lists for a specific day, ensuring the day exists in the board */
export function getDayLists(board: WeekBoard, dateISO: string): WeekLists {
  if (!board.days) {
    board.days = {};
  }
  
  if (!board.days[dateISO]) {
    board.days[dateISO] = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      meal4: [],
      meal5: [],
      meal6: [],
    };
  }
  
  return board.days[dateISO];
}

/** Set lists for a specific day (immutable update) */
export function setDayLists(board: WeekBoard, dateISO: string, lists: WeekLists): WeekBoard {
  return {
    ...board,
    days: {
      ...board.days,
      [dateISO]: lists
    },
    meta: {
      ...board.meta,
      lastUpdatedAt: new Date().toISOString()
    }
  };
}

/** Update a specific meal's imageUrl anywhere in the board (days or lists structure).
 *  Used by page-level image loaders so image fetches survive modal close. */
export function updateMealImageInBoard(board: WeekBoard, mealId: string, imageUrl: string): WeekBoard {
  const slots = ['breakfast', 'lunch', 'dinner', 'snacks', 'meal4', 'meal5', 'meal6'] as const;

  let daysUpdated = false;
  let newDays = board.days;
  if (board.days) {
    newDays = { ...board.days };
    for (const day of Object.keys(board.days)) {
      const dayLists = board.days[day];
      const newDayLists = { ...dayLists };
      let dayChanged = false;
      for (const slot of slots) {
        if (newDayLists[slot]?.some(m => m.id === mealId)) {
          newDayLists[slot] = newDayLists[slot].map(m =>
            m.id === mealId ? { ...m, imageUrl } : m
          );
          dayChanged = true;
          daysUpdated = true;
        }
      }
      if (dayChanged) newDays![day] = newDayLists;
    }
  }

  let listsUpdated = false;
  let newLists = board.lists;
  for (const slot of slots) {
    if (board.lists[slot]?.some(m => m.id === mealId)) {
      newLists = {
        ...newLists,
        [slot]: newLists[slot].map(m =>
          m.id === mealId ? { ...m, imageUrl } : m
        ),
      };
      listsUpdated = true;
    }
  }

  if (!daysUpdated && !listsUpdated) return board;

  return { ...board, days: newDays, lists: newLists };
}

/** Get the current imageUrl for a meal anywhere in the board.
 *  Used as a guard before persisting an image update — avoids redundant saveBoard calls. */
export function getMealImageUrl(board: WeekBoard, mealId: string): string | null | undefined {
  const slots = ['breakfast', 'lunch', 'dinner', 'snacks', 'meal4', 'meal5', 'meal6'] as const;
  if (board.days) {
    for (const dayLists of Object.values(board.days)) {
      for (const slot of slots) {
        const meal = dayLists[slot]?.find(m => m.id === mealId);
        if (meal) return meal.imageUrl;
      }
    }
  }
  for (const slot of slots) {
    const meal = board.lists[slot]?.find(m => m.id === mealId);
    if (meal) return meal.imageUrl;
  }
  return undefined;
}

/**
 * Merge only permanent S3 imageUrls from serverBoard into localBoard.
 * Guardrails enforced:
 *   1. Only touches meal.imageUrl — nothing else.
 *   2. Only upgrades to an S3 URL (must include "s3").
 *   3. Never downgrades: will not overwrite an existing S3 URL.
 *   4. Returns the same object reference when nothing changed (avoids re-render).
 */
export function mergeImageUrlsOnly(localBoard: WeekBoard, serverBoard: WeekBoard): WeekBoard {
  const isS3 = (url: string | undefined | null): url is string =>
    typeof url === 'string' && url.includes('s3');

  // Build mealId → s3Url map from serverBoard (both days and lists)
  const s3Map = new Map<string, string>();
  const slots = ['breakfast', 'lunch', 'dinner', 'snacks', 'meal4', 'meal5', 'meal6'] as const;

  const collectFromLists = (lists: any) => {
    if (!lists) return;
    for (const slot of slots) {
      const arr = lists[slot];
      if (Array.isArray(arr)) {
        for (const m of arr) {
          if (m?.id && isS3(m.imageUrl)) {
            s3Map.set(m.id, m.imageUrl);
          }
        }
      }
    }
  };

  collectFromLists(serverBoard.lists);
  if (serverBoard.days) {
    for (const dayLists of Object.values(serverBoard.days)) {
      collectFromLists(dayLists);
    }
  }

  if (s3Map.size === 0) return localBoard;

  // Apply upgrades — only when local meal lacks an S3 URL and server has one
  const upgradeMealList = (meals: any[]): any[] => {
    if (!Array.isArray(meals)) return meals;
    let listChanged = false;
    const upgraded = meals.map((m: any) => {
      if (!m?.id) return m;
      const serverS3 = s3Map.get(m.id);
      if (!serverS3) return m;
      if (isS3(m.imageUrl)) return m; // already S3 — never downgrade
      listChanged = true;
      return { ...m, imageUrl: serverS3 };
    });
    return listChanged ? upgraded : meals;
  };

  const upgradeDayLists = (dayLists: any): any => {
    if (!dayLists) return dayLists;
    let dayChanged = false;
    const result: any = {};
    for (const slot of slots) {
      const before = dayLists[slot];
      const after = upgradeMealList(before || []);
      result[slot] = after;
      if (after !== before) dayChanged = true;
    }
    return dayChanged ? { ...dayLists, ...result } : dayLists;
  };

  const newLists = { ...localBoard.lists };
  let listsChanged = false;
  for (const slot of slots) {
    const before = (localBoard.lists as any)[slot];
    const after = upgradeMealList(before || []);
    if (after !== before) { (newLists as any)[slot] = after; listsChanged = true; }
  }

  let newDays = localBoard.days;
  let daysChanged = false;
  if (localBoard.days) {
    const upgraded: Record<string, any> = {};
    for (const [dateKey, dayLists] of Object.entries(localBoard.days)) {
      const after = upgradeDayLists(dayLists);
      upgraded[dateKey] = after;
      if (after !== dayLists) daysChanged = true;
    }
    if (daysChanged) newDays = upgraded;
  }

  if (!listsChanged && !daysChanged) return localBoard;

  return { ...localBoard, lists: newLists, days: newDays };
}

/** Safe deep-clone for environments without structuredClone */
export function structuredCloneSafe<T>(obj: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    // @ts-ignore
    return globalThis.structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/** Deep clone meals with new IDs for duplication */
export function cloneMealsWithNewIds(meals: ExtendedMeal[]): ExtendedMeal[] {
  const newId = () => `copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const cloned = structuredCloneSafe(meals) as ExtendedMeal[];
  return cloned.map((meal) => ({
    ...meal,
    id: newId(),
    // Preserve other properties like orderIndex for snacks
  }));
}

/** Deep clone day lists for duplication */
export function cloneDayLists(lists: WeekLists): WeekLists {
  const cloned = structuredCloneSafe(lists) as WeekLists;
  const newId = () => `copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  const reId = (meal: ExtendedMeal): ExtendedMeal => ({ ...meal, id: newId() });
  
  return {
    breakfast: cloned.breakfast.map(reId),
    lunch: cloned.lunch.map(reId),
    dinner: cloned.dinner.map(reId),
    snacks: cloned.snacks.map(reId),
    meal4: (cloned.meal4 || []).map(reId),
    meal5: (cloned.meal5 || []).map(reId),
    meal6: (cloned.meal6 || []).map(reId),
  };
}

// ---------- NEW Week-aware meal management ----------
/** Add meal to current week's board (replaces addMealToList for new system) */
export async function addMealToCurrentWeek(
  list: "breakfast"|"lunch"|"dinner"|"snacks", 
  meal: Meal
): Promise<WeekBoardResponse> {
  // Get current week
  const { weekStartISO, week } = await getCurrentWeekBoard();
  
  // Add meal to the appropriate list
  const updatedLists = { ...week.lists };
  updatedLists[list] = [...updatedLists[list], meal];
  
  // Create updated week board
  const updatedWeek: WeekBoard = {
    ...week,
    lists: updatedLists,
    version: week.version + 1,
    meta: {
      ...week.meta,
      lastUpdatedAt: new Date().toISOString()
    }
  };
  
  // Save updated week
  return putWeekBoard(weekStartISO, updatedWeek);
}

/** Remove meal from current week's board (replaces removeMealFromList for new system) */
export async function removeMealFromCurrentWeek(
  list: "breakfast"|"lunch"|"dinner"|"snacks", 
  mealId: string
): Promise<WeekBoardResponse> {
  // Get current week
  const { weekStartISO, week } = await getCurrentWeekBoard();
  
  // Remove meal from the appropriate list
  const updatedLists = { ...week.lists };
  updatedLists[list] = updatedLists[list].filter(meal => meal.id !== mealId);
  
  // Create updated week board
  const updatedWeek: WeekBoard = {
    ...week,
    lists: updatedLists,
    version: week.version + 1,
    meta: {
      ...week.meta,
      lastUpdatedAt: new Date().toISOString()
    }
  };
  
  // Save updated week
  return putWeekBoard(weekStartISO, updatedWeek);
}