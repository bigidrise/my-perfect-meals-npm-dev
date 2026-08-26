import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Adds per-viewer Studio history tombstones. This is deliberately additive:
 * existing messages remain visible to everyone until a participant hides one.
 */
export async function runStudioMessageViewerDeletionMigration(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_message_viewer_deletions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
      client_user_id TEXT NOT NULL,
      viewer_user_id TEXT NOT NULL,
      client_note_id UUID REFERENCES client_notes(id) ON DELETE CASCADE,
      studio_video_message_id UUID REFERENCES studio_video_messages(id) ON DELETE CASCADE,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT studio_message_viewer_deletions_one_message
        CHECK (
          (client_note_id IS NOT NULL AND studio_video_message_id IS NULL)
          OR
          (client_note_id IS NULL AND studio_video_message_id IS NOT NULL)
        )
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_message_viewer_client_note
      ON studio_message_viewer_deletions (viewer_user_id, client_note_id)
      WHERE client_note_id IS NOT NULL
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_message_viewer_video_message
      ON studio_message_viewer_deletions (viewer_user_id, studio_video_message_id)
      WHERE studio_video_message_id IS NOT NULL
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_studio_message_viewer_deletions_viewer
      ON studio_message_viewer_deletions (viewer_user_id, studio_id)
  `);
  console.log("✅ Studio participant message visibility migration complete");
}