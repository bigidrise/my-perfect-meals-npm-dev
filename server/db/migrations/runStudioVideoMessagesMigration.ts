import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Creates the private Studio video message records. This is deliberately
 * idempotent because both development and production boot paths run it.
 */
export async function runStudioVideoMessagesMigration(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_video_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
      client_user_id TEXT NOT NULL,
      author_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      sender TEXT NOT NULL CHECK (sender IN ('client', 'pro')),
      visibility TEXT NOT NULL DEFAULT 'shared_with_client',
      content_type TEXT NOT NULL DEFAULT 'video',
      body TEXT NOT NULL DEFAULT 'Video message',
      transcript TEXT,
      transcript_status TEXT NOT NULL DEFAULT 'completed',
      transcribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_video_media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL UNIQUE REFERENCES studio_video_messages(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'draft',
      object_key TEXT,
      mime_type TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL,
      temporary_derivative_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      watch_progress JSONB,
      watch_completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      moderation_status TEXT NOT NULL DEFAULT 'approved',
      moderated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studio_video_messages_studio_client
      ON studio_video_messages (studio_id, client_user_id, created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studio_video_media_state
      ON studio_video_media (state)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studio_video_media_expires
      ON studio_video_media (expires_at)
  `);
  console.log("✅ Studio Video Messages migration complete");
}