import type { Request, Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { savedMeals } from "@shared/schema";
import { mediaAssets } from "../db/schema/mediaAssets";
import { publicObjectPathFromUrl } from "../services/imageDeliveryRecovery";
import { checkSavedImageDelivery } from "../services/savedImageVerification";

/** Diagnostic only: no jobs, lifecycle updates, persistence or generation. */
export async function savedMealImageDelivery(req: Request, res: Response) {
  const parsed = z.object({
    imageUrl: z.string().min(1).max(2_048),
    savedMealId: z.string().min(1),
    mediaAssetId: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "An owned saved meal image is required" });
  const { imageUrl, savedMealId, mediaAssetId } = parsed.data;
  if (!publicObjectPathFromUrl(imageUrl)) {
    return res.status(400).json({ error: "Only first-party Object Storage URLs can be checked" });
  }
  try {
    const [meal] = await db.select({ id: savedMeals.id, mediaAssetId: savedMeals.mediaAssetId })
      .from(savedMeals).where(and(
        eq(savedMeals.id, savedMealId), eq(savedMeals.userId, req.authUser!.id),
      )).limit(1);
    if (!meal || meal.mediaAssetId !== mediaAssetId) {
      return res.status(404).json({ error: "Saved meal image was not found" });
    }
    const [asset] = await db.select({
      id: mediaAssets.id, thumbnailUrl: mediaAssets.thumbnailUrl,
      displayUrl: mediaAssets.displayUrl, originalObjectKey: mediaAssets.originalObjectKey,
    }).from(mediaAssets).where(eq(mediaAssets.id, mediaAssetId)).limit(1);
    if (!asset || (asset.thumbnailUrl !== imageUrl && asset.displayUrl !== imageUrl)) {
      return res.status(409).json({ error: "Reported URL is not the saved meal's current image" });
    }
    const decision = await checkSavedImageDelivery(imageUrl, asset);
    return res.json({ ...decision, retryAfterMs: decision.status === "retry" ? 1_000 : undefined });
  } catch {
    return res.status(503).json({ error: "Image delivery check temporarily unavailable", retryable: true });
  }
}
