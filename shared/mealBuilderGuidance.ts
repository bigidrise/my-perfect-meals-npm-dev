import { BUILDER_NS } from "./builderNamespaces";

/** Presentation/routing metadata only. This never grants access or supplies targets. */
export const MEAL_BUILDER_GUIDANCE = {
  general_nutrition: { name: "General Nutrition Meal Builder", route: "/general-nutrition-builder/build", namespace: BUILDER_NS.GENERAL_NUTRITION, tourKey: "general-nutrition-builder" },
  diabetic: { name: "Diabetic Builder", route: "/diabetic-menu-builder", namespace: BUILDER_NS.DIABETIC, tourKey: "diabetic-menu-builder" },
  glp1: { name: "Metabolic Medication Builder", route: "/glp1-meal-builder", namespace: BUILDER_NS.GLP1, tourKey: "glp1-meal-builder" },
  anti_inflammatory: { name: "Anti-Inflammatory Builder", route: "/anti-inflammatory-menu-builder", namespace: BUILDER_NS.ANTI_INFLAMMATORY, tourKey: "anti-inflammatory-menu-builder" },
  beach_body: { name: "Performance Nutrition Builder", route: "/beach-body-meal-board", namespace: BUILDER_NS.BEACH_BODY, tourKey: "beach-body-meal-board" },
  performance_competition: { name: "Performance & Competition Builder", route: "/performance-competition-builder", namespace: BUILDER_NS.PERFORMANCE_COMPETITION, tourKey: "performance-competition-builder" },
  weekly: { name: "Weekly Meal Builder", route: "/weekly-meal-board", namespace: "", tourKey: "weekly-meal-board" },
} as const;

export type GuidedMealBuilderKey = keyof typeof MEAL_BUILDER_GUIDANCE;
export function mealBuilderGuidance(key: string | null | undefined) {
  return key && Object.prototype.hasOwnProperty.call(MEAL_BUILDER_GUIDANCE, key)
    ? MEAL_BUILDER_GUIDANCE[key as GuidedMealBuilderKey] : null;
}
