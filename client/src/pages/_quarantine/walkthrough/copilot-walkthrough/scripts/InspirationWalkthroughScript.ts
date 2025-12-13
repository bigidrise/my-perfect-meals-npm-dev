// Get Inspiration Walkthrough Script - Phase C.8
import type { WalkthroughScript } from "../WalkthroughTypes";

const InspirationWalkthroughScript: WalkthroughScript = {
  id: "inspiration-walkthrough",
  featureId: "INSPIRATION",
  title: "Get Inspiration",
  uiReady: true, // ✅ ACTIVATED: Phase C.8 complete - all anchors + events wired (Nov 24 2025)
  steps: [
    {
      id: "intro",
      targetTestId: "inspire-quote-display",
      description: "Welcome to your daily inspiration! Get a fresh motivational quote each day and track your health journey in your private journal.",
      waitForEvent: { testId: "inspiration-opened", event: "opened" },
    },
    {
      id: "new-quote",
      targetTestId: "inspire-new-quote-button",
      description: "Tap the refresh button anytime to get a new quote that resonates with you today.",
      waitForEvent: { testId: "inspiration-interacted", event: "interacted" },
    },
    {
      id: "journal",
      targetTestId: "inspire-journal-input",
      description: "Great! You can also use the journal below to record your thoughts, progress, and health wins. Your entries are private and saved locally.",
      waitForEvent: { testId: "inspiration-completed", event: "completed" },
    },
  ],
};

export default InspirationWalkthroughScript;
