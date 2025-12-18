// Kids Meals Walkthrough Script
import type { WalkthroughScript } from "../WalkthroughTypes";

const KidsMealsScript: WalkthroughScript = {
  id: "kids-meals-walkthrough",
  featureId: "KIDS_MEALS",
  title: "Kids Meals Hub",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "kids-meals-hero",
      description: "Welcome to Kids Meals Hub! Discover nutritious, kid-approved meals designed by nutrition experts to support healthy growth and development.",
    },
    {
      id: "controls",
      targetTestId: "kids-meals-controls",
      description: "Search for meals, adjust serving sizes, and choose your preferred ingredient rounding method to match your family's needs.",
    },
    {
      id: "grid",
      targetTestId: "kids-meals-grid",
      description: "Browse our collection of healthy, delicious kids meals. Each recipe is designed to provide balanced nutrition kids love.",
    },
    {
      id: "select-meal",
      targetTestId: "kids-meals-first-card",
      description: "Tap any meal card to view complete details including nutrition facts, ingredients, and cooking instructions.",
      waitForEvent: { testId: "kids-meal-opened", event: "done" },
    },
    {
      id: "meal-details",
      targetTestId: "kids-meals-modal",
      description: "Review the meal details with scaled ingredients, nutrition breakdown per serving, and kid-friendly cooking instructions.",
    },
    {
      id: "add-to-shopping",
      targetTestId: "kids-meals-shopping-bar",
      description: "Add all ingredients to your shopping list. Quantities automatically scale to your selected serving size.",
      waitForEvent: { testId: "kids-meal-added", event: "done" },
    },
    {
      id: "success",
      targetTestId: "kids-meals-hero",
      description: "Perfect! Use Kids Meals Hub anytime to find healthy, kid-approved recipes that make mealtime easier and more nutritious.",
    },
  ],
};

export default KidsMealsScript;
