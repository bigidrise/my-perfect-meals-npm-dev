import type { AwayFromHomeRecommendation } from "./awayFromHome";
import { z } from "zod";

const Meal = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  calories: z.number().finite().positive(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  ingredients: z.array(z.string()).optional(),
  description: z.string().optional(),
  reason: z.string().optional(),
  modifications: z.string().optional(),
  starchyCarbs: z.number().finite().nonnegative().nullish(),
  fibrousCarbs: z.number().finite().nonnegative().nullish(),
  howToOrder: z.object({ askFor: z.string(), modify: z.array(z.string()), swap: z.array(z.string()) }).optional(),
  medicalWaiterScript: z.string().optional(),
});

/** Only the validated Restaurant Guide response is adapted, never Getaway's
 * bestChoice / backupAdvice prose. Missing macros are not invented as zeros. */
export function getawayRestaurantCards(payload: any): AwayFromHomeRecommendation[] {
  if (!["unverified", "menu-item-only"].includes(payload?.compositionEvidence) ||
    !payload?.selectedVenue || !Array.isArray(payload.recommendations)) return [];
  return payload.recommendations.slice(0, 3).flatMap((value: unknown) => {
    const rec = value as any;
    const nested = rec?.meal;
    const parsed = Meal.safeParse(nested ? {
      id: rec.id, ...nested, protein: nested.proteinGrams,
      carbs: nested.carbohydrateGrams, fat: nested.fatGrams,
      starchyCarbs: nested.starchyCarbGrams, fibrousCarbs: nested.fibrousCarbGrams,
      reason: rec.recommendation?.reason, modifications: rec.recommendation?.modifications,
      howToOrder: rec.recommendation?.howToOrder, medicalWaiterScript: rec.recommendation?.medicalWaiterScript,
    } : value);
    if (!parsed.success) return [];
    const meal = parsed.data;
    return [{
      id: meal.id, source: "restaurant_guide" as const,
      restaurantName: payload.restaurantName,
      restaurantAddress: payload.selectedVenue.destinationName,
      restaurantCuisine: payload.cuisine,
      // Preserve the existing provider's actual confidence, not a status inferred
      // from a destination/brand/menu match. Generated meals remain estimated.
      nutritionStatus: (nested && payload.compositionEvidence === "menu-item-only" &&
        ["official", "mixed", "estimated"].includes(rec.nutritionStatus)
          ? rec.nutritionStatus : "estimated") as AwayFromHomeRecommendation["nutritionStatus"],
      menuSourceDisclosure: rec?.menuSourceDisclosure || payload.compositionNote,
      meal: {
        name: meal.name, description: meal.description, calories: meal.calories,
        proteinGrams: meal.protein, carbohydrateGrams: meal.carbs, fatGrams: meal.fat,
        ingredients: meal.ingredients, starchyCarbGrams: meal.starchyCarbs,
        fibrousCarbGrams: meal.fibrousCarbs,
      },
      recommendation: { reason: meal.reason, modifications: meal.modifications,
        howToOrder: meal.howToOrder, medicalWaiterScript: meal.medicalWaiterScript },
      // Never manufacture a clinical compliance badge from a destination match.
      protocol: {},
    }];
  });
}
