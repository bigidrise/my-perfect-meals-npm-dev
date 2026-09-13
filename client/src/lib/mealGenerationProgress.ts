export type MealGenerationContext =
  | "general"
  | "create-dish"
  | "snack"
  | "dessert"
  | "fridge-rescue"
  | "pediatric"
  | "pregnancy"
  | "companion"
  | "gathering"
  | "diabetes"
  | "glp1"
  | "performance"
  | "sushi"
  | "restaurant"
  | "fast-food"
  | "beverage"
  | "pairing";

export type MealGenerationMode = "single" | "options" | "search" | "pairing";

export interface MealGenerationCopy {
  title: string;
  messages: string[];
}

const sharedMealMessages = [
  "Creating options around your preferences…",
  "Reviewing your dietary preferences…",
  "Balancing your nutrition targets…",
  "Checking ingredients and substitutions…",
  "Finalizing your meal options…",
  "Preparing your meal images…",
];

export function getMealGenerationCopy(
  context: MealGenerationContext,
  mode: MealGenerationMode = "single",
): MealGenerationCopy {
  const optionsTitle = mode === "options"
    ? "Chef is crafting your meal options…"
    : "Chef is crafting your meal…";

  switch (context) {
    case "create-dish":
      return { title: "Chef is crafting your meal options…", messages: sharedMealMessages };
    case "snack":
      return {
        title: "Chef is crafting your snack…",
        messages: [
          "Reviewing your snack preferences…",
          "Balancing nutrition and portion size…",
          "Checking ingredients and substitutions…",
          "Finalizing your snack…",
          "Preparing your snack image…",
        ],
      };
    case "dessert":
      return {
        title: mode === "options" ? "Chef is crafting your dessert options…" : "Chef is crafting your dessert…",
        messages: [
          "Creating options around your craving…",
          "Reviewing your dietary preferences…",
          "Balancing flavor and nutrition…",
          "Checking ingredients and substitutions…",
          "Preparing your dessert image…",
        ],
      };
    case "fridge-rescue":
      return {
        title: "Chef is building meals from what you have…",
        messages: [
          "Reviewing the ingredients you listed…",
          "Finding useful ingredient combinations…",
          "Considering your dietary preferences…",
          "Reducing unnecessary food waste…",
          "Finalizing your meal options…",
        ],
      };
    case "pediatric":
      return {
        title: mode === "options" ? "Chef is crafting kid-friendly options…" : "Chef is crafting a kid-friendly meal…",
        messages: [
          "Considering age-appropriate nutrition…",
          "Reviewing food preferences and avoidances…",
          "Balancing familiar foods with variety…",
          "Checking ingredients and substitutions…",
          "Finalizing a kid-friendly result…",
        ],
      };
    case "pregnancy":
      return {
        title: mode === "options" ? "Chef is crafting your meal options…" : "Chef is crafting your meal…",
        messages: [
          "Considering your pregnancy nutrition preferences…",
          "Reviewing dietary considerations…",
          "Balancing nourishment and meal satisfaction…",
          "Checking ingredients and substitutions…",
          "Finalizing your meal…",
        ],
      };
    case "companion":
      return {
        title: "Chef is crafting a companion meal…",
        messages: [
          "Reviewing the selected companion profile…",
          "Considering species-appropriate nutrition…",
          "Checking preferences and avoidances…",
          "Balancing ingredients and portions…",
          "Finalizing the companion meal…",
        ],
      };
    case "gathering":
      return {
        title: "Chef is crafting your gathering menu…",
        messages: [
          "Building courses around your occasion…",
          "Reviewing dietary preferences…",
          "Balancing flavors across the menu…",
          "Checking ingredients and substitutions…",
          "Finalizing your gathering experience…",
        ],
      };
    case "diabetes":
      return {
        title: optionsTitle,
        messages: [
          "Reviewing your food preferences…",
          "Considering glucose-conscious meal choices…",
          "Balancing carbohydrates, protein, and fiber…",
          "Checking ingredients and substitutions…",
          "Finalizing your meal options…",
        ],
      };
    case "glp1":
      return {
        title: optionsTitle,
        messages: [
          "Reviewing your food preferences…",
          "Considering portion comfort and protein needs…",
          "Balancing nourishment and meal satisfaction…",
          "Checking ingredients and substitutions…",
          "Finalizing your meal options…",
        ],
      };
    case "performance":
      return {
        title: mode === "options" ? "Chef is crafting your performance options…" : "Chef is crafting your performance meal…",
        messages: [
          "Considering your training goals…",
          "Balancing energy and recovery nutrition…",
          "Reviewing your dietary preferences…",
          "Checking ingredients and substitutions…",
          "Finalizing your performance result…",
        ],
      };
    case "sushi":
      return {
        title: mode === "options" ? "Creating your sushi options…" : "Creating your sushi…",
        messages: [
          "Building around your selected sushi style…",
          "Reviewing your ingredient preferences…",
          "Considering complementary fillings and toppings…",
          "Checking ingredients and substitutions…",
          "Finalizing your sushi…",
        ],
      };
    case "restaurant":
    case "fast-food":
      return {
        title: context === "fast-food" ? "Finding fast-food meal options…" : "Finding restaurant meal options…",
        messages: [
          "Reviewing menu choices…",
          "Matching options to your preferences…",
          "Considering dietary requirements…",
          "Comparing nutrition information…",
          "Finalizing the best matches…",
        ],
      };
    case "beverage":
      return {
        title: "Creating your beverage…",
        messages: [
          "Reviewing your beverage preferences…",
          "Considering flavor and serving style…",
          "Balancing ingredients and nutrition…",
          "Checking substitutions…",
          "Finalizing your beverage…",
        ],
      };
    case "pairing":
      return {
        title: "Finding complementary pairings…",
        messages: [
          "Reviewing the flavors in your meal…",
          "Comparing complementary options…",
          "Considering your preferences…",
          "Balancing contrast and harmony…",
          "Finalizing your pairing suggestions…",
        ],
      };
    default:
      return { title: optionsTitle, messages: sharedMealMessages };
  }
}

interface RotationTimer {
  stop: () => void;
}

export function startMealProgressRotation(
  messages: readonly string[],
  onMessage: (message: string) => void,
  intervalMs = 5000,
  timerApi: Pick<typeof globalThis, "setInterval" | "clearInterval"> = globalThis,
): RotationTimer {
  if (messages.length === 0) return { stop: () => undefined };
  let index = 0;
  onMessage(messages[index]);
  const interval = timerApi.setInterval(() => {
    index = (index + 1) % messages.length;
    onMessage(messages[index]);
  }, intervalMs);
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      timerApi.clearInterval(interval);
    },
  };
}