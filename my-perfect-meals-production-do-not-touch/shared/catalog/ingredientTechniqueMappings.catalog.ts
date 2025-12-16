// =====================================================================
// INGREDIENT ↔ TECHNIQUE MAPPING CATALOG
// Deterministic rules for how each food can be cooked and what image to show.
// =====================================================================

import { CookingMethodId } from "./techniques.catalog";

export interface IngredientTechniqueMapping {
  ingredientId: string;
  displayName: string;
  validMethods: CookingMethodId[];
  blockedMethods?: CookingMethodId[];
  defaultMethod?: CookingMethodId;
  imageKeyMap: {
    [method in CookingMethodId]?: string;
  };
  allowedDoneness?: ("well-done" | "medium" | "medium-rare")[];
}

const key = (ingredient: string, method: string) =>
  `img_${ingredient.toLowerCase().replace(/\s+/g, "_")}_${method}`;

const ING = (x: string) => x.toLowerCase().replace(/\s+/g, "_");

// =====================================================================
// PROTEINS
// =====================================================================

export const PROTEIN_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Chicken Breast"),
    displayName: "Chicken Breast",
    validMethods: [
      "air-fried",
      "baked",
      "grilled",
      "pan-seared",
      "boiled",
      "steamed",
    ],
    blockedMethods: ["medium", "medium-rare"],
    defaultMethod: "grilled",
    allowedDoneness: ["well-done"],

    imageKeyMap: {
      "air-fried": key("chicken_breast", "air_fried"),
      baked: key("chicken_breast", "baked"),
      grilled: key("chicken_breast", "grilled"),
      "pan-seared": key("chicken_breast", "pan_seared"),
      boiled: key("chicken_breast", "boiled"),
      steamed: key("chicken_breast", "steamed"),
    },
  },

  {
    ingredientId: ING("Salmon"),
    displayName: "Salmon",
    validMethods: [
      "pan-seared",
      "grilled",
      "baked",
      "air-fried",
      "poached",
      "steamed",
    ],
    blockedMethods: ["fried"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done", "medium"],

    imageKeyMap: {
      "pan-seared": key("salmon", "pan_seared"),
      grilled: key("salmon", "grilled"),
      baked: key("salmon", "baked"),
      "air-fried": key("salmon", "air_fried"),
      poached: key("salmon", "poached"),
      steamed: key("salmon", "steamed"),
    },
  },

  {
    ingredientId: ING("Eggs"),
    displayName: "Eggs",
    validMethods: ["scrambled", "fried", "poached", "boiled"],
    defaultMethod: "scrambled",

    blockedMethods: [
      "grilled",
      "air-fried",
      "pan-seared",
      "steamed",
      "baked",
      "medium",
      "medium-rare",
    ],

    imageKeyMap: {
      scrambled: key("eggs", "scrambled"),
      fried: key("eggs", "fried"),
      poached: key("eggs", "poached"),
      boiled: key("eggs", "boiled"),
    },
  },

  {
    ingredientId: ING("Egg Whites"),
    displayName: "Egg Whites",
    validMethods: ["scrambled", "fried", "steamed"],
    defaultMethod: "scrambled",
    blockedMethods: ["grilled", "air-fried", "poached", "baked"],

    imageKeyMap: {
      scrambled: key("egg_whites", "scrambled"),
      fried: key("egg_whites", "fried"),
      steamed: key("egg_whites", "steamed"),
    },
  },

  {
    ingredientId: ING("Ground Turkey"),
    displayName: "Ground Turkey",
    validMethods: [
      "pan-seared",
      "fried",
      "baked",
      "air-fried",
      "grilled",
      "boiled",
    ],
    defaultMethod: "pan-seared",
    blockedMethods: ["medium", "medium-rare"],

    allowedDoneness: ["well-done"],

    imageKeyMap: {
      "pan-seared": key("ground_turkey", "pan_seared"),
      fried: key("ground_turkey", "fried"),
      baked: key("ground_turkey", "baked"),
      "air-fried": key("ground_turkey", "air_fried"),
      grilled: key("ground_turkey", "grilled"),
      boiled: key("ground_turkey", "boiled"),
    },
  },

  {
    ingredientId: ING("Turkey Sausage"),
    displayName: "Turkey Sausage",
    validMethods: ["pan-seared", "baked", "grilled", "air-fried"],
    defaultMethod: "pan-seared",
    blockedMethods: ["medium", "medium-rare"],
    allowedDoneness: ["well-done"],

    imageKeyMap: {
      "pan-seared": key("turkey_sausage", "pan_seared"),
      baked: key("turkey_sausage", "baked"),
      grilled: key("turkey_sausage", "grilled"),
      "air-fried": key("turkey_sausage", "air_fried"),
    },
  },

  {
    ingredientId: ING("Shrimp"),
    displayName: "Shrimp",
    validMethods: [
      "pan-seared",
      "air-fried",
      "grilled",
      "baked",
      "poached",
      "steamed",
    ],
    blockedMethods: ["fried"],
    defaultMethod: "pan-seared",

    imageKeyMap: {
      "pan-seared": key("shrimp", "pan_seared"),
      grilled: key("shrimp", "grilled"),
      "air-fried": key("shrimp", "air_fried"),
      baked: key("shrimp", "baked"),
      poached: key("shrimp", "poached"),
      steamed: key("shrimp", "steamed"),
    },
  },

  {
    ingredientId: ING("Tuna"),
    displayName: "Tuna",
    validMethods: ["pan-seared", "grilled", "baked", "poached"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done", "medium", "medium-rare"],

    imageKeyMap: {
      "pan-seared": key("tuna", "pan_seared"),
      grilled: key("tuna", "grilled"),
      baked: key("tuna", "baked"),
      poached: key("tuna", "poached"),
    },
  },

  {
    ingredientId: ING("Cod"),
    displayName: "Cod",
    validMethods: ["baked", "pan-seared", "poached", "steamed"],
    defaultMethod: "baked",
    allowedDoneness: ["well-done"],

    imageKeyMap: {
      baked: key("cod", "baked"),
      "pan-seared": key("cod", "pan_seared"),
      poached: key("cod", "poached"),
      steamed: key("cod", "steamed"),
    },
  },

  {
    ingredientId: ING("Ground Beef"),
    displayName: "Ground Beef",
    validMethods: ["pan-seared", "grilled", "baked", "fried"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done", "medium"],

    imageKeyMap: {
      "pan-seared": key("ground_beef", "pan_seared"),
      grilled: key("ground_beef", "grilled"),
      baked: key("ground_beef", "baked"),
      fried: key("ground_beef", "fried"),
    },
  },
  {
    ingredientId: ING("Ground Beef 93"),
    displayName: "Ground Beef 93% Lean",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done", "medium"],
    imageKeyMap: {
      "pan-seared": key("ground_beef_93", "pan_seared"),
      grilled: key("ground_beef_93", "grilled"),
      baked: key("ground_beef_93", "baked"),
    },
  },

  {
    ingredientId: ING("Sirloin Steak"),
    displayName: "Sirloin Steak",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "grilled",
    allowedDoneness: ["well-done", "medium", "medium-rare"],

    imageKeyMap: {
      "pan-seared": key("sirloin_steak", "pan_seared"),
      grilled: key("sirloin_steak", "grilled"),
      baked: key("sirloin_steak", "baked"),
    },
  },

  {
    ingredientId: ING("Pork Tenderloin"),
    displayName: "Pork Tenderloin",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "baked",
    blockedMethods: ["medium-rare"],
    allowedDoneness: ["well-done", "medium"],

    imageKeyMap: {
      "pan-seared": key("pork_tenderloin", "pan_seared"),
      grilled: key("pork_tenderloin", "grilled"),
      baked: key("pork_tenderloin", "baked"),
    },
  },

  {
    ingredientId: ING("Tofu"),
    displayName: "Tofu",
    validMethods: ["pan-seared", "baked", "air-fried", "steamed", "grilled"],
    defaultMethod: "pan-seared",

    imageKeyMap: {
      "pan-seared": key("tofu", "pan_seared"),
      baked: key("tofu", "baked"),
      "air-fried": key("tofu", "air_fried"),
      steamed: key("tofu", "steamed"),
      grilled: key("tofu", "grilled"),
    },
  },

  {
    ingredientId: ING("Greek Yogurt"),
    displayName: "Greek Yogurt",
    validMethods: [],
    blockedMethods: ["grilled", "baked", "fried", "pan-seared", "air-fried"],
    imageKeyMap: {},
  },

  {
    ingredientId: ING("Cottage Cheese"),
    displayName: "Cottage Cheese",
    validMethods: [],
    blockedMethods: ["grilled", "baked", "fried", "pan-seared", "air-fried"],
    imageKeyMap: {},
  },

  {
    ingredientId: ING("Turkey Breast"),
    displayName: "Turkey Breast",
    validMethods: ["grilled", "baked", "pan-seared", "air-fried"],
    defaultMethod: "grilled",
    blockedMethods: ["medium-rare"],
    allowedDoneness: ["well-done"],
    imageKeyMap: {
      grilled: key("turkey_breast", "grilled"),
      baked: key("turkey_breast", "baked"),
      "pan-seared": key("turkey_breast", "pan_seared"),
      "air-fried": key("turkey_breast", "air_fried"),
    },
  },

  {
    ingredientId: ING("Lean Beef"),
    displayName: "Lean Beef",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done", "medium", "medium-rare"],
    imageKeyMap: {
      "pan-seared": key("lean_beef", "pan_seared"),
      grilled: key("lean_beef", "grilled"),
      baked: key("lean_beef", "baked"),
    },
  },

  {
    ingredientId: ING("Tilapia"),
    displayName: "Tilapia",
    validMethods: ["pan-seared", "baked", "grilled", "steamed"],
    defaultMethod: "pan-seared",
    allowedDoneness: ["well-done"],
    imageKeyMap: {
      "pan-seared": key("tilapia", "pan_seared"),
      baked: key("tilapia", "baked"),
      grilled: key("tilapia", "grilled"),
      steamed: key("tilapia", "steamed"),
    },
  },

  {
    ingredientId: ING("Protein Shake"),
    displayName: "Protein Shake",
    validMethods: [],
    imageKeyMap: {},
  },

  {
    ingredientId: ING("Sirloin Steak"),
    displayName: "Sirloin Steak",
    validMethods: ["grilled", "pan-seared", "baked"],
    defaultMethod: "grilled",
    allowedDoneness: ["well-done", "medium", "medium-rare"],
    imageKeyMap: {
      grilled: key("sirloin_steak", "grilled"),
      "pan-seared": key("sirloin_steak", "pan_seared"),
      baked: key("sirloin_steak", "baked"),
    },
  },
];

// =====================================================================
// STARCHY CARBS
// =====================================================================

export const STARCH_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Oats"),
    displayName: "Oats",
    validMethods: ["boiled"],
    defaultMethod: "boiled",

    imageKeyMap: {
      boiled: key("oats", "boiled"),
    },
  },
  {
    ingredientId: ING("Potatoes"),
    displayName: "Potatoes",
    validMethods: ["baked", "air-fried", "boiled", "steamed"],
    defaultMethod: "baked",

    imageKeyMap: {
      baked: key("potatoes", "baked"),
      "air-fried": key("potatoes", "air_fried"),
      boiled: key("potatoes", "boiled"),
      steamed: key("potatoes", "steamed"),
    },
  },
  {
    ingredientId: ING("Sweet Potatoes"),
    displayName: "Sweet Potatoes",
    validMethods: ["baked", "air-fried", "steamed"],
    defaultMethod: "baked",

    imageKeyMap: {
      baked: key("sweet_potatoes", "baked"),
      "air-fried": key("sweet_potatoes", "air_fried"),
      steamed: key("sweet_potatoes", "steamed"),
    },
  },
  {
    ingredientId: ING("Brown Rice"),
    displayName: "Brown Rice",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "steamed",

    imageKeyMap: {
      boiled: key("brown_rice", "boiled"),
      steamed: key("brown_rice", "steamed"),
    },
  },
  {
    ingredientId: ING("White Rice"),
    displayName: "White Rice",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "steamed",

    imageKeyMap: {
      boiled: key("white_rice", "boiled"),
      steamed: key("white_rice", "steamed"),
    },
  },
  {
    ingredientId: ING("Quinoa"),
    displayName: "Quinoa",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "boiled",

    imageKeyMap: {
      boiled: key("quinoa", "boiled"),
      steamed: key("quinoa", "steamed"),
    },
  },
  {
    ingredientId: ING("Grits"),
    displayName: "Grits",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("grits", "boiled"),
    },
  },
  {
    ingredientId: ING("Jasmine Rice"),
    displayName: "Jasmine Rice",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("jasmine_rice", "boiled"),
      steamed: key("jasmine_rice", "steamed"),
    },
  },
  {
    ingredientId: ING("Rice"),
    displayName: "Rice",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("rice", "boiled"),
      steamed: key("rice", "steamed"),
    },
  },
  {
    ingredientId: ING("White Pasta"),
    displayName: "White Pasta",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("white_pasta", "boiled"),
    },
  },
  {
    ingredientId: ING("Whole Wheat Pasta"),
    displayName: "Whole Wheat Pasta",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("whole_wheat_pasta", "boiled"),
    },
  },
  {
    ingredientId: ING("Quinoa Pasta"),
    displayName: "Quinoa Pasta",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("quinoa_pasta", "boiled"),
    },
  },
  {
    ingredientId: ING("Rice Noodles"),
    displayName: "Rice Noodles",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("rice_noodles", "boiled"),
    },
  },
  {
    ingredientId: ING("Sourdough Bread"),
    displayName: "Sourdough Bread",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Whole Wheat Tortilla"),
    displayName: "Whole Wheat Tortilla",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Basmati Rice"),
    displayName: "Basmati Rice",
    validMethods: ["boiled", "steamed"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("basmati_rice", "boiled"),
      steamed: key("basmati_rice", "steamed"),
    },
  },
  {
    ingredientId: ING("Wild Rice"),
    displayName: "Wild Rice",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("wild_rice", "boiled"),
    },
  },
  {
    ingredientId: ING("Farro"),
    displayName: "Farro",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("farro", "boiled"),
    },
  },
  {
    ingredientId: ING("Barley"),
    displayName: "Barley",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("barley", "boiled"),
    },
  },
  {
    ingredientId: ING("Couscous"),
    displayName: "Couscous",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("couscous", "boiled"),
    },
  },
  {
    ingredientId: ING("Corn"),
    displayName: "Corn",
    validMethods: ["boiled", "grilled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("corn", "boiled"),
      grilled: key("corn", "grilled"),
    },
  },
];

