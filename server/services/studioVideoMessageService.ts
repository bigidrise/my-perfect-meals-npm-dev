import { Request } from "express";
import crypto from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  deleteStudioVideoFromS3,
} from "./tabletVoiceService";
import {
  studioVideoMedia,
  studioVideoMessages,
} from "../db/schema/studio";
import {
  assertStudioVideoMessagesEnabled,
  createStudioVideoAuditEvent,
  type StudioVideoAuditEvent,
  type StudioVideoMediaState,
  type StudioVideoMessageSender,
} from "@shared/studioVideoMessages";

const MANUAL_VIDEO_DELETION_LEASE_MS = 30 * 60_000;
const MANUAL_VIDEO_DELETION_HEARTBEAT_MS = 5 * 60_000;
import { logAudit, getClientIp } from "../lib/auditLog";
import { STUDIO_VIDEO_MESSAGES_DEFAULT_ENABLED } from "@shared/studioVideoMessages";
import {
  assertStudioVideoManualDeletionEligible,
  assertStudioVideoTransition,
  finalizeStudioVideoManualDeletion,
  StudioVideoDomainError,
} from "@shared/studioVideoMessages";
import { deleteStudioVideoFromS3 } from "./tabletVoiceService";

export type StudioVideoListEntry = {
  id: string;
  body: string;
  authorUserId: string;
  recipientUserId: string;
  entryType: "message";
  visibility: "shared_with_client";
  sender: StudioVideoMessageSender;
  contentType: "video";
  createdAt: Date;
  videoMediaState: StudioVideoMediaState;
  videoDurationSec: number;
  videoWatchCompletedAt: Date | null;
  videoExpiresAt: Date | null;
  transcript: string | null;
  videoTranscriptStatus: "pending" | "completed" | "failed" | "blocked";
  videoModerationStatus: "pending" | "approved" | "blocked";
};

export function assertStudioVideoFeatureEnabled(): void {
  const configured = process.env.STUDIO_VIDEO_MESSAGES_ENABLED;
  const enabled =
    configured === undefined
      ? STUDIO_VIDEO_MESSAGES_DEFAULT_ENABLED
      : configured === "true";
  assertStudioVideoMessagesEnabled(enabled);
}

const playbackTokens = new Map<string, { messageId: string; actorUserId: string; expiresAt: number }>();
export function issueStudioVideoPlaybackToken(messageId: string, actorUserId: string): string {
  const token = crypto.randomUUID();
  playbackTokens.set(token, { messageId, actorUserId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return token;
}
export function isValidStudioVideoPlaybackToken(token: unknown, messageId: string, actorUserId: string): boolean {
  if (typeof token !== "string") return false;
  const entry = playbackTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    playbackTokens.delete(token);
    return false;
  }
  return entry.messageId === messageId && entry.actorUserId === actorUserId;
}

export async function listStudioVideoMessages(
  studioId: string,
  clientUserId: string,
): Promise<StudioVideoListEntry[]> {
  const rows = await db
    .select({
      id: studioVideoMessages.id,
      body: studioVideoMessages.body,
      authorUserId: studioVideoMessages.authorUserId,
      recipientUserId: studioVideoMessages.recipientUserId,
      sender: studioVideoMessages.sender,
      visibility: studioVideoMessages.visibility,
      contentType: studioVideoMessages.contentType,
      createdAt: studioVideoMessages.createdAt,
      transcript: studioVideoMessages.transcript,
      transcriptStatus: studioVideoMessages.transcriptStatus,
      mediaState: studioVideoMedia.state,
      durationSec: studioVideoMedia.durationSec,
      watchCompletedAt: studioVideoMedia.watchCompletedAt,
      expiresAt: studioVideoMedia.expiresAt,
      moderationStatus: studioVideoMedia.moderationStatus,
    })
    .from(studioVideoMessages)
    .innerJoin(studioVideoMedia, eq(studioVideoMedia.messageId, studioVideoMessages.id))
    .where(
      and(
        eq(studioVideoMessages.studioId, studioId),
        eq(studioVideoMessages.clientUserId, clientUserId),
        eq(studioVideoMessages.visibility, "shared_with_client"),
      ),
    )
    .orderBy(asc(studioVideoMessages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    // Video bytes are never included in conversation records, previews, or
    // notification payloads. The completed transcript is only returned after
    // the existing Studio relationship and scope checks above succeed.
    body: "Video message",
    authorUserId: row.authorUserId,
    recipientUserId: row.recipientUserId,
    entryType: "message",
    visibility: "shared_with_client",
    sender: row.sender as StudioVideoMessageSender,
    contentType: "video",
    createdAt: row.createdAt,
    videoMediaState: row.mediaState as StudioVideoMediaState,
    videoDurationSec: row.durationSec,
    videoWatchCompletedAt: row.watchCompletedAt,
    videoExpiresAt: row.expiresAt,
    transcript: row.transcript,
    videoTranscriptStatus: row.transcriptStatus as StudioVideoListEntry["videoTranscriptStatus"],
    videoModerationStatus: row.moderationStatus as StudioVideoListEntry["videoModerationStatus"],
  }));
}

