

export type Ingredient = {
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
};

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type GLP1Meal = {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  category: "breakfast" | "lunch" | "dinner" | "snack";
  baseServings: number;
  fingerFood?: boolean;
  healthBadges?: string[];
  ingredients: Ingredient[];
  instructions?: string[];
  image?: string;
  nutrition: Nutrition;
};

export const glp1Meals: GLP1Meal[] = [
  // ==================== BREAKFAST (20) ====================
  {
    id: "greek-yogurt-parfait",
    name: "Greek Yogurt Parfait",
    description: "Creamy Greek yogurt layered with fresh berries and crunchy granola",
    cuisine: "Mediterranean",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Probiotic", "Low Sugar", "Gluten-Free Option", "Vegetarian"],
    ingredients: [
      { name: "Greek yogurt", quantity: 0.75, unit: "cup", notes: "plain" },
      { name: "mixed berries", quantity: 0.25, unit: "cup" },
      { name: "granola", quantity: 2, unit: "tbsp" },
      { name: "honey", quantity: 1, unit: "tsp" },
      { name: "sliced almonds", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Place half the Greek yogurt in a small bowl or glass",
      "Add half the berries on top",
      "Layer remaining yogurt",
      "Top with remaining berries, granola, and almonds",
      "Drizzle with honey and serve immediately"
    ],
    nutrition: { calories: 285, protein: 20, carbs: 32, fat: 9 }
  },
  {
    id: "avocado-toast-with-egg",
    name: "Avocado Toast with Egg",
    description: "Whole grain toast topped with mashed avocado and a perfectly cooked egg",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Anti-Inflammatory", "High Protein", "Vegetarian", "Omega-3"],
    ingredients: [
      { name: "whole grain bread", quantity: 1, unit: "slice" },
      { name: "avocado", quantity: 0.5, unit: "each", notes: "ripe, medium" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" },
      { name: "lemon juice", quantity: 0.5, unit: "tsp" },
      { name: "red pepper flakes", quantity: 1, unit: "pinch" },
      { name: "sea salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Toast bread until golden brown",
      "Mash avocado with lemon juice and salt",
      "Cook egg to your preference (poached, fried, or scrambled)",
      "Spread avocado on toast",
      "Top with egg and sprinkle with red pepper flakes",
      "Serve immediately while warm"
    ],
    nutrition: { calories: 295, protein: 12, carbs: 24, fat: 18 }
  },
  {
    id: "berry-protein-smoothie",
    name: "Berry Protein Smoothie",
    description: "Antioxidant-rich berry smoothie with protein powder for sustained energy",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Diabetic-Friendly", "Antioxidant-Rich", "Dairy-Free Option", "Low Sodium", "High Protein"],
    ingredients: [
      { name: "mixed berries", quantity: 0.75, unit: "cup", notes: "frozen" },
      { name: "protein powder", quantity: 1, unit: "scoop", notes: "vanilla" },
      { name: "almond milk", quantity: 1, unit: "cup", notes: "unsweetened" },
      { name: "baby spinach", quantity: 0.5, unit: "cup" },
      { name: "chia seeds", quantity: 1, unit: "tsp" },
      { name: "ice cubes", quantity: 3, unit: "each" }
    ],
    instructions: [
      "Add almond milk to blender first",
      "Add frozen berries, spinach, and protein powder",
      "Add chia seeds and ice",
      "Blend on high for 30-45 seconds until smooth",
      "Pour into glass and serve immediately",
      "Optional: top with fresh berries"
    ],
    nutrition: { calories: 245, protein: 25, carbs: 28, fat: 5 }
  },
  {
    id: "scrambled-eggs-with-spinach",
    name: "Scrambled Eggs with Spinach",
    description: "Fluffy scrambled eggs with sautéed spinach and feta cheese",
    cuisine: "Mediterranean",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Keto-Friendly", "Gluten-Free", "Vegetarian"],
    ingredients: [
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "fresh spinach", quantity: 1, unit: "cup" },
      { name: "feta cheese", quantity: 2, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "black pepper", quantity: 1, unit: "pinch" },
      { name: "cherry tomatoes", quantity: 3, unit: "each", notes: "small" }
    ],
    instructions: [
      "Heat olive oil in non-stick pan over medium heat",
      "Add spinach and sauté until wilted (1-2 minutes)",
      "Whisk eggs with black pepper",
      "Pour eggs into pan and scramble gently",
      "Add crumbled feta when eggs are nearly done",
      "Serve with halved cherry tomatoes on the side"
    ],
    nutrition: { calories: 265, protein: 18, carbs: 5, fat: 20 }
  },
  {
    id: "overnight-oats-with-almonds",
    name: "Overnight Oats with Almonds",
    description: "Creamy oats soaked overnight with almond milk, topped with nuts and fruit",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Heart-Healthy", "Anti-Inflammatory", "Vegetarian", "High Fiber", "Vegan Option"],
    ingredients: [
      { name: "rolled oats", quantity: 0.5, unit: "cup" },
      { name: "almond milk", quantity: 0.75, unit: "cup" },
      { name: "chia seeds", quantity: 1, unit: "tbsp" },
      { name: "sliced almonds", quantity: 1, unit: "tbsp" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "medium" },
      { name: "cinnamon", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Combine oats, almond milk, chia seeds, and cinnamon in jar",
      "Stir well and refrigerate overnight (or minimum 4 hours)",
      "In the morning, stir the oats",
      "Top with sliced banana and almonds",
      "Optional: drizzle with honey or maple syrup",
      "Serve cold or microwave for 30 seconds if preferred warm"
    ],
    nutrition: { calories: 320, protein: 10, carbs: 45, fat: 12 }
  },
  {
    id: "smoked-salmon-cream-cheese-bagel",
    name: "Smoked Salmon & Cream Cheese Bagel",
    description: "Mini bagel with cream cheese, smoked salmon, capers, and red onion",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Omega-3 Rich", "Pescatarian", "Heart-Healthy"],
    ingredients: [
      { name: "mini whole grain bagel", quantity: 1, unit: "each" },
      { name: "cream cheese", quantity: 2, unit: "tbsp", notes: "light" },
      { name: "smoked salmon", quantity: 2, unit: "oz" },
      { name: "red onion", quantity: 2, unit: "slice", notes: "sliced thin" },
      { name: "capers", quantity: 1, unit: "tsp" },
      { name: "fresh dill", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Toast bagel halves until lightly golden",
      "Spread cream cheese on both halves",
      "Layer smoked salmon on bottom half",
      "Top with red onion slices and capers",
      "Sprinkle with fresh dill",
      "Close sandwich or serve open-faced"
    ],
    nutrition: { calories: 310, protein: 20, carbs: 28, fat: 14 }
  },
  {
    id: "veggie-egg-white-omelet",
    name: "Veggie Egg White Omelet",
    description: "Light and fluffy egg white omelet packed with colorful vegetables",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Calorie", "High Protein", "Gluten-Free", "Vegetarian", "Low Fat"],
    ingredients: [
      { name: "egg whites", quantity: 4, unit: "each", notes: "large" },
      { name: "bell peppers", quantity: 0.25, unit: "cup", notes: "mixed" },
      { name: "mushrooms", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "cherry tomatoes", quantity: 4, unit: "each", notes: "small, halved" },
      { name: "baby spinach", quantity: 0.25, unit: "cup" },
      { name: "olive oil spray", quantity: 2, unit: "spray" }
    ],
    instructions: [
      "Spray non-stick pan with olive oil and heat over medium",
      "Sauté peppers and mushrooms for 2-3 minutes",
      "Whisk egg whites and pour into pan",
      "Cook until edges start to set",
      "Add vegetables and tomatoes to one half",
      "Fold omelet in half and cook 1-2 more minutes"
    ],
    nutrition: { calories: 165, protein: 22, carbs: 8, fat: 4 }
  },
  {
    id: "peanut-butter-banana-toast",
    name: "Peanut Butter Banana Toast",
    description: "Whole grain toast with natural peanut butter and fresh banana slices",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Energy Boost", "Vegan Option", "High Fiber"],
    ingredients: [
      { name: "whole grain bread", quantity: 1, unit: "slice" },
      { name: "natural peanut butter", quantity: 1.5, unit: "tbsp" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "medium" },
      { name: "cinnamon", quantity: 1, unit: "pinch" },
      { name: "honey", quantity: 0.5, unit: "tsp" },
      { name: "chia seeds", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Toast bread until golden brown",
      "Spread peanut butter evenly on toast",
      "Slice banana and arrange on top",
      "Sprinkle with cinnamon and chia seeds",
      "Drizzle with honey if desired",
      "Serve immediately"
    ],
    nutrition: { calories: 290, protein: 10, carbs: 38, fat: 13 }
  },
  {
    id: "breakfast-burrito-bowl",
    name: "Breakfast Burrito Bowl",
    description: "Scrambled eggs over seasoned black beans with avocado and salsa",
    cuisine: "Mexican",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "High Fiber", "Gluten-Free", "Vegetarian", "Anti-Inflammatory"],
    ingredients: [
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "black beans", quantity: 0.25, unit: "cup", notes: "cooked" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium" },
      { name: "salsa", quantity: 2, unit: "tbsp" },
      { name: "shredded cheese", quantity: 2, unit: "tbsp" },
      { name: "cilantro", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Heat black beans in small pan with cumin",
      "Scramble eggs in separate pan",
      "Place warm beans in bowl",
      "Top with scrambled eggs",
      "Add diced avocado, salsa, and cheese",
      "Garnish with fresh cilantro"
    ],
    nutrition: { calories: 340, protein: 20, carbs: 20, fat: 20 }
  },
  {
    id: "cottage-cheese-fruit-bowl",
    name: "Cottage Cheese & Fruit Bowl",
    description: "Protein-rich cottage cheese with fresh seasonal fruit and nuts",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Probiotic", "Gluten-Free", "Vegetarian", "Low Sugar"],
    ingredients: [
      { name: "cottage cheese", quantity: 0.75, unit: "cup", notes: "low-fat" },
      { name: "pineapple chunks", quantity: 0.25, unit: "cup" },
      { name: "strawberries", quantity: 3, unit: "each", notes: "medium, sliced" },
      { name: "walnuts", quantity: 1, unit: "tbsp", notes: "chopped" },
      { name: "hemp seeds", quantity: 1, unit: "tsp" },
      { name: "cinnamon", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Place cottage cheese in serving bowl",
      "Arrange pineapple and strawberries on top",
      "Sprinkle with chopped walnuts and hemp seeds",
      "Dust with cinnamon",
      "Optional: add a small drizzle of honey",
      "Serve chilled"
    ],
    nutrition: { calories: 235, protein: 24, carbs: 20, fat: 8 }
  },
  {
    id: "spinach-mushroom-frittata",
    name: "Spinach Mushroom Frittata",
    description: "Italian-style baked egg dish with fresh vegetables and herbs",
    cuisine: "Italian",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Gluten-Free", "Vegetarian", "Keto-Friendly"],
    ingredients: [
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "baby spinach", quantity: 0.5, unit: "cup" },
      { name: "mushrooms", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "parmesan cheese", quantity: 2, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "fresh basil", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Preheat oven to 375°F",
      "Sauté mushrooms and spinach in oven-safe pan",
      "Whisk eggs with parmesan and basil",
      "Pour eggs over vegetables in pan",
      "Transfer to oven and bake 12-15 minutes until set",
      "Let cool slightly, slice and serve"
    ],
    nutrition: { calories: 255, protein: 18, carbs: 5, fat: 19 }
  },
  {
    id: "chia-pudding-berries",
    name: "Chia Pudding with Berries",
    description: "Nutrient-dense chia seed pudding topped with fresh berries",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Vegan", "High Fiber", "Omega-3 Rich", "Gluten-Free", "Anti-Inflammatory"],
    ingredients: [
      { name: "chia seeds", quantity: 3, unit: "tbsp" },
      { name: "almond milk", quantity: 1, unit: "cup", notes: "unsweetened" },
      { name: "vanilla extract", quantity: 0.25, unit: "tsp" },
      { name: "mixed berries", quantity: 0.25, unit: "cup" },
      { name: "maple syrup", quantity: 1, unit: "tsp" },
      { name: "sliced almonds", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Mix chia seeds, almond milk, and vanilla in jar",
      "Stir well and refrigerate overnight (minimum 4 hours)",
      "Chia will absorb liquid and become pudding-like",
      "In morning, stir pudding and drizzle with maple syrup",
      "Top with fresh berries and almonds",
      "Serve cold"
    ],
    nutrition: { calories: 260, protein: 8, carbs: 28, fat: 14 }
  },
  {
    id: "turkey-sausage-egg-muffin",
    name: "Turkey Sausage & Egg Muffin",
    description: "English muffin sandwich with lean turkey sausage and egg",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Portion-Controlled", "Low Fat", "Balanced Meal"],
    ingredients: [
      { name: "whole wheat English muffin", quantity: 1, unit: "each" },
      { name: "turkey sausage patty", quantity: 1, unit: "each" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" },
      { name: "cheddar cheese", quantity: 1, unit: "slice", notes: "reduced-fat" },
      { name: "tomato slice", quantity: 1, unit: "slice" },
      { name: "baby spinach", quantity: 2, unit: "leaf" }
    ],
    instructions: [
      "Cook turkey sausage patty according to package directions",
      "Fry or scramble egg to your preference",
      "Toast English muffin halves",
      "Layer sausage, egg, cheese, tomato, and spinach",
      "Close sandwich and serve warm",
      "Can be wrapped in foil for on-the-go"
    ],
    nutrition: { calories: 315, protein: 24, carbs: 28, fat: 12 }
  },
  {
    id: "apple-cinnamon-quinoa",
    name: "Apple Cinnamon Quinoa Bowl",
    description: "Warm quinoa breakfast bowl with sautéed apples and warming spices",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Vegan", "Gluten-Free", "High Fiber", "Heart-Healthy", "Anti-Inflammatory"],
    ingredients: [
      { name: "cooked quinoa", quantity: 0.5, unit: "cup" },
      { name: "apple", quantity: 0.5, unit: "each", notes: "medium, diced" },
      { name: "almond milk", quantity: 0.25, unit: "cup" },
      { name: "cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "walnuts", quantity: 1, unit: "tbsp", notes: "chopped" },
      { name: "maple syrup", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Sauté diced apple with cinnamon in small pan",
      "Add cooked quinoa and almond milk to pan",
      "Heat through for 2-3 minutes, stirring",
      "Transfer to bowl",
      "Top with chopped walnuts and drizzle with maple syrup",
      "Serve warm"
    ],
    nutrition: { calories: 275, protein: 7, carbs: 45, fat: 8 }
  },
  {
    id: "breakfast-quesadilla",
    name: "Breakfast Quesadilla",
    description: "Whole wheat tortilla filled with eggs, cheese, and black beans",
    cuisine: "Mexican",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "High Fiber", "Vegetarian", "Portion-Controlled"],
    ingredients: [
      { name: "whole wheat tortilla", quantity: 1, unit: "each", notes: "small" },
      { name: "eggs", quantity: 1, unit: "each", notes: "large, scrambled" },
      { name: "black beans", quantity: 2, unit: "tbsp" },
      { name: "shredded cheese", quantity: 2, unit: "tbsp" },
      { name: "salsa", quantity: 2, unit: "tbsp" },
      { name: "avocado", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Scramble egg and set aside",
      "Place tortilla in dry pan over medium heat",
      "On one half, layer beans, egg, and cheese",
      "Fold tortilla in half",
      "Cook 2 minutes per side until golden and cheese melts",
      "Cut into wedges, serve with salsa and avocado"
    ],
    nutrition: { calories: 295, protein: 15, carbs: 28, fat: 14 }
  },
  {
    id: "protein-pancakes-blueberries",
    name: "Protein Pancakes with Blueberries",
    description: "Fluffy high-protein pancakes topped with fresh blueberries",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Low Sugar", "Portion-Controlled", "Vegetarian"],
    ingredients: [
      { name: "protein pancake mix", quantity: 0.33, unit: "cup" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" },
      { name: "almond milk", quantity: 0.25, unit: "cup" },
      { name: "fresh blueberries", quantity: 0.25, unit: "cup" },
      { name: "Greek yogurt", quantity: 2, unit: "tbsp" },
      { name: "maple syrup", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix pancake mix, egg, and almond milk until smooth",
      "Heat non-stick pan over medium heat",
      "Pour batter to make 2 small pancakes",
      "Cook 2-3 minutes per side until golden",
      "Stack pancakes and top with blueberries",
      "Add dollop of Greek yogurt and drizzle with maple syrup"
    ],
    nutrition: { calories: 305, protein: 26, carbs: 35, fat: 8 }
  },
  {
    id: "mediterranean-breakfast-plate",
    name: "Mediterranean Breakfast Plate",
    description: "Hummus, olives, feta, cucumber, and whole grain pita",
    cuisine: "Mediterranean",
    category: "breakfast",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Mediterranean Diet", "Heart-Healthy", "Anti-Inflammatory", "Vegetarian", "High Fiber"],
    ingredients: [
      { name: "hummus", quantity: 0.25, unit: "cup" },
      { name: "whole grain pita", quantity: 1, unit: "each", notes: "mini" },
      { name: "feta cheese", quantity: 2, unit: "tbsp" },
      { name: "kalamata olives", quantity: 5, unit: "each" },
      { name: "cucumber", quantity: 0.5, unit: "cup", notes: "sliced" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small" }
    ],
    instructions: [
      "Warm pita in oven or toaster",
      "Arrange hummus in small bowl",
      "Plate feta, olives, cucumber, and tomatoes",
      "Cut pita into triangles for dipping",
      "Drizzle olive oil over vegetables if desired",
      "Serve with fresh herbs like mint or parsley"
    ],
    nutrition: { calories: 285, protein: 11, carbs: 32, fat: 14 }
  },
  {
    id: "sweet-potato-breakfast-hash",
    name: "Sweet Potato Breakfast Hash",
    description: "Roasted sweet potato with turkey sausage and peppers",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Gluten-Free", "Anti-Inflammatory", "Balanced Meal"],
    ingredients: [
      { name: "sweet potato", quantity: 0.5, unit: "cup", notes: "diced" },
      { name: "turkey sausage", quantity: 1, unit: "link" },
      { name: "bell pepper", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "onion", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "paprika", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Dice sweet potato and cook in microwave 3 minutes to soften",
      "Heat olive oil in pan over medium-high",
      "Add sweet potato, peppers, and onions",
      "Cook 5-7 minutes until potatoes are golden",
      "Slice and add turkey sausage, cook through",
      "Season with paprika and serve hot"
    ],
    nutrition: { calories: 280, protein: 16, carbs: 28, fat: 12 }
  },
  {
    id: "almond-butter-protein-bowl",
    name: "Almond Butter Protein Bowl",
    description: "Creamy almond butter base with banana, granola, and seeds",
    cuisine: "American",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Heart-Healthy", "Energy Boost", "Vegan Option"],
    ingredients: [
      { name: "almond butter", quantity: 2, unit: "tbsp" },
      { name: "Greek yogurt", quantity: 0.5, unit: "cup" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "medium, sliced" },
      { name: "granola", quantity: 2, unit: "tbsp" },
      { name: "hemp seeds", quantity: 1, unit: "tsp" },
      { name: "dark chocolate chips", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix almond butter with Greek yogurt until smooth",
      "Transfer to serving bowl",
      "Top with sliced banana",
      "Sprinkle with granola, hemp seeds, and chocolate chips",
      "Optional: drizzle with honey",
      "Serve immediately"
    ],
    nutrition: { calories: 340, protein: 16, carbs: 35, fat: 17 }
  },
  {
    id: "shakshuka-single-serving",
    name: "Shakshuka (Single Serving)",
    description: "North African eggs poached in spiced tomato sauce",
    cuisine: "Mediterranean",
    category: "breakfast",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Anti-Inflammatory", "Gluten-Free", "Vegetarian", "Low Carb"],
    ingredients: [
      { name: "crushed tomatoes", quantity: 0.5, unit: "cup" },
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "bell pepper", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "onion", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "cumin", quantity: 0.25, unit: "tsp" },
      { name: "feta cheese", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Sauté onion and bell pepper in small pan",
      "Add crushed tomatoes and cumin",
      "Simmer 5 minutes until sauce thickens",
      "Make two wells in sauce and crack eggs into them",
      "Cover and cook 5-7 minutes until eggs are set",
      "Top with crumbled feta and serve with whole grain bread"
    ],
    nutrition: { calories: 265, protein: 16, carbs: 18, fat: 14 }
  },

  // ==================== LUNCH (20) ====================
  {
    id: "grilled-chicken-caesar-salad",
    name: "Grilled Chicken Caesar Salad",
    description: "Classic Caesar with grilled chicken breast, romaine, and parmesan",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Keto-Friendly", "Gluten-Free Option"],
    ingredients: [
      { name: "grilled chicken breast", quantity: 3, unit: "oz" },
      { name: "romaine lettuce", quantity: 2, unit: "cup", notes: "chopped" },
      { name: "parmesan cheese", quantity: 2, unit: "tbsp", notes: "shaved" },
      { name: "Caesar dressing", quantity: 2, unit: "tbsp", notes: "light" },
      { name: "whole grain croutons", quantity: 2, unit: "tbsp" },
      { name: "lemon wedge", quantity: 1, unit: "each" }
    ],
    instructions: [
      "Grill or pan-sear chicken breast with seasoning",
      "Let chicken rest 5 minutes, then slice",
      "Toss romaine with Caesar dressing",
      "Arrange lettuce on plate",
      "Top with sliced chicken and parmesan",
      "Add croutons and squeeze lemon over top"
    ],
    nutrition: { calories: 315, protein: 32, carbs: 12, fat: 16 }
  },
  {
    id: "mediterranean-quinoa-bowl",
    name: "Mediterranean Quinoa Bowl",
    description: "Quinoa with cucumber, tomatoes, chickpeas, feta, and lemon dressing",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Anti-Inflammatory", "Vegetarian", "Heart-Healthy", "High Fiber", "Vegan Option"],
    ingredients: [
      { name: "cooked quinoa", quantity: 0.5, unit: "cup" },
      { name: "chickpeas", quantity: 0.25, unit: "cup", notes: "cooked" },
      { name: "cucumber", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "cherry tomatoes", quantity: 0.25, unit: "cup", notes: "halved" },
      { name: "feta cheese", quantity: 2, unit: "tbsp" },
      { name: "lemon olive oil dressing", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Place quinoa as base in bowl",
      "Arrange chickpeas, cucumber, and tomatoes on top",
      "Crumble feta cheese over bowl",
      "Drizzle with lemon olive oil dressing",
      "Toss gently before eating",
      "Garnish with fresh herbs if desired"
    ],
    nutrition: { calories: 340, protein: 12, carbs: 42, fat: 14 }
  },
  {
    id: "turkey-avocado-wrap",
    name: "Turkey & Avocado Wrap",
    description: "Whole wheat wrap with sliced turkey, avocado, and fresh vegetables",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Heart-Healthy", "Dairy-Free Option", "Portable"],
    ingredients: [
      { name: "whole wheat tortilla", quantity: 1, unit: "each", notes: "large" },
      { name: "sliced turkey breast", quantity: 3, unit: "oz" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, mashed" },
      { name: "lettuce leaves", quantity: 2, unit: "leaf" },
      { name: "tomato", quantity: 2, unit: "slice" },
      { name: "mustard", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Lay tortilla flat and spread mashed avocado",
      "Add thin layer of mustard",
      "Layer turkey, lettuce, and tomato",
      "Roll tightly, folding in sides",
      "Cut diagonally in half",
      "Secure with toothpick if needed"
    ],
    nutrition: { calories: 325, protein: 26, carbs: 32, fat: 12 }
  },
  {
    id: "asian-chicken-lettuce-wraps",
    name: "Asian Chicken Lettuce Wraps",
    description: "Ground chicken with Asian flavors served in crisp lettuce cups",
    cuisine: "Asian",
    category: "lunch",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Low Sodium", "Gluten-Free", "Anti-Inflammatory", "Low Carb", "High Protein"],
    ingredients: [
      { name: "ground chicken", quantity: 3, unit: "oz" },
      { name: "butter lettuce leaves", quantity: 4, unit: "leaf", notes: "large" },
      { name: "water chestnuts", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "green onions", quantity: 2, unit: "tbsp", notes: "sliced" },
      { name: "low-sodium soy sauce", quantity: 1, unit: "tsp" },
      { name: "fresh ginger", quantity: 0.5, unit: "tsp", notes: "minced" }
    ],
    instructions: [
      "Brown ground chicken in pan over medium-high heat",
      "Add ginger, water chestnuts, and soy sauce",
      "Cook 3-4 minutes until chicken is done",
      "Wash and dry lettuce leaves",
      "Spoon chicken mixture into lettuce cups",
      "Top with green onions and serve immediately"
    ],
    nutrition: { calories: 225, protein: 28, carbs: 8, fat: 9 }
  },
  {
    id: "caprese-salad-grilled-chicken",
    name: "Caprese Salad with Grilled Chicken",
    description: "Fresh mozzarella, tomato, basil, and grilled chicken with balsamic",
    cuisine: "Italian",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "Anti-Inflammatory", "Gluten-Free", "High Protein", "Mediterranean Diet"],
    ingredients: [
      { name: "grilled chicken breast", quantity: 3, unit: "oz" },
      { name: "fresh mozzarella", quantity: 2, unit: "oz" },
      { name: "tomato", quantity: 1, unit: "each", notes: "medium, sliced" },
      { name: "fresh basil leaves", quantity: 6, unit: "leaf" },
      { name: "balsamic glaze", quantity: 1, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Slice grilled chicken, mozzarella, and tomato",
      "Arrange in alternating pattern on plate",
      "Tuck basil leaves between slices",
      "Drizzle with olive oil and balsamic glaze",
      "Season with salt and black pepper",
      "Serve at room temperature"
    ],
    nutrition: { calories: 310, protein: 32, carbs: 10, fat: 16 }
  },
  {
    id: "tuna-avocado-salad",
    name: "Tuna Avocado Salad",
    description: "Light tuna salad mixed with avocado instead of mayo, served on greens",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Omega-3 Rich", "Heart-Healthy", "Low Carb", "Pescatarian"],
    ingredients: [
      { name: "canned tuna", quantity: 3, unit: "oz", notes: "in water" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, mashed" },
      { name: "mixed greens", quantity: 2, unit: "cup" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small" },
      { name: "lemon juice", quantity: 1, unit: "tsp" },
      { name: "red onion", quantity: 1, unit: "tbsp", notes: "diced" }
    ],
    instructions: [
      "Drain tuna and place in bowl",
      "Add mashed avocado, lemon juice, and red onion",
      "Mix until combined and creamy",
      "Arrange mixed greens on plate",
      "Top with tuna mixture and cherry tomatoes",
      "Season with black pepper and serve"
    ],
    nutrition: { calories: 245, protein: 26, carbs: 12, fat: 11 }
  },
  {
    id: "greek-chicken-pita",
    name: "Greek Chicken Pita",
    description: "Grilled chicken in pita with tzatziki, cucumber, and tomato",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Mediterranean Diet", "Portion-Controlled"],
    ingredients: [
      { name: "whole wheat pita", quantity: 1, unit: "each", notes: "small" },
      { name: "grilled chicken", quantity: 3, unit: "oz", notes: "diced" },
      { name: "tzatziki sauce", quantity: 2, unit: "tbsp" },
      { name: "cucumber", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "tomato", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "red onion", quantity: 1, unit: "tbsp", notes: "sliced" }
    ],
    instructions: [
      "Warm pita in oven or microwave",
      "Cut pita in half to create pocket",
      "Spread tzatziki inside pita",
      "Stuff with chicken, cucumber, tomato, and onion",
      "Add lettuce if desired",
      "Serve with lemon wedge"
    ],
    nutrition: { calories: 305, protein: 28, carbs: 30, fat: 9 }
  },
  {
    id: "shrimp-avocado-salad",
    name: "Shrimp & Avocado Salad",
    description: "Grilled shrimp over mixed greens with avocado and citrus dressing",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Omega-3 Rich", "Low Carb", "Pescatarian", "Heart-Healthy"],
    ingredients: [
      { name: "cooked shrimp", quantity: 4, unit: "oz" },
      { name: "mixed greens", quantity: 2, unit: "cup" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, sliced" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small" },
      { name: "citrus vinaigrette", quantity: 2, unit: "tbsp" },
      { name: "red onion", quantity: 2, unit: "tbsp", notes: "sliced thin" }
    ],
    instructions: [
      "Grill or sauté shrimp with light seasoning",
      "Arrange mixed greens on plate",
      "Top with warm shrimp, avocado slices, and tomatoes",
      "Add red onion slices",
      "Drizzle with citrus vinaigrette",
      "Serve immediately while shrimp is warm"
    ],
    nutrition: { calories: 280, protein: 28, carbs: 14, fat: 14 }
  },
  {
    id: "veggie-hummus-wrap",
    name: "Veggie Hummus Wrap",
    description: "Colorful vegetables with hummus in whole wheat wrap",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Vegan", "High Fiber", "Anti-Inflammatory", "Heart-Healthy", "Low Sodium"],
    ingredients: [
      { name: "whole wheat tortilla", quantity: 1, unit: "each", notes: "large" },
      { name: "hummus", quantity: 3, unit: "tbsp" },
      { name: "cucumber", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "bell pepper", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "shredded carrots", quantity: 0.25, unit: "cup" },
      { name: "baby spinach", quantity: 0.5, unit: "cup" }
    ],
    instructions: [
      "Spread hummus evenly over tortilla",
      "Layer spinach leaves in center",
      "Add cucumber, bell pepper, and carrots",
      "Season with black pepper if desired",
      "Roll tightly, folding in sides",
      "Cut in half diagonally and serve"
    ],
    nutrition: { calories: 285, protein: 10, carbs: 42, fat: 10 }
  },
  {
    id: "chicken-tortilla-soup-cup",
    name: "Chicken Tortilla Soup Cup",
    description: "Hearty Mexican-inspired soup with chicken, beans, and vegetables",
    cuisine: "Mexican",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Anti-Inflammatory", "Gluten-Free", "High Fiber"],
    ingredients: [
      { name: "chicken breast", quantity: 2, unit: "oz", notes: "shredded" },
      { name: "black beans", quantity: 0.25, unit: "cup" },
      { name: "diced tomatoes", quantity: 0.25, unit: "cup" },
      { name: "chicken broth", quantity: 1, unit: "cup", notes: "low-sodium" },
      { name: "corn", quantity: 2, unit: "tbsp" },
      { name: "tortilla strips", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Heat chicken broth in small pot",
      "Add shredded chicken, beans, tomatoes, and corn",
      "Simmer 10 minutes until heated through",
      "Season with cumin and chili powder",
      "Ladle into bowl",
      "Top with tortilla strips and fresh cilantro"
    ],
    nutrition: { calories: 265, protein: 24, carbs: 28, fat: 6 }
  },
  {
    id: "salmon-arugula-salad",
    name: "Salmon & Arugula Salad",
    description: "Baked salmon over peppery arugula with lemon vinaigrette",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Omega-3 Rich", "Anti-Inflammatory", "Heart-Healthy", "Pescatarian"],
    ingredients: [
      { name: "baked salmon fillet", quantity: 3, unit: "oz" },
      { name: "arugula", quantity: 2, unit: "cup" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small" },
      { name: "red onion", quantity: 2, unit: "tbsp", notes: "sliced" },
      { name: "lemon vinaigrette", quantity: 2, unit: "tbsp" },
      { name: "capers", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Bake salmon at 400°F for 12-15 minutes",
      "Let salmon rest, then flake into chunks",
      "Toss arugula with lemon vinaigrette",
      "Arrange on plate and top with salmon",
      "Add cherry tomatoes, red onion, and capers",
      "Serve with lemon wedge"
    ],
    nutrition: { calories: 295, protein: 26, carbs: 8, fat: 18 }
  },
  {
    id: "egg-salad-lettuce-cups",
    name: "Egg Salad Lettuce Cups",
    description: "Classic egg salad served in crisp lettuce cups instead of bread",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Low Carb", "Keto-Friendly", "Gluten-Free", "Vegetarian"],
    ingredients: [
      { name: "hard-boiled eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "Greek yogurt", quantity: 2, unit: "tbsp" },
      { name: "Dijon mustard", quantity: 1, unit: "tsp" },
      { name: "butter lettuce leaves", quantity: 4, unit: "leaf", notes: "large" },
      { name: "celery", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "fresh dill", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Chop hard-boiled eggs",
      "Mix with Greek yogurt, mustard, celery, and dill",
      "Season with salt and pepper",
      "Wash and dry lettuce leaves",
      "Spoon egg salad into lettuce cups",
      "Garnish with paprika and serve"
    ],
    nutrition: { calories: 235, protein: 16, carbs: 6, fat: 16 }
  },
  {
    id: "thai-peanut-chicken-bowl",
    name: "Thai Peanut Chicken Bowl",
    description: "Grilled chicken with vegetables and spicy peanut sauce over greens",
    cuisine: "Asian",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Anti-Inflammatory", "Dairy-Free", "Gluten-Free Option"],
    ingredients: [
      { name: "grilled chicken", quantity: 3, unit: "oz", notes: "sliced" },
      { name: "mixed greens", quantity: 1, unit: "cup" },
      { name: "shredded cabbage", quantity: 0.5, unit: "cup" },
      { name: "shredded carrots", quantity: 0.25, unit: "cup" },
      { name: "peanut sauce", quantity: 2, unit: "tbsp" },
      { name: "crushed peanuts", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Arrange greens and cabbage in bowl",
      "Top with sliced chicken and shredded carrots",
      "Drizzle with peanut sauce",
      "Toss everything together",
      "Top with crushed peanuts",
      "Garnish with cilantro and lime wedge"
    ],
    nutrition: { calories: 325, protein: 30, carbs: 18, fat: 16 }
  },
  {
    id: "lentil-veggie-soup",
    name: "Lentil Vegetable Soup",
    description: "Hearty plant-based soup with lentils and seasonal vegetables",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Vegan", "High Fiber", "Heart-Healthy", "Anti-Inflammatory", "Low Fat"],
    ingredients: [
      { name: "cooked lentils", quantity: 0.5, unit: "cup" },
      { name: "vegetable broth", quantity: 1, unit: "cup" },
      { name: "diced carrots", quantity: 0.25, unit: "cup" },
      { name: "diced celery", quantity: 0.25, unit: "cup" },
      { name: "spinach", quantity: 0.5, unit: "cup" },
      { name: "garlic", quantity: 1, unit: "clove", notes: "minced" }
    ],
    instructions: [
      "Sauté garlic, carrots, and celery in pot",
      "Add vegetable broth and bring to simmer",
      "Add cooked lentils and simmer 10 minutes",
      "Stir in spinach until wilted",
      "Season with cumin and black pepper",
      "Serve hot with whole grain bread"
    ],
    nutrition: { calories: 245, protein: 14, carbs: 42, fat: 2 }
  },
  {
    id: "chicken-pesto-zoodles",
    name: "Chicken Pesto Zoodles",
    description: "Grilled chicken over zucchini noodles with fresh basil pesto",
    cuisine: "Italian",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "Keto-Friendly", "Gluten-Free", "High Protein", "Anti-Inflammatory"],
    ingredients: [
      { name: "grilled chicken", quantity: 3, unit: "oz", notes: "sliced" },
      { name: "zucchini noodles", quantity: 2, unit: "cup" },
      { name: "basil pesto", quantity: 2, unit: "tbsp" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small, halved" },
      { name: "parmesan cheese", quantity: 1, unit: "tbsp" },
      { name: "pine nuts", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Sauté zucchini noodles in pan 2-3 minutes",
      "Add pesto and toss to coat",
      "Transfer zoodles to plate",
      "Top with sliced grilled chicken",
      "Add cherry tomatoes, parmesan, and pine nuts",
      "Serve immediately while warm"
    ],
    nutrition: { calories: 310, protein: 30, carbs: 12, fat: 18 }
  },
  {
    id: "black-bean-sweet-potato-bowl",
    name: "Black Bean & Sweet Potato Bowl",
    description: "Roasted sweet potato with black beans, avocado, and lime",
    cuisine: "Mexican",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Vegan", "High Fiber", "Anti-Inflammatory", "Gluten-Free", "Heart-Healthy"],
    ingredients: [
      { name: "roasted sweet potato", quantity: 0.5, unit: "cup", notes: "cubed" },
      { name: "black beans", quantity: 0.5, unit: "cup" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, sliced" },
      { name: "corn", quantity: 2, unit: "tbsp" },
      { name: "lime juice", quantity: 1, unit: "tbsp" },
      { name: "cilantro", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Roast sweet potato cubes at 425°F for 20 minutes",
      "Warm black beans with cumin",
      "Place sweet potato and beans in bowl",
      "Top with corn and avocado slices",
      "Squeeze lime juice over everything",
      "Garnish with fresh cilantro"
    ],
    nutrition: { calories: 330, protein: 12, carbs: 52, fat: 10 }
  },
  {
    id: "cobb-salad-mini",
    name: "Mini Cobb Salad",
    description: "Classic Cobb with turkey, egg, bacon, avocado, and blue cheese",
    cuisine: "American",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Keto-Friendly", "Gluten-Free"],
    ingredients: [
      { name: "mixed greens", quantity: 2, unit: "cup" },
      { name: "turkey breast", quantity: 2, unit: "oz", notes: "diced" },
      { name: "hard-boiled egg", quantity: 1, unit: "each", notes: "large, chopped" },
      { name: "turkey bacon", quantity: 1, unit: "slice", notes: "crumbled" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, diced" },
      { name: "blue cheese crumbles", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Arrange mixed greens on plate",
      "Arrange turkey, egg, bacon, and avocado in rows",
      "Sprinkle blue cheese over top",
      "Serve with ranch or vinaigrette on side",
      "Toss before eating or eat in sections",
      "Season with black pepper"
    ],
    nutrition: { calories: 340, protein: 28, carbs: 10, fat: 22 }
  },
  {
    id: "mediterranean-tuna-salad",
    name: "Mediterranean Tuna Salad",
    description: "Tuna with white beans, olives, tomatoes, and lemon dressing",
    cuisine: "Mediterranean",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Omega-3 Rich", "Mediterranean Diet", "Heart-Healthy", "Pescatarian"],
    ingredients: [
      { name: "canned tuna", quantity: 3, unit: "oz", notes: "in water" },
      { name: "white beans", quantity: 0.25, unit: "cup" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small, halved" },
      { name: "kalamata olives", quantity: 5, unit: "each" },
      { name: "mixed greens", quantity: 1, unit: "cup" },
      { name: "lemon vinaigrette", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Drain tuna and flake into bowl",
      "Add white beans, tomatoes, and olives",
      "Toss with lemon vinaigrette",
      "Serve over bed of mixed greens",
      "Garnish with fresh parsley",
      "Add lemon wedge on side"
    ],
    nutrition: { calories: 285, protein: 28, carbs: 20, fat: 10 }
  },
  {
    id: "chicken-veggie-stir-fry",
    name: "Chicken Vegetable Stir-Fry",
    description: "Quick-cooked chicken and crisp vegetables in light sauce",
    cuisine: "Asian",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Sodium", "Gluten-Free Option", "Diabetic-Friendly"],
    ingredients: [
      { name: "chicken breast", quantity: 3, unit: "oz", notes: "sliced" },
      { name: "broccoli florets", quantity: 0.5, unit: "cup" },
      { name: "bell peppers", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "snap peas", quantity: 0.25, unit: "cup" },
      { name: "low-sodium soy sauce", quantity: 1, unit: "tbsp" },
      { name: "fresh ginger", quantity: 0.5, unit: "tsp", notes: "minced" }
    ],
    instructions: [
      "Heat wok or large pan over high heat",
      "Stir-fry chicken until nearly cooked",
      "Add broccoli and peppers, cook 2-3 minutes",
      "Add snap peas, ginger, and soy sauce",
      "Toss everything for 1-2 minutes",
      "Serve immediately over small portion of brown rice if desired"
    ],
    nutrition: { calories: 245, protein: 30, carbs: 14, fat: 8 }
  },
  {
    id: "caprese-stuffed-portobello",
    name: "Caprese Stuffed Portobello",
    description: "Grilled portobello mushroom filled with mozzarella, tomato, and basil",
    cuisine: "Italian",
    category: "lunch",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "Vegetarian", "Gluten-Free", "Anti-Inflammatory", "Mediterranean Diet"],
    ingredients: [
      { name: "portobello mushroom cap", quantity: 1, unit: "each", notes: "large" },
      { name: "fresh mozzarella", quantity: 2, unit: "oz" },
      { name: "tomato", quantity: 0.5, unit: "each", notes: "medium, sliced" },
      { name: "fresh basil", quantity: 4, unit: "leaf" },
      { name: "balsamic glaze", quantity: 1, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Remove stem from mushroom and brush with olive oil",
      "Grill or bake mushroom cap 5 minutes",
      "Fill with sliced tomato and mozzarella",
      "Return to oven until cheese melts",
      "Top with fresh basil leaves",
      "Drizzle with balsamic glaze and serve"
    ],
    nutrition: { calories: 245, protein: 14, carbs: 12, fat: 16 }
  },

  // ==================== DINNER (20) ====================
  {
    id: "grilled-salmon-asparagus",
    name: "Grilled Salmon with Asparagus",
    description: "Herb-crusted salmon fillet with roasted asparagus and lemon",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Anti-Inflammatory", "Heart-Healthy", "Omega-3 Rich", "Low Sodium", "Diabetic-Friendly", "Pescatarian"],
    ingredients: [
      { name: "salmon fillet", quantity: 4, unit: "oz" },
      { name: "asparagus spears", quantity: 6, unit: "each" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "lemon", quantity: 2, unit: "slice" },
      { name: "fresh dill", quantity: 1, unit: "tbsp" },
      { name: "garlic", quantity: 1, unit: "clove", notes: "minced" }
    ],
    instructions: [
      "Preheat oven to 400°F",
      "Season salmon with dill, garlic, salt, and pepper",
      "Toss asparagus with olive oil",
      "Place salmon and asparagus on baking sheet",
      "Top salmon with lemon slices",
      "Bake 12-15 minutes until salmon flakes easily"
    ],
    nutrition: { calories: 320, protein: 28, carbs: 8, fat: 20 }
  },
  {
    id: "chicken-stir-fry-veggies",
    name: "Chicken Stir-Fry with Vegetables",
    description: "Tender chicken with colorful vegetables in Asian-inspired sauce",
    cuisine: "Asian",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Diabetic-Friendly", "Low Sodium", "Gluten-Free Option", "High Protein"],
    ingredients: [
      { name: "chicken breast", quantity: 4, unit: "oz", notes: "sliced" },
      { name: "broccoli florets", quantity: 0.5, unit: "cup" },
      { name: "bell peppers", quantity: 0.5, unit: "cup", notes: "sliced" },
      { name: "snow peas", quantity: 0.25, unit: "cup" },
      { name: "low-sodium stir-fry sauce", quantity: 2, unit: "tbsp" },
      { name: "sesame oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Heat sesame oil in wok over high heat",
      "Stir-fry chicken until golden, about 4 minutes",
      "Add broccoli and peppers, cook 3 minutes",
      "Add snow peas and sauce",
      "Toss everything for 2 minutes",
      "Serve over small portion of brown rice or cauliflower rice"
    ],
    nutrition: { calories: 305, protein: 32, carbs: 16, fat: 12 }
  },
  {
    id: "beef-taco-bowl",
    name: "Beef Taco Bowl",
    description: "Seasoned ground beef over lettuce with taco toppings",
    cuisine: "Mexican",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Customizable", "Dairy-Free Option", "Gluten-Free"],
    ingredients: [
      { name: "lean ground beef", quantity: 3, unit: "oz" },
      { name: "romaine lettuce", quantity: 2, unit: "cup", notes: "chopped" },
      { name: "black beans", quantity: 0.25, unit: "cup" },
      { name: "corn", quantity: 2, unit: "tbsp" },
      { name: "salsa", quantity: 2, unit: "tbsp" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium, sliced" }
    ],
    instructions: [
      "Brown ground beef with taco seasoning",
      "Place chopped lettuce in bowl as base",
      "Add warm beef, black beans, and corn",
      "Top with salsa and avocado slices",
      "Optional: add shredded cheese and sour cream",
      "Serve with lime wedge"
    ],
    nutrition: { calories: 340, protein: 26, carbs: 24, fat: 16 }
  },
  {
    id: "baked-cod-sweet-potato",
    name: "Baked Cod with Sweet Potato",
    description: "Flaky cod fillet with roasted sweet potato and green beans",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Sodium", "Anti-Inflammatory", "Diabetic-Friendly", "Heart-Healthy", "Pescatarian"],
    ingredients: [
      { name: "cod fillet", quantity: 4, unit: "oz" },
      { name: "sweet potato", quantity: 0.5, unit: "cup", notes: "cubed" },
      { name: "green beans", quantity: 0.75, unit: "cup" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "paprika", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 425°F",
      "Toss sweet potato cubes with olive oil and paprika",
      "Roast sweet potato 15 minutes",
      "Add cod and green beans to sheet pan",
      "Drizzle cod with lemon juice",
      "Bake additional 12-15 minutes until cod flakes"
    ],
    nutrition: { calories: 310, protein: 26, carbs: 28, fat: 10 }
  },
  {
    id: "turkey-meatballs-zucchini-noodles",
    name: "Turkey Meatballs with Zucchini Noodles",
    description: "Lean turkey meatballs in marinara over zucchini noodles",
    cuisine: "Italian",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "High Protein", "Gluten-Free", "Keto-Friendly"],
    ingredients: [
      { name: "turkey meatballs", quantity: 3, unit: "each" },
      { name: "zucchini noodles", quantity: 2, unit: "cup" },
      { name: "marinara sauce", quantity: 0.5, unit: "cup" },
      { name: "parmesan cheese", quantity: 1, unit: "tbsp" },
      { name: "fresh basil", quantity: 2, unit: "leaf" },
      { name: "garlic", quantity: 1, unit: "clove" }
    ],
    instructions: [
      "Bake or pan-fry turkey meatballs until cooked through",
      "Heat marinara sauce in pan",
      "Add meatballs to sauce and simmer",
      "Sauté zucchini noodles 2-3 minutes",
      "Plate zoodles and top with meatballs and sauce",
      "Garnish with parmesan and fresh basil"
    ],
    nutrition: { calories: 295, protein: 28, carbs: 18, fat: 12 }
  },
  {
    id: "grilled-chicken-mediterranean",
    name: "Grilled Chicken Mediterranean Style",
    description: "Herb-marinated chicken with Greek salad and tzatziki",
    cuisine: "Mediterranean",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Mediterranean Diet", "Heart-Healthy", "Anti-Inflammatory", "Gluten-Free"],
    ingredients: [
      { name: "chicken breast", quantity: 4, unit: "oz" },
      { name: "cucumber", quantity: 0.5, unit: "cup", notes: "diced" },
      { name: "cherry tomatoes", quantity: 5, unit: "each", notes: "small, halved" },
      { name: "feta cheese", quantity: 2, unit: "tbsp" },
      { name: "tzatziki sauce", quantity: 2, unit: "tbsp" },
      { name: "kalamata olives", quantity: 4, unit: "each" }
    ],
    instructions: [
      "Marinate chicken in lemon, garlic, and oregano",
      "Grill chicken 6-7 minutes per side",
      "Mix cucumber, tomatoes, feta, and olives for salad",
      "Slice grilled chicken",
      "Serve chicken with Greek salad on the side",
      "Top with tzatziki sauce"
    ],
    nutrition: { calories: 325, protein: 34, carbs: 12, fat: 16 }
  },
  {
    id: "shrimp-cauliflower-rice-bowl",
    name: "Shrimp & Cauliflower Rice Bowl",
    description: "Garlic butter shrimp over seasoned cauliflower rice",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "Keto-Friendly", "High Protein", "Gluten-Free", "Pescatarian"],
    ingredients: [
      { name: "large shrimp", quantity: 5, unit: "each" },
      { name: "cauliflower rice", quantity: 1, unit: "cup" },
      { name: "butter", quantity: 1, unit: "tbsp" },
      { name: "garlic", quantity: 2, unit: "clove", notes: "minced" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "parsley", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Sauté cauliflower rice in pan with seasoning",
      "In separate pan, melt butter with garlic",
      "Add shrimp and cook 2-3 minutes per side",
      "Squeeze lemon juice over shrimp",
      "Plate cauliflower rice and top with shrimp",
      "Garnish with fresh parsley"
    ],
    nutrition: { calories: 275, protein: 26, carbs: 10, fat: 16 }
  },
  {
    id: "pork-chops-roasted-vegetables",
    name: "Pork Chops with Roasted Vegetables",
    description: "Juicy pork chop with colorful roasted vegetables",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Gluten-Free", "Diabetic-Friendly", "Balanced Meal"],
    ingredients: [
      { name: "boneless pork chop", quantity: 4, unit: "oz" },
      { name: "Brussels sprouts", quantity: 0.5, unit: "cup", notes: "halved" },
      { name: "carrots", quantity: 0.25, unit: "cup", notes: "chopped" },
      { name: "red onion", quantity: 0.25, unit: "cup", notes: "wedges" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "rosemary", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 425°F",
      "Toss vegetables with olive oil and rosemary",
      "Roast vegetables 15 minutes",
      "Season pork chop and add to pan",
      "Roast additional 15-18 minutes until pork reaches 145°F",
      "Let pork rest 5 minutes before serving"
    ],
    nutrition: { calories: 340, protein: 28, carbs: 18, fat: 18 }
  },
  {
    id: "teriyaki-chicken-broccoli",
    name: "Teriyaki Chicken & Broccoli",
    description: "Glazed chicken thighs with steamed broccoli in teriyaki sauce",
    cuisine: "Asian",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Gluten-Free Option", "Diabetic-Friendly"],
    ingredients: [
      { name: "boneless chicken thigh", quantity: 4, unit: "oz" },
      { name: "broccoli florets", quantity: 1, unit: "cup" },
      { name: "teriyaki sauce", quantity: 2, unit: "tbsp", notes: "low-sodium" },
      { name: "sesame seeds", quantity: 1, unit: "tsp" },
      { name: "green onions", quantity: 1, unit: "tbsp", notes: "sliced" },
      { name: "fresh ginger", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Cook chicken in pan until golden",
      "Add teriyaki sauce and ginger, simmer",
      "Steam broccoli until tender-crisp",
      "Slice chicken and arrange with broccoli",
      "Drizzle with extra teriyaki sauce",
      "Top with sesame seeds and green onions"
    ],
    nutrition: { calories: 315, protein: 30, carbs: 16, fat: 14 }
  },
  {
    id: "stuffed-bell-peppers",
    name: "Stuffed Bell Peppers",
    description: "Bell peppers filled with ground turkey, quinoa, and vegetables",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "High Fiber", "Gluten-Free", "Balanced Meal"],
    ingredients: [
      { name: "bell pepper", quantity: 1, unit: "each", notes: "large" },
      { name: "ground turkey", quantity: 3, unit: "oz" },
      { name: "cooked quinoa", quantity: 0.25, unit: "cup" },
      { name: "diced tomatoes", quantity: 0.25, unit: "cup" },
      { name: "mozzarella cheese", quantity: 2, unit: "tbsp" },
      { name: "Italian seasoning", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 375°F",
      "Cut top off bell pepper and remove seeds",
      "Brown ground turkey with Italian seasoning",
      "Mix turkey with quinoa and tomatoes",
      "Stuff pepper with mixture and top with cheese",
      "Bake 25-30 minutes until pepper is tender"
    ],
    nutrition: { calories: 330, protein: 28, carbs: 26, fat: 14 }
  },
  {
    id: "lemon-herb-tilapia",
    name: "Lemon Herb Tilapia",
    description: "Light and flaky tilapia with lemon, herbs, and roasted vegetables",
    cuisine: "Mediterranean",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Calorie", "High Protein", "Heart-Healthy", "Pescatarian", "Gluten-Free"],
    ingredients: [
      { name: "tilapia fillet", quantity: 4, unit: "oz" },
      { name: "zucchini", quantity: 0.5, unit: "cup", notes: "sliced" },
      { name: "cherry tomatoes", quantity: 6, unit: "each", notes: "small" },
      { name: "lemon", quantity: 2, unit: "slice" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "fresh thyme", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 400°F",
      "Place tilapia on parchment-lined baking sheet",
      "Top with lemon slices and thyme",
      "Arrange zucchini and tomatoes around fish",
      "Drizzle everything with olive oil",
      "Bake 12-15 minutes until fish flakes easily"
    ],
    nutrition: { calories: 245, protein: 26, carbs: 8, fat: 12 }
  },
  {
    id: "beef-broccoli-stir-fry",
    name: "Beef & Broccoli Stir-Fry",
    description: "Tender beef strips with broccoli in savory Asian sauce",
    cuisine: "Asian",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Gluten-Free Option", "Diabetic-Friendly"],
    ingredients: [
      { name: "sirloin beef", quantity: 3, unit: "oz", notes: "sliced thin" },
      { name: "broccoli florets", quantity: 1, unit: "cup" },
      { name: "low-sodium soy sauce", quantity: 1, unit: "tbsp" },
      { name: "oyster sauce", quantity: 1, unit: "tbsp" },
      { name: "garlic", quantity: 1, unit: "clove", notes: "minced" },
      { name: "sesame oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Heat wok over high heat with sesame oil",
      "Stir-fry beef until browned, about 3 minutes",
      "Remove beef and set aside",
      "Add broccoli and garlic, cook 3 minutes",
      "Return beef to wok with sauces",
      "Toss everything together and serve"
    ],
    nutrition: { calories: 285, protein: 26, carbs: 12, fat: 16 }
  },
  {
    id: "chicken-caprese-baked",
    name: "Baked Chicken Caprese",
    description: "Chicken breast topped with mozzarella, tomato, and basil",
    cuisine: "Italian",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Gluten-Free", "Mediterranean Diet"],
    ingredients: [
      { name: "chicken breast", quantity: 4, unit: "oz" },
      { name: "fresh mozzarella", quantity: 2, unit: "oz" },
      { name: "tomato", quantity: 2, unit: "slice" },
      { name: "fresh basil", quantity: 4, unit: "leaf" },
      { name: "balsamic glaze", quantity: 1, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 400°F",
      "Season chicken and sear in oven-safe pan",
      "Top chicken with tomato slices and mozzarella",
      "Transfer to oven and bake 15-18 minutes",
      "Top with fresh basil leaves",
      "Drizzle with balsamic glaze before serving"
    ],
    nutrition: { calories: 310, protein: 36, carbs: 6, fat: 16 }
  },
  {
    id: "shrimp-zucchini-boats",
    name: "Shrimp Zucchini Boats",
    description: "Zucchini halves filled with seasoned shrimp and cheese",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Low Carb", "Keto-Friendly", "High Protein", "Gluten-Free", "Pescatarian"],
    ingredients: [
      { name: "zucchini", quantity: 1, unit: "each", notes: "large" },
      { name: "cooked shrimp", quantity: 3, unit: "oz", notes: "chopped" },
      { name: "cream cheese", quantity: 2, unit: "tbsp" },
      { name: "parmesan cheese", quantity: 2, unit: "tbsp" },
      { name: "garlic powder", quantity: 0.25, unit: "tsp" },
      { name: "paprika", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 375°F",
      "Halve zucchini lengthwise and scoop out seeds",
      "Mix shrimp, cream cheese, and seasonings",
      "Fill zucchini halves with shrimp mixture",
      "Top with parmesan cheese",
      "Bake 20-25 minutes until zucchini is tender"
    ],
    nutrition: { calories: 265, protein: 26, carbs: 10, fat: 14 }
  },
  {
    id: "turkey-chili-small-bowl",
    name: "Turkey Chili (Small Bowl)",
    description: "Hearty turkey chili with beans and vegetables",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "High Fiber", "Gluten-Free", "Anti-Inflammatory"],
    ingredients: [
      { name: "ground turkey", quantity: 3, unit: "oz" },
      { name: "kidney beans", quantity: 0.25, unit: "cup" },
      { name: "diced tomatoes", quantity: 0.5, unit: "cup" },
      { name: "bell pepper", quantity: 0.25, unit: "cup", notes: "diced" },
      { name: "chili powder", quantity: 1, unit: "tsp" },
      { name: "cumin", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Brown ground turkey in pot",
      "Add peppers and cook 3 minutes",
      "Add beans, tomatoes, and spices",
      "Simmer 15-20 minutes",
      "Season with salt and pepper",
      "Top with shredded cheese and green onions if desired"
    ],
    nutrition: { calories: 305, protein: 28, carbs: 26, fat: 10 }
  },
  {
    id: "baked-chicken-brussels-sprouts",
    name: "Baked Chicken & Brussels Sprouts",
    description: "Sheet pan dinner with chicken and roasted Brussels sprouts",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Gluten-Free", "Anti-Inflammatory", "Low Carb"],
    ingredients: [
      { name: "chicken thigh", quantity: 4, unit: "oz", notes: "boneless" },
      { name: "Brussels sprouts", quantity: 1, unit: "cup", notes: "halved" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "garlic powder", quantity: 0.5, unit: "tsp" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "fresh thyme", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 425°F",
      "Season chicken with garlic powder and thyme",
      "Toss Brussels sprouts with olive oil",
      "Arrange chicken and sprouts on sheet pan",
      "Roast 25-30 minutes until chicken is done",
      "Squeeze lemon juice over everything before serving"
    ],
    nutrition: { calories: 315, protein: 28, carbs: 12, fat: 18 }
  },
  {
    id: "grilled-shrimp-skewers",
    name: "Grilled Shrimp Skewers",
    description: "Marinated shrimp skewers with vegetables",
    cuisine: "Mediterranean",
    category: "dinner",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Low Carb", "Gluten-Free", "Pescatarian", "Heart-Healthy"],
    ingredients: [
      { name: "large shrimp", quantity: 6, unit: "each" },
      { name: "bell peppers", quantity: 0.25, unit: "cup", notes: "chunks" },
      { name: "red onion", quantity: 0.25, unit: "cup", notes: "chunks" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "garlic", quantity: 1, unit: "clove", notes: "minced" }
    ],
    instructions: [
      "Marinate shrimp in olive oil, lemon, and garlic",
      "Thread shrimp and vegetables onto skewers",
      "Grill over medium-high heat 2-3 minutes per side",
      "Brush with marinade while cooking",
      "Serve with lemon wedges",
      "Optional: serve over small portion of rice or quinoa"
    ],
    nutrition: { calories: 265, protein: 24, carbs: 10, fat: 15 }
  },
  {
    id: "cauliflower-crust-pizza",
    name: "Personal Cauliflower Crust Pizza",
    description: "Low-carb pizza with cauliflower crust and your favorite toppings",
    cuisine: "Italian",
    category: "dinner",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Low Carb", "Keto-Friendly", "Gluten-Free", "Vegetarian Option"],
    ingredients: [
      { name: "cauliflower pizza crust", quantity: 1, unit: "each", notes: "small" },
      { name: "marinara sauce", quantity: 0.25, unit: "cup" },
      { name: "mozzarella cheese", quantity: 2, unit: "oz" },
      { name: "mushrooms", quantity: 0.25, unit: "cup", notes: "sliced" },
      { name: "bell peppers", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "fresh basil", quantity: 3, unit: "leaf" }
    ],
    instructions: [
      "Preheat oven according to crust package",
      "Spread marinara sauce on crust",
      "Top with mozzarella, mushrooms, and peppers",
      "Bake until cheese is melted and bubbly",
      "Top with fresh basil leaves",
      "Cut into slices and serve"
    ],
    nutrition: { calories: 290, protein: 18, carbs: 22, fat: 16 }
  },
  {
    id: "seared-scallops-spinach",
    name: "Seared Scallops with Spinach",
    description: "Pan-seared scallops over garlic sautéed spinach",
    cuisine: "American",
    category: "dinner",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Carb", "Gluten-Free", "Pescatarian", "Elegant"],
    ingredients: [
      { name: "sea scallops", quantity: 4, unit: "each", notes: "large" },
      { name: "baby spinach", quantity: 2, unit: "cup" },
      { name: "butter", quantity: 1, unit: "tbsp" },
      { name: "garlic", quantity: 2, unit: "clove", notes: "minced" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "white wine", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Pat scallops dry and season with salt and pepper",
      "Sear scallops in hot pan 2-3 minutes per side",
      "Remove scallops and set aside",
      "Sauté garlic and spinach in same pan",
      "Add white wine and lemon juice",
      "Plate spinach and top with scallops"
    ],
    nutrition: { calories: 275, protein: 24, carbs: 8, fat: 16 }
  },

  // ==================== SNACKS (20) ====================
  {
    id: "hummus-veggie-sticks",
    name: "Hummus with Veggie Sticks",
    description: "Creamy hummus with colorful raw vegetables for dipping",
    cuisine: "Mediterranean",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Anti-Inflammatory", "Vegan", "High Fiber", "Low Sodium", "Heart-Healthy"],
    ingredients: [
      { name: "hummus", quantity: 0.25, unit: "cup" },
      { name: "carrot sticks", quantity: 0.5, unit: "cup" },
      { name: "cucumber sticks", quantity: 0.5, unit: "cup" },
      { name: "bell pepper strips", quantity: 0.25, unit: "cup" },
      { name: "cherry tomatoes", quantity: 4, unit: "each", notes: "small" },
      { name: "olive oil drizzle", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Place hummus in small serving bowl",
      "Drizzle with olive oil and sprinkle with paprika",
      "Wash and cut vegetables into sticks",
      "Arrange vegetables around hummus",
      "Optional: sprinkle with fresh herbs",
      "Serve immediately or refrigerate"
    ],
    nutrition: { calories: 165, protein: 6, carbs: 20, fat: 8 }
  },
  {
    id: "cheese-whole-grain-crackers",
    name: "Cheese & Whole Grain Crackers",
    description: "Sharp cheddar cheese with whole grain crackers",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Vegetarian", "Portion-Controlled", "Calcium-Rich"],
    ingredients: [
      { name: "sharp cheddar cheese", quantity: 1.5, unit: "oz" },
      { name: "whole grain crackers", quantity: 6, unit: "each" },
      { name: "apple slices", quantity: 0.25, unit: "cup" },
      { name: "grapes", quantity: 8, unit: "each" },
      { name: "walnuts", quantity: 5, unit: "half" }
    ],
    instructions: [
      "Slice cheese into small cubes or slices",
      "Arrange cheese and crackers on plate",
      "Add apple slices and grapes",
      "Add walnuts for crunch",
      "Serve at room temperature",
      "Optional: add honey drizzle"
    ],
    nutrition: { calories: 285, protein: 12, carbs: 24, fat: 16 }
  },
  {
    id: "apple-almond-butter",
    name: "Apple Slices with Almond Butter",
    description: "Crisp apple slices with creamy almond butter",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Vegan", "Natural Sweetness", "High Fiber"],
    ingredients: [
      { name: "apple", quantity: 1, unit: "each", notes: "medium" },
      { name: "almond butter", quantity: 2, unit: "tbsp" },
      { name: "cinnamon", quantity: 1, unit: "pinch" },
      { name: "hemp seeds", quantity: 1, unit: "tsp" },
      { name: "honey", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Wash and slice apple into 8 wedges",
      "Remove core and seeds",
      "Arrange apple slices on plate",
      "Place almond butter in small bowl for dipping",
      "Sprinkle cinnamon over almond butter",
      "Optional: drizzle with honey and sprinkle hemp seeds"
    ],
    nutrition: { calories: 245, protein: 6, carbs: 30, fat: 13 }
  },
  {
    id: "greek-yogurt-berries",
    name: "Greek Yogurt with Berries",
    description: "Protein-rich Greek yogurt topped with fresh mixed berries",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["Probiotic", "Low Sugar", "High Protein", "Gluten-Free", "Vegetarian"],
    ingredients: [
      { name: "Greek yogurt", quantity: 0.75, unit: "cup", notes: "plain" },
      { name: "mixed berries", quantity: 0.25, unit: "cup", notes: "fresh" },
      { name: "honey", quantity: 1, unit: "tsp" },
      { name: "sliced almonds", quantity: 1, unit: "tbsp" },
      { name: "chia seeds", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Place Greek yogurt in serving bowl",
      "Top with fresh berries",
      "Drizzle with honey",
      "Sprinkle with almonds and chia seeds",
      "Optional: add vanilla extract to yogurt",
      "Serve immediately"
    ],
    nutrition: { calories: 220, protein: 18, carbs: 24, fat: 7 }
  },
  {
    id: "mixed-nuts-trail-mix",
    name: "Mixed Nuts Trail Mix",
    description: "Energy-boosting mix of nuts, seeds, and dried fruit",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Energy Boost", "Customizable", "Omega-3 Rich", "Vegan"],
    ingredients: [
      { name: "almonds", quantity: 10, unit: "each" },
      { name: "walnuts", quantity: 5, unit: "half" },
      { name: "cashews", quantity: 8, unit: "each" },
      { name: "dried cranberries", quantity: 1, unit: "tbsp" },
      { name: "dark chocolate chips", quantity: 1, unit: "tbsp" },
      { name: "pumpkin seeds", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Combine all nuts in a small bowl",
      "Add dried cranberries and chocolate chips",
      "Mix in pumpkin seeds",
      "Toss everything together",
      "Portion into small container for on-the-go",
      "Store remainder in airtight container"
    ],
    nutrition: { calories: 280, protein: 8, carbs: 22, fat: 20 }
  },
  {
    id: "hard-boiled-eggs",
    name: "Hard-Boiled Eggs with Seasoning",
    description: "Protein-packed hard-boiled eggs with your favorite seasonings",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Keto-Friendly", "Gluten-Free", "Low Carb", "Vegetarian"],
    ingredients: [
      { name: "hard-boiled eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "everything bagel seasoning", quantity: 0.5, unit: "tsp" },
      { name: "paprika", quantity: 1, unit: "pinch" },
      { name: "sea salt", quantity: 1, unit: "pinch" },
      { name: "black pepper", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Peel hard-boiled eggs",
      "Cut eggs in half lengthwise",
      "Sprinkle with everything bagel seasoning",
      "Add paprika, salt, and pepper to taste",
      "Serve immediately or refrigerate",
      "Optional: add a dollop of Greek yogurt"
    ],
    nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 }
  },
  {
    id: "cucumber-cream-cheese-bites",
    name: "Cucumber Cream Cheese Bites",
    description: "Refreshing cucumber rounds topped with herbed cream cheese",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Low Carb", "Keto-Friendly", "Gluten-Free", "Vegetarian", "Low Calorie"],
    ingredients: [
      { name: "cucumber", quantity: 8, unit: "slice", notes: "thick slices" },
      { name: "cream cheese", quantity: 2, unit: "tbsp", notes: "whipped" },
      { name: "fresh dill", quantity: 1, unit: "tsp" },
      { name: "cherry tomatoes", quantity: 4, unit: "each", notes: "small, halved" },
      { name: "everything bagel seasoning", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Slice cucumber into thick rounds",
      "Mix cream cheese with fresh dill",
      "Top each cucumber slice with cream cheese",
      "Add half a cherry tomato on top",
      "Sprinkle with everything bagel seasoning",
      "Serve immediately or chill"
    ],
    nutrition: { calories: 135, protein: 4, carbs: 8, fat: 10 }
  },
  {
    id: "edamame-sea-salt",
    name: "Edamame with Sea Salt",
    description: "Steamed edamame pods sprinkled with sea salt",
    cuisine: "Asian",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Vegan", "High Protein", "High Fiber", "Gluten-Free", "Low Calorie"],
    ingredients: [
      { name: "edamame pods", quantity: 1, unit: "cup", notes: "frozen" },
      { name: "sea salt", quantity: 0.5, unit: "tsp" },
      { name: "sesame oil", quantity: 0.5, unit: "tsp" },
      { name: "red pepper flakes", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Boil edamame pods for 5 minutes",
      "Drain well",
      "Toss with sesame oil while hot",
      "Sprinkle with sea salt and red pepper flakes",
      "Serve warm",
      "Eat by squeezing beans out of pods"
    ],
    nutrition: { calories: 155, protein: 12, carbs: 12, fat: 6 }
  },
  {
    id: "turkey-cheese-roll-ups",
    name: "Turkey & Cheese Roll-Ups",
    description: "Deli turkey rolled with cheese and vegetables",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Low Carb", "Keto-Friendly", "Gluten-Free", "Portable"],
    ingredients: [
      { name: "sliced turkey breast", quantity: 3, unit: "slice" },
      { name: "Swiss cheese slices", quantity: 2, unit: "slice" },
      { name: "cucumber sticks", quantity: 3, unit: "stick" },
      { name: "mustard", quantity: 1, unit: "tsp" },
      { name: "lettuce leaves", quantity: 3, unit: "leaf", notes: "small" }
    ],
    instructions: [
      "Lay turkey slices flat",
      "Spread thin layer of mustard on each",
      "Place cheese slice on turkey",
      "Add lettuce and cucumber stick",
      "Roll tightly and secure with toothpick",
      "Serve immediately or refrigerate"
    ],
    nutrition: { calories: 175, protein: 20, carbs: 4, fat: 9 }
  },
  {
    id: "cottage-cheese-pineapple",
    name: "Cottage Cheese with Pineapple",
    description: "Creamy cottage cheese with sweet pineapple chunks",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Probiotic", "Gluten-Free", "Vegetarian", "Low Fat"],
    ingredients: [
      { name: "cottage cheese", quantity: 0.75, unit: "cup", notes: "low-fat" },
      { name: "fresh pineapple chunks", quantity: 0.25, unit: "cup" },
      { name: "sunflower seeds", quantity: 1, unit: "tbsp" },
      { name: "cinnamon", quantity: 1, unit: "pinch" },
      { name: "honey", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Place cottage cheese in serving bowl",
      "Top with fresh pineapple chunks",
      "Sprinkle with sunflower seeds",
      "Dust with cinnamon",
      "Drizzle with honey if desired",
      "Serve chilled"
    ],
    nutrition: { calories: 195, protein: 22, carbs: 18, fat: 5 }
  },
  {
    id: "avocado-toast-mini",
    name: "Mini Avocado Toast",
    description: "Small piece of whole grain toast with mashed avocado",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Vegan Option", "Anti-Inflammatory", "High Fiber"],
    ingredients: [
      { name: "whole grain bread", quantity: 1, unit: "slice", notes: "small slice" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "medium" },
      { name: "lemon juice", quantity: 0.5, unit: "tsp" },
      { name: "red pepper flakes", quantity: 1, unit: "pinch" },
      { name: "sea salt", quantity: 1, unit: "pinch" },
      { name: "hemp seeds", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Toast bread until golden",
      "Mash avocado with lemon juice and salt",
      "Spread avocado on toast",
      "Sprinkle with red pepper flakes and hemp seeds",
      "Cut into triangles if desired",
      "Serve immediately"
    ],
    nutrition: { calories: 165, protein: 5, carbs: 18, fat: 9 }
  },
  {
    id: "protein-smoothie-mini",
    name: "Mini Protein Smoothie",
    description: "Small protein-packed smoothie for energy boost",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: false,
    healthBadges: ["High Protein", "Low Sugar", "Dairy-Free Option", "Energy Boost"],
    ingredients: [
      { name: "protein powder", quantity: 0.5, unit: "scoop", notes: "vanilla" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "small" },
      { name: "almond milk", quantity: 0.75, unit: "cup", notes: "unsweetened" },
      { name: "spinach", quantity: 0.25, unit: "cup" },
      { name: "almond butter", quantity: 1, unit: "tsp" },
      { name: "ice cubes", quantity: 3, unit: "each" }
    ],
    instructions: [
      "Add almond milk to blender",
      "Add banana, spinach, and protein powder",
      "Add almond butter and ice",
      "Blend until smooth and creamy",
      "Pour into small glass",
      "Drink immediately for best taste"
    ],
    nutrition: { calories: 185, protein: 16, carbs: 20, fat: 5 }
  },
  {
    id: "dark-chocolate-almonds",
    name: "Dark Chocolate Covered Almonds",
    description: "Antioxidant-rich dark chocolate with crunchy almonds",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Heart-Healthy", "Antioxidant-Rich", "Vegan", "Energy Boost"],
    ingredients: [
      { name: "dark chocolate", quantity: 1, unit: "oz", notes: "70% cacao" },
      { name: "whole almonds", quantity: 15, unit: "each" },
      { name: "sea salt flakes", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Purchase pre-made dark chocolate almonds OR",
      "Melt dark chocolate in microwave",
      "Toss almonds in melted chocolate",
      "Place on parchment paper",
      "Sprinkle with sea salt",
      "Refrigerate 10 minutes to set"
    ],
    nutrition: { calories: 235, protein: 6, carbs: 18, fat: 18 }
  },
  {
    id: "string-cheese-cherry-tomatoes",
    name: "String Cheese with Cherry Tomatoes",
    description: "Portable snack of string cheese and fresh tomatoes",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Portable", "Gluten-Free", "Vegetarian", "Low Carb"],
    ingredients: [
      { name: "string cheese", quantity: 1, unit: "stick", notes: "mozzarella" },
      { name: "cherry tomatoes", quantity: 8, unit: "each", notes: "small" },
      { name: "fresh basil leaves", quantity: 4, unit: "leaf" },
      { name: "balsamic glaze", quantity: 1, unit: "tsp" },
      { name: "black pepper", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Peel string cheese into strips or leave whole",
      "Wash cherry tomatoes",
      "Arrange cheese and tomatoes on plate",
      "Tuck basil leaves between items",
      "Drizzle with balsamic glaze",
      "Season with black pepper"
    ],
    nutrition: { calories: 135, protein: 10, carbs: 8, fat: 8 }
  },
  {
    id: "rice-cakes-peanut-butter",
    name: "Rice Cakes with Peanut Butter",
    description: "Crispy rice cakes topped with natural peanut butter and banana",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Gluten-Free", "Energy Boost", "Vegan Option", "Heart-Healthy"],
    ingredients: [
      { name: "rice cakes", quantity: 2, unit: "each", notes: "plain" },
      { name: "natural peanut butter", quantity: 2, unit: "tbsp" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "small, sliced" },
      { name: "cinnamon", quantity: 1, unit: "pinch" },
      { name: "honey", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Spread peanut butter on each rice cake",
      "Top with banana slices",
      "Sprinkle with cinnamon",
      "Drizzle with honey if desired",
      "Serve immediately for best crunch",
      "Can be made ahead and wrapped"
    ],
    nutrition: { calories: 265, protein: 9, carbs: 32, fat: 12 }
  },
  {
    id: "caprese-skewers-mini",
    name: "Mini Caprese Skewers",
    description: "Bite-sized skewers with mozzarella, tomato, and basil",
    cuisine: "Italian",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Low Carb", "Vegetarian", "Gluten-Free", "Mediterranean Diet"],
    ingredients: [
      { name: "cherry tomatoes", quantity: 6, unit: "each", notes: "small" },
      { name: "mini mozzarella balls", quantity: 6, unit: "each" },
      { name: "fresh basil leaves", quantity: 6, unit: "leaf" },
      { name: "balsamic glaze", quantity: 1, unit: "tsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "sea salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Thread tomato, basil, and mozzarella on toothpicks",
      "Repeat for 6 skewers",
      "Arrange on serving plate",
      "Drizzle with olive oil and balsamic glaze",
      "Sprinkle with sea salt",
      "Serve at room temperature"
    ],
    nutrition: { calories: 165, protein: 10, carbs: 8, fat: 12 }
  },
  {
    id: "roasted-chickpeas-spiced",
    name: "Spiced Roasted Chickpeas",
    description: "Crunchy roasted chickpeas with savory spices",
    cuisine: "Mediterranean",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Vegan", "High Fiber", "High Protein", "Gluten-Free", "Crunchy"],
    ingredients: [
      { name: "chickpeas", quantity: 0.5, unit: "cup", notes: "cooked, drained" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "paprika", quantity: 0.25, unit: "tsp" },
      { name: "cumin", quantity: 0.25, unit: "tsp" },
      { name: "garlic powder", quantity: 0.125, unit: "tsp" },
      { name: "sea salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Preheat oven to 400°F",
      "Pat chickpeas dry with paper towel",
      "Toss with olive oil and spices",
      "Spread on baking sheet in single layer",
      "Roast 20-25 minutes until crispy",
      "Let cool slightly before eating"
    ],
    nutrition: { calories: 155, protein: 7, carbs: 22, fat: 5 }
  },
  {
    id: "celery-almond-butter",
    name: "Celery Sticks with Almond Butter",
    description: "Crunchy celery filled with creamy almond butter",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Low Carb", "Vegan", "Gluten-Free", "Heart-Healthy", "Low Calorie"],
    ingredients: [
      { name: "celery stalks", quantity: 3, unit: "stalk" },
      { name: "almond butter", quantity: 2, unit: "tbsp" },
      { name: "raisins", quantity: 1, unit: "tbsp" },
      { name: "hemp seeds", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Wash celery and cut into 3-inch pieces",
      "Fill celery groove with almond butter",
      "Top with raisins (ants on a log style)",
      "Sprinkle with hemp seeds",
      "Arrange on plate",
      "Serve immediately or refrigerate"
    ],
    nutrition: { calories: 215, protein: 6, carbs: 18, fat: 15 }
  },
  {
    id: "tuna-cucumber-bites",
    name: "Tuna Cucumber Bites",
    description: "Light tuna salad on cucumber rounds",
    cuisine: "American",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["High Protein", "Low Carb", "Omega-3 Rich", "Gluten-Free", "Pescatarian"],
    ingredients: [
      { name: "cucumber", quantity: 8, unit: "slice", notes: "thick slices" },
      { name: "canned tuna", quantity: 2, unit: "oz", notes: "in water" },
      { name: "Greek yogurt", quantity: 1, unit: "tbsp" },
      { name: "Dijon mustard", quantity: 0.5, unit: "tsp" },
      { name: "fresh dill", quantity: 1, unit: "tsp" },
      { name: "paprika", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Slice cucumber into thick rounds",
      "Mix tuna with Greek yogurt, mustard, and dill",
      "Top each cucumber slice with tuna mixture",
      "Sprinkle with paprika",
      "Chill before serving if desired",
      "Serve as elegant finger food"
    ],
    nutrition: { calories: 125, protein: 16, carbs: 6, fat: 4 }
  },
  {
    id: "guacamole-veggie-chips",
    name: "Guacamole with Veggie Chips",
    description: "Fresh guacamole with crunchy vegetable chips",
    cuisine: "Mexican",
    category: "snack",
    baseServings: 1,
    fingerFood: true,
    healthBadges: ["Vegan", "Heart-Healthy", "Anti-Inflammatory", "Gluten-Free"],
    ingredients: [
      { name: "ripe avocado", quantity: 0.5, unit: "each", notes: "medium" },
      { name: "lime juice", quantity: 1, unit: "tsp" },
      { name: "diced tomato", quantity: 2, unit: "tbsp" },
      { name: "red onion", quantity: 1, unit: "tbsp", notes: "minced" },
      { name: "cilantro", quantity: 1, unit: "tbsp", notes: "chopped" },
      { name: "veggie chips", quantity: 1, unit: "oz" }
    ],
    instructions: [
      "Mash avocado in small bowl",
      "Mix in lime juice, tomato, onion, and cilantro",
      "Season with salt and pepper",
      "Serve with veggie chips for dipping",
      "Eat immediately to prevent browning",
      "Press plastic wrap on surface if storing"
    ],
    nutrition: { calories: 245, protein: 4, carbs: 22, fat: 17 }
  }
];
