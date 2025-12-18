
// client/src/data/diabeticAiPremades.lunch.ts

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

// LUNCH CATEGORIES (6 total):
// 1. Lean Plates
// 2. Protein + Carb Bowls
// 3. High Protein Plates
// 4. Protein + Veggie Plates
// 5. One-Pan Meals
// 6. Smart Plate Lunches

export const DIABETIC_LUNCH_PREMADES: DiabeticPremadeMeal[] = [
  // DATA WILL BE ADDED LATER
];