export async function getStudioVideoMessage(
  studioId: string,
  clientUserId: string,
  messageId: string,
) {
  const [row] = await db
    .select({
      message: studioVideoMessages,
      media: studioVideoMedia,
    })
    .from(studioVideoMessages)
    .innerJoin(studioVideoMedia, eq(studioVideoMedia.messageId, studioVideoMessages.id))
    .where(
      and(
        eq(studioVideoMessages.id, messageId),
        eq(studioVideoMessages.studioId, studioId),
        eq(studioVideoMessages.clientUserId, clientUserId),
        eq(studioVideoMessages.visibility, "shared_with_client"),
      ),
    )
    .limit(1);
  return row ?? null;
}

const STUDIO_VIDEO_MANUAL_DELETION_LEASE_MS = 30 * 60_000;

function parseDerivativeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((key): key is string => typeof key === "string" && key.length > 0);
}

function storageKeysForManualDeletion(objectKey: string | null, derivativeKeys: unknown): string[] {
  return Array.from(new Set([
    ...(objectKey ? [objectKey] : []),
    ...parseDerivativeKeys(derivativeKeys),
  ]));
}

export type StudioVideoManualDeletionStorage = {
  deleteObject: (objectKey: string) => Promise<void>;
};

export type StudioVideoManualDeletionOptions = {
  now?: Date;
  storage?: StudioVideoManualDeletionStorage;
};

export type StudioVideoManualDeletionOutcome = {
  state: "deleted";
  deletedAt: string;
  deletedObjectCount: number;
  alreadyDeleted?: boolean;
};

/**
 * Deletes a participant's private video media without deleting the
 * communication record. The media row is first marked deleting with a
 * token-bound lease, which disables playback and prevents a competing worker
 * from clearing the same references while storage deletion is in flight.
 */
