/**
 * DiabeticTrainingPage
 *
 * Thin wrapper that plugs the Training Nutrition Schedule into the
 * Diabetic builder flow. Reuses PerformanceNutritionHub as-is — only
 * the title, back destination, and "Continue" destination differ.
 */
import PerformanceNutritionHub from "@/pages/PerformanceNutritionHub";

export default function DiabeticTrainingPage() {
  return (
    <PerformanceNutritionHub
      pageTitle="Training Nutrition Schedule"
      continueTo="/diabetic-menu-builder"
      returnTo="/diabetic-hub"
    />
  );
}
