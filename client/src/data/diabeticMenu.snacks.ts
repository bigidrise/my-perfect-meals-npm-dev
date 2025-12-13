import type { SmartMeal } from "./smartMenu.types";

export const diabeticSnacks = [
  {
    id: "ds-1",
    title: "Almonds & String Cheese",
    ingredients: [
      { name: "Almonds", quantity: 1, unit: "oz", notes: "raw or roasted unsalted" },
      { name: "String cheese", quantity: 1, unit: "each", notes: "part-skim mozzarella" }
    ],
    instructions: ["Portion almonds", "Pair with string cheese"],
    nutrition: { calories: 220, protein: 12, carbs: 8, fat: 16 },
    badges: ["High Protein", "Low Carb", "Portable"]
  },
  {
    id: "ds-2",
    title: "Greek Yogurt & Berries",
    ingredients: [
      { name: "Greek yogurt", quantity: 0.5, unit: "cup", notes: "plain, non-fat" },
      { name: "Blueberries", quantity: 0.25, unit: "cup", notes: "fresh" },
      { name: "Cinnamon", quantity: 0.25, unit: "tsp" }
    ],
    instructions: ["Mix yogurt with berries", "Sprinkle cinnamon on top"],
    nutrition: { calories: 120, protein: 12, carbs: 16, fat: 0 },
    badges: ["High Protein", "Low Fat", "Antioxidants"]
  },
  {
    id: "ds-3",
    title: "Veggie Sticks & Hummus",
    ingredients: [
      { name: "Carrots", quantity: 0.5, unit: "cup", notes: "sliced into sticks" },
      { name: "Celery", quantity: 0.5, unit: "cup", notes: "sliced into sticks" },
      { name: "Hummus", quantity: 3, unit: "tbsp" }
    ],
    instructions: ["Prepare veggie sticks", "Serve with hummus for dipping"],
    nutrition: { calories: 140, protein: 5, carbs: 18, fat: 6 },
    badges: ["Plant-Based", "Fiber Rich", "Low Calorie"]
  },
  {
    id: "ds-4",
    title: "Hard-Boiled Eggs",
    ingredients: [
      { name: "Eggs", quantity: 2, unit: "each", notes: "hard-boiled" },
      { name: "Paprika", quantity: 0.25, unit: "tsp", notes: "optional" }
    ],
    instructions: ["Boil eggs for 10 minutes", "Sprinkle with paprika if desired"],
    nutrition: { calories: 140, protein: 12, carbs: 2, fat: 10 },
    badges: ["High Protein", "Low Carb", "Quick Prep"]
  },
  {
    id: "ds-5",
    title: "Apple Slices & Peanut Butter",
    ingredients: [
      { name: "Apple", quantity: 0.5, unit: "each", notes: "sliced" },
      { name: "Peanut butter", quantity: 1, unit: "tbsp", notes: "natural, unsweetened" }
    ],
    instructions: ["Slice apple", "Serve with peanut butter for dipping"],
    nutrition: { calories: 150, protein: 4, carbs: 18, fat: 8 },
    badges: ["Balanced", "Fiber Rich", "Kid-Friendly"]
  },
  {
    id: "ds-6",
    title: "Turkey Roll-Ups",
    ingredients: [
      { name: "Turkey breast", quantity: 2, unit: "oz", notes: "sliced deli meat" },
      { name: "Cheese", quantity: 1, unit: "slice", notes: "reduced-fat" },
      { name: "Cucumber", quantity: 0.25, unit: "cup", notes: "sliced into strips" }
    ],
    instructions: ["Lay turkey slices flat", "Place cheese and cucumber on top", "Roll tightly"],
    nutrition: { calories: 130, protein: 16, carbs: 4, fat: 6 },
    badges: ["High Protein", "Low Carb", "Portable"]
  }
];