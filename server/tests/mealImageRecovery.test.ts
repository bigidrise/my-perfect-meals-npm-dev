import crypto from "crypto";

// These tests must never initialize a real database, generator, or storage client.
jest.mock("../db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("../services/mealImageGenerator", () => ({
  invalidateMealImageCache: jest.fn(async () => undefined),
  generateMealImageUnified: jest.fn(),
}));
jest.mock("../services/imageLifecycle", () => ({
  processMealImageForSave: jest.fn(),
}));

import { db } from "../db";
import { savedMeals } from "@shared/schema";
import { mediaAssets } from "../db/schema/mediaAssets";
import { mealImageRecoveryJobs } from "../db/schema/mealImageRecoveryJobs";
import {
  getMealImageRecoveryStatus,
  resumePendingMealImageRecoveries,
} from "../services/mealImageRecovery";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { processMealImageForSave } from "../services/imageLifecycle";
import { isFirstPartyPermanentImageUrl } from "@shared/mediaImageUrls";

const originalUrl = "/public-objects/replit-objstore-test/meal-images/original.jpg";
const replacementUrl = "/public-objects/replit-objstore-test/meal-images/recovered.jpg";
const originalMeal = {
  id: "synthetic-meal",
  title: "Synthetic Meal",
  sourceType: "meal",
  mediaAssetId: "original-asset",
  mealData: {
    imageUrl: originalUrl,
    ingredients: [{ name: "carrots" }],
    description: "Preserve the full saved recipe.",
    calories: 250,
  },
};

type TestRecord = Record<string, any>;
let meal: typeof originalMeal;
let job: TestRecord;
let asset: TestRecord;
let writes: Array<{ table: unknown; values: TestRecord }>;

// Match Drizzle's selected columns, rather than returning extra fixture fields.
function project(record: TestRecord, selection?: TestRecord) {
  return selection
    ? Object.fromEntries(Object.keys(selection).map(key => [key, record[key]]))
    : { ...record };
}

beforeEach(() => {
  jest.clearAllMocks();
  meal = structuredClone(originalMeal);
  asset = { id: "original-asset", thumbnailUrl: originalUrl, displayUrl: originalUrl };
  job = {
    id: "synthetic-job",
    userId: "synthetic-owner",
    savedMealId: meal.id,
    assetId: asset.id,
    reportedUrl: originalUrl,
    recipeFingerprint: crypto.createHash("sha256").update("synthetic meal|meal|carrots").digest("hex"),
    status: "pending",
    resultImageUrl: null,
    error: null,
  };
  writes = [];
  (db.select as jest.Mock).mockImplementation((selection?: TestRecord) => {
    let table: unknown;
    const chain = {
      from(value: unknown) { table = value; return chain; },
      where() { return chain; },
      limit: async () => {
        if (table === savedMeals) return [project(meal, selection)];
        if (table === mediaAssets) return [project(asset, selection)];
        if (table === mealImageRecoveryJobs) {
          // Status reads select status; the worker scan selects only pending IDs.
          if (selection?.status) return [project(job, selection)];
          return job.status === "pending" ? [project(job, selection)] : [];
        }
        throw new Error("Unexpected database table in recovery test");
      },
    };
    return chain;
  });
  (db.update as jest.Mock).mockImplementation((table: unknown) => {
    let values: TestRecord;
    const chain = {
      set(value: TestRecord) { values = value; return chain; },
      where() { return chain; },
      returning: async (selection?: TestRecord) => {
        writes.push({ table, values });
        if (table === mealImageRecoveryJobs) {
          job = { ...job, ...values };
          return [project(job, selection)];
        }
        if (table === savedMeals) {
          meal = { ...meal, ...values };
          return [project(meal, selection)];
        }
        throw new Error("Unexpected database write in recovery test");
      },
    };
    return chain;
  });
  jest.mocked(generateMealImageUnified).mockResolvedValue(replacementUrl);
  jest.mocked(processMealImageForSave).mockResolvedValue({
    imageUrl: replacementUrl,
    mediaAssetId: "replacement-asset",
    mediaAsset: null,
    imagePending: false,
    ingestionAttempted: false,
  });
});

