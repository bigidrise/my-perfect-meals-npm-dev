// UI guidance for the current Menu destination flow, not a nutrition rule.
const REGULAR_MEAL_SLOTS = ["breakfast", "lunch", "dinner", "meal4", "meal5", "meal6"];

export const SNACK_SLOT_GUIDANCE = {
  title: "This belongs in your Snack slot",
  message: "This is a snack. Please select the highlighted Snack slot.",
};

const MEAL_CATEGORIES = ["breakfast", "lunch", "dinner"];
const MEAL_SLOT_GUIDANCE = {
  title: "Choose a meal slot",
  message: "Please select one of the highlighted meal slots for this meal.",
};

export function getMyPerfectMenuSlotGuidance(
  ideaType: string | null | undefined,
  slot: string | null | undefined,
) {
  if (ideaType === "snack" && slot && REGULAR_MEAL_SLOTS.includes(slot)) return SNACK_SLOT_GUIDANCE;
  if (ideaType && MEAL_CATEGORIES.includes(ideaType) && slot === "snacks") return MEAL_SLOT_GUIDANCE;
  return undefined;
}

export function isMyPerfectMenuSuggestedSlot(ideaType: string | null | undefined, slot: string) {
  if (ideaType === "snack") return slot === "snacks";
  return Boolean(ideaType && MEAL_CATEGORIES.includes(ideaType) && REGULAR_MEAL_SLOTS.includes(slot));
}

export function getMyPerfectMenuSlotInstruction(ideaType: string | null | undefined) {
  if (ideaType === "snack") return {
        title: "Where to add your snack",
        message: "Snacks and dessert snacks belong in your Snack slot. Select Snack when adding your choice to My Perfect Menu.",
        pickerMessage: "Choose the highlighted Snack slot to add your snack.",
      };
  if (ideaType && MEAL_CATEGORIES.includes(ideaType)) return {
        title: "Where to add your meal",
        message: "Choose one of your Meal 1–6 slots to add this meal to your plan.",
        pickerMessage: "Choose one of the highlighted meal slots to add your meal.",
      };
  return undefined;
}
