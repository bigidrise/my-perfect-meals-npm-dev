import {
  createPediatricImageRestorer,
  pediatricImageForSave,
  resolvePediatricRecipeImage,
} from "../pediatricRecipeImage";
import { buildPediatricImageContext, type PediatricImageGeneration } from "@shared/pediatricMealImage";

const recipe = {
  recipeName: "Preschool Pancakes",
  ingredients: [{ name: "oats" }, { name: "egg" }],
  textureAndChokingPreparation: "Soft pancakes cut into manageable pieces.",
};
const fallback = "/images/fallback/soup-bowl.svg";
const photo = "/public-objects/test/pancakes.jpg";
const pediatricContext = buildPediatricImageContext({
  stageKey: "preschool", textureClass: "family_modified",
  textureAndChokingPreparation: recipe.textureAndChokingPreparation,
});
const metadata = (status: PediatricImageGeneration["status"]): PediatricImageGeneration => ({
  pediatricContext,
  sourceType: "meal",
  status,
  attemptedWithPediatricContext: true,
  ...(status === "fallback" ? { fallbackUrl: fallback } : {}),
});

describe("Perfect Beginnings initial and restored image policy", () => {
  it("uses a successful server photo without another request", async () => {
    const request = jest.fn();
    const result = await resolvePediatricRecipeImage({ recipe, imageUrl: photo }, "preschool", "Breakfast", request);
    expect(request).not.toHaveBeenCalled();
    expect(result.imageStatus).toBe("generated");
    expect(result.imageUrl).toBe(photo);
  });

  it("does not mistake a legacy illustration for success; requests the intended pediatric image once", async () => {
    const request = jest.fn().mockResolvedValue({ imageUrl: photo });
    const result = await resolvePediatricRecipeImage({ recipe, imageUrl: fallback }, "preschool", "Breakfast", request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      mealName: recipe.recipeName,
      ingredients: recipe.ingredients,
      pediatricContext,
    }));
    expect(result.imageUrl).toBe(photo);
    expect(result.imageStatus).toBe("generated");
  });

  it.each(["fallback", "unavailable"] as const)(
    "does not repeat an already contextual %s server attempt", async status => {
      const request = jest.fn();
      const result = await resolvePediatricRecipeImage({
        recipe: { ...recipe, _imageGeneration: metadata(status) },
        imageGeneration: metadata(status),
        imageUrl: status === "fallback" ? fallback : null,
      }, "preschool", "Breakfast", request);
      expect(request).not.toHaveBeenCalled();
      expect(result.imageStatus).toBe(status);
    },
  );

  it("uses exactly the persisted pediatric context and occasion when regenerating a missing saved image", async () => {
    const request = jest.fn().mockResolvedValue({ imageUrl: photo });
    const saved = { ...metadata("generated"), sourceType: "snack" as const };
    const result = await resolvePediatricRecipeImage({
      recipe: { ...recipe, _imageGeneration: saved }, imageUrl: null,
    }, "growing_child", undefined, request);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "snack", pediatricContext: saved.pediatricContext,
    }));
    expect(result.recipe._imageGeneration).toMatchObject({ status: "generated", pediatricContext });
  });

  it("builds stage-appropriate context for a legacy saved meal with no image metadata", async () => {
    const request = jest.fn().mockResolvedValue({ imageUrl: photo });
    await resolvePediatricRecipeImage({ recipe, imageUrl: null }, "beginning_foods", undefined, request);
    expect(request.mock.calls[0][0].pediatricContext).toMatchObject({
      stage: "Beginning Foods", ageRange: "~6–11 months", textureClass: "puree_only",
    });
  });

  it("preserves resolver texture/plating instead of assuming typical age-stage ability", async () => {
    const request = jest.fn().mockResolvedValue({ imageUrl: photo });
    await resolvePediatricRecipeImage({
      recipe, imageUrl: fallback,
      resolverMeta: { stageKey: "preschool", textureClass: "puree_only" },
      resolverContext: { textureStrategy: "smooth with no lumps", presentationStrategy: "small shallow bowl" },
    }, "preschool", undefined, request);
    expect(request.mock.calls[0][0].pediatricContext).toMatchObject({
      textureClass: "puree_only", textureStrategy: "smooth with no lumps",
      presentationStrategy: "small shallow bowl",
    });
  });

  it.each(["reject", "fallback"])("does not loop after a legacy repair %s", async outcome => {
    const request = outcome === "reject" ? jest.fn().mockRejectedValue(new Error("mock outage"))
      : jest.fn().mockResolvedValue({ imageUrl: fallback });
    const first = await resolvePediatricRecipeImage({ recipe, imageUrl: fallback }, "preschool", undefined, request);
    expect(first.imageStatus).toBe("fallback");
    const savedImageUrl = pediatricImageForSave(first.imageUrl);
    expect(savedImageUrl).toBeNull();
    const reopened = await resolvePediatricRecipeImage({ recipe: first.recipe, imageUrl: savedImageUrl }, "preschool", undefined, request);
    expect(reopened.imageUrl).toBe(fallback);
    expect(reopened.imageStatus).toBe("fallback");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("joins one restoration request/save across StrictMode replay and child switches", async () => {
    const restore = createPediatricImageRestorer();
    const request = jest.fn().mockResolvedValue({ imageUrl: photo });
    const save = jest.fn().mockResolvedValue(undefined);
    const input = { recipe, imageUrl: null };
    const one = restore("child-a:meal-a", input, "preschool", request, save);
    const two = restore("child-a:meal-a", input, "preschool", request, save);
    expect(one).toBe(two);
    await Promise.all([one, two]);
    await restore("child-a:meal-a", input, "preschool", request, save);
    expect(request).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    await restore("child-b:meal-b", input, "toddler", request, save);
    expect(request).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("never saves an illustration or base64 as a generated photograph", () => {
    expect(pediatricImageForSave(photo)).toBe(photo);
    expect(pediatricImageForSave(fallback)).toBeNull();
    expect(pediatricImageForSave(`https://example.test${fallback}`)).toBeNull();
    expect(pediatricImageForSave("data:image/png;base64,mock")).toBeNull();
  });

  it("does not repeatedly pay for restoration when durable storage is unavailable", async () => {
    const request = jest.fn().mockResolvedValue({ imageUrl: "data:image/png;base64,mock" });
    const first = await resolvePediatricRecipeImage({
      recipe: { ...recipe, _imageGeneration: metadata("generated") }, imageUrl: null,
    }, "preschool", undefined, request);
    expect(first.imageStatus).toBe("generated");
    expect(pediatricImageForSave(first.imageUrl)).toBeNull();
    const reopened = await resolvePediatricRecipeImage({
      recipe: first.recipe, imageUrl: null,
    }, "preschool", undefined, request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(reopened.imageStatus).toBe("unavailable");
  });
});
