// Lean & Social Drinks Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const LeanSocialScript: WalkthroughScript = {
  id: "lean-social-walkthrough",
  featureId: "LEAN_SOCIAL",
  title: "Lean & Social Drinks",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "leansocial-hero",
      description: "Welcome to Lean & Social! Browse low-calorie drink options that let you enjoy social moments while staying on track.",
      speak: "Welcome to Lean & Social! Browse low-calorie drink options.",
    },
    {
      id: "browse",
      targetTestId: "leansocial-grid",
      description: "Browse the low-calorie drink options.",
      speak: "Browse the drink options below.",
    },
    {
      id: "select",
      targetTestId: "leansocial-card",
      description: "Tap any drink to view full details and mixing instructions.",
      speak: "Tap any drink to view details and mixing instructions.",
    },
  ],
};

export default LeanSocialScript;
