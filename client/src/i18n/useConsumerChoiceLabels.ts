import { useConsumerCopy } from "./useConsumerCopy";

/** Closed display maps only. Keys remain the canonical request/storage values. */
export function useHydrationChoiceLabels() {
  const { t } = useConsumerCopy();
  return {
    beverages: {
      water: t("Plain water"), sparkling: t("Sparkling"), tea: t("Tea"),
      coffee: t("Coffee"), milk: t("Milk"), juice: t("Juice"), other: t("Other"),
    } as Record<string, string>,
    barriers: {
      forgetting: t("I forget"), taste: t("Taste"), temperature: t("Temperature"),
      carbonation: t("I prefer bubbles"), access: t("Access"), timing: t("Timing"),
      bathroom_concerns: t("Bathroom concerns"), nutrition_conflicts: t("Nutrition conflicts"),
      low_appetite: t("Low appetite"),
    } as Record<string, string>,
    preferenceLabels: { flavor: t("Flavor"), temperature: t("Temperature"), carbonation: t("Bubbles") } as Record<string, string>,
    preferenceValues: {
      no_preference: t("No preference"), citrus: t("Citrus"), berry: t("Berry"), mild: t("Mild"),
      cold: t("Cold"), room: t("Room temperature"), warm: t("Warm"), still: t("Still"), sparkling: t("Sparkling"),
    } as Record<string, string>,
    doors: {
      everyday: t("Everyday Hydration"), athletic: t("Athletic Hydration"),
      sick_day: t("Sick-Day Hydration"), liquid_nutrition: t("Liquid Nutrition Support"),
    } as Record<string, string>,
    doorDescriptions: { everyday: t("Track fluids and solve everyday barriers.") } as Record<string, string>,
  };
}

export function useGlucoseContextLabels() {
  const { t } = useConsumerCopy();
  return {
    FASTED: t("Fasted"), PRE_MEAL: t("Before meal"), POST_MEAL_1H: t("1 hour after meal"),
    POST_MEAL_2H: t("2 hours after meal"), RANDOM: t("Other time"),
  } as Record<string, string>;
}

export function useGlycemicFoodLabels() {
  const { t } = useConsumerCopy();
  return {
    Berries: t("Berries"), Cherries: t("Cherries"), Apples: t("Apples"), Pears: t("Pears"),
    Grapefruit: t("Grapefruit"), Bananas: t("Bananas"), Pineapple: t("Pineapple"),
    Oranges: t("Oranges"), Grapes: t("Grapes"), Melon: t("Melon"),
    "Brown Rice": t("Brown Rice"), "Whole Grain Bread": t("Whole Grain Bread"),
    Oatmeal: t("Oatmeal"), Quinoa: t("Quinoa"), "Sweet Potato": t("Sweet Potato"),
    Corn: t("Corn"), Lentils: t("Lentils"), Chickpeas: t("Chickpeas"), "Black Beans": t("Black Beans"),
    "Greek Yogurt": t("Greek Yogurt"), Milk: t("Milk"), "Leafy Greens": t("Leafy Greens"),
    Broccoli: t("Broccoli"), Cauliflower: t("Cauliflower"), Zucchini: t("Zucchini"),
    "Green Beans": t("Green Beans"), "Steel-cut Oats": t("Steel-cut Oats"),
    Carrots: t("Carrots"), Tomatoes: t("Tomatoes"), Cucumber: t("Cucumber"), Peppers: t("Peppers"),
    "Whole Wheat Pasta": t("Whole Wheat Pasta"), Asparagus: t("Asparagus"),
    "Brussels Sprouts": t("Brussels Sprouts"), Cabbage: t("Cabbage"), Spinach: t("Spinach"),
    Kale: t("Kale"), Cucumbers: t("Cucumbers"), Celery: t("Celery"),
    "Bell Peppers": t("Bell Peppers"), Mushrooms: t("Mushrooms"),
    Avocado: t("Avocado"), Almonds: t("Almonds"), Walnuts: t("Walnuts"),
  } as Record<string, string>;
}
