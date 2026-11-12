import {
  decideImageDeliveryRecovery,
  IMAGE_DELIVERY_RETRY_LIMIT,
  publicObjectPathFromUrl,
  publicObjectUrlForKey,
  savedMealImageUrls,
} from "../services/imageDeliveryRecovery";

const failedUrl = "/public-objects/replit-objstore-test/meal-images/salmon-thumb.jpg";

describe("meal image delivery recovery policy", () => {
  test("keeps Object Storage URLs addressable by the server-side resolver", () => {
    expect(publicObjectPathFromUrl(failedUrl)).toBe(
      "replit-objstore-test/meal-images/salmon-thumb.jpg",
    );
    expect(publicObjectPathFromUrl("https://example.com/image.jpg")).toBeNull();
  });

  test("also supports legacy Object Storage URLs resolved through search paths", () => {
    expect(publicObjectPathFromUrl("/public-objects/meal-images/legacy-salmon.jpg")).toBe(
      "meal-images/legacy-salmon.jpg",
    );
  });

  test("retries a 503-style storage failure once instead of treating it as missing", () => {
    expect(decideImageDeliveryRecovery({
      failedUrl,
      failedProbe: "unavailable",
    })).toEqual({ status: "retry", imageUrl: failedUrl });
    expect(IMAGE_DELIVERY_RETRY_LIMIT).toBe(1);
  });

  test("retries an object that exists again after a browser delivery failure", () => {
    expect(decideImageDeliveryRecovery({
      failedUrl,
      failedProbe: "available",
    })).toEqual({ status: "retry", imageUrl: failedUrl });
  });

  test("recovers a 404 thumbnail with an existing display variant without regeneration", () => {
    const displayUrl = "/public-objects/replit-objstore-test/meal-images/salmon-display.jpg";
    expect(decideImageDeliveryRecovery({
      failedUrl,
      failedProbe: "missing",
      alternate: { url: displayUrl, probe: "available" },
    })).toEqual({ status: "recovered", imageUrl: displayUrl });
  });

  test("marks a confirmed missing object unavailable when no stored variant survives", () => {
    expect(decideImageDeliveryRecovery({
      failedUrl,
      failedProbe: "missing",
      alternate: { url: "/public-objects/replit-objstore-test/meal-images/salmon-display.jpg", probe: "missing" },
    })).toEqual({ status: "unavailable", reason: "missing" });
  });

  test("builds an original-variant URL in the same Object Storage bucket", () => {
    expect(publicObjectUrlForKey(failedUrl, "meal-images/salmon-orig.jpg")).toBe(
      "/public-objects/replit-objstore-test/meal-images/salmon-orig.jpg",
    );
  });
});

describe("saved image presentation after a delivery failure", () => {
  const row = {
    mediaAssetId: "owned-asset",
    assetStatus: "failed",
    assetProcessingError: "delivery_missing",
    assetThumbnailUrl: failedUrl,
    assetDisplayUrl: "/public-objects/replit-objstore-test/meal-images/salmon-display.jpg",
    mealData: { imageUrl: "/public-objects/unrelated-old-image.jpg" },
  };

  test("retries the original canonical references without changing the record", () => {
    const original = JSON.stringify(row);
    expect(savedMealImageUrls(row)).toEqual({
      thumbnailUrl: row.assetThumbnailUrl,
      displayUrl: row.assetDisplayUrl,
    });
    expect(JSON.stringify(row)).toBe(original);
  });

  test.each(["upload_failed", "storage_authority_unavailable", null])(
    "does not revive a genuine processing failure: %s",
    assetProcessingError => {
      expect(savedMealImageUrls({ ...row, assetProcessingError })).toEqual({
        thumbnailUrl: null, displayUrl: null,
      });
    },
  );

  test("does not revive pending assets or fall back to unrelated recipe JSON", () => {
    expect(savedMealImageUrls({ ...row, assetStatus: "pending" })).toEqual({
      thumbnailUrl: null, displayUrl: null,
    });
    expect(savedMealImageUrls({ ...row, assetThumbnailUrl: null, assetDisplayUrl: null })).toEqual({
      thumbnailUrl: null, displayUrl: null,
    });
  });

  test.each(["data:image/jpeg;base64,unsafe", "https://example.com/temporary.jpg"])(
    "never retries an unsafe/non-Object-Storage failed reference: %s", url => {
      expect(savedMealImageUrls({ ...row, assetThumbnailUrl: url, assetDisplayUrl: url })).toEqual({
        thumbnailUrl: null, displayUrl: null,
      });
    },
  );

  test("keeps ready and safe legacy images working", () => {
    expect(savedMealImageUrls({ ...row, assetStatus: "ready" }).thumbnailUrl).toBe(failedUrl);
    expect(savedMealImageUrls({ mealData: { imageUrl: failedUrl } }).displayUrl).toBe(failedUrl);
    expect(savedMealImageUrls({ mealData: { imageUrl: "data:image/jpeg;base64,unsafe" } }).displayUrl).toBeNull();
  });
});