import { classifyFoodIdentity, foodIdentitySchema } from "@shared/foodIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenu";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeGeneratedMenuResponse(
  value: unknown,
  ideaType: MyPerfectMenuCategory,
  options?: { preserveValidFoodIdentityFields: boolean },
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

      const inferred = classifyFoodIdentity(identityText);
      if (options?.preserveValidFoodIdentityFields && isRecord(concept.foodIdentity)) {
        // One malformed optional texture must not erase an otherwise explicit,
        // valid dessert role or format. Preserve each schema-valid field; infer
        // only missing/invalid fields using the existing classifier.
        const identity: Record<string, unknown> = { ...inferred };
        for (const [key, schema] of Object.entries(foodIdentitySchema.shape)) {
          const parsed = schema.safeParse(concept.foodIdentity[key]);
          if (parsed.success && parsed.data !== undefined) identity[key] = parsed.data;
        }
        return { ...concept, foodIdentity: identity };
      }
      return {
        ...concept,
        foodIdentity: inferred,
      };
    }),
  };
}