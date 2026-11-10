/**
 * DiabeticTrainingPage
 *
 * Thin wrapper that plugs the Training Nutrition Schedule into the
 * Diabetic builder flow. Reuses PerformanceNutritionHub as-is — only
 * the title, back destination, and "Continue" destination differ.
 */
import TrainingNutritionHub from "@/pages/TrainingNutritionHub";

export default function DiabeticTrainingPage() {
  return (
    <TrainingNutritionHub
      pageTitle="Training Nutrition Schedule"
      tutorialKey="trainingDiabetic"
      continueLabel="Launch Diabetic Menu Builder"
      continueTo="/diabetic-menu-builder"
      returnTo="/diabetic-builder"
    />
  );
}
