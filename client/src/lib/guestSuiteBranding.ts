// client/src/lib/guestSuiteBranding.ts
// MPM Guest Suite Branding Constants
// Single source of truth for all guest suite copy and visuals

export const GUEST_SUITE_BRANDING = {
  // Primary branding
  name: "MPM Guest Suite",
  shortName: "MPM",
  
  // Hero copy
  heroTitle: "MPM Guest Suite",
  heroSubtitle: "Experience AI-powered meal planning. No account required.",
  heroDescription: "Build meals, generate shopping lists, and see your nutrition come together.",
  
  // Header
  headerTitle: "MPM Guest Suite",
  
  // Phase 1 - Guided Build
  phase1: {
    sectionTitle: "Get Started",
    macrosPrompt: "Start here — set your nutrition targets",
    mealBuilderPrompt: "Build your first meal",
    shoppingPrompt: "View your shopping list",
  },
  
  // Phase 2 - Unlocked/Revealed
  phase2: {
    sectionTitle: "Explore More",
    biometricsRevealToast: "Biometrics is now available",
    backToSuiteButton: "Back to Guest Suite",
    backToSuiteSubtext: "View biometrics & explore features",
  },
  
  // Loop limits (based on meal day visits, not individual meals)
  loopLimits: {
    softNudgeBanner: "You've planned 3 of 4 meal days — one trip left",
    hardGateTitle: "Your 4 meal day passes are complete",
    hardGateDescription: "You've experienced the concierge. Save your meals, keep your biometrics, and unlock unlimited planning.",
    createAccountButton: "Create Account",
    comparePlansButton: "Compare Plans",
    mealDayToast: "Meal Day {count} of 4 used",
  },
  
  // Feature cards
  features: {
    macroCalculator: {
      label: "Macro Calculator",
      description: "Calculate your personal targets in under a minute",
      lockedDescription: "Start here — set your nutrition targets",
    },
    weeklyMealBuilder: {
      label: "Weekly Meal Builder",
      description: "Build meals on a weekly board and see how everything fits",
      lockedDescription: "Complete Macro Calculator to unlock",
    },
    biometrics: {
      label: "Biometrics",
      description: "Track your nutrition data and see your progress",
      lockedDescription: "Complete the flow to unlock",
    },
    shoppingList: {
      label: "Shopping List",
      description: "Your complete grocery list for the week",
      lockedDescription: "Build meals to unlock",
    },
    fridgeRescue: {
      label: "Fridge Rescue",
      description: "Turn what you have into meals — no waste, no stress",
      lockedDescription: "Build your first meal to unlock preview",
    },
    cravingCreator: {
      label: "Craving Creator",
      description: "Healthier versions that still hit the spot",
      lockedDescription: "Build your first meal to unlock preview",
    },
  },
  
  // Tone: concierge, not trial
  tone: "concierge" as const,
} as const;

export type GuestSuiteTone = typeof GUEST_SUITE_BRANDING.tone;
