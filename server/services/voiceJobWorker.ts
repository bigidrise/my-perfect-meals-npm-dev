import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  transcribeVoiceBuffer,
  downloadVoiceForTranscription,
  MAX_VOICE_DURATION_SEC,
  resolveVoiceStorageBackend,
} from "./tabletVoiceService";
import { moderateContent } from "./tabletModerationService";
import { logClientActivity } from "./activityLog";
import { deleteStudioVideoFromS3 } from "./tabletVoiceService";
import { logAudit } from "../lib/auditLog";
import { finalizeStudioVideoDeletion } from "@shared/studioVideoMessages";
import { randomUUID } from "crypto";

const POLL_INTERVAL_MS = 8000;
const MAX_ATTEMPTS = 3;
const VOICE_RECOVERY_INTERVAL_MS = 60_000;
const VOICE_STUCK_GRACE_MS = 15 * 60_000;
const VOICE_JOB_LEASE_MS = 30 * 60_000;
const VOICE_JOB_LEASE_HEARTBEAT_MS = 5 * 60_000;
const STUDIO_VIDEO_PURGE_BATCH_SIZE = 25;
const STUDIO_VIDEO_PURGE_INTERVAL_MS = 60_000;
const STUDIO_VIDEO_DELETION_LEASE_MS = 30 * 60_000;
const STUDIO_VIDEO_LEASE_HEARTBEAT_MS = 5 * 60_000;

export type StudioVideoPurgeRow = {
  id: string;
  message_id: string;
  studio_id: string;
  client_user_id: string;
  author_user_id: string;
  state: string;
  object_key: string | null;
  temporary_derivative_keys: unknown;
  expires_at: Date | string;
  watch_completed_at: Date | string | null;
  transcript: string | null;
  transcript_status: string | null;
  deletion_claim_token: string;
};

export type StudioVideoPurgeDatabase = {
  // `db.execute` accepts Drizzle's SQL wrapper type and returns a thenable
  // query result. `any` keeps this small worker seam compatible with both the
  // real Drizzle database and deterministic test doubles.
  execute: (query: any) => Promise<{ rows?: unknown[] }>;
};

export type StudioVideoPurgeStorage = {
  deleteObject: (objectKey: string) => Promise<void>;
};

export type StudioVideoPurgeOptions = {
  database?: StudioVideoPurgeDatabase;
  storage?: StudioVideoPurgeStorage;
  now?: Date;
  batchSize?: number;
};

export type VoiceRecoveryDatabase = {
  execute: (query: any) => Promise<{ rows?: unknown[] }>;
};

export async function recoverStuckVoiceNotes(
  options: {
    database?: VoiceRecoveryDatabase;
    now?: Date;
    graceMs?: number;
  } = {},
): Promise<{ staleJobs: number; recoveredNotes: number }> {
  const database = options.database ?? db;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - (options.graceMs ?? VOICE_STUCK_GRACE_MS));
  const failureMessage = "🎤 Voice note (transcript unavailable — please ask the sender to record it again)";

  // A worker that died after claiming a job must not leave that job in
  // processing forever. Processing is guarded by a renewable claim lease, not
  // by the job's creation time: an old queued note can legitimately begin
  // work just before a recovery pass runs.
  const staleProcessing = await database.execute(sql`
    UPDATE tablet_voice_jobs AS job
    SET status = 'failed',
        last_error = 'Voice transcription job exceeded the recovery grace period',
        processed_at = NOW(),
        processing_claim_token = NULL,
        processing_lease_expires_at = NULL
    FROM client_notes AS note
    WHERE job.note_id = note.id
      AND job.status = 'processing'
      AND (job.processing_lease_expires_at IS NULL OR job.processing_lease_expires_at <= ${now})
      AND note.content_type = 'voice'
      AND note.transcript_status = 'pending'
    RETURNING job.note_id
  `);

  // Jobs for notes whose upload never produced an audio object are not
  // runnable. Mark them failed before evaluating the note below.
  await database.execute(sql`
    UPDATE tablet_voice_jobs AS job
    SET status = 'failed',
        last_error = 'Voice recording object is unavailable',
        processed_at = NOW()
    FROM client_notes AS note
    WHERE job.note_id = note.id
      AND (
        job.status = 'pending'
        OR (
          job.status = 'processing'
          AND (job.processing_lease_expires_at IS NULL OR job.processing_lease_expires_at <= ${now})
        )
      )
      AND job.created_at < ${cutoff}
      AND note.content_type = 'voice'
      AND note.transcript_status = 'pending'
      AND note.audio_object_key IS NULL
  `);

  // This also catches historical pending notes that have valid media but no
  // queued/runnable job. New writes are transactional, but recovery remains
  // safe for older or interrupted records.
  const recovered = await database.execute(sql`
    UPDATE client_notes AS note
    SET transcript_status = 'failed',
        body = ${failureMessage},
        updated_at = NOW()
    WHERE note.content_type = 'voice'
      AND note.transcript_status = 'pending'
      AND note.created_at < ${cutoff}
      AND (
        note.audio_object_key IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM tablet_voice_jobs AS job
          WHERE job.note_id = note.id
            AND (
              job.status = 'pending'
              OR (
                job.status = 'processing'
                AND job.processing_lease_expires_at > ${now}
              )
            )
        )
      )
    RETURNING note.id
  `);

  return {
    staleJobs: (staleProcessing.rows ?? []).length,
    recoveredNotes: (recovered.rows ?? []).length,
  };
}

function parseDerivativeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((key): key is string => typeof key === "string" && key.length > 0);
}

function storageKeysForRow(row: StudioVideoPurgeRow): string[] {
  return Array.from(new Set([
    ...(row.object_key ? [row.object_key] : []),
    ...parseDerivativeKeys(row.temporary_derivative_keys),
  ]));
}

function safeDeletionError(failedCount: number): string {
  return `${failedCount} Studio video storage object${failedCount === 1 ? "" : "s"} could not be deleted`;
}

function toIsoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function auditStudioVideoLifecycle(
  row: StudioVideoPurgeRow,
  action: "WRITE" | "DELETE",
  event: "expiration_reached" | "deletion_requested" | "media_deleted" | "deletion_failed",
  metadata: Record<string, unknown>,
): void {
  logAudit({
    actor: "system:studio-video-purge",
    target: row.client_user_id,
    action,
    resourceType: "studio_video_media",
    resourceId: row.id,
    table: "studio_video_media",
    field: "state,object_key,temporary_derivative_keys,deleted_at",
    meta: { event, ...metadata },
  });
}

async function renewStudioVideoDeletionLease(
  row: StudioVideoPurgeRow,
  database: StudioVideoPurgeDatabase,
  now: Date,
): Promise<boolean> {
  const leaseExpiresAt = new Date(now.getTime() + STUDIO_VIDEO_DELETION_LEASE_MS);
  const result = await database.execute(sql`
    UPDATE studio_video_media
    SET deletion_lease_expires_at = ${leaseExpiresAt},
        updated_at = NOW()
    WHERE id = ${row.id}
      AND state = 'deleting'
      AND deletion_claim_token = ${row.deletion_claim_token}
    RETURNING id
  `);
  return (result.rows ?? []).length > 0;
}

async function markStudioVideoDeletionFailed(
  row: StudioVideoPurgeRow,
  database: StudioVideoPurgeDatabase,
  error: string,
): Promise<boolean> {
  const result = await database.execute(sql`
    UPDATE studio_video_media
    SET state = 'deletion_failed',
        last_deletion_error = ${error},
        deletion_claim_token = NULL,
        deletion_lease_expires_at = NULL,
        updated_at = NOW()
    WHERE id = ${row.id}
      AND state = 'deleting'
      AND deletion_claim_token = ${row.deletion_claim_token}
    RETURNING id
  `);
  return (result.rows ?? []).length > 0;
}

/**
 * Purge one claimed Studio video. Storage is always cleaned before the
 * communication/media record is finalized. The final update deliberately does
 * not touch expires_at or watch_completed_at, so retries can never extend the
 * original viewing deadline.
 */
