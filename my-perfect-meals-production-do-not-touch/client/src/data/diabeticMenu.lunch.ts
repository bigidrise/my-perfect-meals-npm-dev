import type { SmartMeal } from "./smartMenu.types";

// The original diabeticMenuLunch array is replaced with the new diabeticLunchMeals array.
export const diabeticLunchMeals = [
  {
    id: "dl-1",
    title: "Grilled Chicken Salad",
    ingredients: [
      { name: "Chicken breast", quantity: 4, unit: "oz", notes: "grilled" },
      { name: "Mixed greens", quantity: 2, unit: "cup" },
      { name: "Cherry tomatoes", quantity: 0.5, unit: "cup", notes: "halved" },
      { name: "Cucumber", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "Olive oil", quantity: 1, unit: "tbsp" },
      { name: "Lemon juice", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Grill chicken breast until fully cooked",
      "Combine greens, tomatoes, and cucumber in a bowl",
      "Slice chicken and place on top of salad",
      "Drizzle with olive oil and lemon juice"
    ],
    nutrition: { calories: 280, protein: 32, carbs: 8, fat: 14 },
    badges: ["High Protein", "Low Carb", "Heart Healthy"]
  },
  {
    id: "dl-2",
    title: "Turkey & Avocado Wrap",
    ingredients: [
      { name: "Whole wheat tortilla", quantity: 1, unit: "each", notes: "low-carb" },
      { name: "Turkey breast", quantity: 3, unit: "oz", notes: "sliced" },
      { name: "Avocado", quantity: 0.25, unit: "each", notes: "sliced" },
      { name: "Spinach", quantity: 0.5, unit: "cup" },
      { name: "Tomato", quantity: 2, unit: "slice" },
      { name: "Mustard", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Lay tortilla flat",
      "Layer turkey, avocado, spinach, and tomato",
      "Spread mustard",
      "Roll tightly and slice in half"
    ],
    nutrition: { calories: 320, protein: 28, carbs: 22, fat: 14 },
    badges: ["Balanced", "Quick Prep"]
  },
  {
    id: "dl-3",
    title: "Tuna Salad Lettuce Cups",
    ingredients: [
      { name: "Tuna", quantity: 4, unit: "oz", notes: "canned in water, drained" },
      { name: "Greek yogurt", quantity: 2, unit: "tbsp", notes: "plain" },
      { name: "Celery", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "Red onion", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "Lettuce leaves", quantity: 4, unit: "each", notes: "large" },
      { name: "Lemon juice", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix tuna, yogurt, celery, onion, and lemon juice",
      "Spoon mixture into lettuce leaves",
      "Serve immediately"
    ],
    nutrition: { calories: 180, protein: 28, carbs: 6, fat: 5 },
    badges: ["High Protein", "Low Carb", "Omega-3"]
  },
  {
    id: "dl-4",
    title: "Quinoa & Black Bean Bowl",
    ingredients: [
      { name: "Quinoa", quantity: 0.5, unit: "cup", notes: "cooked" },
      { name: "Black beans", quantity: 0.5, unit: "cup", notes: "cooked" },
      { name: "Bell pepper", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "Corn", quantity: 0.25, unit: "cup" },
      { name: "Lime juice", quantity: 1, unit: "tbsp" },
      { name: "Cilantro", quantity: 2, unit: "tbsp", notes: "fresh, chopped" }
    ],
    instructions: [
      "Combine quinoa and black beans",
      "Add bell pepper and corn",
      "Drizzle with lime juice",
      "Top with cilantro"
    ],
    nutrition: { calories: 310, protein: 14, carbs: 52, fat: 4 },
    badges: ["Plant-Based", "Fiber Rich", "Heart Healthy"]
  },
  {
    id: "dl-5",
    title: "Salmon & Veggie Medley",
    ingredients: [
      { name: "Salmon fillet", quantity: 4, unit: "oz" },
      { name: "Broccoli", quantity: 1, unit: "cup", notes: "steamed" },
      { name: "Cauliflower", quantity: 0.5, unit: "cup", notes: "steamed" },
      { name: "Olive oil", quantity: 1, unit: "tsp" },
      { name: "Lemon", quantity: 1, unit: "wedge" },
      { name: "Garlic powder", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Season salmon with garlic powder",
      "Bake at 375°F for 15 minutes",
      "Steam broccoli and cauliflower",
      "Drizzle vegetables with olive oil",
      "Serve salmon with lemon wedge"
    ],
    nutrition: { calories: 290, protein: 30, carbs: 12, fat: 14 },
    badges: ["Omega-3", "Low Carb", "Anti-Inflammatory"]
  }
];