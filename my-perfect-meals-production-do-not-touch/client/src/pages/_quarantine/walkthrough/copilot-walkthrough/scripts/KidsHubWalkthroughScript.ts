// Kids Hub Walkthrough Script - Phase C.7
import type { WalkthroughScript } from "../WalkthroughTypes";

const KidsHubWalkthroughScript: WalkthroughScript = {
  id: "kids-hub-walkthrough",
  featureId: "KIDS_HUB",
  title: "Kids Meals Hub",
  uiReady: true, // ✅ ACTIVATED: Phase C.7 complete - all hub events wired (Nov 24 2025)
  steps: [
    {
      id: "welcome",
      targetTestId: "kids-meals-hero",
      description: "Welcome to the Kids Meals Hub! Find nutritious, kid-friendly meals that your children will actually enjoy eating.",
      waitForEvent: { testId: "kids-hub-opened", event: "opened" },
    },
    {
      id: "selection",
      targetTestId: "kids-meals-hero",
      description: "Choose what you need: 'Kids Meals' for ages 4-12, or 'Toddler Meals' for ages 1-3. Each collection is age-appropriate and nutrition-optimized.",
      waitForEvent: { testId: "kids-hub-selected", event: "selected" },
    },
    {
      id: "confirmation",
      targetTestId: "kids-meals-hero",
      description: "Perfect! Let's explore those meals.",
    },
  ],
};

export default KidsHubWalkthroughScript;