export async function purgeClaimedStudioVideo(
  row: StudioVideoPurgeRow,
  database: StudioVideoPurgeDatabase,
  storage: StudioVideoPurgeStorage,
  now = new Date(),
): Promise<"deleted" | "deletion_failed"> {
  // The batch claim can have happened moments earlier for another row. Renew
  // immediately before storage work so each item has its own full lease.
  if (!await renewStudioVideoDeletionLease(row, database, now)) {
    return "deletion_failed";
  }

  auditStudioVideoLifecycle(row, "DELETE", "deletion_requested", {
    attempt: "started",
  });

  if (
    row.transcript_status !== "completed" ||
    row.transcript === null ||
    !row.watch_completed_at
  ) {
    const error = "Completed transcript and watch timestamp are required before Studio video deletion";
    if (await markStudioVideoDeletionFailed(row, database, error)) {
      auditStudioVideoLifecycle(row, "DELETE", "deletion_failed", {
        reason: "transcript_not_retainable",
      });
    }
    return "deletion_failed";
  }

  const keys = storageKeysForRow(row);
  let leaseLost = false;
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void renewStudioVideoDeletionLease(row, database, new Date())
      .then((renewed) => {
        if (!renewed) leaseLost = true;
      })
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, STUDIO_VIDEO_LEASE_HEARTBEAT_MS);

  let results: PromiseSettledResult<void>[];
  try {
    results = await Promise.allSettled(
      keys.map((key) => storage.deleteObject(key)),
    );
  } finally {
    clearInterval(heartbeat);
  }

  if (leaseLost) return "deletion_failed";
  const failedCount = results.filter((result) => result.status === "rejected").length;

  if (failedCount > 0) {
    const error = safeDeletionError(failedCount);
    if (await markStudioVideoDeletionFailed(row, database, error)) {
      auditStudioVideoLifecycle(row, "DELETE", "deletion_failed", {
        failedObjectCount: failedCount,
        attemptedObjectCount: keys.length,
      });
    }
    return "deletion_failed";
  }

  // Reuse the shared state-machine contract immediately before persisting the
  // irreversible terminal state. It protects transcript retention and guards
  // against a stale/incorrect expiration timestamp even if a bad row entered
  // the table outside the normal playback flow.
  const finalization = finalizeStudioVideoDeletion({
    currentState: "deleting",
    now,
    expiresAt: toIsoTimestamp(row.expires_at),
    watchCompletedAt: toIsoTimestamp(row.watch_completed_at),
    transcript: {
      status: "completed",
      text: row.transcript,
      transcribedAt: null,
    },
  });

  const finalizedResult = await database.execute(sql`
    UPDATE studio_video_media AS media
    SET state = 'deleted',
        object_key = NULL,
        temporary_derivative_keys = '[]'::jsonb,
        deleted_at = COALESCE(deleted_at, ${finalization.deletedAt}),
        deletion_claim_token = NULL,
        deletion_lease_expires_at = NULL,
        last_deletion_error = NULL,
        updated_at = NOW()
    FROM studio_video_messages AS message
    WHERE media.id = ${row.id}
      AND media.message_id = message.id
      AND media.state = 'deleting'
      AND media.deletion_claim_token = ${row.deletion_claim_token}
      AND message.transcript_status = 'completed'
      AND message.transcript = ${row.transcript}
    RETURNING media.id
  `);
  if ((finalizedResult.rows ?? []).length === 0) {
    const error = "Transcript changed or deletion lease was lost before finalization";
    if (await markStudioVideoDeletionFailed(row, database, error)) {
      auditStudioVideoLifecycle(row, "DELETE", "deletion_failed", {
        reason: "transcript_changed_before_finalization",
      });
    }
    return "deletion_failed";
  }
  auditStudioVideoLifecycle(row, "DELETE", "media_deleted", {
    deletedObjectCount: keys.length,
  });
  return "deleted";
}

/**
 * Finds due records and claims them with SKIP LOCKED before touching storage.
 * A durable lease keeps a second worker from touching the same private media
 * while an active deletion is in progress. Expired leases are reclaimable
 * after a crash, and private Object Storage deletion is idempotent, making
 * that recovery safe.
 */
