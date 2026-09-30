import {
  hasConcreteSelectedIngredients,
  missingSelectedIngredientPositions,
} from "../services/oneTouch/selectedIngredientEvidence";

describe("selected Menu ingredient evidence", () => {
  it("matches inflected names within one real structured ingredient, not arbitrary substrings", () => {
    expect(missingSelectedIngredientPositions(
      ["collard greens", "onions", "tomatoes"],
      ["chopped collard greens", "red onion", "diced tomato"],
    )).toEqual([]);
    expect(missingSelectedIngredientPositions(["ham", "rice"], ["hamburger", "licorice"])).toEqual([0, 1]);
  });

  it("cannot prove abstract card ingredients from a spice or wording in instructions", () => {
    expect(hasConcreteSelectedIngredients(["collard greens", "onions", "spices"])).toBe(false);
    expect(missingSelectedIngredientPositions(["spices"], ["turmeric", "ginger"])).toEqual([0]);
    expect(hasConcreteSelectedIngredients(["collard greens", "red onion", "turmeric"])).toBe(true);
  });

  it("requires the actual selected food, not a flavored product or unauthorized substitute", () => {
    expect(missingSelectedIngredientPositions(
      ["niter kibbeh", "onions", "turmeric"],
      ["olive oil", "onion-free sauce", "ginger", "collard greens"],
    )).toEqual([0, 1, 2]);
    expect(missingSelectedIngredientPositions(["onions"], ["onion powder"])).toEqual([0]);
    expect(missingSelectedIngredientPositions(["cocoa"], ["unsweetened cocoa powder"])).toEqual([]);
  });
});