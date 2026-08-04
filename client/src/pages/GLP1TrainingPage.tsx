/**
 * GLP1TrainingPage
 *
 * Thin wrapper that plugs the Training Nutrition Schedule into the
 * GLP-1 / Metabolic builder flow. Reuses PerformanceNutritionHub as-is —
 * only the title, back destination, and "Continue" destination differ.
 */
import TrainingNutritionHub from "@/pages/TrainingNutritionHub";

export default function GLP1TrainingPage() {
  return (
    <TrainingNutritionHub
      pageTitle="Training Nutrition Schedule"
      continueTo="/glp1-meal-builder"
      returnTo="/glp1-hub"
    />
  );
}