export async function deleteStudioVideoMessage(
  input: {
    studioId: string;
    clientUserId: string;
    messageId: string;
    actorUserId: string;
    req: Request;
  },
  options: StudioVideoManualDeletionOptions = {},
): Promise<StudioVideoManualDeletionOutcome> {
  const record = await getStudioVideoMessage(
    input.studioId,
    input.clientUserId,
    input.messageId,
  );
  if (!record) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      "Video message not found",
    );
  }
  const hasNoMediaReferences =
    record.media.objectKey === null &&
    Array.isArray(record.media.temporaryDerivativeKeys) &&
    record.media.temporaryDerivativeKeys.length === 0;
  if (
    record.media.state === "deleted" &&
    hasNoMediaReferences &&
    record.media.deletedAt
  ) {
    return {
      state: "deleted",
      deletedAt: record.media.deletedAt.toISOString(),
      deletedObjectCount: 0,
      alreadyDeleted: true,
    };
  }

  const transcript = {
    status: record.message.transcriptStatus,
    text: record.message.transcript,
    transcribedAt: record.message.transcribedAt?.toISOString() ?? null,
  } as const;
  assertStudioVideoManualDeletionEligible({
    state: record.media.state,
    objectKey: record.media.objectKey,
    transcript,
  });

  const now = options.now ?? new Date();
  assertStudioVideoTransition({
    currentState: record.media.state,
    nextState: "deleting",
    now,
    expiresAt: record.media.expiresAt?.toISOString() ?? null,
  });
  const claimToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + STUDIO_VIDEO_MANUAL_DELETION_LEASE_MS);
  const claimed = await db.execute(
    sql`
      UPDATE studio_video_media AS media
      SET state = 'deleting',
          deletion_attempts = COALESCE(deletion_attempts, 0) + 1,
          deletion_claim_token = ${claimToken},
          deletion_lease_expires_at = ${leaseExpiresAt},
          last_deletion_error = NULL,
          updated_at = NOW()
      FROM studio_video_messages AS message
      WHERE media.id = ${record.media.id}
        AND media.message_id = message.id
        AND message.id = ${input.messageId}
        AND message.studio_id = ${input.studioId}
        AND message.client_user_id = ${input.clientUserId}
        AND message.visibility = 'shared_with_client'
        AND (
          (
            message.transcript_status = 'completed'
            AND message.transcript = ${record.message.transcript}
          )
          OR (
            message.transcript_status = 'failed'
            AND message.transcript IS NULL
            AND media.state IN ('transcription_failed', 'deletion_failed')
          )
        )
        AND media.state IN ('ready', 'expiration_pending', 'deletion_failed', 'transcription_failed')
        AND media.object_key IS NOT NULL
      RETURNING media.object_key, media.temporary_derivative_keys, media.state
    `,
  );

  const [claimedMedia] = (claimed.rows ?? []) as Array<{
    object_key: string | null;
    temporary_derivative_keys: unknown;
    state: string;
  }>;
  if (!claimedMedia) {
    throw new StudioVideoDomainError(
      "VIDEO_MANUAL_DELETION_NOT_ALLOWED",
      "Video deletion is already in progress or no longer eligible",
    );
  }

  auditStudioVideoMediaDeletionAction({
    req: input.req,
    event: "deletion_requested",
    actorUserId: input.actorUserId,
    targetUserId: input.clientUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    mediaId: record.media.id,
    metadata: { deletionType: "manual" },
  });

  const keys = storageKeysForManualDeletion(
    claimedMedia.object_key,
    claimedMedia.temporary_derivative_keys,
  );
  const storage = options.storage ?? { deleteObject: deleteStudioVideoFromS3 };
  let leaseLost = false;
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void db.execute(sql`
      UPDATE studio_video_media
      SET deletion_lease_expires_at = ${new Date(Date.now() + STUDIO_VIDEO_MANUAL_DELETION_LEASE_MS)},
          updated_at = NOW()
      WHERE id = ${record.media.id}
        AND state = 'deleting'
        AND deletion_claim_token = ${claimToken}
      RETURNING id
    `)
      .then((result) => {
        if ((result.rows ?? []).length === 0) leaseLost = true;
      })
      .catch(() => {
        leaseLost = true;
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, 5 * 60_000);
  let results: PromiseSettledResult<void>[];
  try {
    results = await Promise.allSettled(keys.map((key) => storage.deleteObject(key)));
  } finally {
    clearInterval(heartbeat);
  }
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (leaseLost || failedCount > 0) {
    const failureMessage = leaseLost
      ? "Video deletion lease was lost while deleting private storage"
      : `${failedCount} Studio video storage object${failedCount === 1 ? "" : "s"} could not be deleted`;
    await db.execute(
      sql`
        UPDATE studio_video_media
        SET state = 'deletion_failed',
            last_deletion_error = ${failureMessage},
            deletion_claim_token = NULL,
            deletion_lease_expires_at = NULL,
            updated_at = NOW()
        WHERE id = ${record.media.id}
          AND state = 'deleting'
          AND deletion_claim_token = ${claimToken}
      `,
    );
    auditStudioVideoMediaDeletionAction({
      req: input.req,
      event: "deletion_failed",
      actorUserId: input.actorUserId,
      targetUserId: input.clientUserId,
      studioId: input.studioId,
      messageId: input.messageId,
      mediaId: record.media.id,
      metadata: {
        deletionType: "manual",
        failedObjectCount: failedCount,
        leaseLost,
      },
    });
    throw new Error("Private video deletion failed");
  }

  const finalization = finalizeStudioVideoManualDeletion({
    currentState: "deleting",
    now,
    transcript,
  });
  const finalized = await db.execute(
    sql`
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
      WHERE media.id = ${record.media.id}
        AND media.message_id = message.id
        AND message.id = ${input.messageId}
        AND message.studio_id = ${input.studioId}
        AND message.client_user_id = ${input.clientUserId}
        AND (
          (
            message.transcript_status = 'completed'
            AND message.transcript = ${record.message.transcript}
          )
          OR (
            message.transcript_status = 'failed'
            AND message.transcript IS NULL
            AND media.state = 'deleting'
          )
        )
        AND media.state = 'deleting'
        AND media.deletion_claim_token = ${claimToken}
      RETURNING media.id
    `,
  );
  if ((finalized.rows ?? []).length === 0) {
    await db.execute(sql`
      UPDATE studio_video_media
      SET state = 'deletion_failed',
          last_deletion_error = 'Video deletion could not be finalized safely',
          deletion_claim_token = NULL,
          deletion_lease_expires_at = NULL,
          updated_at = NOW()
      WHERE id = ${record.media.id}
        AND state = 'deleting'
        AND deletion_claim_token = ${claimToken}
    `);
    auditStudioVideoMediaDeletionAction({
      req: input.req,
      event: "deletion_failed",
      actorUserId: input.actorUserId,
      targetUserId: input.clientUserId,
      studioId: input.studioId,
      messageId: input.messageId,
      mediaId: record.media.id,
      metadata: { deletionType: "manual", reason: "finalization_guard_failed" },
    });
    throw new Error("Video deletion could not be finalized safely");
  }

  auditStudioVideoMediaDeletionAction({
    req: input.req,
    event: "media_deleted",
    actorUserId: input.actorUserId,
    targetUserId: input.clientUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    mediaId: record.media.id,
    metadata: { deletionType: "manual", deletedObjectCount: keys.length },
  });

  return {
    state: "deleted",
    deletedAt: finalization.deletedAt,
    deletedObjectCount: keys.length,
  };
}

