// Family Recipe Nutrition Computation Service
export interface IngredientRow { 
  qty: number; 
  unit: string; 
  item: string; 
  notes?: string 
}

export interface ComputedNutrition { 
  calories: number; 
  protein: number; 
  carbs: number; 
  fat: number; 
  fiber: number; 
  sodium: number; 
  badges: string[] 
}

export async function computeNutritionAndBadges(rows: IngredientRow[], servings: number): Promise<ComputedNutrition> {
  // Basic nutrition estimation - can be enhanced with real food database
  const totals = rows.reduce((acc, r) => {
    const g = unitToGrams(r.qty, r.unit);
    const item = r.item.toLowerCase();
    
    // Smart estimation based on ingredient type
    if (item.includes('chicken') || item.includes('turkey') || item.includes('fish')) {
      acc.calories += g * 1.65; // protein-rich
      acc.protein += g * 0.25;
      acc.carbs += g * 0.02;
      acc.fat += g * 0.05;
    } else if (item.includes('beef') || item.includes('pork')) {
      acc.calories += g * 2.5; // higher fat
      acc.protein += g * 0.20;
      acc.carbs += g * 0.02;
      acc.fat += g * 0.15;
    } else if (item.includes('rice') || item.includes('pasta') || item.includes('bread')) {
      acc.calories += g * 3.6; // carb-heavy
      acc.protein += g * 0.08;
      acc.carbs += g * 0.75;
      acc.fat += g * 0.02;
    } else if (item.includes('oil') || item.includes('butter')) {
      acc.calories += g * 8.8; // pure fat
      acc.protein += g * 0.01;
      acc.carbs += g * 0.01;
      acc.fat += g * 0.98;
    } else if (item.includes('vegetable') || item.includes('broccoli') || item.includes('spinach')) {
      acc.calories += g * 0.4; // low calorie
      acc.protein += g * 0.03;
      acc.carbs += g * 0.08;
      acc.fat += g * 0.005;
      acc.fiber += g * 0.03;
    } else {
      // Generic fallback
      acc.calories += g * 1.2;
      acc.protein += g * 0.05;
      acc.carbs += g * 0.1;
      acc.fat += g * 0.03;
    }
    
    acc.sodium += 150; // baseline per ingredient
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 });

  // Generate medical compatibility badges
  const badges: string[] = [];
  const perServing = {
    calories: totals.calories / Math.max(1, servings),
    carbs: totals.carbs / Math.max(1, servings),
    fat: totals.fat / Math.max(1, servings),
    sodium: totals.sodium / Math.max(1, servings),
    fiber: totals.fiber / Math.max(1, servings)
  };

  if (perServing.carbs < 30) badges.push("Low Carb Friendly");
  if (perServing.fat < 15) badges.push("Heart Smart");
  if (perServing.sodium < 600) badges.push("Low Sodium");
  if (perServing.fiber > 5) badges.push("High Fiber");
  if (perServing.calories < 400) badges.push("Light Meal");

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
    sodium: Math.round(totals.sodium),
    badges
  };
}

function unitToGrams(qty: number, unit: string): number {
  const u = (unit || "").toLowerCase();
  if (u.includes("g")) return qty;
  if (u.includes("kg")) return qty * 1000;
  if (u.includes("oz")) return qty * 28.35;
  if (u.includes("lb")) return qty * 453.59;
  if (u.includes("cup")) return qty * 120; // average
  if (u.includes("tbsp")) return qty * 15;
  if (u.includes("tsp")) return qty * 5;
  return qty * 30; // default guess
}

export function scaleIngredients(rows: IngredientRow[], fromServings: number, toServings: number): IngredientRow[] {
  const factor = toServings / Math.max(1, fromServings);
  return rows.map(r => ({ 
    ...r, 
    qty: roundSmart(r.qty * factor) 
  }));
}

function roundSmart(n: number): number {
  // Round to nearest 0.5 for smaller amounts, whole numbers for larger
  const abs = Math.abs(n);
  if (abs >= 2) return Math.round(n);
  return Math.round(n * 2) / 2;
}