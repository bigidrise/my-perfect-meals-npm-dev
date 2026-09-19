import { buildDietPromptBlock } from "../services/allergyGuardrails";
import { validateDietaryRestriction } from "../services/guardrails/validators/dietaryRestrictionValidator";

const meal = (ingredients: string[]) => ({
  name: "Generated concept",
  ingredients: ingredients.map((name) => ({ name })),
});

describe("My Perfect Menu restrictive dietary contract", () => {
  it.each([
    ["carnivore", "CARNIVORE DIET ENFORCEMENT"],
    ["vegan", "This user strictly follows a VEGAN diet"],
    ["vegetarian", "This user strictly follows a VEGETARIAN diet"],
    ["pescatarian", "This user strictly follows a PESCATARIAN diet"],
  ])("provides canonical generation instructions for %s", (diet, expected) => {
    expect(buildDietPromptBlock([diet])).toContain(expected);
  });

  it("supports three distinct carnivore concepts while pork remains avoided", () => {
    const concepts = [
      ["beef sirloin", "butter", "salt"],
      ["chicken thighs", "tallow", "salt"],
      ["salmon", "eggs", "butter", "salt"],
    ];

    for (const ingredients of concepts) {
      expect(ingredients.join(" ")).not.toMatch(/\bpork\b/i);
      expect(validateDietaryRestriction(meal(ingredients), "carnivore").isValid).toBe(true);
    }
    expect(new Set(concepts.map((ingredients) => ingredients[0])).size).toBe(3);
  });

  it.each([
    ["vegan", ["tofu", "lentils", "spinach"]],
    ["vegetarian", ["eggs", "cheese", "spinach"]],
    ["pescatarian", ["salmon", "rice", "spinach"]],
  ] as const)("keeps canonical %s validation authoritative", (diet, ingredients) => {
    expect(validateDietaryRestriction(meal([...ingredients]), diet).isValid).toBe(true);
  });

  it("still rejects prohibited ingredients after generation receives better guidance", () => {
    expect(validateDietaryRestriction(meal(["beef", "mustard"]), "carnivore").isValid).toBe(false);
    expect(validateDietaryRestriction(meal(["tofu", "chicken"]), "vegan").isValid).toBe(false);
  });
});