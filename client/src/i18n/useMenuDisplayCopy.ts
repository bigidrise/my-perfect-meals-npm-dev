import { useConsumerCopy } from "./useConsumerCopy";

/** UI copy mirrors the existing destination helpers; it never decides allowed slots. */
export function useMenuDisplayCopy() {
  const { t } = useConsumerCopy();
  const meal = {
    title: t("Where to add your meal"),
    message: t("Choose one of your Meal 1–6 slots to add this meal to your plan."),
    pickerMessage: t("Choose one of the highlighted meal slots to add your meal."),
  };
  const snack = {
    title: t("Where to add your snack"),
    message: t("Snack is the recommended slot for snacks and dessert snacks. You can also choose any Meal 1–6 slot."),
    pickerMessage: t("Snack is recommended. You can also choose any Meal 1–6 slot."),
  };
  return {
    instructions: { breakfast: meal, lunch: meal, dinner: meal, snack } as Record<string, typeof meal>,
    guidance: {
      title: t("Choose a meal slot"),
      message: t("Please select one of the highlighted meal slots for this meal."),
    },
    slots: {
      breakfast: t("Meal 1"), lunch: t("Meal 2"), dinner: t("Meal 3"),
      meal4: t("Meal 4"), meal5: t("Meal 5"), meal6: t("Meal 6"), snacks: t("Snack"),
    } as Record<string, string>,
    builders: {
      general_nutrition: t("General Nutrition Builder"),
      glp1: t("GLP-1 Meal Builder"),
      anti_inflammatory: t("Anti-Inflammatory Meal Builder"),
      performance_competition: t("Performance Nutrition Builder"),
    } as Record<string, string>,
  };
}
