export type BuilderKey =
  | "weekly"
  | "diabetic"
  | "glp1"
  | "anti_inflammatory"
  | "beach_body"
  | "general_nutrition"
  | "performance_competition";

export interface BuilderEntry {
  key: BuilderKey;
  label: string;
  clientRoute: string;
  proRoute: string;
}

export const BUILDER_MAP: Record<BuilderKey, BuilderEntry> = {
  weekly: {
    key: "weekly",
    label: "Weekly",
    clientRoute: "/weekly-meal-board",
    proRoute: "board/weekly",
  },
  diabetic: {
    key: "diabetic",
    label: "Diabetic",
    clientRoute: "/diabetic-menu-builder",
    proRoute: "board/diabetic",
  },
  glp1: {
    key: "glp1",
    label: "GLP-1",
    clientRoute: "/glp1-meal-builder",
    proRoute: "board/glp1",
  },
  anti_inflammatory: {
    key: "anti_inflammatory",
    label: "Anti-Inflammatory",
    clientRoute: "/anti-inflammatory-menu-builder",
    proRoute: "board/medical",
  },
  beach_body: {
    key: "beach_body",
    label: "Beach Body",
    clientRoute: "/beach-body-meal-board",
    proRoute: "board/beach_body",
  },
  general_nutrition: {
    key: "general_nutrition",
    label: "General Nutrition",
    clientRoute: "/pro/general-nutrition-builder",
    proRoute: "board/smart",
  },
  performance_competition: {
    key: "performance_competition",
    label: "Performance & Competition",
    clientRoute: "/performance-competition-builder",
    proRoute: "board/athlete",
  },
};

export const ALL_BUILDER_KEYS = Object.keys(BUILDER_MAP) as BuilderKey[];

export function isValidBuilderKey(key: string): key is BuilderKey {
  return key in BUILDER_MAP;
}
