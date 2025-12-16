// server/services/weekAssembler.ts
// Week assembly service with variety enforcement

import { enforceWeeklyCaps, meetsVariety } from "./rulesEngine";
import { deriveCarbSplit } from "./generators/macros/carbSplit";

export interface WeekAssemblyParams {
  poolByType: {
    breakfast: any[];
    lunch: any[];
    dinner: any[];
    snack: any[];
  };
  mealsPerDay: number;
  snacksPerDay: number;
  targets: {
    calories: number;
    protein: number;
  };
  scheduleTimes?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack1?: string;
  };
}

/**
 * Random picker utility
 */
const rndPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Add carb split to a meal (full meals only, not snacks)
 */
const addCarbSplit = (meal: any): any => {
  const { starchyGrams, fibrousGrams } = deriveCarbSplit(meal.ingredients || [], meal.carbs || 0);
  return { ...meal, starchyCarbs: starchyGrams, fibrousCarbs: fibrousGrams };
};

/**
 * Assembles a weekly meal plan with variety enforcement
 */
export function assembleWeek(params: WeekAssemblyParams) {
  const { poolByType, mealsPerDay, snacksPerDay, targets, scheduleTimes } = params;
  
  console.log(`🍽️ Assembling week: ${mealsPerDay} meals/day, ${snacksPerDay} snacks/day`);
  console.log(`🎯 Pool sizes:`, {
    breakfast: poolByType.breakfast.length,
    lunch: poolByType.lunch.length,
    dinner: poolByType.dinner.length,
    snack: poolByType.snack.length
  });

  const days: any[] = [];
  
  // Generate 7 days of meals
  for (let d = 0; d < 7; d++) {
    const meals: any[] = [];
    
    // Add meals based on mealsPerDay (with carb split for full meals)
    if (mealsPerDay >= 1 && poolByType.breakfast.length) {
      meals.push(addCarbSplit(rndPick(poolByType.breakfast)));
    }
    if (mealsPerDay >= 2 && poolByType.lunch.length) {
      meals.push(addCarbSplit(rndPick(poolByType.lunch)));
    }
    if (mealsPerDay >= 3 && poolByType.dinner.length) {
      meals.push(addCarbSplit(rndPick(poolByType.dinner)));
    }
    
    // Add snacks - NO carb split (user requirement: only full meals get the split)
    for (let s = 0; s < snacksPerDay; s++) {
      if (poolByType.snack.length) {
        meals.push(rndPick(poolByType.snack));
      }
    }
    
    days.push({ day: d + 1, meals });
  }

  // Apply variety enforcement with retry logic
  let attempts = 0;
  const maxAttempts = 25;
  
  while (attempts < maxAttempts) {
    const allMeals = days.map(d => d.meals);
    const { withinCaps } = enforceWeeklyCaps(allMeals);
    const { ok: varietyOk } = meetsVariety(allMeals);
    
    if (withinCaps && varietyOk) {
      console.log(`✅ Week assembled successfully after ${attempts} attempts`);
      break;
    }
    
    // Reshuffle a random meal to improve variety
    const dayIndex = Math.floor(Math.random() * 7);
    const mealIndex = Math.floor(Math.random() * Math.max(1, days[dayIndex].meals.length));
    const currentMeal = days[dayIndex].meals[mealIndex];
    const mealType = currentMeal.type as "breakfast" | "lunch" | "dinner" | "snack";
    
    const pool = poolByType[mealType];
    if (pool.length > 1) {
      // Pick a different meal from the pool
      let newMeal;
      do {
        newMeal = rndPick(pool);
      } while (newMeal.id === currentMeal.id && pool.length > 1);
      
      // Apply carb split for full meals (not snacks)
      if (mealType !== "snack") {
        days[dayIndex].meals[mealIndex] = addCarbSplit(newMeal);
      } else {
        days[dayIndex].meals[mealIndex] = newMeal;
      }
    }
    
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.warn("⚠️ Week assembly reached max attempts, using current state");
  }

  // Calculate weekly totals for validation
  const weeklyTotals = calculateWeeklyTotals(days);
  console.log(`📊 Weekly totals:`, weeklyTotals);

  // Format the response to match existing plan structure
  const planWeek = {
    week: 1,
    days: days,
    scheduleTimes: scheduleTimes ?? null
  };

  return [planWeek];
}

/**
 * Calculates total nutrition for the week
 */
function calculateWeeklyTotals(days: any[]) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  for (const day of days) {
    for (const meal of day.meals) {
      totalCalories += meal.calories || 0;
      totalProtein += meal.protein || 0;
      totalCarbs += meal.carbs || 0;
      totalFat += meal.fat || 0;
    }
  }
  
  return {
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    dailyAverage: {
      calories: Math.round(totalCalories / 7),
      protein: Math.round(totalProtein / 7),
      carbs: Math.round(totalCarbs / 7),
      fat: Math.round(totalFat / 7)
    }
  };
}

/**
 * Validates the assembled week meets basic requirements
 */
export function validateWeekPlan(plan: any[], targets: { calories: number; protein: number }) {
  if (!plan.length || !plan[0].days?.length) {
    return { valid: false, issues: ["No days in plan"] };
  }
  
  const issues: string[] = [];
  const week = plan[0];
  
  // Check each day has meals
  for (const day of week.days) {
    if (!day.meals?.length) {
      issues.push(`Day ${day.day} has no meals`);
    }
  }
  
  // Check protein targets (basic validation)
  const totals = calculateWeeklyTotals(week.days);
  const dailyProteinTarget = targets.protein;
  if (totals.dailyAverage.protein < dailyProteinTarget * 0.8) {
    issues.push(`Daily protein average (${totals.dailyAverage.protein}g) below 80% of target (${dailyProteinTarget}g)`);
  }
  
  return { valid: issues.length === 0, issues, totals };
}