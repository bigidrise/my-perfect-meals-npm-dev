import { sql } from "drizzle-orm";

/**
 * Same per-conversation read watermark as the existing text/voice summary.
 * Video visibility matches the existing conversation listing. EXISTS avoids
 * multiplying messages through media or viewer-deletion records.
 * Called only behind the Development-only release boundary.
 */
export function developmentProUnreadQuery(studioId: string, viewerUserId: string) {
  return sql`
    WITH incoming_messages AS (
      SELECT cn.client_user_id, cn.studio_id, cn.created_at, cn.body
      FROM client_notes cn
      WHERE cn.studio_id = ${studioId}
        AND cn.entry_type = 'message'
        AND cn.sender = 'client'
        AND NOT EXISTS (
          SELECT 1 FROM studio_message_viewer_deletions hidden
          WHERE hidden.viewer_user_id = ${viewerUserId}
            AND hidden.client_note_id = cn.id
        )
      UNION ALL
      SELECT video.client_user_id, video.studio_id, video.created_at,
        'Video message'::text AS body
      FROM studio_video_messages video
      WHERE video.studio_id = ${studioId}
        AND video.sender = 'client'
        AND video.visibility = 'shared_with_client'
        AND EXISTS (
          SELECT 1 FROM studio_video_media media WHERE media.message_id = video.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM studio_message_viewer_deletions hidden
          WHERE hidden.viewer_user_id = ${viewerUserId}
            AND hidden.studio_video_message_id = video.id
        )
    )
    SELECT
      message.client_user_id AS "clientUserId",
      COUNT(*) FILTER (
        WHERE message.created_at > COALESCE(reads.last_read_at, '1970-01-01'::timestamptz)
      )::int AS "unreadCount",
      MAX(message.created_at) AS "lastMessageAt",
      (array_agg(message.body ORDER BY message.created_at DESC))[1] AS "lastMessageBody"
    FROM incoming_messages message
    LEFT JOIN pro_message_reads reads
      ON reads.studio_id = message.studio_id
      AND reads.client_user_id = message.client_user_id
    GROUP BY message.client_user_id
  `;
}
