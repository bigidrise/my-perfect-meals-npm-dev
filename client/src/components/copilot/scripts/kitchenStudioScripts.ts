// Kitchen Studio Voice Scripts
// Uses the same 11L voice system as ProTip and Copilot button

export const KITCHEN_STUDIO_INTRO = "Alright - what are we making today?";

export const KITCHEN_STUDIO_STEP2 = "Nice. Let's dial it in.";

// Kitchen Studio - Cooking method question
export const KITCHEN_STUDIO_COOK_METHOD =
  "How are we cooking this — stovetop, oven, air fryer, or grill?";

// Kitchen Studio - After cooking method selected
export const KITCHEN_STUDIO_COOK_CONFIRMED = "Perfect. Let's keep going.";

// Kitchen Studio - Preferences question (more specific)
export const KITCHEN_STUDIO_INGREDIENTS_PACE =
  "Before we lock this in, let me know if you want to adjust anything — lower sugar, less salt, gluten-free, dairy-free, or anything personal you want me to respect. And are we cooking quick and simple, or taking our time?";

// Kitchen Studio - After preferences confirmed
export const KITCHEN_STUDIO_INGREDIENTS_CONFIRMED =
  "Got it. Let me show you what you'll need.";

// Kitchen Studio - Chef's Setup (equipment)
export const KITCHEN_STUDIO_EQUIPMENT =
  "Before we start cooking, here's what you'll need. Nothing fancy — just the basics to make this work. Get these lined up, and let me know if you're missing anything or using a substitute.";

// Kitchen Studio - After equipment confirmed
export const KITCHEN_STUDIO_EQUIPMENT_CONFIRMED =
  "Perfect. Now we're ready to cook.";

// Equipment mapping based on cooking method
export const EQUIPMENT_BY_METHOD: Record<string, string[]> = {
  Stovetop: ["Skillet or pan", "Knife", "Cutting board", "Spatula or spoon"],
  Oven: ["Baking dish or sheet pan", "Knife", "Cutting board", "Oven mitts"],
  "Air Fryer": ["Air fryer basket", "Knife", "Cutting board", "Tongs"],
  Grill: ["Grill or grill pan", "Knife", "Cutting board", "Tongs", "Grill brush"],
};

// Open Kitchen narration beats
export const KITCHEN_STUDIO_OPEN_START =
  "Alright. I'm putting this together now.";

export const KITCHEN_STUDIO_OPEN_PROGRESS1 =
  "Balancing flavor and nutrition.";

export const KITCHEN_STUDIO_OPEN_PROGRESS2 =
  "Finalizing ingredients and cooking steps.";

export const KITCHEN_STUDIO_OPEN_COMPLETE =
  "Here it is. Let's take a look.";
