import { sql } from "drizzle-orm";
import { db } from "../../db";
import { loadOwnedActiveChildProfile } from "./authoritativeChildAccess";
import { generatePediatricRecipeImage } from "./recipeImage";
import { processMealImageForSave } from "../imageLifecycle";
import { buildPediatricImageContext, type PediatricImageGeneration } from "../../../shared/pediatricMealImage";
import { createManualPediatricImageHandler } from "./manualImageRecovery";

/** Reads and writes only the requested parent's exact saved meal. No schema or
 * background migration. Image recovery never replaces recipe/nutrition fields. */
export const regenerateSavedPediatricImage = createManualPediatricImageHandler({
  enabled: () => process.env.NODE_ENV === "development",
  async load(userId, mealId, childId) {
    const child = await loadOwnedActiveChildProfile(userId, childId);
    if (!child) return null;
    const result = await db.execute(sql`
      SELECT m.id, m.recipe_data, m.image_url
      FROM mpb_generated_meals m
      JOIN child_profiles c ON c.id::text = m.child_profile_id AND c.user_id = m.user_id
      WHERE m.id = ${mealId} AND m.user_id = ${userId}
        AND m.child_profile_id = ${childId} AND c.is_archived = false
        AND c.updated_at <= m.created_at
      LIMIT 1
    `);
    const row = result.rows[0] as any;
    if (!row) return null;
    const meta: PediatricImageGeneration | undefined = row.recipe_data?._imageGeneration;
    // If the child profile changed, generate a fresh governed recipe rather than
    // repairing an image under obsolete allergy, medical or developmental rules.
    if (meta?.pediatricContext?.stage !== buildPediatricImageContext({ stageKey: child.age_stage }).stage) return null;
    return { id: row.id, recipe: row.recipe_data, imageUrl: row.image_url };
  },
  async claim(userId, row, meta) {
    const result = await db.execute(sql`
      UPDATE mpb_generated_meals
      SET recipe_data = jsonb_set(recipe_data, '{_imageGeneration}', ${JSON.stringify(meta)}::jsonb)
      WHERE id = ${row.id} AND user_id = ${userId}
        AND recipe_data = ${JSON.stringify(row.recipe)}::jsonb
        AND image_url IS NOT DISTINCT FROM ${row.imageUrl}
        AND EXISTS (
          SELECT 1 FROM child_profiles c
          WHERE c.id::text = mpb_generated_meals.child_profile_id AND c.user_id = ${userId}
            AND c.is_archived = false AND c.updated_at <= mpb_generated_meals.created_at
        )
      RETURNING id
    `);
    return result.rows.length === 1;
  },
  async save(userId, row, imageUrl, meta) {
    const result = await db.execute(sql`
      UPDATE mpb_generated_meals
      SET image_url = ${imageUrl},
          recipe_data = jsonb_set(recipe_data, '{_imageGeneration}', ${JSON.stringify(meta)}::jsonb)
      WHERE id = ${row.id} AND user_id = ${userId}
        AND recipe_data->'_imageGeneration'->'manualRetry'->>'requestId' = ${meta.manualRetry!.requestId}
        AND EXISTS (
          SELECT 1 FROM child_profiles c
          WHERE c.id::text = mpb_generated_meals.child_profile_id AND c.user_id = ${userId}
            AND c.is_archived = false AND c.updated_at <= mpb_generated_meals.created_at
        )
      RETURNING id
    `);
    if (result.rows.length !== 1) throw new Error("Image retry claim changed");
  },
  async generate(row) {
    const prior = row.recipe._imageGeneration as PediatricImageGeneration;
    const result = await generatePediatricRecipeImage(row.recipe, {
      stageKey: prior.pediatricContext.stage,
      ...prior.pediatricContext,
    }, prior.sourceType, true, prior.pediatricContext);
    return result;
  },
  async persist(url, name) {
    // Only the existing lifecycle gate may attest that this photograph is durable.
    const result = await processMealImageForSave(url, name);
    return result.imageUrl ?? null;
  },
});
