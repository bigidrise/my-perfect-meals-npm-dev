// server/services/mealImageRecovery.ts
// Durable repair queue for confirmed-broken permanent saved-meal images.

import crypto from "crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { mediaAssets } from "../db/schema/mediaAssets";
import { mealImageRecoveryJobs } from "../db/schema/mealImageRecoveryJobs";
import { savedMeals } from "@shared/schema";
import { processMealImageForSave } from "./imageLifecycle";
import type { ImageSourceType, MealImageRequest } from "./mealImageGenerator";
import { isFirstPartyPermanentImageUrl } from "@shared/mediaImageUrls";

const JOB_LEASE_MS = 2 * 60 * 1000;
const JOB_LEASE_HEARTBEAT_MS = 30 * 1000;

type IngredientInput = string | { name?: string; item?: string };
type SavedMealForRecovery = {
  id: string;
  mealData: unknown;
  mediaAssetId: string | null;
  title: string;
  sourceType: string;
};

export interface MealImageRecoveryInput {
  userId: string;
  imageUrl: string;
  mealName?: string;
  ingredients?: IngredientInput[];
  sourceType?: string;
  mediaAssetId?: string;
  savedMealId?: string;
}

export interface MealImageRecoveryResult {
  status: "pending" | "ready" | "failed";
  imageUrl?: string;
  error?: string;
}

function isRecoverablePermanentImageUrl(url: string | undefined | null): boolean {
  return isFirstPartyPermanentImageUrl(url, process.env.S3_BUCKET_NAME);
}

function normalizeIngredients(ingredients: IngredientInput[] | undefined): string[] {
  return (ingredients ?? [])
    .map((ingredient) => typeof ingredient === "string"
      ? ingredient
      : (ingredient?.name || ingredient?.item || ""))
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

function normalizeSourceType(sourceType: string | undefined): ImageSourceType {
  if (sourceType === "beverage" || sourceType === "dessert" || sourceType === "snack") {
    return sourceType;
  }
  return "meal";
}

function recipeFingerprint(meal: SavedMealForRecovery): string {
  const ingredients = normalizeIngredients(((meal.mealData ?? {}) as Record<string, unknown>).ingredients as IngredientInput[] | undefined)
    .map((ingredient) => ingredient.toLowerCase())
    .sort();
  return crypto
    .createHash("sha256")
    .update(`${meal.title.trim().toLowerCase()}|${normalizeSourceType(meal.sourceType)}|${ingredients.join("|")}`)
    .digest("hex");
}

async function loadOwnedSavedMeal(savedMealId: string, userId: string): Promise<SavedMealForRecovery | undefined> {
  const [meal] = await db
    .select({
      id: savedMeals.id,
      mealData: savedMeals.mealData,
      mediaAssetId: savedMeals.mediaAssetId,
      title: savedMeals.title,
      sourceType: savedMeals.sourceType,
    })
    .from(savedMeals)
    .where(and(eq(savedMeals.id, savedMealId), eq(savedMeals.userId, userId)))
    .limit(1);
  return meal;
}

function toRecoveryResult(job: {
  status: string;
  resultImageUrl: string | null;
  error: string | null;
}): MealImageRecoveryResult {
  if (job.status === "ready") return { status: "ready", imageUrl: job.resultImageUrl ?? undefined };
  if (job.status === "failed") return { status: "failed", error: job.error ?? "Image recovery failed" };
  return { status: "pending" };
}

async function failJob(jobId: string, leaseToken: string, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error || "Image recovery failed")).slice(0, 300);
  const failed = await db.update(mealImageRecoveryJobs)
    .set({ status: "failed", error: message, leaseExpiresAt: null, updatedAt: new Date() })
    .where(and(
      eq(mealImageRecoveryJobs.id, jobId),
      eq(mealImageRecoveryJobs.status, "processing"),
      eq(mealImageRecoveryJobs.leaseToken, leaseToken),
    ))
    .returning({ id: mealImageRecoveryJobs.id });
  if (failed.length > 0) console.error(`[IMG-RECOVERY] ${jobId} failed: ${message}`);
}

