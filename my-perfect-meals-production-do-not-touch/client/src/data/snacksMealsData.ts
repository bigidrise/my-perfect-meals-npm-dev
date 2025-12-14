export interface SnackMeal {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  image: string;
  templates: {
    classic: SnackTemplate;
    light: SnackTemplate;
    highProtein: SnackTemplate;
  };
}

export interface SnackTemplate {
  slug: string;
  name: string;
  description: string;
  healthBadges: string[];
  ingredients: Array<{
    item: string;
    quantity: number;
    unit: string;
  }>;
  instructions: string[];
}

export const snacksMealsData: SnackMeal[] = [
  {
    id: "greek-yogurt-parfait",
    slug: "greek-yogurt-parfait",
    name: "Greek Yogurt Parfait",
    description: "Layered yogurt with fresh berries and crunchy granola",
    baseServings: 1,
    image: "/images/templates/snack-yogurt-parfait.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Berry Parfait",
        description: "Traditional parfait with mixed berries and granola",
        healthBadges: ["High Protein", "Probiotic", "Antioxidant Rich"],
        ingredients: [
          { item: "Greek yogurt", quantity: 1, unit: "cup" },
          { item: "Mixed berries", quantity: 0.5, unit: "cup" },
          { item: "Granola", quantity: 0.25, unit: "cup" },
          { item: "Honey", quantity: 1, unit: "tbsp" },
          { item: "Almonds", quantity: 2, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Layer half the yogurt in a glass or bowl",
          "Add half the berries and drizzle with honey",
          "Sprinkle with half the granola and almonds",
          "Repeat layers with remaining ingredients",
          "Top with chia seeds for extra nutrition",
          "Serve immediately for best texture"
        ]
      },
      light: {
        slug: "light",
        name: "Light Berry Bowl",
        description: "Lower calorie version with extra berries",
        healthBadges: ["Low Calorie", "High Fiber", "Weight Management"],
        ingredients: [
          { item: "Non-fat Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Fresh berries", quantity: 0.75, unit: "cup" },
          { item: "Low-fat granola", quantity: 2, unit: "tbsp" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Mint leaves", quantity: 3, unit: "leaves" }
        ],
        instructions: [
          "Use non-fat Greek yogurt for fewer calories",
          "Load with extra fresh berries for volume",
          "Use smaller amount of low-fat granola",
          "Sweeten naturally with stevia and cinnamon",
          "Garnish with fresh mint for flavor",
          "Perfect guilt-free snack option"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Parfait",
        description: "Extra protein with protein powder and nuts",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Greek yogurt", quantity: 1.25, unit: "cups" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Mixed berries", quantity: 0.5, unit: "cup" },
          { item: "Protein granola", quantity: 0.25, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder into Greek yogurt",
          "Use extra yogurt for maximum protein",
          "Add almond butter for healthy fats and protein",
          "Use protein-enriched granola",
          "Top with hemp seeds for complete amino acids",
          "Perfect post-workout recovery snack"
        ]
      }
    }
  },
  {
    id: "apple-almond-butter",
    slug: "apple-almond-butter",
    name: "Apple & Almond Butter",
    description: "Crisp apple slices with creamy almond butter",
    baseServings: 1,
    image: "/images/templates/snack-apple-almond.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Apple & Almond",
        description: "Traditional combination with a sprinkle of cinnamon",
        healthBadges: ["Heart Healthy", "High Fiber", "Natural Sugars"],
        ingredients: [
          { item: "Medium apple", quantity: 1, unit: "whole" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Chopped almonds", quantity: 1, unit: "tbsp" },
          { item: "Honey", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Wash and core apple, slice into wedges",
          "Arrange apple slices on plate",
          "Serve with almond butter for dipping",
          "Sprinkle with cinnamon and chopped almonds",
          "Drizzle with a touch of honey if desired",
          "Eat immediately to prevent browning"
        ]
      },
      light: {
        slug: "light",
        name: "Light Apple Crisp",
        description: "More apple with powdered almond butter",
        healthBadges: ["Low Calorie", "High Fiber", "Natural Sweetness"],
        ingredients: [
          { item: "Large apple", quantity: 1, unit: "whole" },
          { item: "Powdered almond butter", quantity: 1, unit: "tbsp" },
          { item: "Cinnamon", quantity: 1, unit: "tsp" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Use larger apple for more volume",
          "Use powdered almond butter for fewer calories",
          "Sprinkle with extra cinnamon for flavor",
          "Add lemon juice to prevent browning",
          "Sweeten naturally with stevia if needed",
          "Focus on the apple's natural sweetness"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Apple Bowl",
        description: "Extra almond butter with protein additions",
        healthBadges: ["High Protein", "Healthy Fats", "Sustained Energy"],
        ingredients: [
          { item: "Medium apple", quantity: 1, unit: "whole" },
          { item: "Almond butter", quantity: 3, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Chopped almonds", quantity: 2, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Mix protein powder into almond butter",
          "Add Greek yogurt for extra protein",
          "Serve with generous portions of nut butter",
          "Top with chopped almonds and chia seeds",
          "Create a protein-rich dip for apple slices",
          "Perfect pre or post-workout snack"
        ]
      }
    }
  },
  {
    id: "hummus-veggie-plate",
    slug: "hummus-veggie-plate",
    name: "Hummus & Veggie Plate",
    description: "Fresh vegetables with creamy hummus dip",
    baseServings: 1,
    image: "/images/templates/snack-hummus-veggies.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Plate",
        description: "Traditional hummus with colorful fresh vegetables",
        healthBadges: ["Plant Based", "High Fiber", "Antioxidant Rich"],
        ingredients: [
          { item: "Hummus", quantity: 0.25, unit: "cup" },
          { item: "Baby carrots", quantity: 1, unit: "cup" },
          { item: "Cucumber slices", quantity: 0.75, unit: "cup" },
          { item: "Bell pepper strips", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.5, unit: "cup" },
          { item: "Celery sticks", quantity: 3, unit: "stalks" }
        ],
        instructions: [
          "Wash and prepare all vegetables",
          "Cut vegetables into bite-sized pieces",
          "Arrange colorfully on a plate",
          "Place hummus in center for dipping",
          "Serve immediately for best crunch",
          "Store leftovers in refrigerator"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Plate",
        description: "Extra vegetables with lighter hummus portion",
        healthBadges: ["Very Low Calorie", "High Fiber", "Hydrating"],
        ingredients: [
          { item: "Hummus", quantity: 3, unit: "tbsp" },
          { item: "Cucumber", quantity: 1.5, unit: "cups" },
          { item: "Radishes", quantity: 0.5, unit: "cup" },
          { item: "Bell peppers", quantity: 1, unit: "cup" },
          { item: "Sugar snap peas", quantity: 1, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use smaller portion of hummus",
          "Load plate with extra water-rich vegetables",
          "Add radishes and snap peas for crunch",
          "Squeeze lemon juice over vegetables",
          "Focus on volume with low-calorie vegetables",
          "Perfect for weight management"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Veggie Power",
        description: "Extra hummus with protein additions",
        healthBadges: ["High Plant Protein", "Complete Amino Acids", "Sustained Energy"],
        ingredients: [
          { item: "Hummus", quantity: 0.5, unit: "cup" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Mixed vegetables", quantity: 2, unit: "cups" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Edamame", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Mix protein powder into hummus",
          "Add Greek yogurt for extra creaminess and protein",
          "Include edamame for plant protein",
          "Sprinkle hemp seeds on vegetables",
          "Create a protein-rich dip with extra nutrition",
          "Perfect for muscle building goals"
        ]
      }
    }
  },
  {
    id: "trail-mix-bowl",
    slug: "trail-mix-bowl",
    name: "Trail Mix Bowl",
    description: "Healthy mix of nuts, seeds, and dried fruits",
    baseServings: 1,
    image: "/images/templates/snack-trail-mix.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Trail Mix",
        description: "Traditional mix with almonds, walnuts, and dried fruit",
        healthBadges: ["Healthy Fats", "Energy Dense", "Portable"],
        ingredients: [
          { item: "Almonds", quantity: 2, unit: "tbsp" },
          { item: "Walnuts", quantity: 2, unit: "tbsp" },
          { item: "Dried cranberries", quantity: 1, unit: "tbsp" },
          { item: "Dark chocolate chips", quantity: 1, unit: "tbsp" },
          { item: "Pumpkin seeds", quantity: 1, unit: "tbsp" },
          { item: "Raisins", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Combine all ingredients in a small bowl",
          "Mix gently to distribute evenly",
          "Store in airtight container",
          "Perfect for on-the-go snacking",
          "Provides sustained energy",
          "Great for hiking or travel"
        ]
      },
      light: {
        slug: "light",
        name: "Light Seed Mix",
        description: "More seeds and nuts, less dried fruit",
        healthBadges: ["Lower Sugar", "Heart Healthy", "Weight Management"],
        ingredients: [
          { item: "Almonds", quantity: 2, unit: "tbsp" },
          { item: "Pumpkin seeds", quantity: 2, unit: "tbsp" },
          { item: "Sunflower seeds", quantity: 1, unit: "tbsp" },
          { item: "Unsweetened coconut", quantity: 1, unit: "tbsp" },
          { item: "Dried cranberries", quantity: 0.5, unit: "tbsp" },
          { item: "Sea salt", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Focus on nuts and seeds over dried fruit",
          "Use unsweetened dried fruit if any",
          "Add a pinch of sea salt for flavor",
          "Portion control is key for nuts",
          "Store in small containers for portions",
          "Great for satisfying crunchy cravings"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Mix",
        description: "Extra nuts and protein additions",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Almonds", quantity: 3, unit: "tbsp" },
          { item: "Protein granola", quantity: 2, unit: "tbsp" },
          { item: "Roasted chickpeas", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Dark chocolate", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra almonds for maximum protein",
          "Add roasted chickpeas for plant protein",
          "Include protein granola and hemp seeds",
          "Dust with protein powder for extra nutrition",
          "Mix thoroughly to distribute protein powder",
          "Perfect post-workout snack"
        ]
      }
    }
  },
  {
    id: "cottage-cheese-bowl",
    slug: "cottage-cheese-bowl",
    name: "Cottage Cheese Bowl",
    description: "Creamy cottage cheese with fresh toppings",
    baseServings: 1,
    image: "/images/templates/snack-cottage-cheese.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cottage Bowl",
        description: "Traditional cottage cheese with fruit and nuts",
        healthBadges: ["High Protein", "Calcium Rich", "Probiotic"],
        ingredients: [
          { item: "Cottage cheese", quantity: 0.75, unit: "cup" },
          { item: "Fresh berries", quantity: 0.5, unit: "cup" },
          { item: "Chopped walnuts", quantity: 2, unit: "tbsp" },
          { item: "Honey", quantity: 1, unit: "tsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Granola", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Place cottage cheese in bowl",
          "Top with fresh berries",
          "Sprinkle with chopped walnuts and granola",
          "Drizzle with honey",
          "Add a dash of cinnamon",
          "Mix gently and enjoy immediately"
        ]
      },
      light: {
        slug: "light",
        name: "Light Berry Bowl",
        description: "Low-fat cottage cheese with extra berries",
        healthBadges: ["Low Calorie", "High Protein", "Weight Management"],
        ingredients: [
          { item: "Low-fat cottage cheese", quantity: 0.5, unit: "cup" },
          { item: "Mixed berries", quantity: 0.75, unit: "cup" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Lemon zest", quantity: 0.5, unit: "tsp" },
          { item: "Fresh mint", quantity: 2, unit: "leaves" },
          { item: "Chia seeds", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use low-fat cottage cheese for fewer calories",
          "Load with extra berries for volume",
          "Sweeten naturally with stevia",
          "Add lemon zest for bright flavor",
          "Garnish with fresh mint",
          "Top with chia seeds for nutrition"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Bowl",
        description: "Extra cottage cheese with protein additions",
        healthBadges: ["Very High Protein", "Muscle Building", "Complete Amino Acids"],
        ingredients: [
          { item: "Cottage cheese", quantity: 1, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Almonds", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Berries", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use full portion of cottage cheese",
          "Mix in protein powder thoroughly",
          "Add Greek yogurt for extra creaminess and protein",
          "Top with almonds and hemp seeds",
          "Add small portion of berries for flavor",
          "Perfect high-protein muscle-building snack"
        ]
      }
    }
  },
  {
    id: "avocado-toast",
    slug: "avocado-toast",
    name: "Avocado Toast",
    description: "Creamy avocado on toasted whole grain bread",
    baseServings: 1,
    image: "/images/templates/snack-avocado-toast.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Avocado Toast",
        description: "Traditional avocado toast with lemon and seasoning",
        healthBadges: ["Healthy Fats", "High Fiber", "Heart Healthy"],
        ingredients: [
          { item: "Whole grain bread", quantity: 1, unit: "slice" },
          { item: "Ripe avocado", quantity: 0.5, unit: "medium" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" },
          { item: "Sea salt", quantity: 1, unit: "pinch" },
          { item: "Black pepper", quantity: 1, unit: "pinch" },
          { item: "Red pepper flakes", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Toast bread until golden brown",
          "Mash avocado with lemon juice",
          "Spread avocado mixture on toast",
          "Season with salt, pepper, and red pepper flakes",
          "Serve immediately while toast is warm",
          "Perfect for breakfast or snack"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Toast",
        description: "Less avocado with extra vegetables",
        healthBadges: ["Lower Calorie", "High Fiber", "Vegetable Rich"],
        ingredients: [
          { item: "Whole grain thin bread", quantity: 1, unit: "slice" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Cucumber slices", quantity: 0.25, unit: "cup" },
          { item: "Tomato slices", quantity: 0.25, unit: "cup" },
          { item: "Sprouts", quantity: 2, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" },
          { item: "Everything seasoning", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Use thinner bread slice for fewer calories",
          "Use less avocado, add more vegetables",
          "Layer with cucumber and tomato slices",
          "Top with sprouts for crunch",
          "Season with everything seasoning",
          "Focus on vegetable volume"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Toast",
        description: "Avocado with protein additions and seeds",
        healthBadges: ["High Protein", "Healthy Fats", "Complete Nutrition"],
        ingredients: [
          { item: "Protein bread", quantity: 1, unit: "slice" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Hard-boiled egg", quantity: 1, unit: "large" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Everything seasoning", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use protein-enriched bread",
          "Mix protein powder into mashed avocado",
          "Top with sliced hard-boiled egg",
          "Sprinkle with hemp seeds for extra protein",
          "Season with everything seasoning",
          "Perfect high-protein snack or light meal"
        ]
      }
    }
  },
  {
    id: "protein-smoothie-bowl",
    slug: "protein-smoothie-bowl",
    name: "Protein Smoothie Bowl",
    description: "Thick smoothie bowl with healthy toppings",
    baseServings: 1,
    image: "/images/templates/snack-smoothie-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Berry Bowl",
        description: "Traditional smoothie bowl with berries and granola",
        healthBadges: ["Antioxidant Rich", "High Fiber", "Natural Sugars"],
        ingredients: [
          { item: "Frozen berries", quantity: 1, unit: "cup" },
          { item: "Banana", quantity: 0.5, unit: "medium" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Almond milk", quantity: 0.25, unit: "cup" },
          { item: "Granola", quantity: 2, unit: "tbsp" },
          { item: "Fresh berries", quantity: 0.25, unit: "cup" },
          { item: "Coconut flakes", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend frozen berries, banana, yogurt, and almond milk",
          "Blend until thick and creamy",
          "Pour into bowl",
          "Top with granola, fresh berries, and coconut",
          "Serve immediately with spoon",
          "Add toppings in sections for visual appeal"
        ]
      },
      light: {
        slug: "light",
        name: "Light Green Bowl",
        description: "Lower calorie version with extra vegetables",
        healthBadges: ["Very Low Calorie", "Nutrient Dense", "Detox Friendly"],
        ingredients: [
          { item: "Frozen berries", quantity: 0.75, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Cucumber", quantity: 0.25, unit: "cup" },
          { item: "Unsweetened almond milk", quantity: 0.5, unit: "cup" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" },
          { item: "Fresh mint", quantity: 3, unit: "leaves" }
        ],
        instructions: [
          "Blend with extra liquid for thinner consistency",
          "Add spinach and cucumber for nutrients",
          "Sweeten naturally with stevia",
          "Keep toppings light and nutritious",
          "Focus on volume with low-calorie additions",
          "Perfect for weight management"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Bowl",
        description: "Extra protein with protein powder and nuts",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Frozen berries", quantity: 0.75, unit: "cup" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Protein granola", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Almonds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend with protein powder for maximum protein",
          "Use extra Greek yogurt for creaminess",
          "Add almond butter for healthy protein and fats",
          "Top with protein granola and hemp seeds",
          "Add chopped almonds for crunch",
          "Perfect post-workout recovery snack"
        ]
      }
    }
  },
  {
    id: "energy-balls",
    slug: "energy-balls",
    name: "Energy Balls",
    description: "No-bake energy balls with nuts, dates, and seeds",
    baseServings: 2,
    image: "/images/templates/snack-energy-balls.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Date Balls",
        description: "Traditional energy balls with dates and almonds",
        healthBadges: ["Natural Sugars", "Energy Dense", "Portable"],
        ingredients: [
          { item: "Pitted dates", quantity: 6, unit: "pieces" },
          { item: "Almonds", quantity: 0.25, unit: "cup" },
          { item: "Rolled oats", quantity: 0.25, unit: "cup" },
          { item: "Coconut flakes", quantity: 2, unit: "tbsp" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Soak dates in warm water for 10 minutes",
          "Process almonds and oats in food processor",
          "Add drained dates and process until sticky",
          "Add coconut, vanilla, and cinnamon",
          "Roll mixture into 8 small balls",
          "Refrigerate 30 minutes before serving"
        ]
      },
      light: {
        slug: "light",
        name: "Light Coconut Balls",
        description: "Lower calorie version with extra coconut",
        healthBadges: ["Lower Sugar", "High Fiber", "Portion Controlled"],
        ingredients: [
          { item: "Pitted dates", quantity: 4, unit: "pieces" },
          { item: "Almonds", quantity: 3, unit: "tbsp" },
          { item: "Unsweetened coconut", quantity: 3, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Lemon zest", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use fewer dates for less sugar",
          "Add chia seeds for extra fiber",
          "Roll in unsweetened coconut",
          "Make smaller portion sizes",
          "Add lemon zest for bright flavor",
          "Perfect for portion control"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Balls",
        description: "Extra protein with protein powder and nuts",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Pitted dates", quantity: 4, unit: "pieces" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Protein granola", quantity: 2, unit: "tbsp" },
          { item: "Dark chocolate chips", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder with almond butter",
          "Add chopped dates for binding",
          "Include hemp seeds for complete amino acids",
          "Roll in crushed protein granola",
          "Add dark chocolate chips for flavor",
          "Perfect high-protein portable snack"
        ]
      }
    }
  },
  {
    id: "cheese-crackers",
    slug: "cheese-crackers",
    name: "Cheese & Crackers",
    description: "Whole grain crackers with quality cheese",
    baseServings: 1,
    image: "/images/templates/snack-cheese-crackers.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cheese & Crackers",
        description: "Traditional pairing with whole grain crackers",
        healthBadges: ["Calcium Rich", "Satisfying", "Balanced"],
        ingredients: [
          { item: "Whole grain crackers", quantity: 8, unit: "pieces" },
          { item: "Sharp cheddar cheese", quantity: 1, unit: "oz" },
          { item: "Apple slices", quantity: 0.25, unit: "cup" },
          { item: "Grapes", quantity: 0.25, unit: "cup" },
          { item: "Walnuts", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Arrange crackers on plate",
          "Slice cheese into portions for crackers",
          "Add apple slices and grapes",
          "Include walnuts for crunch",
          "Create balanced flavor combinations",
          "Perfect for afternoon snacking"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Crackers",
        description: "Reduced cheese with extra vegetables",
        healthBadges: ["Lower Calorie", "High Fiber", "Weight Management"],
        ingredients: [
          { item: "Whole grain thin crackers", quantity: 6, unit: "pieces" },
          { item: "Part-skim cheese", quantity: 0.5, unit: "oz" },
          { item: "Cucumber slices", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.5, unit: "cup" },
          { item: "Bell pepper strips", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use thinner crackers for fewer calories",
          "Use smaller portion of lower-fat cheese",
          "Load with extra fresh vegetables",
          "Focus on volume with low-calorie options",
          "Create colorful, satisfying combinations",
          "Great for weight management"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Crackers",
        description: "Extra cheese with protein additions",
        healthBadges: ["High Protein", "Calcium Rich", "Muscle Building"],
        ingredients: [
          { item: "Protein crackers", quantity: 6, unit: "pieces" },
          { item: "Sharp cheddar", quantity: 1.5, unit: "oz" },
          { item: "String cheese", quantity: 1, unit: "piece" },
          { item: "Hard-boiled egg", quantity: 0.5, unit: "large" },
          { item: "Almonds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein-enriched crackers",
          "Add extra cheese for more protein",
          "Include string cheese and egg",
          "Add almonds for complete amino acids",
          "Create protein-rich combinations",
          "Perfect for muscle building goals"
        ]
      }
    }
  },
  {
    id: "banana-peanut-butter",
    slug: "banana-peanut-butter",
    name: "Banana & Peanut Butter",
    description: "Sliced banana with creamy peanut butter",
    baseServings: 1,
    image: "/images/templates/snack-banana-pb.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Banana & PB",
        description: "Traditional combination with natural peanut butter",
        healthBadges: ["Potassium Rich", "Healthy Fats", "Natural Sugars"],
        ingredients: [
          { item: "Medium banana", quantity: 1, unit: "whole" },
          { item: "Natural peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Honey", quantity: 0.5, unit: "tsp" },
          { item: "Chopped peanuts", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Slice banana into rounds",
          "Arrange on plate",
          "Serve with peanut butter for dipping",
          "Sprinkle with cinnamon",
          "Drizzle with honey if desired",
          "Top with chopped peanuts for extra crunch"
        ]
      },
      light: {
        slug: "light",
        name: "Light Banana Bowl",
        description: "Powdered peanut butter for fewer calories",
        healthBadges: ["Lower Calorie", "High Fiber", "Natural Sweetness"],
        ingredients: [
          { item: "Large banana", quantity: 1, unit: "whole" },
          { item: "Powdered peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" },
          { item: "Stevia", quantity: 1, unit: "pinch" },
          { item: "Water", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use larger banana for more volume",
          "Mix powdered peanut butter with water",
          "Drizzle over sliced banana",
          "Sprinkle with extra cinnamon",
          "Sweeten naturally with stevia",
          "Focus on banana's natural sweetness"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Banana",
        description: "Extra peanut butter with protein additions",
        healthBadges: ["High Protein", "Sustained Energy", "Muscle Building"],
        ingredients: [
          { item: "Medium banana", quantity: 1, unit: "whole" },
          { item: "Peanut butter", quantity: 3, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 0.5, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder into peanut butter",
          "Add Greek yogurt for extra protein",
          "Create protein-rich dip for banana",
          "Top with hemp seeds and chia seeds",
          "Perfect pre or post-workout snack",
          "Provides sustained energy and protein"
        ]
      }
    }
  },

  // NEW SNACK MEALS
  {
    id: "zucchini-fries-af",
    slug: "zucchini-fries-af",
    name: "Zucchini Fries (Air-Fryer)",
    description: "Crispy air-fried zucchini with parmesan coating",
    baseServings: 1,
    image: "/images/templates/zucchini-fries.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Zucchini Fries",
        description: "Traditional breaded and air-fried zucchini sticks.",
        healthBadges: ["Vegetarian", "Low Carb", "Crispy"],
        ingredients: [
          { item: "Zucchini", quantity: 1, unit: "medium" },
          { item: "Panko breadcrumbs", quantity: 0.25, unit: "cup" },
          { item: "Grated parmesan", quantity: 0.25, unit: "cup" },
          { item: "Egg", quantity: 1, unit: "large" },
          { item: "Italian seasoning", quantity: 0.5, unit: "tsp" },
          { item: "Salt", quantity: 0.25, unit: "tsp" }
        ],
        instructions: [
          "Cut zucchini into fry-shaped sticks.",
          "Dip in egg, then coat with panko-parmesan mixture.",
          "Air-fry at 400°F for 9-12 minutes until golden.",
          "Season with salt and serve immediately."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Sticks",
        description: "Lighter coating with herbs and spices.",
        healthBadges: ["Vegetarian", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Large zucchini", quantity: 1, unit: "whole" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Panko breadcrumbs", quantity: 2, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" },
          { item: "Garlic powder", quantity: 0.5, unit: "tsp" },
          { item: "Herbs", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use egg whites for lower calories.",
          "Use less breading and add nutritional yeast.",
          "Season with herbs and garlic powder.",
          "Air-fry until crispy and golden."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Fries",
        description: "Extra protein with protein powder and cheese.",
        healthBadges: ["Vegetarian", "High Protein", "Muscle Building"],
        ingredients: [
          { item: "Zucchini", quantity: 1, unit: "medium" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Protein powder (unflavored)", quantity: 1, unit: "tbsp" },
          { item: "Parmesan cheese", quantity: 0.5, unit: "cup" },
          { item: "Panko breadcrumbs", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder into egg wash.",
          "Use extra cheese for more protein.",
          "Add hemp seeds to coating mixture.",
          "Perfect high-protein crispy snack."
        ]
      }
    }
  },

  {
    id: "airpopped-popcorn",
    slug: "airpopped-popcorn",
    name: "Air-Popped Popcorn",
    description: "Light and healthy whole grain snack",
    baseServings: 1,
    image: "/images/templates/air-popped-popcorn.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Air-Popped",
        description: "Traditional air-popped popcorn with light seasoning.",
        healthBadges: ["Vegan", "Whole Grain", "Low Calorie"],
        ingredients: [
          { item: "Popcorn kernels", quantity: 0.25, unit: "cup" },
          { item: "Salt", quantity: 0.5, unit: "tsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" },
          { item: "Garlic powder", quantity: 0.25, unit: "tsp" }
        ],
        instructions: [
          "Pop kernels in air popper or microwave.",
          "Season with salt while warm.",
          "Sprinkle with nutritional yeast for cheesy flavor.",
          "Add garlic powder for extra taste."
        ]
      },
      light: {
        slug: "light",
        name: "Herb & Spice Popcorn",
        description: "Seasoned with herbs instead of salt.",
        healthBadges: ["Vegan", "Very Low Calorie", "Sodium Free"],
        ingredients: [
          { item: "Popcorn kernels", quantity: 0.33, unit: "cup" },
          { item: "Dried herbs", quantity: 1, unit: "tsp" },
          { item: "Paprika", quantity: 0.5, unit: "tsp" },
          { item: "Lemon zest", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Pop larger amount for more volume.",
          "Skip salt and use herbs for flavor.",
          "Add paprika for smoky taste.",
          "Finish with fresh lemon zest."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Popcorn",
        description: "Boosted with protein powder and nutritional yeast.",
        healthBadges: ["Vegan", "High Protein", "Post Workout"],
        ingredients: [
          { item: "Popcorn kernels", quantity: 0.25, unit: "cup" },
          { item: "Protein powder (unflavored)", quantity: 1, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Hemp hearts", quantity: 1, unit: "tbsp" },
          { item: "Sea salt", quantity: 0.25, unit: "tsp" }
        ],
        instructions: [
          "Pop popcorn and let cool slightly.",
          "Dust with protein powder and nutritional yeast.",
          "Sprinkle hemp hearts for complete amino acids.",
          "Season lightly with sea salt."
        ]
      }
    }
  },

  {
    id: "apple-pb-slices",
    slug: "apple-pb-slices",
    name: "Apple + PB Slices",
    description: "Classic combination of fresh apple with peanut butter",
    baseServings: 1,
    image: "/images/templates/apple-pb-slices.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Apple & PB",
        description: "Traditional apple slices with creamy peanut butter.",
        healthBadges: ["Vegan", "Heart Healthy", "Natural Sweetness"],
        ingredients: [
          { item: "Apple", quantity: 1, unit: "large" },
          { item: "Peanut butter", quantity: 1, unit: "tbsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Lemon juice", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Slice apple and drizzle with lemon to prevent browning.",
          "Serve with peanut butter for dipping.",
          "Sprinkle with cinnamon for extra flavor.",
          "Enjoy fresh for best texture."
        ]
      },
      light: {
        slug: "light",
        name: "Light Apple Treat",
        description: "Powdered peanut butter for fewer calories.",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Large apple", quantity: 1, unit: "whole" },
          { item: "Powdered peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Water", quantity: 1, unit: "tbsp" },
          { item: "Stevia", quantity: 1, unit: "packet" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use larger apple for more volume.",
          "Mix powdered peanut butter with water.",
          "Sweeten naturally with stevia.",
          "Add extra cinnamon for warmth."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Apple Power",
        description: "Extra peanut butter with protein additions.",
        healthBadges: ["Vegan", "High Protein", "Sustained Energy"],
        ingredients: [
          { item: "Apple", quantity: 1, unit: "medium" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Hemp hearts", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 0.5, unit: "tbsp" },
          { item: "Protein powder (vanilla)", quantity: 0.25, unit: "scoop" }
        ],
        instructions: [
          "Use almond butter for extra protein.",
          "Mix protein powder into nut butter.",
          "Sprinkle hemp hearts and chia seeds.",
          "Perfect pre or post-workout snack."
        ]
      }
    }
  },

  {
    id: "hummus-veggies",
    slug: "hummus-veggies",
    name: "Hummus + Veg Sticks",
    description: "Fresh vegetables with protein-rich hummus dip",
    baseServings: 1,
    image: "/images/templates/hummus-veg-sticks.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Dip",
        description: "Traditional hummus with colorful vegetable sticks.",
        healthBadges: ["Vegan", "High Fiber", "Heart Healthy"],
        ingredients: [
          { item: "Hummus", quantity: 0.33, unit: "cup" },
          { item: "Carrot sticks", quantity: 0.5, unit: "cup" },
          { item: "Cucumber slices", quantity: 0.5, unit: "cup" },
          { item: "Bell pepper strips", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.5, unit: "cup" },
          { item: "Paprika", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Arrange vegetables on plate around hummus.",
          "Sprinkle paprika on hummus for color.",
          "Serve fresh and crisp.",
          "Perfect healthy snack or appetizer."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Dip",
        description: "More vegetables with reduced hummus portion.",
        healthBadges: ["Vegan", "Very Low Calorie", "Nutrient Dense"],
        ingredients: [
          { item: "Hummus", quantity: 0.25, unit: "cup" },
          { item: "Mixed vegetable sticks", quantity: 2.5, unit: "cups" },
          { item: "Radishes", quantity: 0.25, unit: "cup" },
          { item: "Snap peas", quantity: 0.5, unit: "cup" },
          { item: "Fresh herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use less hummus and more vegetables.",
          "Include low-calorie options like radishes.",
          "Add fresh herbs for flavor without calories.",
          "Focus on vegetable variety and crunch."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Dip",
        description: "Extra hummus with protein-rich additions.",
        healthBadges: ["Vegan", "High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Protein-enriched hummus", quantity: 0.5, unit: "cup" },
          { item: "Vegetable sticks", quantity: 1.5, unit: "cups" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Tahini", quantity: 1, unit: "tbsp" },
          { item: "Pumpkin seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra hummus for more protein.",
          "Mix tahini into hummus for added protein.",
          "Sprinkle hemp seeds and pumpkin seeds.",
          "Perfect protein-rich snack for active lifestyles."
        ]
      }
    }
  },

  {
    id: "yogurt-ranch-dip",
    slug: "yogurt-ranch-dip",
    name: "Greek Yogurt Ranch Dip + Veg",
    description: "Protein-packed yogurt dip with fresh vegetables",
    baseServings: 1,
    image: "/images/templates/yogurt-ranch-dip.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Greek Ranch",
        description: "Traditional ranch flavors made with Greek yogurt.",
        healthBadges: ["Vegetarian", "High Protein", "Probiotic"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 0.75, unit: "cup" },
          { item: "Ranch seasoning", quantity: 1, unit: "tsp" },
          { item: "Raw vegetables", quantity: 2, unit: "cups" },
          { item: "Fresh chives", quantity: 1, unit: "tbsp" },
          { item: "Garlic powder", quantity: 0.25, unit: "tsp" }
        ],
        instructions: [
          "Mix ranch seasoning into Greek yogurt.",
          "Add garlic powder and fresh chives.",
          "Serve with colorful raw vegetables.",
          "Chill for 30 minutes for best flavor."
        ]
      },
      light: {
        slug: "light",
        name: "Light Herb Dip",
        description: "Non-fat yogurt with fresh herbs instead of seasoning.",
        healthBadges: ["Vegetarian", "Very Low Calorie", "Fresh"],
        ingredients: [
          { item: "Non-fat Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Raw vegetables", quantity: 3, unit: "cups" },
          { item: "Black pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Use non-fat yogurt to reduce calories.",
          "Mix with fresh herbs instead of seasoning packet.",
          "Add lemon juice for brightness.",
          "Serve with extra vegetables for volume."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Ranch",
        description: "Extra yogurt with protein powder additions.",
        healthBadges: ["Vegetarian", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Greek yogurt (2%)", quantity: 1, unit: "cup" },
          { item: "Protein powder (unflavored)", quantity: 0.5, unit: "scoop" },
          { item: "Ranch seasoning", quantity: 1, unit: "tsp" },
          { item: "Cottage cheese", quantity: 2, unit: "tbsp" },
          { item: "Raw vegetables", quantity: 1.5, unit: "cups" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix protein powder into yogurt until smooth.",
          "Blend in cottage cheese for extra protein.",
          "Add ranch seasoning and hemp seeds.",
          "Perfect high-protein dip for post-workout."
        ]
      }
    }
  },

  {
    id: "protein-energy-balls",
    slug: "protein-energy-balls",
    name: "Protein Energy Balls",
    description: "No-bake energy balls packed with protein",
    baseServings: 6,
    image: "/images/templates/energy-balls.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Energy Balls",
        description: "Traditional no-bake energy bites",
        healthBadges: ["Vegetarian", "High Protein", "No Bake"],
        ingredients: [
          { item: "Rolled oats", quantity: 1, unit: "cup" },
          { item: "Peanut butter", quantity: 0.5, unit: "cup" },
          { item: "Honey", quantity: 0.33, unit: "cup" },
          { item: "Mini chocolate chips", quantity: 0.25, unit: "cup" },
          { item: "Vanilla extract", quantity: 1, unit: "tsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mix all ingredients in a bowl.",
          "Refrigerate for 30 minutes.",
          "Roll into 12 balls.",
          "Store in refrigerator for up to 1 week."
        ]
      },
      light: {
        slug: "light",
        name: "Light Energy Bites",
        description: "Lower calorie with powdered peanut butter",
        healthBadges: ["Vegetarian", "Lower Calorie", "Natural Sweetness"],
        ingredients: [
          { item: "Rolled oats", quantity: 1, unit: "cup" },
          { item: "Powdered peanut butter", quantity: 0.5, unit: "cup" },
          { item: "Mashed banana", quantity: 1, unit: "medium" },
          { item: "Dates, chopped", quantity: 0.25, unit: "cup" },
          { item: "Cinnamon", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use powdered peanut butter for fewer calories.",
          "Sweeten naturally with banana and dates.",
          "Add cinnamon for extra flavor.",
          "Roll into small bites."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Balls",
        description: "Maximum protein with protein powder",
        healthBadges: ["Vegetarian", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Rolled oats", quantity: 1, unit: "cup" },
          { item: "Almond butter", quantity: 0.5, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "cup" },
          { item: "Honey", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Add protein powder for extra protein.",
          "Use almond butter for healthy fats.",
          "Mix in hemp and chia seeds.",
          "Perfect post-workout snack."
        ]
      }
    }
  },

  {
    id: "apple-peanut-butter",
    slug: "apple-peanut-butter",
    name: "Apple Slices with Peanut Butter",
    description: "Classic healthy snack with sweet and savory combination",
    baseServings: 1,
    image: "/images/templates/apple-pb.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Apple & PB",
        description: "Traditional apple slices with peanut butter",
        healthBadges: ["Vegetarian", "Quick Prep", "Kid Friendly"],
        ingredients: [
          { item: "Apple, sliced", quantity: 1, unit: "medium" },
          { item: "Peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" },
          { item: "Granola", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Slice apple into wedges.",
          "Spread peanut butter on each slice.",
          "Sprinkle with cinnamon.",
          "Top with granola for crunch."
        ]
      },
      light: {
        slug: "light",
        name: "Light Apple Snack",
        description: "Lower calorie with powdered peanut butter",
        healthBadges: ["Vegetarian", "Low Calorie", "Natural Sweetness"],
        ingredients: [
          { item: "Apple, sliced", quantity: 1, unit: "large" },
          { item: "Powdered peanut butter", quantity: 2, unit: "tbsp" },
          { item: "Water", quantity: 1, unit: "tbsp" },
          { item: "Cinnamon", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Mix powdered peanut butter with water.",
          "Use larger apple for more volume.",
          "Drizzle with PB mixture.",
          "Sprinkle generously with cinnamon."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Apple Power",
        description: "Extra protein with almond butter and seeds",
        healthBadges: ["Vegetarian", "High Protein", "Sustained Energy"],
        ingredients: [
          { item: "Apple, sliced", quantity: 1, unit: "medium" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Chia seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Mix protein powder into almond butter.",
          "Spread on apple slices.",
          "Sprinkle with hemp and chia seeds.",
          "Perfect protein-packed snack."
        ]
      }
    }
  },

  {
    id: "rice-cakes-toppings",
    slug: "rice-cakes-toppings",
    name: "Rice Cakes with Toppings",
    description: "Light and crunchy base for creative toppings",
    baseServings: 1,
    image: "/images/templates/rice-cakes.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Rice Cake Snack",
        description: "Traditional toppings on crispy rice cakes",
        healthBadges: ["Vegetarian", "Quick Prep", "Customizable"],
        ingredients: [
          { item: "Rice cakes", quantity: 2, unit: "pieces" },
          { item: "Almond butter", quantity: 2, unit: "tbsp" },
          { item: "Banana slices", quantity: 0.5, unit: "medium" },
          { item: "Honey", quantity: 1, unit: "tsp" },
          { item: "Cinnamon", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Spread almond butter on rice cakes.",
          "Top with banana slices.",
          "Drizzle with honey.",
          "Sprinkle with cinnamon."
        ]
      },
      light: {
        slug: "light",
        name: "Light Savory Rice Cakes",
        description: "Savory toppings for fewer calories",
        healthBadges: ["Vegetarian", "Very Low Calorie", "Savory"],
        ingredients: [
          { item: "Rice cakes", quantity: 3, unit: "pieces" },
          { item: "Hummus", quantity: 2, unit: "tbsp" },
          { item: "Cucumber slices", quantity: 0.5, unit: "cup" },
          { item: "Tomato slices", quantity: 0.25, unit: "cup" },
          { item: "Everything seasoning", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Spread hummus on rice cakes.",
          "Top with cucumber and tomato.",
          "Sprinkle with everything seasoning.",
          "Enjoy as a light savory snack."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Rice Cakes",
        description: "Extra protein with cottage cheese and seeds",
        healthBadges: ["Vegetarian", "High Protein", "Muscle Building"],
        ingredients: [
          { item: "Rice cakes", quantity: 2, unit: "pieces" },
          { item: "Cottage cheese", quantity: 0.5, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Berries", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Spread cottage cheese on rice cakes.",
          "Drizzle with almond butter.",
          "Top with hemp seeds and berries.",
          "Perfect high-protein snack."
        ]
      }
    }
  },

  {
    id: "trail-mix",
    slug: "trail-mix",
    name: "Homemade Trail Mix",
    description: "Custom blend of nuts, seeds, and dried fruit",
    baseServings: 8,
    image: "/images/templates/trail-mix.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Trail Mix",
        description: "Traditional hiking snack mix",
        healthBadges: ["Vegan", "Portable", "Energy Boosting"],
        ingredients: [
          { item: "Mixed nuts", quantity: 1, unit: "cup" },
          { item: "Dried cranberries", quantity: 0.5, unit: "cup" },
          { item: "Dark chocolate chips", quantity: 0.25, unit: "cup" },
          { item: "Pumpkin seeds", quantity: 0.25, unit: "cup" },
          { item: "Coconut flakes", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Mix all ingredients in a large bowl.",
          "Portion into 8 servings.",
          "Store in airtight container.",
          "Perfect for on-the-go snacking."
        ]
      },
      light: {
        slug: "light",
        name: "Light Berry Mix",
        description: "More dried fruit with fewer nuts",
        healthBadges: ["Vegan", "Lower Calorie", "Natural Sweetness"],
        ingredients: [
          { item: "Almonds", quantity: 0.5, unit: "cup" },
          { item: "Dried berries", quantity: 1, unit: "cup" },
          { item: "Puffed rice", quantity: 0.5, unit: "cup" },
          { item: "Pumpkin seeds", quantity: 0.25, unit: "cup" },
          { item: "Cinnamon", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use fewer nuts for lower calories.",
          "Add puffed rice for volume.",
          "Use more dried fruit for sweetness.",
          "Season with cinnamon."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Mix",
        description: "Extra nuts and seeds for maximum protein",
        healthBadges: ["Vegan", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Mixed nuts", quantity: 1.5, unit: "cups" },
          { item: "Pumpkin seeds", quantity: 0.5, unit: "cup" },
          { item: "Hemp seeds", quantity: 0.25, unit: "cup" },
          { item: "Protein-coated almonds", quantity: 0.5, unit: "cup" },
          { item: "Dark chocolate chips", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra nuts and seeds for protein.",
          "Add protein-coated almonds.",
          "Mix in hemp seeds for omega-3s.",
          "Perfect post-workout trail mix."
        ]
      }
    }
  },

  {
    id: "cucumber-bites",
    slug: "cucumber-bites",
    name: "Cucumber Bites",
    description: "Refreshing cucumber rounds with savory toppings",
    baseServings: 1,
    image: "/images/templates/cucumber-bites.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cucumber Bites",
        description: "Traditional cucumber rounds with cream cheese",
        healthBadges: ["Vegetarian", "Low Carb", "Refreshing"],
        ingredients: [
          { item: "Cucumber, sliced", quantity: 1, unit: "medium" },
          { item: "Cream cheese", quantity: 2, unit: "tbsp" },
          { item: "Cherry tomatoes, halved", quantity: 4, unit: "pieces" },
          { item: "Fresh dill", quantity: 1, unit: "tbsp" },
          { item: "Everything seasoning", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Slice cucumber into thick rounds.",
          "Top each with cream cheese.",
          "Add cherry tomato half.",
          "Garnish with dill and seasoning."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Bites",
        description: "Greek yogurt instead of cream cheese",
        healthBadges: ["Vegetarian", "Very Low Calorie", "High Protein"],
        ingredients: [
          { item: "Cucumber, sliced", quantity: 1, unit: "large" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 2, unit: "tbsp" },
          { item: "Lemon zest", quantity: 0.5, unit: "tsp" },
          { item: "Black pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Use Greek yogurt for fewer calories.",
          "Add fresh herbs for flavor.",
          "Top with lemon zest and pepper.",
          "Refreshing and light."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Cucumber Power Bites",
        description: "Extra protein with hummus and seeds",
        healthBadges: ["Vegetarian", "High Protein", "Savory"],
        ingredients: [
          { item: "Cucumber, sliced", quantity: 1, unit: "medium" },
          { item: "Hummus", quantity: 0.25, unit: "cup" },
          { item: "Smoked salmon", quantity: 2, unit: "oz" },
          { item: "Capers", quantity: 1, unit: "tsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Top cucumber with hummus.",
          "Add smoked salmon for protein.",
          "Garnish with capers and hemp seeds.",
          "Perfect high-protein snack."
        ]
      }
    }
  },

  {
    id: "banana-nice-cream",
    slug: "banana-nice-cream",
    name: "Banana Nice Cream",
    description: "Healthy ice cream alternative made from frozen bananas",
    baseServings: 1,
    image: "/images/templates/nice-cream.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Banana Nice Cream",
        description: "Simple frozen banana ice cream",
        healthBadges: ["Vegan", "Natural Sweetness", "No Added Sugar"],
        ingredients: [
          { item: "Frozen bananas", quantity: 2, unit: "medium" },
          { item: "Vanilla extract", quantity: 0.5, unit: "tsp" },
          { item: "Almond milk", quantity: 2, unit: "tbsp" },
          { item: "Dark chocolate chips", quantity: 1, unit: "tbsp" },
          { item: "Sliced almonds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Blend frozen bananas until creamy.",
          "Add vanilla and almond milk as needed.",
          "Serve immediately for soft serve texture.",
          "Top with chocolate chips and almonds."
        ]
      },
      light: {
        slug: "light",
        name: "Light Berry Nice Cream",
        description: "Mixed berries for fewer calories",
        healthBadges: ["Vegan", "Very Low Calorie", "Antioxidant Rich"],
        ingredients: [
          { item: "Frozen banana", quantity: 1, unit: "medium" },
          { item: "Frozen strawberries", quantity: 0.5, unit: "cup" },
          { item: "Frozen blueberries", quantity: 0.25, unit: "cup" },
          { item: "Fresh berries", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Mix banana with frozen berries.",
          "Blend until smooth and creamy.",
          "Top with fresh berries.",
          "Enjoy as a light dessert."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Nice Cream",
        description: "Extra protein with protein powder and nut butter",
        healthBadges: ["Vegetarian", "High Protein", "Post Workout"],
        ingredients: [
          { item: "Frozen bananas", quantity: 2, unit: "medium" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Protein granola", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Blend bananas with protein powder.",
          "Add almond butter and Greek yogurt.",
          "Blend until creamy.",
          "Top with protein granola."
        ]
      }
    }
  },

  {
    id: "roasted-chickpeas",
    slug: "roasted-chickpeas",
    name: "Roasted Chickpeas",
    description: "Crispy roasted chickpeas with savory seasonings",
    baseServings: 4,
    image: "/images/templates/roasted-chickpeas.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Roasted Chickpeas",
        description: "Traditional savory roasted chickpeas",
        healthBadges: ["Vegan", "High Fiber", "Crunchy"],
        ingredients: [
          { item: "Chickpeas, drained", quantity: 1, unit: "can" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Sea salt", quantity: 0.5, unit: "tsp" },
          { item: "Paprika", quantity: 0.5, unit: "tsp" },
          { item: "Garlic powder", quantity: 0.25, unit: "tsp" }
        ],
        instructions: [
          "Pat chickpeas dry thoroughly.",
          "Toss with oil and seasonings.",
          "Roast at 400°F for 30-40 minutes.",
          "Shake pan every 10 minutes until crispy."
        ]
      },
      light: {
        slug: "light",
        name: "Light Spiced Chickpeas",
        description: "Air-fried with less oil",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Chickpeas, drained", quantity: 1, unit: "can" },
          { item: "Cooking spray", quantity: 1, unit: "spray" },
          { item: "Spice blend", quantity: 1, unit: "tsp" },
          { item: "Lemon zest", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use cooking spray instead of oil.",
          "Season with spice blend.",
          "Air fry or bake until crispy.",
          "Finish with lemon zest."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Chickpeas",
        description: "Extra chickpeas with nutritional yeast",
        healthBadges: ["Vegan", "High Protein", "High Fiber"],
        ingredients: [
          { item: "Chickpeas, drained", quantity: 2, unit: "cans" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Smoked paprika", quantity: 1, unit: "tsp" },
          { item: "Garlic powder", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Use double chickpeas for more protein.",
          "Toss with nutritional yeast for B vitamins.",
          "Roast until extra crispy.",
          "Perfect high-protein crunchy snack."
        ]
      }
    }
  },

  {
    id: "snack-cheese-crackers",
    slug: "snack-cheese-crackers",
    name: "Cheese & Whole Grain Crackers",
    description: "Simple pairing of cheese with fiber-rich crackers",
    baseServings: 1,
    image: "/images/templates/cheese-crackers.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cheese & Crackers",
        description: "Traditional cheese and cracker pairing",
        healthBadges: ["Vegetarian", "Quick Prep", "Satisfying"],
        ingredients: [
          { item: "Whole grain crackers", quantity: 6, unit: "pieces" },
          { item: "Cheddar cheese", quantity: 1.5, unit: "oz" },
          { item: "Apple slices", quantity: 0.5, unit: "medium" },
          { item: "Grapes", quantity: 10, unit: "pieces" }
        ],
        instructions: [
          "Arrange crackers on a plate.",
          "Slice cheese and place on crackers.",
          "Add apple slices and grapes.",
          "Perfect balanced snack."
        ]
      },
      light: {
        slug: "light",
        name: "Light Cheese Plate",
        description: "Reduced-fat cheese with extra fruit",
        healthBadges: ["Vegetarian", "Lower Calorie", "Portion Controlled"],
        ingredients: [
          { item: "Whole grain crackers", quantity: 4, unit: "pieces" },
          { item: "Low-fat cheese", quantity: 1, unit: "oz" },
          { item: "Fresh fruit", quantity: 1, unit: "cup" },
          { item: "Fresh vegetables", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use less crackers and cheese.",
          "Add more fresh fruit and vegetables.",
          "Focus on colorful variety.",
          "Enjoy as a light snack."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Cheese Power Plate",
        description: "Extra cheese with protein crackers",
        healthBadges: ["Vegetarian", "High Protein", "Satisfying"],
        ingredients: [
          { item: "Protein crackers", quantity: 8, unit: "pieces" },
          { item: "Mixed cheese", quantity: 2, unit: "oz" },
          { item: "Hard-boiled egg", quantity: 1, unit: "large" },
          { item: "Nuts", quantity: 1, unit: "tbsp" },
          { item: "Dried fruit", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein-enriched crackers.",
          "Add extra cheese for protein.",
          "Include hard-boiled egg.",
          "Add nuts for healthy fats and protein."
        ]
      }
    }
  },

  {
    id: "smoothie-snack",
    slug: "smoothie-snack",
    name: "Quick Protein Smoothie",
    description: "Blended drink packed with nutrients",
    baseServings: 1,
    image: "/images/templates/smoothie-snack.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Berry Smoothie",
        description: "Traditional fruit smoothie",
        healthBadges: ["Vegetarian", "Antioxidant Rich", "Quick Prep"],
        ingredients: [
          { item: "Frozen mixed berries", quantity: 1, unit: "cup" },
          { item: "Banana", quantity: 0.5, unit: "medium" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Almond milk", quantity: 0.75, unit: "cup" },
          { item: "Honey", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Add all ingredients to blender.",
          "Blend until smooth.",
          "Add more liquid if too thick.",
          "Pour and enjoy immediately."
        ]
      },
      light: {
        slug: "light",
        name: "Light Green Smoothie",
        description: "Extra greens with less fruit",
        healthBadges: ["Vegetarian", "Low Calorie", "Detox"],
        ingredients: [
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Frozen berries", quantity: 0.5, unit: "cup" },
          { item: "Banana", quantity: 0.5, unit: "small" },
          { item: "Unsweetened almond milk", quantity: 1, unit: "cup" },
          { item: "Stevia", quantity: 1, unit: "packet" }
        ],
        instructions: [
          "Add greens first for smooth blending.",
          "Use less fruit for fewer calories.",
          "Sweeten with stevia if needed.",
          "Blend until completely smooth."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Smoothie",
        description: "Maximum protein with protein powder",
        healthBadges: ["Vegetarian", "Very High Protein", "Post Workout"],
        ingredients: [
          { item: "Frozen berries", quantity: 0.75, unit: "cup" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Almond butter", quantity: 1, unit: "tbsp" },
          { item: "Milk", quantity: 0.75, unit: "cup" },
          { item: "Chia seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Add protein powder and Greek yogurt.",
          "Include almond butter for healthy fats.",
          "Add chia seeds for extra nutrition.",
          "Perfect post-workout protein smoothie."
        ]
      }
    }
  }
];