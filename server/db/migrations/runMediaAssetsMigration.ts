// server/db/migrations/runMediaAssetsMigration.ts
// Boot migration: creates media_assets table and adds media_asset_id to saved_meals.
// Idempotent — safe to run on every boot.

import { db } from "../../db";
import { sql } from "drizzle-orm";

export async function runMediaAssetsMigration(): Promise<void> {
  try {
    // 1. Create media_assets table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_assets (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status              TEXT NOT NULL DEFAULT 'pending',
        validation_status   TEXT DEFAULT 'unvalidated',

        thumbnail_object_key TEXT,
        thumbnail_url        TEXT,

        display_object_key   TEXT,
        display_url          TEXT,

        original_object_key  TEXT,

        source_type          TEXT,
        mime_type            TEXT DEFAULT 'image/png',

        processing_error     TEXT,
        retry_count          INTEGER DEFAULT 0,
        next_retry_at        TIMESTAMPTZ,

        created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // Existing installations already have media_assets from the original
    // lifecycle migration, so add the delivery-validation column separately.
    await db.execute(sql`
      ALTER TABLE media_assets
        ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'unvalidated'
    `);

    // 2. Add media_asset_id FK to saved_meals (IF NOT EXISTS is safe)
    await db.execute(sql`
      ALTER TABLE saved_meals
        ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id)
    `);

    // 3. Index for efficient media_asset joins
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS saved_meals_media_asset_idx
        ON saved_meals (media_asset_id)
        WHERE media_asset_id IS NOT NULL
    `);

    // 4. Durable background queue for broken permanent image recovery.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_image_recovery_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(64) NOT NULL,
        saved_meal_id UUID NOT NULL,
        asset_id UUID NOT NULL,
        reported_url TEXT NOT NULL,
        recipe_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result_image_url TEXT,
        error TEXT,
        lease_expires_at TIMESTAMPTZ,
        lease_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE meal_image_recovery_jobs
        ADD COLUMN IF NOT EXISTS lease_token TEXT
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS meal_image_recovery_jobs_owner_idx
        ON meal_image_recovery_jobs (user_id, created_at)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS meal_image_recovery_jobs_active_asset_uniq
        ON meal_image_recovery_jobs (saved_meal_id, asset_id)
        WHERE status IN ('pending', 'processing')
    `);

    console.log("✅ Media Assets migration complete (media_assets table, saved_meals.media_asset_id)");
  } catch (err: any) {
    console.error("❌ Media Assets migration failed:", err.message);
    throw err;
  }
}
