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

    console.log("✅ Media Assets migration complete (media_assets table, saved_meals.media_asset_id)");
  } catch (err: any) {
    console.error("❌ Media Assets migration failed:", err.message);
    throw err;
  }
}
