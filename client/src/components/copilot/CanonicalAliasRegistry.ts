/**
 * CanonicalAliasRegistry.ts
 * 
 * Phase B - Hub & Feature Routing Registry
 * 
 * This registry provides a single source of truth for:
 * - Feature keywords and aliases
 * - Hub vs direct-page routing
 * - Hub size (small vs large) for prompt behavior
 * - Sub-option navigation within hubs
 */

export interface SubOption {
  id: string;
  label: string;
  route: string;
  testId: string; // Phase C.7: data-testid for click listener binding
  walkthroughId?: string; // Phase C.1: Links to walkthrough script ID in ScriptRegistry
  aliases: string[];
  voiceHint?: string; // Phase C.7: Voice pronunciation hint for HubWalkthroughEngine
}

export interface FeatureDefinition {
  id: string;
  legacyId?: string; // For backward compatibility with Spotlight/legacy systems
  primaryRoute: string;
  walkthroughId?: string; // Phase C.1: Links to walkthrough script ID in ScriptRegistry
  isHub: boolean;
  hubSize?: "small" | "large";
  keywords: string[];
  subOptions?: SubOption[];
  // Phase C.7: Hub Walkthrough Engine metadata
  spokenPrompt?: string; // Welcome message when entering hub
  selectionPrompt?: string; // Prompt for user to select sub-option
  voiceTimeoutMessage?: string; // Message when voice times out
}

/**
 * HUBS (Hub-First Routing)
 * When user says any keyword, navigate to hub first, then prompt for sub-option
 */
