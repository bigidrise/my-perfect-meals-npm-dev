import type { Meal } from "@/components/MealCard";
import { get, put, post } from "@/lib/api";

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
  snacks: ExtendedMeal[]; // unlimited snacks supported
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

export async function addMealToList(list: "breakfast"|"lunch"|"dinner"|"snacks", meal: Meal, dateISO?: string): Promise<WeekBoard> {
  const body = dateISO ? { list, meal, dateISO } : { list, meal };
  return post<WeekBoard>("/api/week-board/add", body);
}

export async function removeMealFromList(list: "breakfast"|"lunch"|"dinner"|"snacks", mealId: string, dateISO?: string): Promise<WeekBoard> {
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
export function getCurrentWeekBoard(): Promise<WeekBoardResponse> {
  return apiGet<WeekBoardResponse>('/api/week-boards/current-week');
}

/** Get a specific week by its Monday ISO date (YYYY-MM-DD). */
export function getWeekBoardByDate(weekStartISO: string): Promise<WeekBoardResponse> {
  return apiGet<WeekBoardResponse>(`/api/week-board/${weekStartISO}`);
}

/** Save/replace a specific week (expects WeekBoard shape under 'week'). */
export function putWeekBoard(
  weekStartISO: string,
  week: WeekBoard
): Promise<WeekBoardResponse> {
  return apiPut<WeekBoardResponse>(`/api/week-board/${weekStartISO}`, { week });
}

/** Build shopping list for a given week (view-only list). */
export function getShoppingList(weekStartISO: string, dateISO?: string): Promise<ShoppingListResponse> {
  const url = dateISO 
    ? `/api/shopping-list/${weekStartISO}?dateISO=${dateISO}`
    : `/api/shopping-list/${weekStartISO}`;
  return apiGet<ShoppingListResponse>(url);
}

// ---------- 7-Day Planning Helpers ----------

/** Generate 7 consecutive date strings (Mon-Sun) for a week starting on weekStartISO */
export function weekDates(weekStartISO: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(weekStartISO + 'T00:00:00Z');
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  
  return dates;
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
      snacks: []
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
    snacks: cloned.snacks.map(reId), // keep orderIndex as-is
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