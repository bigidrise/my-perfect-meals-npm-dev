
// client/src/data/diabeticAiPremades.dinner.ts

export interface DiabeticPremadeMeal {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: fat;
  ingredients: Array<{
    item: string;
    quantity: number;
    unit: string;
  }>;
  instructions?: string[];
}

// DINNER CATEGORIES (6 total):
// 1. Lean Plates
// 2. Protein + Carb Bowls
// 3. High Protein Plates
// 4. Protein + Veggie Plates
// 5. One-Pan Meals
// 6. Smart Plate Dinners

export const DIABETIC_DINNER_PREMADES: DiabeticPremadeMeal[] = [
  // DATA WILL BE ADDED LATER
];