async function runMealImageRecoveryJob(jobId: string): Promise<void> {
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + JOB_LEASE_MS);
  const [job] = await db.update(mealImageRecoveryJobs)
    .set({ status: "processing", leaseToken, leaseExpiresAt, updatedAt: now })
    .where(and(
      eq(mealImageRecoveryJobs.id, jobId),
      or(
        eq(mealImageRecoveryJobs.status, "pending"),
        and(
          eq(mealImageRecoveryJobs.status, "processing"),
          sql`${mealImageRecoveryJobs.leaseExpiresAt} < ${now}`,
        ),
      ),
    ))
    .returning();
  if (!job) return;

  const heartbeat = setInterval(() => {
    void db.update(mealImageRecoveryJobs)
      .set({ leaseExpiresAt: new Date(Date.now() + JOB_LEASE_MS), updatedAt: new Date() })
      .where(and(
        eq(mealImageRecoveryJobs.id, jobId),
        eq(mealImageRecoveryJobs.status, "processing"),
        eq(mealImageRecoveryJobs.leaseToken, leaseToken),
      ));
  }, JOB_LEASE_HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    const meal = await loadOwnedSavedMeal(job.savedMealId, job.userId);
    if (!meal || meal.mediaAssetId !== job.assetId) {
      throw new Error("Saved meal image changed before recovery began");
    }
    if (recipeFingerprint(meal) !== job.recipeFingerprint) {
      throw new Error("Saved meal recipe changed before recovery began");
    }

    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, job.assetId)).limit(1);
    if (!asset || (asset.thumbnailUrl !== job.reportedUrl && asset.displayUrl !== job.reportedUrl)) {
      throw new Error("Saved meal no longer references the reported image URL");
    }

    const ingredients = normalizeIngredients(((meal.mealData ?? {}) as Record<string, unknown>).ingredients as IngredientInput[] | undefined);
    if (ingredients.length === 0) throw new Error("Saved recipe has no ingredients for image recovery");
    const sourceType = normalizeSourceType(meal.sourceType);
    const generator = await import("./mealImageGenerator");
    const request: MealImageRequest = { mealName: meal.title, ingredients, sourceType };
    await generator.invalidateMealImageCache(request);
    const imageUrl = await generator.generateMealImageUnified(meal.title, ingredients, sourceType);
    if (!isRecoverablePermanentImageUrl(imageUrl)) {
      throw new Error("Regeneration did not produce a permanent Object Storage URL");
    }

    const persisted = await processMealImageForSave(imageUrl, meal.title);
    if (!persisted.imageUrl || !persisted.mediaAssetId) {
      throw new Error("Regenerated image could not be persisted");
    }

    // Re-read immediately before write. The user may have edited this meal
    // while the generation was in flight; preserve the newest JSON and only
    // swap the image if its recipe contract and prior asset are unchanged.
    const latestMeal = await loadOwnedSavedMeal(job.savedMealId, job.userId);
    if (!latestMeal || latestMeal.mediaAssetId !== job.assetId || recipeFingerprint(latestMeal) !== job.recipeFingerprint) {
      throw new Error("Saved meal changed while recovery was running");
    }
    const latestData = (latestMeal.mealData ?? {}) as Record<string, unknown>;
    const replacement = await db.update(savedMeals)
      .set({ mediaAssetId: persisted.mediaAssetId, mealData: { ...latestData, imageUrl: persisted.imageUrl } })
      .where(and(
        eq(savedMeals.id, latestMeal.id),
        eq(savedMeals.userId, job.userId),
        eq(savedMeals.mediaAssetId, job.assetId),
        eq(savedMeals.title, latestMeal.title),
        eq(savedMeals.sourceType, latestMeal.sourceType),
        sql`${savedMeals.mealData} = ${JSON.stringify(latestData)}::jsonb`,
      ))
      .returning({ id: savedMeals.id });
    if (replacement.length === 0) throw new Error("Saved meal image changed while recovery was running");

    const completed = await db.update(mealImageRecoveryJobs)
      .set({
        status: "ready",
        resultImageUrl: persisted.imageUrl,
        error: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(mealImageRecoveryJobs.id, jobId),
        eq(mealImageRecoveryJobs.status, "processing"),
        eq(mealImageRecoveryJobs.leaseToken, leaseToken),
      ))
      .returning({ id: mealImageRecoveryJobs.id });
    if (completed.length > 0) console.log(`[IMG-RECOVERY] Restored permanent image for "${meal.title}"`);
  } catch (error) {
    await failJob(jobId, leaseToken, error);
  } finally {
    clearInterval(heartbeat);
  }
}