// =====================================================================
// FIBROUS CARBS
// =====================================================================

export const FIBROUS_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Broccoli"),
    displayName: "Broccoli",
    validMethods: ["steamed", "air-fried", "baked"],
    defaultMethod: "steamed",

    imageKeyMap: {
      steamed: key("broccoli", "steamed"),
      "air-fried": key("broccoli", "air_fried"),
      baked: key("broccoli", "baked"),
    },
  },
  {
    ingredientId: ING("Spinach"),
    displayName: "Spinach",
    validMethods: ["steamed"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("spinach", "steamed"),
    },
  },
  {
    ingredientId: ING("Asparagus"),
    displayName: "Asparagus",
    validMethods: ["steamed", "grilled", "baked", "air-fried"],
    defaultMethod: "grilled",

    imageKeyMap: {
      steamed: key("asparagus", "steamed"),
      grilled: key("asparagus", "grilled"),
      baked: key("asparagus", "baked"),
      "air-fried": key("asparagus", "air_fried"),
    },
  },
  {
    ingredientId: ING("Brussels Sprouts"),
    displayName: "Brussels Sprouts",
    validMethods: ["baked", "air-fried", "steamed"],
    defaultMethod: "baked",

    imageKeyMap: {
      baked: key("brussels_sprouts", "baked"),
      "air-fried": key("brussels_sprouts", "air_fried"),
      steamed: key("brussels_sprouts", "steamed"),
    },
  },
  {
    ingredientId: ING("Bell Peppers"),
    displayName: "Bell Peppers",
    validMethods: ["grilled", "baked", "steamed"],
    defaultMethod: "grilled",

    imageKeyMap: {
      grilled: key("bell_peppers", "grilled"),
      baked: key("bell_peppers", "baked"),
      steamed: key("bell_peppers", "steamed"),
    },
  },
  {
    ingredientId: ING("Mushrooms"),
    displayName: "Mushrooms",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "pan-seared",

    imageKeyMap: {
      "pan-seared": key("mushrooms", "pan_seared"),
      grilled: key("mushrooms", "grilled"),
      baked: key("mushrooms", "baked"),
    },
  },
  {
    ingredientId: ING("Zucchini"),
    displayName: "Zucchini",
    validMethods: ["grilled", "baked", "steamed", "air-fried"],
    defaultMethod: "grilled",

    imageKeyMap: {
      grilled: key("zucchini", "grilled"),
      baked: key("zucchini", "baked"),
      steamed: key("zucchini", "steamed"),
      "air-fried": key("zucchini", "air_fried"),
    },
  },
  {
    ingredientId: ING("Green Beans"),
    displayName: "Green Beans",
    validMethods: ["steamed", "grilled", "baked"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("green_beans", "steamed"),
      grilled: key("green_beans", "grilled"),
      baked: key("green_beans", "baked"),
    },
  },
  {
    ingredientId: ING("Mixed Greens"),
    displayName: "Mixed Greens",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Cucumber"),
    displayName: "Cucumber",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Cabbage"),
    displayName: "Cabbage",
    validMethods: ["steamed", "stir-fried", "baked"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("cabbage", "steamed"),
      "stir-fried": key("cabbage", "stir_fried"),
      baked: key("cabbage", "baked"),
    },
  },
  {
    ingredientId: ING("Cauliflower"),
    displayName: "Cauliflower",
    validMethods: ["steamed", "baked", "fried", "air-fried"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("cauliflower", "steamed"),
      baked: key("cauliflower", "baked"),
      fried: key("cauliflower", "fried"),
      "air-fried": key("cauliflower", "air_fried"),
    },
  },
  {
    ingredientId: ING("Tomatoes"),
    displayName: "Tomatoes",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Lettuce"),
    displayName: "Lettuce",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Bok Choy"),
    displayName: "Bok Choy",
    validMethods: ["steamed", "stir-fried"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("bok_choy", "steamed"),
      "stir-fried": key("bok_choy", "stir_fried"),
    },
  },
  {
    ingredientId: ING("Kale"),
    displayName: "Kale",
    validMethods: ["steamed", "baked"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("kale", "steamed"),
      baked: key("kale", "baked"),
    },
  },
  {
    ingredientId: ING("Carrots"),
    displayName: "Carrots",
    validMethods: ["steamed", "baked", "boiled"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("carrots", "steamed"),
      baked: key("carrots", "baked"),
      boiled: key("carrots", "boiled"),
    },
  },
  {
    ingredientId: ING("Chicken Thighs"),
    displayName: "Chicken Thighs",
    validMethods: ["grilled", "baked", "pan-seared", "air-fried"],
    defaultMethod: "baked",
    imageKeyMap: {
      grilled: key("chicken_thighs", "grilled"),
      baked: key("chicken_thighs", "baked"),
      "pan-seared": key("chicken_thighs", "pan_seared"),
      "air-fried": key("chicken_thighs", "air_fried"),
    },
  },
  {
    ingredientId: ING("Turkey Sausage"),
    displayName: "Turkey Sausage",
    validMethods: ["pan-seared", "grilled", "baked"],
    defaultMethod: "pan-seared",
    imageKeyMap: {
      "pan-seared": key("turkey_sausage", "pan_seared"),
      grilled: key("turkey_sausage", "grilled"),
      baked: key("turkey_sausage", "baked"),
    },
  },
  {
    ingredientId: ING("Sea Bass"),
    displayName: "Sea Bass",
    validMethods: ["pan-seared", "baked", "grilled"],
    defaultMethod: "pan-seared",
    imageKeyMap: {
      "pan-seared": key("sea_bass", "pan_seared"),
      baked: key("sea_bass", "baked"),
      grilled: key("sea_bass", "grilled"),
    },
  },
  {
    ingredientId: ING("Avocado"),
    displayName: "Avocado",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Olive Oil"),
    displayName: "Olive Oil",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Cucumbers"),
    displayName: "Cucumbers",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Green Peas"),
    displayName: "Green Peas",
    validMethods: ["steamed", "boiled"],
    defaultMethod: "steamed",
    imageKeyMap: {
      steamed: key("green_peas", "steamed"),
      boiled: key("green_peas", "boiled"),
    },
  },
  {
    ingredientId: ING("Lentils"),
    displayName: "Lentils",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("lentils", "boiled"),
    },
  },
  {
    ingredientId: ING("Black Beans"),
    displayName: "Black Beans",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("black_beans", "boiled"),
    },
  },
  {
    ingredientId: ING("Chickpeas"),
    displayName: "Chickpeas",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("chickpeas", "boiled"),
    },
  },
  {
    ingredientId: ING("Pinto Beans"),
    displayName: "Pinto Beans",
    validMethods: ["boiled"],
    defaultMethod: "boiled",
    imageKeyMap: {
      boiled: key("pinto_beans", "boiled"),
    },
  },
];

