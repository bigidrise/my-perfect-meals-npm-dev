import type { GlucoseStateResolution } from "./glucoseStateResolver";
import {
  HYPOGLYCEMIA_PRODUCE_OVERRIDES,
  validateGlycemicProduce,
} from "./glycemicProduceValidator";

export interface GlucoseFilterMeal {
  ingredients: Array<{ name: string }>;
}

export function filterCatalogByGlucosePreferences<T extends GlucoseFilterMeal>(
  catalog: T[],
  glucose: GlucoseStateResolution | null,
): T[] {
  if (!glucose || !glucose.preferencesConfigured) return catalog;
  const selectedHypoglycemiaTreatment = glucose.state === "LOW" &&
    glucose.activePreferences.some((item) =>
      HYPOGLYCEMIA_PRODUCE_OVERRIDES.some(
        (allowed) => allowed.toLowerCase() === item.trim().toLowerCase(),
      ),
    );
  const safeLowGlucoseOverrides =
    glucose.state === "LOW" && !selectedHypoglycemiaTreatment
      ? [...HYPOGLYCEMIA_PRODUCE_OVERRIDES]
      : [];

  return catalog.filter((meal) =>
    validateGlycemicProduce({
      ingredients: meal.ingredients.map((ingredient) => ingredient.name),
      activePreferences: glucose.activePreferences,
      preferencesConfigured: true,
      glucoseState: glucose.state,
      safeLowGlucoseOverrides,
    }).allowed,
  );
}