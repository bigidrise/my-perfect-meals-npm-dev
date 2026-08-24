import fs from "fs";
import path from "path";
import {
  assertActiveMealImageWriteBucket,
  DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  PRODUCTION_MEAL_IMAGE_BUCKET_ID,
  publicMealImageUrl,
  resolveMealImageStorageContext,
  resolveMealImageReadBucket,
} from "../services/mealImageBucket";

const LEGACY_E02A = "replit-objstore-e02a723e-40e9-4d89-9c0e-05adfa185d2d";
const LEGACY_2A68 = "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b";

describe("development routing and meal-image storage repair", () => {
  test("web API resolver always uses the browser's own origin", async () => {
    const { resolveApiBaseForRuntime } = await import(
      "../../client/src/lib/resolveApiBase"
    );

    for (const origin of [
      "https://app.myperfectmeals.com",
      "https://app.myperfectmeals.ai",
      "https://my-perfect-meals.replit.app",
      "https://preview-id.replit.dev",
    ]) {
      expect(resolveApiBaseForRuntime({ isNative: false, webOrigin: origin }))
        .toBe(origin);
    }
  });

  test("native API routing uses the approved production .com origin", async () => {
    const { resolveApiBaseForRuntime, NATIVE_PRODUCTION_API_ORIGIN } = await import(
      "../../client/src/lib/resolveApiBase"
    );

    expect(NATIVE_PRODUCTION_API_ORIGIN).toBe("https://app.myperfectmeals.com");
    expect(resolveApiBaseForRuntime({
      isNative: true,
      webOrigin: "https://app.myperfectmeals.ai",
    })).toBe("https://app.myperfectmeals.com");
  });

  test("DEV always writes and serves images from its attached bucket", () => {
    const devContext = resolveMealImageStorageContext({
      nodeEnv: "development",
      configuredBucketId: PRODUCTION_MEAL_IMAGE_BUCKET_ID,
    });

    expect(devContext).toEqual({
      environment: "development",
      bucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
    });
    expect(publicMealImageUrl("meal-images/salmon-thumb.jpg", devContext))
      .toBe(`/public-objects/${DEVELOPMENT_MEAL_IMAGE_BUCKET_ID}/meal-images/salmon-thumb.jpg`);
    expect(assertActiveMealImageWriteBucket(DEVELOPMENT_MEAL_IMAGE_BUCKET_ID, devContext))
      .toBe(DEVELOPMENT_MEAL_IMAGE_BUCKET_ID);
    expect(() => assertActiveMealImageWriteBucket(PRODUCTION_MEAL_IMAGE_BUCKET_ID, devContext))
      .toThrow("active bucket");
  });

  test("production requires its exact configured bucket and remaps only its legacy reads", () => {
    const productionContext = resolveMealImageStorageContext({
      nodeEnv: "production",
      configuredBucketId: PRODUCTION_MEAL_IMAGE_BUCKET_ID,
    });
    expect(productionContext).toEqual({
      environment: "production",
      bucketId: PRODUCTION_MEAL_IMAGE_BUCKET_ID,
    });
    expect(resolveMealImageReadBucket(LEGACY_E02A, productionContext))
      .toBe(PRODUCTION_MEAL_IMAGE_BUCKET_ID);
    expect(resolveMealImageReadBucket(LEGACY_2A68, productionContext))
      .toBe(PRODUCTION_MEAL_IMAGE_BUCKET_ID);

    const unknownBucket = "replit-objstore-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(resolveMealImageReadBucket(unknownBucket, productionContext)).toBe(unknownBucket);
    expect(() => resolveMealImageStorageContext({
      nodeEnv: "production",
      configuredBucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
    })).toThrow("canonical production bucket");
  });

  test("DEV keeps legacy URLs unchanged and all health handlers resolve the active context", () => {
    const devContext = resolveMealImageStorageContext({ nodeEnv: "development" });
    expect(resolveMealImageReadBucket(LEGACY_E02A, devContext)).toBe(LEGACY_E02A);
    expect(resolveMealImageReadBucket(LEGACY_2A68, devContext)).toBe(LEGACY_2A68);

    for (const sourceFile of ["../index.ts", "../prod.ts", "../routes.ts"]) {
      const source = fs.readFileSync(path.resolve(__dirname, sourceFile), "utf8");
      expect(source).toContain("resolveMealImageStorageContext");
      expect(source).toContain("probeStorageCanary(storageContext.bucketId)");
      expect(source).not.toContain("bucketId !== MEAL_IMAGE_BUCKET_ID");
    }
  });

  test("production client source no longer contains retired Dev-1 or localhost API URLs", () => {
    const clientRoot = path.resolve(__dirname, "../../client/src");
    const files = listSourceFiles(clientRoot);
    const forbidden = /my-perfect-meals-npm-dev(?:-1)?\.replit\.app|localhost:5000\/api/;
    const violations = files
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => forbidden.test(fs.readFileSync(file, "utf8")));

    expect(violations).toEqual([]);
  });
});

function listSourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}