import { db } from "../db";
import { sql } from "drizzle-orm";
import { transcribeVoiceBuffer, downloadVoiceFromS3, MAX_VOICE_DURATION_SEC } from "./tabletVoiceService";
import { moderateContent } from "./tabletModerationService";
import { logClientActivity } from "./activityLog";

const POLL_INTERVAL_MS = 8000;
const MAX_ATTEMPTS = 3;

async function processNextJob(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE tablet_voice_jobs
    SET status = 'processing', attempts = attempts + 1
    WHERE id = (
      SELECT id FROM tablet_voice_jobs
      WHERE status = 'pending' AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, note_id, attempts
  `);

  const job = result.rows[0] as any;
  if (!job) return;

  const { id: jobId, note_id: noteId, attempts } = job;

  try {
    const noteResult = await db.execute(sql`
      SELECT id, audio_object_key, audio_mime_type, entry_type, visibility,
             studio_id, client_user_id, author_user_id
      FROM client_notes WHERE id = ${noteId}
    `);
    const note = noteResult.rows[0] as any;
    if (!note?.audio_object_key) throw new Error("Note or audio key not found");

    const buffer = await downloadVoiceFromS3(note.audio_object_key);
    const mimeType = note.audio_mime_type || "audio/webm";

    const { transcript, durationSec } = await transcribeVoiceBuffer(buffer, mimeType);

    const modResult = moderateContent(transcript);
    const isSharedMessage = note.visibility === "shared_with_client";
    const moderationStatus = modResult.allowed ? "approved" : "blocked";
    const finalBody = modResult.allowed
      ? `🎤 Voice note (${durationSec}s)`
      : "[Voice note removed]";

    await db.execute(sql`
      UPDATE client_notes SET
        transcript        = ${transcript},
        transcript_status = 'completed',
        moderation_status = ${moderationStatus},
        audio_duration_sec = ${durationSec},
        body              = ${finalBody},
        transcribed_at    = NOW(),
        moderated_at      = NOW()
      WHERE id = ${noteId}
    `);

    if (!modResult.allowed && isSharedMessage) {
      logClientActivity(
        note.studio_id,
        note.client_user_id,
        note.author_user_id,
        "message_blocked",
        "message",
        noteId,
        {
          severity: modResult.severity,
          category: modResult.category,
          reason: modResult.reason,
          sender: "pro",
          type: "voice",
        }
      );
    }

    await db.execute(sql`
      UPDATE tablet_voice_jobs
      SET status = 'completed', processed_at = NOW()
      WHERE id = ${jobId}
    `);
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error";
    console.error(`[VoiceWorker] Job ${jobId} failed (attempt ${attempts}):`, errorMsg);

    const isFinal = attempts >= MAX_ATTEMPTS;
    await db.execute(sql`
      UPDATE tablet_voice_jobs
      SET status = ${isFinal ? "failed" : "pending"},
          last_error = ${errorMsg},
          processed_at = NOW()
      WHERE id = ${jobId}
    `);

    if (isFinal) {
      await db.execute(sql`
        UPDATE client_notes SET
          transcript_status = 'failed',
          body = '🎤 Voice note (transcript unavailable)'
        WHERE id = ${noteId}
      `);
    }
  }
}

let _started = false;

export function startVoiceJobWorker(): void {
  if (_started) return;
  _started = true;
  const run = async () => {
    try {
      await processNextJob();
    } catch (err) {
      console.error("[VoiceWorker] Unexpected poll error:", err);
    }
  };
  setInterval(run, POLL_INTERVAL_MS);
  console.log(`[VoiceWorker] Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}
