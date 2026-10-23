import crypto from "crypto";

// These tests must never initialize a real database, generator, or storage client.
jest.mock("../db", () => ({
  db: { select: jest.fn(), update: jest.fn(), insert: jest.fn(), delete: jest.fn() },
}));
jest.mock("../services/mealImageGenerator", () => ({
  invalidateMealImageCache: jest.fn(async () => undefined),
  generateMealImageUnified: jest.fn(),
}));
jest.mock("../services/imageLifecycle", () => ({
  processMealImageForSave: jest.fn(),
}));
jest.mock("../services/savedImageVerification", () => ({
  checkSavedImageDelivery: jest.fn(),
  verifyRecoveryPhotograph: jest.fn(),
}));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: jest.fn() }));
jest.mock("../middleware/rateLimit", () => ({ createApiRateLimit: () => jest.fn() }));

import { db } from "../db";
import { savedMeals } from "@shared/schema";
import { mediaAssets } from "../db/schema/mediaAssets";
import { mealImageRecoveryJobs } from "../db/schema/mealImageRecoveryJobs";
import {
  getMealImageRecoveryStatus,
  resumePendingMealImageRecoveries,
  runControlledMealImageRecoveryJob,
  queueMealImageRecovery,
  CONTROLLED_MEAL_IMAGE_REPAIR,
} from "../services/mealImageRecovery";
import { generateMealImageUnified, invalidateMealImageCache } from "../services/mealImageGenerator";
import { processMealImageForSave } from "../services/imageLifecycle";
import { isFirstPartyPermanentImageUrl } from "@shared/mediaImageUrls";
import { checkSavedImageDelivery, verifyRecoveryPhotograph } from "../services/savedImageVerification";
import { savedMealImageDelivery } from "../routes/savedMealImageDelivery";
import { mealImagesRouter } from "../routes/mealImages";

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
  jest.resetAllMocks();
  (db.insert as jest.Mock).mockImplementation(() => { throw new Error("Unexpected database insert"); });
  (db.delete as jest.Mock).mockImplementation(() => { throw new Error("Unexpected database delete"); });
  jest.mocked(checkSavedImageDelivery).mockResolvedValue({ status: "unavailable", reason: "missing" });
  jest.mocked(verifyRecoveryPhotograph).mockResolvedValue(true);
  jest.mocked(invalidateMealImageCache).mockResolvedValue(undefined);
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
  await runControlledMealImageRecoveryJob(job.id, CONTROLLED_MEAL_IMAGE_REPAIR);
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
    await runControlledMealImageRecoveryJob(job.id, CONTROLLED_MEAL_IMAGE_REPAIR);
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
      await runControlledMealImageRecoveryJob(job.id, CONTROLLED_MEAL_IMAGE_REPAIR);
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

describe("viewing and startup never authorize recovery", () => {
  function expectNoEffects() {
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(generateMealImageUnified).not.toHaveBeenCalled();
    expect(invalidateMealImageCache).not.toHaveBeenCalled();
    expect(processMealImageForSave).not.toHaveBeenCalled();
    expect(meal).toEqual(originalMeal);
  }

  it.each(["pending", "processing"])("leaves old %s jobs untouched during startup", async status => {
    job.status = status;
    await resumePendingMealImageRecoveries();
    expect(db.select).not.toHaveBeenCalled();
    expect(job.status).toBe(status);
    expectNoEffects();
  });

  it("refuses queue and worker calls without server-only approval, before database access", async () => {
    expect(await queueMealImageRecovery({
      userId: job.userId, savedMealId: meal.id, mediaAssetId: asset.id, imageUrl: originalUrl,
    })).toMatchObject({ accepted: false });
    await runControlledMealImageRecoveryJob(job.id);
    await runControlledMealImageRecoveryJob(job.id, "controlled-meal-image-repair" as any);
    expect(db.select).not.toHaveBeenCalled();
    expectNoEffects();
  });

  it("keeps the HTTP recovery route fail-closed even with forged approval", async () => {
    const route = mealImagesRouter.stack.find(layer => layer.route?.path === "/meal-images/recover")!.route!;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await route.stack[route.stack.length - 1].handle({
      body: { approved: true, approval: "controlled-meal-image-repair", imageUrl: originalUrl },
      authUser: { id: job.userId },
    } as any, response as any, jest.fn());
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ accepted: false }));
    expectNoEffects();
  });

  it.each([
    { status: "unavailable", reason: "missing" },
    { status: "retry", imageUrl: originalUrl },
    { status: "recovered", imageUrl: replacementUrl },
  ] as const)("delivery response $status never writes, queues, invalidates or generates", async decision => {
    jest.mocked(checkSavedImageDelivery).mockResolvedValue(decision);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await savedMealImageDelivery({
      body: { savedMealId: meal.id, mediaAssetId: asset.id, imageUrl: originalUrl },
      authUser: { id: job.userId },
    } as any, response as any);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining(decision));
    expectNoEffects();
  });

  it("failed diagnostic storage checks remain read-only", async () => {
    jest.mocked(checkSavedImageDelivery).mockRejectedValue(new Error("Synthetic storage unavailable"));
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await savedMealImageDelivery({
      body: { savedMealId: meal.id, mediaAssetId: asset.id, imageUrl: originalUrl },
      authUser: { id: job.userId },
    } as any, response as any);
    expect(response.status).toHaveBeenCalledWith(503);
    expectNoEffects();
  });

  it("rejects a stale or foreign media relationship before probing", async () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await savedMealImageDelivery({
      body: { savedMealId: meal.id, mediaAssetId: "foreign-asset", imageUrl: originalUrl },
      authUser: { id: job.userId },
    } as any, response as any);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(checkSavedImageDelivery).not.toHaveBeenCalled();
    expectNoEffects();
  });

  it.each([
    { status: "retry", imageUrl: originalUrl },
    { status: "recovered", imageUrl: replacementUrl },
    { status: "unavailable", reason: "unsupported" },
  ] as const)("requires confirmed absence before a controlled queue operation: $status", async decision => {
    jest.mocked(checkSavedImageDelivery).mockResolvedValue(decision);
    expect(await queueMealImageRecovery({
      userId: job.userId, savedMealId: meal.id, mediaAssetId: asset.id, imageUrl: originalUrl,
    }, CONTROLLED_MEAL_IMAGE_REPAIR)).toMatchObject({ accepted: false });
    expectNoEffects();
  });

  it("does not invalidate or generate when the worker cannot confirm original absence", async () => {
    jest.mocked(checkSavedImageDelivery).mockResolvedValue({ status: "retry", imageUrl: originalUrl });
    await expectFailedRecoveryPreservesMeal();
    expect(generateMealImageUnified).not.toHaveBeenCalled();
    expect(invalidateMealImageCache).not.toHaveBeenCalled();
  });

  it("rejects a replacement that fails independent byte verification before persistence", async () => {
    jest.mocked(verifyRecoveryPhotograph).mockResolvedValue(false);
    await expectFailedRecoveryPreservesMeal();
    expect(processMealImageForSave).not.toHaveBeenCalled();
  });

  it("rejects a persisted replacement that fails independent byte verification", async () => {
    jest.mocked(verifyRecoveryPhotograph).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expectFailedRecoveryPreservesMeal();
  });

  it("preserves the original when it becomes accessible during controlled generation", async () => {
    jest.mocked(checkSavedImageDelivery)
      .mockResolvedValueOnce({ status: "unavailable", reason: "missing" })
      .mockResolvedValueOnce({ status: "retry", imageUrl: originalUrl });
    await expectFailedRecoveryPreservesMeal();
  });
});
