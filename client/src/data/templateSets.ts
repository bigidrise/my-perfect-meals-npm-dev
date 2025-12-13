import type { Meal } from "@/components/MealCard";
import { breakfastMeals, type BreakfastMeal } from "./breakfastMealsData";
import { lunchMealsData, type LunchMeal } from "./lunchMealsData";
import { dinnerMealsData, type DinnerMeal } from "./dinnerMealsData";

// Helper to estimate nutrition from ingredients
function estimateNutrition(ingredients: Array<{ item: string; quantity: number; unit: string }>): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  // Simple estimation based on ingredient types
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  ingredients.forEach((ing) => {
    const item = ing.item.toLowerCase();
    const qty = ing.quantity;

    // Protein sources
    if (item.includes("chicken") || item.includes("turkey")) {
      calories += qty * 50;
      protein += qty * 8;
      fat += qty * 1;
    } else if (item.includes("beef") || item.includes("steak")) {
      calories += qty * 70;
      protein += qty * 7;
      fat += qty * 5;
    } else if (item.includes("fish") || item.includes("salmon") || item.includes("tuna")) {
      calories += qty * 55;
      protein += qty * 7;
      fat += qty * 3;
    } else if (item.includes("egg")) {
      calories += qty * 70;
      protein += qty * 6;
      fat += qty * 5;
    } else if (item.includes("yogurt")) {
      calories += qty * 60;
      protein += qty * 5;
      carbs += qty * 7;
      fat += qty * 2;
    }
    // Carb sources
    else if (item.includes("rice") || item.includes("pasta") || item.includes("quinoa")) {
      calories += qty * 100;
      carbs += qty * 22;
      protein += qty * 3;
    } else if (item.includes("bread") || item.includes("tortilla")) {
      calories += qty * 70;
      carbs += qty * 15;
      protein += qty * 2;
    } else if (item.includes("potato") || item.includes("sweet potato")) {
      calories += qty * 80;
      carbs += qty * 18;
      protein += qty * 2;
    } else if (item.includes("oats")) {
      calories += qty * 150;
      carbs += qty * 27;
      protein += qty * 5;
      fat += qty * 3;
    }
    // Vegetables & Fruits
    else if (item.includes("broccoli") || item.includes("spinach") || item.includes("kale") || 
             item.includes("greens") || item.includes("lettuce") || item.includes("cabbage")) {
      calories += qty * 10;
      carbs += qty * 2;
      protein += qty * 1;
    } else if (item.includes("tomato") || item.includes("pepper") || item.includes("cucumber")) {
      calories += qty * 15;
      carbs += qty * 3;
    } else if (item.includes("berries") || item.includes("banana") || item.includes("apple")) {
      calories += qty * 50;
      carbs += qty * 12;
    }
    // Fats
    else if (item.includes("oil") || item.includes("butter")) {
      calories += qty * 120;
      fat += qty * 14;
    } else if (item.includes("avocado")) {
      calories += qty * 160;
      fat += qty * 15;
      carbs += qty * 9;
    } else if (item.includes("cheese")) {
      calories += qty * 110;
      protein += qty * 7;
      fat += qty * 9;
    } else if (item.includes("nuts")) {
      calories += qty * 160;
      protein += qty * 6;
      fat += qty * 14;
      carbs += qty * 6;
    }
  });

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

// Convert BreakfastMeal to Meal format (using classic template)
function convertBreakfastMeal(meal: BreakfastMeal): Meal {
  const template = meal.templates.classic;
  const ingredients = template.ingredients.map((ing) => ({
    item: ing.item,
    amount: `${ing.quantity} ${ing.unit}`,
  }));

  return {
    id: meal.id,
    title: meal.name,
    servings: meal.baseServings,
    ingredients,
    instructions: template.instructions,
    nutrition: estimateNutrition(template.ingredients),
    badges: template.healthBadges,
  };
}

// Convert LunchMeal to Meal format (using classic template)
function convertLunchMeal(meal: LunchMeal): Meal {
  const template = meal.templates.classic;
  const ingredients = template.ingredients.map((ing) => ({
    item: ing.item,
    amount: `${ing.quantity} ${ing.unit}`,
  }));

  return {
    id: meal.id,
    title: meal.name,
    servings: meal.baseServings,
    ingredients,
    instructions: template.instructions,
    nutrition: estimateNutrition(template.ingredients),
    badges: template.healthBadges,
  };
}

// Convert DinnerMeal to Meal format (using classic template)
function convertDinnerMeal(meal: DinnerMeal): Meal {
  const template = meal.templates.classic;
  const ingredients = template.ingredients.map((ing) => ({
    item: ing.item,
    amount: `${ing.quantity} ${ing.unit}`,
  }));

  return {
    id: meal.id,
    title: meal.name,
    servings: meal.baseServings,
    ingredients,
    instructions: template.instructions,
    nutrition: estimateNutrition(template.ingredients),
    badges: template.healthBadges,
  };
}

// Convert all original meals
const convertedBreakfastMeals = breakfastMeals.map(convertBreakfastMeal);
const convertedLunchMeals = lunchMealsData.map(convertLunchMeal);
const convertedDinnerMeals = dinnerMealsData.map(convertDinnerMeal);

// Create simple snack meals
const snackMeals: Meal[] = [
  {
    id: "snack-greek-yogurt",
    title: "Greek Yogurt with Berries",
    servings: 1,
    ingredients: [
      { item: "Greek yogurt", amount: "1 cup" },
      { item: "Mixed berries", amount: "0.5 cup" },
      { item: "Honey", amount: "1 tsp" },
    ],
    instructions: ["Mix yogurt with berries", "Drizzle with honey"],
    nutrition: { calories: 150, protein: 15, carbs: 20, fat: 2 },
    badges: ["High Protein", "Vegetarian"],
  },
  {
    id: "snack-apple-almond-butter",
    title: "Apple with Almond Butter",
    servings: 1,
    ingredients: [
      { item: "Apple", amount: "1 medium" },
      { item: "Almond butter", amount: "2 tbsp" },
    ],
    instructions: ["Slice apple", "Serve with almond butter for dipping"],
    nutrition: { calories: 240, protein: 6, carbs: 28, fat: 12 },
    badges: ["Heart Healthy", "Vegan"],
  },
  {
    id: "snack-hard-boiled-eggs",
    title: "Hard-Boiled Eggs",
    servings: 1,
    ingredients: [
      { item: "Eggs", amount: "2 large" },
      { item: "Salt and pepper", amount: "to taste" },
    ],
    instructions: ["Boil eggs for 10 minutes", "Peel and season with salt and pepper"],
    nutrition: { calories: 140, protein: 12, carbs: 1, fat: 10 },
    badges: ["High Protein", "Keto Friendly"],
  },
  {
    id: "snack-hummus-veggies",
    title: "Hummus with Vegetables",
    servings: 1,
    ingredients: [
      { item: "Hummus", amount: "0.25 cup" },
      { item: "Carrot sticks", amount: "1 cup" },
      { item: "Cucumber slices", amount: "1 cup" },
    ],
    instructions: ["Arrange vegetables on plate", "Serve with hummus for dipping"],
    nutrition: { calories: 120, protein: 4, carbs: 18, fat: 4 },
    badges: ["Vegan", "High Fiber"],
  },
];

// Export TEMPLATE_SETS with original meals
export const TEMPLATE_SETS: Record<"breakfast" | "lunch" | "dinner" | "snacks", Meal[]> = {
  breakfast: convertedBreakfastMeals,
  lunch: convertedLunchMeals,
  dinner: convertedDinnerMeals,
  snacks: snackMeals,
};
