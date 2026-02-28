/**
 * Determines the user's assigned meal builder based on their health profile.
 * 
 * Priority order (highest to lowest):
 * 1. Diabetic → /diabetic-meal-builder
 * 2. GLP-1 → /glp1-meal-builder  
 * 3. Anti-inflammatory → /anti-inflammatory-builder
 * 4. Default → /weekly-meal-board
 * 
 * This follows the subscription tier logic where Basic users get ONE
 * health-based meal builder assigned at signup based on their conditions.
 */

export type AssignedBuilder = {
  path: string;
  name: string;
  type: "diabetic" | "glp1" | "anti-inflammatory" | "weekly" | "general_nutrition" | "performance_competition";
};

const BUILDER_MAP: Record<string, AssignedBuilder> = {
  diabetic: {
    path: "/diabetic-menu-builder",
    name: "Diabetic Meal Builder",
    type: "diabetic",
  },
  glp1: {
    path: "/glp1-meal-builder",
    name: "GLP-1 Meal Builder",
    type: "glp1",
  },
  "anti-inflammatory": {
    path: "/anti-inflammatory-menu-builder",
    name: "Anti-Inflammatory Builder",
    type: "anti-inflammatory",
  },
  anti_inflammatory: {
    path: "/anti-inflammatory-menu-builder",
    name: "Anti-Inflammatory Builder",
    type: "anti-inflammatory",
  },
  weekly: {
    path: "/weekly-meal-board",
    name: "Weekly Meal Board",
    type: "weekly",
  },
  beach_body: {
    path: "/beach-body-meal-board",
    name: "Beach Body Meal Builder",
    type: "weekly",
  },
  general_nutrition: {
    path: "/pro/general-nutrition-builder",
    name: "General Nutrition Builder",
    type: "general_nutrition",
  },
  performance_competition: {
    path: "/performance-competition-builder",
    name: "Performance & Competition Builder",
    type: "performance_competition",
  },
};

/**
 * Get the assigned builder based on health conditions array
 */
export function getAssignedBuilder(healthConditions?: string[]): AssignedBuilder {
  if (!healthConditions || healthConditions.length === 0) {
    return BUILDER_MAP.weekly;
  }

  const conditions = healthConditions.map((c) => c.toLowerCase());

  if (conditions.some((c) => c.includes("diabetic") || c.includes("diabetes"))) {
    return BUILDER_MAP.diabetic;
  }

  if (conditions.some((c) => c.includes("glp") || c.includes("ozempic") || c.includes("wegovy") || c.includes("mounjaro"))) {
    return BUILDER_MAP.glp1;
  }

  if (conditions.some((c) => c.includes("inflam") || c.includes("arthritis") || c.includes("autoimmune"))) {
    return BUILDER_MAP["anti-inflammatory"];
  }

  return BUILDER_MAP.weekly;
}

/**
 * Get the assigned builder from localStorage - checks multiple sources
 * Priority: 
 *   - For ProCare clients: activeBoard (coach-assigned) takes priority
 *   - For regular users: selectedMealBuilder (user-chosen) takes priority
 *   - Fallback: guestSelectedBuilder → onboarding profile → weekly
 */
export function getAssignedBuilderFromStorage(): AssignedBuilder {
  try {
    // FIRST: Check authenticated user's builder
    const userStr = localStorage.getItem("mpm_current_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      // For actual ProCare clients (not professionals), use coach-assigned activeBoard
      // For regular users and professionals, use their selectedMealBuilder
      const isProfessional = ["admin", "coach", "physician", "trainer"].includes(user.professionalRole || user.role || "");
      const isActualProCareClient = user.isProCare === true && !isProfessional;
      const builderType = isActualProCareClient
        ? (user.activeBoard || user.selectedMealBuilder)
        : (user.selectedMealBuilder || user.activeBoard);
      
      if (builderType && BUILDER_MAP[builderType]) {
        return BUILDER_MAP[builderType];
      }
      // Handle underscore variant (anti_inflammatory)
      if (builderType === "anti_inflammatory") {
        return BUILDER_MAP["anti-inflammatory"];
      }
    }

    // Second, check guest-specific builder selection (set during extended onboarding)
    // Only used if no authenticated user is present
    const guestBuilder = localStorage.getItem("guestSelectedBuilder");
    if (guestBuilder) {
      if (BUILDER_MAP[guestBuilder]) {
        return BUILDER_MAP[guestBuilder];
      }
      // Handle underscore variant (anti_inflammatory)
      if (guestBuilder === "anti_inflammatory") {
        return BUILDER_MAP["anti-inflammatory"];
      }
    }

    // Fallback: Check onboarding profile for health conditions
    const profileStr = localStorage.getItem("mpm.onboardingProfile");
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      return getAssignedBuilder(profile.healthConditions);
    }

    return BUILDER_MAP.weekly;
  } catch {
    return BUILDER_MAP.weekly;
  }
}

/**
 * Get all available builders (for development/testing when paywalls are off)
 */
export function getAllBuilders(): AssignedBuilder[] {
  return Object.values(BUILDER_MAP);
}
