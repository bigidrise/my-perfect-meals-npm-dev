// Social Hub Walkthrough Script - Phase C.7
import type { WalkthroughScript } from "../WalkthroughTypes";

const SocialHubWalkthroughScript: WalkthroughScript = {
  id: "social-hub-walkthrough",
  featureId: "SOCIAL_HUB",
  title: "Socializing Hub",
  uiReady: true, // ✅ ACTIVATED: Phase C.7 complete - all hub events wired (Nov 24 2025)
  steps: [
    {
      id: "welcome",
      targetTestId: "button-back-to-lifestyle",
      description: "Welcome to the Socializing Hub! Eating out with friends? Make smart choices without missing the fun.",
      waitForEvent: { testId: "social-hub-opened", event: "opened" },
    },
    {
      id: "selection",
      targetTestId: "socialhub-guide",
      description: "What do you need? Say 'Restaurant Guide' to get AI-powered healthy options from any restaurant, or 'Find Meals' to search local restaurants by craving and location.",
      waitForEvent: { testId: "social-hub-selected", event: "selected" },
    },
    {
      id: "confirmation",
      targetTestId: "socialhub-guide",
      description: "Perfect! Let's get started.",
    },
  ],
};

export default SocialHubWalkthroughScript;
