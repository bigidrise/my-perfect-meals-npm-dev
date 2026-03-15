export type ProfessionalRole = "trainer" | "physician" | "both";

export type ProfessionalBuilderKey =
  | "weekly"
  | "general_nutrition"
  | "beach_body"
  | "performance_competition"
  | "anti_inflammatory"
  | "diabetic"
  | "glp1";

export interface ProfessionalBuilderEntry {
  key: ProfessionalBuilderKey;
  role: ProfessionalRole;
  label: string;
  proRoute: string;
  description: string;
}

export const PROFESSIONAL_BUILDER_MAP: Record<
  ProfessionalBuilderKey,
  ProfessionalBuilderEntry
> = {
  weekly: {
    key: "weekly",
    role: "both",
    label: "Weekly Meal Board",
    proRoute: "weekly-builder",
    description: "A flexible weekly meal plan for general fitness clients.",
  },
  general_nutrition: {
    key: "general_nutrition",
    role: "both",
    label: "General Nutrition",
    proRoute: "general-nutrition-builder",
    description: "Balanced macro targets for everyday nutrition goals.",
  },
  beach_body: {
    key: "beach_body",
    role: "both",
    label: "Beach Body",
    proRoute: "beach-body-builder",
    description: "Lean physique and fat-loss focused meal planning.",
  },
  performance_competition: {
    key: "performance_competition",
    role: "both",
    label: "Performance & Competition",
    proRoute: "performance-competition-builder",
    description: "High-performance fueling for athletes and competitors.",
  },
  anti_inflammatory: {
    key: "anti_inflammatory",
    role: "both",
    label: "Anti-Inflammatory",
    proRoute: "anti-inflammatory-builder",
    description: "Whole-food, anti-inflammatory meals for recovery and chronic conditions.",
  },
  diabetic: {
    key: "diabetic",
    role: "both",
    label: "Diabetic",
    proRoute: "diabetic-builder",
    description: "Glucose-controlled meals for diabetic and pre-diabetic clients.",
  },
  glp1: {
    key: "glp1",
    role: "both",
    label: "GLP-1",
    proRoute: "glp1-builder",
    description: "Portion-aware meals for clients on GLP-1 medications.",
  },
};

export function getBuildersByRole(
  role: "trainer" | "physician",
): ProfessionalBuilderEntry[] {
  return Object.values(PROFESSIONAL_BUILDER_MAP).filter(
    (entry) => entry.role === role || entry.role === "both",
  );
}

export function getBuilderKeys(
  role: "trainer" | "physician",
): ProfessionalBuilderKey[] {
  return getBuildersByRole(role).map((e) => e.key);
}

export function isValidProfessionalBuilderKey(
  key: string,
): key is ProfessionalBuilderKey {
  return key in PROFESSIONAL_BUILDER_MAP;
}
