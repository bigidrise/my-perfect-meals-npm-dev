// Alcohol Log Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const AlcoholLogScript: WalkthroughScript = {
  id: "alcohol-log-walkthrough",
  featureId: "ALCOHOL_LOG",
  title: "Alcohol Log",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "alcohollog-hero",
      description: "Track your alcohol intake to stay mindful of your health goals.",
      speak: "Track your alcohol intake to stay mindful of your health goals.",
    },
    {
      id: "add-entry",
      targetTestId: "alcohollog-add",
      description: "Tap Add Entry to log a drink.",
      speak: "Tap Add Entry to log a drink.",
    },
    {
      id: "view-log",
      targetTestId: "alcohollog-list",
      description: "Review your alcohol log to see patterns and make informed decisions.",
      speak: "Review your alcohol log to see patterns.",
    },
  ],
};

export default AlcoholLogScript;
