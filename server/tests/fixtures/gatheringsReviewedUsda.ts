import type { IngredientComposition } from "../../services/productDiscovery/usdaIngredientAdapter";

/** Captured USDA SR Legacy records, retrieved 2026-10-27 via the existing
 * adapter. Public source: https://fdc.nal.usda.gov/food-details/{fdcId}/nutrients
 * Values and portion weights are source evidence, not synthetic recipe totals.
 * No credential-bearing request URLs are retained. */
export const gatheringsReviewedUsda: IngredientComposition[] = [
  {
    fdcId: 170926, description: "Spices, ginger, ground", dataType: "SR Legacy",
    retrievedAt: "2026-10-27T03:28:13.672Z", carbSource: "unknown",
    macrosPer100g: { calories: 335, protein: 8.98, carbs: 71.62, fat: 4.24 },
    portions: [{ amount: 1, grams: 5.2, measure: "tbsp" }, { amount: 1, grams: 1.8, measure: "tsp" }],
  },
  {
    fdcId: 171326, description: "Spices, nutmeg, ground", dataType: "SR Legacy",
    retrievedAt: "2026-10-27T03:28:14.457Z", carbSource: "unknown",
    macrosPer100g: { calories: 525, protein: 5.84, carbs: 49.29, fat: 36.31 },
    portions: [{ amount: 1, grams: 7, measure: "tbsp" }, { amount: 1, grams: 2.2, measure: "tsp" }],
  },
  {
    fdcId: 171016, description: "Oil, sesame, salad or cooking", dataType: "SR Legacy",
    retrievedAt: "2026-10-27T03:28:15.455Z", carbSource: "unknown",
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    portions: [
      { amount: 1, grams: 13.6, measure: "tablespoon" },
      { amount: 1, grams: 4.5, measure: "tsp" }, { amount: 1, grams: 218, measure: "cup" },
    ],
  },
  {
    fdcId: 172442, description: "Miso", dataType: "SR Legacy",
    retrievedAt: "2026-10-27T03:28:15.942Z", carbSource: "unknown",
    macrosPer100g: { calories: 198, protein: 12.79, carbs: 25.37, fat: 6.01 },
    portions: [{ amount: 1, grams: 275, measure: "cup" }, { amount: 1, grams: 17, measure: "tbsp" }],
  },
  {
    fdcId: 170005, description: "Onions, spring or scallions (includes tops and bulb), raw",
    dataType: "SR Legacy", retrievedAt: "2026-10-27T03:28:16.605Z", carbSource: "unknown",
    macrosPer100g: { calories: 32, protein: 1.83, carbs: 7.34, fat: 0.19 },
    portions: [
      { amount: 1, grams: 5, measure: 'small (3" long)' },
      { amount: 1, grams: 6, measure: "tbsp chopped" },
      { amount: 1, grams: 100, measure: "cup, chopped" },
      { amount: 1, grams: 15, measure: 'medium (4-1/8" long)' },
      { amount: 1, grams: 25, measure: "large" },
    ],
  },
];
