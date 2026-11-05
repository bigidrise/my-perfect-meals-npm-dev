import { COACH_DESTINATIONS, type CoachDestinationId } from "./navigation";

/**
 * Reviewed UI entry relationships, not model-authored menu paths.
 * Routes/access remain owned by COACH_DESTINATIONS. No instructions execute a
 * workflow, select a subject, change settings, or grant destination access.
 */
export const COACH_NAVIGATION_GUIDANCE = {
  grocery_find_product: {
    aliases: ["Find a Product"],
    entry: "Shopping List → Grocery Store Coach → Find a Product",
    start: "Open Grocery Store Coach on Shopping List, then select Find a Product.",
  },
  product_scan: {
    aliases: ["Product Scan"],
    entry: "Shopping List → Product Scan",
    start: "Select Product Scan on Shopping List to capture the actual product.",
  },
  grocery_create_meal: {
    aliases: ["Grocery Store Coach", "Grocery Coach", "Grocery Coach — Create a Meal"],
    entry: "Shopping List → Grocery Store Coach → Build a Meal",
    start: "Open Grocery Store Coach on Shopping List, then select Build a Meal.",
  },
  sushi_creator: {
    aliases: ["Sushi Creator"], entry: "Sushi Creator",
    start: "",
  },
  craving_creator: {
    aliases: ["Craving Creator"], entry: "Lifestyle → Cravings → Craving Creator",
    start: "Describe your sweet or savory craving in Craving Creator.",
  },
  dessert_creator: {
    aliases: ["Dessert Creator"], entry: "Lifestyle → Cravings → Dessert Creator",
    start: "Describe the complete dessert you want to make in Dessert Creator.",
  },
  beverage_creator: {
    aliases: ["Beverage Creator"], entry: "Lifestyle → Beverages → Beverage Creator",
    start: "Describe your ordinary drink using Beverage Creator's own controls.",
  },
  athlete_beverage_creator: {
    aliases: ["Athlete Beverage Creator"], entry: "Lifestyle → Beverages → Athlete Beverage Creator",
    start: "Use Athlete Beverage Creator's existing workout-drink controls.",
  },
  hydration_center: {
    aliases: ["Hydration Center", "My Perfect Hydration Center"], entry: "Hydration Center",
    start: "Choose the relevant section in Hydration Center. No section or medical instructions have been selected for you.",
  },
  restaurant_guide: {
    aliases: ["Restaurant Guide", "Restaurant Assistant"], entry: "Lifestyle → Away From Home → Restaurant Guide",
    start: "Use Restaurant Guide for the restaurant you have already chosen.",
  },
  find_meals_near_me: {
    aliases: ["Find Meals Near Me"], entry: "Lifestyle → Away From Home → Find Meals Near Me",
    start: "Use Find Meals Near Me to discover somewhere to eat.",
  },
  my_perfect_buffet: {
    aliases: ["My Perfect Buffet"], entry: "My Perfect Buffet",
    start: "Continue with the buffet-selection controls on My Perfect Buffet.",
  },
  my_perfect_getaway: {
    aliases: ["My Perfect Getaway"], entry: "Lifestyle → My Perfect Getaway",
    start: "Search your location or venue, then choose a dining area if offered.",
  },
  my_perfect_gatherings: {
    aliases: ["My Perfect Gatherings"], entry: "Lifestyle → My Perfect Gatherings",
    start: "Use My Perfect Gatherings to plan the food for your occasion.",
  },
  fridge_rescue: {
    aliases: ["Fridge Rescue"], entry: "Lifestyle → Fridge Rescue",
    start: "Enter the ingredients you already have in Fridge Rescue. Shopping List is not its entry point.",
  },
  create_a_dish: {
    aliases: ["Create a Dish"], entry: "Lifestyle → Create a Dish",
    start: "Enter your chosen dish in Create a Dish and use its existing creation controls.",
  },
  macro_calculator: {
    aliases: ["Macro Calculator"], entry: "Dashboard → Macro Calculator",
    start: "Use the calculator's own inputs and confirmed-save flow. Chef does not calculate or save your targets.",
  },
  my_perfect_beginning: {
    aliases: ["My Perfect Beginnings", "My Perfect Beginning"], entry: "Lifestyle → My Perfect Beginnings",
    start: "Choose an authorized child in the existing hub before using child-specific tools.",
  },
  my_perfect_menu: {
    aliases: ["My Perfect Menu"], entry: "Dashboard → My Perfect Menu",
    start: "Choose Breakfast, Lunch, Dinner or Snack, then follow the selected idea's date and meal-slot prompts.",
  },
  meal_builders: {
    aliases: ["Meal Builders", "Meal Builder"], entry: "Meal Builders",
    start: "Open your assigned builder, choose a day and meal slot, then select Create With Chef. Existing assignment and setup checks still apply.",
    explanation: "Open Meal Builders from the app navigation to reach its landing page. Open the builder available to your account; ordinary members generally use their assigned builder, not an unrestricted choice of clinical builders. Complete any required setup, then choose a day and a meal slot and select Create With Chef for that slot. You can continue in additional slots; Save Plan saves the board. Subscription, account eligibility, setup and clinical assignment checks still apply. Chef is explaining the workflow only: nothing has been opened or generated, and no macro targets have been changed.",
  },
  shopping_list: {
    aliases: ["Shopping List", "Smart Shopping List", "my shopping list"], entry: "Dashboard → Shopping List",
    start: "Review your shopping needs or use My List for personal additions. Grocery Store Coach and Product Scan are separate controls here.",
  },
  biometrics: {
    aliases: ["My Biometrics", "Biometrics", "my biometrics"], entry: "Dashboard → My Biometrics",
    start: "Use My Biometrics to review or enter your own tracking data. Paid and clinical tools retain their separate checks.",
  },
  daily_journal: {
    aliases: ["Daily Journal", "my daily journal", "Daily Health Journal", "Daily Journal & Inspiration"],
    entry: "Dashboard → Daily Journal & Inspiration",
    start: "Use the journal's existing controls to write or review your own private entries. Chef does not read or change them.",
  },
} satisfies Record<CoachDestinationId, { aliases: string[]; entry: string; start: string; explanation?: string }>;

