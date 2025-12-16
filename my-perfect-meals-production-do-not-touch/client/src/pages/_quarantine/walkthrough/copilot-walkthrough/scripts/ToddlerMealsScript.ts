// Toddler Meals Walkthrough Script
import type { WalkthroughScript} from "../WalkthroughTypes";

const ToddlerMealsScript: WalkthroughScript = {
  id: "toddler-meals-walkthrough",
  featureId: "TODDLER_MEALS",
  title: "Toddler Meals Hub",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "toddler-meals-hero",
      description: "Welcome to Toddler Meals Hub! Find age-appropriate, nutritious meals designed for your toddler's developmental needs.",
    },
    {
      id: "controls",
      targetTestId: "toddler-meals-controls",
      description: "Search meals, adjust serving sizes, and choose ingredient rounding to match your toddler's needs.",
    },
    {
      id: "grid",
      targetTestId: "toddler-meals-grid",
      description: "Browse toddler-friendly meals designed for little taste buds and growing bodies.",
    },
    {
      id: "select-meal",
      targetTestId: "toddler-meals-first-card",
      description: "Tap any meal card to view full details including nutrition facts and toddler-friendly preparation tips.",
      waitForEvent: { testId: "toddler-meal-opened", event: "done" },
    },
    {
      id: "meal-details",
      targetTestId: "toddler-meals-modal",
      description: "Review meal details with age-appropriate portions, nutrition information, and safe preparation instructions.",
    },
    {
      id: "add-to-shopping",
      targetTestId: "toddler-meals-shopping-bar",
      description: "Add ingredients to your shopping list with portions sized perfectly for your toddler.",
      waitForEvent: { testId: "toddler-meal-added", event: "done" },
    },
    {
      id: "success",
      targetTestId: "toddler-meals-hero",
      description: "All set! Use Toddler Meals Hub to discover safe, nutritious meals that support your toddler's growth.",
    },
  ],
};

export default ToddlerMealsScript;
