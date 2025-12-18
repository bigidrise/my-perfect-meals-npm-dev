// Shared nutrition utilities with calories standardization
export type Targets = { calories: number; protein: number; carbs: number; fat: number };

export function normalizeTargets(t: any): Targets {
  return {
    calories: Number(t?.calories ?? t?.kcal ?? 0),
    protein:  Number(t?.protein ?? 0),
    carbs:    Number(t?.carbs ?? 0),
    fat:      Number(t?.fat ?? 0),
  };
}

// Sum helper (safe for pages/totals)
export function sumTargets(list: any[]): Targets {
  return list.reduce((acc, item) => {
    const t = normalizeTargets(item);
    acc.calories += t.calories;
    acc.protein  += t.protein;
    acc.carbs    += t.carbs;
    acc.fat      += t.fat;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}