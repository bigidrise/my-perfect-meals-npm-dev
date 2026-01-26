import { StudioScript } from "./VoiceEngine";

export type StudioType = "chefsKitchen" | "fridgeRescue" | "craving" | "dessert" | "restaurantGuide" | "findYourMeal";

export const STUDIO_SCRIPTS: Record<StudioType, StudioScript> = {
  chefsKitchen: {
    studioType: "chefsKitchen",
    openingPrompt: "Alright, let's cook together. What are we making today?",
    guidePrompts: [
      "We can start simple, or you can tell me exactly what you're in the mood for.",
      "Take your time. Any dietary rules or allergies I should know about?",
      "I'm here whenever you're ready."
    ],
    readyPrompt: "I've got what I need. Ready to cook?"
  },

  fridgeRescue: {
    studioType: "fridgeRescue",
    openingPrompt: "Tell me what's in your fridge.",
    guidePrompts: [
      "Even a couple ingredients is enough to start.",
      "Any dietary rules or allergies I should keep in mind?",
      "Anything else, or should I start cooking?"
    ],
    readyPrompt: "Perfect. Let me build something with that."
  },

  craving: {
    studioType: "craving",
    openingPrompt: "What are you craving right now?",
    guidePrompts: [
      "Comfort food, something light, or a treat?",
      "Any ingredients to avoid?",
      "I can work with that. Anything else?"
    ],
    readyPrompt: "Got it. Let me find the perfect match."
  },

  dessert: {
    studioType: "dessert",
    openingPrompt: "What kind of dessert sounds good?",
    guidePrompts: [
      "Chocolate, fruity, or something baked?",
      "How sweet are we talking — light, medium, or treat day?",
      "Any dietary needs I should know about?"
    ],
    readyPrompt: "Sounds delicious. Let me create that for you."
  },

  restaurantGuide: {
    studioType: "restaurantGuide",
    openingPrompt: "What kind of meal are you looking for, and where are you eating?",
    guidePrompts: [
      "Fast casual, sit-down, or takeout?",
      "Any cuisine preferences?",
      "Any dietary restrictions I should consider?"
    ],
    readyPrompt: "Let me find some great options for you."
  },

  findYourMeal: {
    studioType: "findYourMeal",
    openingPrompt: "What kind of meal are you in the mood for?",
    guidePrompts: [
      "Breakfast, lunch, dinner, or a snack?",
      "Any specific nutritional goals today?",
      "Anything else I should know?"
    ],
    readyPrompt: "Perfect. Let me find the right meal for you."
  }
};

export function getStudioScript(studioType: StudioType): StudioScript {
  return STUDIO_SCRIPTS[studioType];
}