export function auditStudioVideoAction(input: {
  req: Request;
  event: StudioVideoAuditEvent;
  actorUserId: string;
  targetUserId: string;
  studioId: string;
  messageId: string;
  metadata?: Record<string, unknown>;
}): void {
  const record = createStudioVideoAuditEvent({
    event: input.event,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    occurredAt: new Date(),
    metadata: input.metadata,
  });
  const readEvents = new Set<StudioVideoAuditEvent>([
    "playback_authorized",
  ]);
  logAudit({
    actor: record.actorUserId,
    target: record.targetUserId,
    orgId: (input.req as any).authUser?.organizationId ?? null,
    action: readEvents.has(record.event) ? "READ" : "WRITE",
    resourceType: "studio_video_message",
    table: "studio_video_messages",
    resourceId: record.messageId,
    route: input.req.path,
    ip: getClientIp(input.req as any),
    meta: record.metadata,
  });
}

/**
 * Media lifecycle events are separate from the permanent message record.
 * This mirrors retention-worker auditing: media deletion is always a DELETE
 * action and never logs object keys or other storage identifiers in metadata.
 */
export function auditStudioVideoMediaDeletionAction(input: {
  req: Request;
  event: Extract<
    StudioVideoAuditEvent,
    "deletion_requested" | "media_deleted" | "deletion_failed"
  >;
  actorUserId: string;
  targetUserId: string;
  studioId: string;
  messageId: string;
  mediaId: string;
  metadata?: Record<string, unknown>;
}): void {
  const record = createStudioVideoAuditEvent({
    event: input.event,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    occurredAt: new Date(),
    metadata: input.metadata,
  });
  logAudit({
    actor: record.actorUserId,
    target: record.targetUserId,
    orgId: (input.req as any).authUser?.organizationId ?? null,
    action: "DELETE",
    resourceType: "studio_video_media",
    table: "studio_video_media",
    resourceId: input.mediaId,
    field: "state,object_key,temporary_derivative_keys,deleted_at",
    route: input.req.path,
    ip: getClientIp(input.req as any),
    meta: record.metadata,
  });
}

