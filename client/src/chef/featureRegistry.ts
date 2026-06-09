// Chef Navigation Feature Registry
// Based on actual dashboard card titles that users see

export type Feature = {
  id: string;                 // internal stable id
  path: string;               // route (Wouter)
  displayName: string;        // EXACT name shown on the dashboard card
  synonyms: string[];         // voice/natural variants
  hidden?: boolean;           // if you want Chef to know it but not show a card
};

export const FEATURES: Feature[] = [
  // Main Meal Planning Features
  {
    id: 'ai-meal-creator',
    path: '/ai-meal-creator',
    displayName: 'AI Meal Creator',
    synonyms: ['meal creator', 'meal builder', 'make me a plan', 'create meals', 'ai plan', 'generate meals', 'ai meal creator']
  },
  // Weekly Meal Planner removed - meal calendar functionality disabled
  // DELETED: meals-for-kids (Phase 1 cleanup)
  {
    id: 'craving-creator',
    path: '/craving-creator',
    displayName: 'Craving Creator',
    synonyms: ['cravings', 'craving', 'what im craving', 'food craving', 'make what i want']
  },

  // Premium Features
  {
    id: 'supplement-hub',
    path: '/supplement-hub',
    displayName: 'Supplement Hub',
    synonyms: ['supplements', 'vitamins', 'supplement tracker', 'vitamin tracker']
  },
  {
    id: 'potluck-planner',
    path: '/potluck-planner',
    displayName: 'Potluck Planner',
    synonyms: ['party planning', 'event meals', 'potluck', 'group meals', 'party meals']
  },
  {
    id: 'restaurant-guide',
    path: '/restaurant-guide',
    displayName: 'Restaurant Guide',
    synonyms: ['restaurants', 'dining out', 'eating out', 'restaurant finder', 'healthy restaurants']
  },
  {
    id: 'fridge-rescue',
    path: '/fridge-rescue',
    displayName: 'Fridge Rescue',
    synonyms: ['whats in my fridge', 'leftover meals', 'use leftovers', 'fridge cleanup', 'ingredients i have']
  },
  {
    id: 'learn-to-cook-club',
    path: '/learn-to-cook',
    displayName: '👩‍🍳 Learn to Cook Club',
    synonyms: ['cooking lessons', 'learn to cook', 'cooking club', 'cooking tutorials', 'cooking tips']
  },
  {
    id: 'holiday-feast-creator',
    path: '/holiday-feast',
    displayName: '🎄 Holiday Feast Creator',
    synonyms: ['holiday meals', 'christmas meals', 'thanksgiving meals', 'holiday feast', 'festive meals']
  },
  {
    id: 'master-shopping-list',
    path: '/master-shopping-list',
    displayName: 'Master Shopping List',
    synonyms: ['shopping list', 'grocery list', 'groceries', 'shopping', 'shopping history']
  },
  {
    id: 'lab-value-support',
    path: '/lab-values',
    displayName: '🩺 Lab Value Support',
    synonyms: ['lab results', 'blood work', 'cholesterol', 'a1c', 'lab values', 'medical results']
  },

  // Coming Soon Features
  {
    id: 'elite-athlete-mode',
    path: '/athlete-mode',
    displayName: '🏋️ Elite Athlete Mode',
    synonyms: ['athlete mode', 'bodybuilding', 'performance nutrition', 'athlete nutrition', 'competitive nutrition']
  },
  {
    id: 'cycle-syncing',
    path: '/cycle-syncing',
    displayName: '🩸 Cycle Syncing',
    synonyms: ['menstrual cycle', 'hormone tracking', 'cycle nutrition', 'period tracking', 'hormonal health']
  },
  {
    id: 'intermittent-fasting-planner',
    path: '/intermittent-fasting',
    displayName: '⏰ Intermittent Fasting Planner',
    synonyms: ['intermittent fasting', 'if planner', 'fasting', 'fasting windows', '16:8', '18:6', 'omad']
  },
  {
    id: 'food-delivery',
    path: '/food-delivery',
    displayName: '🍔 Food Delivery',
    synonyms: ['food delivery', 'grocery delivery', 'instacart', 'uber eats', 'meal delivery']
  },

  // Dashboard and Core Features
  {
    id: 'dashboard',
    path: '/dashboard',
    displayName: 'Dashboard',
    synonyms: ['home', 'main page', 'dashboard', 'overview']
  },
  {
    id: 'meal-planning-hub',
    path: '/comprehensive-meal-planning-revised',
    displayName: 'Meal Planning Hub',
    synonyms: ['meal planning', 'meal hub', 'planning hub', 'meal center']
  },

  // Other Core Features (from voice parser)
  {
    id: 'log-meal',
    path: '/food',
    displayName: 'Log Meal',
    synonyms: ['log food', 'track meal', 'food diary', 'meal logging', 'nutrition tracking'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'my-biometrics',
    path: '/my-biometrics',
    displayName: 'My Biometrics',
    synonyms: ['biometrics', 'weight tracking', 'progress tracking', 'health tracking', 'my stats', 'body measurements'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'log-water',
    path: '/track-water',
    displayName: 'Log Water',
    synonyms: ['track water', 'water logging', 'hydration tracking', 'water intake', 'log water'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'onboarding',
    path: '/onboarding',
    displayName: 'Onboarding',
    synonyms: ['setup', 'getting started', 'profile setup', 'onboarding'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'daily-journal',
    path: '/daily-journal',
    displayName: 'Daily Journal',
    synonyms: ['journal', 'daily reflection', 'daily thoughts', 'daily journal'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'newsletter',
    path: '/monthly-newsletter',
    displayName: 'Newsletter',
    synonyms: ['monthly newsletter', 'newsletter subscription', 'newsletter'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'womens-health',
    path: '/womens-health',
    displayName: "Women's Health",
    synonyms: ['womens health', 'female health', 'women health hub', 'womens health hub'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'mens-health',
    path: '/mens-health',
    displayName: "Men's Health", 
    synonyms: ['mens health', 'male health', 'men health hub', 'mens health hub'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'blood-sugar-hub',
    path: '/blood-sugar-hub',
    displayName: 'Blood Sugar Hub',
    synonyms: ['blood sugar', 'glucose tracking', 'diabetes support', 'blood sugar hub'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'wine-pairing',
    path: '/wine-pairing',
    displayName: 'Wine Pairing',
    synonyms: ['wine pairing', 'wine pairing mode', 'wine suggestions'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'bourbon-spirits',
    path: '/bourbon-spirits',
    displayName: 'Bourbon and Spirits',
    synonyms: ['bourbon', 'spirits', 'bourbon pairing', 'bourbon and spirits mode'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'meal-pairing-ai',
    path: '/meal-pairing-ai',
    displayName: 'Meal Pairing AI',
    synonyms: ['meal pairing', 'meal pairing ai', 'food pairing'],
    hidden: true  // Not a card but Chef should know about it
  },
  {
    id: 'game-hub',
    path: '/game-hub',
    displayName: 'Game Hub',
    synonyms: ['games', 'trivia', 'fitbrain', 'brain games', 'nutrition games'],
    hidden: true  // Not a card but Chef should know about it
  },

  // My Perfect Pets — Companion Nutrition
  {
    id: 'my-perfect-pets',
    path: '/companion',
    displayName: '🐾 My Perfect Pets',
    synonyms: ['my perfect pets', 'pets hub', 'companion nutrition', 'pet nutrition', 'dog and cat nutrition', 'pet meals']
  },
  {
    id: 'canine-wellness-hub',
    path: '/companion/dogs',
    displayName: 'Canine Wellness Hub',
    synonyms: ['dog nutrition', 'dog meals', 'canine hub', 'dog wellness', 'dog food', 'homemade dog food', 'dog meal generator'],
    hidden: true
  },
  {
    id: 'feline-wellness-hub',
    path: '/companion/cats',
    displayName: 'Feline Wellness Hub',
    synonyms: ['cat nutrition', 'cat meals', 'feline hub', 'cat wellness', 'cat food', 'homemade cat food', 'cat meal generator', 'taurine meals'],
    hidden: true
  },
  {
    id: 'dog-profile-setup',
    path: '/companion/setup',
    displayName: 'Dog Profile Setup',
    synonyms: ['add dog', 'dog profile', 'set up dog', 'new dog profile'],
    hidden: true
  },
  {
    id: 'cat-profile-setup',
    path: '/companion/cat-setup',
    displayName: 'Cat Profile Setup',
    synonyms: ['add cat', 'cat profile', 'set up cat', 'new cat profile'],
    hidden: true
  },
  {
    id: 'companion-meal-generator',
    path: '/companion/generator',
    displayName: 'Companion Meal Generator',
    synonyms: ['generate pet meal', 'pet meal creator', 'dog meal creator', 'cat meal creator', 'companion generator'],
    hidden: true
  },
  {
    id: 'companion-ingredient-scanner',
    path: '/companion/scanner',
    displayName: 'Pet Ingredient Scanner',
    synonyms: ['scan pet food', 'pet ingredient scanner', 'dog food scanner', 'cat food scanner', 'pet ingredient safety'],
    hidden: true
  }
];