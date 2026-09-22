const resolvePublicObjectPath = jest.fn();

jest.mock("../objectStorage", () => ({
  ObjectStorageService: class {
    resolvePublicObjectPath = resolvePublicObjectPath;
  },
  StorageUnavailableError: class StorageUnavailableError extends Error {},
}));

jest.mock("../services/mealImageBucket", () => ({
  getActiveMealImageBucket: () => "replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  resolveMealImageReadBucket: (bucketId: string) => bucketId,
  publicMealImageUrl: (key: string) =>
    `/public-objects/replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/${key}`,
}));

import {
  parseMealImageObjectUrl,
  validateMealImageAuthority,
} from "../services/mealImageAuthority";

describe("meal image storage authority", () => {
  beforeEach(() => resolvePublicObjectPath.mockReset());

  it("rejects shape-only and detached-bucket references", async () => {
    expect(parseMealImageObjectUrl("/public-objects/not-a-bucket/meal-images/a.jpg")).toBeNull();
    await expect(validateMealImageAuthority(
      "/public-objects/replit-objstore-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/meal-images/a.jpg",
    )).resolves.toEqual({ status: "missing", reason: "inactive" });
    expect(resolvePublicObjectPath).not.toHaveBeenCalled();
  });

  it("accepts an active reference only when the object exists", async () => {
    resolvePublicObjectPath.mockResolvedValue({
      bucketId: "replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      objectName: "meal-images/a.jpg",
    });
    await expect(validateMealImageAuthority(
      "/public-objects/replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meal-images/a.jpg",
    )).resolves.toEqual({
      status: "available",
      canonicalUrl: "/public-objects/replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meal-images/a.jpg",
      bucketId: "replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      objectName: "meal-images/a.jpg",
    });
  });

  it("rejects an active reference whose object is missing", async () => {
    resolvePublicObjectPath.mockResolvedValue(null);
    await expect(validateMealImageAuthority(
      "/public-objects/replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meal-images/missing.jpg",
    )).resolves.toEqual({ status: "missing", reason: "missing" });
  });
});