export function auditStudioVideoListAction(input: {
  req: Request;
  actorUserId: string;
  targetUserId: string;
  messageId: string;
}): void {
  logAudit({
    actor: input.actorUserId,
    target: input.targetUserId,
    orgId: (input.req as any).authUser?.organizationId ?? null,
    action: "READ",
    resourceType: "studio_video_message",
    table: "studio_video_messages",
    resourceId: input.messageId,
    route: input.req.path,
    ip: getClientIp(input.req as any),
    meta: { action: "listed" },
  });
}

export type StudioVideoManualDeletionRow = {
  id: string;
  message_id: string;
  object_key: string | null;
  temporary_derivative_keys: unknown;
  transcript: string | null;
  transcript_status: string;
  deletion_claim_token: string;
};

export type StudioVideoManualDeletionDatabase = {
  execute: (query: any) => Promise<{ rows?: unknown[] }>;
};

export type StudioVideoManualDeletionStorage = {
  deleteObject: (objectKey: string) => Promise<void>;
};

function manualDeletionKeys(row: StudioVideoManualDeletionRow): string[] {
  const derivatives = Array.isArray(row.temporary_derivative_keys)
    ? row.temporary_derivative_keys.filter((key): key is string => typeof key === "string" && key.length > 0)
    : [];
  return Array.from(new Set([
    ...(row.object_key ? [row.object_key] : []),
    ...derivatives,
  ]));
}

/**
 * Claims an eligible video's media row before deleting any private object.
 * The parent message (and its completed transcript) stays intact, so client
 * and professional histories cannot reference media that was silently removed.
 */
