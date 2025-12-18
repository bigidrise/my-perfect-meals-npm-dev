// client/src/utils/nutritionTargetsIntegration.ts
// Integration between existing user profile data and new science-driven targets

import { computeTargets, type OnboardingInput, type MacroTargets, type Goal, type Sex } from './computeTargets';

// Map existing fitness goals to our simplified goal types
function mapFitnessGoal(fitnessGoal?: string): Goal {
  switch (fitnessGoal) {
    case 'weight_loss':
      return 'loss';
    case 'muscle_gain':
      return 'gain';
    case 'maintenance':
    case 'endurance':
    default:
      return 'maintenance';
  }
}

// Convert height/weight to get desired weight in lbs
function estimateDesiredWeight(
  currentWeightKg?: number,
  heightCm?: number,
  goal?: Goal,
  sex?: Sex
): number {
  // If we don't have weight data, use reasonable defaults
  if (!currentWeightKg) {
    return sex === 'female' ? 140 : 180; // default desired weights
  }

  const currentWeightLb = currentWeightKg * 2.20462;
  
  // For weight loss, reduce by 10-20 lbs from current
  if (goal === 'loss') {
    return Math.max(currentWeightLb - 15, sex === 'female' ? 110 : 140);
  }
  
  // For muscle gain, might want to add 5-10 lbs of lean mass
  if (goal === 'gain') {
    return currentWeightLb + 8;
  }
  
  // For maintenance, use current weight
  return currentWeightLb;
}

// Extract sex from user data (this might need adjustment based on your user schema)
function extractSex(userData: any): Sex {
  // This is a placeholder - you'll need to adjust based on how sex/gender is stored
  // For now, we'll default to male if not specified
  return userData.sex === 'female' || userData.gender === 'female' ? 'female' : 'male';
}

// Estimate meals per day from user habits or preferences
function estimateMealsPerDay(userData: any): number {
  // Look for any existing meal frequency data
  // Default to 3 meals if not specified
  return userData.mealsPerDay || userData.preferredMealsPerDay || 3;
}

// Estimate snacks per day
function estimateSnacksPerDay(userData: any): number {
  return userData.snacksPerDay || userData.preferredSnacksPerDay || 1;
}

/**
 * Convert existing user profile data to science-driven nutrition targets
 */
export function getUserNutritionTargets(userData: any): MacroTargets {
  const goal = mapFitnessGoal(userData.fitnessGoal);
  const sex = extractSex(userData);
  const desiredWeightLb = estimateDesiredWeight(
    userData.weight, 
    userData.height, 
    goal, 
    sex
  );
  const mealsPerDay = estimateMealsPerDay(userData);
  const snacksPerDay = estimateSnacksPerDay(userData);

  const input: OnboardingInput = {
    goal,
    sex,
    desiredWeightLb,
    mealsPerDay,
    snacksPerDay,
    carbBias: 'even' // default to even distribution
  };

  return computeTargets(input, 'whole');
}

/**
 * Create a user-friendly explanation of the targets
 */
export function explainNutritionTargets(targets: MacroTargets): string {
  const goalText = {
    loss: 'weight loss',
    maintenance: 'weight maintenance', 
    gain: 'muscle gain'
  }[targets.goal];

  return `Your ${targets.proteinPerDay_g}g daily protein target is based on your ${goalText} goal and ${targets.desiredWeightLb}lb target weight. With ${targets.mealsPerDay} meals per day, that's ~${targets.proteinPerMeal_g}g protein per meal. Starchy carbs are limited to ${targets.starchyCarbsPerDay_g_min}-${targets.starchyCarbsPerDay_g_max}g daily, with 2-3 cups of vegetables.`;
}

/**
 * Check if a meal template meets the user's per-meal targets
 */
export function evaluateMealAgainstTargets(
  mealNutrition: { protein?: number; carbs?: number },
  targets: MacroTargets
): {
  proteinMatch: 'low' | 'good' | 'high';
  carbsMatch: 'low' | 'good' | 'high';
  score: number; // 0-100
} {
  const protein = mealNutrition.protein || 0;
  const carbs = mealNutrition.carbs || 0;

  // Evaluate protein (target +/- 5g is "good")
  const proteinTarget = targets.proteinPerMeal_g;
  let proteinMatch: 'low' | 'good' | 'high';
  if (protein < proteinTarget - 5) proteinMatch = 'low';
  else if (protein > proteinTarget + 5) proteinMatch = 'high';
  else proteinMatch = 'good';

  // Evaluate carbs (within per-meal range is "good")
  const carbMin = targets.starchyCarbsPerMeal_g_min;
  const carbMax = targets.starchyCarbsPerMeal_g_max;
  let carbsMatch: 'low' | 'good' | 'high';
  if (carbs < carbMin - 3) carbsMatch = 'low';
  else if (carbs > carbMax + 3) carbsMatch = 'high';
  else carbsMatch = 'good';

  // Calculate overall score
  const proteinScore = proteinMatch === 'good' ? 50 : 
                      (proteinMatch === 'low' ? Math.max(0, 50 - (proteinTarget - protein) * 2) :
                       Math.max(0, 50 - (protein - proteinTarget) * 2));
  
  const carbScore = carbsMatch === 'good' ? 50 :
                   (carbsMatch === 'low' ? Math.max(0, 50 - (carbMin - carbs) * 3) :
                    Math.max(0, 50 - (carbs - carbMax) * 3));

  return {
    proteinMatch,
    carbsMatch,
    score: Math.round(proteinScore + carbScore)
  };
}