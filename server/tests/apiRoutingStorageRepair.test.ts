import fs from "fs";
import path from "path";
import {
  assertCanonicalMealImageWriteBucket,
  MEAL_IMAGE_BUCKET_ID,
  publicMealImageUrl,
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

  test("new meal-image URLs and write targets use only the canonical bucket", () => {
    expect(publicMealImageUrl("meal-images/salmon-thumb.jpg"))
      .toBe(`/public-objects/${MEAL_IMAGE_BUCKET_ID}/meal-images/salmon-thumb.jpg`);
    expect(assertCanonicalMealImageWriteBucket(MEAL_IMAGE_BUCKET_ID))
      .toBe(MEAL_IMAGE_BUCKET_ID);
    expect(() => assertCanonicalMealImageWriteBucket(LEGACY_E02A)).toThrow(
      "cannot be used for meal-image writes",
    );
    expect(() => assertCanonicalMealImageWriteBucket(LEGACY_2A68)).toThrow(
      "cannot be used for meal-image writes",
    );
  });

  test("only the two retired buckets remap on read", () => {
    expect(resolveMealImageReadBucket(LEGACY_E02A)).toBe(MEAL_IMAGE_BUCKET_ID);
    expect(resolveMealImageReadBucket(LEGACY_2A68)).toBe(MEAL_IMAGE_BUCKET_ID);

    const unknownBucket = "replit-objstore-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(resolveMealImageReadBucket(unknownBucket)).toBe(unknownBucket);
  });

  test("all full-health handlers reject a configured bucket other than canonical", () => {
    for (const sourceFile of ["../index.ts", "../prod.ts", "../routes.ts"]) {
      const source = fs.readFileSync(path.resolve(__dirname, sourceFile), "utf8");
      expect(source).toContain("bucketId !== MEAL_IMAGE_BUCKET_ID");
      expect(source).toContain("active meal-image bucket must be canonical");
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