/** Queue one authenticated recovery and return the durable job ID for polling. */
export async function queueMealImageRecovery(input: MealImageRecoveryInput): Promise<{
  accepted: boolean;
  recoveryId?: string;
  reason?: string;
}> {
  if (!isRecoverablePermanentImageUrl(input.imageUrl)) {
    return { accepted: false, reason: "Only permanent first-party image failures can be recovered" };
  }
  if (!input.savedMealId) {
    return { accepted: false, reason: "An owned saved meal with a media asset is required" };
  }

  const meal = await loadOwnedSavedMeal(input.savedMealId, input.userId);
  if (!meal?.mediaAssetId) return { accepted: false, reason: "An owned saved meal with a media asset is required" };
  if (input.mediaAssetId && input.mediaAssetId !== meal.mediaAssetId) {
    return { accepted: false, reason: "Image asset does not belong to this saved meal" };
  }

  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, meal.mediaAssetId)).limit(1);
  if (!asset) return { accepted: false, reason: "Image asset was not found" };
  if (asset.thumbnailUrl !== input.imageUrl && asset.displayUrl !== input.imageUrl) {
    return { accepted: false, reason: "Reported URL is not the saved meal's current image" };
  }
  const deliveryState = asset.validationStatus ?? "unvalidated";
  if (asset.status !== "failed" && deliveryState !== "failed" && deliveryState !== "unvalidated") {
    return { accepted: false, reason: "Image asset is already delivery-validated" };
  }

  const fingerprint = recipeFingerprint(meal);
  const [created] = await db.insert(mealImageRecoveryJobs)
    .values({
      userId: input.userId,
      savedMealId: meal.id,
      assetId: asset.id,
      reportedUrl: input.imageUrl,
      recipeFingerprint: fingerprint,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: mealImageRecoveryJobs.id });

  if (!created) {
    const [active] = await db.select({ id: mealImageRecoveryJobs.id })
      .from(mealImageRecoveryJobs)
      .where(and(
        eq(mealImageRecoveryJobs.savedMealId, meal.id),
        eq(mealImageRecoveryJobs.assetId, asset.id),
        inArray(mealImageRecoveryJobs.status, ["pending", "processing"]),
      ))
      .orderBy(desc(mealImageRecoveryJobs.updatedAt))
      .limit(1);
    if (active) return { accepted: true, recoveryId: active.id };
    return { accepted: false, reason: "Image recovery could not be queued" };
  }

  await db.update(mediaAssets)
    .set({
      status: "failed",
      validationStatus: "failed",
      processingError: "Permanent Object Storage URL failed to load in client",
      retryCount: sql`COALESCE(${mediaAssets.retryCount}, 0) + 1`,
      nextRetryAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, asset.id));

  void runMealImageRecoveryJob(created.id);
  return { accepted: true, recoveryId: created.id };
}

export async function getMealImageRecoveryStatus(
  recoveryId: string,
  userId: string,
): Promise<MealImageRecoveryResult | null> {
  const [job] = await db.select({
    status: mealImageRecoveryJobs.status,
    resultImageUrl: mealImageRecoveryJobs.resultImageUrl,
    error: mealImageRecoveryJobs.error,
  })
    .from(mealImageRecoveryJobs)
    .where(and(eq(mealImageRecoveryJobs.id, recoveryId), eq(mealImageRecoveryJobs.userId, userId)))
    .limit(1);
  return job ? toRecoveryResult(job) : null;
}

/** Restart-safe recovery worker: resumes pending jobs and expired leases on boot. */
export async function resumePendingMealImageRecoveries(): Promise<void> {
  const now = new Date();
  while (true) {
    const jobs = await db.select({ id: mealImageRecoveryJobs.id })
      .from(mealImageRecoveryJobs)
      .where(or(
        eq(mealImageRecoveryJobs.status, "pending"),
        and(eq(mealImageRecoveryJobs.status, "processing"), sql`${mealImageRecoveryJobs.leaseExpiresAt} < ${now}`),
      ))
      .limit(20);
    if (jobs.length === 0) return;
    await Promise.all(jobs.map((job) => runMealImageRecoveryJob(job.id)));
    if (jobs.length < 20) return;
  }
}

export const mealImageRecoveryInternals = {
  isRecoverablePermanentImageUrl,
  normalizeIngredients,
  normalizeSourceType,
  recipeFingerprint,
};