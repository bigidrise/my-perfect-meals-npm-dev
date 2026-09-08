// Social Dining Copilot Scripts
// Voice scripts for Find My Meal and Restaurant Guide
// Following Macro Calculator pattern: voice at EACH step transition

// === FIND MY MEAL ===
export const FIND_MY_MEAL_ENTRY =
  "Welcome to Find My Meal. I use Google Places to help identify nearby restaurants and the cuisine they serve. Because menus can change, I won't assume every suggested dish is currently listed exactly as shown. Instead, I'll help you understand what to look for and how to ask about reasonable substitutions, ingredients to leave off, different sides, sauces, and preparation methods that may help the meal fit your plan. The restaurant decides what it can accommodate. My job is to help you know what to ask for.";

export const FIND_MY_MEAL_STEP1 = "What kind of food sounds good right now?";

export const FIND_MY_MEAL_STEP2 =
  "Enter your zip code or use your geolocation so I can find restaurants near you.";

export const FIND_MY_MEAL_GENERATING =
  "I'm using Google Places to find nearby restaurants that match your craving and cuisine. I'll suggest options and show you what to ask for, while remembering that menus can change and each restaurant decides what it can accommodate.";

// === RESTAURANT GUIDE ===
export const RESTAURANT_GUIDE_ENTRY =
  "Welcome to the Restaurant Assistant. I use Google Places to help identify the restaurant and its cuisine. Because menus can change, I won't assume every suggested dish is currently listed exactly as shown. Instead, I'll help you understand what to look for and how to ask about reasonable substitutions, ingredients to leave off, different sides, sauces, and preparation methods that may help the meal fit your plan. The restaurant decides what it can accommodate. My job is to help you know what to ask for.";

export const RESTAURANT_GUIDE_STEP1 =
  "What kind of dish sounds good right now?";

export const RESTAURANT_GUIDE_STEP2 = "Which restaurant will we be eating at?";

export const RESTAURANT_GUIDE_STEP3 =
  "Enter your zip code so I can find the nearest location.";

export const RESTAURANT_GUIDE_GENERATING =
  "I'm using the restaurant's cuisine and available information to suggest meals and show you how to ask for them in a way that fits your plan. Menus can change, and the restaurant decides what it can accommodate.";
