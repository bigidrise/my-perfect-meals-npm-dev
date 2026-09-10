import { validateDietaryRestriction } from "../services/guardrails/validators/dietaryRestrictionValidator";
import {
  maskNonAnimalDietaryCompounds,
  structuredIngredientText,
} from "../../shared/semanticDietaryIngredients";

describe("semantic dietary ingredient validation", () => {
  it("gives dish titles no ingredient-presence authority", () => {
    const result = validateDietaryRestriction({
      name: "Strawberry Vegan Ice Cream",
      ingredients: [
        { name: "strawberries" },
        { name: "coconut milk" },
        { name: "cashew cream" },
        { name: "maple syrup" },
      ],
    }, "vegan");

    expect(result.isValid).toBe(true);
  });

  it.each([
    "almond milk",
    "oat milk",
    "coconut milk",
    "cashew cream",
    "coconut cream",
    "peanut butter",
    "vegan butter",
    "vegan cream cheese",
  ])("classifies %s as a qualified non-animal compound", (ingredient) => {
    const masked = maskNonAnimalDietaryCompounds(ingredient);
    expect(masked).not.toMatch(/\b(milk|cream|butter|cheese)\b/);
  });

  it.each([
    "dairy cream",
    "heavy cream",
    "cow's milk",
    "dairy butter",
    "cream cheese",
  ])("does not hide an actual dairy ingredient: %s", (ingredient) => {
    const result = validateDietaryRestriction({
      name: "Vegan-labelled dessert",
      ingredients: [{ name: ingredient }],
    }, "vegan");
    expect(result.isValid).toBe(false);
  });

  it("extracts only structured ingredient evidence, not title or description text", () => {
    expect(structuredIngredientText([
      { name: "coconut milk" },
      { item: "strawberries" },
    ])).toBe("coconut milk | strawberries");
  });
});