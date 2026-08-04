/**
 * AntiInflammatoryTrainingPage
 *
 * Thin wrapper that plugs the Training Nutrition Schedule into the
 * Anti-Inflammatory builder flow. Reuses PerformanceNutritionHub as-is —
 * only the title, back destination, and "Continue" destination differ.
 */
import PerformanceNutritionHub from "@/pages/PerformanceNutritionHub";

export default function AntiInflammatoryTrainingPage() {
  return (
    <PerformanceNutritionHub
      pageTitle="Training Nutrition Schedule"
      continueTo="/anti-inflammatory-menu-builder"
      returnTo="/anti-inflammatory-menu-builder"
    />
  );
}
