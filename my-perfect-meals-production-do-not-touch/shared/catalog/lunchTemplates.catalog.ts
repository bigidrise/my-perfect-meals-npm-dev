// ======================================================================
// MEAL TEMPLATES CATALOG (LUNCH) — PART 1 (1–25)
// Deterministic meals for stable rendering and consistent prep.
// ======================================================================

import { MealTemplate } from "./_types";

export const LUNCH_TEMPLATES: MealTemplate[] = [

  // ----------------------------------------------------------
  // 1–5: Lean Protein Solo Plates
  // ----------------------------------------------------------

  {
    id: "ln-pro-001",
    name: "Grilled Chicken Breast",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 160 }
    ],
    defaultCookingMethods: { chicken_breast: "grilled" },
    imageKey: "img_chickenbreast_grilled",
    tags: ["lean", "clean"]
  },

  {
    id: "ln-pro-002",
    name: "Pan-Seared Turkey Breast",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 160 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared" },
    imageKey: "img_turkey_pan_seared",
    tags: ["lean", "muscle"]
  },

  {
    id: "ln-pro-003",
    name: "Baked Salmon Fillet",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "salmon", grams: 170 }
    ],
    defaultCookingMethods: { salmon: "baked" },
    imageKey: "img_salmon_baked",
    tags: ["omega-3", "clean"]
  },

  {
    id: "ln-pro-004",
    name: "Grilled Sirloin Steak",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "sirloin_steak", grams: 170 }
    ],
    defaultCookingMethods: { sirloin_steak: "grilled" },
    imageKey: "img_steak_grilled",
    tags: ["high-protein"]
  },

  {
    id: "ln-pro-005",
    name: "Pan-Seared Shrimp",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_pan_seared",
    tags: ["light", "clean"]
  },

  // ----------------------------------------------------------
  // 6–10: Protein + Fibrous Carb Plates
  // ----------------------------------------------------------

  {
    id: "ln-fib-001",
    name: "Grilled Chicken + Broccoli",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "broccoli", grams: 120 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      broccoli: "steamed"
    },
    imageKey: "img_chicken_broccoli",
    tags: ["cutting", "classic"]
  },

  {
    id: "ln-fib-002",
    name: "Turkey Breast + Green Beans",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "green_beans", grams: 130 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      green_beans: "steamed"
    },
    imageKey: "img_turkey_greenbeans",
    tags: ["lean"]
  },

  {
    id: "ln-fib-003",
    name: "Salmon + Asparagus",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 160 },
      { ingredientId: "asparagus", grams: 120 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      asparagus: "grilled"
    },
    imageKey: "img_salmon_asparagus",
    tags: ["body-recomp"]
  },

  {
    id: "ln-fib-004",
    name: "Lean Beef + Mixed Greens",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      lean_beef: "pan-seared"
    },
    imageKey: "img_beef_mixedgreens",
    tags: ["light", "high-protein"]
  },

  {
    id: "ln-fib-005",
    name: "Shrimp + Zucchini",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 },
      { ingredientId: "zucchini", grams: 130 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      zucchini: "grilled"
    },
    imageKey: "img_shrimp_zucchini",
    tags: ["low-cal"]
  },

  // ----------------------------------------------------------
  // 11–15: Protein + Starchy Carb Plates
  // ----------------------------------------------------------

  {
    id: "ln-starch-001",
    name: "Chicken Breast + White Rice",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "white_rice", grams: 180 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      white_rice: "boiled"
    },
    imageKey: "img_chicken_rice",
    tags: ["bodybuilding"]
  },

  {
    id: "ln-starch-002",
    name: "Salmon + Sweet Potatoes",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 160 },
      { ingredientId: "sweet_potatoes", grams: 180 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      sweet_potatoes: "baked"
    },
    imageKey: "img_salmon_sweetpotatoes",
    tags: ["balanced"]
  },

  {
    id: "ln-starch-003",
    name: "Lean Beef + Brown Rice",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 160 },
      { ingredientId: "brown_rice", grams: 180 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled",
      brown_rice: "boiled"
    },
    imageKey: "img_beef_brownrice",
    tags: ["muscle"]
  },

  {
    id: "ln-starch-004",
    name: "Shrimp + Jasmine Rice",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "jasmine_rice", grams: 180 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      jasmine_rice: "boiled"
    },
    imageKey: "img_shrimp_jasminerice",
    tags: ["light"]
  },

  {
    id: "ln-starch-005",
    name: "Turkey Breast + Quinoa",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "quinoa", grams: 170 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      quinoa: "boiled"
    },
    imageKey: "img_turkey_quinoa",
    tags: ["clean"]
  },

  // ----------------------------------------------------------
  // 16–20: Bowls (Mixed Ingredients)
  // ----------------------------------------------------------

  {
    id: "ln-bowl-001",
    name: "Chicken Rice Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 140 },
      { ingredientId: "white_rice", grams: 170 },
      { ingredientId: "broccoli", grams: 100 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      white_rice: "boiled",
      broccoli: "steamed"
    },
    imageKey: "img_bowl_chicken_rice",
    tags: ["classic", "balanced"]
  },

  {
    id: "ln-bowl-002",
    name: "Salmon Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "white_rice", grams: 160 },
      { ingredientId: "cucumber", grams: 60 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      white_rice: "boiled"
    },
    imageKey: "img_salmon_bowl",
    tags: ["fresh"]
  },

  {
    id: "ln-bowl-003",
    name: "Beef Power Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "brown_rice", grams: 170 },
      { ingredientId: "spinach", grams: 60 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled",
      brown_rice: "boiled"
    },
    imageKey: "img_beef_powerbowl",
    tags: ["muscle"]
  },

  {
    id: "ln-bowl-004",
    name: "Turkey Quinoa Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "quinoa", grams: 160 },
      { ingredientId: "mixed_greens", grams: 60 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      quinoa: "boiled"
    },
    imageKey: "img_turkey_quinoa_bowl",
    tags: ["clean-eating"]
  },

  {
    id: "ln-bowl-005",
    name: "Shrimp Sweet Potato Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 },
      { ingredientId: "sweet_potatoes", grams: 160 },
      { ingredientId: "zucchini", grams: 60 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      sweet_potatoes: "baked"
    },
    imageKey: "img_shrimp_sweetpotato_bowl",
    tags: ["cutting"]
  },

  // ----------------------------------------------------------
  // 21–25: High-Volume Veggie Plates
  // ----------------------------------------------------------

  {
    id: "ln-veg-001",
    name: "Chicken + Veggie Plate",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "mixed_greens", grams: 80 },
      { ingredientId: "zucchini", grams: 100 }
    ],
    defaultCookingMethods: { chicken_breast: "grilled", zucchini: "grilled" },
    imageKey: "img_chicken_veggies",
    tags: ["volume-eating"]
  },

  {
    id: "ln-veg-002",
    name: "Turkey + Veggie Plate",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "spinach", grams: 60 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared", asparagus: "grilled" },
    imageKey: "img_turkey_veggies",
    tags: ["lean"]
  },

  {
    id: "ln-veg-003",
    name: "Shrimp + Veggie Plate",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 },
      { ingredientId: "broccoli", grams: 120 },
      { ingredientId: "zucchini", grams: 80 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_veggies",
    tags: ["light"]
  },

  {
    id: "ln-veg-004",
    name: "Salmon + Veggie Mix",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "spinach", grams: 60 },
      { ingredientId: "asparagus", grams: 120 }
    ],
    defaultCookingMethods: { salmon: "baked", asparagus: "grilled" },
    imageKey: "img_salmon_veggies",
    tags: ["body-recomp"]
  },

  {
    id: "ln-veg-005",
    name: "Beef + Veggie Mix",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "broccoli", grams: 120 },
      { ingredientId: "spinach", grams: 60 }
    ],
    defaultCookingMethods: { lean_beef: "grilled" },
    imageKey: "img_beef_veggies",
    tags: ["muscle", "cutting"]
  },

  // ----------------------------------------------------------
  // PART 2: Templates 26-50
  // ----------------------------------------------------------

  // 26-30: Protein + Pasta / Noodles
  {
    id: "ln-pasta-001",
    name: "Grilled Chicken + Whole Wheat Pasta",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "whole_wheat_pasta", grams: 180 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      whole_wheat_pasta: "boiled"
    },
    imageKey: "img_chicken_wwpasta",
    tags: ["balanced"]
  },

  {
    id: "ln-pasta-002",
    name: "Lean Beef + White Pasta",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "white_pasta", grams: 180 }
    ],
    defaultCookingMethods: {
      lean_beef: "pan-seared",
      white_pasta: "boiled"
    },
    imageKey: "img_beef_whitepasta",
    tags: ["bulking"]
  },

  {
    id: "ln-pasta-003",
    name: "Shrimp + Rice Noodles",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "rice_noodles", grams: 180 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      rice_noodles: "boiled"
    },
    imageKey: "img_shrimp_noodles",
    tags: ["light"]
  },

  {
    id: "ln-pasta-004",
    name: "Turkey Breast + Sourdough",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "sourdough_bread", grams: 70 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared"
    },
    imageKey: "img_turkey_sourdough",
    tags: ["simple"]
  },

  {
    id: "ln-pasta-005",
    name: "Salmon + Quinoa Pasta",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "quinoa_pasta", grams: 180 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      quinoa_pasta: "boiled"
    },
    imageKey: "img_salmon_quinoapasta",
    tags: ["high-protein"]
  },

  // 31-35: Grain-Free / Low-Carb Plates
  {
    id: "ln-lc-001",
    name: "Chicken + Cauliflower Rice",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "cauliflower", grams: 150 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      cauliflower: "fried"
    },
    imageKey: "img_chicken_cauliflowerrice",
    tags: ["keto-friendly"]
  },

  {
    id: "ln-lc-002",
    name: "Beef + Zucchini Noodles",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "zucchini", grams: 150 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled",
      zucchini: "grilled"
    },
    imageKey: "img_beef_zoodles",
    tags: ["low-carb"]
  },

  {
    id: "ln-lc-003",
    name: "Shrimp + Spinach Plate",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "spinach", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      spinach: "steamed"
    },
    imageKey: "img_shrimp_spinach",
    tags: ["light", "cutting"]
  },

  {
    id: "ln-lc-004",
    name: "Salmon + Grilled Vegetables",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "zucchini", grams: 100 },
      { ingredientId: "bell_peppers", grams: 80 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      zucchini: "grilled",
      bell_peppers: "grilled"
    },
    imageKey: "img_salmon_grilledveg",
    tags: ["clean", "anti-inflammatory"]
  },

  {
    id: "ln-lc-005",
    name: "Turkey Breast + Shredded Cabbage",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "cabbage", grams: 140 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      cabbage: "stir-fried"
    },
    imageKey: "img_turkey_cabbage",
    tags: ["gut-health"]
  },

  // 36-40: Bowls (More global flavors)
  {
    id: "ln-bowl-006",
    name: "Mediterranean Chicken Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "quinoa", grams: 160 },
      { ingredientId: "cucumber", grams: 60 },
      { ingredientId: "tomatoes", grams: 60 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      quinoa: "boiled"
    },
    imageKey: "img_mediterranean_chicken",
    tags: ["mediterranean"]
  },

  {
    id: "ln-bowl-007",
    name: "Asian Shrimp Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "rice", grams: 170 },
      { ingredientId: "bok_choy", grams: 80 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      rice: "boiled",
      bok_choy: "steamed"
    },
    imageKey: "img_asian_shrimpbowl",
    tags: ["fresh"]
  },

  {
    id: "ln-bowl-008",
    name: "Beef Burrito Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "brown_rice", grams: 160 },
      { ingredientId: "lettuce", grams: 60 },
      { ingredientId: "tomatoes", grams: 50 }
    ],
    defaultCookingMethods: {
      lean_beef: "pan-seared",
      brown_rice: "boiled"
    },
    imageKey: "img_beef_burritobowl",
    tags: ["high-energy"]
  },

  {
    id: "ln-bowl-009",
    name: "Turkey Power Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "white_rice", grams: 160 },
      { ingredientId: "spinach", grams: 60 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      white_rice: "boiled"
    },
    imageKey: "img_turkey_powerbowl",
    tags: ["lean"]
  },

  {
    id: "ln-bowl-010",
    name: "Salmon Greens Bowl",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "mixed_greens", grams: 80 },
      { ingredientId: "zucchini", grams: 80 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      zucchini: "grilled"
    },
    imageKey: "img_salmon_greensbowl",
    tags: ["anti-inflammatory"]
  },

  // 41-45: Sandwiches / Wraps
  {
    id: "ln-wr-001",
    name: "Chicken Breast Wrap",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 130 },
      { ingredientId: "whole_wheat_tortilla", grams: 60 },
      { ingredientId: "lettuce", grams: 40 }
    ],
    defaultCookingMethods: { chicken_breast: "grilled" },
    imageKey: "img_chicken_wrap",
    tags: ["on-the-go"]
  },

  {
    id: "ln-wr-002",
    name: "Turkey Breast Wrap",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 130 },
      { ingredientId: "whole_wheat_tortilla", grams: 60 },
      { ingredientId: "spinach", grams: 40 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared" },
    imageKey: "img_turkey_wrap",
    tags: ["lean"]
  },

  {
    id: "ln-wr-003",
    name: "Shrimp Wrap",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 },
      { ingredientId: "whole_wheat_tortilla", grams: 60 },
      { ingredientId: "lettuce", grams: 40 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_wrap",
    tags: ["light"]
  },

  {
    id: "ln-wr-004",
    name: "Beef Sourdough Sandwich",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 130 },
      { ingredientId: "sourdough_bread", grams: 70 }
    ],
    defaultCookingMethods: { lean_beef: "grilled" },
    imageKey: "img_beef_sandwich",
    tags: ["bulking"]
  },

  {
    id: "ln-wr-005",
    name: "Salmon Greens Sandwich",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 130 },
      { ingredientId: "sourdough_bread", grams: 70 },
      { ingredientId: "lettuce", grams: 40 }
    ],
    defaultCookingMethods: { salmon: "baked" },
    imageKey: "img_salmon_sandwich",
    tags: ["fresh"]
  },

  // 46-50: High-Volume "Cutting" Plates
  {
    id: "ln-cut-001",
    name: "Chicken + Broccoli + Zucchini",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "broccoli", grams: 110 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: { chicken_breast: "grilled" },
    imageKey: "img_chicken_broc_zuc",
    tags: ["cutting", "volume"]
  },

  {
    id: "ln-cut-002",
    name: "Turkey + Spinach + Mushrooms",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "spinach", grams: 90 },
      { ingredientId: "mushrooms", grams: 80 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared" },
    imageKey: "img_turkey_spin_mush",
    tags: ["lean", "volume"]
  },

  {
    id: "ln-cut-003",
    name: "Shrimp + Asparagus + Greens",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 140 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "mixed_greens", grams: 60 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_asparagus_greens",
    tags: ["light"]
  },

  {
    id: "ln-cut-004",
    name: "Salmon + Broccoli + Spinach",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "broccoli", grams: 100 },
      { ingredientId: "spinach", grams: 70 }
    ],
    defaultCookingMethods: { salmon: "baked" },
    imageKey: "img_salmon_broc_spin",
    tags: ["anti-inflammatory"]
  },

  {
    id: "ln-cut-005",
    name: "Beef + Green Beans + Mushrooms",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "green_beans", grams: 110 },
      { ingredientId: "mushrooms", grams: 70 }
    ],
    defaultCookingMethods: { lean_beef: "grilled" },
    imageKey: "img_beef_greens_mushrooms",
    tags: ["muscle-cut"]
  },

  // ----------------------------------------------------------
  // PART 3: Templates 51-75 (Final Block)
  // ----------------------------------------------------------

  // 51-55: Clean Bodybuilder Plates
  {
    id: "ln-bb-001",
    name: "Chicken Breast + Brown Rice + Green Beans",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "brown_rice", grams: 160 },
      { ingredientId: "green_beans", grams: 100 }
    ],
    defaultCookingMethods: {
      chicken_breast: "grilled",
      brown_rice: "boiled",
      green_beans: "steamed"
    },
    imageKey: "img_chicken_rice_greenbeans",
    tags: ["classic", "bodybuilder"]
  },

  {
    id: "ln-bb-002",
    name: "Turkey Breast + Sweet Potatoes + Spinach",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "sweet_potatoes", grams: 180 },
      { ingredientId: "spinach", grams: 100 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      sweet_potatoes: "baked",
      spinach: "steamed"
    },
    imageKey: "img_turkey_sweetpotato_spinach",
    tags: ["performance"]
  },

  {
    id: "ln-bb-003",
    name: "Lean Beef + White Rice + Broccoli",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "white_rice", grams: 170 },
      { ingredientId: "broccoli", grams: 100 }
    ],
    defaultCookingMethods: {
      lean_beef: "grilled",
      white_rice: "boiled",
      broccoli: "steamed"
    },
    imageKey: "img_beef_rice_broccoli",
    tags: ["muscle"]
  },

  {
    id: "ln-bb-004",
    name: "Shrimp + Basmati Rice + Zucchini",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "basmati_rice", grams: 170 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      basmati_rice: "boiled"
    },
    imageKey: "img_shrimp_rice_zucchini",
    tags: ["clean", "light"]
  },

  {
    id: "ln-bb-005",
    name: "Salmon + Jasmine Rice + Asparagus",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "jasmine_rice", grams: 160 },
      { ingredientId: "asparagus", grams: 100 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      jasmine_rice: "boiled",
      asparagus: "grilled"
    },
    imageKey: "img_salmon_rice_asparagus",
    tags: ["anti-inflammatory"]
  },

  // 56-60: High-Protein "Lean Bulk" Meals
  {
    id: "ln-hp-001",
    name: "Turkey Breast + Farro + Brussels Sprouts",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 160 },
      { ingredientId: "farro", grams: 180 },
      { ingredientId: "brussels_sprouts", grams: 120 }
    ],
    defaultCookingMethods: {
      turkey_breast: "pan-seared",
      farro: "boiled"
    },
    imageKey: "img_turkey_farro_brussels",
    tags: ["lean-bulk"]
  },

  {
    id: "ln-hp-002",
    name: "Chicken Thighs + Potatoes + Carrots",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_thighs", grams: 180 },
      { ingredientId: "potatoes", grams: 180 },
      { ingredientId: "carrots", grams: 100 }
    ],
    defaultCookingMethods: {
      chicken_thighs: "baked",
      potatoes: "baked"
    },
    imageKey: "img_chickenthighs_potato_carrot",
    tags: ["comfort"]
  },

  {
    id: "ln-hp-003",
    name: "Beef Sirloin + Wild Rice + Cabbage",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "sirloin_steak", grams: 160 },
      { ingredientId: "wild_rice", grams: 170 },
      { ingredientId: "cabbage", grams: 100 }
    ],
    defaultCookingMethods: {
      sirloin_steak: "pan-seared",
      wild_rice: "boiled"
    },
    imageKey: "img_sirloin_wildrice_cabbage",
    tags: ["strength"]
  },

  {
    id: "ln-hp-004",
    name: "Shrimp + Couscous + Mixed Greens",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "couscous", grams: 170 },
      { ingredientId: "mixed_greens", grams: 80 }
    ],
    defaultCookingMethods: {
      shrimp: "pan-seared",
      couscous: "boiled"
    },
    imageKey: "img_shrimp_couscous_greens",
    tags: ["athlete"]
  },

  {
    id: "ln-hp-005",
    name: "Salmon + Barley + Spinach",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "barley", grams: 170 },
      { ingredientId: "spinach", grams: 100 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      barley: "boiled"
    },
    imageKey: "img_salmon_barley_spinach",
    tags: ["omega-rich"]
  },

  // 61-65: Low-Cal / Cutting Meals
  {
    id: "ln-cut-006",
    name: "Cod + Green Beans + Zucchini",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "cod", grams: 150 },
      { ingredientId: "green_beans", grams: 110 },
      { ingredientId: "zucchini", grams: 90 }
    ],
    defaultCookingMethods: { cod: "baked" },
    imageKey: "img_cod_greenbeans_zucchini",
    tags: ["light", "cutting"]
  },

  {
    id: "ln-cut-007",
    name: "Tilapia + Asparagus + Mushrooms",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "tilapia", grams: 150 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "mushrooms", grams: 80 }
    ],
    defaultCookingMethods: { tilapia: "pan-seared" },
    imageKey: "img_tilapia_asparagus_mushrooms",
    tags: ["ultra-lean"]
  },

  {
    id: "ln-cut-008",
    name: "Turkey Breast + Broccoli + Lettuce",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "broccoli", grams: 100 },
      { ingredientId: "lettuce", grams: 50 }
    ],
    defaultCookingMethods: { turkey_breast: "grilled" },
    imageKey: "img_turkey_broc_lettuce",
    tags: ["volume"]
  },

  {
    id: "ln-cut-009",
    name: "Shrimp + Brussels Sprouts + Spinach",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "brussels_sprouts", grams: 110 },
      { ingredientId: "spinach", grams: 80 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_brussels_spinach",
    tags: ["cutting"]
  },

  {
    id: "ln-cut-010",
    name: "Egg Whites + Asparagus + Tomatoes",
    mealType: "lunch",
    category: "all-protein",
    ingredients: [
      { ingredientId: "egg_whites", grams: 170 },
      { ingredientId: "asparagus", grams: 110 },
      { ingredientId: "tomatoes", grams: 70 }
    ],
    defaultCookingMethods: { egg_whites: "scrambled" },
    imageKey: "img_eggwhite_asparagus_tomatoes",
    tags: ["shredding"]
  },

  // 66-70: Anti-Inflammatory / Heart-Healthy Plates
  {
    id: "ln-ai-001",
    name: "Salmon + Quinoa + Kale",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "quinoa", grams: 160 },
      { ingredientId: "kale", grams: 80 }
    ],
    defaultCookingMethods: {
      salmon: "baked",
      quinoa: "boiled"
    },
    imageKey: "img_salmon_quinoa_kale",
    tags: ["anti-inflammatory", "heart"]
  },

  {
    id: "ln-ai-002",
    name: "Shrimp + Brown Rice + Spinach",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "brown_rice", grams: 160 },
      { ingredientId: "spinach", grams: 80 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_rice_spinach",
    tags: ["anti-inflammatory"]
  },

  {
    id: "ln-ai-003",
    name: "Cod + Sweet Potatoes + Brussels Sprouts",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "cod", grams: 150 },
      { ingredientId: "sweet_potatoes", grams: 160 },
      { ingredientId: "brussels_sprouts", grams: 100 }
    ],
    defaultCookingMethods: { cod: "baked" },
    imageKey: "img_cod_sweetpotato_brussels",
    tags: ["gut-health"]
  },

  {
    id: "ln-ai-004",
    name: "Turkey Breast + Quinoa + Mixed Greens",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "quinoa", grams: 160 },
      { ingredientId: "mixed_greens", grams: 70 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared" },
    imageKey: "img_turkey_quinoa_greens",
    tags: ["heart-healthy"]
  },

  {
    id: "ln-ai-005",
    name: "Lean Beef + Kale + Tomatoes",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 150 },
      { ingredientId: "kale", grams: 80 },
      { ingredientId: "tomatoes", grams: 70 }
    ],
    defaultCookingMethods: { lean_beef: "grilled" },
    imageKey: "img_beef_kale_tomatoes",
    tags: ["anti-inflammatory"]
  },

  // 71-75: High-Energy Athlete Meals
  {
    id: "ln-ath-001",
    name: "Chicken + Jasmine Rice + Corn",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "chicken_breast", grams: 150 },
      { ingredientId: "jasmine_rice", grams: 170 },
      { ingredientId: "corn", grams: 100 }
    ],
    defaultCookingMethods: { chicken_breast: "grilled" },
    imageKey: "img_chicken_rice_corn",
    tags: ["athlete", "carb-load"]
  },

  {
    id: "ln-ath-002",
    name: "Lean Beef + Pasta + Spinach",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "lean_beef", grams: 160 },
      { ingredientId: "white_pasta", grams: 180 },
      { ingredientId: "spinach", grams: 70 }
    ],
    defaultCookingMethods: { lean_beef: "grilled" },
    imageKey: "img_beef_pasta_spinach",
    tags: ["strength"]
  },

  {
    id: "ln-ath-003",
    name: "Salmon + White Rice + Carrots",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "salmon", grams: 150 },
      { ingredientId: "white_rice", grams: 170 },
      { ingredientId: "carrots", grams: 80 }
    ],
    defaultCookingMethods: { salmon: "baked" },
    imageKey: "img_salmon_rice_carrots",
    tags: ["endurance"]
  },

  {
    id: "ln-ath-004",
    name: "Shrimp + Potatoes + Green Beans",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "shrimp", grams: 150 },
      { ingredientId: "potatoes", grams: 160 },
      { ingredientId: "green_beans", grams: 90 }
    ],
    defaultCookingMethods: { shrimp: "pan-seared" },
    imageKey: "img_shrimp_potatoes_greenbeans",
    tags: ["fuel"]
  },

  {
    id: "ln-ath-005",
    name: "Turkey Breast + Brown Rice + Broccoli",
    mealType: "lunch",
    category: "protein-carb",
    ingredients: [
      { ingredientId: "turkey_breast", grams: 150 },
      { ingredientId: "brown_rice", grams: 170 },
      { ingredientId: "broccoli", grams: 100 }
    ],
    defaultCookingMethods: { turkey_breast: "pan-seared" },
    imageKey: "img_turkey_rice_broccoli",
    tags: ["athlete", "clean"]
  }
];

// ======================================================================
// HELPER FUNCTIONS
// ======================================================================

export function getLunchTemplateById(id: string): MealTemplate | undefined {
  return LUNCH_TEMPLATES.find((t) => t.id === id);
}

export function getLunchTemplatesByCategory(category: string): MealTemplate[] {
  return LUNCH_TEMPLATES.filter((t) => t.category === category);
}

export function getLunchTemplatesByTag(tag: string): MealTemplate[] {
  return LUNCH_TEMPLATES.filter((t) => t.tags.includes(tag));
}

export function searchLunchTemplates(query: string): MealTemplate[] {
  const lowerQuery = query.toLowerCase();
  return LUNCH_TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
