import { useEffect, useMemo, useState } from "react";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import {
  getMealGenerationCopy,
  startMealProgressRotation,
  type MealGenerationContext,
  type MealGenerationMode,
} from "@/lib/mealGenerationProgress";

export function useMealGenerationProgress(
  active: boolean,
  context: MealGenerationContext,
  mode: MealGenerationMode,
  intervalMs = 5000,
) {
  const { t } = useConsumerCopy();
  const copy = useMemo(
    () => {
      // Condition-specific wording is not approved for translation in this batch.
      if (["pediatric", "pregnancy", "diabetes", "glp1"].includes(context)) {
        return getMealGenerationCopy(context, mode);
      }
      const shared = {
        title: context === "create-dish" || mode === "options"
          ? t("Chef is crafting your meal options…")
          : t("Chef is crafting your meal…"),
        messages: [
          t("Creating options around your preferences…"),
          t("Reviewing your dietary preferences…"),
          t("Balancing your nutrition targets…"),
          t("Checking ingredients and substitutions…"),
          t("Finalizing your meal options…"),
          t("Preparing your meal images…"),
        ],
      };
      // These are closed, source-owned progress messages, never generated prose.
      switch (context) {
        case "snack": return { title: t("Chef is crafting your snack…"), messages: [
          t("Reviewing your snack preferences…"), t("Balancing nutrition and portion size…"),
          t("Checking ingredients and substitutions…"), t("Finalizing your snack…"), t("Preparing your snack image…"),
        ] };
        case "dessert": return {
          title: mode === "options" ? t("Chef is crafting your dessert options…") : t("Chef is crafting your dessert…"),
          messages: [t("Creating options around your craving…"), t("Reviewing your dietary preferences…"),
            t("Balancing flavor and nutrition…"), t("Checking ingredients and substitutions…"), t("Preparing your dessert image…")],
        };
        case "fridge-rescue": return { title: t("Chef is building meals from what you have…"), messages: [
          t("Reviewing the ingredients you listed…"), t("Finding useful ingredient combinations…"),
          t("Considering your dietary preferences…"), t("Reducing unnecessary food waste…"), t("Finalizing your meal options…"),
        ] };
        case "companion": return { title: t("Chef is crafting a companion meal…"), messages: [
          t("Reviewing the selected companion profile…"), t("Considering species-appropriate nutrition…"),
          t("Checking preferences and avoidances…"), t("Balancing ingredients and portions…"), t("Finalizing the companion meal…"),
        ] };
        case "gathering": return { title: t("Chef is crafting your gathering menu…"), messages: [
          t("Building courses around your occasion…"), t("Reviewing dietary preferences…"),
          t("Balancing flavors across the menu…"), t("Checking ingredients and substitutions…"), t("Finalizing your gathering experience…"),
        ] };
        case "performance": return {
          title: mode === "options" ? t("Chef is crafting your performance options…") : t("Chef is crafting your performance meal…"),
          messages: [t("Considering your training goals…"), t("Balancing energy and recovery nutrition…"),
            t("Reviewing your dietary preferences…"), t("Checking ingredients and substitutions…"), t("Finalizing your performance result…")],
        };
        case "sushi": return {
          title: mode === "options" ? t("Creating your sushi options…") : t("Creating your sushi…"),
          messages: [t("Building around your selected sushi style…"), t("Reviewing your ingredient preferences…"),
            t("Considering complementary fillings and toppings…"), t("Checking ingredients and substitutions…"), t("Finalizing your sushi…")],
        };
        case "restaurant":
        case "fast-food": return {
          title: context === "fast-food" ? t("Finding fast-food meal options…") : t("Finding restaurant meal options…"),
          messages: [t("Reviewing menu choices…"), t("Matching options to your preferences…"),
            t("Considering dietary requirements…"), t("Comparing nutrition information…"), t("Finalizing the best matches…")],
        };
        case "beverage": return { title: t("Creating your beverage…"), messages: [
          t("Reviewing your beverage preferences…"), t("Considering flavor and serving style…"),
          t("Balancing ingredients and nutrition…"), t("Checking substitutions…"), t("Finalizing your beverage…"),
        ] };
        case "pairing": return { title: t("Finding complementary pairings…"), messages: [
          t("Reviewing the flavors in your meal…"), t("Comparing complementary options…"),
          t("Considering your preferences…"), t("Balancing contrast and harmony…"), t("Finalizing your pairing suggestions…"),
        ] };
        default: return shared;
      }
    },
    [context, mode, t],
  );
  const [message, setMessage] = useState(copy.messages[0] ?? "");

  useEffect(() => {
    setMessage(copy.messages[0] ?? "");
    if (!active) return;
    const rotation = startMealProgressRotation(
      copy.messages,
      setMessage,
      intervalMs,
    );
    return rotation.stop;
  }, [active, copy, intervalMs]);

  return { title: copy.title, message };
}