// =====================================================================
// FRUITS (no cooking methods, raw only)
// =====================================================================

export const FRUIT_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Apple"),
    displayName: "Apple",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Banana"),
    displayName: "Banana",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Berries"),
    displayName: "Berries",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Strawberries"),
    displayName: "Strawberries",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Blueberries"),
    displayName: "Blueberries",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Pineapple"),
    displayName: "Pineapple",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Mango"),
    displayName: "Mango",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Orange"),
    displayName: "Orange",
    validMethods: [],
    imageKeyMap: {},
  },
];

// =====================================================================
// NUT BUTTERS (no cooking methods)
// =====================================================================

export const NUT_BUTTER_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Peanut Butter"),
    displayName: "Peanut Butter",
    validMethods: [],
    imageKeyMap: {},
  },
  {
    ingredientId: ING("Almond Butter"),
    displayName: "Almond Butter",
    validMethods: [],
    imageKeyMap: {},
  },
];

// =====================================================================
// FATS (no cooking methods)
// =====================================================================

export const FAT_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  {
    ingredientId: ING("Avocado"),
    displayName: "Avocado",
    validMethods: [],
    imageKeyMap: {},
  },
];

// =====================================================================
// EXPORT UNION
// =====================================================================

export const INGREDIENT_TECHNIQUE_MAPPINGS: IngredientTechniqueMapping[] = [
  ...PROTEIN_TECHNIQUE_MAPPINGS,
  ...STARCH_TECHNIQUE_MAPPINGS,
  ...FIBROUS_TECHNIQUE_MAPPINGS,
  ...FRUIT_TECHNIQUE_MAPPINGS,
  ...NUT_BUTTER_TECHNIQUE_MAPPINGS,
  ...FAT_TECHNIQUE_MAPPINGS,
];

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

export function getMappingByIngredientId(
  ingredientId: string
): IngredientTechniqueMapping | undefined {
  return INGREDIENT_TECHNIQUE_MAPPINGS.find((m) => m.ingredientId === ingredientId);
}

export function isValidMethod(
  ingredientId: string,
  method: CookingMethodId
): boolean {
  const mapping = getMappingByIngredientId(ingredientId);
  if (!mapping) return false;
  if (mapping.blockedMethods?.includes(method)) return false;
  return mapping.validMethods.includes(method);
}

export function getImageKey(
  ingredientId: string,
  method: CookingMethodId
): string | undefined {
  const mapping = getMappingByIngredientId(ingredientId);
  return mapping?.imageKeyMap[method];
}

export function getDefaultMethod(
  ingredientId: string
): CookingMethodId | undefined {
  return getMappingByIngredientId(ingredientId)?.defaultMethod;
}

export function getValidMethodsForIngredient(
  ingredientId: string
): CookingMethodId[] {
  return getMappingByIngredientId(ingredientId)?.validMethods ?? [];
}
