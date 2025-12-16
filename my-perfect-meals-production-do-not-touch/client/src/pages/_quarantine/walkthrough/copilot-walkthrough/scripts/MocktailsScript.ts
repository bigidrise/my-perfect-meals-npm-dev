// Mocktails Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const MocktailsScript: WalkthroughScript = {
  id: "mocktails-walkthrough",
  featureId: "MOCKTAILS",
  title: "Mocktails",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "mocktails-hero",
      description: "Welcome to Mocktails! Discover alcohol-free drinks that are just as delicious and sophisticated.",
      speak: "Welcome to Mocktails! Discover alcohol-free drinks.",
    },
    {
      id: "browse",
      targetTestId: "mocktails-grid",
      description: "Browse the mocktail menu.",
      speak: "Browse the mocktail menu.",
    },
    {
      id: "select",
      targetTestId: "mocktails-card",
      description: "Tap any mocktail to see the full recipe.",
      speak: "Tap any mocktail to see the full recipe.",
    },
  ],
};

export default MocktailsScript;
