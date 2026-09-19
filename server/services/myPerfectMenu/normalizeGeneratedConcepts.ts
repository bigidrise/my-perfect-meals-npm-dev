import { classifyFoodIdentity, foodIdentitySchema } from "@shared/foodIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenu";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeGeneratedMenuResponse(
  value: unknown,
  ideaType: MyPerfectMenuCategory,
): unknown {
  if (!isRecord(value) || !Array.isArray(value.concepts)) return value;

  return {
    ...value,
    concepts: value.concepts.map((concept) => {
      if (!isRecord(concept)) return concept;

      if (ideaType !== "snack") {
        const { foodIdentity: _unused, ...withoutFoodIdentity } = concept;
        return withoutFoodIdentity;
      }

      if (foodIdentitySchema.safeParse(concept.foodIdentity).success) return concept;

      const identityText = [
        concept.title,
        concept.description,
        ...(Array.isArray(concept.primaryIngredients) ? concept.primaryIngredients : []),
      ]
        .filter((item): item is string => typeof item === "string")
        .join(" ");

      return {
        ...concept,
        foodIdentity: classifyFoodIdentity(identityText),
      };
    }),
  };
}