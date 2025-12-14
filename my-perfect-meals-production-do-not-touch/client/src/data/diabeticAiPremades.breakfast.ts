
// client/src/data/diabeticAiPremades.breakfast.ts

export interface DiabeticPremadeMeal {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: Array<{
    item: string;
    quantity: number;
    unit: string;
  }>;
  instructions?: string[];
}

// BREAKFAST CATEGORIES:
// 1. All Protein (3 categories)
// 2. Protein + Carb (3 categories)
// 3. Egg-Based (3 categories)

export const DIABETIC_BREAKFAST_PREMADES: DiabeticPremadeMeal[] = [
  // DATA WILL BE ADDED LATER
];
