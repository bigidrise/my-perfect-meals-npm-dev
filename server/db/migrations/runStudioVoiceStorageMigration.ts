import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Voice records predate the private Studio media store. Mark those existing
 * rows as legacy S3 by default, while new writes explicitly persist "replit".
 * It also adds the durable claim lease used to recover transcription work after
 * a worker restart. This migration is additive and never touches object data.
 */
export async function runStudioVoiceStorageMigration(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE client_notes
      ADD COLUMN IF NOT EXISTS audio_storage_backend TEXT NOT NULL DEFAULT 's3_legacy'
  `);
  await db.execute(sql`
    ALTER TABLE tablet_voice_jobs
      ADD COLUMN IF NOT EXISTS processing_claim_token TEXT,
      ADD COLUMN IF NOT EXISTS processing_lease_expires_at TIMESTAMPTZ
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_client_notes_voice_recovery
      ON client_notes (content_type, transcript_status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tablet_voice_jobs_processing_lease
      ON tablet_voice_jobs (status, processing_lease_expires_at)
  `);
  console.log("✅ Studio voice storage and recovery migration complete");
}
