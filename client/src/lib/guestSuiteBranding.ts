// client/src/lib/guestSuiteBranding.ts
// MPM Guest Suite Branding Constants
// Single source of truth for all guest suite copy and visuals
// TONE: Coach in your pocket - supportive but serious about your health

export const GUEST_SUITE_BRANDING = {
  // Primary branding
  name: "MPM Guest Suite",
  shortName: "MPM",
  
  // Hero copy - Welcome to the coaching experience
  heroTitle: "Your Coach Is Ready",
  heroSubtitle: "This isn't just meal planning. This is how you take control of your health.",
  heroDescription: "You get 4 full meal days to experience what real nutrition coaching feels like. Use them wisely — build complete days, cook them, live them.",
  
  // Header
  headerTitle: "MPM Guest Suite",
  
  // Phase 1 - Guided Build
  phase1: {
    sectionTitle: "Let's Get Started",
    macrosPrompt: "First things first — let's set your personal targets",
    mealBuilderPrompt: "Now let's build your meals",
    shoppingPrompt: "Your shopping list is ready",
  },
  
  // Phase 2 - Unlocked/Revealed
  phase2: {
    sectionTitle: "You're Making Progress",
    biometricsRevealToast: "Nice work. Biometrics is now unlocked.",
    backToSuiteButton: "Back to Guest Suite",
    backToSuiteSubtext: "See your progress & explore more",
  },
  
  // Loop limits - Coach them to use passes wisely
  loopLimits: {
    softNudgeBanner: "One meal day pass left. Make it count.",
    hardGateTitle: "You've Used Your 4 Meal Day Passes",
    hardGateDescription: "You've experienced what real coaching feels like. Now it's time to commit. Save your meals, keep your progress, and let's do this for real.",
    createAccountButton: "I'm Ready — Create Account",
    comparePlansButton: "See What's Included",
    mealDayToast: "Meal Day {count} of 4 — make it a full day",
  },
  
  // Coaching nudges for the meal board experience
  coaching: {
    // When they enter the meal board
    welcomeToBoard: "This counts as 1 of your 4 meal days. Build out breakfast, lunch, dinner, and snacks — then actually cook it and see how you feel.",
    
    // After adding first meal of a visit
    firstMealAdded: "Good start. Now fill out the rest of your day. One meal isn't a meal day — a complete day is.",
    
    // When they try to leave with only 1-2 meals
    incompleteDayWarning: "You've only built {count} meal(s). That's wasting a meal day pass. Complete your day before you go.",
    
    // When they complete a full day
    fullDayComplete: "That's what I'm talking about. A real meal day. Now cook it, eat it, and feel the difference.",
    
    // Encouraging messages
    encouragement: [
      "Your health is worth the effort. Let's build something real.",
      "I'm serious about your health, even if you're not sure yet. Trust the process.",
      "This isn't about perfection. It's about showing up and doing the work.",
      "Every meal you plan is a step toward the body and energy you want.",
    ],
  },
  
  // Feature cards
  features: {
    macroCalculator: {
      label: "Macro Calculator",
      description: "Your personalized nutrition targets — the foundation of everything",
      lockedDescription: "Start here — this is step one",
    },
    weeklyMealBuilder: {
      label: "Weekly Meal Builder",
      description: "Build complete meal days. This is where the real work happens.",
      lockedDescription: "Complete your macros first — then we build",
    },
    biometrics: {
      label: "Biometrics",
      description: "Track your data. What gets measured gets managed.",
      lockedDescription: "Unlock by completing the flow",
    },
    shoppingList: {
      label: "Shopping List",
      description: "Your grocery list for the week — no guessing, no wasted trips",
      lockedDescription: "Build meals to unlock",
    },
    fridgeRescue: {
      label: "Fridge Rescue",
      description: "Turn what you have into real meals — zero waste, zero excuses",
      lockedDescription: "Build your first meal to unlock",
    },
    cravingCreator: {
      label: "Craving Creator",
      description: "Healthier versions of what you're craving — still satisfying, actually good for you",
      lockedDescription: "Build your first meal to unlock",
    },
  },
  
  // Tone: Coach - cheerleader + drill sergeant
  tone: "coach" as const,
  
  // The MPM difference - what makes this app unique
  philosophy: {
    tagline: "Coach in your pocket",
    mission: "We do the work for you, but you have to show up.",
    differentiator: "Other apps give you tools. We give you guidance. We actually talk to you.",
  },
} as const;

export type GuestSuiteTone = typeof GUEST_SUITE_BRANDING.tone;

// Helper to get a random encouragement message
export function getRandomEncouragement(): string {
  const messages = GUEST_SUITE_BRANDING.coaching.encouragement;
  return messages[Math.floor(Math.random() * messages.length)];
}
