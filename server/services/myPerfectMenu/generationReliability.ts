import { z } from "zod";
import { myPerfectMenuConceptSchema, myPerfectMenuPreferencesSchema } from "@shared/myPerfectMenu";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import { developmentMenuOccasionEnabled } from "./occasionSuitability";

// Other meal occasions retain their Development-only partial-choice rollout.
export const developmentMenuPreferencesSchema = myPerfectMenuPreferencesSchema.extend({
  categories: z.object({
    breakfast: z.array(myPerfectMenuConceptSchema).min(1).max(3).optional(),
    lunch: z.array(myPerfectMenuConceptSchema).min(1).max(3).optional(),
    dinner: z.array(myPerfectMenuConceptSchema).min(1).max(3).optional(),
    snack: z.array(myPerfectMenuConceptSchema).min(1).max(3).optional(),
  }),
});

/** Only My Perfect Menu may opt in; delegated Creators remain all-or-error. */
export function menuPartialChoicesEnabled(occasion: MyPerfectMenuCategory): boolean {
  return occasion === "snack" || developmentMenuOccasionEnabled();
}

// Accept partial snacks on reads as well as writes, without relaxing other
// Production meal categories or the shared Creator storage contract.
export const productionSnackPreferencesSchema = myPerfectMenuPreferencesSchema.extend({
  categories: myPerfectMenuPreferencesSchema.shape.categories.extend({
    snack: z.array(myPerfectMenuConceptSchema).min(1).max(3).optional(),
  }),
});

export function menuPreferencesSchema() {
  return developmentMenuOccasionEnabled()
    ? developmentMenuPreferencesSchema
    : productionSnackPreferencesSchema;
}

/** Never emit the suffix: it may contain ingredients or private clinical text. */
export function safeMenuRejectionRules(reasons: string[]): string[] {
  const rules = new Set([
    "result_not_object", "ingredients_missing", "forbidden_ingredient",
    "glucose_produce_not_allowed", "verified_calories_missing",
    "verified_carbs_missing", "verified_fat_missing", "dietary",
    "cuisine_mismatch", "protocol", "snack_type", "occasion_fit",
    "occasion_identity", "repetition", "history_uncertainty",
  ]);
  return [...new Set(reasons.map(reason => {
    const rule = reason.split(":")[0];
    return rules.has(rule) ? rule : "unclassified_food_check";
  }))];
}

export function developmentPreviousChoicesAvailability(
  count: number, fresh: boolean, compatible: boolean,
): "none" | "stale" | "compatible" | "unavailable" {
  if (!count) return "none";
  if (!fresh) return "stale";
  return count <= 3 && compatible ? "compatible" : "unavailable";
}
