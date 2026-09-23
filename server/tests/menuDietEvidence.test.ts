import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import { assessMenuDietEvidence } from "../services/oneTouch/menuDietEvidence";

const recipe = (ingredients: string[], name = "Supper"): HumanFoodCandidate => ({
  name,
  description: "A complete cooked meal.",
  ingredients: ingredients.map((ingredient) => ({ name: ingredient, quantity: "1", unit: "oz" })),
  instructions: "Cook the listed ingredients thoroughly and serve.",
  nutrition: { calories: 300, protein: 25, carbs: 5, fat: 15 },
});

describe("Menu identity evidence uses the existing compound-aware dietary classifier", () => {
  const proof = (identity: string, status: "pass" | "fail" | "review_required", source: string) => ({
    status: status === "pass" ? "supported" : status === "fail" ? "contradicted" : "unsupported",
    requirements: {
      [`dietary_identity:${identity}`]: {
        status, source,
        ...(source === "ingredient_classifier" ? { nutritionBasis: "not_applicable" } : {}),
      },
    },
  });
  it("supports an explicit carnivore recipe under the existing identity rule", () => {
    expect(assessMenuDietEvidence(recipe(["beef", "eggs"]), ["carnivore"]))
      .toEqual(proof("carnivore", "pass", "ingredient_classifier"));
  });

  it("rejects contradictory ingredients despite a carnivore title", () => {
    expect(assessMenuDietEvidence(recipe(["beef", "lentils"], "Keto Carnivore Supper"), ["carnivore"]))
      .toEqual(proof("carnivore", "fail", "ingredient_classifier"));
  });

  it("does not treat opaque ingredients as positive identity proof", () => {
    expect(assessMenuDietEvidence(recipe(["proprietary meat blend"]), ["carnivore"]))
      .toEqual(proof("carnivore", "review_required", "ingredient_classifier"));
  });

  it("respects compound-aware plant substitutes for vegan and still rejects actual dairy", () => {
    expect(assessMenuDietEvidence(recipe(["lentils", "almond milk", "vegan cheese"]), ["vegan"]))
      .toEqual(proof("vegan", "pass", "ingredient_classifier"));
    expect(assessMenuDietEvidence(recipe(["lentils", "cow milk"]), ["vegan"]))
      .toEqual(proof("vegan", "fail", "ingredient_classifier"));
  });

  it.each([
    ["vegetarian", ["eggs", "cheese"], ["eggs", "chicken"]],
    ["pescatarian", ["salmon", "tomatoes"], ["salmon", "beef"]],
  ] as const)("uses the shared %s identity rule for both clear and conflicting recipes", (diet, valid, invalid) => {
    expect(assessMenuDietEvidence(recipe([...valid]), [diet]))
      .toEqual(proof(diet, "pass", "ingredient_classifier"));
    expect(assessMenuDietEvidence(recipe([...invalid]), [diet]))
      .toEqual(proof(diet, "fail", "ingredient_classifier"));
  });

  it("does not claim keto or paleo from title, clean exclusions, or model-estimated macros", () => {
    const branded = recipe(["beef", "eggs"], "Keto Paleo Carnivore Bowl");
    for (const diet of ["keto", "paleo", "low-carb", "mediterranean"]) {
      expect(assessMenuDietEvidence(branded, [diet]))
        .toEqual(proof(diet.replace("-", " "), "review_required", "none"));
    }
    expect(assessMenuDietEvidence(branded, ["carnivore", "keto"]))
      .toEqual({
        status: "unsupported",
        requirements: {
          "dietary_identity:carnivore": {
            status: "pass", source: "ingredient_classifier", nutritionBasis: "not_applicable",
          },
          "dietary_identity:keto": { status: "review_required", source: "none" },
        },
      });
  });

  it("requires real structured ingredients rather than a positive title", () => {
    expect(assessMenuDietEvidence(recipe([], "Carnivore Supper"), ["carnivore"]))
      .toEqual(proof("carnivore", "review_required", "none"));
  });
});