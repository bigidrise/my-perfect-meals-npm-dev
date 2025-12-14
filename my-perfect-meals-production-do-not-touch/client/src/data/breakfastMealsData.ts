// client/src/data/breakfastMealsData.ts
// 3 Breakfast Meals × 3 Templates (Classic, Light, High-Protein)

export type Ingredient = { item: string; quantity: number; unit: string };
export type MealTemplate = {
  slug: string;
  name: string;
  description: string;
  healthBadges: string[];
  ingredients: Ingredient[];
  instructions: string[];
};
export type BreakfastMeal = {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  image: string;
  templates: {
    classic: MealTemplate;
    light: MealTemplate;
    highProtein: MealTemplate;
  };
};

export const breakfastMeals: BreakfastMeal[] = [
  // 1) Greek Yogurt Parfait
  {
    id: "breakfast-greek-yogurt-parfait",
    slug: "breakfast-greek-yogurt-parfait",
    name: "Greek Yogurt Parfait",
    description: "Healthy and delicious parfait with yogurt, berries, and granola",
    baseServings: 2,
    image: "/images/templates/hphc-yogurt-parfait.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Parfait",
        description: "Layers of yogurt, berries, and crunchy granola.",
        healthBadges: ["Vegetarian", "High Protein"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 2, unit: "cups" },
          { item: "Mixed berries", quantity: 1, unit: "cup" },
          { item: "Granola", quantity: 0.5, unit: "cup" },
          { item: "Honey or maple", quantity: 2, unit: "tsp" }
        ],
        instructions: [
          "Spoon half the yogurt into two bowls or glasses.",
          "Layer berries and granola, then the remaining yogurt.",
          "Drizzle honey on top and serve."
        ]
      },
      light: {
        slug: "light",
        name: "Light Parfait",
        description: "Lower-calorie parfait with extra fruit and less granola.",
        healthBadges: ["Vegetarian", "Low Fat"],
        ingredients: [
          { item: "Nonfat Greek yogurt", quantity: 2, unit: "cups" },
          { item: "Mixed berries", quantity: 1.5, unit: "cups" },
          { item: "Granola", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Layer yogurt with berries; finish with a light sprinkle of granola.",
          "Serve immediately."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "High-Protein Parfait",
        description: "Protein-boosted yogurt with chia and seeds.",
        healthBadges: ["Vegetarian", "High Protein"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 2, unit: "cups" },
          { item: "Whey or plant protein (vanilla)", quantity: 1, unit: "scoop" },
          { item: "Mixed berries", quantity: 1, unit: "cup" },
          { item: "Chia seeds", quantity: 2, unit: "tbsp" },
          { item: "Granola", quantity: 0.33, unit: "cup" }
        ],
        instructions: [
          "Whisk protein powder into yogurt until smooth.",
          "Layer with berries, chia, and granola; serve."
        ]
      }
    }
  },

  // 2) Breakfast Burrito
  {
    id: "breakfast-burrito",
    slug: "breakfast-burrito",
    name: "Breakfast Burrito",
    description: "Hearty burrito filled with eggs, vegetables, and cheese",
    baseServings: 2,
    image: "/images/templates/hphc-breakfast-burrito.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Burrito",
        description: "Traditional breakfast burrito with eggs, cheese, and peppers.",
        healthBadges: ["High Protein", "Vegetarian"],
        ingredients: [
          { item: "Large flour tortillas", quantity: 2, unit: "pieces" },
          { item: "Eggs", quantity: 4, unit: "large" },
          { item: "Cheddar cheese, shredded", quantity: 0.5, unit: "cup" },
          { item: "Bell pepper, diced", quantity: 0.5, unit: "cup" },
          { item: "Onion, diced", quantity: 0.25, unit: "cup" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Heat oil in a pan and sauté peppers and onions until soft.",
          "Scramble eggs and mix with vegetables.",
          "Fill tortillas with egg mixture and cheese, roll tightly.",
          "Optional: Toast burrito in pan for 1-2 minutes per side."
        ]
      },
      light: {
        slug: "light",
        name: "Light Burrito",
        description: "Lower-calorie version with egg whites and whole wheat tortilla.",
        healthBadges: ["Low Fat", "High Protein"],
        ingredients: [
          { item: "Whole wheat tortillas", quantity: 2, unit: "pieces" },
          { item: "Egg whites", quantity: 6, unit: "large" },
          { item: "Low-fat cheese", quantity: 0.25, unit: "cup" },
          { item: "Bell pepper, diced", quantity: 0.75, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Spray pan and sauté peppers until tender.",
          "Add spinach and cook until wilted.",
          "Scramble egg whites with vegetables.",
          "Fill tortillas and roll, serve immediately."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "High-Protein Burrito",
        description: "Protein-packed burrito with extra eggs and black beans.",
        healthBadges: ["High Protein", "High Fiber"],
        ingredients: [
          { item: "Large flour tortillas", quantity: 2, unit: "pieces" },
          { item: "Eggs", quantity: 6, unit: "large" },
          { item: "Black beans, cooked", quantity: 0.5, unit: "cup" },
          { item: "Cheddar cheese", quantity: 0.5, unit: "cup" },
          { item: "Avocado, sliced", quantity: 0.5, unit: "medium" },
          { item: "Salsa", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Scramble eggs until fluffy.",
          "Warm black beans in a small pan.",
          "Fill tortillas with eggs, beans, cheese, and avocado.",
          "Top with salsa and roll tightly."
        ]
      }
    }
  },

  // 3) Avocado Toast
  {
    id: "breakfast-avocado-toast",
    slug: "breakfast-avocado-toast",
    name: "Avocado Toast",
    description: "Creamy avocado on toasted bread with various toppings",
    baseServings: 2,
    image: "/images/templates/bal-avocado-toast.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Avocado Toast",
        description: "Simple avocado toast with lemon and salt.",
        healthBadges: ["Vegetarian", "Healthy Fats"],
        ingredients: [
          { item: "Whole grain bread", quantity: 2, unit: "slices" },
          { item: "Ripe avocado", quantity: 1, unit: "large" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Sea salt", quantity: 0.25, unit: "tsp" },
          { item: "Black pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Toast bread until golden brown.",
          "Mash avocado with lemon juice, salt, and pepper.",
          "Spread avocado mixture on toast.",
          "Serve immediately."
        ]
      },
      light: {
        slug: "light",
        name: "Light Avocado Toast",
        description: "Lower-calorie version with extra vegetables.",
        healthBadges: ["Vegetarian", "Low Calorie"],
        ingredients: [
          { item: "Thin whole grain bread", quantity: 2, unit: "slices" },
          { item: "Ripe avocado", quantity: 0.5, unit: "large" },
          { item: "Cherry tomatoes, halved", quantity: 0.5, unit: "cup" },
          { item: "Cucumber, sliced", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Everything seasoning", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Toast bread lightly.",
          "Mash avocado with lemon juice.",
          "Spread thin layer of avocado on toast.",
          "Top with tomatoes, cucumber, and seasoning."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "High-Protein Avocado Toast",
        description: "Avocado toast topped with eggs for extra protein.",
        healthBadges: ["High Protein", "Healthy Fats"],
        ingredients: [
          { item: "Whole grain bread", quantity: 2, unit: "slices" },
          { item: "Ripe avocado", quantity: 1, unit: "large" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Feta cheese, crumbled", quantity: 2, unit: "tbsp" },
          { item: "Red pepper flakes", quantity: 1, unit: "pinch" },
          { item: "Olive oil", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Toast bread until golden.",
          "Fry or poach eggs to your liking.",
          "Mash avocado and spread on toast.",
          "Top with eggs, feta, and red pepper flakes.",
          "Drizzle with olive oil."
        ]
      }
    }
  },

  // NEW BREAKFAST MEALS
  {
    id: "tofu-scramble-wrap",
    slug: "tofu-scramble-wrap",
    name: "Tofu Scramble Wrap",
    description: "Protein-packed tofu scramble wrapped in whole-wheat tortilla",
    baseServings: 1,
    image: "/images/templates/tofu-scramble-wrap.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Tofu Scramble",
        description: "Traditional tofu scramble with vegetables in a wrap.",
        healthBadges: ["Vegan", "High Protein", "Quick"],
        ingredients: [
          { item: "Firm tofu, crumbled", quantity: 4, unit: "oz" },
          { item: "Bell peppers, diced", quantity: 0.5, unit: "cup" },
          { item: "Onions, diced", quantity: 0.5, unit: "cup" },
          { item: "Whole-wheat tortilla", quantity: 1, unit: "large" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" },
          { item: "Turmeric", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Sauté vegetables for 3-4 minutes until soft.",
          "Add tofu, nutritional yeast, and turmeric.",
          "Cook for 3 minutes, stirring frequently.",
          "Wrap mixture in tortilla and serve warm."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Scramble",
        description: "Lower calorie version with extra vegetables.",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Firm tofu, crumbled", quantity: 3, unit: "oz" },
          { item: "Mixed vegetables", quantity: 1, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Small whole-wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Nutritional yeast", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use more vegetables and less tofu.",
          "Add spinach at the end for extra nutrients.",
          "Use smaller tortilla to reduce calories.",
          "Season with herbs and spices."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Scramble",
        description: "Extra tofu with protein additions.",
        healthBadges: ["Vegan", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Firm tofu, crumbled", quantity: 6, unit: "oz" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Large whole-wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Tahini", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra tofu for maximum protein.",
          "Add hemp seeds and tahini for complete amino acids.",
          "Season generously with nutritional yeast.",
          "Perfect for post-workout recovery."
        ]
      }
    }
  },

  {
    id: "overnight-oats-pb-chia",
    slug: "overnight-oats-pb-chia",
    name: "Overnight Oats (PB + Chia)",
    description: "Make-ahead oats with peanut butter and chia seeds",
    baseServings: 1,
    image: "/images/templates/overnight-oats-pb.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic PB Oats",
        description: "Traditional overnight oats with peanut butter.",
        healthBadges: ["Vegan", "Make Ahead", "High Fiber"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.5, unit: "cup" },
          { item: "Plant milk", quantity: 0.75, unit: "cup" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" },
          { item: "Peanut butter", quantity: 1, unit: "tbsp" },
          { item: "Maple syrup", quantity: 1, unit: "tsp" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Mix all ingredients in a jar.",
          "Stir well to combine evenly.",
          "Refrigerate overnight or at least 4 hours.",
          "Stir before serving and add toppings if desired."
        ]
      },
      light: {
        slug: "light",
        name: "Light Chia Oats",
        description: "Lower calorie version with more chia seeds.",
        healthBadges: ["Vegan", "Low Calorie", "High Omega-3"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.33, unit: "cup" },
          { item: "Unsweetened almond milk", quantity: 1, unit: "cup" },
          { item: "Chia seeds", quantity: 2, unit: "tbsp" },
          { item: "Powdered peanut butter", quantity: 1, unit: "tbsp" },
          { item: "Stevia", quantity: 1, unit: "packet" }
        ],
        instructions: [
          "Use powdered peanut butter to reduce calories.",
          "Add extra chia seeds for volume and nutrition.",
          "Sweeten naturally with stevia.",
          "Let set longer for thicker consistency."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Oats",
        description: "Extra protein with protein powder and nuts.",
        healthBadges: ["Vegan", "Very High Protein", "Post Workout"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.5, unit: "cup" },
          { item: "Protein powder (vanilla)", quantity: 0.5, unit: "scoop" },
          { item: "Plant milk", quantity: 1, unit: "cup" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" },
          { item: "Hemp hearts", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder with milk first.",
          "Add all other ingredients and stir well.",
          "Use almond butter for extra protein and healthy fats.",
          "Perfect overnight recovery meal."
        ]
      }
    }
  },

  {
    id: "yogurt-protein-bowl",
    slug: "yogurt-protein-bowl",
    name: "Greek Yogurt Protein Bowl",
    description: "High-protein yogurt bowl with berries and granola",
    baseServings: 1,
    image: "/images/templates/yogurt-protein-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Protein Bowl",
        description: "Traditional yogurt bowl with berries and granola.",
        healthBadges: ["Vegetarian", "High Protein", "Probiotic"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 1, unit: "cup" },
          { item: "Mixed berries", quantity: 1, unit: "cup" },
          { item: "Granola", quantity: 0.33, unit: "cup" },
          { item: "Honey", quantity: 1, unit: "tbsp" },
          { item: "Chopped almonds", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Layer yogurt in bowl.",
          "Top with berries and granola.",
          "Drizzle with honey.",
          "Sprinkle with almonds and serve."
        ]
      },
      light: {
        slug: "light",
        name: "Light Berry Bowl",
        description: "Lower calorie version with extra berries.",
        healthBadges: ["Vegetarian", "Low Fat", "Antioxidant Rich"],
        ingredients: [
          { item: "Non-fat Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Fresh berries", quantity: 1.5, unit: "cups" },
          { item: "Low-fat granola", quantity: 2, unit: "tbsp" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "packet" }
        ],
        instructions: [
          "Use non-fat yogurt for fewer calories.",
          "Load with extra berries for volume.",
          "Use minimal granola for crunch.",
          "Sweeten naturally with stevia and cinnamon."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Power Protein Bowl",
        description: "Extra protein with protein powder and nuts.",
        healthBadges: ["Vegetarian", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 1.25, unit: "cups" },
          { item: "Protein powder (vanilla)", quantity: 0.5, unit: "scoop" },
          { item: "Mixed berries", quantity: 0.75, unit: "cup" },
          { item: "Protein granola", quantity: 0.33, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder into yogurt until smooth.",
          "Use extra yogurt for maximum protein.",
          "Add protein-enriched granola.",
          "Top with chia seeds for complete amino acids."
        ]
      }
    }
  },

  {
    id: "egg-avocado-toast",
    slug: "egg-avocado-toast",
    name: "Egg + Avocado Toast",
    description: "Classic avocado toast topped with perfectly cooked egg",
    baseServings: 1,
    image: "/images/templates/egg-avocado-toast.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Egg Avocado Toast",
        description: "Traditional avocado toast with fried egg.",
        healthBadges: ["Vegetarian", "High Protein", "Healthy Fats"],
        ingredients: [
          { item: "Whole-grain bread", quantity: 2, unit: "slices" },
          { item: "Ripe avocado", quantity: 0.5, unit: "large" },
          { item: "Eggs", quantity: 1, unit: "large" },
          { item: "Cherry tomatoes", quantity: 0.25, unit: "cup" },
          { item: "Everything seasoning", quantity: 0.5, unit: "tsp" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Toast bread until golden brown.",
          "Mash avocado with lemon juice.",
          "Fry egg to your preference.",
          "Spread avocado on toast, top with egg.",
          "Garnish with tomatoes and seasoning."
        ]
      },
      light: {
        slug: "light",
        name: "Light Avocado Toast",
        description: "Lower calorie version with egg whites.",
        healthBadges: ["Vegetarian", "Low Calorie", "High Protein"],
        ingredients: [
          { item: "Thin whole-grain bread", quantity: 1, unit: "slice" },
          { item: "Avocado", quantity: 0.25, unit: "large" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Tomato", quantity: 2, unit: "slices" },
          { item: "Hot sauce", quantity: 1, unit: "dash" }
        ],
        instructions: [
          "Use one slice of bread to reduce calories.",
          "Use egg whites instead of whole eggs.",
          "Add spinach for extra nutrients.",
          "Season with hot sauce instead of salt."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Toast",
        description: "Extra protein with multiple eggs and cheese.",
        healthBadges: ["Vegetarian", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Protein bread", quantity: 2, unit: "slices" },
          { item: "Avocado", quantity: 0.75, unit: "large" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use protein bread for extra protein.",
          "Add cottage cheese layer for more protein.",
          "Use two eggs instead of one.",
          "Top with hemp seeds for complete amino acids."
        ]
      }
    }
  },

  {
    id: "pb-banana-pinwheels",
    slug: "pb-banana-pinwheels",
    name: "PB Banana Pinwheels",
    description: "Fun finger-food breakfast with peanut butter and banana",
    baseServings: 1,
    image: "/images/templates/pb-banana-pinwheels.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic PB Pinwheels",
        description: "Traditional peanut butter and banana roll-ups.",
        healthBadges: ["Vegetarian", "Kid-Friendly", "Portable"],
        ingredients: [
          { item: "Whole-wheat tortilla", quantity: 1, unit: "large" },
          { item: "Peanut butter", quantity: 1.5, unit: "tbsp" },
          { item: "Banana", quantity: 1, unit: "medium" },
          { item: "Honey", quantity: 0.5, unit: "tsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Spread peanut butter evenly on tortilla.",
          "Place banana on one edge and drizzle with honey.",
          "Sprinkle with cinnamon.",
          "Roll tightly and slice into pinwheels."
        ]
      },
      light: {
        slug: "light",
        name: "Light Banana Wraps",
        description: "Lower calorie version with powdered peanut butter.",
        healthBadges: ["Vegetarian", "Low Calorie", "Natural Sweetness"],
        ingredients: [
          { item: "Small whole-wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Powdered peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Water", quantity: 1, unit: "tbsp" },
          { item: "Large banana", quantity: 1, unit: "whole" },
          { item: "Stevia", quantity: 1, unit: "packet" }
        ],
        instructions: [
          "Mix powdered peanut butter with water.",
          "Use larger banana for more volume.",
          "Sweeten naturally with stevia.",
          "Roll tightly for neat pinwheels."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Pinwheels",
        description: "Extra protein with protein powder and seeds.",
        healthBadges: ["Vegetarian", "High Protein", "Sustained Energy"],
        ingredients: [
          { item: "Protein tortilla", quantity: 1, unit: "large" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Protein powder (vanilla)", quantity: 0.25, unit: "scoop" },
          { item: "Banana", quantity: 1, unit: "medium" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" },
          { item: "Hemp hearts", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Mix protein powder into almond butter.",
          "Use protein-enriched tortilla.",
          "Sprinkle with chia seeds and hemp hearts.",
          "Perfect pre or post-workout snack."
        ]
      }
    }
  },

  {
    id: "veggie-egg-scramble",
    slug: "veggie-egg-scramble",
    name: "Veggie Egg Scramble",
    description: "Fluffy scrambled eggs loaded with colorful vegetables",
    baseServings: 2,
    image: "/images/templates/veggie-scramble.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Scramble",
        description: "Traditional scrambled eggs with bell peppers and onions",
        healthBadges: ["High Protein", "Vegetarian", "Nutrient Dense"],
        ingredients: [
          { item: "Eggs", quantity: 4, unit: "large" },
          { item: "Bell peppers, diced", quantity: 0.5, unit: "cup" },
          { item: "Onions, diced", quantity: 0.25, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Cheese, shredded", quantity: 0.25, unit: "cup" },
          { item: "Butter", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Sauté vegetables in butter until soft.",
          "Whisk eggs and pour into pan.",
          "Scramble until fluffy, add cheese.",
          "Serve hot with whole wheat toast."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Scramble",
        description: "Egg whites with extra vegetables for fewer calories",
        healthBadges: ["Low Fat", "High Protein", "Low Calorie"],
        ingredients: [
          { item: "Egg whites", quantity: 6, unit: "large" },
          { item: "Mushrooms, sliced", quantity: 1, unit: "cup" },
          { item: "Tomatoes, diced", quantity: 0.5, unit: "cup" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Spray pan with cooking spray.",
          "Sauté vegetables until tender.",
          "Add egg whites and scramble.",
          "Season with herbs instead of salt."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Power Protein Scramble",
        description: "Extra eggs with cottage cheese for maximum protein",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Whole eggs", quantity: 3, unit: "large" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Turkey sausage, crumbled", quantity: 2, unit: "oz" },
          { item: "Vegetables, mixed", quantity: 1, unit: "cup" }
        ],
        instructions: [
          "Cook turkey sausage first.",
          "Add vegetables and cook until soft.",
          "Scramble eggs and egg whites.",
          "Fold in cottage cheese before serving."
        ]
      }
    }
  },

  {
    id: "french-toast",
    slug: "french-toast",
    name: "French Toast",
    description: "Classic French toast with warm spices and toppings",
    baseServings: 2,
    image: "/images/templates/french-toast.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic French Toast",
        description: "Traditional French toast with maple syrup",
        healthBadges: ["Comfort Food", "Kid Friendly", "Weekend Favorite"],
        ingredients: [
          { item: "Whole wheat bread", quantity: 4, unit: "slices" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Milk", quantity: 0.25, unit: "cup" },
          { item: "Vanilla extract", quantity: 1, unit: "tsp" },
          { item: "Cinnamon", quantity: 1, unit: "tsp" },
          { item: "Maple syrup", quantity: 2, unit: "tbsp" },
          { item: "Butter", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Whisk eggs, milk, vanilla, and cinnamon.",
          "Dip bread slices in egg mixture.",
          "Cook in butter until golden on both sides.",
          "Serve with maple syrup and fresh berries."
        ]
      },
      light: {
        slug: "light",
        name: "Light French Toast",
        description: "Lower calorie version with almond milk and sugar-free syrup",
        healthBadges: ["Lower Calorie", "Reduced Sugar", "Heart Healthy"],
        ingredients: [
          { item: "Thin whole wheat bread", quantity: 3, unit: "slices" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Unsweetened almond milk", quantity: 0.25, unit: "cup" },
          { item: "Vanilla extract", quantity: 1, unit: "tsp" },
          { item: "Cinnamon", quantity: 1, unit: "tsp" },
          { item: "Sugar-free syrup", quantity: 2, unit: "tbsp" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use egg whites and almond milk mixture.",
          "Cook with cooking spray instead of butter.",
          "Top with fresh berries and sugar-free syrup.",
          "Dust with cinnamon for extra flavor."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein French Toast",
        description: "Protein-packed version with protein bread and Greek yogurt",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Protein bread", quantity: 4, unit: "slices" },
          { item: "Eggs", quantity: 3, unit: "large" },
          { item: "Protein powder (vanilla)", quantity: 0.5, unit: "scoop" },
          { item: "Milk", quantity: 0.25, unit: "cup" },
          { item: "Greek yogurt topping", quantity: 0.5, unit: "cup" },
          { item: "Berries", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Mix eggs, milk, and protein powder.",
          "Dip protein bread in mixture.",
          "Cook until golden brown.",
          "Top with Greek yogurt and berries."
        ]
      }
    }
  },

  {
    id: "smoothie-bowl",
    slug: "smoothie-bowl",
    name: "Berry Smoothie Bowl",
    description: "Thick smoothie bowl topped with fresh fruit and granola",
    baseServings: 1,
    image: "/images/templates/smoothie-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Berry Bowl",
        description: "Traditional smoothie bowl with assorted toppings",
        healthBadges: ["Antioxidant Rich", "High Fiber", "Energizing"],
        ingredients: [
          { item: "Frozen mixed berries", quantity: 1, unit: "cup" },
          { item: "Banana, frozen", quantity: 0.5, unit: "medium" },
          { item: "Almond milk", quantity: 0.5, unit: "cup" },
          { item: "Granola", quantity: 0.25, unit: "cup" },
          { item: "Fresh berries", quantity: 0.25, unit: "cup" },
          { item: "Coconut flakes", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend frozen fruit with almond milk until thick.",
          "Pour into bowl.",
          "Top with granola, fresh fruit, coconut, and chia.",
          "Serve immediately."
        ]
      },
      light: {
        slug: "light",
        name: "Light Green Bowl",
        description: "Lower calorie with spinach and less toppings",
        healthBadges: ["Low Calorie", "Nutrient Dense", "Detox"],
        ingredients: [
          { item: "Frozen berries", quantity: 0.75, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Unsweetened almond milk", quantity: 0.75, unit: "cup" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Fresh fruit", quantity: 0.5, unit: "cup" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Blend with extra greens for nutrition.",
          "Keep toppings minimal.",
          "Focus on fresh fruit for sweetness.",
          "Add chia for texture and nutrition."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Bowl",
        description: "High protein version with protein powder and nut butter",
        healthBadges: ["Very High Protein", "Muscle Building", "Sustained Energy"],
        ingredients: [
          { item: "Frozen berries", quantity: 0.75, unit: "cup" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Protein granola", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend with protein powder and Greek yogurt.",
          "Add almond butter for richness.",
          "Top with protein granola and hemp seeds.",
          "Perfect post-workout meal."
        ]
      }
    }
  },

  {
    id: "breakfast-quesadilla",
    slug: "breakfast-quesadilla",
    name: "Breakfast Quesadilla",
    description: "Cheesy quesadilla filled with eggs and vegetables",
    baseServings: 1,
    image: "/images/templates/breakfast-quesadilla.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Breakfast Quesadilla",
        description: "Traditional quesadilla with eggs and cheese",
        healthBadges: ["High Protein", "Satisfying", "Quick Prep"],
        ingredients: [
          { item: "Whole wheat tortilla", quantity: 1, unit: "large" },
          { item: "Scrambled eggs", quantity: 2, unit: "large" },
          { item: "Cheddar cheese, shredded", quantity: 0.25, unit: "cup" },
          { item: "Black beans", quantity: 0.25, unit: "cup" },
          { item: "Salsa", quantity: 2, unit: "tbsp" },
          { item: "Avocado", quantity: 0.25, unit: "medium" }
        ],
        instructions: [
          "Place tortilla in pan.",
          "Add scrambled eggs, cheese, and beans on half.",
          "Fold and cook until cheese melts.",
          "Serve with salsa and avocado."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Quesadilla",
        description: "Lower calorie with egg whites and extra vegetables",
        healthBadges: ["Low Fat", "High Protein", "Veggie Packed"],
        ingredients: [
          { item: "Small whole wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Egg whites, scrambled", quantity: 3, unit: "large" },
          { item: "Low-fat cheese", quantity: 2, unit: "tbsp" },
          { item: "Spinach", quantity: 0.5, unit: "cup" },
          { item: "Tomatoes, diced", quantity: 0.25, unit: "cup" },
          { item: "Salsa", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use smaller tortilla and less cheese.",
          "Load with vegetables.",
          "Cook with cooking spray.",
          "Top with salsa for flavor."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Quesadilla",
        description: "Extra protein with additional eggs and meat",
        healthBadges: ["Very High Protein", "Muscle Building", "Filling"],
        ingredients: [
          { item: "Protein tortilla", quantity: 1, unit: "large" },
          { item: "Whole eggs", quantity: 2, unit: "large" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Turkey sausage, cooked", quantity: 2, unit: "oz" },
          { item: "Cheese", quantity: 0.25, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use protein tortilla for extra protein.",
          "Add turkey sausage for meat protein.",
          "Use mix of whole eggs and egg whites.",
          "Top with Greek yogurt instead of sour cream."
        ]
      }
    }
  },

  {
    id: "chia-pudding",
    slug: "chia-pudding",
    name: "Chia Seed Pudding",
    description: "Creamy overnight chia pudding with fresh toppings",
    baseServings: 1,
    image: "/images/templates/chia-pudding.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Chia Pudding",
        description: "Traditional chia pudding with vanilla and berries",
        healthBadges: ["High Fiber", "Omega-3 Rich", "Make Ahead"],
        ingredients: [
          { item: "Chia seeds", quantity: 3, unit: "tbsp" },
          { item: "Almond milk", quantity: 1, unit: "cup" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" },
          { item: "Maple syrup", quantity: 1, unit: "tbsp" },
          { item: "Fresh berries", quantity: 0.5, unit: "cup" },
          { item: "Sliced almonds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix chia seeds, milk, vanilla, and maple syrup.",
          "Refrigerate overnight or at least 4 hours.",
          "Stir before serving.",
          "Top with berries and almonds."
        ]
      },
      light: {
        slug: "light",
        name: "Light Chia Bowl",
        description: "Lower calorie with unsweetened milk",
        healthBadges: ["Low Calorie", "High Fiber", "Sugar Free"],
        ingredients: [
          { item: "Chia seeds", quantity: 2, unit: "tbsp" },
          { item: "Unsweetened almond milk", quantity: 1, unit: "cup" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Fresh berries", quantity: 0.75, unit: "cup" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use less chia seeds for fewer calories.",
          "Sweeten with stevia instead of maple syrup.",
          "Add extra berries for volume.",
          "Sprinkle with cinnamon."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Chia Power Bowl",
        description: "High protein with protein powder and Greek yogurt",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Post Workout"],
        ingredients: [
          { item: "Chia seeds", quantity: 3, unit: "tbsp" },
          { item: "Protein powder (vanilla)", quantity: 0.5, unit: "scoop" },
          { item: "Milk", quantity: 1, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder with milk first.",
          "Add chia seeds and refrigerate.",
          "Layer with Greek yogurt.",
          "Top with almond butter and hemp seeds."
        ]
      }
    }
  },

  {
    id: "breakfast-hash",
    slug: "breakfast-hash",
    name: "Sweet Potato Breakfast Hash",
    description: "Hearty hash with sweet potatoes, eggs, and vegetables",
    baseServings: 2,
    image: "/images/templates/breakfast-hash.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Breakfast Hash",
        description: "Traditional hash with sweet potatoes and eggs",
        healthBadges: ["High Fiber", "Balanced Meal", "Filling"],
        ingredients: [
          { item: "Sweet potato, diced", quantity: 1, unit: "large" },
          { item: "Bell peppers, diced", quantity: 0.5, unit: "cup" },
          { item: "Onions, diced", quantity: 0.25, unit: "cup" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Paprika", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Sauté sweet potatoes until tender.",
          "Add peppers and onions, cook until soft.",
          "Create wells and crack eggs on top.",
          "Cover and cook until eggs are set."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Hash",
        description: "Extra vegetables with fewer potatoes",
        healthBadges: ["Low Calorie", "Veggie Packed", "Nutrient Dense"],
        ingredients: [
          { item: "Sweet potato, diced", quantity: 0.5, unit: "medium" },
          { item: "Zucchini, diced", quantity: 1, unit: "cup" },
          { item: "Mushrooms, sliced", quantity: 1, unit: "cup" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Egg whites", quantity: 4, unit: "large" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use less sweet potato, more vegetables.",
          "Cook with cooking spray.",
          "Add spinach at the end.",
          "Top with egg whites for protein."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Hash",
        description: "Extra protein with turkey sausage and eggs",
        healthBadges: ["Very High Protein", "Muscle Building", "Satisfying"],
        ingredients: [
          { item: "Sweet potato, diced", quantity: 1, unit: "medium" },
          { item: "Turkey sausage, crumbled", quantity: 4, unit: "oz" },
          { item: "Vegetables, mixed", quantity: 1, unit: "cup" },
          { item: "Whole eggs", quantity: 2, unit: "large" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Black beans", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Cook turkey sausage first.",
          "Add sweet potatoes and vegetables.",
          "Top with eggs and beans.",
          "Perfect high-protein breakfast."
        ]
      }
    }
  },

  {
    id: "banana-pancakes",
    slug: "banana-pancakes",
    name: "Banana Oat Pancakes",
    description: "Healthy pancakes made with bananas and oats",
    baseServings: 2,
    image: "/images/templates/banana-pancakes.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Banana Pancakes",
        description: "Simple 3-ingredient pancakes",
        healthBadges: ["Gluten Free", "Natural Sweetness", "Quick Prep"],
        ingredients: [
          { item: "Ripe bananas, mashed", quantity: 2, unit: "medium" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Rolled oats", quantity: 0.5, unit: "cup" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" },
          { item: "Maple syrup", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Blend bananas, eggs, and oats until smooth.",
          "Add cinnamon and vanilla.",
          "Cook on griddle until bubbles form.",
          "Flip and cook until golden."
        ]
      },
      light: {
        slug: "light",
        name: "Light Banana Cakes",
        description: "Smaller portions with egg whites",
        healthBadges: ["Low Calorie", "Low Fat", "Natural Sweetness"],
        ingredients: [
          { item: "Ripe banana", quantity: 1, unit: "large" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Oat flour", quantity: 0.33, unit: "cup" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" },
          { item: "Berries for topping", quantity: 0.5, unit: "cup" },
          { item: "Sugar-free syrup", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use egg whites for fewer calories.",
          "Make smaller pancakes.",
          "Top with fresh berries.",
          "Use sugar-free syrup."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Banana Pancakes",
        description: "High protein with protein powder",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Bananas", quantity: 2, unit: "medium" },
          { item: "Eggs", quantity: 3, unit: "large" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Oat flour", quantity: 0.25, unit: "cup" },
          { item: "Greek yogurt topping", quantity: 0.5, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend all ingredients with protein powder.",
          "Make thick, fluffy pancakes.",
          "Top with Greek yogurt and almond butter.",
          "Perfect protein-packed breakfast."
        ]
      }
    }
  },

  {
    id: "bagel-lox",
    slug: "bagel-lox",
    name: "Bagel with Lox & Cream Cheese",
    description: "Classic New York style bagel with smoked salmon",
    baseServings: 1,
    image: "/images/templates/bagel-lox.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Lox Bagel",
        description: "Traditional bagel with all the fixings",
        healthBadges: ["Omega-3 Rich", "High Protein", "Restaurant Quality"],
        ingredients: [
          { item: "Whole wheat bagel", quantity: 1, unit: "whole" },
          { item: "Cream cheese", quantity: 2, unit: "tbsp" },
          { item: "Smoked salmon (lox)", quantity: 2, unit: "oz" },
          { item: "Red onion, sliced", quantity: 2, unit: "rings" },
          { item: "Capers", quantity: 1, unit: "tsp" },
          { item: "Tomato, sliced", quantity: 2, unit: "slices" },
          { item: "Fresh dill", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Toast bagel until golden.",
          "Spread cream cheese on both halves.",
          "Layer lox, onion, tomato, and capers.",
          "Garnish with fresh dill."
        ]
      },
      light: {
        slug: "light",
        name: "Light Lox Bagel",
        description: "Lighter version with less cream cheese",
        healthBadges: ["Lower Calorie", "Omega-3 Rich", "Protein Forward"],
        ingredients: [
          { item: "Thin whole wheat bagel", quantity: 1, unit: "whole" },
          { item: "Light cream cheese", quantity: 1, unit: "tbsp" },
          { item: "Smoked salmon", quantity: 3, unit: "oz" },
          { item: "Cucumber, sliced", quantity: 0.25, unit: "cup" },
          { item: "Tomato, sliced", quantity: 3, unit: "slices" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use thin bagel and light cream cheese.",
          "Add extra vegetables for volume.",
          "Use more salmon for protein.",
          "Squeeze lemon juice over top."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Lox Power Bagel",
        description: "Extra protein with additional salmon and eggs",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Protein bagel", quantity: 1, unit: "whole" },
          { item: "Greek yogurt cream cheese", quantity: 2, unit: "tbsp" },
          { item: "Smoked salmon", quantity: 4, unit: "oz" },
          { item: "Hard-boiled egg, sliced", quantity: 1, unit: "large" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Everything seasoning", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use protein bagel for extra protein.",
          "Add Greek yogurt cream cheese.",
          "Layer extra salmon and egg.",
          "Top with avocado and seasoning."
        ]
      }
    }
  },

  {
    id: "huevos-rancheros",
    slug: "huevos-rancheros",
    name: "Huevos Rancheros",
    description: "Mexican-style breakfast with eggs and salsa",
    baseServings: 2,
    image: "/images/templates/huevos-rancheros.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Huevos Rancheros",
        description: "Traditional Mexican breakfast with refried beans",
        healthBadges: ["High Protein", "Fiber Rich", "Spicy"],
        ingredients: [
          { item: "Corn tortillas", quantity: 2, unit: "pieces" },
          { item: "Eggs", quantity: 4, unit: "large" },
          { item: "Refried beans", quantity: 0.5, unit: "cup" },
          { item: "Salsa roja", quantity: 0.5, unit: "cup" },
          { item: "Avocado, sliced", quantity: 0.5, unit: "medium" },
          { item: "Cheese, crumbled", quantity: 2, unit: "tbsp" },
          { item: "Cilantro", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Warm tortillas and spread with refried beans.",
          "Fry eggs sunny-side up.",
          "Place eggs on tortillas.",
          "Top with salsa, avocado, cheese, and cilantro."
        ]
      },
      light: {
        slug: "light",
        name: "Light Huevos Rancheros",
        description: "Lighter version with black beans and egg whites",
        healthBadges: ["Low Fat", "High Fiber", "Protein Forward"],
        ingredients: [
          { item: "Corn tortillas", quantity: 2, unit: "pieces" },
          { item: "Egg whites", quantity: 6, unit: "large" },
          { item: "Black beans, mashed", quantity: 0.5, unit: "cup" },
          { item: "Fresh salsa", quantity: 0.75, unit: "cup" },
          { item: "Lime", quantity: 1, unit: "wedge" },
          { item: "Cilantro", quantity: 3, unit: "tbsp" }
        ],
        instructions: [
          "Use black beans instead of refried.",
          "Cook egg whites instead of whole eggs.",
          "Use plenty of fresh salsa.",
          "Squeeze lime for flavor."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Huevos Power",
        description: "Extra protein with chorizo and additional eggs",
        healthBadges: ["Very High Protein", "Muscle Building", "Satisfying"],
        ingredients: [
          { item: "Whole wheat tortillas", quantity: 2, unit: "pieces" },
          { item: "Whole eggs", quantity: 3, unit: "large" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Turkey chorizo", quantity: 2, unit: "oz" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Salsa", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Cook turkey chorizo first.",
          "Scramble eggs and egg whites.",
          "Layer on tortillas with beans.",
          "Top with salsa and Greek yogurt."
        ]
      }
    }
  },

  {
    id: "acai-bowl",
    slug: "acai-bowl",
    name: "Açaí Bowl",
    description: "Brazilian superfood bowl with tropical toppings",
    baseServings: 1,
    image: "/images/templates/acai-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Açaí Bowl",
        description: "Traditional açaí bowl with classic toppings",
        healthBadges: ["Antioxidant Rich", "Energizing", "Superfood"],
        ingredients: [
          { item: "Frozen açaí packet", quantity: 1, unit: "pack" },
          { item: "Banana, frozen", quantity: 0.5, unit: "medium" },
          { item: "Mixed berries", quantity: 0.5, unit: "cup" },
          { item: "Apple juice", quantity: 0.25, unit: "cup" },
          { item: "Granola", quantity: 0.25, unit: "cup" },
          { item: "Fresh fruit", quantity: 0.5, unit: "cup" },
          { item: "Honey", quantity: 1, unit: "tbsp" },
          { item: "Coconut flakes", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend açaí, frozen banana, berries, and juice.",
          "Blend until thick and smooth.",
          "Pour into bowl.",
          "Top with granola, fruit, honey, and coconut."
        ]
      },
      light: {
        slug: "light",
        name: "Light Açaí Bowl",
        description: "Lower calorie with more fruit and less granola",
        healthBadges: ["Lower Calorie", "Antioxidant Rich", "Natural Sweetness"],
        ingredients: [
          { item: "Frozen açaí packet", quantity: 1, unit: "pack" },
          { item: "Frozen berries", quantity: 1, unit: "cup" },
          { item: "Unsweetened almond milk", quantity: 0.5, unit: "cup" },
          { item: "Fresh berries", quantity: 0.75, unit: "cup" },
          { item: "Low-fat granola", quantity: 2, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Blend with almond milk for fewer calories.",
          "Use minimal granola.",
          "Load with fresh fruit.",
          "Add chia seeds for nutrition."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Açaí Power Bowl",
        description: "High protein with protein powder and nut butter",
        healthBadges: ["Very High Protein", "Antioxidant Rich", "Post Workout"],
        ingredients: [
          { item: "Frozen açaí packet", quantity: 1, unit: "pack" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Protein granola", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Berries", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Blend with protein powder and Greek yogurt.",
          "Add almond butter for richness.",
          "Top with protein granola and hemp seeds.",
          "Perfect high-protein breakfast."
        ]
      }
    }
  },

  {
    id: "english-muffin-breakfast",
    slug: "english-muffin-breakfast",
    name: "English Muffin Breakfast Sandwich",
    description: "Classic breakfast sandwich on toasted English muffin",
    baseServings: 1,
    image: "/images/templates/english-muffin.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Muffin Sandwich",
        description: "Traditional breakfast sandwich with egg and cheese",
        healthBadges: ["High Protein", "Portable", "Quick Prep"],
        ingredients: [
          { item: "Whole wheat English muffin", quantity: 1, unit: "whole" },
          { item: "Egg, fried", quantity: 1, unit: "large" },
          { item: "Cheddar cheese", quantity: 1, unit: "slice" },
          { item: "Canadian bacon", quantity: 1, unit: "slice" },
          { item: "Tomato, sliced", quantity: 1, unit: "slice" },
          { item: "Butter", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Toast English muffin until golden.",
          "Fry egg and Canadian bacon.",
          "Layer egg, bacon, cheese, and tomato.",
          "Assemble sandwich and serve."
        ]
      },
      light: {
        slug: "light",
        name: "Light Muffin Sandwich",
        description: "Lighter version with egg whites and turkey",
        healthBadges: ["Low Fat", "High Protein", "Lower Calorie"],
        ingredients: [
          { item: "Whole wheat English muffin", quantity: 1, unit: "whole" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Low-fat cheese", quantity: 1, unit: "slice" },
          { item: "Turkey bacon", quantity: 1, unit: "slice" },
          { item: "Spinach", quantity: 0.25, unit: "cup" },
          { item: "Tomato", quantity: 2, unit: "slices" }
        ],
        instructions: [
          "Use egg whites instead of whole eggs.",
          "Cook turkey bacon until crispy.",
          "Add spinach and tomato for nutrients.",
          "Use low-fat cheese."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Sandwich",
        description: "Extra protein with additional eggs and meat",
        healthBadges: ["Very High Protein", "Muscle Building", "Filling"],
        ingredients: [
          { item: "Protein English muffin", quantity: 1, unit: "whole" },
          { item: "Whole eggs", quantity: 2, unit: "large" },
          { item: "Turkey sausage patty", quantity: 1, unit: "piece" },
          { item: "Cheese", quantity: 1, unit: "slice" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Greek yogurt spread", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein English muffin.",
          "Add two eggs for extra protein.",
          "Include turkey sausage patty.",
          "Spread Greek yogurt instead of mayo."
        ]
      }
    }
  },

  {
    id: "breakfast-tacos",
    slug: "breakfast-tacos",
    name: "Breakfast Tacos",
    description: "Tex-Mex style breakfast tacos with eggs and toppings",
    baseServings: 2,
    image: "/images/templates/breakfast-tacos.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Breakfast Tacos",
        description: "Traditional Tex-Mex breakfast tacos",
        healthBadges: ["High Protein", "Customizable", "Family Favorite"],
        ingredients: [
          { item: "Flour tortillas", quantity: 4, unit: "small" },
          { item: "Scrambled eggs", quantity: 4, unit: "large" },
          { item: "Cooked bacon, crumbled", quantity: 2, unit: "strips" },
          { item: "Shredded cheese", quantity: 0.25, unit: "cup" },
          { item: "Salsa", quantity: 0.25, unit: "cup" },
          { item: "Avocado, sliced", quantity: 0.5, unit: "medium" },
          { item: "Cilantro", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Warm tortillas on griddle.",
          "Scramble eggs until fluffy.",
          "Fill tortillas with eggs, bacon, cheese.",
          "Top with salsa, avocado, and cilantro."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Tacos",
        description: "Lighter version with corn tortillas and vegetables",
        healthBadges: ["Lower Calorie", "High Fiber", "Veggie Packed"],
        ingredients: [
          { item: "Corn tortillas", quantity: 4, unit: "small" },
          { item: "Egg whites, scrambled", quantity: 6, unit: "large" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Peppers and onions, sautéed", quantity: 0.5, unit: "cup" },
          { item: "Salsa", quantity: 0.5, unit: "cup" },
          { item: "Cilantro", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use corn tortillas for fewer calories.",
          "Fill with egg whites and vegetables.",
          "Add black beans for fiber.",
          "Top with plenty of salsa and cilantro."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Tacos",
        description: "Extra protein with chorizo and additional eggs",
        healthBadges: ["Very High Protein", "Muscle Building", "Satisfying"],
        ingredients: [
          { item: "Protein tortillas", quantity: 4, unit: "small" },
          { item: "Whole eggs", quantity: 3, unit: "large" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Turkey chorizo, cooked", quantity: 3, unit: "oz" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Cheese", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use protein tortillas.",
          "Mix whole eggs and egg whites.",
          "Add turkey chorizo for protein.",
          "Top with Greek yogurt and cheese."
        ]
      }
    }
  },

  {
    id: "cottage-cheese-pancakes",
    slug: "cottage-cheese-pancakes",
    name: "Cottage Cheese Pancakes",
    description: "Fluffy protein-packed pancakes with cottage cheese",
    baseServings: 2,
    image: "/images/templates/cottage-pancakes.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cottage Pancakes",
        description: "Fluffy pancakes with cottage cheese for extra protein",
        healthBadges: ["High Protein", "Calcium Rich", "Fluffy"],
        ingredients: [
          { item: "Cottage cheese", quantity: 0.5, unit: "cup" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Whole wheat flour", quantity: 0.5, unit: "cup" },
          { item: "Vanilla extract", quantity: 1, unit: "tsp" },
          { item: "Baking powder", quantity: 0.5, unit: "tsp" },
          { item: "Maple syrup", quantity: 2, unit: "tbsp" },
          { item: "Fresh berries", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Blend cottage cheese, eggs, and vanilla.",
          "Mix in flour and baking powder.",
          "Cook pancakes on griddle until bubbles form.",
          "Serve with maple syrup and berries."
        ]
      },
      light: {
        slug: "light",
        name: "Light Cottage Cakes",
        description: "Lower calorie with oat flour",
        healthBadges: ["Lower Calorie", "High Protein", "Gluten Free Option"],
        ingredients: [
          { item: "Low-fat cottage cheese", quantity: 0.5, unit: "cup" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Oat flour", quantity: 0.33, unit: "cup" },
          { item: "Vanilla extract", quantity: 1, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Fresh fruit", quantity: 0.75, unit: "cup" }
        ],
        instructions: [
          "Use low-fat cottage cheese.",
          "Replace whole eggs with egg whites.",
          "Use oat flour for fiber.",
          "Top with fresh fruit instead of syrup."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Cottage Power Cakes",
        description: "Maximum protein with protein powder",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Cottage cheese", quantity: 0.75, unit: "cup" },
          { item: "Eggs", quantity: 3, unit: "large" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Oat flour", quantity: 0.25, unit: "cup" },
          { item: "Greek yogurt topping", quantity: 0.5, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra cottage cheese.",
          "Add protein powder to batter.",
          "Make thick, fluffy pancakes.",
          "Top with Greek yogurt and almond butter."
        ]
      }
    }
  },

  {
    id: "shakshuka",
    slug: "shakshuka",
    name: "Shakshuka",
    description: "Middle Eastern eggs poached in spicy tomato sauce",
    baseServings: 2,
    image: "/images/templates/shakshuka.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Shakshuka",
        description: "Traditional North African breakfast with eggs and tomatoes",
        healthBadges: ["High Protein", "Antioxidant Rich", "One Pan"],
        ingredients: [
          { item: "Crushed tomatoes", quantity: 1, unit: "can" },
          { item: "Bell peppers, diced", quantity: 1, unit: "cup" },
          { item: "Onion, diced", quantity: 0.5, unit: "medium" },
          { item: "Garlic, minced", quantity: 3, unit: "cloves" },
          { item: "Eggs", quantity: 4, unit: "large" },
          { item: "Cumin", quantity: 1, unit: "tsp" },
          { item: "Paprika", quantity: 1, unit: "tsp" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" },
          { item: "Fresh parsley", quantity: 0.25, unit: "cup" },
          { item: "Whole wheat pita", quantity: 2, unit: "pieces" }
        ],
        instructions: [
          "Sauté onions, peppers, and garlic in olive oil.",
          "Add tomatoes and spices, simmer 10 minutes.",
          "Create wells and crack eggs into sauce.",
          "Cover and cook until eggs are set.",
          "Garnish with parsley and serve with pita."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Shakshuka",
        description: "Extra vegetables with fewer eggs",
        healthBadges: ["Low Calorie", "Veggie Packed", "High Fiber"],
        ingredients: [
          { item: "Crushed tomatoes", quantity: 1, unit: "can" },
          { item: "Zucchini, diced", quantity: 1, unit: "cup" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Bell peppers", quantity: 1, unit: "cup" },
          { item: "Eggs", quantity: 3, unit: "large" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Spices", quantity: 2, unit: "tsp" },
          { item: "Fresh herbs", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Add extra vegetables to sauce.",
          "Use mix of whole eggs and egg whites.",
          "Load with fresh herbs.",
          "Serve without pita to reduce calories."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Shakshuka",
        description: "Extra eggs with added chickpeas",
        healthBadges: ["Very High Protein", "High Fiber", "Muscle Building"],
        ingredients: [
          { item: "Crushed tomatoes", quantity: 1, unit: "can" },
          { item: "Chickpeas, cooked", quantity: 1, unit: "cup" },
          { item: "Vegetables, diced", quantity: 1, unit: "cup" },
          { item: "Whole eggs", quantity: 5, unit: "large" },
          { item: "Feta cheese, crumbled", quantity: 0.25, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Spices", quantity: 2, unit: "tsp" },
          { item: "Protein pita", quantity: 2, unit: "pieces" }
        ],
        instructions: [
          "Add chickpeas to sauce for plant protein.",
          "Use more eggs for extra protein.",
          "Top with feta and Greek yogurt.",
          "Serve with protein-enriched pita."
        ]
      }
    }
  },

  {
    id: "muesli-bowl",
    slug: "muesli-bowl",
    name: "Swiss Muesli Bowl",
    description: "Traditional Swiss breakfast with oats, fruits, and nuts",
    baseServings: 1,
    image: "/images/templates/muesli.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Swiss Muesli",
        description: "Traditional overnight muesli with fresh fruit",
        healthBadges: ["High Fiber", "Heart Healthy", "Make Ahead"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.5, unit: "cup" },
          { item: "Milk or yogurt", quantity: 0.5, unit: "cup" },
          { item: "Grated apple", quantity: 0.5, unit: "medium" },
          { item: "Mixed nuts, chopped", quantity: 2, unit: "tbsp" },
          { item: "Raisins", quantity: 1, unit: "tbsp" },
          { item: "Honey", quantity: 1, unit: "tsp" },
          { item: "Fresh berries", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Mix oats with milk or yogurt.",
          "Refrigerate overnight.",
          "In the morning, add grated apple and nuts.",
          "Top with berries, raisins, and honey."
        ]
      },
      light: {
        slug: "light",
        name: "Light Fruit Muesli",
        description: "Lower calorie with extra fruit",
        healthBadges: ["Low Calorie", "High Fiber", "Natural Sweetness"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.33, unit: "cup" },
          { item: "Unsweetened almond milk", quantity: 0.75, unit: "cup" },
          { item: "Grated apple", quantity: 1, unit: "medium" },
          { item: "Fresh berries", quantity: 1, unit: "cup" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "packet" }
        ],
        instructions: [
          "Use less oats, more fruit.",
          "Soak in almond milk overnight.",
          "Sweeten with stevia and cinnamon.",
          "Load with fresh fruit."
        ]
      },
      highProtein: {
        slug: "highProtein",
        name: "Protein Power Muesli",
        description: "High protein with Greek yogurt and protein powder",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Rolled oats", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Berries", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Mix oats with Greek yogurt and protein powder.",
          "Add chia seeds and refrigerate overnight.",
          "Top with almond butter, hemp seeds, and berries.",
          "Perfect high-protein breakfast."
        ]
      }
    }
  }
];