import type { CoachDestinationId } from "../../../shared/coaching/navigation";

interface FeatureUsageKnowledge {
  descriptionInput: string;
  controls: string[];
  generationAction: string;
  notes: string[];
}

/**
 * Verified interface facts, not tutorial scripts or new handoff contracts.
 * Sources are the existing creator pages named below. Deliberately omit controls
 * that have not been reviewed; the model must not fill gaps by guessing.
 */
export const FEATURE_USAGE_KNOWLEDGE: Partial<Record<CoachDestinationId, FeatureUsageKnowledge>> = {
  // client/src/pages/lifestyle/MyPerfectGetaway.tsx
  my_perfect_getaway: {
    descriptionInput: "Search location or venue, or choose one of the Tap & Go destinations.",
    controls: ["A matched catalog venue can offer a location or dining-area picker.", "Uncertain locations can be refined and searched again."],
    generationAction: "Follow the location prompts to request personalized food guidance.",
    notes: ["Only select a location or dining area if offered; not every venue has a picker. Suggestions are not verified current menus, ingredients, preparation, availability or nutrition.", "No Chef destination-prefill handoff exists."],
  },
  // client/src/pages/MyPerfectMenu.tsx (the /foods-i-enjoy route)
  my_perfect_menu: {
    descriptionInput: "Pick an idea type: Breakfast, Lunch, Dinner or Snack.",
    controls: ["Choose from the personalized ideas.", "Try 3 More requests different ideas.", "How It Works explains the workflow."],
    generationAction: "Choose an idea and follow the destination's date and meal-slot prompts to create it in the existing builder.",
    notes: ["The destination owns builder resolution, planning and generation; Chef does not select a builder or transfer a planning request."],
  },
  // client/src/pages/Builders.tsx
  meal_builders: {
    descriptionInput: "Review the builder choices on the Meal Builders landing page.",
    controls: ["Choose an available builder card; eligibility and setup can restrict choices."],
    generationAction: "Continue through the selected builder's own setup and meal workflow.",
    notes: ["Do not select or activate a specialized clinical builder for the member, bypass onboarding, or promise locked access."],
  },
  // client/src/pages/SocialRestaurantGuide.tsx
  restaurant_guide: {
    descriptionInput: "Follow the guided ordering flow, beginning with what you are craving.",
    controls: ["The introduction leads into the craving field.", "Later steps collect the restaurant and ZIP code."],
    generationAction: "Follow the guided prompts to request restaurant meal guidance.",
    notes: ["Do not promise Chef has transferred a craving or restaurant. Actual menu availability and accommodations require confirmation with the restaurant."],
  },
  // client/src/pages/RestaurantFinderPage.tsx
  find_meals_near_me: {
    descriptionInput: "Enter a ZIP code or use the location control.",
    controls: ["Use my location requests device location.", "Search finds restaurants for the selected area."],
    generationAction: "Search the chosen area, then review the restaurant results.",
    notes: ["Location permission may be required. Discovery does not verify current menus or guarantee a particular dish."],
  },
  // client/src/pages/MyPerfectBuffetPage.tsx
  my_perfect_buffet: {
    descriptionInput: "Describe the foods actually available in the What's at the buffet? field, by typing or using its voice control.",
    controls: ["Add by category is optional.", "Build My Plates requests plate options."],
    generationAction: "Use Build My Plates after entering the available buffet foods.",
    notes: ["The member reviews the options and logs what they actually ate; opening this page does not log consumption."],
  },
  // client/src/pages/lifestyle/GatheringsPage.tsx
  my_perfect_gatherings: {
    descriptionInput: "Start with What's the occasion? and choose the gathering situation.",
    controls: ["The form changes with the selected situation.", "Servings and additional notes are available."],
    generationAction: "Follow the situation-specific form before using the page's creation action.",
    notes: ["Do not invent a universal sequence or promise Chef transferred event details. The destination owns food creation and safety checks."],
  },
  // client/src/pages/craving-creator.tsx
  craving_creator: {
    descriptionInput: "A craving-description text area accepts typing or the existing voice input.",
    controls: [
      "Servings selector: 1 through 10 recipe servings.",
      "Cooking method is optional: Stovetop, Oven, Air Fryer, Grill, Slow Cooker or No-Cook. Selecting the active option again clears it.",
      "Craving Category is optional and has a Clear control.",
      "Diet and cuisine controls; Custom Dietary Restrictions is shown when an explicit diet override is not active.",
      "Flavor Preference uses personal palate preferences or neutral seasoning for others.",
      "Ingredient Control / Keep It Simple controls whether complementary ingredients may be added to what was listed.",
    ],
    generationAction: "Use the Create action beneath the form when ready; the destination performs generation and its safety checks.",
    notes: [
      "Describe the desired craving; Chef does not need to collect every optional control before opening this feature.",
      "Servings describe recipe yield, not a medical portion prescription.",
      "Safety controls and alerts are not instructions to disable protections. Never recommend bypassing an allergy, glucose or clinical warning to generate food.",
    ],
  },
  // client/src/pages/lifestyle/CreateDishPage.tsx
  create_a_dish: {
    descriptionInput: "The dish-description field is editable, including the reviewed idea transferred from Chef.",
    controls: ["Servings selector.", "Cooking preferences and optional notes.", "Ingredient Control / Keep It Simple."],
    generationAction: "Create My Dish starts the destination's creation workflow.",
    notes: ["Review or edit a transferred idea before creating. Opening the page does not automatically generate food."],
  },
  // client/src/pages/fridge-rescue.tsx
  fridge_rescue: {
    descriptionInput: "The ingredient field accepts the ingredients the member already has and wants to use.",
    controls: ["Optional Cooking method choices.", "Servings choices.", "Keep It Simple ingredient control."],
    generationAction: "The page's generation action uses the entered ingredients and selected preferences.",
    notes: ["Enter ingredients on the destination; Chef has no approved ingredient-prefill handoff. Do not promise that missing ingredients will be bought or pantry inventory updated."],
  },
  // client/src/pages/BeverageCreator.tsx
  beverage_creator: {
    descriptionInput: "Describe the drink in the free-text field, or use the drink-type and flavor controls.",
    controls: [
      "Drink Type includes Cocktail and Dive Bar alongside ordinary drink types.",
      "Flavor selector and optional Additional Notes.",
      "Serving Size offers single, two drinks, pitcher or party-batch choices.",
      "Optional Dietary Requirements.",
    ],
    generationAction: "The page's drink-creation action starts beverage generation.",
    notes: ["Description versus selector requirements are validated by the page; do not insist every selector must be filled when a description is provided.", "No ordinary Chef drink-prefill contract exists; do not reuse Hydration's tokens."],
  },
  // client/src/pages/AthleteBeverageCreator.tsx
  athlete_beverage_creator: {
    descriptionInput: "Describe a performance drink in the free-text field.",
    controls: ["Performance Goal, Drink Type and Flavor selectors.", "Optional Additional Notes.", "Serving Size and Dietary Requirements controls."],
    generationAction: "Create My Drink starts the destination's beverage workflow.",
    notes: ["The page validates required inputs. Performance Goal is about the drink's purpose, not permission to invent personal electrolyte, fluid or macro targets."],
  },
  // client/src/pages/CravingDessertCreator.tsx
  dessert_creator: {
    descriptionInput: "Describe the dessert or use the dessert-type and flavor controls.",
    controls: [
      "Dessert-type and flavor selections; cake-specific controls appear for the appropriate cake selection.",
      "Additional Notes for requested details.",
      "Recipe yield describes how much the whole recipe makes, not how much one person eats.",
      "Optional Dietary Requirements.",
    ],
    generationAction: "Use the destination's dessert-creation action when ready.",
    notes: ["Yield options depend on the chosen dessert. Do not invent a universal serving range or instruct one person to eat an entire recipe."],
  },
};
