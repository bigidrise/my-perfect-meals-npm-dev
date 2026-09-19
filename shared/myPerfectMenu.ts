import { z } from "zod";
import { foodIdentitySchema } from "./foodIdentity";
import { culinaryFingerprintSchema, culinaryIdentitySchema } from "./culinaryIdentity";
import {
  myPerfectMenuCategorySchema,
  type MyPerfectMenuCategory,
} from "./myPerfectMenuCategory";

export { myPerfectMenuCategorySchema };
export type { MyPerfectMenuCategory };

export const myPerfectMenuConceptSchema = z.object({
  id: z.string().min(8).max(100),
  ideaType: myPerfectMenuCategorySchema,
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(180),
  primaryIngredients: z.array(z.string().trim().min(1).max(80)).min(2).max(10),
  primaryProtein: z.string().trim().max(80).nullable(),
  produceItems: z.array(z.string().trim().min(1).max(80)).max(8),
  cuisine: z.string().trim().min(2).max(80),
  dietaryEvidence: z.array(z.string().trim().min(1).max(100)).max(8),
  preparationMethod: z.string().trim().min(2).max(80),
  signature: z.string().trim().min(5).max(180),
  foodIdentity: foodIdentitySchema.optional(),
  culinaryIdentity: culinaryIdentitySchema.optional(),
});
export type MyPerfectMenuConcept = z.infer<typeof myPerfectMenuConceptSchema>;

export const myPerfectMenuPreferencesSchema = z.object({
  version: z.literal(1),
  categories: z.object({
    breakfast: z.array(myPerfectMenuConceptSchema).length(3).optional(),
    lunch: z.array(myPerfectMenuConceptSchema).length(3).optional(),
    dinner: z.array(myPerfectMenuConceptSchema).length(3).optional(),
    snack: z.array(myPerfectMenuConceptSchema).length(3).optional(),
  }),
  recentSignatures: z.array(z.string().trim().min(5).max(180)).max(24).default([]),
  recentCulinaryFingerprints: z.array(culinaryFingerprintSchema).max(96).default([]),
  updatedAt: z.string().datetime(),
});
export type MyPerfectMenuPreferences = z.infer<typeof myPerfectMenuPreferencesSchema>;

export function emptyMyPerfectMenuPreferences(): MyPerfectMenuPreferences {
  return {
    version: 1,
    categories: {},
    recentSignatures: [],
    recentCulinaryFingerprints: [],
    updatedAt: new Date(0).toISOString(),
  };
}