export async function purgeExpiredStudioVideos(
  options: StudioVideoPurgeOptions = {},
): Promise<{ claimed: number; deleted: number; failed: number }> {
  const database = options.database ?? db;
  const storage = options.storage ?? { deleteObject: deleteStudioVideoFromS3 };
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? STUDIO_VIDEO_PURGE_BATCH_SIZE));
  const claimToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + STUDIO_VIDEO_DELETION_LEASE_MS);

  // A manual delete can be interrupted before the private storage call
  // completes. Recover any expired claim regardless of watch state: a `ready`
  // video has no expiry timestamp, so it would otherwise remain permanently
  // unavailable. Keep its object references and transcript for a safe retry.
  await database.execute(sql`
    UPDATE studio_video_media
    SET state = 'deletion_failed',
        last_deletion_error = 'Studio video deletion lease expired before completion',
        deletion_claim_token = NULL,
        deletion_lease_expires_at = NULL,
        updated_at = NOW()
    WHERE state = 'deleting'
      AND (
        deletion_lease_expires_at IS NULL
        OR deletion_lease_expires_at <= ${now}
      )
  `);

  const expiredResult = await database.execute(sql`
    UPDATE studio_video_media AS media
    SET state = 'expired',
        updated_at = NOW()
    FROM studio_video_messages AS message
    WHERE media.message_id = message.id
      AND media.state = 'expiration_pending'
      AND media.expires_at IS NOT NULL
      AND media.expires_at <= ${now}
    RETURNING media.id, media.message_id, message.studio_id, message.client_user_id,
              message.author_user_id, media.state, media.object_key,
              media.temporary_derivative_keys, media.expires_at,
              media.watch_completed_at, NULL::text AS transcript,
              NULL::text AS transcript_status
  `);

  for (const rawRow of (expiredResult.rows ?? []) as StudioVideoPurgeRow[]) {
    auditStudioVideoLifecycle(rawRow, "WRITE", "expiration_reached", {
      lifecycleState: "expired",
    });
  }

  const claimedResult = await database.execute(sql`
    UPDATE studio_video_media AS media
    SET state = 'deleting',
        deletion_attempts = COALESCE(deletion_attempts, 0) + 1,
        deletion_claim_token = ${claimToken},
        deletion_lease_expires_at = ${leaseExpiresAt},
        last_deletion_error = NULL,
        updated_at = NOW()
    FROM (
      SELECT id
      FROM studio_video_media
      WHERE state IN ('expired', 'deletion_failed', 'deleting')
        AND expires_at IS NOT NULL
        AND expires_at <= ${now}
        AND (
          state <> 'deleting'
          OR deletion_lease_expires_at IS NULL
          OR deletion_lease_expires_at <= ${now}
        )
      ORDER BY expires_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    ) AS due
    WHERE media.id = due.id
    RETURNING media.id, media.message_id,
              (SELECT studio_id FROM studio_video_messages WHERE id = media.message_id) AS studio_id,
              (SELECT client_user_id FROM studio_video_messages WHERE id = media.message_id) AS client_user_id,
              (SELECT author_user_id FROM studio_video_messages WHERE id = media.message_id) AS author_user_id,
              media.state, media.object_key, media.temporary_derivative_keys,
              media.expires_at, media.watch_completed_at, media.deletion_claim_token,
              (SELECT transcript FROM studio_video_messages WHERE id = media.message_id) AS transcript,
              (SELECT transcript_status FROM studio_video_messages WHERE id = media.message_id) AS transcript_status
  `);

  const claimedRows = (claimedResult.rows ?? []) as StudioVideoPurgeRow[];
  // Start each item promptly. Each item immediately renews its own lease and
  // continues to heartbeat it while storage calls are in flight.
  const outcomes = await Promise.all(
    claimedRows.map((row) => purgeClaimedStudioVideo(row, database, storage, now)),
  );
  const deleted = outcomes.filter((outcome) => outcome === "deleted").length;
  const failed = outcomes.length - deleted;

  return { claimed: claimedRows.length, deleted, failed };
}

let _studioVideoPurgeStarted = false;

export function startStudioVideoPurgeWorker(): void {
  if (_studioVideoPurgeStarted) return;
  _studioVideoPurgeStarted = true;

  const run = async () => {
    try {
      const result = await purgeExpiredStudioVideos();
      if (result.claimed > 0) {
        console.log(`[StudioVideoPurge] Processed ${result.claimed} expired media (${result.deleted} deleted, ${result.failed} retryable failures)`);
      }
    } catch (err) {
      console.error("[StudioVideoPurge] Unexpected purge error:", err);
    }
  };

  void run();
  setInterval(run, STUDIO_VIDEO_PURGE_INTERVAL_MS);
  console.log(`[StudioVideoPurge] Started — polling every ${STUDIO_VIDEO_PURGE_INTERVAL_MS / 1000}s`);
}

