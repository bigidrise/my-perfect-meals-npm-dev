/** Presentation provenance only. Never used to select nutrition or permissions. */
const BUILDERS = {
  general_nutrition: { label: "General Nutrition", key: "sourceGeneralNutrition" },
  diabetic: { label: "Diabetic", key: "sourceDiabetic" },
  anti_inflammatory: { label: "Anti-Inflammatory", key: "sourceAntiInflam" },
  metabolic_medication: { label: "Metabolic Medication", key: "sourceMetabolic" },
  performance: { label: "Performance", key: "sourcePerformance" },
} as const;

export type SavedMealBuilder = keyof typeof BUILDERS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBuilder(value: unknown): value is SavedMealBuilder {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BUILDERS, value);
}

/**
 * Attach the saving Builder's explicit identity without changing sourceType
 * (part of the existing favorite hash), recipe contents, or clinical builderType.
 */
export function withSavedMealBuilderOrigin<T extends object>(meal: T, builder?: SavedMealBuilder) {
  return builder
    ? { ...meal, savedMealOrigin: { version: 1, kind: "builder", builder } }
    : meal;
}

// Only established Builder source tags are recognized for legacy rows.
// Clinical aliases such as heart-failure are deliberately NOT Builder evidence.
const LEGACY_BUILDERS: Readonly<Record<string, SavedMealBuilder | undefined>> = {
  "general-nutrition": "general_nutrition",
  generalnutrition: "general_nutrition",
  diabetic: "diabetic",
  "anti-inflammatory": "anti_inflammatory",
  antiinflammatory: "anti_inflammatory",
  glp1: "metabolic_medication",
  "glp-1": "metabolic_medication",
  "metabolic-medication": "metabolic_medication",
  "performance-competition": "performance",
  performancecompetition: "performance",
  "performance-nutrition": "performance",
  performance: "performance",
};

const SOURCES: Readonly<Record<string, { label: string; key?: string } | undefined>> = {
  "meal-builder": { label: "Meal Builder", key: "sourceMealBuilder" },
  "craving-creator": { label: "Craving Creator", key: "sourceCravingCreator" },
  "dessert-creator": { label: "Dessert Creator", key: "sourceDessertCreator" },
  "fridge-rescue": { label: "Fridge Rescue", key: "sourceFridgeRescue" },
  "chefs-kitchen": { label: "Chef's Kitchen", key: "sourceChefsKitchen" },
  "weekly-board": { label: "Weekly Board", key: "sourceWeeklyBoard" },
  "pairings-ai": { label: "Pairings AI", key: "sourcePairings" },
  "wine-list-helper": { label: "Wine List Helper", key: "sourceWineList" },
  "my-inspiration": { label: "Recipe Scan", key: "sourceRecipeScan" },
  "grocery-coach": { label: "Grocery Coach", key: "sourceGroceryCoach" },
  "beverage-creator": { label: "Beverage Creator" },
  "create-dish": { label: "Create a Dish" },
  "create-a-dish": { label: "Create a Dish" },
  "recipe-maker": { label: "Recipe Maker" },
  "find-meals": { label: "Find Meals" },
  "sushi-creator": { label: "Sushi Creator" },
  "pediatric-recipe": { label: "Pediatric Recipe" },
  restaurant: { label: "Restaurant" },
  buffet: { label: "Buffet" },
};

type Translate = (key: string, fallback: string) => string;

export function savedMealSourceLabel(
  sourceType: string | null | undefined,
  mealData?: unknown,
  translate: Translate = (_key, fallback) => fallback,
): string {
  const origin = isRecord(mealData) ? mealData.savedMealOrigin : undefined;
  const explicitBuilder = isRecord(origin) && origin.version === 1 &&
    origin.kind === "builder" && isBuilder(origin.builder) ? origin.builder : undefined;
  const source = typeof sourceType === "string"
    ? sourceType.trim().toLowerCase().replace(/['’]/g, "").replace(/[\s_]+/g, "-") : "";
  const builder = explicitBuilder ??
    (Object.prototype.hasOwnProperty.call(LEGACY_BUILDERS, source) ? LEGACY_BUILDERS[source] : undefined);
  if (builder) {
    const config = BUILDERS[builder];
    return translate(`savedMeals.${config.key}`, config.label);
  }
  const creator = Object.prototype.hasOwnProperty.call(SOURCES, source) ? SOURCES[source] : undefined;
  if (creator) {
    return creator.key ? translate(`savedMeals.${creator.key}`, creator.label) : creator.label;
  }
  // Never prettify an unknown protocol/diagnosis into a customer-facing source.
  return translate("savedMeals.sourceSavedMeal", "Saved Meal");
}