export async function deleteStudioVideoMessageMedia(
  input: {
    studioId: string;
    clientUserId: string;
    messageId: string;
    now?: Date;
  },
  dependencies: {
    database?: StudioVideoManualDeletionDatabase;
    storage?: StudioVideoManualDeletionStorage;
    leaseMs?: number;
    heartbeatMs?: number;
  } = {},
): Promise<"deleted" | "deletion_failed" | "unavailable"> {
  const database = dependencies.database ?? db;
  const storage = dependencies.storage ?? { deleteObject: deleteStudioVideoFromS3 };
  const now = input.now ?? new Date();
  const leaseMs = dependencies.leaseMs ?? MANUAL_VIDEO_DELETION_LEASE_MS;
  const heartbeatMs = dependencies.heartbeatMs ?? MANUAL_VIDEO_DELETION_HEARTBEAT_MS;
  const claimToken = crypto.randomUUID();

  const claimed = await database.execute(sql`
    UPDATE studio_video_media AS media
    SET state = 'deleting',
        deletion_attempts = COALESCE(deletion_attempts, 0) + 1,
        deletion_claim_token = ${claimToken},
        deletion_lease_expires_at = ${new Date(now.getTime() + leaseMs)},
        last_deletion_error = NULL,
        updated_at = NOW()
    FROM studio_video_messages AS message
    WHERE media.message_id = message.id
      AND message.id = ${input.messageId}
      AND message.studio_id = ${input.studioId}
      AND message.client_user_id = ${input.clientUserId}
       AND (
         (
           message.transcript_status = 'completed'
           AND message.transcript IS NOT NULL
         )
         OR (
           message.transcript_status = 'failed'
           AND message.transcript IS NULL
           AND media.state IN ('transcription_failed', 'deletion_failed')
         )
       )
      AND media.object_key IS NOT NULL
      AND (
         media.state IN ('ready', 'expiration_pending', 'deletion_failed', 'transcription_failed')
        OR (
          media.state = 'deleting'
          AND (
            media.deletion_lease_expires_at IS NULL
            OR media.deletion_lease_expires_at <= ${now}
          )
        )
      )
    RETURNING media.id, media.message_id, media.object_key,
              media.temporary_derivative_keys, message.transcript,
              message.transcript_status, media.deletion_claim_token
  `);
  const row = claimed.rows?.[0] as StudioVideoManualDeletionRow | undefined;
  if (!row) return "unavailable";

  const renewLease = async (): Promise<boolean> => {
    const renewal = await database.execute(sql`
      UPDATE studio_video_media
      SET deletion_lease_expires_at = ${new Date(Date.now() + leaseMs)},
          updated_at = NOW()
      WHERE id = ${row.id}
        AND state = 'deleting'
        AND deletion_claim_token = ${row.deletion_claim_token}
      RETURNING id
    `);
    return (renewal.rows ?? []).length > 0;
  };
  // Renew before the first storage call so a batch claim cannot consume part
  // of this item's lease. Continue renewing while deletion is in flight,
  // matching automatic-purge ownership semantics.
  if (!await renewLease()) return "unavailable";
  let leaseLost = false;
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void renewLease()
      .then((renewed) => { if (!renewed) leaseLost = true; })
      .catch(() => { leaseLost = true; })
      .finally(() => { heartbeatInFlight = false; });
  }, heartbeatMs);
  const keys = manualDeletionKeys(row);
  let results: PromiseSettledResult<void>[];
  try {
    results = await Promise.allSettled(keys.map((key) => storage.deleteObject(key)));
  } finally {
    clearInterval(heartbeat);
  }
  if (leaseLost) return "deletion_failed";
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount > 0) {
    await database.execute(sql`
      UPDATE studio_video_media
      SET state = 'deletion_failed',
          last_deletion_error = ${`${failedCount} Studio video storage object${failedCount === 1 ? "" : "s"} could not be deleted`},
          deletion_claim_token = NULL,
          deletion_lease_expires_at = NULL,
          updated_at = NOW()
      WHERE id = ${row.id}
        AND state = 'deleting'
        AND deletion_claim_token = ${row.deletion_claim_token}
    `);
    return "deletion_failed";
  }

  const finalized = await database.execute(sql`
    UPDATE studio_video_media AS media
    SET state = 'deleted',
        object_key = NULL,
        temporary_derivative_keys = '[]'::jsonb,
        deleted_at = COALESCE(deleted_at, ${now}),
        deletion_claim_token = NULL,
        deletion_lease_expires_at = NULL,
        last_deletion_error = NULL,
        updated_at = NOW()
    FROM studio_video_messages AS message
    WHERE media.id = ${row.id}
      AND media.message_id = message.id
      AND media.state = 'deleting'
      AND media.deletion_claim_token = ${row.deletion_claim_token}
      AND media.deletion_lease_expires_at > NOW()
       AND (
         (
           message.transcript_status = 'completed'
           AND message.transcript = ${row.transcript}
         )
         OR (
           message.transcript_status = 'failed'
           AND message.transcript IS NULL
           AND media.state = 'deleting'
         )
       )
    RETURNING media.id
  `);
  if ((finalized.rows ?? []).length > 0) return "deleted";

  await database.execute(sql`
    UPDATE studio_video_media
    SET state = 'deletion_failed',
        last_deletion_error = 'Transcript changed or deletion lease was lost before manual finalization',
        deletion_claim_token = NULL,
        deletion_lease_expires_at = NULL,
        updated_at = NOW()
    WHERE id = ${row.id}
      AND state = 'deleting'
      AND deletion_claim_token = ${row.deletion_claim_token}
  `);
  return "deletion_failed";
}