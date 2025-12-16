// Craving Premades Walkthrough Script
import type { WalkthroughScript } from "../WalkthroughTypes";

const CravingPremadesScript: WalkthroughScript = {
  id: "craving-premades-walkthrough",
  featureId: "CRAVING_PREMADES",
  title: "Premade Cravings",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "craving-premades-hero",
      description: "Welcome to Premade Cravings! Browse our curated collection of delicious, health-optimized meals designed to satisfy your cravings without compromising your goals.",
    },
    {
      id: "controls",
      targetTestId: "craving-premades-controls",
      description: "Use these controls to search meals, adjust serving sizes, and choose your preferred ingredient rounding method.",
    },
    {
      id: "grid",
      targetTestId: "craving-premades-grid",
      description: "Browse our complete collection of premade craving meals. Each meal is designed with nutrition and flavor in mind.",
    },
    {
      id: "select-meal",
      targetTestId: "craving-premades-first-card",
      description: "Tap any meal card to view full details including nutrition facts, ingredients, and cooking instructions.",
      waitForEvent: { testId: "craving-premade-selected", event: "done" },
    },
    {
      id: "meal-details",
      targetTestId: "craving-premades-modal",
      description: "Review the complete meal details including scaled ingredients for your selected serving size, nutrition breakdown, and step-by-step instructions.",
    },
    {
      id: "add-to-shopping",
      targetTestId: "craving-premades-shopping-bar",
      description: "Add all ingredients to your shopping list with one tap. Quantities are automatically scaled to your serving size.",
      waitForEvent: { testId: "craving-premade-added", event: "done" },
    },
    {
      id: "success",
      targetTestId: "craving-premades-hero",
      description: "You're all set! Browse premade cravings anytime to find delicious, nutrition-optimized meals that fit your lifestyle.",
    },
  ],
};

export default CravingPremadesScript;
