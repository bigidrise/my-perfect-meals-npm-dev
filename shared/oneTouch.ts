import { z } from "zod";
import { buildCulinaryFingerprint, culinaryFingerprintSchema, culinaryIdentitySchema, type CulinaryFingerprint } from "./culinaryIdentity";
import { myPerfectMenuCategorySchema } from "./myPerfectMenuCategory";

export const oneTouchCreatorSchema = z.enum(["create_a_dish", "craving_creator"]);
export type OneTouchCreator = z.infer<typeof oneTouchCreatorSchema>;

export const oneTouchIntentTypeSchema = z.enum(["explicit_craving", "one_touch_delegated"]);
export type OneTouchIntentType = z.infer<typeof oneTouchIntentTypeSchema>;

export function intentTypeForCreatorRequest(oneTouch: boolean): OneTouchIntentType {
  return oneTouch ? "one_touch_delegated" : "explicit_craving";
}

export const oneTouchCuisineSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("profile") }),
  z.object({ mode: z.literal("surprise") }),
  z.object({ mode: z.literal("explicit"), value: z.string().trim().min(2).max(80) }),
]);
export type OneTouchCuisine = z.infer<typeof oneTouchCuisineSchema>;

export const oneTouchEatingStyleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("profile") }),
  z.object({ mode: z.literal("explicit"), value: z.string().trim().min(2).max(80) }),
]);
export type OneTouchEatingStyle = z.infer<typeof oneTouchEatingStyleSchema>;

/**
 * Deliberately strict: browser input contains only request-scoped meal choices.
 * Actor, subject, health facts, context, and authorization are server-resolved.
 */
export const oneTouchRequestSchema = z.object({
  creator: oneTouchCreatorSchema,
  servings: z.number().int().min(1).max(10),
  cuisine: oneTouchCuisineSchema,
  eatingStyle: oneTouchEatingStyleSchema,
}).strict();
export type OneTouchRequest = z.infer<typeof oneTouchRequestSchema>;

export const oneTouchDirectionSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(180),
  primaryIngredients: z.array(z.string().trim().min(1).max(80)).min(2).max(10),
  primaryProtein: z.string().trim().max(80).nullable(),
  produceItems: z.array(z.string().trim().min(1).max(80)).max(8),
  cuisine: z.string().trim().min(2).max(80),
  dietaryEvidence: z.array(z.string().trim().min(1).max(100)).max(8),
  preparationMethod: z.string().trim().min(2).max(80),
  signature: z.string().trim().min(5).max(180),
  culinaryIdentity: culinaryIdentitySchema,
  occasion: myPerfectMenuCategorySchema,
}).strict();
export type OneTouchDirection = z.infer<typeof oneTouchDirectionSchema>;

export const oneTouchFailureCodeSchema = z.enum([
  "ONE_TOUCH_AUTH_REQUIRED",
  "ONE_TOUCH_CONTEXT_UNRESOLVED",
  "ONE_TOUCH_INVALID_REQUEST",
  "ONE_TOUCH_DIRECTION_COMPLETION_FAILED",
  "ONE_TOUCH_PROVIDER_INCOMPLETE",
  "ONE_TOUCH_AUTHORITY_REJECTED",
  "ONE_TOUCH_CREATOR_VALIDATION_FAILED",
]);
export type OneTouchFailureCode = z.infer<typeof oneTouchFailureCodeSchema>;

export const oneTouchHistoryEntrySchema = culinaryFingerprintSchema.extend({
  creator: oneTouchCreatorSchema,
});
export type OneTouchHistoryEntry = z.infer<typeof oneTouchHistoryEntrySchema>;

export const oneTouchHistorySchema = z.object({
  version: z.literal(1),
  create_a_dish: z.array(oneTouchHistoryEntrySchema).max(96).default([]),
  craving_creator: z.array(oneTouchHistoryEntrySchema).max(96).default([]),
}).default({ version: 1, create_a_dish: [], craving_creator: [] });
export type OneTouchHistory = z.infer<typeof oneTouchHistorySchema>;

export function emptyOneTouchHistory(): OneTouchHistory {
  return { version: 1, create_a_dish: [], craving_creator: [] };
}

export function directionToFingerprint(
  direction: Pick<OneTouchDirection, "title" | "primaryIngredients" | "primaryProtein" | "cuisine" | "preparationMethod" | "signature" | "culinaryIdentity" | "occasion">,
): CulinaryFingerprint {
  return buildCulinaryFingerprint({
    title: direction.title,
    primaryIngredients: direction.primaryIngredients,
    primaryProtein: direction.primaryProtein,
    cuisine: direction.cuisine,
    preparationMethod: direction.preparationMethod,
    culinaryIdentity: direction.culinaryIdentity,
  }, direction.occasion);
}