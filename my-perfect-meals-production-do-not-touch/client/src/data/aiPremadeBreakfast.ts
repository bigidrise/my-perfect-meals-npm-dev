
// client/src/data/aiPremadeBreakfast.ts

// Types
export type MealType = "breakfast" | "lunch" | "dinner";
export type BreakfastCategory = "all-protein" | "protein-carb" | "egg-based";

export type CookingMethod =
  | "air-fried"
  | "baked"
  | "boiled"
  | "fried"
  | "grilled"
  | "pan-seared"
  | "poached"
  | "scrambled"
  | "steamed"
  | "well-done"
  | "medium"
  | "medium-rare";

export interface BreakfastIngredient {
  item: string;
  quantity: number;
  unit: string;
}

export interface AiPremadeMeal {
  id: string;
  name: string;
  category: BreakfastCategory;
  mealType: MealType;
  ingredients: BreakfastIngredient[];
  defaultCookingMethod?: CookingMethod;
  notes?: string;
}

// Global cooking methods dropdown (alphabetical)
export const COOKING_METHOD_OPTIONS: CookingMethod[] = [
  "air-fried",
  "baked",
  "boiled",
  "fried",
  "grilled",
  "medium",
  "medium-rare",
  "pan-seared",
  "poached",
  "scrambled",
  "steamed",
  "well-done",
];

