import {
  CreateDishSemanticIntentSchema,
  type CreateDishSemanticIntent,
} from "../../../shared/createDishIngredientExpansion";

export interface SemanticFoodIntentProvider {
  resolve(input: { userText: string }): Promise<unknown>;
}

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function resolveOpenWorldFoodIntent(
  userText: string,
  provider: SemanticFoodIntentProvider,
): Promise<CreateDishSemanticIntent> {
  const raw = await provider.resolve({ userText });
  const parsed = CreateDishSemanticIntentSchema.omit({ source: true }).parse(raw);
  const clarification =
    (parsed.kind === "ambiguous" || parsed.confidence === "low")
      ? parsed.clarification
      : null;
  if ((parsed.kind === "ambiguous" || parsed.confidence === "low") && !clarification) {
    throw new Error("SEMANTIC_CLARIFICATION_REQUIRED");
  }
  if (
    !["ambiguous", "non_food"].includes(parsed.kind) &&
    parsed.confidence !== "low" &&
    !parsed.canonicalName
  ) {
    throw new Error("SEMANTIC_CANONICAL_NAME_REQUIRED");
  }
  return CreateDishSemanticIntentSchema.parse({
    ...parsed,
    source: "semantic",
    clarification,
  });
}

export function semanticIntentToIngredientRecognition(
  submittedText: string,
  intent: CreateDishSemanticIntent,
) {
  if (intent.kind === "non_food") {
    return {
      submittedText,
      status: "unsupported" as const,
      canonicalId: null,
      canonicalName: null,
      category: null,
      confidence: intent.confidence,
    };
  }
  if (intent.kind === "ambiguous" || intent.confidence === "low") {
    return {
      submittedText,
      status: "clarification_required" as const,
      canonicalId: null,
      canonicalName: null,
      category: null,
      confidence: "low" as const,
      clarification: intent.clarification ?? undefined,
    };
  }
  const canonicalName = intent.canonicalName!;
  return {
    submittedText,
    status: "recognized" as const,
    canonicalId: `semantic-${slug(canonicalName) || "food-request"}`,
    canonicalName,
    category: intent.kind.replaceAll("_", "-"),
    confidence: intent.confidence,
  };
}