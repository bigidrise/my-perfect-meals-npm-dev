// Macro Calculator Walkthrough Script - Phase C.8
import type { WalkthroughScript } from "../WalkthroughTypes";

const MacroCalculatorWalkthroughScript: WalkthroughScript = {
  id: "macro-calculator-walkthrough",
  featureId: "MACRO_CALCULATOR",
  title: "Macro Calculator",
  uiReady: false, // ❌ DISABLED: Replaced with Simple Walkthrough System (Nov 25 2025)
  steps: [
    {
      id: "intro",
      targetTestId: "macro-age",
      description: "Enter your age, height, weight, activity level, and fitness goal to calculate your personalized macro targets.",
      waitForEvent: { testId: "macro-calculator-opened", event: "opened" },
    },
    {
      id: "calculate",
      targetTestId: "macro-calc-button",
      description: "Now press 'Save These Targets' to calculate and apply your macros to all meal builders.",
      waitForEvent: { testId: "macro-calculator-interacted", event: "interacted" },
    },
    {
      id: "results",
      targetTestId: "macro-results",
      description: "Perfect! Your macro targets are now active. These will automatically guide all your meal planning and tracking.",
      waitForEvent: { testId: "macro-calculator-completed", event: "completed" },
    },
  ],
};

export default MacroCalculatorWalkthroughScript;
