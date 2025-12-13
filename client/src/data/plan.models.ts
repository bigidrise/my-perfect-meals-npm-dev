// Weekly Planner Data Models (Phase 2.5)

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack1" | "snack2";

export interface PlannedMeal {
  id: string;                     // stable if from preset/template
  name: string;
  image?: string;
  mealType: MealSlot;
  servings: number;               // current selected servings
  baseServings: number;           // from template (usually 1)
  source: "template" | "preset" | "craving" | "fridge" | "kids";
  archetype?: string;
  ingredients: { name: string; quantity: number; unit?: string }[];
  instructions: string[];
  nutritionPerServing?: { calories: number; protein: number; carbs: number; fat: number };
  badges?: string[];
  swaps?: Record<string, string>; // ingredient swaps applied
}

export interface DayPlan {
  dateISO: string;                // YYYY-MM-DD
  meals: Partial<Record<MealSlot, PlannedMeal | null>>;
  times: Partial<Record<MealSlot, string>>; // e.g., "07:30", "12:00"
  snacksEnabled: number;          // 0,1,2
}

export interface WeekPlan {
  weekStartISO: string;           // Monday (or locale start)
  days: DayPlan[];                // length 7
  userId: string;
  version: number;                // increment on save
}

// Default meal times
export const DEFAULT_MEAL_TIMES: Record<MealSlot, string> = {
  breakfast: "07:30",
  lunch: "12:00", 
  dinner: "18:30",
  snack1: "10:30",
  snack2: "15:30"
};

// Utility functions
export function getWeekStartISO(date: Date = new Date()): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Monday
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

export function generateWeekDates(weekStartISO: string): string[] {
  const dates = [];
  const start = new Date(weekStartISO);
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export function createEmptyWeekPlan(userId: string, weekStartISO?: string): WeekPlan {
  const start = weekStartISO || getWeekStartISO();
  const dates = generateWeekDates(start);
  
  return {
    weekStartISO: start,
    userId,
    version: 1,
    days: dates.map(dateISO => ({
      dateISO,
      meals: {},
      times: { ...DEFAULT_MEAL_TIMES },
      snacksEnabled: 1 // Default to 1 snack per day
    }))
  };
}