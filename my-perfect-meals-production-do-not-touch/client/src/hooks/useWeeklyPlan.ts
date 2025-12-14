import type { MedicalBadge } from "@/data/curatedMeals";

export type PlanMeal = {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | string;
  dayIndex: number;   // 0..6
  weekKey: string;    // "YYYY-WW"
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  badges?: MedicalBadge[];
  ingredients?: Array<{ name: string; amount?: string | number }>;
  instructions?: string[];
  source?: "simple" | "advanced" | "templates" | "craving" | "fridge" | string;
  originId?: string;
};

const keyFor = (userId: string, weekKey: string) => `weeklyPlan:${userId}:${weekKey}`;

export function useWeeklyPlan(userId: string, weekKey: string) {
  const read = (): PlanMeal[] => {
    try {
      const raw = localStorage.getItem(keyFor(userId, weekKey));
      const j = raw ? JSON.parse(raw) : { meals: [] };
      return Array.isArray(j.meals) ? j.meals : [];
    } catch {
      return [];
    }
  };

  const write = (meals: PlanMeal[]) => {
    localStorage.setItem(keyFor(userId, weekKey), JSON.stringify({ meals }));
  };

  const addMany = (incoming: PlanMeal[]) => {
    const byId = new Map(read().map(m => [m.id, m]));
    incoming.forEach(m => byId.set(m.id, m));
    write([...byId.values()]);
  };

  const replaceOne = (id: string, meal: PlanMeal) => {
    const next = read().map(m => (m.id === id ? meal : m));
    write(next);
  };

  const removeOne = (id: string) => {
    write(read().filter(m => m.id !== id));
  };

  const clear = () => write([]);

  return { read, write, addMany, replaceOne, removeOne, clear };
}