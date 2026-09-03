import { enforceSafetyProfileSync } from "../services/safetyProfileService";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";

const lactoseProfile = {
  userId: "synthetic-lactose-user",
  allergies: ["lactose"],
  dietaryRestrictions: [],
  healthConditions: [],
  avoidIngredients: [],
};

const milkAllergyProfile = {
  ...lactoseProfile,
  userId: "synthetic-milk-allergy-user",
  allergies: ["milk"],
};

describe("lactose-intolerance request preflight", () => {
  test.each(["cake", "dessert", "steak", "lactose-free cake"])(
    "allows %s when no prohibited ingredient is requested",
    (request) => {
      expect(enforceSafetyProfileSync(lactoseProfile, request).result).toBe("SAFE");
    },
  );

  test("keeps explicit milk cake as an adaptable conflict", () => {
    const result = enforceSafetyProfileSync(lactoseProfile, "milk cake");

    expect(result.result).toBe("BLOCKED");
    expect(result.blockedTerms).toContain("milk");
    expect(result.allergyConflict?.type).toBe("conflict_adaptable");
  });

  test("does not let a lactose-free label hide another explicit milk request", () => {
    const result = enforceSafetyProfileSync(
      lactoseProfile,
      "lactose-free cake with whole milk",
    );

    expect(result.result).toBe("BLOCKED");
    expect(result.blockedTerms).toContain("milk");
  });

  test("preserves true milk-allergy protection", () => {
    const result = enforceSafetyProfileSync(milkAllergyProfile, "milk cake");

    expect(result.result).toBe("BLOCKED");
    expect(result.blockedCategories).toContain("milk");
  });
});

describe("lactose-intolerance final Human Food validation", () => {
  const context = {
    safety: {
      allergies: ["lactose"],
      avoidedFoods: [],
    },
    nutrition: null,
  } as any;

  test("does not reject an explicit lactose-free result label", () => {
    const result = validateHumanFoodResult(
      {
        name: "Indian Lactose-Free Cardamom Cake",
        ingredients: [{ name: "oat beverage" }, { name: "cardamom" }],
      },
      context,
    );

    expect(result.violations).not.toContain("forbidden_ingredient:lactose");
  });

  test("still rejects an unnegated lactose exposure", () => {
    const result = validateHumanFoodResult(
      {
        name: "Cardamom Cake",
        ingredients: [{ name: "lactose powder" }],
      },
      context,
    );

    expect(result.violations).toContain("forbidden_ingredient:lactose");
  });
});