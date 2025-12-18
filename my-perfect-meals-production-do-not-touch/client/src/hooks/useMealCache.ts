import { useCallback } from "react";
import type { MealData } from "@/components/MealCard";
import { getWeekKey } from "@/lib/weekKey";

interface CalendarDaySlot { id: string; meal: MealData; }
interface WeekState { weekStartISO: string; days: CalendarDaySlot[][]; }

const keyFor = (userId: string, weekKey: string) => `mealCache:${userId}:${weekKey}`;

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day; // start Sunday
  const start = new Date(d.setDate(diff));
  start.setHours(0,0,0,0);
  return start.toISOString();
}

export function useMealCache() {
  const userId = "current"; // TODO: replace with real auth user id
  const weekStartISO = getWeekStart();
  const weekKey = getWeekKey();

  // New methods for week-based storage
  const getMealsForWeek = useCallback((userId: string, weekKey: string) => {
    try {
      const raw = localStorage.getItem(keyFor(userId, weekKey));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.meals) ? parsed.meals : [];
    } catch {
      return [];
    }
  }, []);

  const setMealsForWeek = useCallback((userId: string, weekKey: string, meals: any[]) => {
    localStorage.setItem(keyFor(userId, weekKey), JSON.stringify({ meals }));
  }, []);

  // Legacy methods for compatibility with existing code
  const load = useCallback((): WeekState => {
    const raw = localStorage.getItem(keyFor(userId, weekKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      // If new format with meals array, convert to legacy format
      if (parsed.meals) {
        const days = Array.from({ length: 7 }, () => [] as CalendarDaySlot[]);
        parsed.meals.forEach((meal: any) => {
          const dayIndex = meal.dayIndex || 0;
          if (dayIndex >= 0 && dayIndex < 7) {
            days[dayIndex].push({ id: `${meal.id}:${Date.now()}`, meal });
          }
        });
        return { weekStartISO, days };
      }
      return parsed;
    }
    const empty: WeekState = { weekStartISO, days: Array.from({ length: 7 }, () => []) };
    localStorage.setItem(keyFor(userId, weekKey), JSON.stringify(empty));
    return empty;
  }, [userId, weekKey, weekStartISO]);

  const save = useCallback((state: WeekState) => {
    localStorage.setItem(keyFor(userId, weekKey), JSON.stringify(state));
  }, [userId, weekKey]);

  const addToCurrentWeek = useCallback((meal: MealData) => {
    const state = load();
    // find first day with < 3 slots (breakfast/lunch/dinner) as an example
    for (let d = 0; d < 7; d++) {
      if (state.days[d].length < 3) {
        state.days[d].push({ id: `${meal.id}:${Date.now()}`, meal });
        save(state);
        return;
      }
    }
    // if full, push to Sunday overflow
    state.days[0].push({ id: `${meal.id}:${Date.now()}`, meal });
    save(state);
  }, [load, save]);

  const getWeek = useCallback((): WeekState => load(), [load]);

  const replaceSlot = useCallback((dayIndex: number, slotIndex: number, meal: MealData) => {
    const state = load();
    state.days[dayIndex][slotIndex] = { id: `${meal.id}:${Date.now()}`, meal };
    save(state);
  }, [load, save]);

  const clearWeek = useCallback(() => {
    const empty: WeekState = { weekStartISO, days: Array.from({ length: 7 }, () => []) };
    save(empty);
  }, [save, weekStartISO]);

  return { 
    getWeek, 
    addToCurrentWeek, 
    replaceSlot, 
    clearWeek,
    getMealsForWeek, 
    setMealsForWeek 
  };
}