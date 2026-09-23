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
  it("supports an explicit carnivore recipe under the existing identity rule", () => {
    expect(assessMenuDietEvidence(recipe(["beef", "eggs"]), ["carnivore"]))
      .toEqual({ status: "supported", dietaryIdentityCompliant: true });
  });

  it("rejects contradictory ingredients despite a carnivore title", () => {
    expect(assessMenuDietEvidence(recipe(["beef", "lentils"], "Keto Carnivore Supper"), ["carnivore"]))
      .toEqual({ status: "contradicted", dietaryIdentityCompliant: false });
  });

  it("does not treat opaque ingredients as positive identity proof", () => {
    expect(assessMenuDietEvidence(recipe(["proprietary meat blend"]), ["carnivore"]))
      .toEqual({ status: "unsupported", dietaryIdentityCompliant: undefined });
  });

  it("respects compound-aware plant substitutes for vegan and still rejects actual dairy", () => {
    expect(assessMenuDietEvidence(recipe(["lentils", "almond milk", "vegan cheese"]), ["vegan"]))
      .toEqual({ status: "supported", dietaryIdentityCompliant: true });
    expect(assessMenuDietEvidence(recipe(["lentils", "cow milk"]), ["vegan"]))
      .toEqual({ status: "contradicted", dietaryIdentityCompliant: false });
  });

  it.each([
    ["vegetarian", ["eggs", "cheese"], ["eggs", "chicken"]],
    ["pescatarian", ["salmon", "tomatoes"], ["salmon", "beef"]],
  ] as const)("uses the shared %s identity rule for both clear and conflicting recipes", (diet, valid, invalid) => {
    expect(assessMenuDietEvidence(recipe([...valid]), [diet]))
      .toEqual({ status: "supported", dietaryIdentityCompliant: true });
    expect(assessMenuDietEvidence(recipe([...invalid]), [diet]))
      .toEqual({ status: "contradicted", dietaryIdentityCompliant: false });
  });

  it("does not claim keto or paleo from title, clean exclusions, or model-estimated macros", () => {
    const branded = recipe(["beef", "eggs"], "Keto Paleo Carnivore Bowl");
    for (const diet of ["keto", "paleo", "low-carb", "mediterranean"]) {
      expect(assessMenuDietEvidence(branded, [diet]))
        .toEqual({ status: "unsupported", dietaryIdentityCompliant: undefined });
    }
    expect(assessMenuDietEvidence(branded, ["carnivore", "keto"]))
      .toEqual({ status: "unsupported", dietaryIdentityCompliant: undefined });
  });

  it("requires real structured ingredients rather than a positive title", () => {
    expect(assessMenuDietEvidence(recipe([], "Carnivore Supper"), ["carnivore"]))
      .toEqual({ status: "unsupported", dietaryIdentityCompliant: undefined });
  });
});