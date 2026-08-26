import { sql } from "drizzle-orm";
import { db } from "../db";

export type StudioHistoryMessageKind = "client_note" | "video_message";

type HideStudioMessageInput = {
  studioId: string;
  clientUserId: string;
  viewerUserId: string;
  messageId: string;
  kind: StudioHistoryMessageKind;
};

/**
 * Hides one shared Studio message only from the requesting participant. It
 * never deletes shared history, jobs, transcripts, or private media.
 */
export async function hideStudioMessageForViewer(
  input: HideStudioMessageInput,
): Promise<{ alreadyHidden: boolean }> {
  const insert = input.kind === "client_note"
    ? await db.execute(sql`
        INSERT INTO studio_message_viewer_deletions (
          studio_id, client_user_id, viewer_user_id, client_note_id
        )
        SELECT ${input.studioId}, ${input.clientUserId}, ${input.viewerUserId}, note.id
        FROM client_notes AS note
        WHERE note.id = ${input.messageId}
          AND note.studio_id = ${input.studioId}
          AND note.client_user_id = ${input.clientUserId}
          AND note.entry_type = 'message'
          AND note.visibility = 'shared_with_client'
        ON CONFLICT (viewer_user_id, client_note_id)
          WHERE client_note_id IS NOT NULL
          DO NOTHING
        RETURNING id
      `)
    : await db.execute(sql`
        INSERT INTO studio_message_viewer_deletions (
          studio_id, client_user_id, viewer_user_id, studio_video_message_id
        )
        SELECT ${input.studioId}, ${input.clientUserId}, ${input.viewerUserId}, message.id
        FROM studio_video_messages AS message
        WHERE message.id = ${input.messageId}
          AND message.studio_id = ${input.studioId}
          AND message.client_user_id = ${input.clientUserId}
          AND message.visibility = 'shared_with_client'
        ON CONFLICT (viewer_user_id, studio_video_message_id)
          WHERE studio_video_message_id IS NOT NULL
          DO NOTHING
        RETURNING id
      `);

  const rows = insert.rows ?? [];
  if (rows.length > 0) return { alreadyHidden: false };

  const exists = input.kind === "client_note"
    ? await db.execute(sql`
        SELECT 1
        FROM client_notes AS note
        WHERE note.id = ${input.messageId}
          AND note.studio_id = ${input.studioId}
          AND note.client_user_id = ${input.clientUserId}
          AND note.entry_type = 'message'
          AND note.visibility = 'shared_with_client'
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT 1
        FROM studio_video_messages AS message
        WHERE message.id = ${input.messageId}
          AND message.studio_id = ${input.studioId}
          AND message.client_user_id = ${input.clientUserId}
          AND message.visibility = 'shared_with_client'
        LIMIT 1
      `);
  if ((exists.rows ?? []).length === 0) {
    throw new Error("Studio message not found");
  }
  return { alreadyHidden: true };
}

export async function isStudioMessageHiddenForViewer(input: HideStudioMessageInput): Promise<boolean> {
  const result = input.kind === "client_note"
    ? await db.execute(sql`
        SELECT 1
        FROM studio_message_viewer_deletions
        WHERE studio_id = ${input.studioId}
          AND client_user_id = ${input.clientUserId}
          AND viewer_user_id = ${input.viewerUserId}
          AND client_note_id = ${input.messageId}
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT 1
        FROM studio_message_viewer_deletions
        WHERE studio_id = ${input.studioId}
          AND client_user_id = ${input.clientUserId}
          AND viewer_user_id = ${input.viewerUserId}
          AND studio_video_message_id = ${input.messageId}
        LIMIT 1
      `);
  return (result.rows ?? []).length > 0;
}