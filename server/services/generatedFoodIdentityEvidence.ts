import type { HumanFoodCandidateEvidence } from "../../shared/humanFoodValidation";

export function normalizeGeneratedFoodIdentityEvidence(
  value: unknown,
): HumanFoodCandidateEvidence | undefined {
  if (!value || typeof value !== "object") return undefined;

  const evidence = value as Record<string, unknown>;
  return {
    cuisine: typeof evidence.cuisine === "string" ? evidence.cuisine : undefined,
    cuisineIntensity:
      typeof evidence.cuisineIntensity === "string"
        ? evidence.cuisineIntensity
        : undefined,
    heat: typeof evidence.heat === "string" ? evidence.heat : undefined,
    seasoningIntensity:
      typeof evidence.seasoningIntensity === "string"
        ? evidence.seasoningIntensity
        : undefined,
    broadFlavor:
      typeof evidence.broadFlavor === "string"
        ? evidence.broadFlavor
        : undefined,
    flavorStyle:
      typeof evidence.flavorStyle === "string"
        ? evidence.flavorStyle
        : undefined,
    dishIdentityPreserved:
      typeof evidence.dishIdentityPreserved === "boolean"
        ? evidence.dishIdentityPreserved
        : undefined,
  };
}