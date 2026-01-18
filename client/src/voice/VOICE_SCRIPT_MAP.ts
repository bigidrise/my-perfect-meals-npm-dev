export const GLOBAL_VOICE_LINES = {
  micOpens: "Alright — I'm listening.",
  timeout: "No rush. Tap me when you're ready.",
  didntUnderstand: "I didn't quite catch that. Want to try again?",
  userExits: "All good. You can finish this by tapping instead.",
  transition: "Got it.",
};

export const TIMER_VOICE_LINES = {
  offerTimer: (minutes: number) =>
    `This step takes about ${minutes} minutes. Want me to set a timer?`,
  timerConfirmed: "Got it. I'll let you know when time's up.",
  timerEnds: "Time's up. Ready for the next step?",
};

export const CRAVING_CREATOR_SCRIPTS = {
  source: "craving-studio",
  steps: [
    {
      step: 1,
      question: "What are you craving right now?",
      fallback: null,
    },
    {
      step: 2,
      question: "Sweet or savory?",
      fallback: null,
    },
    {
      step: 3,
      question: "Any dietary preferences? You can say things like dairy-free, gluten-free, or just say no.",
      fallback: "No problem. I'll keep it flexible.",
    },
    {
      step: 4,
      question: "How many servings are we making?",
      fallback: "I'll make this for one.",
    },
    {
      step: 5,
      question: null,
      action: "generate",
      spokenLine: "Alright — I've got enough. Let me build this for you.",
    },
  ],
};

export const DESSERT_CREATOR_SCRIPTS = {
  source: "dessert-studio",
  steps: [
    {
      step: 1,
      question: "What kind of dessert are you in the mood for?",
      fallback: null,
    },
    {
      step: 2,
      question: "Any flavor you're thinking? Chocolate, fruit, vanilla — or surprise me.",
      fallback: "Alright. I'll surprise you.",
    },
    {
      step: 3,
      question: "How many people are we making this for?",
      fallback: null,
    },
    {
      step: 4,
      question: "Any dietary needs? Or should I keep it classic?",
      fallback: null,
    },
    {
      step: 5,
      question: null,
      action: "generate",
      spokenLine: "Perfect. Let me put that together.",
    },
  ],
};

export const FRIDGE_RESCUE_SCRIPTS = {
  source: "fridge-rescue-studio",
  steps: [
    {
      step: 1,
      question: "Tell me what you've got in the fridge.",
      fallback: null,
    },
    {
      step: 2,
      question: "Anything else I should know? Leftovers, cooking time, or preferences?",
      fallback: "That's plenty. I've got it.",
    },
    {
      step: 3,
      question: null,
      action: "generate",
      spokenLine: "Alright — let me turn that into a real meal.",
    },
  ],
};

export const CHEFS_KITCHEN_SCRIPTS = {
  source: "chefs-kitchen",
  steps: [
    {
      step: 1,
      question: "Welcome to my kitchen. What are we making today?",
      fallback: null,
    },
    {
      step: 2,
      question: "How do you want to cook it? Stove, oven, air fryer — or surprise me.",
      fallback: "I'll choose something easy.",
    },
    {
      step: 3,
      question: "How much time do you want to spend cooking?",
      fallback: null,
    },
    {
      step: 4,
      question: "How many people are we cooking for?",
      fallback: null,
    },
    {
      step: 5,
      question: "Some steps take time. Want me to set timers for you as we go?",
      fallback: "No problem.",
      yesResponse: "Perfect. I'll handle that.",
    },
    {
      step: 6,
      question: null,
      action: "generate",
      spokenLine: "Alright — let's cook.",
    },
  ],
};

export const VOICE_SCRIPT_MAP = {
  "craving-studio": CRAVING_CREATOR_SCRIPTS,
  "dessert-studio": DESSERT_CREATOR_SCRIPTS,
  "fridge-rescue-studio": FRIDGE_RESCUE_SCRIPTS,
  "chefs-kitchen": CHEFS_KITCHEN_SCRIPTS,
} as const;

export type VoiceScriptSource = keyof typeof VOICE_SCRIPT_MAP;
