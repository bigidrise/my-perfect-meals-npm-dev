import { BUILDER_MAP, type BuilderKey } from "./builderMap";

export type AssignedBuilder = {
  path: string;
  name: string;
  type: string;
};

const LEGACY_BUILDER_MAP: Record<string, AssignedBuilder> = Object.fromEntries(
  Object.entries(BUILDER_MAP).map(([key, entry]) => [
    key,
    { path: entry.clientRoute, name: entry.label, type: key },
  ])
);

LEGACY_BUILDER_MAP["anti-inflammatory"] = LEGACY_BUILDER_MAP["anti_inflammatory"];

export function getAssignedBuilder(healthConditions?: string[]): AssignedBuilder {
  if (!healthConditions || healthConditions.length === 0) {
    return LEGACY_BUILDER_MAP.weekly;
  }

  const conditions = healthConditions.map((c) => c.toLowerCase());

  if (conditions.some((c) => c.includes("diabetic") || c.includes("diabetes"))) {
    return LEGACY_BUILDER_MAP.diabetic;
  }

  if (conditions.some((c) => c.includes("glp") || c.includes("ozempic") || c.includes("wegovy") || c.includes("mounjaro"))) {
    return LEGACY_BUILDER_MAP.glp1;
  }

  if (conditions.some((c) => c.includes("inflam") || c.includes("arthritis") || c.includes("autoimmune"))) {
    return LEGACY_BUILDER_MAP["anti-inflammatory"];
  }

  return LEGACY_BUILDER_MAP.weekly;
}

export function getAssignedBuilderFromStorage(): AssignedBuilder {
  try {
    const userStr = localStorage.getItem("mpm_current_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      const isProfessional = ["admin", "coach", "physician", "trainer"].includes(user.professionalRole || user.role || "");
      const isActualProCareClient = user.isProCare === true && !isProfessional;
      const builderType = isActualProCareClient
        ? (user.activeBoard || user.selectedMealBuilder)
        : (user.selectedMealBuilder || user.activeBoard);
      
      if (builderType && LEGACY_BUILDER_MAP[builderType]) {
        return LEGACY_BUILDER_MAP[builderType];
      }
      if (builderType === "anti_inflammatory") {
        return LEGACY_BUILDER_MAP["anti-inflammatory"];
      }
    }

    const guestBuilder = localStorage.getItem("guestSelectedBuilder");
    if (guestBuilder) {
      if (LEGACY_BUILDER_MAP[guestBuilder]) {
        return LEGACY_BUILDER_MAP[guestBuilder];
      }
      if (guestBuilder === "anti_inflammatory") {
        return LEGACY_BUILDER_MAP["anti-inflammatory"];
      }
    }

    const profileStr = localStorage.getItem("mpm.onboardingProfile");
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      return getAssignedBuilder(profile.healthConditions);
    }

    return LEGACY_BUILDER_MAP.weekly;
  } catch {
    return LEGACY_BUILDER_MAP.weekly;
  }
}

export function getAllBuilders(): AssignedBuilder[] {
  return Object.values(LEGACY_BUILDER_MAP);
}
