import { readRecipePackage, savedRecipePackage, savedMealFavoriteKey } from "../../shared/recipePackage";

const snapshot = {
  version: 1 as const, id: "experience-one", source: "great-outdoors", servings: 6,
  preparationGuide: { title: "Nature to Table", sections: [{ heading: "Prepare", text: "Prepare first.\nCook afterward." }] },
  meals: [{
    name: "Wild turkey", servings: 6, ingredients: [{ name: "Turkey", quantity: 3, unit: "lb" }],
    instructions: ["Season", "Cook"], cookingInstructions: ["Season", "Cook"],
    nutrition: { calories: 1200, protein: 180, carbs: 12, fat: 48 },
    imageUrl: "/public-objects/original/turkey.jpg", mediaAssetId: "original-asset",
    displayUrl: "/public-objects/original/turkey-display.jpg",
  }],
};
test("a JSONB round trip retains every preparation, recipe, serving, nutrition and image field", () => {
  const before = JSON.stringify(snapshot);
  const payload = savedRecipePackage(snapshot, "create-dish");
  const restored = readRecipePackage(JSON.parse(JSON.stringify(payload.mealData)));
  expect(restored).toEqual(snapshot);
  expect(JSON.stringify(snapshot)).toBe(before);
  expect(payload.mealData.imageUrl).toBe(snapshot.meals[0].imageUrl);
  expect(payload.mealData.nutrition).toEqual(snapshot.meals[0].nutrition);
});
test("From Scratch can use the same snapshot without any outdoors-specific changes", () => {
  const fromScratch = { ...snapshot, source: "from-scratch", id: "scratch-one" };
  expect(readRecipePackage(savedRecipePackage(fromScratch, "recipe-maker").mealData)).toEqual(fromScratch);
});
test("courses lacking an explicit yield retain the experience serving count", () => {
  const packageWithoutYield = { ...snapshot, meals: [{ name: "Outdoor beans", ingredients: ["beans"] }] };
  const saved = savedRecipePackage(packageWithoutYield, "create-dish");
  expect(saved.mealData.recipePackage.meals[0].servings).toBe(6);
  expect(packageWithoutYield.meals[0]).not.toHaveProperty("servings");
});
test("package identities isolate repeated guide titles and retain legacy favorite keys", () => {
  expect(savedMealFavoriteKey(" Same guide ", "create-dish")).toBe("same guide|create-dish");
  expect(savedMealFavoriteKey("Same guide", "create-dish", "first"))
    .not.toBe(savedMealFavoriteKey("Same guide", "create-dish", "second"));
  expect(savedMealFavoriteKey("Same guide", "create-dish", "first"))
    .toBe(savedMealFavoriteKey(" Same guide ", "create-dish", "first"));
});
test.each([null, {}, { recipePackage: { ...snapshot, version: 2 } },
  { recipePackage: { ...snapshot, meals: [null] } },
  { recipePackage: { ...snapshot, preparationGuide: { title: "broken", sections: [null] } } },
])("malformed and legacy data never becomes a broken package renderer", value => {
  expect(readRecipePackage(value)).toBeNull();
});
