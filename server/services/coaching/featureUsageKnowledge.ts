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
