// Craving Hub Walkthrough Script - Phase C.7
import type { WalkthroughScript } from "../WalkthroughTypes";

const CravingHubWalkthroughScript: WalkthroughScript = {
  id: "craving-hub-walkthrough",
  featureId: "CRAVING_HUB",
  title: "Craving Hub",
  uiReady: true, // ✅ ACTIVATED: Phase C.7 complete - all hub events wired (Nov 24 2025)
  steps: [
    {
      id: "welcome",
      targetTestId: "button-back-to-lifestyle",
      description: "Welcome to the Craving Hub! Here you can generate healthy versions of your cravings using AI, or choose from our premade recipes.",
      waitForEvent: { testId: "craving-hub-opened", event: "opened" },
    },
    {
      id: "selection",
      targetTestId: "cravinghub-creator",
      description: "Which part do you want? Say 'Creator' to build custom meals, or 'Premades' to browse our curated recipes.",
      waitForEvent: { testId: "craving-hub-selected", event: "selected" },
    },
    {
      id: "confirmation",
      targetTestId: "cravinghub-creator",
      description: "Great! Opening it now.",
    },
  ],
};

export default CravingHubWalkthroughScript;