/**
 * Reviewed guidance without action permission. A dialog is not a URL; these
 * records deliberately never extend COACH_DESTINATIONS or its access resolver.
 */
export const COACH_KNOWLEDGE_ONLY_NAVIGATION = {
  favorites: {
    aliases: ["My Favorites", "Favorites", "Saved Meals"], entry: "Dashboard or More → Saved Meals",
    start: "Use Saved Meals to reuse your own saved recipes. Active paid access and ownership checks apply.",
  },
  recipe_maker: {
    aliases: ["Recipe Maker"], entry: "Dashboard → Recipe Maker",
    start: "Tap the Recipe Maker card to open its capture dialog. It is not a separate page. Essential access and recipe safeguards apply.",
  },
  nutrition_education: {
    aliases: ["App Library", "Learn"], entry: "App Library (the Learn page)",
    start: "Use App Library for platform and nutrition topics. Tutorial videos are in the separate Tutorial Hub.",
  },
  tutorials: {
    aliases: ["Tutorial Hub"], entry: "Tutorial Hub",
    start: "Select an available tutorial. Some tutorials are Coming Soon.",
  },
  performance_hub: {
    aliases: ["Performance Nutrition Hub", "Performance Hub"], entry: "Performance Nutrition Hub",
    start: "Use the existing Performance Nutrition Hub entry and setup controls. Clinical access and performance setup checks apply.",
  },
  companion_nutrition: {
    aliases: ["My Perfect Pets", "Companion Nutrition"], entry: "Lifestyle → My Perfect Pets",
    start: "Open the existing pet hub and establish the appropriate pet profile. Pro access and pet-specific safety checks apply.",
  },
  academy: {
    aliases: ["My Perfect Meals Academy", "Academy"], entry: "More → My Perfect Meals Academy",
    start: "Use Start Certification Path or Continue Certification as shown. Track-specific progression and access remain separate.",
  },
} as const;

export function verifiedNavigationText(id: CoachDestinationId, includeStartingSteps = true): string {
  const destination = COACH_DESTINATIONS[id];
  const label = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
  const guidance = COACH_NAVIGATION_GUIDANCE[id];
  const button = `Use the Open ${label} button.`;
  return includeStartingSteps && guidance.start ? `${guidance.entry}. ${button} ${guidance.start}` : button;
}
