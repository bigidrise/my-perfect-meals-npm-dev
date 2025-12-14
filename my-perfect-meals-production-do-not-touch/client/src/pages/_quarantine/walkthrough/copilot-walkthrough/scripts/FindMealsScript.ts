// Find Meals Near Me Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const FindMealsScript: WalkthroughScript = {
  id: "find-meals-walkthrough",
  featureId: "FIND_MEALS",
  title: "Find Meals Near Me",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "findmeals-hero",
      description: "Locate diabetic-friendly, low-calorie, or macro-friendly meals near you.",
      speak: "Locate healthy meals near you.",
    },
    {
      id: "search",
      targetTestId: "findmeals-search",
      description: "Tap Search to detect your location and find healthy options nearby.",
      speak: "Tap Search to detect your location.",
    },
    {
      id: "results",
      targetTestId: "findmeals-results",
      description: "Browse nearby restaurants with healthy meal options.",
      speak: "Browse nearby restaurants with healthy options.",
    },
  ],
};

export default FindMealsScript;
