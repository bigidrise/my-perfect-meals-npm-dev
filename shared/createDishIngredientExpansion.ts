import { z } from "zod";
import type { CookingMethodId } from "./catalog/techniques.catalog";

export const expansionDimensions = [
  "form",
  "method",
  "texture",
  "flavor",
  "cuisine",
] as const;

export const expansionSources = [
  "catalog",
  "category_default",
  "ingredient_technique_mapping",
  "validated_ai",
] as const;

export const expansionConfidence = ["high", "medium", "review"] as const;

export const ExpansionDimensionSchema = z.enum(expansionDimensions);
export const ExpansionSourceSchema = z.enum(expansionSources);
export const ExpansionConfidenceSchema = z.enum(expansionConfidence);
export const CookingMethodIdSchema = z.enum([
  "air-fried",
  "baked",
  "boiled",
  "fried",
  "grilled",
  "pan-seared",
  "poached",
  "scrambled",
  "steamed",
  "stir-fried",
  "well-done",
  "medium",
  "medium-rare",
]);

export const ExpansionOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1).max(80),
  dimension: ExpansionDimensionSchema,
  source: ExpansionSourceSchema,
  confidence: ExpansionConfidenceSchema,
  compatibleFormIds: z.array(z.string()).optional(),
  compatibleMethodIds: z.array(CookingMethodIdSchema).optional(),
  cuisineId: z.string().optional(),
  allergenTags: z.array(z.string()).optional(),
});

export type ExpansionOption = z.infer<typeof ExpansionOptionSchema>;
export type ValidatedCookingMethodId = z.infer<typeof CookingMethodIdSchema> & CookingMethodId;

export const IngredientRecognitionSchema = z.object({
  submittedText: z.string(),
  status: z.enum([
    "recognized",
    "clarification_required",
    "clarification_recommended",
    "unsupported",
  ]),
  canonicalId: z.string().nullable(),
  canonicalName: z.string().nullable(),
  category: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  clarification: z
    .object({
      question: z.string(),
      choices: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      ),
    })
    .optional(),
});

export const SurprisePolicySchema = z.object({
  delegatedDimensions: z.array(ExpansionDimensionSchema).default([]),
  selectedOptionIds: z
    .object({
      form: z.string().nullable().optional(),
      method: z.string().nullable().optional(),
      texture: z.string().nullable().optional(),
      flavor: z.string().nullable().optional(),
      cuisine: z.string().nullable().optional(),
    })
    .default({}),
});

export const ExpandIngredientRequestSchema = z.object({
  ingredientInput: z.string().trim().min(1).max(120),
  creator: z.literal("create_a_dish").default("create_a_dish"),
  surprisePolicy: SurprisePolicySchema.optional(),
  useAiForGaps: z.boolean().default(true),
});

export const ResolvedCombinationSchema = z.object({
  form: ExpansionOptionSchema.nullable(),
  method: ExpansionOptionSchema.nullable(),
  texture: ExpansionOptionSchema.nullable(),
  flavor: ExpansionOptionSchema.nullable(),
  cuisine: ExpansionOptionSchema.nullable(),
  selectionSource: z.record(
    ExpansionDimensionSchema,
    z.enum(["user_selected", "system_selected", "not_applicable"]),
  ),
});

export const ExpandIngredientResponseSchema = z.object({
  ingredient: IngredientRecognitionSchema,
  options: z.object({
    forms: z.array(ExpansionOptionSchema),
    methods: z.array(ExpansionOptionSchema),
    textures: z.array(ExpansionOptionSchema),
    flavors: z.array(ExpansionOptionSchema),
    cuisines: z.array(ExpansionOptionSchema),
  }),
  resolvedCombination: ResolvedCombinationSchema.nullable(),
  inferredSelectionIds: SurprisePolicySchema.shape.selectedOptionIds.default({}),
  warnings: z.array(
    z.object({
      code: z.enum([
        "UNSUPPORTED_INGREDIENT",
        "CLARIFICATION_REQUIRED",
        "NO_GOVERNED_FORMS",
        "AI_VALIDATION_FAILED",
        "NO_COMPATIBLE_COMBINATION",
        "EXPANSION_SERVICE_UNAVAILABLE",
      ]),
      message: z.string(),
    }),
  ),
});

export const CreateDishIntentSchema = z.object({
  creator: z.literal("create_a_dish"),
  originalText: z.string().trim().min(1).max(300),
  ingredient: z.object({
    canonicalId: z.string().min(1),
    canonicalName: z.string().min(1),
    category: z.string().min(1),
  }),
  resolvedCombination: z.object({
    form: ExpansionOptionSchema.nullable(),
    texture: ExpansionOptionSchema.nullable(),
    flavor: ExpansionOptionSchema.nullable(),
    selectionSource: z.object({
      form: z.enum(["user_selected", "system_selected", "not_applicable"]),
      texture: z.enum(["user_selected", "system_selected", "not_applicable"]),
      flavor: z.enum(["user_selected", "system_selected", "not_applicable"]),
    }).strict(),
  }).strict(),
}).strict();

export type ExpandIngredientRequest = z.infer<
  typeof ExpandIngredientRequestSchema
>;
export type ExpandIngredientResponse = z.infer<
  typeof ExpandIngredientResponseSchema
>;
export type ExpansionDimension = z.infer<typeof ExpansionDimensionSchema>;
export type CreateDishIntent = z.infer<typeof CreateDishIntentSchema>;
