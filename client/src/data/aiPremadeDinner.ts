// client/src/data/aiPremadeDinner.ts

// Types
export type MealType = "breakfast" | "lunch" | "dinner";
export type DinnerCategory =
  | "lean-protein-plates"
  | "protein-carb-bowls"
  | "high-protein-plates"
  | "simple-protein-veggie"
  | "one-pan-meals"
  | "smart-plate-dinners";

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

export interface DinnerIngredient {
  item: string;
  quantity: number;
  unit: string;
}

export interface AiPremadeMeal {
  id: string;
  name: string;
  category: DinnerCategory;
  mealType: MealType;
  ingredients: DinnerIngredient[];
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

// ✅ DINNER – ALL CATEGORIES (120 MEALS, ALPHABETIZED BY CATEGORY)
export const AI_PREMADE_DINNER_MEALS: AiPremadeMeal[] = [
  // CATEGORY 1: LEAN PROTEIN PLATES (30 meals, d1-01 to d1-30)
  {
    id: "d1-01",
    name: "Baked Chicken Breast & Asparagus",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-02",
    name: "Baked Cod & Green Beans",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-03",
    name: "Baked Tilapia & Steamed Broccoli",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-04",
    name: "Blackened Chicken & Zucchini",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-05",
    name: "Cajun Shrimp & Sautéed Spinach",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-06",
    name: "Citrus Chicken & Brussels Sprouts",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-07",
    name: "Garlic Chicken & Cauliflower",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Cauliflower", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-08",
    name: "Garlic Herb Turkey Cutlets & Green Beans",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-09",
    name: "Grilled Chicken & Broccolini",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Broccolini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-10",
    name: "Grilled Salmon & Mixed Vegetables",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-11",
    name: "Grilled Tilapia & Sautéed Cabbage",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" },
      { item: "Cabbage", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-12",
    name: "Herb Chicken Breast & Roasted Carrots",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Carrots", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-13",
    name: "Lemon Chicken & Garlic Spinach",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-14",
    name: "Lemon Herb Cod & Roasted Veggies",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-15",
    name: "Mediterranean Chicken & Peppers",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Bell Peppers", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-16",
    name: "Pan-Seared Chicken & Garlic Green Beans",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-17",
    name: "Pan-Seared Salmon & Sautéed Kale",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Kale", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-18",
    name: "Pan-Seared Tilapia & Roasted Zucchini",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-19",
    name: "Rosemary Chicken & Brussels Sprouts",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-20",
    name: "Sautéed Shrimp & Mixed Vegetables",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-21",
    name: "Sautéed Turkey Strips & Veggies",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-22",
    name: "Sesame Chicken & Steamed Broccoli",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-23",
    name: "Simple Grilled Chicken & Cauliflower Mash",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Cauliflower", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-24",
    name: "Simple Shrimp Plate & Green Beans",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-25",
    name: "Spicy Chicken & Grilled Vegetables",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Grilled Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-26",
    name: "Spicy Shrimp & Sautéed Broccoli",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-27",
    name: "Turkey Medallions & Steamed Vegetables",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-28",
    name: "Turkey Strips & Roasted Cauliflower",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Cauliflower", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-29",
    name: "White Fish & Garlic Spinach",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "White Fish", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d1-30",
    name: "Zesty Chicken & Sautéed Peppers",
    category: "lean-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Bell Peppers", quantity: 150, unit: "g" }
    ]
  },

