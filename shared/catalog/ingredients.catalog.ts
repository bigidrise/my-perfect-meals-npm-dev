// ===============================================================
// INGREDIENT CATALOG  — MASTER SOURCE OF TRUTH
// Deterministic, typed, production-ready
// ===============================================================

export interface Ingredient {
  id: string;
  name: string;
  category:
    | "protein"
    | "starchy-carb"
    | "fibrous-carb"
    | "fat"
    | "fruit"
    | "dairy"
    | "grain"
    | "legume"
    | "seafood"
    | "egg";
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  dietTags: string[];
  allergenTags: string[];
}

// ===============================================================
// MACRO LOOKUP (Imported from your ingredients.nutrition.ts)
// Missing macros default to placeholder until provided.
// ===============================================================

const NUTRITION: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {
  "chicken breast": { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13 },
  eggs: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  "egg whites": { calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  "greek yogurt": { calories: 100, protein: 10, carbs: 4, fat: 6 },
  "brown rice (cooked)": { calories: 112, protein: 2.3, carbs: 23, fat: 0.9 },
  "sweet potato": { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  broccoli: { calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  spinach: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  avocado: { calories: 160, protein: 2, carbs: 9, fat: 15 },
};

// Fallback for ingredients missing macro data:
function macrosFor(name: string) {
  return (
    NUTRITION[name.toLowerCase()] ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  );
}

// Utility to convert a name into an ID
function toId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

// ===============================================================
// INGREDIENT DEFINITIONS
// Pulled from masterIngredients + mealIngredients
// 185+ items total in your real dataset.
// This is the structured version.
// ===============================================================

export const INGREDIENTS: Ingredient[] = [
  // -------------------------
  // PROTEINS
  // -------------------------
  ...[
    "Chicken Breast",
    "Chicken Thigh",
    "Chicken Thighs",
    "Ground Chicken",
    "Turkey Breast",
    "Turkey Sausage",
    "Ground Turkey",
    "Beef Sirloin",
    "Sirloin Steak",
    "Ground Beef",
    "Ground Beef 93",
    "Pork Tenderloin",
    "Pork Chops",
    "Lamb",
    "Salmon",
    "Tuna",
    "Cod",
    "Shrimp",
    "Crab",
    "Lobster",
    "Scallops",
    "Eggs",
    "Egg Whites",
    "Tofu",
    "Tempeh",
    "Seitan",
    "Black Beans",
    "Kidney Beans",
    "Chickpeas",
    "Lentils",
  ].map((name) => ({
    id: toId(name),
    name,
    category: (["Eggs", "Egg Whites"].includes(name)
      ? "egg"
      : ["Salmon", "Cod", "Shrimp", "Tuna", "Lobster", "Crab", "Scallops"].includes(name)
      ? "seafood"
      : ["Black Beans", "Kidney Beans", "Chickpeas", "Lentils"].includes(name)
      ? "legume"
      : "protein") as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["high-protein", "balanced"],
    allergenTags: name.toLowerCase().includes("egg")
      ? ["egg"]
      : ["shrimp", "crab", "lobster", "scallops"].some((s) =>
          name.toLowerCase().includes(s)
        )
      ? ["shellfish"]
      : [],
  })),

  // -------------------------
  // FIBROUS CARBS
  // -------------------------
  ...[
    "Broccoli",
    "Spinach",
    "Kale",
    "Arugula",
    "Lettuce",
    "Romaine",
    "Carrots",
    "Bell Peppers",
    "Onions",
    "Garlic",
    "Ginger",
    "Tomatoes",
    "Cucumber",
    "Zucchini",
    "Eggplant",
    "Mushrooms",
    "Asparagus",
    "Brussels Sprouts",
    "Cauliflower",
    "Celery",
    "Cabbage",
    "Bok Choy",
    "Green Beans",
    "Mixed Greens",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "fibrous-carb" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["low-calorie", "vegetable"],
    allergenTags: [],
  })),

  // -------------------------
  // STARCHY CARBS
  // -------------------------
  ...[
    "Brown Rice",
    "White Rice",
    "Jasmine Rice",
    "Basmati Rice",
    "Rice",
    "Wild Rice",
    "Sweet Potatoes",
    "Potatoes",
    "Farro",
    "Barley",
    "Couscous",
    "Pasta",
    "White Pasta",
    "Whole Wheat Pasta",
    "Quinoa Pasta",
    "Rice Noodles",
    "Corn",
    "Pita Bread",
    "Whole Wheat Bread",
    "Sourdough Bread",
    "Whole Wheat Tortilla",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "starchy-carb" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["carb"],
    allergenTags: name.toLowerCase().includes("bread") ? ["gluten"] : [],
  })),

  // -------------------------
  // FATS
  // -------------------------
  ...[
    "Avocado",
    "Olive Oil",
    "Butter",
    "Almond Butter",
    "Almonds",
    "Walnuts",
    "Chia Seeds",
    "Flax Seeds",
    "Peanut Butter",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "fat" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["healthy-fat"],
    allergenTags: ["Almonds", "Walnuts", "Almond Butter"].includes(name) ? ["tree-nut"] 
      : ["Peanut Butter"].includes(name) ? ["peanut"] : [],
  })),

  // -------------------------
  // FRUITS
  // -------------------------
  ...[
    "Apple",
    "Banana",
    "Berries",
    "Strawberries",
    "Blueberries",
    "Pineapple",
    "Mango",
    "Orange",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "fruit" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["natural-sugar", "fiber"],
    allergenTags: [],
  })),

  // -------------------------
  // DAIRY
  // -------------------------
  ...[
    "Greek Yogurt",
    "Cottage Cheese",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "dairy" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["high-protein", "calcium"],
    allergenTags: ["dairy"],
  })),

  // -------------------------
  // GRAINS
  // -------------------------
  ...[
    "Oats",
    "Quinoa",
    "Grits",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "grain" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["fiber", "complex-carb"],
    allergenTags: name === "Oats" ? ["gluten"] : [],
  })),

  // -------------------------
  // ADDITIONAL PROTEINS (no duplicates from main protein list)
  // -------------------------
  ...[
    "Lean Beef",
    "Tilapia",
    "Sea Bass",
    "Protein Shake",
  ].map((name) => ({
    id: toId(name),
    name,
    category: (["Tilapia", "Sea Bass"].includes(name) ? "seafood" : "protein") as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["high-protein"],
    allergenTags: [],
  })),


  // -------------------------
  // ADDITIONAL VEGETABLES
  // -------------------------
  ...[
    "Cucumbers",
    "Green Peas",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "fibrous-carb" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["vegetable", "low-calorie"],
    allergenTags: [],
  })),

  // -------------------------
  // LEGUMES (only items not in main protein list)
  // -------------------------
  ...[
    "Pinto Beans",
  ].map((name) => ({
    id: toId(name),
    name,
    category: "starchy-carb" as Ingredient["category"],
    macrosPer100g: macrosFor(name),
    dietTags: ["high-fiber", "plant-protein"],
    allergenTags: [],
  })),
];

// ===============================================================
// HELPER FUNCTIONS
// ===============================================================

export function getIngredientById(id: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.id === id);
}

export function getIngredientByName(name: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

export function getIngredientsByCategory(category: Ingredient["category"]): Ingredient[] {
  return INGREDIENTS.filter((i) => i.category === category);
}

export function searchIngredients(query: string): Ingredient[] {
  const lowerQuery = query.toLowerCase();
  return INGREDIENTS.filter((i) => i.name.toLowerCase().includes(lowerQuery));
}
