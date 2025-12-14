// Craving Creator Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const CravingCreatorScript: WalkthroughScript = {
  id: "craving-creator-walkthrough",
  featureId: "CRAVING_CREATOR",
  title: "Craving Creator",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "cravingcreator-hero",
      description: "This is the Craving Creator. Start by typing or saying the food you're craving.",
      speak: "This is the Craving Creator. Start by typing or saying the food you're craving.",
    },
    {
      id: "input",
      targetTestId: "cravingcreator-input-box",
      description: "Enter the food you're craving here.",
      speak: "Enter the food you're craving here.",
    },
    {
      id: "generate",
      targetTestId: "cravingcreator-create-button",
      description: "Now press Create with AI to generate your healthy craving meal.",
      speak: "Now press Create with AI.",
    },
    {
      id: "results",
      targetTestId: "cravingcreator-results",
      description: "Here is your healthier craving version. Tap any card to view details.",
      speak: "Here is your healthier craving version. Tap any card to view details.",
    },
  ],
};

export default CravingCreatorScript;
