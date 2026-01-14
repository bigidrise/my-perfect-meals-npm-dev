// Kitchen Studio Voice Scripts
// Uses the same 11L voice system as ProTip and Copilot button

export const KITCHEN_STUDIO_INTRO =
  "Alright - What do we feel like making today?";

export const KITCHEN_STUDIO_STEP2 =
  "Nice. What cooking method? ";

// Kitchen Studio - Cooking method question
export const KITCHEN_STUDIO_COOK_METHOD =
  "Stovetop, oven, air fryer, or grill?";

// Kitchen Studio - After cooking method selected
export const KITCHEN_STUDIO_COOK_CONFIRMED = "Perfect. Having fun yet? Let's keep going";

// Kitchen Studio - Preferences question (more specific)
export const KITCHEN_STUDIO_INGREDIENTS_PACE =
  "Before we lock this in, tell me how you want this meal to work for you. Let me know if you’re vegan or plant-based, if you have any food allergies, sensitivities, or special dietary needs — or if you’re that food lover who simply wants to keep things lower in sugar, gluten, fat, or sodium. You can also create meals from any cuisine. Pressed for time? Tell me how much time you have to prepare the dish. We can create something that's quick and simple or something that's a little more involved and might take a little more time. You can speak to me in any language and I can create your meal. Use the Translate button on the meal card to instantly convert the text to your phone’s default language.";

// Kitchen Studio - After preferences confirmed
export const KITCHEN_STUDIO_INGREDIENTS_CONFIRMED =
  "Got it. Now tell me - how many people are we cooking for?";

// Kitchen Studio - Serving size question
export const KITCHEN_STUDIO_SERVINGS =
  "Are you cooking just for yourself, or are we feeding a crew? This helps us scale the ingredients and nutrition correctly.";

// Kitchen Studio - After servings confirmed
export const KITCHEN_STUDIO_SERVINGS_CONFIRMED =
  "Perfect. Now let me walk you through the cookware you'll need.";

// Kitchen Studio - Chef's Setup (equipment)
export const KITCHEN_STUDIO_EQUIPMENT =
  "Before we start cooking, take a quick look to make sure you have all the tools we need to prepare our dish. Check this list and get these lined up and tell me if anything’s missing.";

// Kitchen Studio - After equipment confirmed
export const KITCHEN_STUDIO_EQUIPMENT_CONFIRMED =
  "If everything is set, press the Generate button and let’s see what we’ve created.";

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
export const KITCHEN_STUDIO_OPEN_START =
  "";

export const KITCHEN_STUDIO_OPEN_PROGRESS1 = "";

export const KITCHEN_STUDIO_OPEN_PROGRESS2 =
  "";

export const KITCHEN_STUDIO_OPEN_COMPLETE = "";
