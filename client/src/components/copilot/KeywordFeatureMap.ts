// Keyword → Feature/Walkthrough Mapping
// Fuzzy matching: User says ANY keyword → Navigate to feature + Start walkthrough

export interface FeatureMapping {
  path: string; // Navigation path
  walkthroughId: string; // Walkthrough identifier
  keywords: string[]; // Trigger keywords (fuzzy matched)
}

export const KEYWORD_FEATURE_MAP: FeatureMapping[] = [
  // Fridge Rescue
  {
    path: "/fridge-rescue",
    walkthroughId: "fridge-rescue",
    keywords: ["fridge rescue", "rescue", "use my fridge", "ingredients", "what can I make", "fridge", "pantry rescue", "pantry", "leftover helper", "use ingredients", "rescue mode"],
  },
  
  // Weekly Meal Builder
  {
    path: "/weekly-meal-board",
    walkthroughId: "weekly-board",
    keywords: ["weekly board", "meal board", "weekly planner", "meal builder", "week", "weekly meal builder", "week planner", "meal week", "weekly meals", "weekly plan", "plan my week", "plan"],
  },
  
  // Beach Body Meal Builder
  {
    path: "/beach-body-meal-board",
    walkthroughId: "beach-body",
    keywords: ["beach body", "hard body", "summer shred", "lean out", "competition", "shred", "get lean", "cut", "cutting", "beach prep", "physique", "stage prep"],
  },
  
  // Craving Hub (Phase C.4: High-level summons only)
  {
    path: "/craving-creator-landing",
    walkthroughId: "craving-hub",
    keywords: ["cravings", "craving hub", "I have a craving", "crave", "satisfy cravings", "craving center", "cravings hub"],
  },
  
  // Alcohol Hub (Phase C.4: High-level summons only, granular terms delegated to sub-options)
  {
    path: "/alcohol-hub",
    walkthroughId: "alcohol-hub",
    keywords: ["alcohol", "lean cocktails", "smart sips", "spirits hub", "alcohol hub", "drinks hub", "bar hub", "booze"],
  },
  
  // Socializing Hub (Phase C.4: High-level summons only, sub-option terms delegated to CanonicalAliasRegistry)
  {
    path: "/social-hub",
    walkthroughId: "social-hub",
    keywords: ["socializing", "social hub", "socializing hub", "going out", "night out", "eating out", "restaurant"],
  },
  
  // Diabetic Hub
  {
    path: "/diabetic-hub",
    walkthroughId: "diabetic-hub",
    keywords: ["diabetic", "diabetes", "sugar control", "blood sugar", "glucose", "diabetic hub", "diabetes hub"],
  },
  
  // GLP-1 Hub
  {
    path: "/glp1-hub",
    walkthroughId: "glp1-hub",
    keywords: ["glp", "glp one", "glp-1", "ozempic", "wegovy", "semaglutide", "injection", "g l p one", "glp hub", "glp-1 hub", "weight loss meds"],
  },
  
  // Anti-Inflammatory Meal Builder
  {
    path: "/anti-inflammatory-menu-builder",
    walkthroughId: "anti-inflammatory",
    keywords: ["anti-inflammatory", "inflammation", "anti inflammatory", "anti", "reduce inflammation", "inflammatory diet", "healing diet", "anti inflam"],
  },
  
  // Kids Hub (Phase C.4: High-level summons only)
  {
    path: "/healthy-kids-meals",
    walkthroughId: "kids-hub",
    keywords: ["kids", "children", "healthy kids", "kids hub", "kids meals hub", "children hub", "kids section"],
  },
  
  // Master Shopping List
  {
    path: "/shopping-list-v2",
    walkthroughId: "shopping-master",
    keywords: ["shopping list", "groceries", "master list", "shopping planner", "grocery", "shopping", "master shopping", "master shopping list", "grocery list", "list master", "grocery planner", "shop list", "food list"],
  },
  
  // Macro Calculator
  {
    path: "/macro-counter",
    walkthroughId: "macro-calculator",
    keywords: ["macros", "macro calculator", "protein calculator", "calorie calculator", "macro counter", "calculator", "calculate", "macro setup", "macro goals", "macro tool", "calculate macros", "macro math", "macro calc"],
  },
  
  // My Diet Biometrics
  {
    path: "/biometrics",
    walkthroughId: "biometrics",
    keywords: ["biometrics", "diet numbers", "profile numbers", "my macros profile", "tracking", "weight", "my biometrics", "bio metrics", "body metrics", "weight tracking", "body data", "my stats", "track weight"],
  },
  
  // Get Inspiration
  {
    path: "/get-inspiration",
    walkthroughId: "inspiration",
    keywords: ["inspiration", "ideas", "get ideas", "inspire me", "food ideas", "recipe ideas", "cooking ideas", "browse recipes"],
  },
  
  // Supplement Hub
  {
    path: "/supplement-hub", // Changed from /supplement-hub-landing (landing page hidden)
    walkthroughId: "supplement-hub",
    keywords: ["supplements", "supplement hub", "vitamins", "nutrition supplements"],
  },
  
  // Lifestyle Page
  {
    path: "/lifestyle",
    walkthroughId: "lifestyle",
    keywords: ["lifestyle", "main lifestyle page", "nutrition lifestyle", "lifestyle hub", "lifestyle page"],
  },
  
  // More Page
  {
    path: "/more",
    walkthroughId: "more",
    keywords: ["pro care", "professional care", "doctor care", "procare", "medical care", "professional help", "doctor", "more"],
  },
  
  // Planner Page
  {
    path: "/planner",
    walkthroughId: "planner",
    keywords: ["planner", "meal planner", "planning board", "planner page", "main planner", "planner hub", "nutrition planner"],
  },
];

/**
 * Find feature by fuzzy keyword matching
 * Normalizes query and checks if any keyword is contained
 */
export function findFeatureFromKeywords(
  query: string
): FeatureMapping | null {
  const normalized = query.toLowerCase().trim();

  for (const mapping of KEYWORD_FEATURE_MAP) {
    for (const keyword of mapping.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return mapping;
      }
    }
  }

  return null;
}
