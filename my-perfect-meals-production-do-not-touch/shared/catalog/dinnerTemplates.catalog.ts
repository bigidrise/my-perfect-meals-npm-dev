/**
 * DINNER TEMPLATES CATALOG
 * 
 * Curated dinner meal templates for the Hybrid Meal Engine.
 * All templates use validated ingredients from ingredients.catalog.ts
 * and cooking methods from techniques.catalog.ts.
 */

import type { MealTemplate } from "./_types";

// ======================================================================
// DINNER TEMPLATES (1-75)
// ======================================================================

export const DINNER_TEMPLATES: MealTemplate[] = [

  // ----------------------------------------------------------
  // PART 1: Templates 1-25
  // ----------------------------------------------------------

  // 1-5: Core Bodybuilder / Everyday Dinner Plates
  {
    id: "dn-core-001",
    name: "Grilled Chicken Breast + Sweet Potatoes + Broccoli",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "sweet_potatoes", grams: 190 },
      { ingredientId: "broccoli", grams: 110 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      sweet_potatoes: "baked",
      broccoli: "steamed"
    },
    imageKey: "img_chicken_sweetpotato_broccoli",
    tags: ["bodybuilder", "everyday"]
  },

  {
    id: "dn-core-002",
    name: "Baked Salmon + Brown Rice + Green Beans",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 170 },
      { ingredientId: "brown_rice", grams: 170 },
      { ingredientId: "green_beans", grams: 110 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      brown_rice: "boiled"
    },
    imageKey: "img_salmon_rice_greenbeans",
    tags: ["heart-healthy"]
  },

  {
    id: "dn-core-003",
    name: "Lean Beef + White Rice + Asparagus",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 170 },
      { ingredientId: "white_rice", grams: 180 },
      { ingredientId: "asparagus", grams: 110 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled",
      white_rice: "boiled"
    },
    imageKey: "img_beef_rice_asparagus",
    tags: ["performance"]
  },

  {
    id: "dn-core-004",
    name: "Shrimp + Jasmine Rice + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "jasmine_rice", grams: 180 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_rice_spinach",
    tags: ["light", "digestible"]
  },

  {
    id: "dn-core-005",
    name: "Turkey Breast + Quinoa + Zucchini",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "quinoa", grams: 170 },
      { ingredientId: "zucchini", grams: 100 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      quinoa: "boiled"
    },
    imageKey: "img_turkey_quinoa_zucchini",
    tags: ["lean"]
  },

  // 6-10: Anti-Inflammatory / Heart-Healthy Dinner Plates
  {
    id: "dn-ai-001",
    name: "Salmon + Quinoa + Kale",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 170 },
      { ingredientId: "quinoa", grams: 170 },
      { ingredientId: "kale", grams: 90 }
    ],
    defaultCookingMethods: {
      salmon: "baked"
    },
    imageKey: "img_salmon_quinoa_kale",
    tags: ["anti-inflammatory"]
  },

  {
    id: "dn-ai-002",
    name: "Cod + Sweet Potatoes + Brussels Sprouts",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 160 },
      { ingredientId: "sweet_potatoes", grams: 190 },
      { ingredientId: "brussels_sprouts", grams: 110 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_cod_sweetpotato_brussels",
    tags: ["gut-health"]
  },

  {
    id: "dn-ai-003",
    name: "Shrimp + Brown Rice + Mixed Greens",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "brown_rice", grams: 170 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_rice_greens",
    tags: ["heart-healthy"]
  },

  {
    id: "dn-ai-004",
    name: "Turkey Breast + Barley + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "barley", grams: 170 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_barley_spinach",
    tags: ["heart-healthy"]
  },

  {
    id: "dn-ai-005",
    name: "Lean Beef + Quinoa + Tomatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 170 },
      { ingredientId: "quinoa", grams: 170 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled"
    },
    imageKey: "img_beef_quinoa_tomatoes",
    tags: ["anti-inflammatory"]
  },

  // 11-15: Cutting / Fat Loss Dinner Meals
  {
    id: "dn-cut-001",
    name: "Tilapia + Green Beans + Spinach",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "tilapia", grams: 170 },
      { ingredientId: "green_beans", grams: 110 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      tilapia: "pan-seared"
    },
    imageKey: "img_tilapia_greenbeans_spinach",
    tags: ["cutting", "light"]
  },

  {
    id: "dn-cut-002",
    name: "Cod + Asparagus + Mushrooms",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cod", grams: 160 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "mushrooms", grams: 90 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_cod_asparagus_mushrooms",
    tags: ["lean", "shredding"]
  },

  {
    id: "dn-cut-003",
    name: "Turkey Breast + Broccoli + Lettuce",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 160 },
      { ingredientId: "broccoli", grams: 100 },
      { ingredientId: "lettuce", grams: 60 }
    ],
    defaultCookingMethods: {
      turkey_breast: "grilled"
    },
    imageKey: "img_turkey_broccoli_lettuce",
    tags: ["cutting"]
  },

  {
    id: "dn-cut-004",
    name: "Shrimp + Brussels Sprouts + Zucchini",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "brussels_sprouts", grams: 110 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_brussels_zucchini",
    tags: ["fat-loss"]
  },

  {
    id: "dn-cut-005",
    name: "Egg Whites + Asparagus + Tomatoes",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_eggwhites_asparagus_tomatoes",
    tags: ["super-lean"]
  },

  // 16-20: High-Energy Athlete Dinners
  {
    id: "dn-ath-001",
    name: "Chicken Breast + Jasmine Rice + Carrots",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "jasmine_rice", grams: 180 },
      { ingredientId: "carrots", grams: 90 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled"
    },
    imageKey: "img_chicken_rice_carrots",
    tags: ["athlete"]
  },

  {
    id: "dn-ath-002",
    name: "Lean Beef + Pasta + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 170 },
      { ingredientId: "white_pasta", grams: 200 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled"
    },
    imageKey: "img_beef_pasta_spinach",
    tags: ["strength"]
  },

  {
    id: "dn-ath-003",
    name: "Salmon + Potatoes + Cabbage",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 170 },
      { ingredientId: "potatoes", grams: 180 },
      { ingredientId: "cabbage", grams: 100 }
    ],
    defaultCookingMethods: {
      salmon: "baked"
    },
    imageKey: "img_salmon_potatoes_cabbage",
    tags: ["endurance"]
  },

  {
    id: "dn-ath-004",
    name: "Shrimp + White Rice + Green Beans",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "white_rice", grams: 180 },
      { ingredientId: "green_beans", grams: 100 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_rice_greenbeans",
    tags: ["fuel"]
  },

  {
    id: "dn-ath-005",
    name: "Turkey Breast + Brown Rice + Brussels Sprouts",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "brown_rice", grams: 180 },
      { ingredientId: "brussels_sprouts", grams: 100 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_rice_brussels",
    tags: ["athlete"]
  },

  // 21-25: Lifestyle / Balanced Dinners
  {
    id: "dn-life-001",
    name: "Chicken Thighs + Rice + Mixed Greens",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_thighs", grams: 180 },
      { ingredientId: "white_rice", grams: 180 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      chicken_thighs: "baked"
    },
    imageKey: "img_chickenthighs_rice_greens",
    tags: ["comfort", "balanced"]
  },

  {
    id: "dn-life-002",
    name: "Salmon + Farro + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 170 },
      { ingredientId: "farro", grams: 180 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      farro: "boiled"
    },
    imageKey: "img_salmon_farro_spinach",
    tags: ["balanced"]
  },

  {
    id: "dn-life-003",
    name: "Lean Beef + Sweet Potatoes + Zucchini",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 170 },
      { ingredientId: "sweet_potatoes", grams: 180 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled"
    },
    imageKey: "img_beef_sweetpotato_zucchini",
    tags: ["family-friendly"]
  },

  {
    id: "dn-life-004",
    name: "Shrimp + Quinoa + Kale",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "quinoa", grams: 170 },
      { ingredientId: "kale", grams: 80 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_quinoa_kale",
    tags: ["wellness"]
  },

  {
    id: "dn-life-005",
    name: "Turkey Breast + Couscous + Tomatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "couscous", grams: 170 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_couscous_tomatoes",
    tags: ["balanced"]
  },

  // ----------------------------------------------------------
  // PART 2: Templates 26-50
  // ----------------------------------------------------------

  // 26-30: Higher-Fat / Keto-Friendly Dinner Plates
  {
    id: "dn-keto-001",
    name: "Salmon + Avocado + Spinach",
    mealType: "dinner",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "salmon", grams: 170 },
      { ingredientId: "avocado", grams: 80 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      salmon: "pan-seared"
    },
    imageKey: "img_salmon_avocado_spinach",
    tags: ["keto", "anti-inflammatory"]
  },

  {
    id: "dn-keto-002",
    name: "Ground Beef + Cauliflower Rice + Broccoli",
    mealType: "dinner",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "ground_beef_93", grams: 170 },
      { ingredientId: "cauliflower", grams: 150 },
      { ingredientId: "broccoli", grams: 100 }
    ],
    defaultCookingMethods: {
      ground_beef_93: "pan-seared"
    },
    imageKey: "img_groundbeef_cauli_broccoli",
    tags: ["keto"]
  },

  {
    id: "dn-keto-003",
    name: "Shrimp + Zoodles (Zucchini Noodles) + Olive Oil",
    mealType: "dinner",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "zucchini", grams: 140 },
      { ingredientId: "olive_oil", grams: 12 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_zoodles",
    tags: ["low-carb"]
  },

  {
    id: "dn-keto-004",
    name: "Turkey Sausage + Mushrooms + Kale",
    mealType: "dinner",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "turkey_sausage", grams: 170 },
      { ingredientId: "mushrooms", grams: 120 },
      { ingredientId: "kale", grams: 80 }
    ],
    defaultCookingMethods: {
      turkey_sausage: "pan-seared"
    },
    imageKey: "img_turkeysausage_mushrooms_kale",
    tags: ["keto", "simple"]
  },

  {
    id: "dn-keto-005",
    name: "Tilapia + Avocado + Mixed Greens",
    mealType: "dinner",
    category: "protein-fat",
    ingredients: [
      { ingredientId: "tilapia", grams: 170 },
      { ingredientId: "avocado", grams: 80 },
      { ingredientId: "mixed_greens", grams: 70 }
    ],
    defaultCookingMethods: {
      tilapia: "pan-seared"
    },
    imageKey: "img_tilapia_avocado_greens",
    tags: ["light"]
  },

  // 31-35: Mediterranean / Longevity Dinners
  {
    id: "dn-med-001",
    name: "Sea Bass + Couscous + Tomatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "sea_bass", grams: 170 },
      { ingredientId: "couscous", grams: 170 },
      { ingredientId: "tomatoes", grams: 90 }
    ],
    defaultCookingMethods: {
      sea_bass: "pan-seared"
    },
    imageKey: "img_seabass_couscous_tomatoes",
    tags: ["mediterranean"]
  },

  {
    id: "dn-med-002",
    name: "Shrimp + Farro + Zucchini",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "farro", grams: 180 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_farro_zucchini",
    tags: ["longevity"]
  },

  {
    id: "dn-med-003",
    name: "Cod + Potatoes + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 160 },
      { ingredientId: "potatoes", grams: 180 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_cod_potato_spinach",
    tags: ["mediterranean"]
  },

  {
    id: "dn-med-004",
    name: "Chicken Breast + Barley + Mixed Greens",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "barley", grams: 180 },
      { ingredientId: "mixed_greens", grams: 70 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled"
    },
    imageKey: "img_chicken_barley_greens",
    tags: ["heart-healthy"]
  },

  {
    id: "dn-med-005",
    name: "Turkey Breast + Quinoa + Cucumbers",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "quinoa", grams: 170 },
      { ingredientId: "cucumbers", grams: 80 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_quinoa_cucumbers",
    tags: ["longevity"]
  },

  // 36-40: Bulk / Muscle Gain Dinners
  {
    id: "dn-bulk-001",
    name: "Chicken Breast + White Rice + Corn",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 190 },
      { ingredientId: "white_rice", grams: 220 },
      { ingredientId: "corn", grams: 90 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled"
    },
    imageKey: "img_chicken_rice_corn",
    tags: ["bulk"]
  },

  {
    id: "dn-bulk-002",
    name: "Lean Beef + Pasta + Green Peas",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 190 },
      { ingredientId: "white_pasta", grams: 220 },
      { ingredientId: "green_peas", grams: 110 }
    ],
    defaultCookingMethods: {
      lean_beef: "pan-seared"
    },
    imageKey: "img_beef_pasta_greenpeas",
    tags: ["mass-gain"]
  },

  {
    id: "dn-bulk-003",
    name: "Ground Turkey + Brown Rice + Carrots",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "ground_turkey", grams: 190 },
      { ingredientId: "brown_rice", grams: 220 },
      { ingredientId: "carrots", grams: 90 }
    ],
    defaultCookingMethods: {
      ground_turkey: "pan-seared"
    },
    imageKey: "img_turkey_rice_carrots",
    tags: ["bulk"]
  },

  {
    id: "dn-bulk-004",
    name: "Shrimp + Jasmine Rice + Mixed Vegetables",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 180 },
      { ingredientId: "jasmine_rice", grams: 230 },
      { ingredientId: "mixed_greens", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_rice_mixedveg",
    tags: ["refuel"]
  },

  {
    id: "dn-bulk-005",
    name: "Turkey Breast + Potatoes + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 190 },
      { ingredientId: "potatoes", grams: 220 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_potato_spinach",
    tags: ["mass-gain"]
  },

  // 41-45: Very Light / Digestive-Friendly Dinners
  {
    id: "dn-light-001",
    name: "Tilapia + Spinach + Tomatoes",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "tilapia", grams: 160 },
      { ingredientId: "spinach", grams: 90 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      tilapia: "pan-seared"
    },
    imageKey: "img_tilapia_spinach_tomatoes",
    tags: ["light", "night-friendly"]
  },

  {
    id: "dn-light-002",
    name: "Cod + Broccoli + Mushrooms",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cod", grams: 160 },
      { ingredientId: "broccoli", grams: 100 },
      { ingredientId: "mushrooms", grams: 90 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_cod_broccoli_mushrooms",
    tags: ["digestion"]
  },

  {
    id: "dn-light-003",
    name: "Turkey Breast + Asparagus + Cucumbers",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 160 },
      { ingredientId: "asparagus", grams: 100 },
      { ingredientId: "cucumbers", grams: 70 }
    ],
    defaultCookingMethods: {
      turkey_breast: "grilled"
    },
    imageKey: "img_turkey_asparagus_cucumbers",
    tags: ["very-light"]
  },

  {
    id: "dn-light-004",
    name: "Shrimp + Lettuce + Tomatoes",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 160 },
      { ingredientId: "lettuce", grams: 60 },
      { ingredientId: "tomatoes", grams: 70 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_lettuce_tomatoes",
    tags: ["light"]
  },

  {
    id: "dn-light-005",
    name: "Egg Whites + Kale + Mushrooms",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
      { ingredientId: "kale", grams: 80 },
      { ingredientId: "mushrooms", grams: 90 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_eggwhites_kale_mushrooms",
    tags: ["night-friendly"]
  },

  // 46-50: High-Volume / Satiety Dinners
  {
    id: "dn-vol-001",
    name: "Chicken Breast + Cauliflower Rice + Mixed Greens",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "cauliflower", grams: 150 },
      { ingredientId: "mixed_greens", grams: 90 }
    ],
    defaultCookingMethods: {
      chicken_breast: "air-fried"
    },
    imageKey: "img_chicken_caulirice_greens",
    tags: ["high-volume"]
  },

  {
    id: "dn-vol-002",
    name: "Shrimp + Broccoli + Zucchini",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "broccoli", grams: 110 },
      { ingredientId: "zucchini", grams: 100 }
    ],
    defaultCookingMethods: {
      shrimp: "air-fried"
    },
    imageKey: "img_shrimp_broccoli_zucchini",
    tags: ["volume-eating"]
  },

  {
    id: "dn-vol-003",
    name: "Turkey Breast + Cabbage + Spinach",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "cabbage", grams: 110 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_cabbage_spinach",
    tags: ["hungry", "cutting"]
  },

  {
    id: "dn-vol-004",
    name: "Cod + Green Beans + Mixed Greens",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cod", grams: 160 },
      { ingredientId: "green_beans", grams: 110 },
      { ingredientId: "mixed_greens", grams: 90 }
    ],
    defaultCookingMethods: {
      cod: "air-fried"
    },
    imageKey: "img_cod_greenbeans_greens",
    tags: ["satiety"]
  },

  {
    id: "dn-vol-005",
    name: "Egg Whites + Broccoli + Tomatoes",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 180 },
      { ingredientId: "broccoli", grams: 100 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_eggwhites_broccoli_tomatoes",
    tags: ["volume-eating"]
  },

  // ----------------------------------------------------------
  // PART 3: Templates 51-75 (Final Block)
  // ----------------------------------------------------------

  // 51-55: One-Pan / Sheet-Pan Dinners
  {
    id: "dn-sheet-001",
    name: "Sheet Pan Chicken + Broccoli + Potatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 180 },
      { ingredientId: "broccoli", grams: 110 },
      { ingredientId: "potatoes", grams: 190 }
    ],
    defaultCookingMethods: {
      chicken_breast: "baked"
    },
    imageKey: "img_sheetpan_chicken_broccoli_potato",
    tags: ["one-pan", "simple"]
  },

  {
    id: "dn-sheet-002",
    name: "Sheet Pan Salmon + Zucchini + Tomatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 180 },
      { ingredientId: "zucchini", grams: 110 },
      { ingredientId: "tomatoes", grams: 90 }
    ],
    defaultCookingMethods: {
      salmon: "baked"
    },
    imageKey: "img_sheetpan_salmon_zucchini_tomatoes",
    tags: ["one-pan", "anti-inflammatory"]
  },

  {
    id: "dn-sheet-003",
    name: "Sheet Pan Shrimp + Asparagus + Cauliflower",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 180 },
      { ingredientId: "asparagus", grams: 120 },
      { ingredientId: "cauliflower", grams: 120 }
    ],
    defaultCookingMethods: {
      shrimp: "baked"
    },
    imageKey: "img_sheetpan_shrimp_asparagus_cauli",
    tags: ["one-pan", "light"]
  },

  {
    id: "dn-sheet-004",
    name: "Sheet Pan Cod + Brussels Sprouts + Sweet Potatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 180 },
      { ingredientId: "brussels_sprouts", grams: 110 },
      { ingredientId: "sweet_potatoes", grams: 190 }
    ],
    defaultCookingMethods: {
      cod: "baked"
    },
    imageKey: "img_sheetpan_cod_brussels_sweetpotato",
    tags: ["one-pan", "fiber-rich"]
  },

  {
    id: "dn-sheet-005",
    name: "Sheet Pan Turkey Breast + Carrots + Mushrooms",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 180 },
      { ingredientId: "carrots", grams: 120 },
      { ingredientId: "mushrooms", grams: 120 }
    ],
    defaultCookingMethods: {
      turkey_breast: "baked"
    },
    imageKey: "img_sheetpan_turkey_carrot_mushroom",
    tags: ["one-pan", "cutting"]
  },

  // 56-60: High-Protein, Low-Carb Dinners (Cutting Phase)
  {
    id: "dn-cut-006",
    name: "Chicken Breast + Asparagus + Mixed Greens",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "asparagus", grams: 120 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      chicken_breast: "pan-seared"
    },
    imageKey: "img_chicken_asparagus_greens",
    tags: ["cutting", "very-lean"]
  },

  {
    id: "dn-cut-007",
    name: "Shrimp + Kale + Tomatoes",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "kale", grams: 90 },
      { ingredientId: "tomatoes", grams: 80 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_kale_tomatoes",
    tags: ["cutting", "night-friendly"]
  },

  {
    id: "dn-cut-008",
    name: "Egg Whites + Spinach + Mushrooms",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 200 },
      { ingredientId: "spinach", grams: 90 },
      { ingredientId: "mushrooms", grams: 90 }
    ],
    defaultCookingMethods: {
      egg_whites: "scrambled"
    },
    imageKey: "img_eggwhite_spinach_mushroom",
    tags: ["cutting", "volume"]
  },

  {
    id: "dn-cut-009",
    name: "Tilapia + Green Beans + Lettuce",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "tilapia", grams: 160 },
      { ingredientId: "green_beans", grams: 110 },
      { ingredientId: "lettuce", grams: 50 }
    ],
    defaultCookingMethods: {
      tilapia: "air-fried"
    },
    imageKey: "img_tilapia_greenbeans_lettuce",
    tags: ["cutting", "light"]
  },

  {
    id: "dn-cut-010",
    name: "Turkey Breast + Cauliflower Rice + Zucchini",
    mealType: "dinner",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "cauliflower", grams: 150 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      turkey_breast: "air-fried"
    },
    imageKey: "img_turkey_caulirice_zucchini",
    tags: ["cutting"]
  },

  // 61-65: Gut-Friendly / Anti-Inflammatory Dinners
  {
    id: "dn-anti-001",
    name: "Salmon + Spinach + Sweet Potatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 180 },
      { ingredientId: "spinach", grams: 90 },
      { ingredientId: "sweet_potatoes", grams: 180 }
    ],
    defaultCookingMethods: {
      salmon: "baked"
    },
    imageKey: "img_salmon_spinach_sweetpotato",
    tags: ["anti-inflammatory"]
  },

  {
    id: "dn-anti-002",
    name: "Cod + Zucchini + Brown Rice",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 170 },
      { ingredientId: "zucchini", grams: 90 },
      { ingredientId: "brown_rice", grams: 200 }
    ],
    defaultCookingMethods: {
      cod: "poached"
    },
    imageKey: "img_cod_zucchini_brownrice",
    tags: ["gut-friendly"]
  },

  {
    id: "dn-anti-003",
    name: "Chicken Thighs + Carrots + Mushrooms",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_thighs", grams: 180 },
      { ingredientId: "carrots", grams: 110 },
      { ingredientId: "mushrooms", grams: 90 }
    ],
    defaultCookingMethods: {
      chicken_thighs: "baked"
    },
    imageKey: "img_chickenthigh_carrot_mushroom",
    tags: ["anti-inflammatory"]
  },

  {
    id: "dn-anti-004",
    name: "Shrimp + Mixed Greens + Quinoa",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "mixed_greens", grams: 80 },
      { ingredientId: "quinoa", grams: 180 }
    ],
    defaultCookingMethods: {
      shrimp: "grilled"
    },
    imageKey: "img_shrimp_greens_quinoa",
    tags: ["gut-friendly"]
  },

  {
    id: "dn-anti-005",
    name: "Turkey Breast + Cabbage + Sweet Potatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "cabbage", grams: 120 },
      { ingredientId: "sweet_potatoes", grams: 170 }
    ],
    defaultCookingMethods: {
      turkey_breast: "baked"
    },
    imageKey: "img_turkey_cabbage_sweetpotato",
    tags: ["anti-inflammatory"]
  },

  // 66-70: High-Fiber / Blood Sugar-Friendly Dinners
  {
    id: "dn-fiber-001",
    name: "Chicken Breast + Lentils + Broccoli",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 170 },
      { ingredientId: "lentils", grams: 180 },
      { ingredientId: "broccoli", grams: 100 }
    ],
    defaultCookingMethods: {
      chicken_breast: "air-fried"
    },
    imageKey: "img_chicken_lentils_broccoli",
    tags: ["high-fiber", "blood-sugar-friendly"]
  },

  {
    id: "dn-fiber-002",
    name: "Cod + Black Beans + Tomatoes",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 170 },
      { ingredientId: "black_beans", grams: 180 },
      { ingredientId: "tomatoes", grams: 90 }
    ],
    defaultCookingMethods: {
      cod: "pan-seared"
    },
    imageKey: "img_cod_blackbeans_tomatoes",
    tags: ["high-fiber"]
  },

  {
    id: "dn-fiber-003",
    name: "Turkey Breast + Quinoa + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 170 },
      { ingredientId: "quinoa", grams: 180 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_quinoa_spinach",
    tags: ["blood-sugar-friendly"]
  },

  {
    id: "dn-fiber-004",
    name: "Shrimp + Chickpeas + Zucchini",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "chickpeas", grams: 170 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_chickpeas_zucchini",
    tags: ["high-fiber"]
  },

  {
    id: "dn-fiber-005",
    name: "Tilapia + Pinto Beans + Mixed Greens",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "tilapia", grams: 170 },
      { ingredientId: "pinto_beans", grams: 180 },
      { ingredientId: "mixed_greens", grams: 70 }
    ],
    defaultCookingMethods: {
      tilapia: "air-fried"
    },
    imageKey: "img_tilapia_pintobeans_greens",
    tags: ["blood-sugar-friendly"]
  },

  // 71-75: Comfort / Familiar Dinner Plates (Clean Versions)
  {
    id: "dn-comfort-001",
    name: "Ground Beef + Mashed Potatoes + Green Beans",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "ground_beef_93", grams: 180 },
      { ingredientId: "potatoes", grams: 200 },
      { ingredientId: "green_beans", grams: 110 }
    ],
    defaultCookingMethods: {
      ground_beef_93: "pan-seared",
      potatoes: "boiled"
    },
    imageKey: "img_beef_mashedpotato_greenbeans",
    tags: ["comfort", "cleaned-up"]
  },

  {
    id: "dn-comfort-002",
    name: "Chicken Thighs + White Rice + Carrots",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_thighs", grams: 180 },
      { ingredientId: "white_rice", grams: 200 },
      { ingredientId: "carrots", grams: 110 }
    ],
    defaultCookingMethods: {
      chicken_thighs: "baked"
    },
    imageKey: "img_chickenthigh_rice_carrots",
    tags: ["comfort"]
  },

  {
    id: "dn-comfort-003",
    name: "Turkey Meatballs + Pasta + Spinach",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "ground_turkey", grams: 200 },
      { ingredientId: "white_pasta", grams: 220 },
      { ingredientId: "spinach", grams: 80 }
    ],
    defaultCookingMethods: {
      ground_turkey: "baked"
    },
    imageKey: "img_turkeymeatball_pasta_spinach",
    tags: ["comfort", "clean"]
  },

  {
    id: "dn-comfort-004",
    name: "Shrimp Stir Fry + Rice Noodles + Mixed Veg",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 170 },
      { ingredientId: "rice_noodles", grams: 220 },
      { ingredientId: "mixed_greens", grams: 110 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared"
    },
    imageKey: "img_shrimp_stirfry_rice_noodles",
    tags: ["comfort", "high-volume"]
  },

  {
    id: "dn-comfort-005",
    name: "Chicken Breast + Sourdough + Salad",
    mealType: "dinner",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 180 },
      { ingredientId: "sourdough_bread", grams: 60 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled"
    },
    imageKey: "img_chicken_sourdough_salad",
    tags: ["comfort", "simple"]
  }
];

// ======================================================================
// HELPER FUNCTIONS
// ======================================================================

export function getDinnerTemplateById(id: string): MealTemplate | undefined {
  return DINNER_TEMPLATES.find((t) => t.id === id);
}

export function getDinnerTemplatesByCategory(category: string): MealTemplate[] {
  return DINNER_TEMPLATES.filter((t) => t.category === category);
}

export function getDinnerTemplatesByTag(tag: string): MealTemplate[] {
  return DINNER_TEMPLATES.filter((t) => t.tags.includes(tag));
}

export function searchDinnerTemplates(query: string): MealTemplate[] {
  const lowerQuery = query.toLowerCase();
  return DINNER_TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
