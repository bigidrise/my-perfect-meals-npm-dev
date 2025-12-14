export interface DinnerMeal {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  image: string;
  templates: {
    classic: DinnerTemplate;
    light: DinnerTemplate;
    highProtein: DinnerTemplate;
  };
}

export interface DinnerTemplate {
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

export const dinnerMealsData: DinnerMeal[] = [
  {
    id: "grilled-salmon-asparagus",
    slug: "grilled-salmon-asparagus",
    name: "Grilled Salmon & Asparagus",
    description: "Heart-healthy salmon with fresh asparagus and herbs",
    baseServings: 2,
    image: "/images/templates/dinner-salmon-asparagus.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Grilled Salmon",
        description: "Perfectly grilled salmon with lemon herb asparagus",
        healthBadges: ["Omega-3 Rich", "Heart Healthy", "Anti-Inflammatory"],
        ingredients: [
          { item: "Salmon fillets", quantity: 12, unit: "oz" },
          { item: "Fresh asparagus", quantity: 1, unit: "lb" },
          { item: "Olive oil", quantity: 3, unit: "tbsp" },
          { item: "Lemon", quantity: 1, unit: "large" },
          { item: "Garlic", quantity: 3, unit: "cloves" },
          { item: "Fresh dill", quantity: 2, unit: "tbsp" },
          { item: "Salt and pepper", quantity: 1, unit: "pinch" },
          { item: "Wild rice", quantity: 1, unit: "cup" }
        ],
        instructions: [
          "Cook wild rice according to package directions",
          "Preheat grill to medium-high heat",
          "Season salmon with salt, pepper, and lemon zest",
          "Trim asparagus ends and toss with olive oil",
          "Grill salmon 4-5 minutes per side until flaky",
          "Grill asparagus 3-4 minutes until tender-crisp",
          "Mix garlic and dill with remaining olive oil",
          "Serve salmon and asparagus over rice with herb oil"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Salmon",
        description: "Lighter version with steamed vegetables and herbs",
        healthBadges: ["Low Calorie", "Diabetic Friendly", "Heart Healthy"],
        ingredients: [
          { item: "Salmon fillets", quantity: 10, unit: "oz" },
          { item: "Asparagus spears", quantity: 1.5, unit: "lbs" },
          { item: "Zucchini", quantity: 2, unit: "medium" },
          { item: "Cauliflower rice", quantity: 2, unit: "cups" },
          { item: "Lemon juice", quantity: 3, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Olive oil spray", quantity: 1, unit: "spray" },
          { item: "Garlic powder", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Steam cauliflower rice until tender",
          "Season salmon with garlic powder and herbs",
          "Spray grill with olive oil spray",
          "Grill salmon 4 minutes per side",
          "Steam asparagus and zucchini until tender",
          "Season vegetables with lemon juice and herbs",
          "Serve over cauliflower rice with extra lemon"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Salmon",
        description: "Extra salmon with quinoa and Greek yogurt sauce",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Salmon fillets", quantity: 16, unit: "oz" },
          { item: "Asparagus", quantity: 1, unit: "lb" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Lemon", quantity: 1, unit: "large" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Cook quinoa with extra water for fluffier texture",
          "Mix Greek yogurt with protein powder and lemon",
          "Grill larger portion of salmon for maximum protein",
          "Roast asparagus with olive oil until caramelized",
          "Serve salmon over quinoa with protein yogurt sauce",
          "Sprinkle hemp seeds for additional protein and omega-3s"
        ]
      }
    }
  },
  {
    id: "chicken-stir-fry",
    slug: "chicken-stir-fry",
    name: "Chicken Vegetable Stir-Fry",
    description: "Quick and healthy stir-fry with fresh vegetables",
    baseServings: 2,
    image: "/images/templates/dinner-chicken-stirfry.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Stir-Fry",
        description: "Traditional stir-fry with brown rice and savory sauce",
        healthBadges: ["High Protein", "Vegetable Rich", "Quick Cooking"],
        ingredients: [
          { item: "Chicken breast", quantity: 12, unit: "oz" },
          { item: "Brown rice", quantity: 1, unit: "cup" },
          { item: "Broccoli florets", quantity: 2, unit: "cups" },
          { item: "Bell peppers", quantity: 2, unit: "medium" },
          { item: "Snap peas", quantity: 1, unit: "cup" },
          { item: "Soy sauce", quantity: 3, unit: "tbsp" },
          { item: "Sesame oil", quantity: 1, unit: "tbsp" },
          { item: "Ginger", quantity: 1, unit: "tbsp" },
          { item: "Garlic", quantity: 3, unit: "cloves" }
        ],
        instructions: [
          "Cook brown rice according to package directions",
          "Cut chicken into bite-sized pieces",
          "Heat oil in large wok or skillet over high heat",
          "Stir-fry chicken until cooked through, remove",
          "Add vegetables and stir-fry 3-4 minutes until crisp-tender",
          "Return chicken to pan with soy sauce and ginger",
          "Toss everything together for 1 minute",
          "Serve hot over brown rice"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Stir-Fry",
        description: "Extra vegetables with minimal oil and cauliflower rice",
        healthBadges: ["Very Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Chicken breast", quantity: 8, unit: "oz" },
          { item: "Cauliflower rice", quantity: 3, unit: "cups" },
          { item: "Broccoli", quantity: 3, unit: "cups" },
          { item: "Mushrooms", quantity: 2, unit: "cups" },
          { item: "Zucchini", quantity: 2, unit: "medium" },
          { item: "Low-sodium soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Rice vinegar", quantity: 1, unit: "tbsp" },
          { item: "Fresh ginger", quantity: 1, unit: "tbsp" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Steam cauliflower rice until tender",
          "Use cooking spray instead of oil",
          "Load with extra vegetables for volume",
          "Season with rice vinegar and fresh ginger",
          "Cook until vegetables are tender-crisp",
          "Serve with lime wedges for extra flavor"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Stir-Fry",
        description: "Double protein with chicken and tofu, served over quinoa",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Chicken breast", quantity: 10, unit: "oz" },
          { item: "Firm tofu", quantity: 6, unit: "oz" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Edamame", quantity: 1, unit: "cup" },
          { item: "Broccoli", quantity: 2, unit: "cups" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Soy sauce", quantity: 3, unit: "tbsp" },
          { item: "Sesame oil", quantity: 1, unit: "tbsp" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Cook quinoa for complete amino acids",
          "Cube tofu and chicken for double protein",
          "Stir-fry proteins separately then combine",
          "Add edamame for plant-based protein",
          "Mix protein powder into sauce",
          "Serve over quinoa and top with hemp seeds"
        ]
      }
    }
  },
  {
    id: "lean-beef-sweet-potato",
    slug: "lean-beef-sweet-potato",
    name: "Lean Beef & Sweet Potato",
    description: "Grass-fed beef with roasted sweet potatoes and greens",
    baseServings: 2,
    image: "/images/templates/dinner-beef-sweet-potato.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Beef Dinner",
        description: "Traditional beef with roasted vegetables",
        healthBadges: ["High Protein", "Iron Rich", "Balanced Macros"],
        ingredients: [
          { item: "Lean ground beef", quantity: 12, unit: "oz" },
          { item: "Sweet potatoes", quantity: 2, unit: "large" },
          { item: "Green beans", quantity: 1, unit: "lb" },
          { item: "Onion", quantity: 1, unit: "medium" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" },
          { item: "Garlic", quantity: 3, unit: "cloves" },
          { item: "Rosemary", quantity: 1, unit: "tbsp" },
          { item: "Salt and pepper", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Preheat oven to 425°F",
          "Cube sweet potatoes and toss with olive oil",
          "Roast sweet potatoes 25-30 minutes until tender",
          "Brown ground beef with onions and garlic",
          "Steam green beans until crisp-tender",
          "Season beef with rosemary, salt, and pepper",
          "Serve beef over sweet potatoes with green beans"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Beef",
        description: "Leaner portion with extra vegetables",
        healthBadges: ["Lean Protein", "High Iron", "Low Calorie"],
        ingredients: [
          { item: "Extra lean ground beef", quantity: 8, unit: "oz" },
          { item: "Sweet potato", quantity: 1, unit: "medium" },
          { item: "Green beans", quantity: 1.5, unit: "lbs" },
          { item: "Zucchini", quantity: 2, unit: "medium" },
          { item: "Bell peppers", quantity: 2, unit: "medium" },
          { item: "Herbs", quantity: 3, unit: "tbsp" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use extra lean beef (95/5) for lower fat",
          "Add extra vegetables for volume",
          "Cook with minimal oil using spray",
          "Season generously with fresh herbs",
          "Add lemon juice for brightness",
          "Focus on vegetable-to-protein ratio"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Beef",
        description: "Extra beef with quinoa and Greek yogurt",
        healthBadges: ["Very High Protein", "Iron Rich", "Muscle Building"],
        ingredients: [
          { item: "Lean ground beef", quantity: 16, unit: "oz" },
          { item: "Sweet potato", quantity: 1.5, unit: "large" },
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Green vegetables", quantity: 2, unit: "cups" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Herbs and spices", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Increase beef portion for maximum protein",
          "Cook quinoa for complete amino acids",
          "Mix Greek yogurt with protein powder",
          "Use yogurt mixture as creamy sauce",
          "Serve beef over quinoa with vegetables",
          "Perfect high-protein post-workout meal"
        ]
      }
    }
  },
  {
    id: "baked-cod-vegetables",
    slug: "baked-cod-vegetables",
    name: "Baked Cod with Vegetables",
    description: "Flaky white fish with Mediterranean vegetables",
    baseServings: 2,
    image: "/images/templates/dinner-cod-vegetables.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Mediterranean Cod",
        description: "Herb-crusted cod with roasted Mediterranean vegetables",
        healthBadges: ["Lean Protein", "Mediterranean Diet", "Heart Healthy"],
        ingredients: [
          { item: "Cod fillets", quantity: 12, unit: "oz" },
          { item: "Zucchini", quantity: 2, unit: "medium" },
          { item: "Bell peppers", quantity: 2, unit: "medium" },
          { item: "Cherry tomatoes", quantity: 2, unit: "cups" },
          { item: "Red onion", quantity: 1, unit: "medium" },
          { item: "Olive oil", quantity: 3, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon", quantity: 1, unit: "large" }
        ],
        instructions: [
          "Preheat oven to 400°F",
          "Cut vegetables into similar-sized pieces",
          "Toss vegetables with olive oil and herbs",
          "Roast vegetables 20 minutes",
          "Season cod with herbs, salt, and pepper",
          "Add cod to pan with vegetables",
          "Bake 12-15 minutes until fish flakes easily",
          "Serve with lemon wedges"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Cod",
        description: "Extra vegetables with minimal oil and herbs",
        healthBadges: ["Very Low Calorie", "Lean Protein", "Diabetic Friendly"],
        ingredients: [
          { item: "Cod fillets", quantity: 10, unit: "oz" },
          { item: "Zucchini", quantity: 3, unit: "medium" },
          { item: "Broccoli", quantity: 2, unit: "cups" },
          { item: "Cauliflower", quantity: 2, unit: "cups" },
          { item: "Green beans", quantity: 2, unit: "cups" },
          { item: "Lemon juice", quantity: 3, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.5, unit: "cup" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Load with extra low-calorie vegetables",
          "Use cooking spray instead of oil",
          "Steam some vegetables to retain nutrients",
          "Season generously with fresh herbs",
          "Add extra lemon for flavor without calories",
          "Focus on volume over calorie density"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Cod",
        description: "Extra cod with quinoa and Greek yogurt sauce",
        healthBadges: ["High Protein", "Complete Amino Acids", "Lean Muscle"],
        ingredients: [
          { item: "Cod fillets", quantity: 16, unit: "oz" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.75, unit: "cup" },
          { item: "Mixed vegetables", quantity: 3, unit: "cups" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Lemon", quantity: 1, unit: "large" },
          { item: "Fresh dill", quantity: 3, unit: "tbsp" }
        ],
        instructions: [
          "Use larger portion of cod for maximum protein",
          "Cook quinoa for complete amino acid profile",
          "Mix Greek yogurt with protein powder",
          "Create creamy protein sauce with dill",
          "Serve cod over quinoa with protein sauce",
          "Top with hemp seeds for additional protein"
        ]
      }
    }
  },
  {
    id: "turkey-meatball-zoodles",
    slug: "turkey-meatball-zoodles",
    name: "Turkey Meatballs & Zoodles",
    description: "Lean turkey meatballs with spiralized zucchini noodles",
    baseServings: 2,
    image: "/images/templates/dinner-turkey-zoodles.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Turkey Meatballs",
        description: "Homemade turkey meatballs with marinara and zoodles",
        healthBadges: ["High Protein", "Low Carb", "Gluten Free"],
        ingredients: [
          { item: "Ground turkey", quantity: 12, unit: "oz" },
          { item: "Zucchini", quantity: 4, unit: "medium" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Onion", quantity: 0.5, unit: "medium" },
          { item: "Garlic", quantity: 3, unit: "cloves" },
          { item: "Italian herbs", quantity: 2, unit: "tsp" },
          { item: "Parmesan cheese", quantity: 0.25, unit: "cup" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Spiralize zucchini into noodle shapes",
          "Mix ground turkey with herbs and minced garlic",
          "Form into 12-15 meatballs",
          "Brown meatballs in olive oil until cooked through",
          "Heat marinara sauce in separate pan",
          "Sauté zoodles briefly until just tender",
          "Serve meatballs over zoodles with marinara",
          "Top with fresh Parmesan cheese"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Meatballs",
        description: "Extra vegetables with lighter sauce",
        healthBadges: ["Low Calorie", "High Fiber", "Weight Management"],
        ingredients: [
          { item: "Lean ground turkey", quantity: 10, unit: "oz" },
          { item: "Zucchini", quantity: 5, unit: "medium" },
          { item: "Low-sodium marinara", quantity: 0.75, unit: "cup" },
          { item: "Bell peppers", quantity: 2, unit: "medium" },
          { item: "Mushrooms", quantity: 2, unit: "cups" },
          { item: "Fresh basil", quantity: 0.25, unit: "cup" },
          { item: "Garlic", quantity: 4, unit: "cloves" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use extra lean ground turkey (99/1)",
          "Add more vegetables for volume",
          "Cook meatballs with cooking spray",
          "Use low-sodium marinara sauce",
          "Add fresh herbs for flavor without calories",
          "Serve with side of steamed vegetables"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Meatballs",
        description: "Extra turkey with protein additions and Greek yogurt",
        healthBadges: ["Very High Protein", "Muscle Building", "Post Workout"],
        ingredients: [
          { item: "Ground turkey", quantity: 16, unit: "oz" },
          { item: "Zucchini", quantity: 3, unit: "medium" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Protein powder", quantity: 1, unit: "scoop" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Marinara sauce", quantity: 0.75, unit: "cup" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Parmesan cheese", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Mix protein powder into ground turkey",
          "Add cottage cheese and egg whites for binding",
          "Form larger, protein-dense meatballs",
          "Mix Greek yogurt into marinara for protein boost",
          "Serve over smaller portion of zoodles",
          "Add extra Parmesan for additional protein"
        ]
      }
    }
  },
  {
    id: "veggie-lentil-curry",
    slug: "veggie-lentil-curry",
    name: "Vegetable Lentil Curry",
    description: "Warming curry with protein-rich lentils and vegetables",
    baseServings: 2,
    image: "/images/templates/dinner-lentil-curry.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Lentil Curry",
        description: "Traditional curry spices with creamy coconut milk",
        healthBadges: ["Plant Based", "High Fiber", "Anti-Inflammatory"],
        ingredients: [
          { item: "Red lentils", quantity: 1, unit: "cup" },
          { item: "Coconut milk", quantity: 1, unit: "cup" },
          { item: "Brown rice", quantity: 1, unit: "cup" },
          { item: "Sweet potato", quantity: 1, unit: "large" },
          { item: "Spinach", quantity: 3, unit: "cups" },
          { item: "Curry powder", quantity: 2, unit: "tbsp" },
          { item: "Ginger", quantity: 1, unit: "tbsp" },
          { item: "Vegetable broth", quantity: 2, unit: "cups" }
        ],
        instructions: [
          "Cook brown rice according to package directions",
          "Sauté diced sweet potato until slightly tender",
          "Add curry powder and ginger, cook 1 minute",
          "Add lentils, coconut milk, and broth",
          "Simmer 20-25 minutes until lentils are soft",
          "Stir in spinach until wilted",
          "Serve over brown rice with fresh cilantro"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Curry",
        description: "Extra vegetables with cauliflower rice",
        healthBadges: ["Very Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Red lentils", quantity: 0.75, unit: "cup" },
          { item: "Light coconut milk", quantity: 0.5, unit: "cup" },
          { item: "Cauliflower rice", quantity: 3, unit: "cups" },
          { item: "Bell peppers", quantity: 2, unit: "medium" },
          { item: "Zucchini", quantity: 2, unit: "medium" },
          { item: "Spinach", quantity: 4, unit: "cups" },
          { item: "Curry powder", quantity: 1.5, unit: "tbsp" },
          { item: "Vegetable broth", quantity: 2.5, unit: "cups" }
        ],
        instructions: [
          "Use cauliflower rice instead of brown rice",
          "Add extra vegetables for volume",
          "Use light coconut milk and more broth",
          "Load with leafy greens for nutrients",
          "Season well with spices for flavor",
          "Serve with lime wedges"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Curry",
        description: "Extra lentils with quinoa and Greek yogurt",
        healthBadges: ["High Plant Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Red lentils", quantity: 1.5, unit: "cups" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Hemp seeds", quantity: 3, unit: "tbsp" },
          { item: "Coconut milk", quantity: 0.75, unit: "cup" },
          { item: "Mixed vegetables", quantity: 2, unit: "cups" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Curry spices", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use extra lentils for plant protein",
          "Cook quinoa for complete amino acids",
          "Stir Greek yogurt into finished curry",
          "Top with hemp seeds for omega-3s",
          "Add nutritional yeast for B vitamins",
          "Perfect high-protein plant-based meal"
        ]
      }
    }
  },
  {
    id: "pork-tenderloin-apples",
    slug: "pork-tenderloin-apples",
    name: "Pork Tenderloin & Apples",
    description: "Lean pork tenderloin with roasted apples and vegetables",
    baseServings: 2,
    image: "/images/templates/dinner-pork-apples.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Pork & Apples",
        description: "Traditional combination with sweet and savory flavors",
        healthBadges: ["Lean Protein", "Iron Rich", "Comfort Food"],
        ingredients: [
          { item: "Pork tenderloin", quantity: 12, unit: "oz" },
          { item: "Apples", quantity: 2, unit: "medium" },
          { item: "Sweet potatoes", quantity: 2, unit: "medium" },
          { item: "Brussels sprouts", quantity: 2, unit: "cups" },
          { item: "Onion", quantity: 1, unit: "medium" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" },
          { item: "Thyme", quantity: 1, unit: "tbsp" },
          { item: "Apple cider vinegar", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Preheat oven to 425°F",
          "Season pork tenderloin with salt, pepper, and thyme",
          "Sear pork in oven-safe skillet until browned",
          "Add sliced apples, sweet potatoes, and Brussels sprouts",
          "Drizzle with olive oil and apple cider vinegar",
          "Roast 20-25 minutes until pork reaches 145°F",
          "Let rest 5 minutes before slicing"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Pork",
        description: "Extra vegetables with minimal added fats",
        healthBadges: ["Lean Protein", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Pork tenderloin", quantity: 10, unit: "oz" },
          { item: "Apples", quantity: 1, unit: "medium" },
          { item: "Cauliflower", quantity: 3, unit: "cups" },
          { item: "Green beans", quantity: 2, unit: "cups" },
          { item: "Brussels sprouts", quantity: 3, unit: "cups" },
          { item: "Herbs", quantity: 3, unit: "tbsp" },
          { item: "Apple cider vinegar", quantity: 3, unit: "tbsp" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use leaner portion of pork",
          "Add extra vegetables for volume",
          "Cook with cooking spray instead of oil",
          "Season generously with fresh herbs",
          "Use apple cider vinegar for flavor",
          "Steam some vegetables to retain nutrients"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Pork",
        description: "Extra pork with quinoa and Greek yogurt sauce",
        healthBadges: ["Very High Protein", "Lean Muscle", "Post Workout"],
        ingredients: [
          { item: "Pork tenderloin", quantity: 16, unit: "oz" },
          { item: "Apple", quantity: 1, unit: "medium" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Vegetables", quantity: 2, unit: "cups" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use larger portion of pork for maximum protein",
          "Cook quinoa for complete amino acids",
          "Mix Greek yogurt with protein powder",
          "Create protein-rich apple sauce",
          "Serve pork over quinoa with protein sauce",
          "Perfect for muscle building goals"
        ]
      }
    }
  },
  {
    id: "shrimp-cauliflower-risotto",
    slug: "shrimp-cauliflower-risotto",
    name: "Shrimp Cauliflower Risotto",
    description: "Creamy cauliflower risotto with succulent shrimp",
    baseServings: 2,
    image: "/images/templates/dinner-shrimp-risotto.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Shrimp Risotto",
        description: "Creamy cauliflower base with perfectly cooked shrimp",
        healthBadges: ["Low Carb", "High Protein", "Gluten Free"],
        ingredients: [
          { item: "Large shrimp", quantity: 12, unit: "oz" },
          { item: "Cauliflower", quantity: 1, unit: "large head" },
          { item: "Parmesan cheese", quantity: 0.5, unit: "cup" },
          { item: "Heavy cream", quantity: 0.25, unit: "cup" },
          { item: "Garlic", quantity: 4, unit: "cloves" },
          { item: "White wine", quantity: 0.25, unit: "cup" },
          { item: "Olive oil", quantity: 2, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 3, unit: "tbsp" }
        ],
        instructions: [
          "Rice cauliflower in food processor",
          "Sauté garlic in olive oil until fragrant",
          "Add cauliflower and cook until tender",
          "Stir in cream and Parmesan for creaminess",
          "Season shrimp and cook until pink",
          "Deglaze pan with white wine",
          "Combine shrimp with cauliflower risotto",
          "Garnish with fresh herbs"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Risotto",
        description: "Extra vegetables with minimal cream",
        healthBadges: ["Very Low Calorie", "High Protein", "Diabetic Friendly"],
        ingredients: [
          { item: "Medium shrimp", quantity: 10, unit: "oz" },
          { item: "Cauliflower", quantity: 1.5, unit: "large heads" },
          { item: "Zucchini", quantity: 1, unit: "medium" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Greek yogurt", quantity: 0.25, unit: "cup" },
          { item: "Vegetable broth", quantity: 0.5, unit: "cup" },
          { item: "Garlic", quantity: 4, unit: "cloves" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Add extra vegetables for volume",
          "Use Greek yogurt instead of cream",
          "Add vegetable broth for moisture",
          "Load with fresh herbs for flavor",
          "Cook shrimp with minimal oil",
          "Serve with lemon wedges"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Risotto",
        description: "Extra shrimp with protein additions and Greek yogurt",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Jumbo shrimp", quantity: 16, unit: "oz" },
          { item: "Cauliflower", quantity: 1, unit: "large head" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Parmesan cheese", quantity: 0.5, unit: "cup" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra large portion of shrimp",
          "Mix protein powder into Greek yogurt",
          "Add cottage cheese for extra protein",
          "Whisk in egg whites for binding",
          "Create ultra-creamy, protein-rich risotto",
          "Perfect post-workout comfort food"
        ]
      }
    }
  },
  {
    id: "stuffed-bell-peppers",
    slug: "stuffed-bell-peppers",
    name: "Stuffed Bell Peppers",
    description: "Colorful bell peppers stuffed with healthy filling",
    baseServings: 2,
    image: "/images/templates/dinner-stuffed-peppers.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Stuffed Peppers",
        description: "Traditional stuffed peppers with ground turkey and rice",
        healthBadges: ["High Protein", "Vegetable Rich", "Comfort Food"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Ground turkey", quantity: 8, unit: "oz" },
          { item: "Brown rice", quantity: 1, unit: "cup" },
          { item: "Diced tomatoes", quantity: 1, unit: "cup" },
          { item: "Onion", quantity: 1, unit: "medium" },
          { item: "Mozzarella cheese", quantity: 0.5, unit: "cup" },
          { item: "Italian seasoning", quantity: 2, unit: "tsp" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Preheat oven to 375°F",
          "Cut tops off peppers and remove seeds",
          "Cook brown rice according to package directions",
          "Brown ground turkey with onions",
          "Mix turkey, rice, tomatoes, and seasonings",
          "Stuff peppers with mixture",
          "Top with mozzarella cheese",
          "Bake 30-35 minutes until peppers are tender"
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Peppers",
        description: "Extra vegetables with cauliflower rice",
        healthBadges: ["Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Lean ground turkey", quantity: 6, unit: "oz" },
          { item: "Cauliflower rice", quantity: 2, unit: "cups" },
          { item: "Zucchini", quantity: 1, unit: "medium" },
          { item: "Mushrooms", quantity: 1, unit: "cup" },
          { item: "Diced tomatoes", quantity: 1, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use cauliflower rice instead of brown rice",
          "Add extra diced vegetables for volume",
          "Use leaner ground turkey",
          "Skip cheese for lower calories",
          "Cook with cooking spray",
          "Add fresh herbs for flavor"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Peppers",
        description: "Extra turkey with quinoa and Greek yogurt",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Ground turkey", quantity: 12, unit: "oz" },
          { item: "Quinoa", quantity: 0.75, unit: "cup" },
          { item: "Greek yogurt", quantity: 0.5, unit: "cup" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Mozzarella", quantity: 0.5, unit: "cup" },
          { item: "Herbs", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use extra ground turkey for maximum protein",
          "Cook quinoa for complete amino acids",
          "Mix Greek yogurt and cottage cheese into filling",
          "Add protein powder to mixture",
          "Stuff peppers generously with protein filling",
          "Top with extra cheese for additional protein"
        ]
      }
    }
  },
  {
    id: "asian-lettuce-wraps-dinner",
    slug: "asian-lettuce-wraps-dinner",
    name: "Asian Lettuce Wraps",
    description: "Fresh lettuce cups with savory Asian-inspired filling",
    baseServings: 2,
    image: "/images/templates/dinner-asian-wraps.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Asian Wraps",
        description: "Traditional filling with ground chicken and vegetables",
        healthBadges: ["Low Carb", "Gluten Free", "Fresh & Light"],
        ingredients: [
          { item: "Butter lettuce", quantity: 12, unit: "leaves" },
          { item: "Ground chicken", quantity: 12, unit: "oz" },
          { item: "Water chestnuts", quantity: 1, unit: "cup" },
          { item: "Mushrooms", quantity: 2, unit: "cups" },
          { item: "Green onions", quantity: 4, unit: "stalks" },
          { item: "Soy sauce", quantity: 3, unit: "tbsp" },
          { item: "Sesame oil", quantity: 1, unit: "tbsp" },
          { item: "Fresh ginger", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Separate and wash lettuce leaves carefully",
          "Cook ground chicken in large skillet",
          "Add diced mushrooms and water chestnuts",
          "Season with soy sauce, sesame oil, and ginger",
          "Stir in chopped green onions",
          "Serve filling in lettuce cups",
          "Garnish with extra green onions and sesame seeds"
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Wraps",
        description: "Extra vegetables with lean protein",
        healthBadges: ["Very Low Calorie", "High Fiber", "Diabetic Friendly"],
        ingredients: [
          { item: "Boston lettuce", quantity: 16, unit: "leaves" },
          { item: "Ground chicken breast", quantity: 8, unit: "oz" },
          { item: "Cabbage", quantity: 2, unit: "cups" },
          { item: "Carrots", quantity: 1, unit: "cup" },
          { item: "Bean sprouts", quantity: 1, unit: "cup" },
          { item: "Rice vinegar", quantity: 2, unit: "tbsp" },
          { item: "Low-sodium soy sauce", quantity: 1, unit: "tbsp" },
          { item: "Fresh cilantro", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use extra lettuce cups for more volume",
          "Add plenty of crunchy vegetables",
          "Season lightly with rice vinegar",
          "Use low-sodium soy sauce",
          "Garnish with fresh cilantro and herbs",
          "Serve with lime wedges for extra flavor"
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Power Protein Wraps",
        description: "Double protein with chicken and tofu",
        healthBadges: ["Very High Protein", "Complete Amino Acids", "Muscle Building"],
        ingredients: [
          { item: "Iceberg lettuce", quantity: 10, unit: "leaves" },
          { item: "Ground chicken", quantity: 10, unit: "oz" },
          { item: "Firm tofu", quantity: 6, unit: "oz" },
          { item: "Edamame", quantity: 1, unit: "cup" },
          { item: "Egg whites", quantity: 3, unit: "cooked" },
          { item: "Protein powder", quantity: 0.5, unit: "scoop" },
          { item: "Soy sauce", quantity: 3, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Combine ground chicken with cubed tofu",
          "Add cooked egg whites for extra protein",
          "Include edamame for plant protein",
          "Mix protein powder into sauce",
          "Load lettuce cups generously with protein filling",
          "Sprinkle with sesame seeds for added protein and crunch"
        ]
      }
    }
  },

  // NEW DINNER MEALS
  {
    id: "cauliflower-tacos",
    slug: "cauliflower-tacos",
    name: "Crispy Cauliflower Tacos",
    description: "Plant-based tacos with crispy roasted cauliflower",
    baseServings: 1,
    image: "/images/templates/cauliflower-tacos.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Cauliflower Tacos",
        description: "Traditional style with crispy cauliflower and fresh toppings.",
        healthBadges: ["Vegan", "High Fiber", "Anti-Inflammatory"],
        ingredients: [
          { item: "Cauliflower florets", quantity: 2, unit: "cups" },
          { item: "Corn tortillas", quantity: 3, unit: "pieces" },
          { item: "Cabbage slaw", quantity: 0.5, unit: "cup" },
          { item: "Salsa", quantity: 2, unit: "tbsp" },
          { item: "Avocado", quantity: 0.25, unit: "large" },
          { item: "Lime", quantity: 0.5, unit: "whole" }
        ],
        instructions: [
          "Roast cauliflower at 425°F until crispy.",
          "Warm tortillas and fill with cauliflower.",
          "Top with slaw, salsa, and avocado.",
          "Squeeze lime over tacos and serve."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Tacos",
        description: "Extra vegetables with lighter toppings.",
        healthBadges: ["Vegan", "Low Calorie", "Nutrient Dense"],
        ingredients: [
          { item: "Cauliflower florets", quantity: 1.5, unit: "cups" },
          { item: "Small corn tortillas", quantity: 4, unit: "pieces" },
          { item: "Mixed vegetable slaw", quantity: 1, unit: "cup" },
          { item: "Fresh salsa", quantity: 3, unit: "tbsp" },
          { item: "Cilantro", quantity: 0.25, unit: "cup" },
          { item: "Lime juice", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Use more vegetables and smaller tortillas.",
          "Skip avocado to reduce calories.",
          "Load with fresh herbs and vegetables.",
          "Use extra lime for flavor without calories."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Tacos",
        description: "Added beans and hemp seeds for extra protein.",
        healthBadges: ["Vegan", "High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Cauliflower florets", quantity: 2, unit: "cups" },
          { item: "Large corn tortillas", quantity: 3, unit: "pieces" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Hemp seeds", quantity: 2, unit: "tbsp" },
          { item: "Tahini sauce", quantity: 2, unit: "tbsp" },
          { item: "Pepitas", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Add black beans for plant protein.",
          "Sprinkle hemp seeds on each taco.",
          "Use tahini sauce for healthy fats and protein.",
          "Top with pepitas for extra nutrition."
        ]
      }
    }
  },

  {
    id: "lentil-bolognese",
    slug: "lentil-bolognese",
    name: "Lentil Bolognese (High-Fiber Pasta)",
    description: "Plant-based bolognese with protein-rich lentils",
    baseServings: 1,
    image: "/images/templates/lentil-bolognese.jpg", 
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Lentil Bolognese",
        description: "Traditional style bolognese made with hearty lentils.",
        healthBadges: ["Vegan", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Cooked lentils", quantity: 1, unit: "cup" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Whole wheat pasta", quantity: 3, unit: "oz dry" },
          { item: "Diced vegetables", quantity: 0.5, unit: "cup" },
          { item: "Fresh basil", quantity: 2, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Simmer lentils with marinara sauce.",
          "Cook pasta according to package directions.",
          "Add vegetables to lentil mixture.",
          "Serve over pasta with basil and nutritional yeast."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Pasta",
        description: "More vegetables with spiralized zucchini noodles.",
        healthBadges: ["Vegan", "Low Calorie", "High Fiber"],
        ingredients: [
          { item: "Cooked lentils", quantity: 0.75, unit: "cup" },
          { item: "Light marinara", quantity: 0.75, unit: "cup" },
          { item: "Zucchini noodles", quantity: 2, unit: "cups" },
          { item: "Mixed vegetables", quantity: 1, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use zucchini noodles to reduce calories.",
          "Add extra vegetables for volume.",
          "Use lighter sauce and more herbs.",
          "Serve with abundance of fresh vegetables."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Bolognese",
        description: "Extra lentils with protein pasta and hemp seeds.",
        healthBadges: ["Vegan", "Very High Protein", "Muscle Building"],
        ingredients: [
          { item: "Cooked lentils", quantity: 1.5, unit: "cups" },
          { item: "Protein pasta", quantity: 3, unit: "oz dry" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Hemp hearts", quantity: 2, unit: "tbsp" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Pine nuts", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra lentils and protein-enriched pasta.",
          "Add hemp hearts for complete amino acids.",
          "Sprinkle with nutritional yeast for B vitamins.",
          "Top with pine nuts for healthy fats and protein."
        ]
      }
    }
  },

  {
    id: "teriyaki-tofu-bowl",
    slug: "teriyaki-tofu-bowl",
    name: "Teriyaki Tofu Bowl",
    description: "Asian-inspired bowl with marinated tofu and vegetables",
    baseServings: 1,
    image: "/images/templates/teriyaki-tofu-bowl.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Teriyaki Bowl",
        description: "Traditional teriyaki tofu with steamed rice and vegetables.",
        healthBadges: ["Vegan", "High Protein", "Asian Inspired"],
        ingredients: [
          { item: "Firm tofu, cubed", quantity: 6, unit: "oz" },
          { item: "Cooked brown rice", quantity: 1, unit: "cup" },
          { item: "Mixed vegetables", quantity: 1.5, unit: "cups" },
          { item: "Teriyaki sauce", quantity: 2, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 1, unit: "tsp" },
          { item: "Green onions", quantity: 2, unit: "tbsp" }
        ],
        instructions: [
          "Pan-fry tofu until golden brown.",
          "Stir-fry vegetables until tender-crisp.",
          "Add teriyaki sauce and tofu to vegetables.",
          "Serve over rice with sesame seeds and green onions."
        ]
      },
      light: {
        slug: "light",
        name: "Light Asian Bowl",
        description: "Cauliflower rice with extra vegetables.",
        healthBadges: ["Vegan", "Low Calorie", "Low Carb"],
        ingredients: [
          { item: "Firm tofu, cubed", quantity: 4, unit: "oz" },
          { item: "Cauliflower rice", quantity: 1.5, unit: "cups" },
          { item: "Mixed vegetables", quantity: 2, unit: "cups" },
          { item: "Low-sodium teriyaki", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use cauliflower rice to reduce calories.",
          "Add more vegetables for volume.",
          "Use less tofu and sauce.",
          "Pack with fresh herbs for flavor."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Asian Bowl",
        description: "Extra tofu with edamame and hemp seeds.",
        healthBadges: ["Vegan", "Very High Protein", "Complete Amino Acids"],
        ingredients: [
          { item: "Extra firm tofu, cubed", quantity: 8, unit: "oz" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Edamame", quantity: 0.5, unit: "cup" },
          { item: "Hemp hearts", quantity: 2, unit: "tbsp" },
          { item: "Teriyaki sauce", quantity: 2, unit: "tbsp" },
          { item: "Tahini", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra tofu for maximum protein.",
          "Add edamame and hemp hearts for complete amino acids.",
          "Serve over quinoa for additional protein.",
          "Drizzle with tahini for healthy fats."
        ]
      }
    }
  },

  {
    id: "veggie-quesadillas",
    slug: "veggie-quesadillas",
    name: "Veggie Quesadillas (Triangles)",
    description: "Cheesy quesadillas filled with sautéed vegetables",
    baseServings: 1,
    image: "/images/templates/veggie-quesadillas.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Quesadillas",
        description: "Traditional cheese quesadillas with mixed vegetables.",
        healthBadges: ["Vegetarian", "Comfort Food", "Kid Friendly"],
        ingredients: [
          { item: "Whole-wheat tortillas", quantity: 2, unit: "pieces" },
          { item: "Shredded cheese", quantity: 2, unit: "oz" },
          { item: "Bell peppers, sautéed", quantity: 0.5, unit: "cup" },
          { item: "Onions, sautéed", quantity: 0.5, unit: "cup" },
          { item: "Salsa", quantity: 2, unit: "tbsp" },
          { item: "Sour cream", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Fill tortilla with cheese and sautéed vegetables.",
          "Cook in skillet until golden and cheese melts.",
          "Cut into triangles and serve hot.",
          "Garnish with salsa and sour cream."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Triangles",
        description: "More vegetables with reduced cheese.",
        healthBadges: ["Vegetarian", "Lower Calorie", "High Fiber"],
        ingredients: [
          { item: "Small whole-wheat tortillas", quantity: 2, unit: "pieces" },
          { item: "Part-skim cheese", quantity: 1, unit: "oz" },
          { item: "Mixed vegetables", quantity: 1, unit: "cup" },
          { item: "Fresh salsa", quantity: 3, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use smaller tortillas and less cheese.",
          "Pack with extra vegetables for volume.",
          "Use Greek yogurt instead of sour cream.",
          "Serve with plenty of fresh salsa."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Quesadillas",
        description: "Extra cheese with black beans and Greek yogurt.",
        healthBadges: ["Vegetarian", "High Protein", "Muscle Building"],
        ingredients: [
          { item: "Protein tortillas", quantity: 2, unit: "pieces" },
          { item: "Mixed cheese", quantity: 3, unit: "oz" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Cottage cheese", quantity: 2, unit: "tbsp" },
          { item: "Pepitas", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use protein tortillas and extra cheese.",
          "Add black beans for plant protein.",
          "Mix cottage cheese into filling.",
          "Serve with Greek yogurt and pepitas."
        ]
      }
    }
  },

  {
    id: "sheetpan-halloumi-veg",
    slug: "sheetpan-halloumi-veg",
    name: "Sheet-Pan Veg + Halloumi",
    description: "One-pan dinner with roasted vegetables and halloumi cheese",
    baseServings: 1,
    image: "/images/templates/sheetpan-halloumi.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Mediterranean Sheet Pan",
        description: "Traditional roasted vegetables with golden halloumi.",
        healthBadges: ["Vegetarian", "Mediterranean", "One Pan"],
        ingredients: [
          { item: "Mixed vegetables", quantity: 3, unit: "cups" },
          { item: "Halloumi, sliced", quantity: 4, unit: "oz" },
          { item: "Olive oil", quantity: 2, unit: "tsp" },
          { item: "Mediterranean herbs", quantity: 1, unit: "tsp" },
          { item: "Lemon", quantity: 0.5, unit: "whole" },
          { item: "Red pepper flakes", quantity: 1, unit: "pinch" }
        ],
        instructions: [
          "Toss vegetables with olive oil and herbs.",
          "Roast at 425°F for 18-22 minutes.",
          "Add halloumi in last 5 minutes.",
          "Squeeze lemon over everything and serve."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Medley",
        description: "Extra vegetables with reduced halloumi.",
        healthBadges: ["Vegetarian", "Lower Calorie", "High Fiber"],
        ingredients: [
          { item: "Mixed vegetables", quantity: 4, unit: "cups" },
          { item: "Halloumi, sliced", quantity: 2, unit: "oz" },
          { item: "Olive oil spray", quantity: 1, unit: "spray" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Balsamic vinegar", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use more vegetables and less cheese.",
          "Spray with olive oil instead of drizzling.",
          "Add fresh herbs for flavor without calories.",
          "Finish with lemon and balsamic."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Mediterranean",
        description: "Extra halloumi with chickpeas and pine nuts.",
        healthBadges: ["Vegetarian", "High Protein", "Complete Nutrition"],
        ingredients: [
          { item: "Mixed vegetables", quantity: 2.5, unit: "cups" },
          { item: "Halloumi, sliced", quantity: 6, unit: "oz" },
          { item: "Chickpeas", quantity: 0.5, unit: "cup" },
          { item: "Pine nuts", quantity: 2, unit: "tbsp" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Tahini", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Use extra halloumi and add chickpeas.",
          "Sprinkle pine nuts for healthy fats and protein.",
          "Serve with Greek yogurt tahini sauce.",
          "Perfect high-protein Mediterranean meal."
        ]
      }
    }
  },

  {
    id: "beef-broccoli",
    slug: "beef-broccoli",
    name: "Beef & Broccoli Stir-Fry",
    description: "Classic Chinese takeout favorite made healthier at home",
    baseServings: 2,
    image: "/images/templates/beef-broccoli.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Beef & Broccoli",
        description: "Traditional stir-fry with savory sauce",
        healthBadges: ["High Protein", "Iron Rich", "Quick Prep"],
        ingredients: [
          { item: "Flank steak, sliced", quantity: 8, unit: "oz" },
          { item: "Broccoli florets", quantity: 3, unit: "cups" },
          { item: "Soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Garlic, minced", quantity: 3, unit: "cloves" },
          { item: "Ginger, minced", quantity: 1, unit: "tsp" },
          { item: "Brown rice", quantity: 1, unit: "cup" },
          { item: "Sesame oil", quantity: 1, unit: "tsp" },
          { item: "Cornstarch", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Cook brown rice according to package.",
          "Toss beef with cornstarch.",
          "Stir-fry beef until browned, remove.",
          "Cook broccoli, garlic, and ginger.",
          "Add beef back with soy sauce and sesame oil.",
          "Serve over rice."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Stir-Fry",
        description: "More vegetables with lean beef",
        healthBadges: ["Lower Calorie", "High Protein", "Veggie Packed"],
        ingredients: [
          { item: "Lean sirloin, sliced", quantity: 6, unit: "oz" },
          { item: "Broccoli", quantity: 4, unit: "cups" },
          { item: "Cauliflower rice", quantity: 2, unit: "cups" },
          { item: "Low-sodium soy sauce", quantity: 1, unit: "tbsp" },
          { item: "Garlic", quantity: 3, unit: "cloves" },
          { item: "Ginger", quantity: 1, unit: "tsp" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Use cauliflower rice instead of brown rice.",
          "Choose lean beef and use less.",
          "Add extra broccoli for volume.",
          "Cook with spray instead of oil."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Beef Power Stir-Fry",
        description: "Extra beef with additional protein",
        healthBadges: ["Very High Protein", "Iron Rich", "Muscle Building"],
        ingredients: [
          { item: "Ribeye steak, sliced", quantity: 12, unit: "oz" },
          { item: "Broccoli", quantity: 2, unit: "cups" },
          { item: "Edamame", quantity: 1, unit: "cup" },
          { item: "Quinoa", quantity: 1, unit: "cup" },
          { item: "Soy sauce", quantity: 2, unit: "tbsp" },
          { item: "Sesame seeds", quantity: 1, unit: "tbsp" },
          { item: "Scrambled egg", quantity: 1, unit: "large" }
        ],
        instructions: [
          "Use extra beef for maximum protein.",
          "Add edamame for plant protein.",
          "Serve over quinoa for complete amino acids.",
          "Top with scrambled egg and sesame seeds."
        ]
      }
    }
  },

  {
    id: "chicken-parmesan",
    slug: "chicken-parmesan",
    name: "Baked Chicken Parmesan",
    description: "Italian classic with breaded chicken and marinara",
    baseServings: 2,
    image: "/images/templates/chicken-parm.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Chicken Parm",
        description: "Traditional breaded and baked chicken parmesan",
        healthBadges: ["High Protein", "Italian Classic", "Comfort Food"],
        ingredients: [
          { item: "Chicken breasts", quantity: 8, unit: "oz" },
          { item: "Whole wheat breadcrumbs", quantity: 0.5, unit: "cup" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Mozzarella cheese", quantity: 0.5, unit: "cup" },
          { item: "Parmesan cheese", quantity: 0.25, unit: "cup" },
          { item: "Whole wheat pasta", quantity: 4, unit: "oz" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" }
        ],
        instructions: [
          "Bread chicken with whole wheat breadcrumbs.",
          "Bake at 400°F for 20 minutes.",
          "Top with marinara and cheeses.",
          "Bake 10 more minutes until cheese melts.",
          "Serve over whole wheat pasta."
        ]
      },
      light: {
        slug: "light",
        name: "Light Chicken Parm",
        description: "Baked not fried with less cheese",
        healthBadges: ["Lower Calorie", "High Protein", "Heart Healthy"],
        ingredients: [
          { item: "Chicken breast", quantity: 6, unit: "oz" },
          { item: "Panko breadcrumbs", quantity: 0.33, unit: "cup" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Part-skim mozzarella", quantity: 0.25, unit: "cup" },
          { item: "Zucchini noodles", quantity: 3, unit: "cups" },
          { item: "Cooking spray", quantity: 1, unit: "spray" }
        ],
        instructions: [
          "Spray chicken with cooking spray, not oil.",
          "Use less breadcrumbs and cheese.",
          "Serve over zucchini noodles instead of pasta.",
          "Extra marinara for flavor without calories."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Chicken Parm",
        description: "Extra chicken with protein pasta",
        healthBadges: ["Very High Protein", "Muscle Building", "Italian"],
        ingredients: [
          { item: "Chicken breasts", quantity: 12, unit: "oz" },
          { item: "Protein breadcrumbs", quantity: 0.5, unit: "cup" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Mozzarella", quantity: 0.5, unit: "cup" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Protein pasta", quantity: 4, unit: "oz" },
          { item: "Parmesan", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra chicken for more protein.",
          "Mix cottage cheese into marinara.",
          "Serve over protein pasta.",
          "Top with extra parmesan."
        ]
      }
    }
  },

  {
    id: "fish-tacos",
    slug: "fish-tacos",
    name: "Crispy Fish Tacos",
    description: "Light and fresh fish tacos with cabbage slaw",
    baseServings: 2,
    image: "/images/templates/fish-tacos.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Fish Tacos",
        description: "Traditional Baja-style fish tacos",
        healthBadges: ["High Protein", "Omega-3 Rich", "Fresh"],
        ingredients: [
          { item: "White fish fillets", quantity: 8, unit: "oz" },
          { item: "Corn tortillas", quantity: 6, unit: "small" },
          { item: "Cabbage slaw", quantity: 1, unit: "cup" },
          { item: "Lime", quantity: 1, unit: "whole" },
          { item: "Cilantro", quantity: 0.25, unit: "cup" },
          { item: "Chipotle mayo", quantity: 2, unit: "tbsp" },
          { item: "Avocado", quantity: 0.5, unit: "medium" }
        ],
        instructions: [
          "Season and bake fish until flaky.",
          "Warm corn tortillas.",
          "Flake fish into tortillas.",
          "Top with slaw, cilantro, and chipotle mayo.",
          "Serve with lime wedges and avocado."
        ]
      },
      light: {
        slug: "light",
        name: "Light Grilled Fish Tacos",
        description: "Grilled fish with extra vegetables",
        healthBadges: ["Low Calorie", "High Protein", "Fresh"],
        ingredients: [
          { item: "White fish", quantity: 6, unit: "oz" },
          { item: "Corn tortillas", quantity: 4, unit: "small" },
          { item: "Cabbage slaw", quantity: 1.5, unit: "cups" },
          { item: "Fresh salsa", quantity: 0.5, unit: "cup" },
          { item: "Greek yogurt", quantity: 2, unit: "tbsp" },
          { item: "Lime", quantity: 1, unit: "whole" },
          { item: "Cilantro", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Grill fish instead of frying.",
          "Use Greek yogurt instead of mayo.",
          "Extra cabbage for crunch and volume.",
          "Load with fresh salsa and cilantro."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Fish Tacos",
        description: "Extra fish with black beans",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "White fish fillets", quantity: 12, unit: "oz" },
          { item: "Protein tortillas", quantity: 6, unit: "small" },
          { item: "Black beans", quantity: 1, unit: "cup" },
          { item: "Greek yogurt sauce", quantity: 0.25, unit: "cup" },
          { item: "Cabbage slaw", quantity: 1, unit: "cup" },
          { item: "Avocado", quantity: 0.5, unit: "medium" },
          { item: "Cotija cheese", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra fish for maximum protein.",
          "Add black beans for plant protein.",
          "Use protein tortillas.",
          "Top with Greek yogurt and cotija cheese."
        ]
      }
    }
  },

  {
    id: "mushroom-risotto",
    slug: "mushroom-risotto",
    name: "Creamy Mushroom Risotto",
    description: "Classic Italian risotto with earthy mushrooms",
    baseServings: 2,
    image: "/images/templates/mushroom-risotto.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Mushroom Risotto",
        description: "Traditional creamy arborio rice with mushrooms",
        healthBadges: ["Vegetarian", "Comfort Food", "Italian Classic"],
        ingredients: [
          { item: "Arborio rice", quantity: 1, unit: "cup" },
          { item: "Mixed mushrooms", quantity: 2, unit: "cups" },
          { item: "Vegetable broth", quantity: 4, unit: "cups" },
          { item: "White wine", quantity: 0.5, unit: "cup" },
          { item: "Parmesan cheese", quantity: 0.5, unit: "cup" },
          { item: "Butter", quantity: 2, unit: "tbsp" },
          { item: "Garlic", quantity: 2, unit: "cloves" },
          { item: "Fresh thyme", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Sauté mushrooms and garlic in butter.",
          "Toast arborio rice, add wine.",
          "Gradually add warm broth, stirring constantly.",
          "Cook until creamy, about 20 minutes.",
          "Stir in parmesan and thyme.",
          "Serve immediately while creamy."
        ]
      },
      light: {
        slug: "light",
        name: "Light Mushroom Risotto",
        description: "Lighter version with cauliflower rice blend",
        healthBadges: ["Vegetarian", "Lower Calorie", "High Fiber"],
        ingredients: [
          { item: "Arborio rice", quantity: 0.5, unit: "cup" },
          { item: "Cauliflower rice", quantity: 1, unit: "cup" },
          { item: "Mushrooms", quantity: 3, unit: "cups" },
          { item: "Vegetable broth", quantity: 3, unit: "cups" },
          { item: "Parmesan", quantity: 0.25, unit: "cup" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Mix arborio with cauliflower rice.",
          "Use extra mushrooms for flavor.",
          "Use less cheese and butter.",
          "Add extra fresh herbs."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Risotto",
        description: "Extra protein with peas and parmesan",
        healthBadges: ["Vegetarian", "High Protein", "Complete Meal"],
        ingredients: [
          { item: "Arborio rice", quantity: 1, unit: "cup" },
          { item: "Mushrooms", quantity: 2, unit: "cups" },
          { item: "Green peas", quantity: 1, unit: "cup" },
          { item: "Parmesan", quantity: 0.75, unit: "cup" },
          { item: "White beans", quantity: 0.5, unit: "cup" },
          { item: "Nutritional yeast", quantity: 2, unit: "tbsp" },
          { item: "Vegetable broth", quantity: 4, unit: "cups" }
        ],
        instructions: [
          "Add green peas and white beans for protein.",
          "Use extra parmesan for protein.",
          "Stir in nutritional yeast for B vitamins.",
          "Perfect protein-rich vegetarian meal."
        ]
      }
    }
  },

  {
    id: "turkey-meatballs",
    slug: "turkey-meatballs",
    name: "Turkey Meatballs with Marinara",
    description: "Lean turkey meatballs in homemade tomato sauce",
    baseServings: 3,
    image: "/images/templates/turkey-meatballs.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Turkey Meatballs",
        description: "Traditional Italian-style turkey meatballs",
        healthBadges: ["High Protein", "Lean", "Family Friendly"],
        ingredients: [
          { item: "Ground turkey", quantity: 1, unit: "lb" },
          { item: "Breadcrumbs", quantity: 0.5, unit: "cup" },
          { item: "Egg", quantity: 1, unit: "large" },
          { item: "Marinara sauce", quantity: 2, unit: "cups" },
          { item: "Parmesan", quantity: 0.25, unit: "cup" },
          { item: "Italian seasoning", quantity: 1, unit: "tbsp" },
          { item: "Whole wheat spaghetti", quantity: 6, unit: "oz" }
        ],
        instructions: [
          "Mix turkey, breadcrumbs, egg, and seasonings.",
          "Form into meatballs and bake at 400°F for 20 minutes.",
          "Simmer in marinara sauce.",
          "Serve over whole wheat spaghetti.",
          "Top with parmesan cheese."
        ]
      },
      light: {
        slug: "light",
        name: "Light Turkey Meatballs",
        description: "Extra lean with zucchini noodles",
        healthBadges: ["Low Calorie", "High Protein", "Low Carb"],
        ingredients: [
          { item: "Extra lean ground turkey", quantity: 12, unit: "oz" },
          { item: "Oat breadcrumbs", quantity: 0.33, unit: "cup" },
          { item: "Egg whites", quantity: 2, unit: "large" },
          { item: "Marinara sauce", quantity: 2, unit: "cups" },
          { item: "Zucchini noodles", quantity: 4, unit: "cups" },
          { item: "Fresh basil", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra lean turkey and egg whites.",
          "Bake instead of frying.",
          "Serve over zucchini noodles.",
          "Use plenty of fresh basil."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Meatballs",
        description: "Extra large meatballs with protein pasta",
        healthBadges: ["Very High Protein", "Muscle Building", "Satisfying"],
        ingredients: [
          { item: "Ground turkey", quantity: 1.5, unit: "lbs" },
          { item: "Protein breadcrumbs", quantity: 0.5, unit: "cup" },
          { item: "Eggs", quantity: 2, unit: "large" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" },
          { item: "Marinara", quantity: 2, unit: "cups" },
          { item: "Protein pasta", quantity: 6, unit: "oz" },
          { item: "Parmesan", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Mix cottage cheese into meatball mixture.",
          "Make larger meatballs for more protein.",
          "Serve over protein pasta.",
          "Top with extra parmesan."
        ]
      }
    }
  },

  {
    id: "veggie-lasagna",
    slug: "veggie-lasagna",
    name: "Vegetable Lasagna",
    description: "Layered pasta with vegetables and cheese",
    baseServings: 4,
    image: "/images/templates/veggie-lasagna.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Veggie Lasagna",
        description: "Traditional layered lasagna with vegetables",
        healthBadges: ["Vegetarian", "Comfort Food", "Make Ahead"],
        ingredients: [
          { item: "Whole wheat lasagna noodles", quantity: 9, unit: "sheets" },
          { item: "Ricotta cheese", quantity: 2, unit: "cups" },
          { item: "Mozzarella", quantity: 2, unit: "cups" },
          { item: "Marinara sauce", quantity: 3, unit: "cups" },
          { item: "Spinach", quantity: 2, unit: "cups" },
          { item: "Zucchini, sliced", quantity: 1, unit: "cup" },
          { item: "Mushrooms, sliced", quantity: 1, unit: "cup" },
          { item: "Parmesan", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Layer noodles, ricotta, vegetables, and marinara.",
          "Repeat layers, top with mozzarella.",
          "Bake at 375°F for 45 minutes.",
          "Let rest 10 minutes before serving.",
          "Garnish with parmesan and basil."
        ]
      },
      light: {
        slug: "light",
        name: "Light Veggie Lasagna",
        description: "Extra vegetables with less cheese",
        healthBadges: ["Vegetarian", "Lower Calorie", "Veggie Packed"],
        ingredients: [
          { item: "Whole wheat noodles", quantity: 9, unit: "sheets" },
          { item: "Part-skim ricotta", quantity: 1.5, unit: "cups" },
          { item: "Part-skim mozzarella", quantity: 1, unit: "cup" },
          { item: "Marinara", quantity: 3, unit: "cups" },
          { item: "Mixed vegetables", quantity: 4, unit: "cups" },
          { item: "Fresh basil", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use less cheese, more vegetables.",
          "Choose part-skim dairy products.",
          "Add extra vegetables between layers.",
          "Top with fresh basil instead of more cheese."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Lasagna",
        description: "Extra cheese with added protein",
        healthBadges: ["Vegetarian", "High Protein", "Complete Meal"],
        ingredients: [
          { item: "Protein lasagna noodles", quantity: 9, unit: "sheets" },
          { item: "Ricotta", quantity: 2, unit: "cups" },
          { item: "Cottage cheese", quantity: 1, unit: "cup" },
          { item: "Mozzarella", quantity: 2.5, unit: "cups" },
          { item: "Marinara", quantity: 3, unit: "cups" },
          { item: "Protein crumbles", quantity: 1, unit: "cup" },
          { item: "Parmesan", quantity: 0.75, unit: "cup" }
        ],
        instructions: [
          "Mix cottage cheese with ricotta.",
          "Add protein crumbles between layers.",
          "Use extra cheese for protein.",
          "Perfect high-protein vegetarian meal."
        ]
      }
    }
  },

  {
    id: "shrimp-scampi",
    slug: "shrimp-scampi",
    name: "Garlic Shrimp Scampi",
    description: "Classic Italian shrimp in white wine garlic sauce",
    baseServings: 2,
    image: "/images/templates/shrimp-scampi.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Shrimp Scampi",
        description: "Traditional shrimp scampi with pasta",
        healthBadges: ["High Protein", "Omega-3 Rich", "Quick Prep"],
        ingredients: [
          { item: "Large shrimp, peeled", quantity: 12, unit: "oz" },
          { item: "Whole wheat linguine", quantity: 6, unit: "oz" },
          { item: "Garlic, minced", quantity: 4, unit: "cloves" },
          { item: "White wine", quantity: 0.5, unit: "cup" },
          { item: "Butter", quantity: 2, unit: "tbsp" },
          { item: "Lemon juice", quantity: 2, unit: "tbsp" },
          { item: "Fresh parsley", quantity: 0.25, unit: "cup" },
          { item: "Red pepper flakes", quantity: 0.5, unit: "tsp" }
        ],
        instructions: [
          "Cook pasta according to package.",
          "Sauté garlic in butter until fragrant.",
          "Add shrimp, cook until pink.",
          "Add wine and lemon juice, simmer.",
          "Toss with pasta and parsley.",
          "Serve with red pepper flakes."
        ]
      },
      light: {
        slug: "light",
        name: "Light Shrimp Scampi",
        description: "Zucchini noodles with less butter",
        healthBadges: ["Low Calorie", "High Protein", "Low Carb"],
        ingredients: [
          { item: "Large shrimp", quantity: 10, unit: "oz" },
          { item: "Zucchini noodles", quantity: 4, unit: "cups" },
          { item: "Garlic", quantity: 4, unit: "cloves" },
          { item: "White wine", quantity: 0.5, unit: "cup" },
          { item: "Olive oil", quantity: 1, unit: "tbsp" },
          { item: "Lemon", quantity: 1, unit: "whole" },
          { item: "Fresh herbs", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use zucchini noodles instead of pasta.",
          "Cook with olive oil instead of butter.",
          "Add extra lemon for brightness.",
          "Load with fresh herbs."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Scampi",
        description: "Extra shrimp with protein pasta",
        healthBadges: ["Very High Protein", "Omega-3 Rich", "Muscle Building"],
        ingredients: [
          { item: "Jumbo shrimp", quantity: 1, unit: "lb" },
          { item: "Protein linguine", quantity: 6, unit: "oz" },
          { item: "Garlic", quantity: 5, unit: "cloves" },
          { item: "White wine", quantity: 0.5, unit: "cup" },
          { item: "Parmesan", quantity: 0.5, unit: "cup" },
          { item: "Butter", quantity: 2, unit: "tbsp" },
          { item: "Fresh parsley", quantity: 0.5, unit: "cup" }
        ],
        instructions: [
          "Use extra large shrimp for more protein.",
          "Serve over protein pasta.",
          "Add parmesan for extra protein.",
          "Perfect high-protein seafood dinner."
        ]
      }
    }
  },

  {
    id: "dinner-stuffed-peppers",
    slug: "dinner-stuffed-peppers",
    name: "Stuffed Bell Peppers",
    description: "Colorful bell peppers stuffed with savory filling",
    baseServings: 2,
    image: "/images/templates/stuffed-peppers.jpg",
    templates: {
      classic: {
        slug: "classic",
        name: "Classic Stuffed Peppers",
        description: "Traditional peppers with rice and meat filling",
        healthBadges: ["High Protein", "Balanced Meal", "Colorful"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Ground turkey", quantity: 8, unit: "oz" },
          { item: "Brown rice, cooked", quantity: 1, unit: "cup" },
          { item: "Marinara sauce", quantity: 1, unit: "cup" },
          { item: "Mozzarella cheese", quantity: 0.5, unit: "cup" },
          { item: "Onion, diced", quantity: 0.5, unit: "medium" },
          { item: "Italian seasoning", quantity: 1, unit: "tsp" }
        ],
        instructions: [
          "Cut tops off peppers, remove seeds.",
          "Mix turkey, rice, marinara, and seasonings.",
          "Stuff peppers with mixture.",
          "Bake at 375°F for 35 minutes.",
          "Top with cheese, bake 5 more minutes."
        ]
      },
      light: {
        slug: "light",
        name: "Light Garden Peppers",
        description: "Extra vegetables with cauliflower rice",
        healthBadges: ["Lower Calorie", "High Fiber", "Veggie Packed"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Extra lean turkey", quantity: 6, unit: "oz" },
          { item: "Cauliflower rice", quantity: 1.5, unit: "cups" },
          { item: "Diced tomatoes", quantity: 1, unit: "cup" },
          { item: "Mixed vegetables", quantity: 1, unit: "cup" },
          { item: "Low-fat cheese", quantity: 0.25, unit: "cup" },
          { item: "Fresh herbs", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use cauliflower rice instead of brown rice.",
          "Add extra vegetables to filling.",
          "Use less meat and cheese.",
          "Top with fresh herbs."
        ]
      },
      highProtein: {
        slug: "high-protein",
        name: "Protein Power Peppers",
        description: "Extra meat with quinoa and cheese",
        healthBadges: ["Very High Protein", "Muscle Building", "Complete Meal"],
        ingredients: [
          { item: "Bell peppers", quantity: 4, unit: "large" },
          { item: "Ground turkey", quantity: 12, unit: "oz" },
          { item: "Quinoa, cooked", quantity: 1, unit: "cup" },
          { item: "Black beans", quantity: 0.5, unit: "cup" },
          { item: "Marinara", quantity: 1, unit: "cup" },
          { item: "Mozzarella", quantity: 0.75, unit: "cup" },
          { item: "Cottage cheese", quantity: 0.25, unit: "cup" }
        ],
        instructions: [
          "Use extra turkey for more protein.",
          "Add quinoa and black beans for complete protein.",
          "Mix cottage cheese into filling.",
          "Top with extra mozzarella."
        ]
      }
    }
  }
];