/** Development Grocery Coach evidence. Fibrous source carbs are NOT dietary fiber. */
export interface GroceryCoachCarbReview {
  version: 1;
  status: "validated" | "unresolved";
  reason: string;
  evidence?: Array<{
    ingredientIndex: number;
    name: string;
    quantity: string;
    unit: string;
    grams: number;
    source: "USDA FoodData Central";
    fdcId: number;
    description: string;
    dataType: string;
    basis: "per_100g";
    carbsPer100g: number;
    retrievedAt: string;
    conversion: string;
    category: "starchy" | "fibrous" | "other";
    carbs: number;
  }>;
}
