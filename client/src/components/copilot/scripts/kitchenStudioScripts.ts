// Kitchen Studio Voice Scripts
// Uses the same 11L voice system as ProTip and Copilot button

export const KITCHEN_STUDIO_INTRO = "What are we preparing today?";

export const KITCHEN_STUDIO_STEP2 = "";

// Kitchen Studio, Cooking method question
export const KITCHEN_STUDIO_COOK_METHOD = "What are we using to cook?";

// Kitchen Studio, After cooking method selected
export const KITCHEN_STUDIO_COOK_CONFIRMED = "";

// Kitchen Studio, Preferences / guardrails (micro-lines)
export const KITCHEN_STUDIO_PREFS_LINE1 =
  "Tell me if you're, vegan, plant-based, keto, or you have food allergies or sensitivities?";
export const KITCHEN_STUDIO_PREFS_LINE2 =
  "Do you want to keep it lower in sugar, gluten, fat, or sodium?";
export const KITCHEN_STUDIO_PREFS_LINE3 = "What cuisine are we feeling today?";
export const KITCHEN_STUDIO_PREFS_LINE4 =
  "And how much time do you have? Do you want something quick and easy, or more involved?";
export const KITCHEN_STUDIO_PREFS_LINE5 =
  "You can also speak to me in any language. Use Translate on the meal card to match your phone's language.";

// If you need a single combined string for the UI, keep this too:
export const KITCHEN_STUDIO_INGREDIENTS_PACE =
  "Any dietary preference, low sugar, low sodium, gluten free, food allergies, or food to avoid?";

// Kitchen Studio, After preferences confirmed
export const KITCHEN_STUDIO_INGREDIENTS_CONFIRMED = "";

// Kitchen Studio, Servings question
export const KITCHEN_STUDIO_SERVINGS = "How many servings?";

// Kitchen Studio, After servings confirmed
export const KITCHEN_STUDIO_SERVINGS_CONFIRMED = "";

// Kitchen Studio, Chef's Setup (equipment)
export const KITCHEN_STUDIO_EQUIPMENT = "If we have everything we need, tap OK";

// Kitchen Studio, After equipment confirmed
export const KITCHEN_STUDIO_EQUIPMENT_CONFIRMED =
  "If everything looks good, tap, Create the Plan.";

export const KITCHEN_STUDIO_HANDOFF_TO_PREP =
  "This looks great. Now let’s enter Chefs Kitchen so we can prepare your meal.";

// Legacy method-based lookup — kept for any existing references
export const EQUIPMENT_BY_METHOD: Record<string, string[]> = {
  Stovetop: ["Skillet or pan", "Knife", "Cutting board", "Spatula or spoon"],
  Oven: ["Baking dish or sheet pan", "Knife", "Cutting board", "Oven mitts"],
  "Air Fryer": ["Air fryer basket", "Knife", "Cutting board", "Tongs"],
  Grill: ["Grill or grill pan", "Knife", "Cutting board", "Tongs", "Grill brush"],
};

