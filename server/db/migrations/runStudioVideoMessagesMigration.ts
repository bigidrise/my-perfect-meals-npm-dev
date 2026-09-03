import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Creates the Studio video message record and its temporary private media
 * child. It is idempotent because both development and production boot paths
 * run it, including upgrades from early video-message schema revisions.
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
      deletion_attempts INTEGER NOT NULL DEFAULT 0,
      deletion_claim_token TEXT,
      deletion_lease_expires_at TIMESTAMPTZ,
      last_deletion_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    ALTER TABLE studio_video_media
      ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS object_key TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
      ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
      ADD COLUMN IF NOT EXISTS temporary_derivative_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS watch_progress JSONB,
      ADD COLUMN IF NOT EXISTS watch_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deletion_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS deletion_claim_token TEXT,
      ADD COLUMN IF NOT EXISTS deletion_lease_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_deletion_error TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'studio_video_media_message_id_client_notes_id_fkey'
      ) THEN
        ALTER TABLE studio_video_media
          DROP CONSTRAINT studio_video_media_message_id_client_notes_id_fkey;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'studio_video_media_message_id_studio_video_messages_id_fkey'
      ) THEN
        ALTER TABLE studio_video_media
          ADD CONSTRAINT studio_video_media_message_id_studio_video_messages_id_fkey
          FOREIGN KEY (message_id) REFERENCES studio_video_messages(id) ON DELETE CASCADE NOT VALID;
      END IF;
    END;
    $$
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
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studio_video_media_purge
      ON studio_video_media (state, expires_at)
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION prevent_studio_video_transcript_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM studio_video_media
        WHERE message_id = OLD.id
          AND state IN (
            'expiration_pending',
            'expired',
            'deleting',
            'deletion_failed',
            'deleted'
          )
      ) THEN
        RAISE EXCEPTION
          'Completed Studio video transcript cannot change after expiration begins';
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  await db.execute(sql`
    DROP TRIGGER IF EXISTS studio_video_transcript_immutable_after_expiration
      ON client_notes
  `);
  await db.execute(sql`
    DROP TRIGGER IF EXISTS studio_video_transcript_immutable_after_expiration
      ON studio_video_messages
  `);
  await db.execute(sql`
    CREATE TRIGGER studio_video_transcript_immutable_after_expiration
      BEFORE UPDATE OF transcript, transcript_status, transcribed_at
      ON studio_video_messages
      FOR EACH ROW
      WHEN (
        OLD.transcript IS DISTINCT FROM NEW.transcript
        OR OLD.transcript_status IS DISTINCT FROM NEW.transcript_status
        OR OLD.transcribed_at IS DISTINCT FROM NEW.transcribed_at
      )
      EXECUTE FUNCTION prevent_studio_video_transcript_mutation()
  `);

  const { runStudioMessageViewerDeletionMigration } = await import("./runStudioMessageViewerDeletionMigration");
  await runStudioMessageViewerDeletionMigration();
  console.log("✅ Studio Video Messages migration complete");
}