import { CreateDishIntentSchema, type CreateDishIntent } from "../../../shared/createDishIngredientExpansion";
import { FoodMeaningV1Schema, type FoodMeaningV1 } from "../../../shared/foodMeaning";
import type { DishAdaptationDirective } from "../dishAdaptation/types";
import { revalidateCreateDishIntent } from "./createDishIntent";
import {
  CREATE_DISH_SEMANTIC_RESOLVER_SYSTEM_PROMPT,
  resolveOpenWorldFoodIntent,
} from "./openWorldFoodIntentResolver";
import type { CreateDishSemanticIntent } from "../../../shared/createDishIngredientExpansion";
import { chatJson } from "../../utils/openaiSafe";

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const containsWords = (text: string, term: string) => ` ${words(text)} `.includes(` ${words(term)} `);

export function createDishMeaningEnabled(): boolean {
  return process.env.NODE_ENV === "development" &&
    process.env.CREATE_DISH_FOOD_MEANING_V1 === "true";
}

export function enrichFoodMeaning(
  meaning: FoodMeaningV1,
  directive: DishAdaptationDirective | null,
): FoodMeaningV1 {
  if (!directive) return meaning;
  return FoodMeaningV1Schema.parse({
    ...meaning,
    components: [
      ...directive.definingComponents.map(name => ({ name, role: "defining", source: "dish_adaptation" })),
      ...directive.adaptableComponents.map(name => ({ name, role: "adaptable", source: "dish_adaptation" })),
    ].slice(0, 30),
  });
}

/**
 * The browser's expansion is a suggestion, not authority for an inferred cuisine.
 * Re-interpret nonliteral claims on the server before they can enter the request.
 */
export async function resolveCreateDishFoodMeaning(
  raw: unknown,
  manualCuisine: unknown,
  allergyTags: string[],
  interpret: (text: string) => Promise<CreateDishSemanticIntent> = text =>
    resolveOpenWorldFoodIntent(text, {
      resolve: ({ userText }) => chatJson({
        system: CREATE_DISH_SEMANTIC_RESOLVER_SYSTEM_PROMPT,
        user: JSON.stringify({ userText }),
        temperature: 0.1,
      }),
    }),
): Promise<{ intent: CreateDishIntent; meaning: FoodMeaningV1 }> {
  const parsed = CreateDishIntentSchema.parse(raw);
  const manual = typeof manualCuisine === "string" && manualCuisine.trim()
    ? manualCuisine.trim() : null;
  const claimed = parsed.cuisine?.trim() || null;
  const explicitlyTyped = !!claimed && containsWords(parsed.originalText, claimed);
  let verifiedInference: string | null = null;

  // Semantic-prefixed IDs are model-derived hints from the browser expansion.
  // Confirm the concept independently on the server for every such request,
  // not only when cuisine happens to be absent from the typed text.
  if (parsed.ingredient.canonicalId.startsWith("semantic-") ||
      (claimed && !explicitlyTyped && !manual)) {
    const semantic = await interpret(parsed.originalText);
    if (words(semantic.canonicalName ?? "") !== words(parsed.ingredient.canonicalName) ||
        (parsed.ingredient.category === "prepared-dish") !== (semantic.kind === "prepared_dish")) {
      throw new Error("SEMANTIC_CLASSIFICATION_INCONSISTENT");
    }
    // The server's interpretation wins; differing plausible inferred cuisines
    // must not make a valid dish fail or authorize a client-supplied cuisine.
    verifiedInference = semantic.cuisine?.trim() || null;
  }

  // The existing explicit-cuisine validator stays strict. An independently
  // verified inference is removed only for that check, then restored as inferred.
  const intent = await revalidateCreateDishIntent(
    { ...parsed, cuisine: explicitlyTyped ? claimed : null },
    allergyTags,
  );
  const cuisine = manual ?? (explicitlyTyped ? claimed : verifiedInference);
  // An inferred association is useful generation context, never the user's
  // fixed cuisine instruction or the cuisine passed into food governance.
  const effectiveIntent = CreateDishIntentSchema.parse({
    ...intent, cuisine: manual ?? (explicitlyTyped ? claimed : null),
  });
  const meaning = FoodMeaningV1Schema.parse({
    version: 1,
    originalText: parsed.originalText,
    concept: {
      kind: intent.ingredient.category === "prepared-dish" ? "prepared_dish" : "ingredient_led",
      canonicalName: intent.ingredient.canonicalName,
      source: intent.ingredient.canonicalId.startsWith("semantic-") ? "semantic_inference" : "user_text",
    },
    cuisine: cuisine ? {
      value: cuisine,
      source: manual ? "user_selection" : explicitlyTyped ? "user_text" : "semantic_inference",
    } : null,
    components: [],
    uncertainty: "resolved",
  });
  return { intent: effectiveIntent, meaning };
}