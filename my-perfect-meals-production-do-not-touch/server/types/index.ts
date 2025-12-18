// server/types/index.ts
// Type definitions for meal generation system

export interface OnboardingProfile {
  dietType?: string;
  allergies?: string[];
  dislikes?: string[];
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  goals?: string[];
  activityLevel?: string;
  fitnessGoal?: string;
  dailyCalorieTarget?: number;
  weight?: number;
  height?: number;
  age?: number;
}

export interface MealRequest {
  onboarding: OnboardingProfile;
  courseStyle?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  craving?: string;
  includeImage?: boolean;
  ingredients?: string[];
  userId: string;
  tempDietPreference?: string;  // Temporary diet override (lifestyle preference)
  tempMedicalOverride?: string; // Temporary medical override (takes precedence)
}

export interface MealResult {
  name: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit?: string;
  }>;
  instructions: string[];
  imageUrl?: string;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  medicalBadges?: Array<{
    type: string;
    reason: string;
  }>;
}