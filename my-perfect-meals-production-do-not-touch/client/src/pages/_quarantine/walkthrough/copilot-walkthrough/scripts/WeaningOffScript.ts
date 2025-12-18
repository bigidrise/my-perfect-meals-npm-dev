// Weaning Off Tool Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
// Note: This script was missing from C.5 package but exists in Alcohol Hub
import type { WalkthroughScript } from "../WalkthroughTypes";

const WeaningOffScript: WalkthroughScript = {
  id: "weaning-off-walkthrough",
  featureId: "WEANING_OFF",
  title: "Weaning Off Tool",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "weaningoff-hero",
      description: "Create a personalized plan to gradually reduce your alcohol intake safely.",
      speak: "Create a personalized plan to reduce your alcohol intake safely.",
    },
    {
      id: "setup",
      targetTestId: "weaningoff-setup",
      description: "Set your current intake and reduction goals.",
      speak: "Set your current intake and reduction goals.",
    },
    {
      id: "plan",
      targetTestId: "weaningoff-plan",
      description: "Follow your personalized tapering schedule to reduce safely.",
      speak: "Follow your personalized tapering schedule.",
    },
  ],
};

export default WeaningOffScript;