export const HUBS: Record<string, FeatureDefinition> = {
  CRAVING_HUB: {
    id: "CRAVING_HUB",
    legacyId: "craving-hub",
    primaryRoute: "/craving-creator-landing",
    walkthroughId: "craving-hub-walkthrough", // Phase C.7: Hub-level walkthrough
    isHub: true,
    hubSize: "small",
    keywords: ["cravings", "craving creator", "craving hub", "satisfy cravings", "craving ideas", "i have a craving", "craving center", "cravings hub", "sweet tooth", "snack ideas", "pre mades", "premades", "presets", "craving premades"],
    spokenPrompt: "Welcome to the Craving Hub! Here you can generate healthy versions of your cravings.",
    selectionPrompt: "Which part do you want? Say 'Creator' to build custom meals, or 'Premades' to browse our curated recipes.",
    voiceTimeoutMessage: "I didn't catch that. Try typing 'Creator' or 'Premades' instead.",
    subOptions: [
      {
        id: "CRAVING_CREATOR",
        label: "Craving Creator",
        route: "/craving-creator",
        testId: "cravinghub-creator",
        walkthroughId: "craving-creator-walkthrough",
        aliases: ["creator", "create", "custom craving", "make a craving", "craving creator", "create craving", "make my craving"],
        voiceHint: "creator"
      },
    ]
  },

  // DELETED: ALCOHOL_HUB (Phase 1 cleanup — will be replaced by Beverage Hub in Phase 2)

  SOCIAL_HUB: {
    id: "SOCIAL_HUB",
    legacyId: "social-hub",
    primaryRoute: "/social-hub",
    walkthroughId: "social-hub-walkthrough", // Phase C.7: Hub-level walkthrough
    isHub: true,
    hubSize: "small",
    keywords: ["restaurant", "socializing", "eating out", "restaurants", "out to eat", "social hub", "socializing hub", "going out", "night out", "find food", "food near me", "restaurant guide"],
    spokenPrompt: "Welcome to the Socializing Hub! Eating out with friends? Make smart choices without missing the fun.",
    selectionPrompt: "What do you need? Say 'Restaurant Guide' to get AI-powered healthy options from any restaurant, or 'Find Meals' to search local restaurants by craving and location.",
    voiceTimeoutMessage: "I didn't catch that. Try typing 'Restaurant Guide' or 'Find Meals' instead.",
    subOptions: [
      {
        id: "RESTAURANT_GUIDE",
        label: "Restaurant Guide",
        route: "/social-hub/restaurant-guide",
        testId: "socialhub-guide",
        walkthroughId: "restaurant-guide-walkthrough",
        aliases: ["restaurant guide", "guide", "restaurant", "eat out guide", "restaurant helper", "eat out", "ordering out", "restaurant menu help"]
      },
      {
        id: "FIND_MEALS",
        label: "Find Meals Near Me",
        route: "/social-hub/find",
        testId: "socialhub-find",
        walkthroughId: "find-meals-walkthrough",
        aliases: ["food near me", "near me", "find", "nearby food", "nearby", "local food", "food nearby"]
      }
    ]
  },

  // DELETED: KIDS_HUB (Phase 1 cleanup — will be replaced by Healthy Kids Hub in Phase 2)

  DIABETIC_HUB: {
    id: "DIABETIC_HUB",
    legacyId: "diabetic-hub",
    primaryRoute: "/diabetic-hub",
    isHub: true,
    hubSize: "small",
    keywords: ["diabetic", "diabetes", "blood sugar", "glucose", "sugar control", "diabetic meals", "diabetic hub", "diabetes hub", "diabetes support"],
    subOptions: [
      {
        id: "DIABETES_SUPPORT",
        label: "Diabetes Support",
        route: "/diabetic-hub",
        testId: "diabetichub-support",
        aliases: ["support", "diabetes support", "diabetic support", "hub"]
      },
      {
        id: "DIABETIC_BUILDER",
        label: "Diabetic Menu Builder",
        route: "/diabetic-menu-builder",
        testId: "diabetichub-builder",
        walkthroughId: "diabetic-meal-builder",
        aliases: ["diabetic builder", "diabetes builder", "d-build", "build diabetic"]
      }
    ]
  },

  GLP1_HUB: {
    id: "GLP1_HUB",
    legacyId: "glp1-hub",
    primaryRoute: "/glp1-hub",
    isHub: true,
    hubSize: "small",
    keywords: ["glp", "glp-1", "glp1", "ozempic", "wegovy", "semaglutide", "injection", "glp one", "g l p one", "glp hub", "glp-1 hub", "weight loss meds"],
    subOptions: [
      {
        id: "GLP1_BUILDER",
        label: "GLP-1 Meal Builder",
        route: "/glp1-menu-builder",
        testId: "glp1hub-builder",
        walkthroughId: "glp1-meal-builder",
        aliases: ["glp1 builder", "glp-1 builder", "glp one builder", "glp menu", "glp-build", "build glp"]
      }
    ]
  },

  SUPPLEMENT_HUB: {
    id: "SUPPLEMENT_HUB",
    legacyId: "supplement-hub",
    primaryRoute: "/supplement-hub", // Changed from /supplement-hub-landing (landing page hidden)
    isHub: true,
    hubSize: "small",
    keywords: ["supplements", "supplement hub", "vitamins", "nutrition supplements", "supplement"],
    subOptions: [
      {
        id: "SUPPLEMENT_BROWSE",
        label: "Supplement Hub",
        route: "/supplement-hub",
        testId: "supplementhub-browse",
        aliases: ["browse", "hub", "products", "supplement hub", "supplements"]
      }
    ]
  }
};

/**
 * DIRECT PAGES (No Hub Routing)
 * Navigate directly to page when user says any keyword
 */
