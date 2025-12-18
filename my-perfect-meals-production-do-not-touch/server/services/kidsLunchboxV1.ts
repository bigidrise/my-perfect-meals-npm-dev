// 🔒 KIDS LUNCHBOX V1 GENERATOR - STABLE DETERMINISTIC SYSTEM - DO NOT MODIFY
// Deterministic kids lunchbox generator for alpha testing stability

type Nutrition = { calories: number; protein: number; carbs: number; fat: number };
type Ingredient = { name: string; amount: number; unit: string };
type Meal = {
  name: string;
  description: string;
  prepTime: string; // e.g., "12 min"
  nutrition: Nutrition;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string | null;
};

type Req = {
  favorites?: string;
  dislikes?: string;
  allergies?: string[];
  packingTime?: number | string;
  lunchboxSize?: "small" | "medium" | "large";
};

const POOL: Meal[] = [
  {
    name: "Turkey & Cheese Pinwheels",
    description: "Whole-wheat wrap, lean turkey, light cheese.",
    prepTime: "10 min",
    nutrition: { calories: 280, protein: 20, carbs: 22, fat: 10 },
    ingredients: [
      { name: "Whole-wheat tortilla", amount: 1, unit: "unit" },
      { name: "Turkey (lean)", amount: 90, unit: "g" },
      { name: "Light cheese", amount: 1, unit: "slice" }
    ],
    instructions: ["Lay tortilla", "Add turkey & cheese", "Roll tight", "Slice 6–8 bites"],
    imageUrl: null
  },
  {
    name: "Greek Yogurt Parfait",
    description: "Yogurt, berries, light granola.",
    prepTime: "8 min",
    nutrition: { calories: 260, protein: 18, carbs: 32, fat: 6 },
    ingredients: [
      { name: "Greek yogurt", amount: 170, unit: "g" },
      { name: "Mixed berries", amount: 80, unit: "g" },
      { name: "Light granola", amount: 20, unit: "g" }
    ],
    instructions: ["Layer yogurt + berries + granola", "Chill before packing"],
    imageUrl: null
  },
  {
    name: "Mini Chicken Quesadilla",
    description: "Corn tortilla, shredded chicken, mild cheese.",
    prepTime: "12 min",
    nutrition: { calories: 300, protein: 22, carbs: 28, fat: 10 },
    ingredients: [
      { name: "Corn tortilla (small)", amount: 1, unit: "unit" },
      { name: "Shredded chicken (cooked)", amount: 75, unit: "g" },
      { name: "Light cheese", amount: 20, unit: "g" }
    ],
    instructions: ["Warm lightly", "Cool to safe temp", "Cut into wedges"],
    imageUrl: null
  },
  {
    name: "Ham & Cheese Roll-ups",
    description: "Lean ham and cheese rolled in soft bread.",
    prepTime: "10 min",
    nutrition: { calories: 275, protein: 19, carbs: 25, fat: 9 },
    ingredients: [
      { name: "Whole grain bread", amount: 2, unit: "slices" },
      { name: "Lean ham", amount: 80, unit: "g" },
      { name: "String cheese", amount: 1, unit: "stick" }
    ],
    instructions: ["Remove crusts", "Add ham & cheese", "Roll tight", "Slice into rounds"],
    imageUrl: null
  },
  {
    name: "Cheese & Crackers Combo",
    description: "Whole grain crackers with cheese cubes.",
    prepTime: "8 min",
    nutrition: { calories: 285, protein: 16, carbs: 24, fat: 12 },
    ingredients: [
      { name: "Whole grain crackers", amount: 8, unit: "crackers" },
      { name: "Cheese cubes", amount: 60, unit: "g" },
      { name: "Cherry tomatoes", amount: 100, unit: "g" }
    ],
    instructions: ["Pack crackers separately", "Cut cheese into cubes", "Wash tomatoes"],
    imageUrl: null
  },
  {
    name: "Mini Meatballs & Pasta",
    description: "Kid-sized meatballs with fun pasta shapes.",
    prepTime: "15 min",
    nutrition: { calories: 320, protein: 24, carbs: 30, fat: 11 },
    ingredients: [
      { name: "Mini meatballs", amount: 8, unit: "pieces" },
      { name: "Fun pasta shapes", amount: 60, unit: "g" },
      { name: "Mild tomato sauce", amount: 30, unit: "ml" }
    ],
    instructions: ["Cook pasta and meatballs", "Pack in thermos", "Add sauce before eating"],
    imageUrl: null
  }
];

function filterForConstraints(pool: Meal[], req: Req): Meal[] {
  const dislikes = (req.dislikes ?? "").toLowerCase();
  const allergies = (req.allergies ?? []).map(a => a.toLowerCase());

  return pool.filter(m => {
    const text = `${m.name} ${m.description} ${m.ingredients.map(i => i.name).join(" ")}`.toLowerCase();
    if (dislikes && text.includes(dislikes)) return false;
    if (allergies.includes("nuts") && /nut|almond|peanut|walnut|pecan/.test(text)) return false;
    if (allergies.includes("dairy") && /cheese|yogurt|milk|dairy/.test(text)) return false;
    if (allergies.includes("gluten") && /wheat|tortilla|bread|farro/.test(text)) return false;
    if (allergies.includes("soy") && /soy|edamame|tofu/.test(text)) return false;
    if (allergies.includes("eggs") && /egg/.test(text)) return false;
    return true;
  });
}

function findFavoriteMatch(pool: Meal[], favorites: string): Meal | null {
  if (!favorites) return null;
  
  const favoriteWords = favorites.toLowerCase().split(/\s+|,\s*/).filter(w => w.length > 2);
  
  return pool.find(meal => {
    const mealText = `${meal.name} ${meal.description} ${meal.ingredients.map(i => i.name).join(" ")}`.toLowerCase();
    return favoriteWords.some(word => mealText.includes(word));
  }) || null;
}

export async function kidsLunchboxV1Generate(req: Req) {
  const packingTime = typeof req.packingTime === "string" ? parseInt(req.packingTime, 10) : (req.packingTime ?? 12);
  const safePool = filterForConstraints(POOL, req);
  
  // Try to find a meal matching favorites
  const favoriteMatch = findFavoriteMatch(safePool, req.favorites || "");
  const selectedMeal = favoriteMatch || safePool[0] || POOL[0];
  
  return {
    version: "v1",
    meal: { 
      ...selectedMeal, 
      prepTime: `${Math.max(5, Math.min(60, packingTime))} min` 
    }
  };
}