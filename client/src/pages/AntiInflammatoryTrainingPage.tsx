/**
 * AntiInflammatoryTrainingPage
 *
 * Thin wrapper that plugs the Training Nutrition Schedule into the
 * Anti-Inflammatory builder flow. Reuses PerformanceNutritionHub as-is —
 * only the title, back destination, and "Continue" destination differ.
 */
import TrainingNutritionHub from "@/pages/TrainingNutritionHub";

export default function AntiInflammatoryTrainingPage() {
  return (
    <TrainingNutritionHub
      pageTitle="Training Nutrition Schedule"
      continueLabel="Launch Anti-Inflammatory Builder"
      continueTo="/anti-inflammatory-menu-builder"
      returnTo="/anti-inflammatory-menu-builder"
    />
  );
}
