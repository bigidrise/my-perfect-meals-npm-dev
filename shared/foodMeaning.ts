import { z } from "zod";

// Culinary interpretation only. This is never evidence of food safety,
// nutrition compliance, or permission to override an explicit restriction.
export const FoodMeaningV1Schema = z.object({
  version: z.literal(1),
  originalText: z.string().trim().min(1).max(300),
  concept: z.object({
    kind: z.enum(["prepared_dish", "ingredient_led", "beverage", "dessert"]),
    canonicalName: z.string().trim().min(1).max(300),
    source: z.enum(["user_text", "semantic_inference"]),
  }).strict(),
  cuisine: z.object({
    value: z.string().trim().min(1).max(80),
    source: z.enum(["user_text", "user_selection", "semantic_inference"]),
  }).strict().nullable(),
  components: z.array(z.object({
    name: z.string().trim().min(1),
    role: z.enum(["defining", "adaptable"]),
    source: z.literal("dish_adaptation"),
  }).strict()).max(30),
  uncertainty: z.enum(["resolved", "needs_clarification"]),
}).strict();

export type FoodMeaningV1 = z.infer<typeof FoodMeaningV1Schema>;