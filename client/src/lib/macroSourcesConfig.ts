// Macro Sources Configuration
// Central registry of all pages that can add macros to biometrics

const LS_LAST_ATHLETE_CLIENT = 'mpm_last_athlete_client_id';
const LAST_ATHLETE_CLIENT_KEY = LS_LAST_ATHLETE_CLIENT; // Using the constant defined above

// Helper to get the last used athlete board clientId
function getLastAthleteClientId(): string {
  try {
    return localStorage.getItem(LS_LAST_ATHLETE_CLIENT) || 'default';
  } catch {
    return 'default';
  }
}

export const MACRO_SOURCES = [
  {
    label: "Macro Calculator",
    slug: "macro-calculator",
    route: "/macro-counter"
  },
  {
    label: "Fridge Rescue",
    slug: "fridge-rescue",
    route: "/fridge-rescue"
  },
  {
    label: "Craving Creator",
    slug: "craving-creator",
    route: "/craving-creator"
  },
  {
    label: "Weekly Meal Board",
    slug: "weekly-meal-board",
    route: "/weekly-meal-board"
  },
  {
    label: "Smart Menu Builder",
    slug: "smart-menu-builder",
    route: "/smart-menu-builder"
  },
  {
    label: "Diabetic Meal Builder",
    slug: "diabetic-meal-builder",
    route: "/diabetic-menu-builder"
  },
  {
    label: "GLP-1 Menu Builder",
    slug: "glp1-menu-builder",
    route: "/glp1-meal-builder"
  },
  {
    label: "Lifestyle Diets Menu Builder",
    slug: "lifestyle-diets-menu-builder",
    route: "/specialty-diets"
  },
  {
    label: "Clinical Lifestyle Builder",
    slug: "clinical-lifestyle-builder",
    route: "/clinical-lifestyle-hub"
  },
  {
    label: "Fast Food Hub",
    slug: "fast-food-hub",
    route: "/fast-food"
  },
  {
    label: "Holiday Feast Planner",
    slug: "holiday-feast-planner",
    route: "/holiday-feast-planner"
  },
  {
    label: "Potluck Planner",
    slug: "potluck-planner",
    route: "/potluck-planner"
  },
  {
    label: "Cultural Cuisines",
    slug: "cultural-cuisines",
    route: "/cultural-cuisines"
  },
  {
    label: "Performance & Competition Builder",
    slug: "performance-competition-builder",
    get route() {
      // Dynamically resolve to the last used Performance Competition Builder clientId
      return `/performance-competition-builder`;
    }
  },
  {
    label: "General Nutrition Builder",
    slug: "general-nutrition-builder",
    route: "/pro/clients"
  }
] as const;

export type MacroSourceSlug = typeof MACRO_SOURCES[number]["slug"];

export function getMacroSourceBySlug(slug: string) {
  return MACRO_SOURCES.find(s => s.slug === slug);
}

// Store the last used athlete board clientId for routing
export function saveLastPerformanceClientId(clientId: string): void {
  try {
    localStorage.setItem(LAST_ATHLETE_CLIENT_KEY, clientId);
  } catch (error) {
    console.error("Failed to save last performance client ID:", error);
  }
}

// Legacy alias for backward compatibility
export const saveLastAthleteClientId = saveLastPerformanceClientId;