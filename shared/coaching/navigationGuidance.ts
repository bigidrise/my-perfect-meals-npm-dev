import { COACH_DESTINATIONS, type CoachDestinationId } from "./navigation";

/**
 * Reviewed entry relationships from the approved navigation candidate.
 * Routes and entitlements remain owned by COACH_DESTINATIONS.
 * These instructions do not execute workflows or select clinical assignments.
 */
export const COACH_NAVIGATION_GUIDANCE = {
  grocery_find_product: {
    aliases: ["Find a Product"], entry: "Shopping List → Grocery Store Coach → Find a Product",
    start: "Open Grocery Store Coach on Shopping List, then select Find a Product.",
  },
  product_scan: {
    aliases: ["Product Scan"], entry: "Shopping List → Product Scan",
    start: "Select Product Scan on Shopping List to capture the actual product.",
  },
  grocery_create_meal: {
    aliases: ["Grocery Store Coach", "Grocery Coach", "Grocery Coach — Create a Meal"],
    entry: "Shopping List → Grocery Store Coach → Build a Meal",
    start: "Open Grocery Store Coach on Shopping List, then select Build a Meal.",
  },
  sushi_creator: { aliases: ["Sushi Creator"], entry: "Sushi Creator", start: "" },
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
    aliases: ["Restaurant Assistant"], entry: "Lifestyle → Away From Home → Restaurant Assistant",
    start: "Use Restaurant Assistant for the restaurant you have already chosen.",
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
    aliases: ["Meal Builders", "Meal Builder", "Diabetic Meal Builder", "Diabetic Menu Builder"],
    entry: "Meal Builders",
    start: "Open the builder available to your account, then choose a day and meal slot and select Create With Chef. Existing assignment, setup and subscription checks still apply.",
  },
  business_suite: {
    aliases: ["Business Suite"], entry: "More → Business Suite", start: "",
  },
  business_organization: {
    aliases: ["Business Organization", "Business Organizations", "Organization Hub"],
    entry: "Organization Hub", start: "",
  },
} satisfies Record<CoachDestinationId, { aliases: string[]; entry: string; start: string }>;

export const DIABETIC_BUILDER_EXPLANATION =
  "The Diabetic Meal Builder helps plan meals using your diabetic nutrition profile and applicable carbohydrate guidance. " +
  "Start in Meal Builders to select your available builder; a healthcare professional is not universally required, " +
  "but your existing subscription, clinical assignment, setup and safety rules still apply.";

export function verifiedNavigationText(id: CoachDestinationId, includeStartingSteps = true): string {
  const destination = COACH_DESTINATIONS[id];
  const label = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
  const guidance = COACH_NAVIGATION_GUIDANCE[id];
  const button = `Use the Open ${label} button.`;
  if (!includeStartingSteps) return button;
  return `You can find it under ${guidance.entry}.` +
    (id === "meal_builders" ? " Choose the builder available to your account." : "");
}

export function verifiedNavigationOffer(id: CoachDestinationId): string {
  const destination = COACH_DESTINATIONS[id];
  const label = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
  return id === "business_suite"
    ? "Start in Business Suite to explore your business options. Would you like to go there?"
    : id === "business_organization"
      ? "Use Business Organization to manage a business you've started. Would you like to go there?"
    : `You can find that in ${label}. Would you like to go there?`;
}
