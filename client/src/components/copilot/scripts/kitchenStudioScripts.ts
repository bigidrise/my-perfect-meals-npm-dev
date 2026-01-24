// Kitchen Studio Voice Scripts
// Uses the same 11L voice system as ProTip and Copilot button

export const KITCHEN_STUDIO_INTRO = "What are we preparing today?";

export const KITCHEN_STUDIO_STEP2 = "";

// Kitchen Studio - Cooking method question
export const KITCHEN_STUDIO_COOK_METHOD = "What are we using to cook?";

// Kitchen Studio - After cooking method selected
export const KITCHEN_STUDIO_COOK_CONFIRMED = "";

// Kitchen Studio - Preferences / guardrails (micro-lines)
export const KITCHEN_STUDIO_PREFS_LINE1 =
  "Tell me if you're — vegan, plant-based, keto, or you have food allergies or sensitivities?";
export const KITCHEN_STUDIO_PREFS_LINE2 =
  "Do you want to keep it lower in sugar, gluten, fat, or sodium?";
export const KITCHEN_STUDIO_PREFS_LINE3 = "What cuisine are we feeling today?";
export const KITCHEN_STUDIO_PREFS_LINE4 =
  "And how much time do you have? Do you want something quick and easy, or more involved?";
export const KITCHEN_STUDIO_PREFS_LINE5 =
  "You can also speak to me in any language. Use Translate on the meal card to match your phones languaage.";

// If you need a single combined string for the UI, keep this too:
export const KITCHEN_STUDIO_INGREDIENTS_PACE =
  "Any dietary needs or preferences? Choose a cuisine, tell me your time frame, and speak in any language — Translate is always available.";

// Kitchen Studio - After preferences confirmed
export const KITCHEN_STUDIO_INGREDIENTS_CONFIRMED = "";

// Kitchen Studio - Servings question
export const KITCHEN_STUDIO_SERVINGS = "How many servings?";

// Kitchen Studio - After servings confirmed
export const KITCHEN_STUDIO_SERVINGS_CONFIRMED = "";

// Kitchen Studio - Chef's Setup (equipment)
export const KITCHEN_STUDIO_EQUIPMENT =
  "Take a quick look — grab what you need, then tap 'OK'.";

// Kitchen Studio - After equipment confirmed
export const KITCHEN_STUDIO_EQUIPMENT_CONFIRMED =
  "If everything looks good, tap Create the Plan.";

export const KITCHEN_STUDIO_HANDOFF_TO_PREP =
  "This looks great. Now let’s enter Chefs Kitchen so we can prepare your meal.";

// Equipment mapping based on cooking method
export const EQUIPMENT_BY_METHOD: Record<string, string[]> = {
  Stovetop: ["Skillet or pan", "Knife", "Cutting board", "Spatula or spoon"],
  Oven: ["Baking dish or sheet pan", "Knife", "Cutting board", "Oven mitts"],
  "Air Fryer": ["Air fryer basket", "Knife", "Cutting board", "Tongs"],
  Grill: [
    "Grill or grill pan",
    "Knife",
    "Cutting board",
    "Tongs",
    "Grill brush",
  ],
};

// Open Kitchen narration beats
export const KITCHEN_STUDIO_OPEN_START = "";

export const KITCHEN_STUDIO_OPEN_PROGRESS1 =
  "If everything looks good press the Enter Chef’s Kitchen button, if not, press, Create New, and we create a new meal.";

export const KITCHEN_STUDIO_OPEN_PROGRESS2 = "";

export const KITCHEN_STUDIO_OPEN_COMPLETE = "";

// Phase 2 - Cooking narration scripts
// Kitchen Cook Setup - spoken during equipment setup
export const KITCHEN_COOK_SETUP =
  "Let's make sure you have everything you need before we start.";

// Kitchen Cook Ready - spoken when meal is ready to prepare
export const KITCHEN_COOK_READY = "Your meal is ready. Let's start cooking!";

// Kitchen Timer Start - spoken when a timer begins
export const KITCHEN_TIMER_START =
  "Timer started. I'll let you know when it's done.";

// Kitchen Timer Done - spoken when a timer completes
export const KITCHEN_TIMER_DONE = "Time's up! Let's move to the next step.";

// Kitchen Plating - spoken during plating step
export const KITCHEN_PLATING =
  "Time to plate up. Make it look as good as it tastes.";

// Kitchen Finished - spoken when meal is complete
export const KITCHEN_FINISHED = "And we're done! Enjoy your meal.";
