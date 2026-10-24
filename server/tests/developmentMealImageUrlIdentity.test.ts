const mockInsert = jest.fn();
const mockValues = jest.fn();
const mockReturning = jest.fn();
const mockAuthority = jest.fn();
const mockUpload = jest.fn();
const mockSharp = jest.fn();
jest.mock("../db", () => ({ db: { insert: (...args: any[]) => mockInsert(...args) } }));
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: (...args: any[]) => mockAuthority(...args),
}));
jest.mock("@replit/object-storage", () => ({ Client: jest.fn(() => ({ uploadFromBytes: mockUpload })) }));
jest.mock("sharp", () => ({ __esModule: true, default: (...args: any[]) => mockSharp(...args) }));

import { processImageForMeal } from "../services/mediaAssetService";
import { DEVELOPMENT_MEAL_IMAGE_BUCKET_ID } from "../services/mealImageBucket";

const origin = "https://meal-image-fixture.replit.dev";
const objectName = "meal-images/fixture-display.png";
const path = `/public-objects/${DEVELOPMENT_MEAL_IMAGE_BUCKET_ID}/${objectName}`;
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, "env", {
    NODE_ENV: "development", DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: "true",
    REPLIT_DEV_DOMAIN: "meal-image-fixture.replit.dev",
    DEFAULT_OBJECT_STORAGE_BUCKET_ID: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  });
  mockAuthority.mockResolvedValue({
    status: "available", canonicalUrl: path, bucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID, objectName,
  });
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([{ id: "fixture-media-asset", validationStatus: "unvalidated" }]);
});
afterEach(() => jest.restoreAllMocks());

it("keeps canonical object paths and media associations identical on HTTPS save round trips (all writes mocked)", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request"));
  const relative = await processImageForMeal(path, "Fixture meal");
  const canonicalWrite = mockValues.mock.calls[0][0];
  const absolute = await processImageForMeal(origin + path, "Fixture meal");
  expect(absolute).toEqual(relative);
  expect(absolute.id).toBe("fixture-media-asset");
  expect(absolute.displayUrl).toBe(path);
  expect(mockAuthority.mock.calls).toEqual([[path], [path]]);
  expect(mockValues.mock.calls[1][0]).toEqual(canonicalWrite);
  expect(canonicalWrite).toMatchObject({
    thumbnailObjectKey: objectName, displayObjectKey: objectName, originalObjectKey: objectName,
    thumbnailUrl: path, displayUrl: path,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockSharp).not.toHaveBeenCalled();
});
