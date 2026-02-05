// client/src/lib/guestSuiteBranding.ts
// MPM Guest Suite Branding Constants
// Single source of truth for all guest suite copy and visuals
// TONE: Coach in your pocket - supportive but serious about your health
// RULE: If a screen doesn't sound like a coach, it doesn't belong in My Perfect Meals.

export const GUEST_SUITE_BRANDING = {
  // Primary branding
  name: "MPM Guest Experience",
  shortName: "MPM",
  
  // Hero copy - From the Voice & Coaching Manifesto
  heroTitle: "Welcome to the MPM Guest Experience",
  heroSubtitle: "This isn't a food app. It's a coach in your pocket — designed to help you eat well, enjoy food, and follow through.",
  heroDescription: "You get 4 meal days to experience what real nutrition coaching feels like. Plan complete days, cook them, live them.",
  
  // Header
  headerTitle: "MPM Guest Experience",
  
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
    backToSuiteButton: "Back to Guest Experience",
    backToSuiteSubtext: "See your progress & explore more",
  },
  
  // Loop limits - Coach them to use passes wisely
  // NOTE: Each meal day is a 24-HOUR SESSION, not a single visit
  loopLimits: {
    softNudgeBanner: "One meal day left. Make it count.",
    hardGateTitle: "Your 4 Meal Days Are Complete",
    hardGateDescription: "You've experienced what real coaching feels like. Now it's time to commit — save your meals, keep your progress, and let's do this for real.",
    createAccountButton: "I'm Ready — Create Account",
    comparePlansButton: "See What's Included",
    mealDayStartedToast: "Meal Day {count} of 4 Started",
    returningToSessionToast: "Welcome back — your meal day session is still active",
    blockedAccessTitle: "Guest Access Complete",
    blockedAccessDescription: "You've used your 4 meal days. Create an account to continue planning.",
  },
  
  // Coaching nudges for the meal board experience - From the Manifesto
  coaching: {
    // When they enter the meal board (toast/banner)
    welcomeToBoard: "When you plan meals here, plan the day. This system works best when you commit to a full day of eating — not just one meal.",
    
    // After adding first meal of a visit
    firstMealAdded: "Good start. Fill out the rest of your day — breakfast, lunch, dinner, snacks. One meal isn't a meal day.",
    
    // When they try to leave with only 1-2 meals (incomplete day warning)
    incompleteDayWarning: "This still counts as a meal day. If you're going to use the system, use it — you'll get more out of it.",
    
    // When they complete a full day (3+ meals across categories)
    fullDayComplete: "Good work. You planned a real day of meals. That's how consistency is built.",
    
    // Encouraging messages (rotated randomly)
    encouragement: [
      "Your health is worth the effort. Let's build something real.",
      "I'm serious about your health, even if you're not sure yet. Trust the process.",
      "This isn't about perfection. It's about showing up and doing the work.",
      "Every meal you plan is a step toward the body and energy you want.",
    ],
    
    // Subliminal coaching contract (what every screen should communicate)
    contract: {
      supported: "You're not alone. We're thinking for you.",
      expected: "This works if you participate.",
      discipline: "We don't let you drift — because your health matters.",
    },
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
    chefsKitchen: {
      label: "Chef's Kitchen",
      description: "Step-by-step guided cooking with voice instructions — your personal sous chef",
      lockedDescription: "Complete the flow to unlock",
    },
  },
  
  // Tone: Coach - cheerleader + drill sergeant with earned authority
  tone: "coach" as const,
  
  // The MPM difference - what makes this app unique (for marketing)
  philosophy: {
    tagline: "Coach in your pocket",
    mission: "We do the work for you, but you have to show up.",
    differentiator: "Other apps give you tools. We give you guidance. We actually talk to you.",
    promise: "My Perfect Meals is a coach-led nutrition system that thinks, plans, and guides — so you don't have to rely on willpower.",
  },
  
  // Voice test: Every button, empty state, warning, confirmation, modal, copilot message
  // should pass this test: "Does this sound like a coach?"
  voiceTest: "If a screen doesn't sound like a coach, it doesn't belong in My Perfect Meals.",
} as const;

export type GuestSuiteTone = typeof GUEST_SUITE_BRANDING.tone;

// Helper to get a random encouragement message
export function getRandomEncouragement(): string {
  const messages = GUEST_SUITE_BRANDING.coaching.encouragement;
  return messages[Math.floor(Math.random() * messages.length)];
}