export const DIRECT_PAGES: Record<string, FeatureDefinition> = {
  FRIDGE_RESCUE: {
    id: "FRIDGE_RESCUE",
    legacyId: "fridge-rescue",
    primaryRoute: "/fridge-rescue",
    walkthroughId: "fridge-rescue-walkthrough", // Phase C.8
    isHub: false,
    keywords: ["fridge rescue", "rescue", "use my fridge", "ingredients", "what can i make", "fridge", "pantry rescue", "pantry", "leftover helper", "use ingredients", "rescue mode"]
  },

  MACRO_CALCULATOR: {
    id: "MACRO_CALCULATOR",
    legacyId: "macro-calculator",
    primaryRoute: "/macro-counter",
    walkthroughId: "macro-calculator-walkthrough",
    isHub: false,
    keywords: ["macros", "macro calculator", "protein calculator", "calorie calculator", "macro counter", "calculator", "macro setup", "macro goals", "macro tool", "calculate macros", "macro math", "macro calc"]
  },

  MY_BIOMETRICS: {
    id: "MY_BIOMETRICS",
    legacyId: "biometrics",
    primaryRoute: "/my-biometrics",
    walkthroughId: "biometrics-walkthrough",
    isHub: false,
    keywords: ["biometrics", "diet numbers", "profile numbers", "my macros profile", "tracking", "weight", "my biometrics", "bio metrics", "body metrics", "weight tracking", "body data", "my stats", "track weight"]
  },

  SHOPPING_LIST: {
    id: "SHOPPING_LIST",
    legacyId: "shopping-list",
    primaryRoute: "/shopping-list-v2",
    walkthroughId: "shopping-list-walkthrough",
    isHub: false,
    keywords: ["shopping list", "groceries", "master list", "shopping planner", "grocery", "shopping", "master shopping", "master shopping list", "grocery list", "list master", "grocery planner", "shop list", "food list"]
  },

  WEEKLY_MEAL_BUILDER: {
    id: "WEEKLY_MEAL_BUILDER",
    legacyId: "weekly-meal-board",
    primaryRoute: "/weekly-meal-board",
    walkthroughId: "weekly-meal-builder",
    isHub: false,
    keywords: ["weekly board", "meal board", "weekly planner", "meal builder", "meal board builder", "weekly", "plan my week", "weekly meal board", "weekly meal builder", "week planner", "meal week", "weekly meals", "weekly plan", "week", "plan"]
  },

  GET_INSPIRATION: {
    id: "GET_INSPIRATION",
    legacyId: "get-inspiration",
    primaryRoute: "/get-inspiration",
    walkthroughId: "inspiration-walkthrough", // Phase C.8
    isHub: false,
    keywords: ["inspiration", "ideas", "get ideas", "inspire me", "food ideas", "recipe ideas", "cooking ideas", "browse recipes"]
  },

  ANTI_INFLAMMATORY: {
    id: "ANTI_INFLAMMATORY",
    legacyId: "anti-inflammatory",
    primaryRoute: "/anti-inflammatory-menu-builder",
    walkthroughId: "anti-inflammatory-meal-builder",
    isHub: false,
    keywords: ["anti-inflammatory", "inflammation", "anti inflammatory", "anti", "reduce inflammation", "inflammatory diet", "healing diet", "anti inflam"]
  },

  BEACH_BODY: {
    id: "BEACH_BODY",
    legacyId: "beach-body",
    primaryRoute: "/beach-body-meal-board",
    walkthroughId: "beach-body-meal-builder",
    isHub: false,
    keywords: ["beach body", "hard body", "summer shred", "lean out", "competition", "shred", "get lean", "cut", "cutting", "beach prep", "physique", "stage prep"]
  },

  PLANNER: {
    id: "PLANNER",
    legacyId: "planner",
    primaryRoute: "/planner",
    isHub: false,
    keywords: ["planner", "meal planner", "planning board", "planner page", "main planner", "planner hub", "nutrition planner"]
  },

  LIFESTYLE: {
    id: "LIFESTYLE",
    legacyId: "lifestyle",
    primaryRoute: "/lifestyle",
    isHub: false,
    keywords: ["lifestyle", "main lifestyle page", "nutrition lifestyle", "lifestyle hub", "lifestyle page"]
  },

  PRO_CARE: {
    id: "PRO_CARE",
    legacyId: "pro-care",
    primaryRoute: "/more",
    isHub: false,
    keywords: ["pro care", "professional care", "doctor care", "procare", "medical care", "professional help", "doctor", "more"]
  }
};

