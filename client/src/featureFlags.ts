// ===========================================================
//  My Perfect Meals – Emotion AI Launch Feature Flags
//  Phase Control System (v1 Core Build)
// ===========================================================

// Runtime feature flags
export const FEATURES = {
  copilotSpotlight: import.meta.env.MODE === 'development', // Spotlight walkthrough system
  showCreateWithAI: false, // Hide "Create with AI" - using only "Create with Chef" for launch simplicity
};

export const LAUNCH_PHASES = {
  PHASE_1_CORE: [
    "dashboard",
    "macro-calculator",
    "biometrics",
    "craving-creator",
    "dessert-creator",
    "fridge-rescue",
    "restaurant-guide",
    "weekly-meal-board",
    "pro-team",
    "learn",
    "profile",
    "manage-subscription",
  ],
  PHASE_1_5_TRACKING: ["macro-counter", "water-journal", "sleep-steps"],
  PHASE_2_SPECIALTY: [
    "holiday-planner",
    "potluck-planner",
    "kids-meals",
    "clinical-hubs",
  ],
  PHASE_3_PRO: ["community", "alcohol-hubs", "success-stories"],
  PHASE_4_GAMES: ["game-hub", "celebration-mode", "voice-concierge"],
};

// Helper to check if a feature is active
export const isFeatureEnabled = (
  phase: keyof typeof LAUNCH_PHASES,
  feature: string,
) => LAUNCH_PHASES[phase].includes(feature);
