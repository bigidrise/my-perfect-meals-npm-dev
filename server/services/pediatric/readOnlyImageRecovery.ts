import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { loadOwnedActiveChildProfile } from "./authoritativeChildAccess";
import { validateMealImageAuthority } from "../mealImageAuthority";

/** Compatibility URL, now strictly a read of the parent's original saved image. */
export async function recoverOriginalPediatricImage(req: Request, res: Response) {
  const userId = getAuthUserId(req);
  const childId = req.body?.childProfileId;
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  if (typeof childId !== "string" || !childId) {
    return res.status(400).json({ error: "Child profile required" });
  }
  try {
    const child = await loadOwnedActiveChildProfile(userId, childId);
    if (!child) return res.status(404).json({ error: "Saved recipe not found" });
    const result = await db.execute(sql`
      SELECT id, image_url, recipe_data
      FROM mpb_generated_meals
      WHERE id = ${req.params.mealId} AND user_id = ${userId}
        AND child_profile_id = ${childId}
      LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (!row) return res.status(404).json({ error: "Saved recipe not found" });
    const authority = await validateMealImageAuthority(row.image_url);
    if (authority.status !== "available") {
      return res.status(409).json({
        imagePersisted: false, code: "ORIGINAL_IMAGE_UNAVAILABLE",
        error: "The original photograph could not be retrieved. Your recipe and image reference were preserved; no replacement was generated.",
      });
    }
    return res.json({
      imageUrl: row.image_url, imagePersisted: true,
      ...(row.recipe_data?._imageGeneration ? { imageGeneration: row.recipe_data._imageGeneration } : {}),
    });
  } catch (error) {
    return res.status(503).json({
      imagePersisted: false, error: "The original image is temporarily unavailable. No replacement was generated.",
    });
  }
}
