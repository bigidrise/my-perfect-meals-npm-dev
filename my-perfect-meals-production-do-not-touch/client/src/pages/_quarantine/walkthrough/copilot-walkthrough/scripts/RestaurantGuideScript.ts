// Restaurant Guide Walkthrough Script
import type { WalkthroughScript } from "../WalkthroughTypes";

const RestaurantGuideScript: WalkthroughScript = {
  id: "restaurant-guide-walkthrough",
  featureId: "RESTAURANT_GUIDE",
  title: "Restaurant Guide",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "restaurant-guide-hero",
      description: "Welcome to Restaurant Guide! Get AI-powered healthy meal recommendations for any restaurant, customized to your medical profile and preferences.",
    },
    {
      id: "input-form",
      targetTestId: "restaurant-guide-form",
      description: "Enter what you're craving and which restaurant you're visiting. Our AI will find the healthiest options that match your cravings.",
    },
    {
      id: "craving-input",
      targetTestId: "restaurant-guide-craving",
      description: "Tell us what type of dish you're craving - like chicken, pasta, salmon, or steak.",
    },
    {
      id: "restaurant-input",
      targetTestId: "restaurant-guide-restaurant",
      description: "Enter the specific restaurant name you're visiting - like Chipotle, Cheesecake Factory, or your local favorite.",
    },
    {
      id: "search",
      targetTestId: "restaurant-guide-search",
      description: "Tap 'Find Dishes' to generate personalized healthy recommendations. The AI will analyze the menu and find options perfect for you.",
      waitForEvent: { testId: "restaurant-guide-generated", event: "done" },
    },
    {
      id: "results",
      targetTestId: "restaurant-guide-results",
      description: "Review your personalized meal recommendations! Each dish shows calories, medical compatibility badges, and why it's a great choice for your health goals.",
    },
    {
      id: "success",
      targetTestId: "restaurant-guide-hero",
      description: "You're all set! Use Restaurant Guide anytime you're eating out to make healthier choices that align with your medical profile.",
    },
  ],
};

export default RestaurantGuideScript;
