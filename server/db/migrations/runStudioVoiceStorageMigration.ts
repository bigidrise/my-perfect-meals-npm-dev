import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Voice records predate the private Studio media store. Mark those existing
 * rows as legacy S3 by default, while new writes explicitly persist "replit".
 * This migration is additive and intentionally does not touch object data.
 */
export async function runStudioVoiceStorageMigration(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE client_notes
      ADD COLUMN IF NOT EXISTS audio_storage_backend TEXT NOT NULL DEFAULT 's3_legacy'
  `);
  console.log("✅ Studio voice storage migration complete");
}