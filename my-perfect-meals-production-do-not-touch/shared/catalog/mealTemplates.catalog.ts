// ======================================================================
// MEAL TEMPLATES CATALOG (BREAKFAST)
// Deterministic meals for stable rendering and consistent prep.
// ======================================================================

import { MealTemplate } from "./_types";

export const BREAKFAST_TEMPLATES: MealTemplate[] = [

  // ----------------------------------------------------------
  // 1. Egg-Based Meals
  // ----------------------------------------------------------

  {
    id: "bf-egg-001",
    name: "Scrambled Eggs (Plain)",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "eggs", grams: 150 },
    ],
    defaultCookingMethods: {
      eggs: "scrambled"
    },
    imageKey: "img_eggs_scrambled",
    tags: ["protein", "low-carb"]
  },

  {
    id: "bf-egg-002",
    name: "Egg White Scramble",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_egg_whites_scrambled",
    tags: ["lean-protein", "low-fat"]
  },

  {
    id: "bf-egg-003",
    name: "Fried Eggs (2 Eggs)",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "eggs", grams: 100 },
    ],
    defaultCookingMethods: {
      eggs: "fried"
    },
    imageKey: "img_eggs_fried",
    tags: ["protein"]
  },

  {
    id: "bf-egg-004",
    name: "Boiled Eggs (2 Eggs)",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "eggs", grams: 110 },
    ],
    defaultCookingMethods: {
      eggs: "boiled"
    },
    imageKey: "img_eggs_boiled",
    tags: ["protein", "grab-and-go"]
  },

  {
    id: "bf-egg-005",
    name: "Egg White Omelet (Plain)",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "egg_whites", grams: 200 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_egg_whites_scrambled",
    tags: ["cutting", "lean"]
  },

  // ----------------------------------------------------------
  // 2. Protein Breakfasts
  // ----------------------------------------------------------

  {
    id: "bf-pro-001",
    name: "Turkey Sausage Patties",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_sausage", grams: 120 }
    ],
    defaultCookingMethods: {
      turkey_sausage: "pan-seared"
    },
    imageKey: "img_turkey_sausage_pan_seared",
    tags: ["protein"]
  },

  {
    id: "bf-pro-002",
    name: "Chicken Breast Breakfast Portion",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 120 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled"
    },
    imageKey: "img_chicken_breast_grilled",
    tags: ["lean-protein"]
  },

  {
    id: "bf-pro-003",
    name: "Ground Turkey Breakfast Crumble",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "ground_turkey", grams: 140 }
    ],
    defaultCookingMethods: {
      ground_turkey: "pan-seared"
    },
    imageKey: "img_ground_turkey_pan_seared",
    tags: ["protein", "lean"]
  },

  {
    id: "bf-pro-004",
    name: "Smoked Salmon Portion",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "salmon", grams: 110 }
    ],
    defaultCookingMethods: {
      salmon: "pan-seared"
    },
    imageKey: "img_salmon_pan_seared",
    tags: ["omega-3", "protein"]
  },

  {
    id: "bf-pro-005",
    name: "Shrimp Breakfast Plate",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_pan_seared",
    tags: ["protein", "low-fat"]
  },

  // ----------------------------------------------------------
  // 3. Yogurt / Cottage Cheese Meals
  // ----------------------------------------------------------

  {
    id: "bf-dairy-001",
    name: "Cottage Cheese Bowl (Plain)",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cottage_cheese", grams: 200 }
    ],
    imageKey: "img_cottage_cheese_plain",
    tags: ["high-protein"]
  },

  {
    id: "bf-dairy-002",
    name: "Greek Yogurt Bowl (Plain)",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 200 }
    ],
    imageKey: "img_greek_yogurt_plain",
    tags: ["protein", "gut-health"]
  },

  {
    id: "bf-dairy-003",
    name: "Berry Swirl Greek Yogurt Parfait",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 150 },
      { ingredientId: "berries", grams: 80 }
    ],
    imageKey: "img_greek_yogurt_berries",
    tags: ["fresh", "protein"]
  },

  // ----------------------------------------------------------
  // 4. Oats / Grains
  // ----------------------------------------------------------

  {
    id: "bf-grains-001",
    name: "Oatmeal (Plain)",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "oats", grams: 80 }
    ],
    defaultCookingMethods: {
      oats: "boiled"
    },
    imageKey: "img_oats_boiled",
    tags: ["comfort", "warm", "simple"]
  },

  {
    id: "bf-grains-002",
    name: "Cream of Rice Bowl",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "white_rice", grams: 150 }
    ],
    defaultCookingMethods: {
      white_rice: "boiled"
    },
    imageKey: "img_white_rice_boiled",
    tags: ["easy-digesting", "clean"]
  },

  // ----------------------------------------------------------
  // 5. Fruit + Protein Plates
  // ----------------------------------------------------------

  {
    id: "bf-fruit-001",
    name: "Protein Shake + Banana",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "protein_shake", grams: 350 },
      { ingredientId: "banana", grams: 120 }
    ],
    imageKey: "img_protein_shake_banana",
    tags: ["on-the-go"]
  },

  {
    id: "bf-fruit-002",
    name: "Greek Yogurt + Apple Slices",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 150 },
      { ingredientId: "apple", grams: 120 }
    ],
    imageKey: "img_greek_yogurt_apple",
    tags: ["refreshing"]
  },

  // ----------------------------------------------------------
  // 6. Veggie + Protein Plates
  // ----------------------------------------------------------

  {
    id: "bf-veg-001",
    name: "Eggs + Spinach Plate",
    mealType: "breakfast",
    category: "protein-fiber",
    ingredients: [
      { ingredientId: "eggs", grams: 150 },
      { ingredientId: "spinach", grams: 60 }
    ],
    defaultCookingMethods: {
      eggs: "scrambled",
      spinach: "steamed"
    },
    imageKey: "img_eggs_scrambled_spinach",
    tags: ["clean", "cutting"]
  },

  {
    id: "bf-veg-002",
    name: "Ground Turkey + Broccoli",
    mealType: "breakfast",
    category: "protein-fiber",
    ingredients: [
      { ingredientId: "ground_turkey", grams: 140 },
      { ingredientId: "broccoli", grams: 70 }
    ],
    defaultCookingMethods: {
      ground_turkey: "pan-seared",
      broccoli: "steamed"
    },
    imageKey: "img_ground_turkey_broccoli",
    tags: ["fat-loss", "clean"]
  },

  {
    id: "bf-veg-003",
    name: "Egg Whites + Asparagus",
    mealType: "breakfast",
    category: "protein-fiber",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
      { ingredientId: "asparagus", grams: 70 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled",
      asparagus: "steamed"
    },
    imageKey: "img_egg_whites_asparagus",
    tags: ["lean"]
  },

  // ----------------------------------------------------------
  // 7. Combo Plates
  // ----------------------------------------------------------

  {
    id: "bf-combo-001",
    name: "Eggs + Turkey Sausage",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "eggs", grams: 100 },
      { ingredientId: "turkey_sausage", grams: 80 }
    ],
    defaultCookingMethods: {
      eggs: "scrambled",
      turkey_sausage: "pan-seared"
    },
    imageKey: "img_eggs_turkey_sausage",
    tags: ["protein", "classic"]
  },

  {
    id: "bf-combo-002",
    name: "Egg Whites + Chicken Breast",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 150 },
      { ingredientId: "chicken_breast", grams: 100 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled",
      chicken_breast: "grilled"
    },
    imageKey: "img_egg_whites_chicken",
    tags: ["lean", "muscle-building"]
  },

  {
    id: "bf-combo-003",
    name: "Oatmeal + Protein Shake",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "oats", grams: 60 },
      { ingredientId: "protein_shake", grams: 300 }
    ],
    defaultCookingMethods: {
      oats: "boiled"
    },
    imageKey: "img_oatmeal_protein",
    tags: ["bulking", "energy"]
  },

  {
    id: "bf-combo-004",
    name: "Sweet Potato + Eggs",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "sweet_potatoes", grams: 150 },
      { ingredientId: "eggs", grams: 100 }
    ],
    defaultCookingMethods: {
      sweet_potatoes: "baked",
      eggs: "scrambled"
    },
    imageKey: "img_sweet_potato_eggs",
    tags: ["balanced", "clean"]
  },

  {
    id: "bf-combo-005",
    name: "Salmon + Avocado Plate",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "salmon", grams: 120 },
      { ingredientId: "avocado", grams: 50 }
    ],
    defaultCookingMethods: {
      salmon: "pan-seared"
    },
    imageKey: "img_salmon_avocado",
    tags: ["omega-3", "keto-friendly"]
  },

  // ----------------------------------------------------------
  // PART 2: Templates 26-50
  // ----------------------------------------------------------

  // 26-30 Lean Protein Plates
  {
    id: "bf-pro-006",
    name: "Grilled Turkey Breast Strips",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 130 }
    ],
    defaultCookingMethods: {
      turkey_breast: "grilled"
    },
    imageKey: "img_turkey_grilled",
    tags: ["lean", "clean"]
  },

  {
    id: "bf-pro-007",
    name: "Pan-Seared Lean Beef",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "lean_beef", grams: 140 }
    ],
    defaultCookingMethods: {
      lean_beef: "pan-seared"
    },
    imageKey: "img_lean_beef_pan_seared",
    tags: ["protein", "muscle"]
  },

  {
    id: "bf-pro-008",
    name: "Tilapia Breakfast Filet",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "tilapia", grams: 150 }
    ],
    defaultCookingMethods: {
      tilapia: "pan-seared"
    },
    imageKey: "img_tilapia_pan_seared",
    tags: ["light", "clean"]
  },

  {
    id: "bf-pro-009",
    name: "Baked Cod Portion",
    mealType: "breakfast",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cod", grams: 150 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_cod_baked",
    tags: ["low-fat", "clean"]
  },

  {
    id: "bf-pro-010",
    name: "Shrimp + Egg Whites",
    mealType: "breakfast",
    category: "egg-based",
    ingredients: [
      { ingredientId: "shrimp", grams: 100 },
      { ingredientId: "egg_whites", grams: 120 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      egg_whites: "scrambled"
    },
    imageKey: "img_shrimp_eggwhites",
    tags: ["high-protein", "cutting"]
  },

  // 31-35: Dairy + Fruit Variations
  {
    id: "bf-dairy-004",
    name: "Greek Yogurt + Blueberries",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 160 },
      { ingredientId: "berries", grams: 90 }
    ],
    imageKey: "img_yogurt_blueberries",
    tags: ["antioxidants"]
  },

  {
    id: "bf-dairy-005",
    name: "Greek Yogurt + Strawberries",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 160 },
      { ingredientId: "strawberries", grams: 90 }
    ],
    imageKey: "img_yogurt_strawberries",
    tags: ["fresh"]
  },

  {
    id: "bf-dairy-006",
    name: "Greek Yogurt + Pineapple",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "greek_yogurt", grams: 160 },
      { ingredientId: "pineapple", grams: 90 }
    ],
    imageKey: "img_yogurt_pineapple",
    tags: ["tropical"]
  },

  {
    id: "bf-dairy-007",
    name: "Cottage Cheese + Blueberries",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cottage_cheese", grams: 200 },
      { ingredientId: "berries", grams: 90 }
    ],
    imageKey: "img_cottage_cheese_blueberries",
    tags: ["gut-health"]
  },

  {
    id: "bf-dairy-008",
    name: "Cottage Cheese + Pineapple",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cottage_cheese", grams: 200 },
      { ingredientId: "pineapple", grams: 90 }
    ],
    imageKey: "img_cottage_cheese_pineapple",
    tags: ["fresh", "protein"]
  },

  // 36-40: Grain Meals With Simple Add-ins
  {
    id: "bf-grains-003",
    name: "Grits (Plain)",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "grits", grams: 150 }
    ],
    defaultCookingMethods: {
      grits: "boiled"
    },
    imageKey: "img_grits_plain",
    tags: ["classic"]
  },

  {
    id: "bf-grains-004",
    name: "Oatmeal + Blueberries",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "oats", grams: 80 },
      { ingredientId: "berries", grams: 70 }
    ],
    defaultCookingMethods: { oats: "boiled" },
    imageKey: "img_oats_blueberries",
    tags: ["fiber", "comfort"]
  },

  {
    id: "bf-grains-005",
    name: "Oatmeal + Banana",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "oats", grams: 80 },
      { ingredientId: "banana", grams: 110 }
    ],
    defaultCookingMethods: { oats: "boiled" },
    imageKey: "img_oats_banana",
    tags: ["warm", "simple"]
  },

  {
    id: "bf-grains-006",
    name: "Cream of Rice + Banana",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "white_rice", grams: 150 },
      { ingredientId: "banana", grams: 110 }
    ],
    defaultCookingMethods: { white_rice: "boiled" },
    imageKey: "img_rice_banana",
    tags: ["easy-digesting"]
  },

  {
    id: "bf-grains-007",
    name: "Cream of Rice + Blueberries",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "white_rice", grams: 150 },
      { ingredientId: "berries", grams: 90 }
    ],
    defaultCookingMethods: { white_rice: "boiled" },
    imageKey: "img_rice_blueberries",
    tags: ["light"]
  },

  // 41-45: Fruit + Protein Lean Plates
  {
    id: "bf-fruit-003",
    name: "Sliced Apple + Peanut Butter",
    mealType: "breakfast",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "apple", grams: 140 },
      { ingredientId: "peanut_butter", grams: 32 }
    ],
    imageKey: "img_apple_peanutbutter",
    tags: ["healthy-fat"]
  },

  {
    id: "bf-fruit-004",
    name: "Banana + Almond Butter",
    mealType: "breakfast",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "banana", grams: 120 },
      { ingredientId: "almond_butter", grams: 28 }
    ],
    imageKey: "img_banana_almondbutter",
    tags: ["energy"]
  },

  {
    id: "bf-fruit-005",
    name: "Apple + Greek Yogurt",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "apple", grams: 120 },
      { ingredientId: "greek_yogurt", grams: 150 }
    ],
    imageKey: "img_apple_yogurt",
    tags: ["light"]
  },

  {
    id: "bf-fruit-006",
    name: "Fruit Medley + Cottage Cheese",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "berries", grams: 80 },
      { ingredientId: "pineapple", grams: 60 },
      { ingredientId: "cottage_cheese", grams: 180 }
    ],
    imageKey: "img_cottage_fruitmix",
    tags: ["fresh", "mixed"]
  },

  {
    id: "bf-fruit-007",
    name: "Banana + Protein Shake",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "banana", grams: 120 },
      { ingredientId: "protein_shake", grams: 350 }
    ],
    imageKey: "img_banana_proteinshake",
    tags: ["grab-and-go"]
  },

  // 46-50: Mixed Protein + Carb Plates
  {
    id: "bf-mix-001",
    name: "Eggs + Oatmeal",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "eggs", grams: 150 },
      { ingredientId: "oats", grams: 70 }
    ],
    defaultCookingMethods: {
      eggs: "scrambled",
      oats: "boiled"
    },
    imageKey: "img_eggs_oatmeal",
    tags: ["classic", "balanced"]
  },

  {
    id: "bf-mix-002",
    name: "Egg Whites + Grits",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
      { ingredientId: "grits", grams: 140 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled",
      grits: "boiled"
    },
    imageKey: "img_eggwhites_grits",
    tags: ["southern", "lean"]
  },

  {
    id: "bf-mix-003",
    name: "Chicken Breast + Rice",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 130 },
      { ingredientId: "white_rice", grams: 150 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      white_rice: "boiled"
    },
    imageKey: "img_chicken_rice",
    tags: ["bodybuilding-classic"]
  },

  {
    id: "bf-mix-004",
    name: "Eggs + Sweet Potatoes",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "eggs", grams: 150 },
      { ingredientId: "sweet_potatoes", grams: 140 }
    ],
    defaultCookingMethods: {
      eggs: "scrambled",
      sweet_potatoes: "baked"
    },
    imageKey: "img_eggs_sweetpotatoes",
    tags: ["energy"]
  },

  {
    id: "bf-mix-005",
    name: "Egg Whites + White Rice",
    mealType: "breakfast",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "egg_whites", grams: 170 },
      { ingredientId: "white_rice", grams: 150 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled",
      white_rice: "boiled"
    },
    imageKey: "img_eggwhites_rice",
    tags: ["staple"]
  },
];

// ======================================================================
// HELPER FUNCTIONS
// ======================================================================

export function getBreakfastTemplateById(id: string): MealTemplate | undefined {
  return BREAKFAST_TEMPLATES.find((t) => t.id === id);
}

export function getBreakfastTemplatesByCategory(category: string): MealTemplate[] {
  return BREAKFAST_TEMPLATES.filter((t) => t.category === category);
}

export function getBreakfastTemplatesByTag(tag: string): MealTemplate[] {
  return BREAKFAST_TEMPLATES.filter((t) => t.tags.includes(tag));
}

export function searchBreakfastTemplates(query: string): MealTemplate[] {
  const lowerQuery = query.toLowerCase();
  return BREAKFAST_TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
