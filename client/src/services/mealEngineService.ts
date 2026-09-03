import { apiUrl } from '@/lib/resolveApiBase';
import { apiRequest } from '@/lib/apiRequest';

/**
 * EngineMeal — the raw shape returned by the Meal Engine service layer.
 * Nutrition fields use the `_g` suffix (protein_g / carbs_g / fat_g).
 * Do NOT use this type for board / UI-layer components; import Meal from
 * "@/types/meal" instead (which uses protein / carbs / fat without suffix).
 */
export interface EngineMeal {
  id: string;
  name: string;
  description?: string;
  ingredients: Array<{
    item: string;
    amount: number | string;
    unit: string;
    notes?: string;
  }>;
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  servings: number;
  imageUrl?: string | null;
  cookingTime?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  medicalBadges?: string[];
  compliance?: {
    allergiesCleared: boolean;
    medicalCleared: boolean;
    unitsStandardized: boolean;
  };
}

// Service layer for meal plan operations
export interface MealPlan {
  meals: EngineMeal[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
}

export interface UserProfile {
  allergies: string[];
  healthConditions: string[];
  dietaryRestrictions: string[];
  preferences?: string[];
}

// API endpoints for meal plan operations
export const getMealPlan = async (userId: string): Promise<MealPlan> => {
  const response = await fetch(apiUrl(`/api/weekly-plan/${userId}`));
  if (!response.ok) {
    throw new Error('Failed to fetch meal plan');
  }
  const data = await response.json();
  return data.plan || { meals: [] };
};

export const deleteMeal = async (userId: string, mealId: string): Promise<void> => {
  const response = await fetch(apiUrl('/api/meal-engine/delete'), {
    method: 'POST',
    body: JSON.stringify({ userId, mealId }),
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to delete meal');
  }
};

export const replaceMeal = async (userId: string, mealId: string): Promise<EngineMeal> => {
  const response = await fetch(apiUrl('/api/meal-engine/replace'), {
    method: 'POST',
    body: JSON.stringify({ userId, mealId }),
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to replace meal');
  }

  const newMeal = await response.json();
  return newMeal;
};

export const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  // Get user profile from localStorage (onboarding data)
  const stored = localStorage.getItem('userOnboardingProfile');
  if (stored) {
    return JSON.parse(stored);
  }

  // Fallback to API if localStorage is empty
  return apiRequest(`/api/users/${userId}`);
};