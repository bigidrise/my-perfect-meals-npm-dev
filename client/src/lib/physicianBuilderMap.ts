export type PhysicianBuilderKey =
  | "diabetic"
  | "glp1"
  | "anti_inflammatory"
  | "general_clinical";

export interface PhysicianBuilderEntry {
  key: PhysicianBuilderKey;
  label: string;
  proRoute: string;
  description: string;
}

export const PHYSICIAN_BUILDER_MAP: Record<PhysicianBuilderKey, PhysicianBuilderEntry> = {
  diabetic: {
    key: "diabetic",
    label: "Diabetic Meal Builder",
    proRoute: "diabetic-builder",
    description: "Glucose-controlled meals for diabetic and pre-diabetic patients.",
  },
  glp1: {
    key: "glp1",
    label: "GLP-1 Meal Builder",
    proRoute: "glp1-builder",
    description: "Portion-aware meals designed for patients on GLP-1 medications.",
  },
  anti_inflammatory: {
    key: "anti_inflammatory",
    label: "Anti-Inflammatory Builder",
    proRoute: "anti-inflammatory-builder",
    description: "Whole-food, anti-inflammatory meal plans for chronic condition support.",
  },
  general_clinical: {
    key: "general_clinical",
    label: "General Clinical Builder",
    proRoute: "general-nutrition-builder",
    description: "Balanced clinical nutrition with physician-set macro targets.",
  },
};

export const ALL_PHYSICIAN_BUILDER_KEYS = Object.keys(
  PHYSICIAN_BUILDER_MAP,
) as PhysicianBuilderKey[];

export function isValidPhysicianBuilderKey(key: string): key is PhysicianBuilderKey {
  return key in PHYSICIAN_BUILDER_MAP;
}
