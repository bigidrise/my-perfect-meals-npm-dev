// Meal Pairing Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
// Note: This script was missing from C.5 package but exists in Alcohol Hub
import type { WalkthroughScript } from "../WalkthroughTypes";

const MealPairingScript: WalkthroughScript = {
  id: "meal-pairing-walkthrough",
  featureId: "MEAL_PAIRING",
  title: "Meal Pairing",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "mealpairing-hero",
      description: "Discover the perfect drinks to pair with your meals.",
      speak: "Discover the perfect drinks to pair with your meals.",
    },
    {
      id: "input",
      targetTestId: "mealpairing-input",
      description: "Enter your meal or select from suggestions.",
      speak: "Enter your meal or select from suggestions.",
    },
    {
      id: "results",
      targetTestId: "mealpairing-results",
      description: "View AI-recommended drink pairings for your meal.",
      speak: "View recommended drink pairings for your meal.",
    },
  ],
};

export default MealPairingScript;
