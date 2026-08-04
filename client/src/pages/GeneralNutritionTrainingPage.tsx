/**
 * GeneralNutritionTrainingPage
 *
 * Renders the shared Training Nutrition Schedule experience for General
 * Nutrition users. Reuses TrainingNutritionHub top-to-bottom — same
 * scheduling logic, same resolver, same macro display, same storage.
 *
 * Only the title, back destination, and "Continue" destination differ.
 * Performance Builder behavior is completely unchanged.
 */
import TrainingNutritionHub from "@/pages/TrainingNutritionHub";

export default function GeneralNutritionTrainingPage() {
  return (
    <TrainingNutritionHub
      pageTitle="Training Nutrition Schedule"
      continueLabel="Launch General Nutrition Builder"
      continueTo="/general-nutrition-builder/build"
      returnTo="/general-nutrition-builder"
    />
  );
}
