import OpenAI from "openai";
import { z } from "zod";
import type { OneTouchDirection } from "@shared/oneTouch";

const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.union([z.string().trim().min(1), z.number().finite()]),
  unit: z.string().trim().min(1),
});

export const menuRecipeSchema = z.object({
  name: z.string().trim().min(3),
  description: z.string().trim().min(3),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.string().trim().min(10),
  calories: z.number().finite().positive(),
  protein: z.number().finite().nonnegative(),
  starchyCarbs: z.number().finite().nonnegative(),
  fibrousCarbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  cookingTime: z.string().trim().min(1),
  evidence: z.object({
    cuisine: z.string().nullable().optional(),
    cuisineIntensity: z.string().nullable().optional(),
    heat: z.string().nullable().optional(),
    seasoningIntensity: z.string().nullable().optional(),
    broadFlavor: z.string().nullable().optional(),
    flavorStyle: z.string().nullable().optional(),
  }).optional(),
}).strict();

export type MenuRecipeDraft = z.infer<typeof menuRecipeSchema>;

export interface MenuRecipeGenerationInput {
  concept: OneTouchDirection;
  authorityPrompt: string;
  cuisine: string | null;
}

let client: OpenAI | null = null;

/** This is a Menu candidate generator, not a safety or nutrition verification service. */
export async function generateMenuRecipe(input: MenuRecipeGenerationInput): Promise<MenuRecipeDraft> {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Menu recipe provider is unavailable");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: [
        "Create exactly ONE complete, customary individual-serving recipe from this approved Menu concept.",
        "Do not output an options array or alternate recipes. Do not substitute a different dish.",
        `Dish: ${input.concept.title}`,
        `Description: ${input.concept.description}`,
        `Primary ingredients that must remain recognizable: ${input.concept.primaryIngredients.join(", ")}`,
        `Preparation: ${input.concept.preparationMethod}`,
        `Culinary identity: ${JSON.stringify(input.concept.culinaryIdentity)}`,
        `Cuisine direction: ${input.cuisine ?? input.concept.cuisine}`,
        input.authorityPrompt,
        "Use realistic quantities and explicit units for ONE serving. Include every ingredient used in the instructions.",
        "Nutrition is a model estimate for one serving, NOT a verified label or lab result.",
        'Return one JSON object: {"name":"...","description":"...","ingredients":[{"name":"...","quantity":"2","unit":"oz"}],"instructions":"Full cooking instructions...","calories":400,"protein":30,"starchyCarbs":20,"fibrousCarbs":10,"fat":15,"cookingTime":"25 minutes","evidence":{"cuisine":"... or null","cuisineIntensity":null,"heat":null,"seasoningIntensity":null,"broadFlavor":null,"flavorStyle":null}}',
      ].join("\n\n"),
    }],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Menu recipe provider returned no candidate");
  return menuRecipeSchema.parse(JSON.parse(content));
}