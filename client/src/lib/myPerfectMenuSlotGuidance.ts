// UI guidance for the current Menu destination flow, not a nutrition rule.
const REGULAR_MEAL_SLOTS = ["breakfast", "lunch", "dinner", "meal4", "meal5", "meal6"];

const MEAL_CATEGORIES = ["breakfast", "lunch", "dinner"];
const MEAL_SLOT_GUIDANCE = {
  title: "Choose a meal slot",
  message: "Please select one of the highlighted meal slots for this meal.",
};

export function getMyPerfectMenuSlotGuidance(
  ideaType: string | null | undefined,
  slot: string | null | undefined,
) {
  // Meal 1–6 accept every food category. Highlights are recommendations only.
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
        message: "Snack is the recommended slot for snacks and dessert snacks. You can also choose any Meal 1–6 slot.",
        pickerMessage: "Snack is recommended. You can also choose any Meal 1–6 slot.",
      };
  if (ideaType && MEAL_CATEGORIES.includes(ideaType)) return {
        title: "Where to add your meal",
        message: "Choose one of your Meal 1–6 slots to add this meal to your plan.",
        pickerMessage: "Choose one of the highlighted meal slots to add your meal.",
      };
  return undefined;
}
