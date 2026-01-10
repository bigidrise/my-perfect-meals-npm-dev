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
  type: "diabetic" | "glp1" | "anti-inflammatory" | "weekly";
};

const BUILDER_MAP: Record<string, AssignedBuilder> = {
  diabetic: {
    path: "/diabetic-meal-builder",
    name: "Diabetic Meal Builder",
    type: "diabetic",
  },
  glp1: {
    path: "/glp1-meal-builder",
    name: "GLP-1 Meal Builder",
    type: "glp1",
  },
  "anti-inflammatory": {
    path: "/anti-inflammatory-builder",
    name: "Anti-Inflammatory Builder",
    type: "anti-inflammatory",
  },
  weekly: {
    path: "/weekly-meal-board",
    name: "Weekly Meal Board",
    type: "weekly",
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
 * Get the assigned builder from localStorage - checks user profile first,
 * then falls back to onboarding profile
 */
export function getAssignedBuilderFromStorage(): AssignedBuilder {
  try {
    // First, check the current user's selectedMealBuilder (set by AuthContext)
    const userStr = localStorage.getItem("mpm_current_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      // Check activeBoard first (ProCare assigned), then selectedMealBuilder
      const builderType = user.activeBoard || user.selectedMealBuilder;
      if (builderType && BUILDER_MAP[builderType]) {
        return BUILDER_MAP[builderType];
      }
      // Handle underscore variant (anti_inflammatory)
      if (builderType === "anti_inflammatory") {
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
