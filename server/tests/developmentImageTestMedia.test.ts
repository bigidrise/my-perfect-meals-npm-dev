const mockUpload = jest.fn(async (_key: string, _bytes: Buffer) => ({ ok: true }));
const mockValues = jest.fn();
jest.mock("../db", () => ({ db: { insert: () => ({ values: mockValues }) } }));
jest.mock("@replit/object-storage", () => ({ Client: jest.fn(() => ({ uploadFromBytes: mockUpload })) }));
jest.mock("sharp", () => ({
  __esModule: true,
  default: jest.fn(() => ({ resize: () => ({ jpeg: () => ({ toBuffer: async () => Buffer.from("variant-fixture") }) }) })),
}));
jest.mock("../services/mealImageAuthority", () => ({ validateMealImageAuthority: jest.fn() }));
jest.mock("../services/mealImageBucket", () => ({
  getActiveMealImageBucket: () => "fixture-bucket",
  assertActiveMealImageWriteBucket: (bucket: string) => bucket,
  publicMealImageUrl: (key: string) => `/public-objects/fixture-bucket/${key}`,
}));

import { processImageForMeal } from "../services/mediaAssetService";
import { withDevelopmentImageTestSubject, rememberDevelopmentImageTestImage, developmentImageTestScope } from "../services/images/developmentImageTestScope";

const runId = "d0000000-0000-4000-8000-000000000001";
const subject = { id: "e0000000-0000-4000-8000-000000000001", email: `image-test+${runId}@example.invalid`, isSandbox: true };
const env = { NODE_ENV: "development", IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare",
  DEVELOPMENT_IMAGE_TEST_ENABLED: "approved-single-image", DEVELOPMENT_IMAGE_TEST_RUN_ID: runId,
  DEVELOPMENT_IMAGE_TEST_USER_ID: subject.id };
const source = "data:image/png;base64,aW1hZ2UtZml4dHVyZQ==";
const scope = <T>(work: () => T) => withDevelopmentImageTestSubject(subject, work, { env, receipts: { claim: () => {} } });

beforeEach(() => {
  jest.clearAllMocks();
  mockValues.mockReturnValue({ returning: async () => [{ id: "synthetic-asset", validationStatus: "unvalidated" }] });
  mockUpload.mockResolvedValue({ ok: true });
});
describe("isolated canonical media persistence (all IO mocked)", () => {
  it("puts every variant under the isolated run prefix and labels its new asset", async () => scope(async () => {
    rememberDevelopmentImageTestImage(source);
    const prefix = developmentImageTestScope()!.storagePrefix;
    const image = await processImageForMeal(source, "Berry Coconut Chia Parfait");
    expect(mockUpload).toHaveBeenCalledTimes(3);
    expect(mockUpload.mock.calls.every(([key]) => String(key).startsWith(prefix))).toBe(true);
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "development-image-test", originalObjectKey: expect.stringContaining(prefix),
    }));
    expect(image.status).toBe("ready");
    expect(image.thumbnailUrl).toContain(prefix);
  }));
  it.each([null, "/images/historical.jpg", "/public-objects/fixture-bucket/meal-images/historical.jpg",
    "https://unrelated.invalid/image.png", "/unknown-relative-image"])("rejects unscoped or non-generated sources before writes: %s", async input => scope(async () => {
    await expect(processImageForMeal(input, "Berry Coconut Chia Parfait")).rejects.toThrow("development_image_test_");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockValues).not.toHaveBeenCalled();
  }));
  it("does not schedule retries or return a durable image on upload failure", async () => scope(async () => {
    rememberDevelopmentImageTestImage(source);
    mockUpload.mockRejectedValueOnce(new Error("fixture-upload-failure"));
    const image = await processImageForMeal(source, "Berry Coconut Chia Parfait");
    expect(image.status).toBe("failed");
    expect(image.thumbnailUrl).toBeNull();
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "development-image-test", nextRetryAt: null, retryCount: 0,
    }));
  }));
  it("leaves ordinary uploads in the original namespace", async () => {
    await processImageForMeal(source, "Normal snack");
    expect(mockUpload.mock.calls.every(([key]) => String(key).startsWith("meal-images/"))).toBe(true);
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "base64" }));
  });
});
