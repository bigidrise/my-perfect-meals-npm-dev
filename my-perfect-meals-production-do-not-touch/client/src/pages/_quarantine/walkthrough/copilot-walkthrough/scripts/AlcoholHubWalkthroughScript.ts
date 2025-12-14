// Alcohol Hub Walkthrough Script - Phase C.7
import type { WalkthroughScript } from "../WalkthroughTypes";

const AlcoholHubWalkthroughScript: WalkthroughScript = {
  id: "alcohol-hub-walkthrough",
  featureId: "ALCOHOL_HUB",
  title: "Spirits & Lifestyle Hub",
  uiReady: true, // ✅ ACTIVATED: Phase C.7 complete - all hub events wired (Nov 24 2025)
  steps: [
    {
      id: "welcome",
      targetTestId: "button-back-to-lifestyle",
      description: "Welcome to the Spirits & Lifestyle Hub! Navigate social moments mindfully with smart drink choices, pairings, tracking tools, and alternatives.",
      waitForEvent: { testId: "alcohol-hub-opened", event: "opened" },
    },
    {
      id: "selection",
      targetTestId: "alcoholhub-lean",
      description: "What would you like to explore? You can say: 'Lean & Social', 'Mocktails', 'Wine Pairing', 'Beer Pairing', 'Bourbon', 'Alcohol Log', 'Meal Pairing', or 'Weaning Off'.",
      waitForEvent: { testId: "alcohol-hub-selected", event: "selected" },
    },
    {
      id: "confirmation",
      targetTestId: "alcoholhub-lean",
      description: "Excellent choice! Opening it now.",
    },
  ],
};

export default AlcoholHubWalkthroughScript;