async function processNextJob(): Promise<void> {
  const claimToken = randomUUID();
  const leaseExpiresAt = new Date(Date.now() + VOICE_JOB_LEASE_MS);
  const result = await db.execute(sql`
    UPDATE tablet_voice_jobs
    SET status = 'processing',
        attempts = attempts + 1,
        processing_claim_token = ${claimToken},
        processing_lease_expires_at = ${leaseExpiresAt}
    WHERE id = (
      SELECT job.id
      FROM tablet_voice_jobs AS job
      JOIN client_notes AS note ON note.id = job.note_id
      WHERE job.status = 'pending'
        AND job.attempts < ${MAX_ATTEMPTS}
        AND note.content_type = 'voice'
        AND note.transcript_status = 'pending'
      ORDER BY job.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, note_id, attempts, processing_claim_token
  `);

  const job = result.rows[0] as any;
  if (!job) return;

  const { id: jobId, note_id: noteId, attempts, processing_claim_token: processingClaimToken } = job;
  let leaseLost = false;
  let heartbeatInFlight = false;
  const renewJobLease = async (): Promise<boolean> => {
    const renewed = await db.execute(sql`
      UPDATE tablet_voice_jobs
      SET processing_lease_expires_at = ${new Date(Date.now() + VOICE_JOB_LEASE_MS)}
      WHERE id = ${jobId}
        AND status = 'processing'
        AND processing_claim_token = ${processingClaimToken}
      RETURNING id
    `);
    return (renewed.rows ?? []).length > 0;
  };
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void renewJobLease()
      .then((renewed) => { if (!renewed) leaseLost = true; })
      .catch(() => { leaseLost = true; })
      .finally(() => { heartbeatInFlight = false; });
  }, VOICE_JOB_LEASE_HEARTBEAT_MS);

  try {
    const noteResult = await db.execute(sql`
      SELECT id, audio_object_key, audio_storage_backend, audio_mime_type, entry_type, visibility,
             studio_id, client_user_id, author_user_id
      FROM client_notes WHERE id = ${noteId}
    `);
    const note = noteResult.rows[0] as any;
    if (!note?.audio_object_key) throw new Error("Note or audio key not found");

    const buffer = await downloadVoiceForTranscription(
      note.audio_object_key,
      resolveVoiceStorageBackend(note.audio_storage_backend),
    );
    const mimeType = note.audio_mime_type || "audio/webm";

    const { transcript, durationSec } = await transcribeVoiceBuffer(buffer, mimeType);

    const modResult = moderateContent(transcript);
    const isSharedMessage = note.visibility === "shared_with_client";
    const moderationStatus = modResult.allowed ? "approved" : "blocked";
    const finalBody = modResult.allowed
      ? `🎤 Voice note (${durationSec}s)`
      : "[Voice note removed]";

    if (leaseLost || !await renewJobLease()) {
      leaseLost = true;
      throw new Error("Voice transcription job lease was lost");
    }
    const noteUpdated = await db.execute(sql`
      UPDATE client_notes SET
        transcript        = ${transcript},
        transcript_status = 'completed',
        moderation_status = ${moderationStatus},
        audio_duration_sec = ${durationSec},
        body              = ${finalBody},
        transcribed_at    = NOW(),
        moderated_at      = NOW()
      WHERE id = ${noteId}
        AND transcript_status = 'pending'
      RETURNING id
    `);
    if ((noteUpdated.rows ?? []).length === 0) throw new Error("Voice note state changed before transcription could be saved");

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

    const jobCompleted = await db.execute(sql`
      UPDATE tablet_voice_jobs
      SET status = 'completed',
          processed_at = NOW(),
          processing_claim_token = NULL,
          processing_lease_expires_at = NULL
      WHERE id = ${jobId}
        AND status = 'processing'
        AND processing_claim_token = ${processingClaimToken}
      RETURNING id
    `);
    if ((jobCompleted.rows ?? []).length === 0) {
      console.warn(`[VoiceWorker] Job ${jobId} completed transcription after its lease was lost; retained recovery state`);
    }
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error";
    console.error(`[VoiceWorker] Job ${jobId} failed (attempt ${attempts}):`, errorMsg);

    const isFinal = attempts >= MAX_ATTEMPTS;
    if (leaseLost) return;
    const jobFailed = await db.execute(sql`
      UPDATE tablet_voice_jobs
      SET status = ${isFinal ? "failed" : "pending"},
          last_error = ${errorMsg},
          processed_at = NOW(),
          processing_claim_token = NULL,
          processing_lease_expires_at = NULL
      WHERE id = ${jobId}
        AND status = 'processing'
        AND processing_claim_token = ${processingClaimToken}
      RETURNING id
    `);

    if (isFinal && (jobFailed.rows ?? []).length > 0) {
      await db.execute(sql`
        UPDATE client_notes SET
          transcript_status = 'failed',
          body = '🎤 Voice note (transcript unavailable)'
        WHERE id = ${noteId}
          AND transcript_status = 'pending'
      `);
    }
  } finally {
    clearInterval(heartbeat);
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
  const recover = async () => {
    try {
      const result = await recoverStuckVoiceNotes();
      if (result.staleJobs > 0 || result.recoveredNotes > 0) {
        console.log(`[VoiceWorker] Recovered ${result.recoveredNotes} stuck voice note(s) and ${result.staleJobs} stale job(s)`);
      }
    } catch (err) {
      console.error("[VoiceWorker] Stuck-note recovery failed:", err);
    }
  };
  void run();
  void recover();
  setInterval(run, POLL_INTERVAL_MS);
  setInterval(recover, VOICE_RECOVERY_INTERVAL_MS);
  console.log(`[VoiceWorker] Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}
