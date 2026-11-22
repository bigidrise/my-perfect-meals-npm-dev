jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: jest.fn() }));
import { finalizeMealImage } from "../services/mealFinalizer";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { processMealImageForSave } from "../services/imageLifecycle";
const photo = "/public-objects/fixture/meal-images/original.jpg";
const meal = { id: "recipe", name: "Turkey stew", ingredients: ["turkey", "carrots"] };
beforeEach(() => jest.clearAllMocks());
test("finalization cannot replace an existing photograph or its identity", async () => {
  const saved = { ...meal, imageUrl: photo, mediaAssetId: "original-asset" };
  expect(await finalizeMealImage({ meal: saved, initialGeneration: true })).toEqual({
    meal: saved, imageUrl: photo, mediaAssetId: "original-asset", permanent: true,
  });
  expect(generateMealImageUnified).not.toHaveBeenCalled();
  expect(processMealImageForSave).not.toHaveBeenCalled();
});
test("default finalization only looks up an original and never writes during restoration", async () => {
  jest.mocked(generateMealImageUnified).mockResolvedValue(photo);
  const result = await finalizeMealImage({ meal });
  expect(result.imageUrl).toBe(photo);
  expect(generateMealImageUnified).toHaveBeenCalledWith(
    meal.name, meal.ingredients, "meal", undefined, undefined, { lookupOnly: true },
  );
  expect(processMealImageForSave).not.toHaveBeenCalled();
});
test("fallback artwork cannot be finalized or persisted as the generated photograph", async () => {
  jest.mocked(generateMealImageUnified).mockResolvedValue("/images/fallback/meal.svg");
  expect((await finalizeMealImage({ meal, initialGeneration: true })).permanent).toBe(false);
  expect(processMealImageForSave).not.toHaveBeenCalled();
});
