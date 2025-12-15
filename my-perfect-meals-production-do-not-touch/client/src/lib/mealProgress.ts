
// Simple per-day meal progression store

export type MealId =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack1"
  | "snack2";

const ORDER: MealId[] = ["breakfast", "lunch", "dinner", "snack1", "snack2"];

const keyForToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `mpm.mealProgress.${y}-${m}-${day}`;
};

export function getProgress(): Partial<Record<MealId, boolean>> {
  try {
    const raw = localStorage.getItem(keyForToday());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCompleted(mealId: MealId) {
  const data = getProgress();
  data[mealId] = true;
  localStorage.setItem(keyForToday(), JSON.stringify(data));
}

export function resetToday() {
  localStorage.removeItem(keyForToday());
}

export function nextIncomplete(mealsPresent?: MealId[]): MealId | null {
  const data = getProgress();
  const list = mealsPresent && mealsPresent.length ? mealsPresent : ORDER;
  for (const id of list) {
    if (!data[id]) return id;
  }
  return null;
}
