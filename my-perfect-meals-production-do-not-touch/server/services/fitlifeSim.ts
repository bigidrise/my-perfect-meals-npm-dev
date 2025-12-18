type State = {
  weightLbs: number;
  bodyFatPct: number;
  muscleMassLbs: number;
  energy: number;
  mood: number;
  lifestyleScore: number;
  visualStage: "fit" | "average" | "overweight";
};

type Inputs = {
  nutritionScore: number;
  trainingScore: number;
  lifestyleScore: number;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function tickDay(state: State, inputs: Inputs): State {
  const n = clamp(inputs.nutritionScore, 0, 100);
  const t = clamp(inputs.trainingScore, 0, 100);
  const l = clamp(inputs.lifestyleScore, 0, 100);

  // Simple but believable deltas per day
  // Nutrition: better nutrition lowers fat, preserves/gains muscle slightly
  const fatDelta = (50 - n) * 0.01; // +/− up to 0.5% bodyfat/day (visualized slowly)
  const muscleDelta = (t - 40) * 0.02; // training over 40 builds; under 40 loses slightly
  const weightDeltaFromFat = -(fatDelta * 0.3); // lbs effect per day (tiny)
  const weightDeltaFromMuscle = muscleDelta * 0.15; // lbs effect per day (tiny)

  let bodyFatPct = clamp(state.bodyFatPct - fatDelta * 0.1, 6, 55);
  let muscleMassLbs = clamp(state.muscleMassLbs + muscleDelta * 0.05, 40, 240);
  let weightLbs = clamp(state.weightLbs + weightDeltaFromFat + weightDeltaFromMuscle, 70, 500);

  // Energy/mood influenced by lifestyle + training load
  let energy = clamp(state.energy + (l - 50) * 0.3 - Math.max(0, t - 70) * 0.2, 0, 100);
  let mood = clamp(state.mood + (l - 50) * 0.25 + (n - 50) * 0.1, 0, 100);
  let lifestyleScore = clamp((state.lifestyleScore * 0.7) + (l * 0.3), 0, 100);

  // Visual stage thresholds (tune later)
  const visualStage: State["visualStage"] = 
    bodyFatPct <= 18 && muscleMassLbs / weightLbs >= 0.35 
      ? "fit"
      : bodyFatPct >= 30 
        ? "overweight"
        : "average";

  return {
    weightLbs,
    bodyFatPct,
    muscleMassLbs,
    energy,
    mood,
    lifestyleScore,
    visualStage,
  };
}

// Helper function to calculate nutrition score from meal plans
export function calculateNutritionScore(mealPlan: any): number {
  // Simple scoring based on completeness and quality
  let score = 50; // baseline

  if (mealPlan?.breakfast) score += 15;
  if (mealPlan?.lunch) score += 15;
  if (mealPlan?.dinner) score += 15;
  if (mealPlan?.snacks?.length > 0) score += 5;

  return clamp(score, 0, 100);
}

// Helper function to calculate training score from workout completion
export function calculateTrainingScore(workoutData: any): number {
  // Simple scoring based on workout completion
  if (!workoutData) return 0;

  let score = 0;
  if (workoutData.completed) score += 60;
  if (workoutData.duration >= 30) score += 20; // 30+ minutes
  if (workoutData.intensity === "high") score += 20;
  else if (workoutData.intensity === "medium") score += 10;

  return clamp(score, 0, 100);
}

// Helper function to calculate lifestyle score from various inputs
export function calculateLifestyleScore(lifestyle: {
  sleep?: number; // hours
  stress?: number; // 1-10 scale
  alcohol?: number; // drinks
  hydration?: number; // glasses of water
}): number {
  let score = 50; // baseline

  // Sleep scoring (7-9 hours optimal)
  if (lifestyle.sleep) {
    if (lifestyle.sleep >= 7 && lifestyle.sleep <= 9) score += 20;
    else if (lifestyle.sleep >= 6 && lifestyle.sleep <= 10) score += 10;
    else score -= 10;
  }

  // Stress scoring (lower is better, 1-10 scale)
  if (lifestyle.stress) {
    if (lifestyle.stress <= 3) score += 15;
    else if (lifestyle.stress <= 6) score += 5;
    else score -= 15;
  }

  // Alcohol scoring (less is better)
  if (lifestyle.alcohol !== undefined) {
    if (lifestyle.alcohol === 0) score += 10;
    else if (lifestyle.alcohol <= 1) score += 5;
    else if (lifestyle.alcohol <= 3) score -= 5;
    else score -= 15;
  }

  // Hydration scoring (8+ glasses optimal)
  if (lifestyle.hydration) {
    if (lifestyle.hydration >= 8) score += 5;
    else if (lifestyle.hydration >= 6) score += 2;
    else score -= 5;
  }

  return clamp(score, 0, 100);
}