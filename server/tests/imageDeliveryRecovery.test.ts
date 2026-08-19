import {
  decideImageDeliveryRecovery,
  IMAGE_DELIVERY_RETRY_LIMIT,
  publicObjectPathFromUrl,
  publicObjectUrlForKey,
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