async function expectFailedRecoveryPreservesMeal() {
  await resumePendingMealImageRecoveries();
  expect(meal).toEqual(originalMeal);
  expect(asset).toEqual({ id: "original-asset", thumbnailUrl: originalUrl, displayUrl: originalUrl });
  expect(writes.some(write => write.table === savedMeals || write.table === mediaAssets)).toBe(false);
  expect(writes.some(write => write.values.status === "ready")).toBe(false);
  expect(job).toMatchObject({ status: "failed", resultImageUrl: null });
  expect(job.error).toEqual(expect.any(String));
  expect(await getMealImageRecoveryStatus(job.id, job.userId)).toEqual({
    status: "failed",
    error: job.error,
  });
}

describe("saved photograph recovery results", () => {
  it("replaces the reference only after a successful photograph is persisted", async () => {
    await resumePendingMealImageRecoveries();
    expect(processMealImageForSave).toHaveBeenCalledWith(replacementUrl, meal.title);
    expect(meal).toEqual({
      ...originalMeal,
      mediaAssetId: "replacement-asset",
      mealData: { ...originalMeal.mealData, imageUrl: replacementUrl },
    });
    expect(job).toMatchObject({ status: "ready", resultImageUrl: replacementUrl, error: null });
    expect(await getMealImageRecoveryStatus(job.id, job.userId)).toEqual({
      status: "ready", imageUrl: replacementUrl,
    });
  });

  it.each([
    "/images/fallback/pasta.svg",
    "/images/fallback/salad.svg",
    "/images/fallback/meal.svg",
    "/images/fallback/dessert.svg?version=1",
    "/images/fallback/meal.svg#preview",
  ])("rejects generated fallback %s before persistence and preserves the original", async url => {
    jest.mocked(generateMealImageUnified).mockResolvedValue(url);
    await expectFailedRecoveryPreservesMeal();
    expect(processMealImageForSave).not.toHaveBeenCalled();
    expect(job.error).toBe("Image recovery did not produce a permanent non-fallback image");
  });

  it("rejects a fallback returned by persistence before replacing the association", async () => {
    jest.mocked(processMealImageForSave).mockResolvedValue({
      imageUrl: "/images/fallback/pasta.svg",
      mediaAssetId: "fallback-asset",
      mediaAsset: null,
      imagePending: false,
      ingestionAttempted: false,
    });
    await expectFailedRecoveryPreservesMeal();
    expect(job.error).toBe("Regenerated image could not be persisted");
  });

  it("preserves references and records failure when generation throws", async () => {
    jest.mocked(generateMealImageUnified).mockRejectedValue(new Error("Synthetic generator unavailable"));
    await expectFailedRecoveryPreservesMeal();
    expect(processMealImageForSave).not.toHaveBeenCalled();
  });

  it("preserves references and records failure when persistence throws", async () => {
    jest.mocked(processMealImageForSave).mockRejectedValue(new Error("Synthetic persistence unavailable"));
    await expectFailedRecoveryPreservesMeal();
  });

  it("does not report an already-recorded fallback result as ready or rewrite history", async () => {
    job.status = "ready";
    job.resultImageUrl = "/images/fallback/salad.svg";
    expect(await getMealImageRecoveryStatus(job.id, job.userId)).toEqual({
      status: "failed",
      error: "Image recovery did not produce a permanent non-fallback image",
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(meal).toEqual(originalMeal);
    expect(job.status).toBe("ready"); // Read-time status correction, not a live data migration.
  });

  it.each(["/images/meal-photo.jpg", "/assets/meal-photo.png"])(
    "retains support for non-fallback static photographs at %s", async url => {
      jest.mocked(generateMealImageUnified).mockResolvedValue(url);
      jest.mocked(processMealImageForSave).mockResolvedValue({
        imageUrl: url, mediaAssetId: "replacement-asset", mediaAsset: null,
        imagePending: false, ingestionAttempted: false,
      });
      await resumePendingMealImageRecoveries();
      expect(job).toMatchObject({ status: "ready", resultImageUrl: url });
      expect(meal.mealData.imageUrl).toBe(url);
    },
  );

  it("does not change the shared classifier used for intentional static illustrations elsewhere", () => {
    expect(isFirstPartyPermanentImageUrl("/images/fallback/pasta.svg")).toBe(true);
    expect(isFirstPartyPermanentImageUrl("/images/fallback/salad.svg")).toBe(true);
    expect(isFirstPartyPermanentImageUrl("/assets/intentional-illustration.svg")).toBe(true);
  });
});
