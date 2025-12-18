// client/src/utils/computeTargets.ts
// Science-driven targets based on Coach's rules.
// - Protein: 1g/lb (loss/maint), 2g/lb men gain, 1.5g/lb women gain
// - Starchy carbs daily ranges by goal & sex (see CARB_RANGES)
// - Veg: 2–3 cups/day
// - Fats: implicit (come from protein sources & dressings), no explicit target here.

export type Goal = "loss" | "maintenance" | "gain";
export type Sex = "male" | "female";

export interface OnboardingInput {
  goal: Goal;
  sex: Sex;
  desiredWeightLb: number;   // user's target/desired weight in lb
  mealsPerDay: number;       // e.g., 3–5
  snacksPerDay: number;      // 0–2 (we still return per-meal targets ignoring snacks, see note)
  carbBias?: "even" | "workout"; // optional distribution preference
}

export interface MacroTargets {
  goal: Goal;
  sex: Sex;
  desiredWeightLb: number;
  mealsPerDay: number;
  snacksPerDay: number;

  // Daily targets
  proteinPerDay_g: number;
  starchyCarbsPerDay_g_min: number;
  starchyCarbsPerDay_g_max: number;
  vegCupsPerMeal_min: number; // 2
  vegCupsPerMeal_max: number; // 3

  // Per-meal targets (meals only; snacks are optional add-ons)
  proteinPerMeal_g: number;
  // For carbs we provide a suggested per-meal window if spread evenly across meals.
  starchyCarbsPerMeal_g_min: number;
  starchyCarbsPerMeal_g_max: number;

  // Optional "workout focus" suggestion for UI (carb biasing)
  notes?: string[];
}

// Carb ranges per day (starchy carbs) by GOAL & SEX
const CARB_RANGES: Record<Goal, Record<Sex, [number, number]>> = {
  loss: {
    female: [25, 35],
    male: [50, 75],
  },
  maintenance: {
    female: [30, 50],
    male: [75, 125],
  },
  gain: {
    female: [50, 100],
    male: [150, 200],
  },
};

function roundToMode(value: number, mode: "tenth" | "half" | "whole" = "whole") {
  switch (mode) {
    case "tenth": return Math.round(value * 10) / 10;
    case "half":  return Math.round(value * 2) / 2;
    default:      return Math.round(value);
  }
}

function computeProteinPerDay(goal: Goal, sex: Sex, desiredWeightLb: number) {
  if (goal === "gain") {
    return sex === "female" ? 1.5 * desiredWeightLb : 2.0 * desiredWeightLb;
  }
  // loss or maintenance
  return 1.0 * desiredWeightLb;
}

/**
 * Core calculator: returns daily + per-meal targets.
 * Per-meal is divided across *meals* only; snacks are optional add-ons.
 * (In the planner you can bias carb distribution to lunch/dinner/workout slots.)
 */
export function computeTargets(
  input: OnboardingInput,
  rounding: "tenth" | "half" | "whole" = "whole"
): MacroTargets {
  const meals = Math.max(1, Math.min(8, Math.floor(input.mealsPerDay || 4)));
  const snacks = Math.max(0, Math.min(2, Math.floor(input.snacksPerDay || 0)));

  // Protein
  const proteinPerDay = computeProteinPerDay(input.goal, input.sex, input.desiredWeightLb);
  const proteinPerMeal = proteinPerDay / meals;

  // Carbs (starchy) – daily range by goal & sex
  const [carbMinDay, carbMaxDay] = CARB_RANGES[input.goal][input.sex];

  // Even split across meals (snacks get veg/protein bias; starchy carbs optional)
  const carbMinPerMeal = carbMinDay / meals;
  const carbMaxPerMeal = carbMaxDay / meals;

  const notes: string[] = [];
  notes.push("Low-GI starchy carbs preferred (quinoa, sweet potato, oats, brown rice, legumes).");
  notes.push("Fats come from proteins and dressings; no extra fats required.");
  notes.push("Vegetables target: 2–3 cups of fibrous, non-starchy vegetables PER MEAL.");

  if (input.carbBias === "workout") {
    notes.push("Carb bias: allocate a larger share of starchy carbs to pre/post-workout meals.");
  } else {
    notes.push("Carb split: even across meals by default; snacks can be protein/veg dominant.");
  }

  return {
    goal: input.goal,
    sex: input.sex,
    desiredWeightLb: input.desiredWeightLb,
    mealsPerDay: meals,
    snacksPerDay: snacks,

    proteinPerDay_g: roundToMode(proteinPerDay, rounding),
    starchyCarbsPerDay_g_min: Math.round(carbMinDay),
    starchyCarbsPerDay_g_max: Math.round(carbMaxDay),
    vegCupsPerMeal_min: 2,
    vegCupsPerMeal_max: 3,

    proteinPerMeal_g: roundToMode(proteinPerMeal, rounding),
    starchyCarbsPerMeal_g_min: roundToMode(carbMinPerMeal, rounding),
    starchyCarbsPerMeal_g_max: roundToMode(carbMaxPerMeal, rounding),

    notes,
  };
}

/**
 * Helper: given the daily carb window and meals/day, compute a suggested allocation
 * for each meal slot name. Useful when you want to bias carbs to lunch/dinner.
 */
export function distributeCarbsAcrossMeals(
  targets: MacroTargets,
  mealOrder: string[] = ["breakfast", "lunch", "dinner"],
  pattern: "even" | "lunchDinnerHeavy" | "dinnerHeavy" | "workoutFocus" = "even"
) {
  const range = [
    targets.starchyCarbsPerDay_g_min,
    targets.starchyCarbsPerDay_g_max,
  ] as const;

  const meals = mealOrder.length || 3;
  const avgMin = range[0] / meals;
  const avgMax = range[1] / meals;

  // weights must sum to meals; keep it simple & deterministic
  let weights: number[] = new Array(meals).fill(1);

  if (pattern === "lunchDinnerHeavy" && meals >= 3) weights = [0.8, 1.2, 1.0];
  if (pattern === "dinnerHeavy" && meals >= 3)      weights = [0.7, 0.9, 1.4];
  if (pattern === "workoutFocus")                   weights = weights.map((w, i) => (i === 1 ? 1.5 : 0.75)); // bias 2nd slot

  const totalW = weights.reduce((a, b) => a + b, 0);
  const norm = weights.map(w => w / totalW * meals);

  const perMealMin = norm.map(w => roundToMode(avgMin * w, "whole"));
  const perMealMax = norm.map(w => roundToMode(avgMax * w, "whole"));

  return mealOrder.map((slot, idx) => ({
    slot,
    starchyCarbsMin_g: perMealMin[idx],
    starchyCarbsMax_g: perMealMax[idx],
  }));
}

export function veggieCupsPerMeal(targets: MacroTargets) {
  return { min: targets.vegCupsPerMeal_min, max: targets.vegCupsPerMeal_max };
}