/**
 * Normalize query for keyword matching
 * Removes punctuation, extra whitespace, and lowercases
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Find feature by keyword in canonical registry (fuzzy match)
 * Checks hubs first (hub-first routing), then direct pages
 * Uses bidirectional matching + token-level fallback for partial utterances
 */
export function findFeatureFromRegistry(query: string): FeatureDefinition | null {
  const normalized = normalizeQuery(query);
  const queryTokens = normalized.split(' ').filter(t => t.length > 2); // Tokens with 3+ chars

  // Helper: check if query matches keyword
  const matches = (keyword: string): boolean => {
    const normalizedKeyword = normalizeQuery(keyword);
    
    // Exact/substring match (bidirectional)
    if (normalized.includes(normalizedKeyword) || normalizedKeyword.includes(normalized)) {
      return true;
    }
    
    // Token-level matching for partial utterances
    const keywordTokens = normalizedKeyword.split(' ').filter(t => t.length > 2);
    return queryTokens.some(qToken => 
      keywordTokens.some(kToken => 
        qToken.includes(kToken) || kToken.includes(qToken)
      )
    );
  };

  // Check hubs first (hub-first routing)
  for (const hub of Object.values(HUBS)) {
    if (hub.keywords.some(matches)) {
      return hub;
    }
  }

  // Then check direct pages
  for (const page of Object.values(DIRECT_PAGES)) {
    if (page.keywords.some(matches)) {
      return page;
    }
  }

  return null;
}

/**
 * Find hub by ID
 */
export function findHubById(hubId: string): FeatureDefinition | null {
  return HUBS[hubId] || null;
}

/**
 * Find sub-option within a hub by alias
 */
export function findSubOptionByAlias(hub: FeatureDefinition, query: string): SubOption | null {
  if (!hub.subOptions) return null;

  const normalized = query.toLowerCase().trim();

  for (const option of hub.subOptions) {
    if (option.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return option;
    }
  }

  return null;
}

/**
 * Get hub prompt message based on hub size
 * Phase C.4: Hub-first routing with size-appropriate prompts
 * Phase C.7: Prioritize selectionPrompt metadata when available
 */
export function getHubPromptMessage(hub: FeatureDefinition): string {
  if (!hub.isHub || !hub.subOptions) return "";

  // Phase C.7: Use selectionPrompt metadata if available
  if (hub.selectionPrompt) {
    return hub.selectionPrompt;
  }

  // Fallback to Phase C.4 dynamic generation
  const hubLabel = hub.id.replace(/_HUB$/, '').replace(/_/g, ' ');
  const formattedLabel = hubLabel.charAt(0).toUpperCase() + hubLabel.slice(1).toLowerCase();

  if (hub.hubSize === "large") {
    // Large hubs (8+ options): Don't list all pages
    return `You're in the ${formattedLabel} Hub. What would you like to open?`;
  }

  // Small hubs (2 options): List the choices
  if (hub.subOptions.length === 2) {
    const firstLabel = hub.subOptions[0].label.replace(/^(Craving|Kids|Toddler)\s+/i, '');
    const secondLabel = hub.subOptions[1].label.replace(/^(Craving|Kids|Toddler)\s+/i, '');
    return `You're in the ${formattedLabel} Hub. Say '${firstLabel}' or '${secondLabel}', or tap a button.`;
  }

  // Fallback for 1 or 3+ options
  if (hub.subOptions.length === 1) {
    return `You're in the ${formattedLabel} Hub. Would you like to open ${hub.subOptions[0].label}?`;
  }

  const optionNames = hub.subOptions.map(o => o.label).join(", ");
  return `You're in the ${formattedLabel} Hub. Choose from: ${optionNames}`;
}

/**
 * Check if hub requires sub-selection (has multiple options)
 */
export function hubRequiresSubSelection(hub: FeatureDefinition): boolean {
  return hub.isHub && (hub.subOptions?.length ?? 0) > 1;
}
