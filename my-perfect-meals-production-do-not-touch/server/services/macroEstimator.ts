// server/services/macroEstimator.ts
// Tiny macro table to estimate when model leaves fields blank or to verify bands.
export type Macro = { kcal: number; protein: number; carbs: number; fat: number };

const per100g: Record<string, Macro> = {
  "chicken breast": { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  "beef": { kcal: 250, protein: 26, carbs: 0, fat: 17 },
  "salmon": { kcal: 208, protein: 20, carbs: 0, fat: 13 },
  "rice": { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  "quinoa": { kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  "oats": { kcal: 389, protein: 17, carbs: 66, fat: 7 },
  "egg": { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  "olive oil": { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  "broccoli": { kcal: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  "banana": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "peanut butter": { kcal: 588, protein: 25, carbs: 20, fat: 50 },
  "yogurt": { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
};

// Basic parser for common units to grams (best-effort; conservative)
const gramsPerUnit: Record<string, number> = {
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  cup: 240, cups: 240,
  tbsp: 14, tsp: 5, g: 1, kg: 1000,
  piece: 100, medium: 100, large: 120, small: 80, clove: 5, slice: 30,
};

export function estimateMacros(ingredients: { name: string; amount: string }[]): Macro | null {
  let total: Macro = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const ing of (ingredients || [])) {
    const name = ing.name.toLowerCase();
    const baseKey = Object.keys(per100g).find(k => name.includes(k));
    if (!baseKey) continue;
    
    const amt = String(ing.amount || "").toLowerCase();
    const m = amt.match(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|cup|cups|tbsp|tsp|g|kg|piece|medium|large|small|clove|slice)?/);
    const qty = m ? parseFloat(m[1]) : 0;
    const unit = (m?.[2] || "g") as keyof typeof gramsPerUnit;
    const grams = qty * (gramsPerUnit[unit] ?? 0);
    
    if (!grams) continue;
    
    const per = per100g[baseKey];
    total.kcal += (per.kcal * grams) / 100;
    total.protein += (per.protein * grams) / 100;
    total.carbs += (per.carbs * grams) / 100;
    total.fat += (per.fat * grams) / 100;
  }
  
  // If we have nothing, return null so caller can skip enforcing macro bands
  if (total.kcal === 0 && total.protein === 0 && total.carbs === 0 && total.fat === 0) return null;
  
  // Round sensibly
  total = { 
    kcal: Math.round(total.kcal), 
    protein: Math.round(total.protein), 
    carbs: Math.round(total.carbs), 
    fat: Math.round(total.fat) 
  };
  
  return total;
}