// Instruction-aware equipment extraction
// Each entry maps cooking keywords found in recipe steps → required equipment
const EQUIPMENT_KEYWORD_MAP: Array<{ keywords: string[]; equipment: string[] }> = [
  { keywords: ["bake", "baking", "roast", "roasting", "casserole"], equipment: ["Oven", "Baking dish or sheet pan", "Oven mitts"] },
  { keywords: ["broil", "broiling"], equipment: ["Oven (broil setting)", "Broiler-safe pan", "Oven mitts"] },
  { keywords: ["air fry", "air fryer", "air-fry"], equipment: ["Air fryer"] },
  { keywords: ["grill", "grilling", "char", "charred"], equipment: ["Grill or grill pan", "Tongs", "Grill brush"] },
  { keywords: ["sauté", "saute", "sautéing", "sauteing", "pan-fry", "pan fry", "sear", "searing", "brown the", "browning"], equipment: ["Skillet or sauté pan", "Spatula or wooden spoon"] },
  { keywords: ["simmer", "simmering", "boil", "boiling", "blanch", "blanching", "poach", "poaching", "bring to a boil"], equipment: ["Large pot or saucepan", "Lid"] },
  { keywords: ["steam", "steaming"], equipment: ["Steamer basket", "Pot with lid"] },
  { keywords: ["slow cook", "slow cooker", "crockpot", "crock pot", "low and slow"], equipment: ["Slow cooker"] },
  { keywords: ["instant pot", "pressure cook", "pressure cooker"], equipment: ["Instant Pot or pressure cooker"] },
  { keywords: ["wok", "stir-fry", "stir fry", "stir-frying", "stir frying", "toss in the"], equipment: ["Wok or large skillet", "Tongs or spatula"] },
  { keywords: ["deep fry", "deep-fry", "deep fried", "deep-fried"], equipment: ["Deep pot or fryer", "Slotted spoon or spider", "Thermometer"] },
  { keywords: ["blend", "blending", "puree", "purée", "smooth"], equipment: ["Blender or immersion blender"] },
  { keywords: ["food processor"], equipment: ["Food processor"] },
  { keywords: ["whisk", "whisking", "beat the", "beating"], equipment: ["Whisk", "Mixing bowl"] },
  { keywords: ["strain", "straining", "drain", "draining", "rinse and drain"], equipment: ["Colander or strainer"] },
  { keywords: ["marinate", "marinating", "marinate for"], equipment: ["Shallow dish or zip-lock bag"] },
  { keywords: ["microwave"], equipment: ["Microwave-safe dish"] },
  { keywords: ["chop", "dice", "mince", "slice", "julienne", "roughly cut", "finely cut", "cut into"], equipment: ["Knife", "Cutting board"] },
  { keywords: ["peel", "peeling"], equipment: ["Vegetable peeler", "Cutting board"] },
  { keywords: ["mash", "mashing", "smash"], equipment: ["Potato masher or fork"] },
  { keywords: ["roll out", "rolling pin", "dough"], equipment: ["Rolling pin"] },
  { keywords: ["zest", "zesting"], equipment: ["Microplane or zester"] },
  { keywords: ["squeeze", "citrus", "lemon juice", "lime juice"], equipment: ["Citrus juicer"] },
  { keywords: ["dutch oven", "braise", "braising", "braised"], equipment: ["Dutch oven or heavy pot", "Oven mitts"] },
  { keywords: ["cast iron"], equipment: ["Cast iron skillet"] },
  { keywords: ["parchment", "parchment paper", "line the pan"], equipment: ["Parchment paper", "Baking sheet"] },
  { keywords: ["foil", "aluminum foil", "wrap in foil"], equipment: ["Aluminum foil"] },
  { keywords: ["mix", "mixing", "combine", "fold in", "toss together", "stir together"], equipment: ["Mixing bowl"] },
  { keywords: ["ladle", "ladling", "spoon into"], equipment: ["Ladle"] },
  { keywords: ["internal temperature", "thermometer", "165°", "145°", "160°", "135°"], equipment: ["Meat thermometer"] },
  { keywords: ["measure", "measuring cup", "tablespoon", "teaspoon"], equipment: ["Measuring cups and spoons"] },
];

/**
 * Scans all recipe instructions for cooking technique keywords and returns
 * the deduplicated list of equipment actually needed for this dish.
 */
export function extractEquipmentFromInstructions(instructions: string | string[]): string[] {
  const text = (Array.isArray(instructions) ? instructions.join(" ") : instructions || "").toLowerCase();

  const found = new Set<string>();

  for (const { keywords, equipment } of EQUIPMENT_KEYWORD_MAP) {
    if (keywords.some((kw) => text.includes(kw))) {
      equipment.forEach((e) => found.add(e));
    }
  }

  // Universal fallback — if nothing was detected, return a sensible baseline
  if (found.size === 0) {
    return ["Knife", "Cutting board", "Mixing bowl", "Measuring cups and spoons"];
  }

  // Knife + cutting board are almost always needed; add if missing
  if (!found.has("Knife")) found.add("Knife");
  if (!found.has("Cutting board")) found.add("Cutting board");

  return Array.from(found);
}

// Open Kitchen narration beats
export const KITCHEN_STUDIO_OPEN_START = "";

export const KITCHEN_STUDIO_OPEN_PROGRESS1 =
  "If you're happy with your meal press the Enter Chef’s Kitchen button, if not, press, the Create New button on the meal card, and we can create a new meal.";

export const KITCHEN_STUDIO_OPEN_PROGRESS2 = "";

export const KITCHEN_STUDIO_OPEN_COMPLETE = "";

// Phase 2, Cooking narration scripts
// Kitchen Cook Setup, spoken during equipment setup
export const KITCHEN_COOK_SETUP =
  "Let's make sure you have everything you need. Check your equipment, then take a look at your ingredients — and when you're ready, let's start cooking.";

// Kitchen Cook Ready, spoken when meal is ready to prepare
export const KITCHEN_COOK_READY = "Your meal is ready. Let's start cooking!";

// Kitchen Timer Start, spoken when a timer begins
export const KITCHEN_TIMER_START =
  "Timer started. I'll let you know when it's done.";

// Kitchen Timer Done, spoken when a timer completes
export const KITCHEN_TIMER_DONE = "Time's up! Let's move to the next step.";

// Kitchen Plating, spoken during plating step
export const KITCHEN_PLATING =
  "Time to plate up. Make it look as good as it tastes.";

// Kitchen Finished, spoken when meal is complete
export const KITCHEN_FINISHED = "And we're done! Enjoy your meal.";
