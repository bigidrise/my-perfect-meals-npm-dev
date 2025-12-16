export interface LunchMeal {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  image: string;
  templates: {
    classic: LunchTemplate;
    light: LunchTemplate;
    highProtein: LunchTemplate;
  };
}

export interface LunchTemplate {
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

export const lunchMealsData: LunchMeal[] = [
  {
    id: "grilled-chicken-salad",
    slug: "grilled-chicken-salad",
    name: "Grilled Chicken Salad",
    description: "Fresh mixed greens with perfectly grilled chicken breast",
    baseServings: 2,
    image: "/images/templates/lunch-chicken-salad.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Grilled Chicken",
        description: "Traditional chicken salad with mixed vegetables",
        healthBadges: ["High Protein", "Heart Healthy", "Gluten Free"],
        ingredients: [
          { item: "Mixed greens", quantity: 4, unit: "cups" },
          { item: "Chicken breast", quantity: 8, unit: "oz" },
          { item: "Cherry tomatoes", quantity: 1, unit: "cup" },
          { item: "Cucumber", quantity: 1, unit: "medium" },
          { item: "Red onion", quantity: 0.25, unit: "cup" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Salt and pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Season chicken breast with salt, pepper, and herbs",
          "Grill chicken over medium heat for 6-7 minutes per side until cooked through",
          "Let chicken rest for 5 minutes, then slice into strips",
          "Wash and dry mixed greens, arrange in serving bowls",
          "Add cherry tomatoes, sliced cucumber, and red onion",
          "Top with sliced grilled chicken",
          "Whisk olive oil and lemon juice for dressing",
          "Drizzle dressing over salad and serve immediately"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Chicken",
        description: "Lighter version with extra vegetables and herbs",
        healthBadges: ["Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Spring mix", quantity: 5, unit: "cups" },
          { item: "Chicken breast", quantity: 6, unit: "oz" },
          { item: "Cherry tomatoes", quantity: 1.5, unit: "cups" },
          { item: "Bell pepper", quantity: 1, unit: "medium" },
          { item: "Radishes", quantity: 0.5, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Grill chicken with minimal oil and season with herbs",
          "Slice into thin strips and let cool",
          "Combine spring mix with extra vegetables",
          "Add fresh herbs for enhanced flavor",
          "Create light dressing with lemon and balsamic",
          "Toss salad gently with dressing",
          "Top with sliced chicken and serve"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Chicken",
        description: "Extra protein with quinoa and Greek yogurt dressing",
        healthBadges: ["Very High Protein", "Post Workout", "Muscle Building"],
        ingredients: [
          { item: "Mixed greens", quantity: 3, unit: "cups" },
          { item: "Chicken breast", quantity: 10, unit: "oz" },
          { item: "Cooked quinoa", quantity: 1, unit: "cup" },
          { item: "Hard-boiled eggs", quantity: 2, unit: "large" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.75, unit: "cup" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Grill extra portion of chicken for maximum protein",
          "Cook quinoa according to package directions",
          "Hard-boil eggs and slice when cool",
          "Create protein-rich base with greens and quinoa",
          "Add sliced chicken, eggs, and avocado",
          "Mix Greek yogurt with lemon for creamy dressing",
          "Combine all ingredients and serve as power meal"
        ]
      }
    }
  },
  {
    id: "turkey-avocado-wrap",
    slug: "turkey-avocado-wrap",
    name: "Turkey Avocado Wrap",
    description: "Whole wheat wrap with lean turkey and fresh avocado",
    baseServings: 1,
    image: "/images/templates/lunch-turkey-wrap.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Turkey Wrap",
        description: "Traditional turkey wrap with fresh vegetables",
        healthBadges: ["Lean Protein", "Heart Healthy", "Portable"],
        ingredients: [
          { item: "Whole wheat tortilla", quantity: 1, unit: "large" },
          { item: "Sliced turkey breast", quantity: 4, unit: "oz" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Lettuce leaves", quantity: 3, unit: "large" },
          { item: "Tomato", quantity: 0.5, unit: "medium" },
          { item: "Swiss cheese", quantity: 1, unit: "slice" },
          { item: "Mustard", quantity: 1, unit: "tsp" },
          { item: "Mayo", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Lay tortilla flat and spread mustard and mayo",
          "Layer turkey slices evenly across tortilla",
          "Add cheese slice and lettuce leaves",
          "Slice avocado and tomato, arrange on top",
          "Roll tightly from bottom, tucking in sides",
          "Secure with toothpick if needed",
          "Cut in half diagonally and serve"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Turkey",
        description: "Reduced calorie version with extra vegetables",
        healthBadges: ["Low Calorie", "High Fiber", "Weight Management"],
        ingredients: [
          { item: "Spinach tortilla", quantity: 1, unit: "medium" },
          { item: "Sliced turkey breast", quantity: 3, unit: "oz" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Spinach leaves", quantity: 1, unit: "cup" },
          { item: "Cucumber", quantity: 0.25, unit: "cup" },
          { item: "Bell pepper", quantity: 0.25, unit: "cup" },
          { item: "Sprouts", quantity: 0.25, unit: "cup" },
          { item: "Hummus", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use spinach tortilla for extra nutrients",
          "Spread hummus instead of mayo for lighter option",
          "Layer with plenty of fresh vegetables",
          "Use smaller portion of avocado for flavor",
          "Roll carefully to keep vegetables secure",
          "Slice and serve with side of fresh fruit"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein-Packed Turkey",
        description: "Extra turkey and protein additions for muscle building",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "High-protein tortilla", quantity: 1, unit: "large" },
          { item: "Sliced turkey breast", quantity: 6, unit: "oz" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Egg whites", quantity: 2, unit: "cooked" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Cheese", quantity: 1, unit: "slice" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" }
        ],
        instructions: [
          "Mix Greek yogurt with protein powder for spread",
          "Layer extra turkey for maximum protein",
          "Add cooked egg whites for additional protein",
          "Include cheese for complete amino acids",
          "Roll tightly and serve with protein shake",
          "Perfect post-workout meal option"
        ]
      }
    }
  },
  {
    id: "salmon-quinoa-bowl",
    slug: "salmon-quinoa-bowl",
    name: "Salmon Quinoa Bowl",
    description: "Nutritious bowl with baked salmon and fluffy quinoa",
    baseServings: 2,
    image: "/images/templates/lunch-salmon-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Salmon Bowl",
        description: "Perfect balance of protein, grains, and vegetables",
        healthBadges: ["Omega-3 Rich", "Heart Healthy", "Anti-Inflammatory"],
        ingredients: [
          { item: "Salmon fillet", quantity: 8, unit: "oz" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Broccoli", quantity: 2, unit: "cups" },
          { item: "Carrots", quantity: 1, unit: "medium" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Sesame oil", quantity: 1, unit: "tbsp" },
          { item: "Soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Lemon", quantity: 0.5, unit: "medium" }
        ],
        instructions: [
          "Cook quinoa according to package directions",
          "Season salmon with salt, pepper, and lemon",
          "Bake salmon at 400°F for 12-15 minutes",
          "Steam broccoli and carrots until tender",
          "Cook edamame according to package directions",
          "Assemble bowls with quinoa as base",
          "Top with vegetables and flaked salmon",
          "Drizzle with sesame oil and soy sauce"
        ]
      },
      light: {
        slug: "light",
        name: "Light Asian Bowl",
        description: "Lighter version with more vegetables and herbs",
        healthBadges: ["Low Calorie", "Diabetic Friendly", "Anti-Inflammatory"],
        ingredients: [
          { item: "Salmon fillet", quantity: 6, unit: "oz" },
          { item: "Cauliflower rice", quantity: 2, unit: "cups" },
          { item: "Bok choy", quantity: 2, unit: "cups" },
          { item: "Snow peas", quantity: 1, unit: "cup" },
          { item: "Bean sprouts", quantity: 0.5, unit: "cup" },
          { item: "Fresh ginger", quantity: 1, unit: "tsp" },
          { item: "Rice vinegar", quantity: 1, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use cauliflower rice instead of quinoa",
          "Grill salmon with minimal oil",
          "Stir-fry vegetables quickly to retain crunch",
          "Season with fresh ginger and rice vinegar",
          "Serve with extra fresh herbs",
          "Garnish with sesame seeds for flavor"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Power Salmon Bowl",
        description: "Extra salmon and protein-rich additions",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Salmon fillet", quantity: 12, unit: "oz" },
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Edamame", quantity: 1, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Tahini", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Prepare extra large portion of salmon",
          "Add protein-rich edamame and hemp seeds",
          "Include Greek yogurt in the dressing",
          "Layer spinach for extra nutrients",
          "Top with avocado for healthy fats",
          "Drizzle with tahini for complete proteins"
        ]
      }
    }
  },
  {
    id: "mediterranean-pita",
    slug: "mediterranean-pita",
    name: "Mediterranean Pita",
    description: "Fresh pita filled with Mediterranean flavors",
    baseServings: 1,
    image: "/images/templates/lunch-med-pita.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Mediterranean",
        description: "Traditional Mediterranean ingredients in warm pita",
        healthBadges: ["Heart Healthy", "Mediterranean Diet", "Antioxidant Rich"],
        ingredients: [
          { item: "Whole wheat pita", quantity: 1, unit: "large" },
          { item: "Hummus", quantity: 3, unit: "tbsp" },
          { item: "Grilled chicken", quantity: 3, unit: "oz" },
          { item: "Cucumber", quantity: 0.25, unit: "cup" },
          { item: "Tomatoes", quantity: 0.25, unit: "cup" },
          { item: "Red onion", quantity: 2, unit: "tbsp" },
          { item: "Feta cheese", quantity: 2, unit: "tbsp" },
          { item: "Olives", quantity: 8, unit: "pieces" }
        ],
        instructions: [
          "Warm pita bread slightly",
          "Spread hummus generously inside pocket",
          "Add grilled chicken strips",
          "Layer with fresh cucumber and tomatoes",
          "Sprinkle with red onion and feta",
          "Add olives for authentic flavor",
          "Serve immediately while warm"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Pita",
        description: "Vegetable-focused version with less cheese",
        healthBadges: ["Low Calorie", "High Fiber", "Vegetable Rich"],
        ingredients: [
          { item: "Whole wheat pita", quantity: 1, unit: "medium" },
          { item: "Hummus", quantity: 2, unit: "tbsp" },
          { item: "Grilled vegetables", quantity: 0.5, unit: "cup" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Tomatoes", quantity: 0.5, unit: "cup" },
          { item: "Sprouts", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" },
          { item: "Fresh herbs", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use smaller pita for portion control",
          "Load with extra fresh vegetables",
          "Add sprouts for crunch and nutrition",
          "Season with fresh herbs and lemon",
          "Skip cheese for lower calorie option",
          "Serve with side salad"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Mediterranean",
        description: "Extra protein with chicken and Greek yogurt",
        healthBadges: ["Very High Protein", "Post Workout", "Muscle Building"],
        ingredients: [
          { item: "Protein pita", quantity: 1, unit: "large" },
          { item: "Greek yogurt", quantity: 3, unit: "tbsp" },
          { item: "Grilled chicken", quantity: 5, unit: "oz" },
          { item: "Hard-boiled egg", quantity: 1, unit: "large" },
          { item: "Feta cheese", quantity: 3, unit: "tbsp" },
          { item: "Cucumber", quantity: 0.25, unit: "cup" },
          { item: "Tomatoes", quantity: 0.25, unit: "cup" },
          { item: "Protein powder", quantity: 0.25, unit: "scoop" }
        ],
        instructions: [
          "Mix Greek yogurt with protein powder",
          "Use extra chicken for maximum protein",
          "Add hard-boiled egg for complete amino acids",
          "Include more feta for additional protein",
          "Layer all ingredients generously",
          "Perfect post-workout Mediterranean meal"
        ]
      }
    }
  },
  {
    id: "asian-lettuce-wraps",
    slug: "asian-lettuce-wraps",
    name: "Asian Lettuce Wraps",
    description: "Fresh lettuce cups filled with savory Asian-inspired filling",
    baseServings: 2,
    image: "/images/templates/lunch-lettuce-wraps.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Asian Wraps",
        description: "Traditional filling with ground turkey and vegetables",
        healthBadges: ["Low Carb", "Gluten Free", "Fresh & Light"],
        ingredients: [
          { item: "Butter lettuce", quantity: 8, unit: "leaves" },
          { item: "Ground turkey", quantity: 8, unit: "oz" },
          { item: "Water chestnuts", quantity: 0.5, unit: "cup" },
          { item: "Mushrooms", quantity: 1, unit: "cup" },
          { item: "Green onions", quantity: 3, unit: "stalks" },
          { item: "Soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Sesame oil", quantity: 1, unit: "tsp" },
          { item: "Fresh ginger", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Separate and wash lettuce leaves carefully",
          "Cook ground turkey in large skillet",
          "Add diced mushrooms and water chestnuts",
          "Season with soy sauce, sesame oil, and ginger",
          "Stir in chopped green onions",
          "Serve filling in lettuce cups",
          "Garnish with extra green onions"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Wraps",
        description: "Extra vegetables with lean protein",
        healthBadges: ["Very Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Boston lettuce", quantity: 10, unit: "leaves" },
          { item: "Ground turkey breast", quantity: 6, unit: "oz" },
          { item: "Cabbage", quantity: 1, unit: "cup" },
          { item: "Carrots", quantity: 0.5, unit: "cup" },
          { item: "Bean sprouts", quantity: 0.5, unit: "cup" },
          { item: "Rice vinegar", quantity: 1, unit: "tbsp" },
          { item: "Low-sodium soy sauce", quantity: 1, unit: "tbsp" },
          { item: "Fresh cilantro", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra lettuce cups for more volume",
          "Add plenty of crunchy vegetables",
          "Season lightly with rice vinegar",
          "Use low-sodium soy sauce",
          "Garnish with fresh cilantro",
          "Serve with lime wedges"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Power Protein Wraps",
        description: "Double protein with turkey and tofu",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Iceberg lettuce", quantity: 6, unit: "leaves" },
          { item: "Ground turkey", quantity: 6, unit: "oz" },
          { item: "Firm tofu", quantity: 4, unit: "oz" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Egg whites", quantity: 2, unit: "cooked" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Combine ground turkey with cubed tofu",
          "Add cooked egg whites for extra protein",
          "Include edamame for plant protein",
          "Mix protein powder into sauce",
          "Load lettuce cups generously",
          "Sprinkle with sesame seeds for crunch"
        ]
      }
    }
  },
  {
    id: "veggie-burger-bowl",
    slug: "veggie-burger-bowl",
    name: "Veggie Burger Bowl",
    description: "Deconstructed veggie burger in a nutritious bowl",
    baseServings: 1,
    image: "/images/templates/lunch-veggie-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Bowl",
        description: "Traditional veggie burger ingredients in bowl form",
        healthBadges: ["Plant Based", "High Fiber", "Antioxidant Rich"],
        ingredients: [
          { item: "Black bean patty", quantity: 1, unit: "large" },
          { item: "Mixed greens", quantity: 2, unit: "cups" },
          { item: "Sweet potato", quantity: 0.5, unit: "medium" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Tomato", quantity: 0.5, unit: "medium" },
          { item: "Red onion", quantity: 2, unit: "tbsp" },
          { item: "Tahini", quantity: 2, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Cook black bean patty according to directions",
          "Roast sweet potato cubes until tender",
          "Arrange mixed greens in bowl",
          "Break up veggie patty over greens",
          "Add roasted sweet potato and fresh vegetables",
          "Top with sliced avocado",
          "Drizzle with tahini-lemon dressing"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Bowl",
        description: "Extra vegetables with lighter dressing",
        healthBadges: ["Low Calorie", "Very High Fiber", "Weight Management"],
        ingredients: [
          { item: "Veggie patty", quantity: 0.75, unit: "patty" },
          { item: "Spinach", quantity: 3, unit: "cups" },
          { item: "Zucchini", quantity: 0.5, unit: "medium" },
          { item: "Bell peppers", quantity: 0.5, unit: "cup" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.75, unit: "cup" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" },
          { item: "Herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use smaller portion of veggie patty",
          "Load with extra fresh vegetables",
          "Spiralize zucchini for extra volume",
          "Use light balsamic dressing",
          "Add fresh herbs for flavor",
          "Serve with lemon wedges"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Bowl",
        description: "Extra protein with quinoa and nuts",
        healthBadges: ["High Plant Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Protein veggie patty", quantity: 1.5, unit: "patties" },
          { item: "Quinoa", quantity: 0.5, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Pumpkin seeds", quantity: 1, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 3, unit: "tbsp" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra veggie patties for more protein",
          "Add quinoa for complete amino acids",
          "Include various seeds and nuts",
          "Mix Greek yogurt into dressing",
          "Add edamame for plant protein",
          "Sprinkle with nutritional yeast"
        ]
      }
    }
  },
  {
    id: "tuna-avocado-salad",
    slug: "tuna-avocado-salad",
    name: "Tuna Avocado Salad",
    description: "Fresh tuna salad with creamy avocado and crisp vegetables",
    baseServings: 2,
    image: "/images/templates/lunch-tuna-salad.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Tuna Salad",
        description: "Traditional tuna salad with a healthy twist",
        healthBadges: ["Omega-3 Rich", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Canned tuna in water", quantity: 2, unit: "cans" },
          { item: "Avocado", quantity: 1, unit: "medium" },
          { item: "Celery", quantity: 0.5, unit: "cup" },
          { item: "Red onion", quantity: 0.25, unit: "cup" },
          { item: "Hard-boiled eggs", quantity: 2, unit: "large" },
          { item: "Greek yogurt", quantity: 3, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Dijon mustard", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Drain tuna and flake into bowl",
          "Mash half the avocado, dice the rest",
          "Add diced celery and red onion",
          "Chop hard-boiled eggs and fold in",
          "Mix Greek yogurt with lemon and mustard",
          "Combine all ingredients gently",
          "Serve on whole grain bread or crackers"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Tuna",
        description: "Extra vegetables with minimal added fats",
        healthBadges: ["Low Calorie", "High Protein", "Diabetic Friendly"],
        ingredients: [
          { item: "Canned tuna in water", quantity: 2, unit: "cans" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Bell pepper", quantity: 0.5, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.75, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Capers", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use less avocado, more vegetables",
          "Add plenty of fresh, crunchy vegetables",
          "Season with fresh herbs and capers",
          "Use lemon juice instead of mayo",
          "Serve over greens instead of bread",
          "Add extra herbs for flavor"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Tuna Power",
        description: "Extra tuna and protein additions",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Canned tuna in water", quantity: 3, unit: "cans" },
          { item: "Avocado", quantity: 0.75, unit: "medium" },
          { item: "Hard-boiled eggs", quantity: 3, unit: "large" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Pumpkin seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra tuna for maximum protein",
          "Add more hard-boiled eggs",
          "Mix protein powder into Greek yogurt",
          "Include cottage cheese for texture",
          "Add edamame for plant protein",
          "Top with pumpkin seeds for crunch"
        ]
      }
    }
  },
  {
    id: "chickpea-curry-bowl",
    slug: "chickpea-curry-bowl",
    name: "Chickpea Curry Bowl",
    description: "Warming curry with protein-rich chickpeas over rice",
    baseServings: 2,
    image: "/images/templates/lunch-chickpea-curry.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Curry Bowl",
        description: "Traditional curry spices with creamy coconut",
        healthBadges: ["Plant Based", "High Fiber", "Anti-Inflammatory"],
        ingredients: [
          { item: "Chickpeas", quantity: 1.5, unit: "cups" },
          { item: "Coconut milk", quantity: 0.5, unit: "cup" },
          { item: "Brown rice", quantity: 1, unit: "cup" },
          { item: "Onion", quantity: 1, unit: "medium" },
          { item: "Garlic", quantity: 3, unit: "cloves" },
          { item: "Curry powder", quantity: 2, unit: "tsp" },
          { item: "Turmeric", quantity: 1, unit: "tsp" },
          { item: "Spinach", quantity: 2, unit: "cups" }
        ],
        instructions: [
          "Cook brown rice according to package directions",
          "Sauté onion and garlic until fragrant",
          "Add curry powder and turmeric, cook 1 minute",
          "Add chickpeas and coconut milk",
          "Simmer 15 minutes until thickened",
          "Stir in spinach until wilted",
          "Serve over rice with fresh cilantro"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Curry",
        description: "Extra vegetables with cauliflower rice",
        healthBadges: ["Low Calorie", "Very High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Chickpeas", quantity: 1, unit: "cup" },
          { item: "Light coconut milk", quantity: 0.25, unit: "cup" },
          { item: "Cauliflower rice", quantity: 2, unit: "cups" },
          { item: "Bell peppers", quantity: 1, unit: "cup" },
          { item: "Zucchini", quantity: 1, unit: "cup" },
          { item: "Curry powder", quantity: 1.5, unit: "tsp" },
          { item: "Vegetable broth", quantity: 0.5, unit: "cup" },
          { item: "Fresh cilantro", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use cauliflower rice instead of brown rice",
          "Add extra vegetables for volume",
          "Use light coconut milk and broth",
          "Load with fresh herbs and spices",
          "Serve with lime wedges",
          "Add extra cilantro for freshness"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Curry Power",
        description: "Extra chickpeas and protein additions",
        healthBadges: ["High Plant Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Chickpeas", quantity: 2, unit: "cups" },
          { item: "Red lentils", quantity: 0.5, unit: "cup" },
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Coconut milk", quantity: 0.5, unit: "cup" },
          { item: "Curry powder", quantity: 2, unit: "tsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Add red lentils for extra plant protein",
          "Use quinoa instead of rice for complete proteins",
          "Stir in Greek yogurt at end for creaminess",
          "Top with hemp seeds for omega-3s",
          "Add nutritional yeast for B vitamins",
          "Perfect high-protein plant meal"
        ]
      }
    }
  },
  {
    id: "steak-salad-bowl",
    slug: "steak-salad-bowl",
    name: "Steak Salad Bowl",
    description: "Tender grilled steak over fresh mixed greens",
    baseServings: 2,
    image: "/images/templates/lunch-steak-salad.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Steak Salad",
        description: "Perfectly grilled steak with traditional fixings",
        healthBadges: ["High Protein", "Iron Rich", "Low Carb"],
        ingredients: [
          { item: "Sirloin steak", quantity: 8, unit: "oz" },
          { item: "Mixed greens", quantity: 4, unit: "cups" },
          { item: "Cherry tomatoes", quantity: 1, unit: "cup" },
          { item: "Blue cheese", quantity: 0.25, unit: "cup" },
          { item: "Red onion", quantity: 0.25, unit: "cup" },
          { item: "Balsamic vinegar", quantity: 2, unit: "tbsp" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Croutons", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Season steak with salt and pepper",
          "Grill to desired doneness, let rest 5 minutes",
          "Slice steak against the grain",
          "Arrange mixed greens in serving bowls",
          "Top with tomatoes, red onion, and blue cheese",
          "Add sliced steak and croutons",
          "Drizzle with balsamic and olive oil"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Steak",
        description: "Leaner cut with extra vegetables and herbs",
        healthBadges: ["Lean Protein", "Low Calorie", "High Iron"],
        ingredients: [
          { item: "Lean steak", quantity: 6, unit: "oz" },
          { item: "Arugula", quantity: 3, unit: "cups" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Cucumber", quantity: 1, unit: "cup" },
          { item: "Radishes", quantity: 0.5, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Choose leaner cut like sirloin tip",
          "Grill with minimal oil",
          "Use extra leafy greens for volume",
          "Add plenty of fresh vegetables",
          "Season with herbs and lemon",
          "Skip croutons and cheese for lighter option"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Steak Power",
        description: "Extra steak with protein-rich additions",
        healthBadges: ["Very High Protein", "Iron Rich", "Muscle Building"],
        ingredients: [
          { item: "Ribeye steak", quantity: 12, unit: "oz" },
          { item: "Mixed greens", quantity: 3, unit: "cups" },
          { item: "Hard-boiled eggs", quantity: 2, unit: "large" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Cheese", quantity: 0.5, unit: "cup" },
          { item: "Protein croutons", quantity: 0.5, unit: "cup" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use larger, fattier cut for more protein",
          "Add hard-boiled eggs for complete amino acids",
          "Include Greek yogurt in dressing",
          "Add extra cheese for protein",
          "Use protein-enriched croutons",
          "Perfect post-workout power meal"
        ]
      }
    }
  },
  {
    id: "buddha-bowl",
    slug: "buddha-bowl",
    name: "Buddha Bowl",
    description: "Colorful bowl with variety of healthy ingredients",
    baseServings: 1,
    image: "/images/templates/lunch-buddha-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Buddha Bowl",
        description: "Balanced bowl with grains, proteins, and vegetables",
        healthBadges: ["Nutrient Dense", "Antioxidant Rich", "Balanced Macros"],
        ingredients: [
          { item: "Brown rice", quantity: 0.5, unit: "cup" },
          { item: "Roasted chickpeas", quantity: 0.5, unit: "cup" },
          { item: "Sweet potato", quantity: 0.5, unit: "medium" },
          { item: "Broccoli", quantity: 0.75, unit: "cup" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Shredded carrots", quantity: 0.25, unit: "cup" },
          { item: "Tahini", quantity: 2, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Cook brown rice according to package directions",
          "Roast sweet potato cubes and broccoli",
          "Season and roast chickpeas until crispy",
          "Arrange ingredients in separate sections of bowl",
          "Add sliced avocado and raw carrots",
          "Whisk tahini with lemon juice for dressing",
          "Drizzle dressing over bowl before serving"
        ]
      },
      light: {
        slug: "light",
        name: "Light Rainbow Bowl",
        description: "Extra vegetables with cauliflower rice base",
        healthBadges: ["Very Low Calorie", "High Fiber", "Detox Friendly"],
        ingredients: [
          { item: "Cauliflower rice", quantity: 1, unit: "cup" },
          { item: "Steamed edamame", quantity: 0.5, unit: "cup" },
          { item: "Roasted beets", quantity: 0.5, unit: "cup" },
          { item: "Steamed broccoli", quantity: 1, unit: "cup" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Sprouts", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use cauliflower rice as low-carb base",
          "Steam vegetables lightly to retain nutrients",
          "Add raw vegetables for extra crunch",
          "Season with fresh herbs and lemon",
          "Skip high-calorie additions",
          "Focus on colorful variety"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Buddha Power",
        description: "Multiple protein sources for muscle building",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Post Workout"],
        ingredients: [
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Grilled tofu", quantity: 4, unit: "oz" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Hard-boiled egg", quantity: 1, unit: "large" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Tahini", quantity: 2, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use quinoa for complete amino acids",
          "Add multiple protein sources",
          "Include hemp seeds and nutritional yeast",
          "Mix Greek yogurt into tahini dressing",
          "Layer proteins throughout bowl",
          "Perfect for post-workout recovery"
        ]
      }
    }
  },

  // NEW LUNCH MEALS
  {
    id: "chickpea-salad-sandwich",
    slug: "chickpea-salad-sandwich", 
    name: "Chickpea Salad Sandwich",
    description: "Plant-based protein sandwich with mashed chickpeas",
    baseServings: 1,
    image: "/images/templates/chickpea-salad-sandwich.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Chickpea Salad",
        description: "Traditional chickpea salad with fresh vegetables.",
        healthBadges: ["Vegan", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Chickpeas, rinsed", quantity: 0.75, unit: "cup" },
          { item: "Celery, minced", quantity: 0.25, unit: "cup" },
          { item: "Red onion, minced", quantity: 0.25, unit: "cup" },
          { item: "Light mayo", quantity: 2, unit: "tbsp" },
          { item: "Whole-grain bread", quantity: 2, unit: "slices" },
          { item: "Lettuce", quantity: 2, unit: "leaves" }
        ],
        instructions: [
          "Mash chickpeas with a fork, leaving some chunks.",
          "Mix in celery, onion, and mayo.",
          "Season with salt and pepper to taste.",
          "Assemble sandwich with lettuce and serve."
        ]
      },
      light: {
        slug: "light", 
        name: "Light Chickpea Wrap",
        description: "Lower calorie version with yogurt dressing.",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Chickpeas, rinsed", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Cucumber, diced", quantity: 0.5, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Whole wheat wrap", quantity: 1, unit: "small" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Lightly mash chickpeas with Greek yogurt.",
          "Add cucumber and lemon juice.",
          "Wrap in spinach and small tortilla.",
          "Roll tightly and slice in half."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Chickpea",
        description: "Extra protein with added tahini and hemp seeds.",
        healthBadges: ["Vegan", "Very High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Chickpeas, rinsed", quantity: 1, unit: "cup" },
          { item: "Tahini", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Protein bread", quantity: 2, unit: "slices" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" },
          { item: "Sunflower seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Mash chickpeas with tahini for extra protein.",
          "Add hemp seeds and nutritional yeast.",
          "Use protein-enriched bread.",
          "Top with sunflower seeds for crunch and nutrition."
        ]
      }
    }
  },

  {
    id: "hummus-veggie-wrap",
    slug: "hummus-veggie-wrap",
    name: "Hummus Veggie Wrap", 
    description: "Fresh and light wrap packed with vegetables and hummus",
    baseServings: 1,
    image: "/images/templates/hummus-veggie-wrap.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Hummus Wrap",
        description: "Traditional veggie wrap with homemade-style hummus.",
        healthBadges: ["Vegan", "High Fiber", "Heart Healthy"],
        ingredients: [
          { item: "Whole-wheat tortilla", quantity: 1, unit: "large" },
          { item: "Hummus", quantity: 3, unit: "tbsp" },
          { item: "Cucumber, sliced", quantity: 0.5, unit: "cup" },
          { item: "Bell peppers, sliced", quantity: 0.5, unit: "cup" },
          { item: "Shredded carrots", quantity: 0.25, unit: "cup" },
          { item: "Sprouts", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Spread hummus evenly on tortilla.",
          "Layer vegetables in colorful rows.",
          "Add sprouts for extra crunch.",
          "Roll tightly and slice diagonally."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Wrap",
        description: "Extra vegetables with reduced hummus for fewer calories.",
        healthBadges: ["Vegan", "Low Calorie", "Nutrient Dense"],
        ingredients: [
          { item: "Small whole-wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Hummus", quantity: 2, unit: "tbsp" },
          { item: "Mixed vegetables", quantity: 1.5, unit: "cups" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use smaller tortilla and less hummus.",
          "Pack with extra vegetables for volume.", 
          "Add fresh herbs for flavor without calories.",
          "Squeeze lemon for brightness."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Veggie Power Wrap",
        description: "Extra hummus with protein additions.",
        healthBadges: ["Vegan", "High Protein", "Complete Nutrition"],
        ingredients: [
          { item: "Protein tortilla", quantity: 1, unit: "large" },
          { item: "Hummus", quantity: 4, unit: "tbsp" },
          { item: "Hemp hearts", quantity: 2, unit: "tbsp" },
          { item: "Mixed vegetables", quantity: 1, unit: "cup" },
          { item: "Sunflower seeds", quantity: 1, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein-enriched tortilla for base.",
          "Add extra hummus for more plant protein.",
          "Sprinkle hemp hearts and sunflower seeds.",
          "Roll with nutritional yeast for B vitamins."
        ]
      }
    }
  },

  {
    id: "caprese-sandwich-light",
    slug: "caprese-sandwich-light",
    name: "Caprese Sandwich (Light)",
    description: "Italian-inspired sandwich with fresh mozzarella and basil",
    baseServings: 1,
    image: "/images/templates/caprese-sandwich.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Caprese",
        description: "Traditional caprese with fresh mozzarella and tomatoes.",
        healthBadges: ["Vegetarian", "Heart Healthy", "Mediterranean"],
        ingredients: [
          { item: "Whole-grain bread", quantity: 2, unit: "slices" },
          { item: "Fresh mozzarella", quantity: 2, unit: "oz" },
          { item: "Tomato, sliced", quantity: 1, unit: "medium" },
          { item: "Fresh basil", quantity: 6, unit: "leaves" },
          { item: "Balsamic glaze", quantity: 1, unit: "tbsp" },
          { item: "Extra virgin olive oil", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Layer mozzarella and tomato on bread.",
          "Add fresh basil leaves.",
          "Drizzle with balsamic glaze and olive oil.",
          "Serve immediately for best texture."
        ]
      },
      light: {
        slug: "light",
        name: "Light Caprese",
        description: "Reduced cheese version with extra vegetables.",
        healthBadges: ["Vegetarian", "Low Calorie", "Fresh"],
        ingredients: [
          { item: "Thin whole-grain bread", quantity: 2, unit: "slices" },
          { item: "Part-skim mozzarella", quantity: 1, unit: "oz" },
          { item: "Large tomato, sliced", quantity: 1, unit: "whole" },
          { item: "Fresh basil", quantity: 8, unit: "leaves" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" },
          { item: "Arugula", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use thinner bread and less cheese.",
          "Add extra tomato and greens for volume.",
          "Use balsamic vinegar instead of glaze.",
          "Pack with arugula for peppery flavor."
        ]
      },
      highProtein: {
        slug: "high-protein", 
        name: "Protein Caprese Power",
        description: "Extra mozzarella with protein additions.",
        healthBadges: ["Vegetarian", "High Protein", "Muscle Building"],
        ingredients: [
          { item: "Protein bread", quantity: 2, unit: "slices" },
          { item: "Fresh mozzarella", quantity: 3, unit: "oz" },
          { item: "Cottage cheese", quantity: 2, unit: "tbsp" },
          { item: "Tomato", quantity: 1, unit: "medium" },
          { item: "Fresh basil", quantity: 6, unit: "leaves" },
          { item: "Pine nuts", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein bread for extra protein base.",
          "Layer with extra mozzarella and cottage cheese.",
          "Add pine nuts for healthy fats and protein.",
          "Perfect post-workout Italian meal."
        ]
      }
    }
  },

  {
    id: "quinoa-chickpea-bowl",
    slug: "quinoa-chickpea-bowl", 
    name: "Quinoa Chickpea Bowl",
    description: "Complete protein bowl with quinoa and chickpeas",
    baseServings: 1,
    image: "/images/templates/quinoa-chickpea-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Power Bowl",
        description: "Balanced quinoa bowl with roasted vegetables.",
        healthBadges: ["Vegan", "Complete Protein", "Superfood"],
        ingredients: [
          { item: "Cooked quinoa", quantity: 1, unit: "cup" },
          { item: "Chickpeas", quantity: 0.5, unit: "cup" },
          { item: "Roasted vegetables", quantity: 1, unit: "cup" },
          { item: "Tahini dressing", quantity: 2, unit: "tbsp" },
          { item: "Pumpkin seeds", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Layer quinoa as base in bowl.",
          "Top with chickpeas and roasted vegetables.",
          "Drizzle with tahini dressing.",
          "Garnish with seeds and herbs."
        ]
      },
      light: {
        slug: "light",
        name: "Light Buddha Bowl",
        description: "More vegetables with lighter dressing.",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Cooked quinoa", quantity: 0.75, unit: "cup" },
          { item: "Chickpeas", quantity: 0.33, unit: "cup" },
          { item: "Raw and cooked vegetables", quantity: 1.5, unit: "cups" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use slightly less quinoa for fewer calories.",
          "Pack with extra vegetables for volume.",
          "Use lemon juice as light dressing.",
          "Add plenty of fresh herbs for flavor."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Buddha Bowl",
        description: "Double protein with quinoa, chickpeas, and seeds.",
        healthBadges: ["Vegan", "Very High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Cooked quinoa", quantity: 1.25, unit: "cups" },
          { item: "Chickpeas", quantity: 0.75, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Tahini", quantity: 3, unit: "tbsp" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra quinoa and chickpeas for protein.",
          "Add hemp seeds and edamame for complete amino acids.",
          "Use tahini generously for healthy fats.",
          "Sprinkle nutritional yeast for B vitamins."
        ]
      }
    }
  },

  {
    id: "grilled-cheese-tomato",
    slug: "grilled-cheese-tomato",
    name: "Grilled Cheese + Tomato Soup",
    description: "Classic comfort food combo with whole grain bread",
    baseServings: 1,
    image: "/images/templates/grilled-cheese-soup.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Comfort Combo",
        description: "Traditional grilled cheese with homestyle tomato soup.",
        healthBadges: ["Vegetarian", "Comfort Food", "Nostalgic"],
        ingredients: [
          { item: "Whole-grain bread", quantity: 2, unit: "slices" },
          { item: "Cheddar cheese", quantity: 2, unit: "oz" },
          { item: "Butter", quantity: 1, unit: "tbsp" },
          { item: "Tomato soup", quantity: 1, unit: "cup" },
          { item: "Fresh basil", quantity: 2, unit: "leaves" }
        ],
        instructions: [
          "Butter bread and fill with cheese.",
          "Grill sandwich until golden and melty.",
          "Heat tomato soup and garnish with basil.",
          "Serve together for ultimate comfort."
        ]
      },
      light: {
        slug: "light",
        name: "Light Comfort Bowl",
        description: "Lower calorie version with open-faced sandwich.",
        healthBadges: ["Vegetarian", "Lower Calorie", "Portion Controlled"],
        ingredients: [
          { item: "Thin whole-grain bread", quantity: 1, unit: "slice" },
          { item: "Part-skim cheese", quantity: 1, unit: "oz" },
          { item: "Light tomato soup", quantity: 1.5, unit: "cups" },
          { item: "Fresh herbs", quantity: 1, unit: "tbsp" },
          { item: "Black pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Make open-faced sandwich to reduce calories.",
          "Use larger portion of light soup for satiety.",
          "Season soup with herbs and pepper.",
          "Enjoy mindfully for comfort satisfaction."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Comfort Power",
        description: "Extra cheese with protein additions.",
        healthBadges: ["Vegetarian", "High Protein", "Muscle Building"],
        ingredients: [
          { item: "Protein bread", quantity: 2, unit: "slices" },
          { item: "Mixed cheese", quantity: 3, unit: "oz" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Protein-enriched tomato soup", quantity: 1, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein bread and extra cheese.",
          "Add Greek yogurt to soup for protein boost.",
          "Sprinkle hemp seeds on sandwich.",
          "Perfect comfort food for active lifestyle."
        ]
      }
    }
  },

  {
    id: "falafel-pita",
    slug: "falafel-pita",
    name: "Falafel Pita Pocket",
    description: "Middle Eastern falafel with fresh vegetables in pita bread",
    baseServings: 1,
    image: "/images/templates/falafel-pita.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Falafel Pita",
        description: "Traditional falafel with tahini sauce",
        healthBadges: ["Vegan", "High Fiber", "Mediterranean"],
        ingredients: [
          { item: "Whole wheat pita", quantity: 1, unit: "large" },
          { item: "Falafel balls", quantity: 4, unit: "pieces" },
          { item: "Tahini sauce", quantity: 2, unit: "tbsp" },
          { item: "Lettuce", quantity: 0.5, unit: "cup" },
          { item: "Tomatoes, diced", quantity: 0.5, unit: "cup" },
          { item: "Cucumber, sliced", quantity: 0.25, unit: "cup" },
          { item: "Red onion", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Warm pita bread and falafel.",
          "Stuff pita with falafel balls.",
          "Add lettuce, tomatoes, cucumber, and onion.",
          "Drizzle generously with tahini sauce."
        ]
      },
      light: {
        slug: "light",
        name: "Light Falafel Bowl",
        description: "Deconstructed bowl with extra vegetables",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Falafel balls", quantity: 3, unit: "pieces" },
          { item: "Mixed greens", quantity: 2, unit: "cups" },
          { item: "Fresh vegetables", quantity: 1, unit: "cup" },
          { item: "Tahini", quantity: 1, unit: "tbsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Serve falafel over greens instead of pita.",
          "Load with fresh vegetables.",
          "Use light tahini dressing.",
          "Add herbs for extra flavor."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Falafel Power",
        description: "Extra falafel with protein additions",
        healthBadges: ["Vegan", "High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Protein pita", quantity: 1, unit: "large" },
          { item: "Falafel balls", quantity: 6, unit: "pieces" },
          { item: "Tahini", quantity: 3, unit: "tbsp" },
          { item: "Hummus", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Quinoa", quantity: 0.25, unit: "cup" },
          { item: "Fresh vegetables", quantity: 0.75, unit: "cup" }
        ],
        instructions: [
          "Use protein-enriched pita.",
          "Add extra falafel balls.",
          "Layer hummus and tahini for protein.",
          "Sprinkle with hemp seeds and quinoa."
        ]
      }
    }
  },

  {
    id: "blt-avocado",
    slug: "blt-avocado",
    name: "BLT with Avocado",
    description: "Classic BLT sandwich upgraded with creamy avocado",
    baseServings: 1,
    image: "/images/templates/blt-avocado.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic BLT+A",
        description: "Traditional BLT with fresh avocado",
        healthBadges: ["High Protein", "Satisfying", "Classic"],
        ingredients: [
          { item: "Whole wheat bread", quantity: 2, unit: "slices" },
          { item: "Bacon strips", quantity: 3, unit: "pieces" },
          { item: "Lettuce", quantity: 2, unit: "leaves" },
          { item: "Tomato, sliced", quantity: 3, unit: "slices" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Mayonnaise", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Toast bread to desired doneness.",
          "Cook bacon until crispy.",
          "Spread mayo on bread.",
          "Layer lettuce, tomato, bacon, and avocado."
        ]
      },
      light: {
        slug: "light",
        name: "Light Turkey BLT",
        description: "Turkey bacon with Greek yogurt spread",
        healthBadges: ["Lower Calorie", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Thin whole wheat bread", quantity: 2, unit: "slices" },
          { item: "Turkey bacon", quantity: 2, unit: "strips" },
          { item: "Lettuce", quantity: 3, unit: "leaves" },
          { item: "Tomato, sliced", quantity: 4, unit: "slices" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Greek yogurt", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use turkey bacon for less fat.",
          "Replace mayo with Greek yogurt.",
          "Add extra lettuce and tomato.",
          "Use less avocado to reduce calories."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power BLT",
        description: "Extra bacon and egg for maximum protein",
        healthBadges: ["Very High Protein", "Muscle Building", "Filling"],
        ingredients: [
          { item: "Protein bread", quantity: 2, unit: "slices" },
          { item: "Bacon strips", quantity: 4, unit: "pieces" },
          { item: "Fried egg", quantity: 1, unit: "large" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Lettuce", quantity: 2, unit: "leaves" },
          { item: "Tomato", quantity: 2, unit: "slices" },
          { item: "Cheese", quantity: 1, unit: "slice" }
        ],
        instructions: [
          "Use protein bread for extra protein.",
          "Add fried egg and cheese.",
          "Use extra bacon strips.",
          "Perfect protein-packed lunch."
        ]
      }
    }
  },

  {
    id: "poke-bowl",
    slug: "poke-bowl",
    name: "Ahi Tuna Poke Bowl",
    description: "Hawaiian-style bowl with fresh raw tuna and vegetables",
    baseServings: 1,
    image: "/images/templates/poke-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Poke Bowl",
        description: "Traditional Hawaiian poke with soy and sesame",
        healthBadges: ["High Protein", "Omega-3 Rich", "Low Carb"],
        ingredients: [
          { item: "Sushi-grade ahi tuna", quantity: 4, unit: "oz" },
          { item: "Sushi rice", quantity: 0.75, unit: "cup" },
          { item: "Soy sauce", quantity: 1, unit: "tbsp" },
          { item: "Sesame oil", quantity: 1, unit: "tsp" },
          { item: "Edamame", quantity: 0.25, unit: "cup" },
          { item: "Cucumber", quantity: 0.25, unit: "cup" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Seaweed salad", quantity: 0.25, unit: "cup" },
          { item: "Sesame seeds", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Dice fresh tuna into cubes.",
          "Marinate in soy sauce and sesame oil.",
          "Prepare sushi rice and place in bowl.",
          "Top with tuna, edamame, cucumber, and avocado.",
          "Garnish with seaweed salad and sesame seeds."
        ]
      },
      light: {
        slug: "light",
        name: "Light Poke Salad",
        description: "Served over greens instead of rice",
        healthBadges: ["Low Calorie", "High Protein", "Omega-3 Rich"],
        ingredients: [
          { item: "Sushi-grade tuna", quantity: 3, unit: "oz" },
          { item: "Mixed greens", quantity: 2, unit: "cups" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Radishes", quantity: 0.25, unit: "cup" },
          { item: "Low-sodium soy sauce", quantity: 1, unit: "tsp" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Serve over greens instead of rice.",
          "Use less soy sauce, add lemon juice.",
          "Load with fresh vegetables.",
          "Keep toppings light and fresh."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Poke Power",
        description: "Extra tuna with protein-rich additions",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Sushi-grade tuna", quantity: 6, unit: "oz" },
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Marinated tofu", quantity: 2, unit: "oz" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" },
          { item: "Seaweed", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use extra tuna for maximum protein.",
          "Add quinoa and edamame for plant protein.",
          "Include marinated tofu for variety.",
          "Top with hemp seeds and plenty of seaweed."
        ]
      }
    }
  },

  {
    id: "minestrone-soup",
    slug: "minestrone-soup",
    name: "Hearty Minestrone Soup",
    description: "Italian vegetable soup with beans and pasta",
    baseServings: 2,
    image: "/images/templates/minestrone.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Minestrone",
        description: "Traditional Italian vegetable soup",
        healthBadges: ["Vegan", "High Fiber", "Heart Healthy"],
        ingredients: [
          { item: "Vegetable broth", quantity: 2, unit: "cups" },
          { item: "Cannellini beans", quantity: 1, unit: "cup" },
          { item: "Diced tomatoes", quantity: 1, unit: "cup" },
          { item: "Small pasta", quantity: 0.5, unit: "cup" },
          { item: "Carrots, diced", quantity: 0.5, unit: "cup" },
          { item: "Celery, diced", quantity: 0.5, unit: "cup" },
          { item: "Zucchini, diced", quantity: 0.5, unit: "cup" },
          { item: "Spinach", quantity: 1, unit: "cup" },
          { item: "Italian seasoning", quantity: 1, unit: "tsp" },
          { item: "Parmesan", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Sauté carrots and celery until soft.",
          "Add broth, tomatoes, and beans.",
          "Simmer 15 minutes, add pasta and zucchini.",
          "Cook until pasta is tender.",
          "Stir in spinach until wilted.",
          "Serve topped with parmesan."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Minestrone",
        description: "Extra vegetables with no pasta",
        healthBadges: ["Vegan", "Low Calorie", "Very High Fiber"],
        ingredients: [
          { item: "Vegetable broth", quantity: 2.5, unit: "cups" },
          { item: "White beans", quantity: 0.75, unit: "cup" },
          { item: "Mixed vegetables", quantity: 2, unit: "cups" },
          { item: "Diced tomatoes", quantity: 1, unit: "cup" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Skip pasta for fewer calories.",
          "Add extra vegetables for volume.",
          "Use more broth for heartiness.",
          "Finish with fresh herbs and lemon."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Minestrone Power",
        description: "Extra beans with protein pasta",
        healthBadges: ["Vegan", "High Protein", "High Fiber"],
        ingredients: [
          { item: "Vegetable broth", quantity: 2, unit: "cups" },
          { item: "Mixed beans", quantity: 1.5, unit: "cups" },
          { item: "Protein pasta", quantity: 0.75, unit: "cup" },
          { item: "Lentils, cooked", quantity: 0.5, unit: "cup" },
          { item: "Vegetables, mixed", quantity: 1, unit: "cup" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra beans and lentils for protein.",
          "Add protein-enriched pasta.",
          "Top with nutritional yeast and hemp seeds.",
          "Perfect plant-based protein meal."
        ]
      }
    }
  },

  {
    id: "bahn-mi",
    slug: "bahn-mi",
    name: "Vietnamese Banh Mi",
    description: "Vietnamese sandwich with pickled vegetables and protein",
    baseServings: 1,
    image: "/images/templates/banh-mi.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Pork Banh Mi",
        description: "Traditional Vietnamese sandwich with marinated pork",
        healthBadges: ["High Protein", "Asian Fusion", "Flavor Packed"],
        ingredients: [
          { item: "French baguette", quantity: 6, unit: "inches" },
          { item: "Marinated pork", quantity: 3, unit: "oz" },
          { item: "Pickled carrots", quantity: 0.25, unit: "cup" },
          { item: "Pickled daikon", quantity: 0.25, unit: "cup" },
          { item: "Cucumber slices", quantity: 0.25, unit: "cup" },
          { item: "Fresh cilantro", quantity: 0.25, unit: "cup" },
          { item: "Jalapeño slices", quantity: 3, unit: "slices" },
          { item: "Mayonnaise", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Toast baguette until crispy.",
          "Cook marinated pork until done.",
          "Spread mayo on bread.",
          "Layer pork, pickled vegetables, cucumber, cilantro.",
          "Add jalapeño for heat."
        ]
      },
      light: {
        slug: "light",
        name: "Light Tofu Banh Mi",
        description: "Lighter version with tofu and less bread",
        healthBadges: ["Vegan Option", "Lower Calorie", "High Fiber"],
        ingredients: [
          { item: "Small baguette", quantity: 4, unit: "inches" },
          { item: "Marinated tofu", quantity: 3, unit: "oz" },
          { item: "Pickled vegetables", quantity: 0.75, unit: "cup" },
          { item: "Fresh vegetables", quantity: 0.5, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.5, unit: "cup" },
          { item: "Sriracha", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use smaller portion of bread.",
          "Load with pickled and fresh vegetables.",
          "Use tofu for plant protein.",
          "Add lots of fresh herbs for flavor."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Banh Mi Power",
        description: "Extra meat with egg addition",
        healthBadges: ["Very High Protein", "Muscle Building", "Filling"],
        ingredients: [
          { item: "Whole wheat baguette", quantity: 6, unit: "inches" },
          { item: "Grilled chicken", quantity: 4, unit: "oz" },
          { item: "Fried egg", quantity: 1, unit: "large" },
          { item: "Pickled vegetables", quantity: 0.5, unit: "cup" },
          { item: "Fresh vegetables", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt spread", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra chicken for more protein.",
          "Add fried egg for complete amino acids.",
          "Use Greek yogurt instead of mayo.",
          "Perfect high-protein Asian fusion."
        ]
      }
    }
  },

  {
    id: "cobb-salad",
    slug: "cobb-salad",
    name: "Classic Cobb Salad",
    description: "American classic with rows of protein and vegetables",
    baseServings: 2,
    image: "/images/templates/cobb-salad.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Traditional Cobb",
        description: "Classic Cobb with all the traditional ingredients",
        healthBadges: ["High Protein", "Satisfying", "Restaurant Quality"],
        ingredients: [
          { item: "Romaine lettuce", quantity: 4, unit: "cups" },
          { item: "Grilled chicken breast", quantity: 4, unit: "oz" },
          { item: "Hard-boiled eggs", quantity: 2, unit: "large" },
          { item: "Bacon, cooked", quantity: 3, unit: "strips" },
          { item: "Avocado, diced", quantity: 0.5, unit: "medium" },
          { item: "Blue cheese", quantity: 0.25, unit: "cup" },
          { item: "Cherry tomatoes", quantity: 0.5, unit: "cup" },
          { item: "Ranch dressing", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Chop lettuce and arrange in serving bowls.",
          "Slice chicken, eggs, and arrange in rows.",
          "Add bacon, avocado, cheese, and tomatoes.",
          "Serve with ranch dressing on the side."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Cobb",
        description: "Lower calorie with turkey and light dressing",
        healthBadges: ["Lower Calorie", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Mixed greens", quantity: 5, unit: "cups" },
          { item: "Grilled turkey", quantity: 3, unit: "oz" },
          { item: "Egg whites", quantity: 3, unit: "large" },
          { item: "Turkey bacon", quantity: 2, unit: "strips" },
          { item: "Avocado", quantity: 0.25, unit: "medium" },
          { item: "Cherry tomatoes", quantity: 0.75, unit: "cup" },
          { item: "Cucumber", quantity: 0.5, unit: "cup" },
          { item: "Balsamic vinaigrette", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra greens for volume.",
          "Choose turkey and egg whites for lean protein.",
          "Use less avocado and cheese.",
          "Light balsamic instead of ranch."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Cobb Power",
        description: "Extra protein with additional chicken and eggs",
        healthBadges: ["Very High Protein", "Muscle Building", "Complete Meal"],
        ingredients: [
          { item: "Romaine lettuce", quantity: 3, unit: "cups" },
          { item: "Grilled chicken", quantity: 6, unit: "oz" },
          { item: "Hard-boiled eggs", quantity: 3, unit: "large" },
          { item: "Bacon", quantity: 4, unit: "strips" },
          { item: "Cottage cheese", quantity: 0.5, unit: "cup" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Greek yogurt dressing", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use extra chicken for maximum protein.",
          "Add more hard-boiled eggs.",
          "Include cottage cheese for extra protein.",
          "Use Greek yogurt-based dressing."
        ]
      }
    }
  },

  {
    id: "mediterranean-wrap",
    slug: "mediterranean-wrap",
    name: "Mediterranean Wrap",
    description: "Fresh wrap with feta, olives, and Mediterranean vegetables",
    baseServings: 1,
    image: "/images/templates/mediterranean-wrap.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Med Wrap",
        description: "Traditional Mediterranean flavors in a wrap",
        healthBadges: ["Vegetarian", "Heart Healthy", "Mediterranean Diet"],
        ingredients: [
          { item: "Whole wheat tortilla", quantity: 1, unit: "large" },
          { item: "Hummus", quantity: 2, unit: "tbsp" },
          { item: "Feta cheese", quantity: 2, unit: "oz" },
          { item: "Kalamata olives", quantity: 5, unit: "pieces" },
          { item: "Cucumber, sliced", quantity: 0.5, unit: "cup" },
          { item: "Tomatoes, diced", quantity: 0.25, unit: "cup" },
          { item: "Red onion", quantity: 2, unit: "tbsp" },
          { item: "Fresh spinach", quantity: 1, unit: "cup" }
        ],
        instructions: [
          "Spread hummus on tortilla.",
          "Layer spinach, cucumber, tomatoes, and onion.",
          "Add crumbled feta and olives.",
          "Roll tightly and slice diagonally."
        ]
      },
      light: {
        slug: "light",
        name: "Light Greek Wrap",
        description: "Lower calorie with less cheese",
        healthBadges: ["Vegetarian", "Lower Calorie", "High Fiber"],
        ingredients: [
          { item: "Small whole wheat tortilla", quantity: 1, unit: "piece" },
          { item: "Hummus", quantity: 1, unit: "tbsp" },
          { item: "Reduced-fat feta", quantity: 1, unit: "oz" },
          { item: "Fresh vegetables", quantity: 1.5, unit: "cups" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Use smaller tortilla and less hummus.",
          "Load with extra vegetables.",
          "Use reduced-fat feta sparingly.",
          "Add fresh herbs and lemon for flavor."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Med Power Wrap",
        description: "Extra protein with grilled chicken",
        healthBadges: ["High Protein", "Mediterranean", "Muscle Building"],
        ingredients: [
          { item: "Protein tortilla", quantity: 1, unit: "large" },
          { item: "Grilled chicken", quantity: 3, unit: "oz" },
          { item: "Hummus", quantity: 3, unit: "tbsp" },
          { item: "Feta cheese", quantity: 2, unit: "oz" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Vegetables, mixed", quantity: 1, unit: "cup" },
          { item: "Hemp seeds", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein tortilla as base.",
          "Add grilled chicken for protein.",
          "Layer hummus, feta, and Greek yogurt.",
          "Sprinkle with hemp seeds for extra nutrition."
        ]
      }
    }
  },

  {
    id: "loaded-sweet-potato",
    slug: "loaded-sweet-potato",
    name: "Loaded Sweet Potato",
    description: "Baked sweet potato loaded with healthy toppings",
    baseServings: 1,
    image: "/images/templates/loaded-sweet-potato.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Loaded Sweet Potato",
        description: "Traditional loaded potato with healthy twist",
        healthBadges: ["Vegetarian", "High Fiber", "Nutrient Dense"],
        ingredients: [
          { item: "Sweet potato", quantity: 1, unit: "large" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Shredded cheese", quantity: 2, unit: "tbsp" },
          { item: "Green onions", quantity: 2, unit: "tbsp" },
          { item: "Salsa", quantity: 2, unit: "tbsp" },
          { item: "Cilantro", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Bake sweet potato until tender.",
          "Split open and fluff inside.",
          "Top with black beans, cheese, and Greek yogurt.",
          "Garnish with green onions, salsa, and cilantro."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Sweet Potato",
        description: "Extra vegetables with minimal toppings",
        healthBadges: ["Vegan", "Low Calorie", "Very High Fiber"],
        ingredients: [
          { item: "Sweet potato", quantity: 1, unit: "medium" },
          { item: "Steamed broccoli", quantity: 1, unit: "cup" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Salsa", quantity: 0.5, unit: "cup" },
          { item: "Fresh cilantro", quantity: 0.25, unit: "cup" },
          { item: "Lime juice", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use medium potato for portion control.",
          "Load with steamed vegetables.",
          "Top with salsa instead of cheese.",
          "Add fresh herbs and lime."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Sweet Potato",
        description: "Extra protein with meat and cheese",
        healthBadges: ["High Protein", "Muscle Building", "Satisfying"],
        ingredients: [
          { item: "Sweet potato", quantity: 1, unit: "large" },
          { item: "Ground turkey, cooked", quantity: 3, unit: "oz" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Shredded cheese", quantity: 0.25, unit: "cup" },
          { item: "Cottage cheese", quantity: 2, unit: "tbsp" },
          { item: "Green onions", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Top with cooked ground turkey.",
          "Add black beans for plant protein.",
          "Layer Greek yogurt and cottage cheese.",
          "Finish with shredded cheese and green onions."
        ]
      }
    }
  }
];