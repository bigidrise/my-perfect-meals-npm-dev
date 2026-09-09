import { normalizeGeneratedFoodIdentityEvidence } from "../services/generatedFoodIdentityEvidence";

describe("generated food identity evidence", () => {
  it("preserves cuisine evidence supplied by the generated candidate", () => {
    const evidence = normalizeGeneratedFoodIdentityEvidence({
      cuisine: "Indian",
      cuisineIntensity: "authentic",
      seasoningIntensity: "strong",
      dishIdentityPreserved: true,
    });

    expect(evidence).toEqual(expect.objectContaining({
      cuisine: "Indian",
      cuisineIntensity: "authentic",
      seasoningIntensity: "strong",
      dishIdentityPreserved: true,
    }));
  });

  it("does not manufacture cuisine evidence when the candidate omits it", () => {
    expect(normalizeGeneratedFoodIdentityEvidence(undefined)).toBeUndefined();
  });
});