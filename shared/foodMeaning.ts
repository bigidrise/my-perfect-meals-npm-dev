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

/**
 * Literal ingredient identities, not safety permission or inferred recipes.
 * Keep the named species attached to the processed-food form. A format word
 * such as "bacon" alone does not establish a meat source.
 */
export function resolveExplicitProteinFoodMeanings(text: string): Array<{
  start: number;
  end: number;
  proteinSource: string;
  meaning: FoodMeaningV1;
}> {
  // Do not join separate lines/items or arbitrarily long whitespace into an
  // ingredient identity. Unknown formatting stays unresolved and fail-closed.
  const pattern = /\b(turkey|beef|chicken|duck|lamb|bison|venison|pork)(?:[ \t]{1,8}|-)(bacon|sausages?|ham|salami|pepperoni|chorizo)\b/gi;
  return Array.from(text.matchAll(pattern), match => ({
    start: match.index!,
    end: match.index! + match[0].length,
    proteinSource: match[1].toLowerCase(),
    meaning: FoodMeaningV1Schema.parse({
      version: 1,
      originalText: match[0],
      concept: {
        kind: "ingredient_led",
        canonicalName: `${match[1].toLowerCase()} ${match[2].toLowerCase()}`,
        // This helper also reads generated ingredient labels; never promote
        // those labels into authoritative user instructions.
        source: "semantic_inference",
      },
      cuisine: null,
      components: [],
      uncertainty: "resolved",
    }),
  }));
}