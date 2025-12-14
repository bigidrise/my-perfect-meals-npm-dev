// Fridge Rescue Walkthrough Script - Phase C.8
import type { WalkthroughScript } from "../WalkthroughTypes";

const FridgeRescueWalkthroughScript: WalkthroughScript = {
  id: "fridge-rescue-walkthrough",
  featureId: "FRIDGE_RESCUE",
  title: "Fridge Rescue",
  uiReady: true, // ✅ ACTIVATED: Phase C.8 complete - all anchors + events wired (Nov 24 2025)
  steps: [
    {
      id: "intro",
      targetTestId: "fridge-input",
      description: "Welcome to Fridge Rescue! Type the ingredients you have at home and we'll create healthy meals for you.",
      waitForEvent: { testId: "fridge-rescue-opened", event: "opened" },
    },
    {
      id: "generate",
      targetTestId: "fridge-generate",
      description: "Now press 'Generate 3 Meals' to build meals from your ingredients using AI.",
      waitForEvent: { testId: "fridge-rescue-interacted", event: "interacted" },
    },
    {
      id: "results",
      targetTestId: "fridge-results",
      description: "Great! Here are your personalized meals. Tap any recipe to see full details or add it to your meal plan.",
      waitForEvent: { testId: "fridge-rescue-completed", event: "completed" },
    },
  ],
};

export default FridgeRescueWalkthroughScript;