// ✅ BREAKFAST – ALL CATEGORIES (120 MEALS, ALPHABETIZED BY CATEGORY)
export const AI_PREMADE_BREAKFAST_MEALS: AiPremadeMeal[] = [
  // CATEGORY 1: ALL PROTEIN (40 meals, ap-01 to ap-40)
  {
    id: "ap-01",
    name: "Baked Cod (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-02",
    name: "Baked Salmon (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-03",
    name: "Bison Patty (Lean)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Ground Bison (lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-04",
    name: "Breakfast Sausage Patties (Turkey)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 4, unit: "links" }
    ]
  },
  {
    id: "ap-05",
    name: "Canadian Bacon Slices",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Canadian Bacon", quantity: 4, unit: "slices" }
    ]
  },
  {
    id: "ap-06",
    name: "Chicken Breast (Grilled)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-07",
    name: "Chicken Sausage Links",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Sausage", quantity: 3, unit: "links" }
    ]
  },
  {
    id: "ap-08",
    name: "Cottage Cheese Bowl (1% or Fat-Free)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Cottage Cheese (1%)", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "ap-09",
    name: "Egg White Omelet (Veggie-Loaded)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Egg Whites", quantity: 6, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" },
      { item: "Mushrooms", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "ap-10",
    name: "Egg White Scramble (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" }
    ]
  },
  {
    id: "ap-11",
    name: "Egg Whites & Cottage Cheese Combo",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 5, unit: "large" },
      { item: "Cottage Cheese (1%)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "ap-12",
    name: "Egg Whites & Turkey Sausage",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 6, unit: "large" },
      { item: "Turkey Sausage", quantity: 2, unit: "links" }
    ]
  },
  {
    id: "ap-13",
    name: "Extra-Lean Ground Beef Patty",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (93/7 or leaner)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-14",
    name: "Extra-Lean Ground Turkey Bowl",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-15",
    name: "Grilled Chicken Breast (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-16",
    name: "Grilled Shrimp Bowl",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-17",
    name: "Grilled Tilapia (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-18",
    name: "Ham Slices (Lean)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Ham (lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-19",
    name: "Lean Ground Chicken Bowl",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Chicken (lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-20",
    name: "Low-Fat Greek Yogurt Bowl (Plain)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Greek Yogurt (2%)", quantity: 1.5, unit: "cups" }
    ]
  },
  {
    id: "ap-21",
    name: "Nonfat Greek Yogurt Bowl",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Greek Yogurt (Nonfat)", quantity: 1.5, unit: "cups" }
    ]
  },
  {
    id: "ap-22",
    name: "Pan-Seared Pork Tenderloin (Lean)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Pork Tenderloin", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-23",
    name: "Pan-Seared Scallops",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Scallops", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-24",
    name: "Protein Powder Shake (Whey or Plant-Based)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Protein Powder", quantity: 2, unit: "scoops" },
      { item: "Water", quantity: 1.5, unit: "cups" }
    ]
  },
  {
    id: "ap-25",
    name: "Rotisserie Chicken Breast (Skinless)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Chicken Breast (rotisserie, skinless)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-26",
    name: "Scrambled Egg Whites & Spinach",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 7, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "ap-27",
    name: "Smoked Salmon Slices",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Smoked Salmon", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "ap-28",
    name: "Steak Bites (Sirloin or Flank)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-29",
    name: "Steamed Crab Legs",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "steamed",
    ingredients: [
      { item: "Crab Legs", quantity: 8, unit: "oz" }
    ]
  },
  {
    id: "ap-30",
    name: "Top Sirloin Steak (Lean Cut)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Sirloin Steak", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-31",
    name: "Tuna (Canned in Water)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Tuna (canned in water)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-32",
    name: "Turkey Bacon (5–6 Strips)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Turkey Bacon", quantity: 6, unit: "strips" }
    ]
  },
  {
    id: "ap-33",
    name: "Turkey Breast Slices (Deli or Roasted)",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Turkey Breast (deli)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-34",
    name: "Turkey Burger Patty (99% Lean)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-35",
    name: "Turkey Meatballs (Lean)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-36",
    name: "Turkey Sausage Links (3–4 Links)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 4, unit: "links" }
    ]
  },
  {
    id: "ap-37",
    name: "Venison Steak (Wild Game)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Venison Steak", quantity: 5, unit: "oz" }
    ]
  },
  {
    id: "ap-38",
    name: "White Fish Fillet (Cod, Haddock, etc.)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "White Fish", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "ap-39",
    name: "Whole Eggs Scrambled (With Extra Whites)",
    category: "all-protein",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "ap-40",
    name: "Zero-Sugar Protein Pudding",
    category: "all-protein",
    mealType: "breakfast",
    ingredients: [
      { item: "Protein Powder", quantity: 1, unit: "scoop" },
      { item: "Greek Yogurt (Nonfat)", quantity: 0.5, unit: "cup" }
    ]
  },
  // CATEGORY 2: PROTEIN + CARB (40 meals, pc-01 to pc-40)
  {
    id: "pc-01",
    name: "Bagel Thin & Egg Whites",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Bagel Thin", quantity: 1, unit: "piece" },
      { item: "Egg Whites", quantity: 5, unit: "large" }
    ]
  },
  {
    id: "pc-02",
    name: "Banana & Protein Shake",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Banana", quantity: 1, unit: "medium" },
      { item: "Protein Powder", quantity: 1, unit: "scoop" },
      { item: "Water", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "pc-03",
    name: "Breakfast Burrito (Egg Whites + Tortilla)",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Whole Wheat Tortilla", quantity: 1, unit: "large" },
      { item: "Egg Whites", quantity: 5, unit: "large" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "pc-04",
    name: "Chicken Breast & Oatmeal",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 4, unit: "oz" },
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-05",
    name: "Chicken Sausage & Roasted Potatoes",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Sausage", quantity: 2, unit: "links" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-06",
    name: "Cottage Cheese & Pineapple",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Cottage Cheese", quantity: 1, unit: "cup" },
      { item: "Pineapple (fresh)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-07",
    name: "Cream of Wheat (Plain Bowl)",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Cream of Wheat (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-08",
    name: "Cream of Wheat & Egg Whites",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Cream of Wheat (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "pc-09",
    name: "Egg Whites & English Muffin",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 5, unit: "large" },
      { item: "English Muffin (whole wheat)", quantity: 1, unit: "piece" }
    ]
  },
  {
    id: "pc-10",
    name: "Egg Whites & Sweet Potato Mash",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 5, unit: "large" },
      { item: "Sweet Potato", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-11",
    name: "Egg Whites & White Rice",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 5, unit: "large" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-12",
    name: "Grits (Plain Bowl)",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Grits (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-13",
    name: "Grits & Egg Whites",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Grits (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "pc-14",
    name: "Greek Yogurt & Banana",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Greek Yogurt (2%)", quantity: 1, unit: "cup" },
      { item: "Banana", quantity: 1, unit: "medium" }
    ]
  },
  {
    id: "pc-15",
    name: "Greek Yogurt & Berries",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Greek Yogurt (2%)", quantity: 1, unit: "cup" },
      { item: "Mixed Berries", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-16",
    name: "Greek Yogurt & Granola (Light)",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Greek Yogurt (2%)", quantity: 1, unit: "cup" },
      { item: "Granola", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "pc-17",
    name: "Ham Slices & Toast",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Ham (lean)", quantity: 4, unit: "oz" },
      { item: "Whole Wheat Bread", quantity: 1, unit: "slice" }
    ]
  },
  {
    id: "pc-18",
    name: "Oatmeal (Plain Bowl)",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" },
      { item: "Water", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "pc-19",
    name: "Oatmeal & Peanut Butter (Light)",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" },
      { item: "Peanut Butter", quantity: 1, unit: "tbsp" }
    ]
  },
  {
    id: "pc-20",
    name: "Oatmeal & Protein Scoop",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" },
      { item: "Protein Powder", quantity: 1, unit: "scoop" }
    ]
  },
  {
    id: "pc-21",
    name: "Over-Easy Eggs & Potatoes",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-22",
    name: "Over-Hard Eggs & Whole Wheat Toast",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Whole Wheat Bread", quantity: 1, unit: "slice" }
    ]
  },
  {
    id: "pc-23",
    name: "Protein Pancake (Oats + Egg Whites)",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "pc-24",
    name: "Protein Shake & Apple Slices",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Protein Powder", quantity: 1, unit: "scoop" },
      { item: "Apple", quantity: 1, unit: "medium" },
      { item: "Water", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "pc-25",
    name: "Protein Shake & Rice Cake",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Protein Powder", quantity: 1, unit: "scoop" },
      { item: "Rice Cakes", quantity: 2, unit: "pieces" },
      { item: "Water", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "pc-26",
    name: "Ricotta Cheese & Berries",
    category: "protein-carb",
    mealType: "breakfast",
    ingredients: [
      { item: "Ricotta Cheese (part-skim)", quantity: 0.75, unit: "cup" },
      { item: "Mixed Berries", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-27",
    name: "Salmon Scramble & Potatoes",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Salmon", quantity: 3, unit: "oz" },
      { item: "Potatoes", quantity: 3, unit: "oz" }
    ]
  },
  {
    id: "pc-28",
    name: "Scrambled Eggs & Bagel Thin",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Bagel Thin", quantity: 1, unit: "piece" }
    ]
  },
  {
    id: "pc-29",
    name: "Scrambled Eggs & Grits",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Grits (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-30",
    name: "Scrambled Eggs & Oatmeal",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-31",
    name: "Scrambled Eggs & Potato Wedges",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-32",
    name: "Scrambled Eggs & Rice Cakes",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Rice Cakes", quantity: 2, unit: "pieces" }
    ]
  },
  {
    id: "pc-33",
    name: "Steak Bites & Potatoes",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 4, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-34",
    name: "Sweet Potato & Turkey Sausage",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 2, unit: "links" },
      { item: "Sweet Potato", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-35",
    name: "Tilapia & Rice (Breakfast Style)",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Tilapia", quantity: 4, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-36",
    name: "Turkey Bacon & Pancake (Light)",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Turkey Bacon", quantity: 3, unit: "strips" },
      { item: "Pancake (whole wheat)", quantity: 1, unit: "medium" }
    ]
  },
  {
    id: "pc-37",
    name: "Turkey Breast & Hash Browns",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Turkey Breast", quantity: 4, unit: "oz" },
      { item: "Potatoes (hash brown style)", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "pc-38",
    name: "Turkey Sausage & Belgian Waffle (Light)",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 2, unit: "links" },
      { item: "Belgian Waffle (whole grain)", quantity: 1, unit: "small" }
    ]
  },
  {
    id: "pc-39",
    name: "Turkey Sausage & Grits",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 2, unit: "links" },
      { item: "Grits (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "pc-40",
    name: "Turkey Sausage & Oatmeal",
    category: "protein-carb",
    mealType: "breakfast",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 2, unit: "links" },
      { item: "Oatmeal (dry)", quantity: 0.5, unit: "cup" }
    ]
  },
  // CATEGORY 3: EGG-BASED (40 meals, eb-01 to eb-40)
  {
    id: "eb-01",
    name: "Avocado Egg Toast (Light Portion)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Avocado", quantity: 0.25, unit: "medium" },
      { item: "Whole Wheat Bread", quantity: 1, unit: "slice" }
    ]
  },
  {
    id: "eb-02",
    name: "Bacon & Egg Scramble (Lean Portion)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Turkey Bacon", quantity: 2, unit: "strips" }
    ]
  },
  {
    id: "eb-03",
    name: "Breakfast Bowl (Eggs + Spinach)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "eb-04",
    name: "Breakfast Burrito (Egg-Heavy)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Whole Wheat Tortilla", quantity: 1, unit: "large" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-05",
    name: "Breakfast Egg Sandwich (Light Bread)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Whole Wheat Bread", quantity: 1, unit: "slice" },
      { item: "Low-fat Cheese", quantity: 1, unit: "slice" }
    ]
  },
  {
    id: "eb-06",
    name: "Cheddar & Egg Omelet",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Cheddar Cheese", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-07",
    name: "Classic Deviled Eggs (Breakfast-Portioned)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "boiled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-08",
    name: "Egg & Turkey Sausage Muffins",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Turkey Sausage", quantity: 2, unit: "oz" }
    ]
  },
  {
    id: "eb-09",
    name: "Egg Bake (Plain Egg Casserole)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Eggs", quantity: 4, unit: "large" },
      { item: "Low-fat Cheese", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-10",
    name: "Egg Drop Soup (Breakfast Edition)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "boiled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Chicken Broth", quantity: 1.5, unit: "cups" }
    ]
  },
  {
    id: "eb-11",
    name: "Egg Frittata (Simple)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" },
      { item: "Onions", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-12",
    name: "Egg Patty Breakfast Stack",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-13",
    name: "Egg Scramble with Spinach",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "eb-14",
    name: "Egg Whites & Egg Combo (2 Whole + 4 Whites)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "eb-15",
    name: "Eggs Benedict (Light Version)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "poached",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "English Muffin", quantity: 1, unit: "piece" },
      { item: "Canadian Bacon", quantity: 2, unit: "slices" }
    ]
  },
  {
    id: "eb-16",
    name: "Eggs Over Easy (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-17",
    name: "Eggs Over Hard (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-18",
    name: "Eggs Over Medium (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-19",
    name: "Eggs Sunny Side Up (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-20",
    name: "French Omelet (Butter Minimal)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-21",
    name: "Frittata Bites (Egg-Based)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Eggs", quantity: 4, unit: "large" },
      { item: "Vegetables (mixed)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "eb-22",
    name: "Hard-Boiled Eggs (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "boiled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-23",
    name: "Italian Egg Scramble (Egg + Herbs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Tomatoes", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-24",
    name: "Mediterranean Egg Plate (Egg + Herbs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Spinach", quantity: 0.5, unit: "cup" },
      { item: "Feta Cheese", quantity: 2, unit: "tbsp" }
    ]
  },
  {
    id: "eb-25",
    name: "Mushroom & Egg Omelet",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Mushrooms", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "eb-26",
    name: "Onion & Egg Scramble",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Onions", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-27",
    name: "Poached Eggs (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "poached",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-28",
    name: "Poached Eggs & Spinach",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "poached",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "eb-29",
    name: "Scrambled Eggs (Classic)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-30",
    name: "Scrambled Eggs & Cheese (Light)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Low-fat Cheese", quantity: 2, unit: "tbsp" }
    ]
  },
  {
    id: "eb-31",
    name: "Scrambled Eggs with Turkey Crumbles",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Ground Turkey (99% lean)", quantity: 2, unit: "oz" }
    ]
  },
  {
    id: "eb-32",
    name: "Soft-Boiled Eggs (2–3 Eggs)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "boiled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "eb-33",
    name: "Spinach & Egg Whites Omelet",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Egg Whites", quantity: 3, unit: "large" },
      { item: "Spinach", quantity: 1, unit: "cup" }
    ]
  },
  {
    id: "eb-34",
    name: "Tomato & Egg Scramble",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Tomatoes", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "eb-35",
    name: "Turkey Bacon & Eggs",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Turkey Bacon", quantity: 2, unit: "strips" }
    ]
  },
  {
    id: "eb-36",
    name: "Veggie Egg Muffins",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" },
      { item: "Spinach", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "eb-37",
    name: "Veggie Omelet",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" },
      { item: "Mushrooms", quantity: 0.25, unit: "cup" },
      { item: "Onions", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-38",
    name: "Western Omelet (Egg-Focused)",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Ham (lean)", quantity: 2, unit: "oz" },
      { item: "Bell Peppers", quantity: 0.25, unit: "cup" },
      { item: "Onions", quantity: 0.25, unit: "cup" }
    ]
  },
  {
    id: "eb-39",
    name: "Whole Eggs & Egg Whites Combo",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 2, unit: "large" },
      { item: "Egg Whites", quantity: 4, unit: "large" }
    ]
  },
  {
    id: "eb-40",
    name: "Zesty Herb Egg Scramble",
    category: "egg-based",
    mealType: "breakfast",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Herbs (mixed)", quantity: 1, unit: "tbsp" }
    ]
  }
];

// Helper: filter by category
export function getBreakfastMealsByCategory(
  category: BreakfastCategory
): AiPremadeMeal[] {
  return AI_PREMADE_BREAKFAST_MEALS.filter((meal) => meal.category === category);
}
