import OpenAI from "openai";
import { z, ZodError } from "zod";
import type { OneTouchDirection } from "@shared/oneTouch";

const sauceComponentSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.union([z.string().trim().min(1), z.number().finite()]),
  unit: z.string().trim().min(1),
});
const ingredientSchema = sauceComponentSchema.extend({
  /** Explicit homemade sauce components, not an unverified commercial label. */
  components: z.array(sauceComponentSchema).min(1).optional(),
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
});

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
  const prompt = [
        "Create exactly ONE complete, customary individual-serving recipe from this approved Menu concept.",
        "Do not output an options array or alternate recipes. Do not substitute a different dish.",
        `Dish: ${input.concept.title}`,
        `Description: ${input.concept.description}`,
        `Primary ingredients that must remain recognizable: ${input.concept.primaryIngredients.join(", ")}`,
        `Preparation: ${input.concept.preparationMethod}`,
        `Culinary identity: ${JSON.stringify(input.concept.culinaryIdentity)}`,
        `Cuisine direction: ${input.cuisine ?? input.concept.cuisine}`,
         input.concept.foodIdentity?.foodRole === "dessert"
           ? `Selected food identity: dessert (${input.concept.foodIdentity.formatFamily}). Complete this recognizable dessert in its selected form. A snack is the eating occasion, NOT permission to substitute a savory or generic snack. Adapt its ingredients to the person's protections while preserving the selected dessert.`
           : input.concept.foodIdentity?.foodRole === "general_snack"
             ? "Selected food identity: non-dessert food craving. Do not substitute a dessert."
             : "",
        input.authorityPrompt,
        "Use realistic quantities and explicit units for ONE serving. Include every ingredient used in the instructions.",
        'When you make a sauce or seasoning blend from named ingredients, include them in that ingredient\'s optional "components" array, each with name, quantity, and unit. A packaged sauce or seasoning has unknown contents: never invent them. Preserve the named compound and list every component you actually use.',
        "Nutrition is a model estimate for one serving, NOT a verified label or lab result.",
        "starchyCarbs means estimated carbohydrate from named starchy/concentrated food sources, not total carbs or grams of dietary fiber. If all carbohydrate-containing foods are non-starchy (such as cauliflower rice or zucchini noodles) and no concentrated starch is used, set starchyCarbs to 0. fibrousCarbs is the estimated remainder of total carbohydrate, NOT dietary-fiber grams. Do not claim that one recipe verifies a day's source allocation.",
        'Return one JSON object with these required fields and numeric macro values: {"name":"...","description":"...","ingredients":[{"name":"...","quantity":"2","unit":"oz"},{"name":"homemade sauce","quantity":"1","unit":"tbsp","components":[{"name":"named ingredient","quantity":"1","unit":"tsp"}]}],"instructions":"Full cooking instructions...","calories":400,"protein":30,"starchyCarbs":0,"fibrousCarbs":10,"fat":15,"cookingTime":"25 minutes","evidence":{"cuisine":null,"cuisineIntensity":null,"heat":null,"seasoningIntensity":null,"broadFlavor":null,"flavorStyle":null}}. The sample macro split is for a dish with no concentrated starch; estimate the actual recipe instead.',
  ].join("\n\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2400,
      messages: [{
        role: "user",
        content: attempt === 0 ? prompt : `${prompt}\n\nYour previous response did not match the required JSON recipe structure. Return one complete JSON object with every required field, numeric macro values, and explicitly named components for homemade sauces or seasoning blends. Do not change the requested dish or any food protections.`,
      }],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Menu recipe provider returned no candidate");
    try {
      return menuRecipeSchema.parse(JSON.parse(content));
    } catch (error) {
      if (attempt === 1 || !(error instanceof ZodError || error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error("Menu recipe provider returned no candidate");
}