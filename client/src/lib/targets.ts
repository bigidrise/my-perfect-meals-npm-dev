export type Targets = { 
  calories?: number; 
  protein?: number; 
  carbs?: number; 
  fat?: number; 
};

export function deriveTargetsFromUser(u: {
  goal: "LOSS" | "MAINTAIN" | "GAIN";
  weightKg: number;
  sex: "male" | "female" | "other";
  mealsPerDay?: number;
  proteinPerDay?: number; // may be precomputed on server
  calorieTarget?: number; // optional override
}): Targets {
  // Protein/day: prefer server-derived value if present
  let protein = u.proteinPerDay;
  if (!protein) {
    const gkg =
      u.goal === "GAIN" ? (u.sex === "female" ? 1.8 : 2.0) :
      u.goal === "MAINTAIN" ? (u.sex === "female" ? 1.4 : 1.6) :
      (u.sex === "female" ? 1.6 : 1.8);
    protein = Math.round(gkg * u.weightKg);
  }

  // Calories: use user override if present, else simple goal heuristic
  const base = u.calorieTarget ?? 0;
  const calories = base || heuristicCalories(u.goal, u.weightKg);

  return { calories, protein };
}

function heuristicCalories(goal: "LOSS" | "MAINTAIN" | "GAIN", weightKg: number) {
  // crude but safe: 28/33/38 kcal/kg day
  const kcalPerKg = goal === "GAIN" ? 38 : goal === "MAINTAIN" ? 33 : 28;
  return Math.round(kcalPerKg * weightKg);
}

// Fallback targets for when user data is incomplete
export function getDefaultTargets(): Targets {
  return {
    calories: 2000,
    protein: 140,
  };
}

/* --------- Weekly Meal Board Targets System --------- */

export type WeeklyMacroTargets = {
  daily: { calories: number; protein: number; carbs: number; fat: number };
  weekly: { calories: number; protein: number; carbs: number; fat: number };
};

export function computeTargetsFromOnboarding(profile: {
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
}): WeeklyMacroTargets {
  const d = {
    calories: round(profile.dailyCalories ?? 2000),
    protein:  round(profile.proteinGrams ?? 120),
    carbs:    round(profile.carbsGrams ?? 200),
    fat:      round(profile.fatGrams ?? 67),
  };
  return { daily: d, weekly: mul(d, 7) };
}

export function sumMealList(meals: any[]) {
  return meals.reduce((acc, m) => add(acc, m?.nutrition), { calories:0, protein:0, carbs:0, fat:0, starchyCarbs:0, fibrousCarbs:0 });
}

export function sumBoard(board: { lists: Record<string, any[]> }) {
  const b = sumMealList(board.lists.breakfast || []);
  const l = sumMealList(board.lists.lunch || []);
  const d = sumMealList(board.lists.dinner || []);
  const s = sumMealList(board.lists.snacks || []);
  return add(add(b,l), add(d,s));
}

/* ----------------- helpers ----------------- */
function add(a:any={}, b:any={}){
  return {
    calories: round((a.calories||0)+(b.calories||0)),
    protein:  round((a.protein ||0)+(b.protein ||0)),
    carbs:    round((a.carbs   ||0)+(b.carbs   ||0)),
    fat:      round((a.fat     ||0)+(b.fat     ||0)),
    starchyCarbs: round((a.starchyCarbs||0)+(b.starchyCarbs||0)),
    fibrousCarbs: round((a.fibrousCarbs||0)+(b.fibrousCarbs||0)),
  };
}
function mul(a:any={}, k:number){
  return {
    calories: round((a.calories||0)*k),
    protein:  round((a.protein ||0)*k),
    carbs:    round((a.carbs   ||0)*k),
    fat:      round((a.fat     ||0)*k),
    starchyCarbs: round((a.starchyCarbs||0)*k),
    fibrousCarbs: round((a.fibrousCarbs||0)*k),
  };
}
function round(n:number){ return Math.round((n ?? 0) * 10) / 10; }