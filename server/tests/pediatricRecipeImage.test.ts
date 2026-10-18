const mockGenerate = jest.fn();
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: mockGenerate,
}));

import { generatePediatricRecipeImage } from "../services/pediatric/recipeImage";
import { buildPediatricImageContext, isFallbackMealImage } from "../../shared/pediatricMealImage";

const recipe = {
  recipeName: "Preschool Pancakes",
  ingredients: [{ name: "oats" }, "egg", { item: "milk" }],
  textureAndChokingPreparation: "Serve soft pancakes cut into small manageable pieces.",
};
const context = {
  stageKey: "preschool",
  textureClass: "family_modified",
  presentationStrategy: "Small child's plate with manageable pieces",
  activeConditionIds: ["COND-0004"],
};

beforeEach(() => mockGenerate.mockReset());

describe("Perfect Beginnings shared image entry", () => {
  it("sends the validated recipe, age group, resolved texture and plating to the existing pipeline once", async () => {
    mockGenerate.mockResolvedValue("/public-objects/test/pancakes.jpg");
    const result = await generatePediatricRecipeImage(recipe, context, "Breakfast");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(recipe.recipeName, recipe.ingredients, "meal", {
      stage: "Preschool",
      ageRange: "4–5 years",
      textureClass: "family_modified",
      textureStrategy: undefined,
      textureHint: recipe.textureAndChokingPreparation,
      presentationStrategy: context.presentationStrategy,
      portionNote: "small preschool portion",
      activeConditionIds: ["COND-0004"],
    });
    expect(result.imageGeneration.status).toBe("generated");
    expect(result.imageUrl).toBe("/public-objects/test/pancakes.jpg");
  });

  it("keeps a genuine failure illustration distinct without a second generation", async () => {
    mockGenerate.mockResolvedValue("/images/fallback/breakfast.svg");
    const result = await generatePediatricRecipeImage(recipe, context);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(result.imageGeneration).toMatchObject({
      status: "fallback",
      attemptedWithPediatricContext: true,
      fallbackUrl: "/images/fallback/breakfast.svg",
    });
  });

  it("reports an unavailable attempt without retrying on pipeline errors", async () => {
    mockGenerate.mockRejectedValue(new Error("mock outage"));
    const result = await generatePediatricRecipeImage(recipe, context);
    expect(result.imageUrl).toBeNull();
    expect(result.imageGeneration.status).toBe("unavailable");
    expect(result.imageGeneration.attemptedWithPediatricContext).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it.each([["Snack", "snack"], ["Dessert", "dessert"], ["Smoothie", "beverage"]])(
    "preserves the %s occasion", async (occasion, source) => {
      mockGenerate.mockResolvedValue("/public-objects/test/food.jpg");
      await generatePediatricRecipeImage(recipe, context, occasion);
      expect(mockGenerate.mock.calls[0][2]).toBe(source);
    },
  );

  it("keeps a clinically resolved texture instead of substituting the normal stage texture", () => {
    const result = buildPediatricImageContext({ stageKey: "preschool", textureClass: "puree_only" });
    expect(result.textureClass).toBe("puree_only");
    expect(result.ageRange).toBe("4–5 years");
  });

  it.each([
    "/images/fallback/soup-bowl.svg",
    "https://example.test/images/fallback/soup-bowl.svg?cache=1",
  ])("recognizes placeholder %s", url => expect(isFallbackMealImage(url)).toBe(true));
});