  // CATEGORY 2: PROTEIN-CARB BOWLS (30 meals, d2-01 to d2-30)
  {
    id: "d2-01",
    name: "BBQ Chicken & Brown Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brown Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-02",
    name: "Buffalo Chicken & Sweet Potato Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Sweet Potato", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-03",
    name: "Chicken & Farro Grain Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Farro (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-04",
    name: "Chicken & Lentil Protein Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 5, unit: "oz" },
      { item: "Lentils (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-05",
    name: "Chicken & Quinoa Power Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Quinoa (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-06",
    name: "Chicken Fajita Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Bell Peppers", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-07",
    name: "Chicken Sausage & Potato Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Sausage", quantity: 4, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-08",
    name: "Egg White & Potato Protein Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 6, unit: "large" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-09",
    name: "Garlic Shrimp & Brown Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Brown Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-10",
    name: "Greek Chicken & Orzo Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Orzo (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-11",
    name: "Grilled Chicken & Jasmine Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Jasmine Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-12",
    name: "Grilled Salmon & Quinoa Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Quinoa (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-13",
    name: "Ground Turkey & Brown Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" },
      { item: "Brown Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-14",
    name: "Lean Beef & Jasmine Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (96% lean)", quantity: 5, unit: "oz" },
      { item: "Jasmine Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-15",
    name: "Lean Beef & Potato Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (96% lean)", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-16",
    name: "Lemon Herb Chicken & Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-17",
    name: "Mediterranean Chicken & Couscous Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Couscous (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-18",
    name: "Mexican Turkey & Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-19",
    name: "Salmon & Sweet Potato Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Sweet Potato", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-20",
    name: "Shrimp & Quinoa Veggie Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Quinoa (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-21",
    name: "Shrimp & Rice Noodle Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "boiled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Rice Noodles (cooked)", quantity: 0.75, unit: "cup" }
    ]
  },
  {
    id: "d2-22",
    name: "Spicy Chicken & Brown Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brown Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-23",
    name: "Steak & Jasmine Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 5, unit: "oz" },
      { item: "Jasmine Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-24",
    name: "Teriyaki Chicken & Vegetable Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-25",
    name: "Teriyaki Salmon & Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-26",
    name: "Turkey & Brown Rice Veggie Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" },
      { item: "Brown Rice (cooked)", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-27",
    name: "Turkey & Sweet Potato Mash Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" },
      { item: "Sweet Potato", quantity: 4, unit: "oz" }
    ]
  },
  {
    id: "d2-28",
    name: "Turkey Meatball & Pasta Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Turkey Meatballs (lean)", quantity: 5, unit: "oz" },
      { item: "Whole Wheat Pasta (cooked)", quantity: 0.75, unit: "cup" }
    ]
  },
  {
    id: "d2-29",
    name: "Turkey Taco Rice Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 5, unit: "oz" },
      { item: "White Rice (cooked)", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d2-30",
    name: "White Fish & Potato Bowl",
    category: "protein-carb-bowls",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "White Fish", quantity: 6, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" }
    ]
  },

  // CATEGORY 3: HIGH PROTEIN PLATES (30 meals, d3-01 to d3-30)
  {
    id: "d3-01",
    name: "Baked Cod Protein Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-02",
    name: "Baked Egg White Protein Stack",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" }
    ]
  },
  {
    id: "d3-03",
    name: "Baked Halibut Medallions",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Halibut", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-04",
    name: "Baked Turkey Cutlets",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-05",
    name: "Blackened Chicken Breast Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-06",
    name: "Broiled Flank Steak Strips",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Flank Steak", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-07",
    name: "Cajun Salmon Protein Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-08",
    name: "Chicken Breast Medallions",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-09",
    name: "Chicken Cutlet Protein Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-10",
    name: "Egg White Omelet (Plain Protein)",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" }
    ]
  },
  {
    id: "d3-11",
    name: "Garlic Grilled Chicken Breast",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-12",
    name: "Garlic Herb Turkey Slices",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-13",
    name: "Grilled Chicken Tenders (Lean)",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-14",
    name: "Grilled Shrimp Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-15",
    name: "Lean Beef Patty (No Bun)",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (96% lean)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-16",
    name: "Lemon Pepper Chicken Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-17",
    name: "Lemon Tilapia Fillet",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-18",
    name: "Pan-Seared Chicken Strips",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-19",
    name: "Pan-Seared Halibut Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Halibut", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-20",
    name: "Pan-Seared Lean Ground Turkey",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-21",
    name: "Plain Chicken Breast Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-22",
    name: "Plain Salmon Fillet",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-23",
    name: "Plain Steak Bites",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-24",
    name: "Protein Egg Plate (Whole Eggs)",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "fried",
    ingredients: [
      { item: "Eggs", quantity: 3, unit: "large" },
      { item: "Egg Whites", quantity: 3, unit: "large" }
    ]
  },
  {
    id: "d3-25",
    name: "Roasted Chicken Breast Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-26",
    name: "Simple Grilled Steak Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-27",
    name: "Simple Shrimp Skillet Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-28",
    name: "Slow-Cooked Turkey Breast",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-29",
    name: "Steamed White Fish Plate",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "steamed",
    ingredients: [
      { item: "White Fish", quantity: 6, unit: "oz" }
    ]
  },
  {
    id: "d3-30",
    name: "Turkey Burger Patty (No Bun)",
    category: "high-protein-plates",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 6, unit: "oz" }
    ]
  },

  // CATEGORY 4: SIMPLE PROTEIN-VEGGIE PLATES (30 meals, d4-01 to d4-30)
  {
    id: "d4-01",
    name: "Baked Cod with Green Beans",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-02",
    name: "Baked Halibut with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Halibut", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-03",
    name: "Baked Salmon with Green Beans",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-04",
    name: "Baked Tilapia with Zucchini",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Tilapia", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-05",
    name: "Chicken Breast with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-06",
    name: "Chicken Breast with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-07",
    name: "Chicken Breast with Brussels Sprouts",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-08",
    name: "Chicken Breast with Cabbage",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Cabbage", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-09",
    name: "Chicken Breast with Green Beans",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-10",
    name: "Chicken Breast with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-11",
    name: "Egg Whites with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-12",
    name: "Egg Whites with Bell Peppers",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" },
      { item: "Bell Peppers", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-13",
    name: "Egg Whites with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-14",
    name: "Egg Whites with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "scrambled",
    ingredients: [
      { item: "Egg Whites", quantity: 8, unit: "large" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-15",
    name: "Grilled Flank Steak with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Flank Steak", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-16",
    name: "Grilled Flank Steak with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Flank Steak", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-17",
    name: "Grilled Salmon with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-18",
    name: "Grilled Salmon with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-19",
    name: "Grilled Shrimp with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-20",
    name: "Grilled Shrimp with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-21",
    name: "Ground Beef Crumbles with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (96% lean)", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-22",
    name: "Ground Beef Crumbles with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Beef (96% lean)", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-23",
    name: "Ground Turkey Crumbles with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-24",
    name: "Ground Turkey Crumbles with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey (99% lean)", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-25",
    name: "Lean Sirloin with Asparagus",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-26",
    name: "Lean Sirloin with Broccoli",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Steak (sirloin)", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-27",
    name: "Pan-Seared Cod with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-28",
    name: "Pan-Seared Salmon with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-29",
    name: "Shrimp Skillet with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d4-30",
    name: "Turkey Cutlets with Spinach",
    category: "simple-protein-veggie",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },

  // CATEGORY 5: ONE-PAN MEALS (30 meals, d5-01 to d5-30)
  {
    id: "d5-01",
    name: "Baked Chicken and Asparagus Tray",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-02",
    name: "Baked Cod and Broccoli Sheet",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-03",
    name: "Balsamic Chicken and Brussels Sprouts",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-04",
    name: "Beef Strips and Green Beans One-Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-05",
    name: "Blackened Chicken and Zucchini Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-06",
    name: "Cajun Salmon and Asparagus Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-07",
    name: "Chicken and Bell Peppers One-Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Bell Peppers", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-08",
    name: "Chicken and Broccoli Sheet Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-09",
    name: "Chicken and Green Beans Roast",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-10",
    name: "Chicken and Mixed Vegetables Bake",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-11",
    name: "Chicken Sausage and Broccoli Bake",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Sausage", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-12",
    name: "Cod and Asparagus One-Pan Dinner",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-13",
    name: "Garlic Butter Chicken and Cauliflower",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Cauliflower", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-14",
    name: "Garlic Salmon and Brussels Sprouts",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-15",
    name: "Ground Turkey and Bell Peppers Bake",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey", quantity: 6, unit: "oz" },
      { item: "Bell Peppers", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-16",
    name: "Herb Chicken and Zucchini Tray",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-17",
    name: "Honey Mustard Chicken and Carrots",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Carrots", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-18",
    name: "Italian Cod and Vegetables Bake",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-19",
    name: "Lemon Chicken and Green Beans Tray",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-20",
    name: "Lemon Salmon and Broccoli Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-21",
    name: "Mediterranean Chicken Sheet Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Tomatoes", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-22",
    name: "Mixed Vegetable and Steak Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-23",
    name: "Pesto Chicken and Broccoli Roast",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-24",
    name: "Roasted Chicken and Brussels Sprouts",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-25",
    name: "Roasted Cod and Green Beans Plate",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 6, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-26",
    name: "Salmon and Carrots Bake",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Carrots", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-27",
    name: "Salmon and Zucchini Sheet Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 6, unit: "oz" },
      { item: "Zucchini", quantity: 150, unit: "g" },
      { item: "Potatoes", quantity: 100, unit: "g" }
    ]
  },
  {
    id: "d5-28",
    name: "Steak and Asparagus One-Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Steak", quantity: 6, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-29",
    name: "Teriyaki Chicken and Vegetables Tray",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" },
      { item: "Rice", quantity: 0.5, unit: "cup" }
    ]
  },
  {
    id: "d5-30",
    name: "Turkey and Bell Peppers One-Pan",
    category: "one-pan-meals",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey", quantity: 6, unit: "oz" },
      { item: "Bell Peppers", quantity: 150, unit: "g" },
      { item: "Sweet Potatoes", quantity: 100, unit: "g" }
    ]
  },

  // CATEGORY 6: SMART PLATE DINNERS (30 meals, d6-01 to d6-30)
  {
    id: "d6-01",
    name: "Baked Chicken Breast, Brown Rice & Broccoli",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Brown Rice", quantity: 0.5, unit: "cup" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-02",
    name: "Baked Cod, Potatoes & Asparagus",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-03",
    name: "Baked Salmon, Potatoes & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Salmon", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-04",
    name: "BBQ Chicken Breast, Rice & Mixed Vegetables",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-05",
    name: "Blackened Salmon, Quinoa & Zucchini",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Salmon", quantity: 5, unit: "oz" },
      { item: "Quinoa", quantity: 0.5, unit: "cup" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-06",
    name: "Chicken Breast, Jasmine Rice & Brussels Sprouts",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Jasmine Rice", quantity: 0.5, unit: "cup" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-07",
    name: "Chicken Breast, Mashed Potatoes & Broccoli",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-08",
    name: "Chicken Breast, Pilaf Rice & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Pilaf", quantity: 0.5, unit: "cup" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-09",
    name: "Chicken Thighs, Jasmine Rice & Carrots",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Thighs", quantity: 6, unit: "oz" },
      { item: "Jasmine Rice", quantity: 0.5, unit: "cup" },
      { item: "Carrots", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-10",
    name: "Citrus Chicken Breast, Rice & Spinach",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-11",
    name: "Citrus Cod, Brown Rice & Asparagus",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 5, unit: "oz" },
      { item: "Brown Rice", quantity: 0.5, unit: "cup" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-12",
    name: "Garlic Chicken Breast, Rice & Mixed Vegetables",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-13",
    name: "Garlic Shrimp, Rice & Broccoli",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 5, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-14",
    name: "Grilled Chicken Breast, Quinoa & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Quinoa", quantity: 0.5, unit: "cup" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-15",
    name: "Grilled Salmon, Rice & Zucchini",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Salmon", quantity: 5, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-16",
    name: "Ground Beef, Potatoes & Carrots",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Steak", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Carrots", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-17",
    name: "Ground Turkey, Rice & Spinach",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Ground Turkey", quantity: 5, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-18",
    name: "Lemon Chicken Breast, Rice & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "grilled",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-19",
    name: "Lemon Cod, Potatoes & Broccoli",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-20",
    name: "Pan-Seared Chicken Breast, Quinoa & Brussels Sprouts",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Quinoa", quantity: 0.5, unit: "cup" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-21",
    name: "Pan-Seared Shrimp, Jasmine Rice & Zucchini",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Shrimp", quantity: 5, unit: "oz" },
      { item: "Jasmine Rice", quantity: 0.5, unit: "cup" },
      { item: "Zucchini", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-22",
    name: "Pesto Chicken Breast, Pasta & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Pasta", quantity: 0.5, unit: "cup" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-23",
    name: "Roasted Chicken Breast, Potatoes & Spinach",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Spinach", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-24",
    name: "Roasted Cod, Rice & Bell Peppers",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 5, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Bell Peppers", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-25",
    name: "Sirloin Steak, Potatoes & Asparagus",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Sirloin Steak", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Asparagus", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-26",
    name: "Sirloin Steak, Rice & Broccoli",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Sirloin Steak", quantity: 5, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Broccoli", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-27",
    name: "Teriyaki Chicken Breast, Rice & Mixed Vegetables",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Chicken Breast", quantity: 6, unit: "oz" },
      { item: "White Rice", quantity: 0.5, unit: "cup" },
      { item: "Mixed Vegetables", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-28",
    name: "Turkey Breast, Quinoa & Brussels Sprouts",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Turkey Breast", quantity: 6, unit: "oz" },
      { item: "Quinoa", quantity: 0.5, unit: "cup" },
      { item: "Brussels Sprouts", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-29",
    name: "Turkey Sausage, Potatoes & Cauliflower",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "pan-seared",
    ingredients: [
      { item: "Turkey Sausage", quantity: 5, unit: "oz" },
      { item: "Potatoes", quantity: 4, unit: "oz" },
      { item: "Cauliflower", quantity: 150, unit: "g" }
    ]
  },
  {
    id: "d6-30",
    name: "White Fish, Jasmine Rice & Green Beans",
    category: "smart-plate-dinners",
    mealType: "dinner",
    defaultCookingMethod: "baked",
    ingredients: [
      { item: "Cod", quantity: 5, unit: "oz" },
      { item: "Jasmine Rice", quantity: 0.5, unit: "cup" },
      { item: "Green Beans", quantity: 150, unit: "g" }
    ]
  }
];

// Helper: filter by category
export function getDinnerMealsByCategory(
  category: DinnerCategory
): AiPremadeMeal[] {
  return AI_PREMADE_DINNER_MEALS.filter((meal) => meal.category === category);
}

// Category display names mapping
export const DINNER_CATEGORY_DISPLAY_NAMES: Record<DinnerCategory, string> = {
  'lean-protein-plates': 'Lean Protein Plates',
  'protein-carb-bowls': 'Protein + Carb Bowls',
  'high-protein-plates': 'High Protein Plates',
  'simple-protein-veggie': 'Protein + Veggie Plates',
  'one-pan-meals': 'One-Pan Meals',
  'smart-plate-dinners': 'Smart Plate Dinners'
};