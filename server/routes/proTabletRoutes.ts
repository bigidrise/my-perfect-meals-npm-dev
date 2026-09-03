import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  clientNotes,
  studioMessageViewerDeletions,
  studios,
  studioVideoMedia,
  studioVideoMessages,
} from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and, asc, desc, inArray, isNull, notExists } from "drizzle-orm";
import { requireWorkspaceAccess } from "../middleware/requireWorkspaceAccess";
import { logAudit, getClientIp } from "../lib/auditLog";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { moderatePrivateStudioContent, BLOCKED_MESSAGE } from "../services/tabletModerationService";
import { notifyClientOfMessage, notifyClientOfNote } from "../services/tabletNotificationService";
import { logClientActivity } from "../services/activityLog";
import { sql } from "drizzle-orm";
import { getOrSet, invalidateClientTabletCache, invalidatePrefix } from "../services/queryCache";
import multer from "multer";

const PRO_UNREAD_TTL_MS = 15_000;

/** Invalidate the pro unread-summary cache for a given pro user. */
export function invalidateProUnreadCache(proUserId: string): void {
  invalidatePrefix(`pro-unread:${proUserId}`);
}
import {
  getSignedPlaybackUrl,
  getStudioVoiceObjectAvailability,
  getStudioVoiceStream,
  MAX_VOICE_DURATION_SEC,
  normalizeVoiceMimeType,
  resolveVoiceStorageBackend,
} from "../services/tabletVoiceService";
import { startVoiceJobWorker } from "../services/voiceJobWorker";
import {
  createStudioVoiceNote,
  isValidStudioVoicePlaybackToken,
  issueStudioVoicePlaybackToken,
} from "../services/studioVoiceMessageService";
import {
  assertStudioVideoFeatureEnabled,
  auditStudioVideoAction,
  auditStudioVideoListAction,
  deleteStudioVideoMessage,
  getStudioVideoMessage,
  isRetryableStudioVideoDeletionFailure,
  isValidStudioVideoPlaybackToken,
  issueStudioVideoPlaybackToken,
  listStudioVideoMessages,
} from "../services/studioVideoMessageService";
import {
  hideStudioMessageForViewer,
  isStudioMessageHiddenForViewer,
} from "../services/studioMessageVisibilityService";
import {
  assertStudioVideoReadyForPlayback,
  assertStudioVideoTransition,
  canReplayStudioVideo,
  completeStudioVideoWatch,
  createVerifiedWatchProgress,
  recordVerifiedWatchProgress,
  serializeVerifiedWatchProgress,
  STUDIO_VIDEO_MAX_UNOPENED_RETENTION_MS,
  type VerifiedWatchProgress,
} from "@shared/studioVideoMessages";
import {
  getStudioVideoStream,
  getStudioVideoObjectKey,
  MAX_STUDIO_VIDEO_DURATION_SEC,
  MAX_STUDIO_VIDEO_SIZE_BYTES,
  transcribeStudioVideoBuffer,
  uploadStudioVideoToS3,
} from "../services/tabletVoiceService";
import { getStudioVideoTranscriptionFailureMetadata } from "../services/studioVideoTranscriptionDiagnostics";

startVoiceJobWorker();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
import { studioVideoUpload } from "../middleware/studioVideoUpload";

const router = Router();

async function getProStudioId(proUserId: string): Promise<string | null> {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);
  return studio?.id ?? null;
}

async function markMessagesRead(studioId: string, clientUserId: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO pro_message_reads (studio_id, client_user_id, last_read_at)
      VALUES (${studioId}, ${clientUserId}, NOW())
      ON CONFLICT (studio_id, client_user_id)
      DO UPDATE SET last_read_at = NOW()
    `);
  } catch (err) {
    console.warn("Could not mark messages as read:", err);
  }
}

function studioVideoError(res: Response, error: unknown): boolean {
  if (error instanceof Error && error.message.startsWith("STUDIO_VIDEO_MESSAGES_DISABLED")) {
    res.status(503).json({ error: "Video messages are temporarily unavailable" });
    return true;
  }
  return false;
}

async function handleProStudioVideoDeletion(
  req: Request,
  res: Response,
  authUser: AuthenticatedRequest["authUser"],
  studioId: string,
  clientId: string,
  messageId: string,
): Promise<void> {
  try {
    const result = await deleteStudioVideoMessage({
      req,
      actorUserId: authUser.id,
      studioId,
      clientUserId: clientId,
      messageId,
    });
    if (!result.alreadyDeleted) {
      await logClientActivity(
        studioId,
        clientId,
        authUser.id,
        "message_deleted",
        "message",
        messageId,
        { type: "video", deletedBy: "pro", mediaOnly: true },
      );
    }
    invalidateClientTabletCache(clientId);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Video message not found")) {
      res.status(404).json({ error: "Video message not found" });
      return;
    }
    if (isRetryableStudioVideoDeletionFailure(error)) {
      res.status(502).json({
        error: "Video could not be deleted. Please try again.",
        retryable: true,
        mediaState: "deletion_failed",
      });
      return;
    }
    res.status(409).json({
      error: "This video is no longer eligible for deletion or is already being deleted",
    });
  }
}

async function hideProStudioMessageForViewer(
  req: Request,
  res: Response,
  authUser: AuthenticatedRequest["authUser"],
  studioId: string,
  clientId: string,
  messageId: string,
  kind: "client_note" | "video_message",
): Promise<void> {
  try {
    const result = await hideStudioMessageForViewer({
      studioId,
      clientUserId: clientId,
      viewerUserId: authUser.id,
      messageId,
      kind,
    });
    await logClientActivity(
      studioId,
      clientId,
      authUser.id,
      "message_deleted",
      "message",
      messageId,
      { deletedBy: "pro", deletionScope: "viewer_only", messageKind: kind },
    );
    invalidateClientTabletCache(clientId);
    invalidateProUnreadCache(authUser.id);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, hidden: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "Studio message not found") {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    throw error;
  }
}

function parseVideoDuration(value: unknown): number | null {
  const durationSec = typeof value === "string" ? Number(value) : value;
  if (
    typeof durationSec !== "number" ||
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    durationSec > MAX_STUDIO_VIDEO_DURATION_SEC
  ) {
    return null;
  }
  return Math.ceil(durationSec);
}

function normalizeStudioVideoMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

router.post("/:clientId/video-message", requireWorkspaceAccess, studioVideoUpload, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;
  let transcript: string;
  let moderation: ReturnType<typeof moderatePrivateStudioContent> | null = null;

  try {
    assertStudioVideoFeatureEnabled();
  } catch (error) {
    if (studioVideoError(res, error)) return;
    throw error;
  }

  if (!req.file) {
    res.status(400).json({ error: "video file is required" });
    return;
  }
  const mimeType = normalizeStudioVideoMimeType(req.file.mimetype);
  if (!["video/webm", "video/mp4", "video/quicktime"].includes(mimeType)) {
    res.status(400).json({ error: "Video must be WebM, MP4, or MOV" });
    return;
  }
  const durationSec = parseVideoDuration(req.body.durationSec);
  if (!durationSec) {
    res.status(400).json({ error: `Video duration must be between 1 and ${MAX_STUDIO_VIDEO_DURATION_SEC} seconds` });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const [message] = await db
    .insert(studioVideoMessages)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      recipientUserId: clientId,
      sender: "pro",
      visibility: "shared_with_client",
      body: "Video message",
      transcriptStatus: "pending",
    })
    .returning({ id: studioVideoMessages.id, createdAt: studioVideoMessages.createdAt });

  await db.insert(studioVideoMedia).values({
    messageId: message.id,
    state: "draft",
    mimeType,
    durationSec,
    sizeBytes: req.file.size,
    temporaryDerivativeKeys: [],
    expiresAt: new Date(Date.now() + STUDIO_VIDEO_MAX_UNOPENED_RETENTION_MS),
    moderationStatus: "pending",
  });
  auditStudioVideoAction({
    req,
    event: "message_created",
    actorUserId: authUser.id,
    targetUserId: clientId,
    studioId,
    messageId: message.id,
    metadata: { sender: "pro" },
  });

  assertStudioVideoTransition({ currentState: "draft", nextState: "uploading", now: new Date() });
  await db.update(studioVideoMedia)
    .set({ state: "uploading", updatedAt: new Date() })
    .where(eq(studioVideoMedia.messageId, message.id));
  auditStudioVideoAction({
    req,
    event: "upload_started",
    actorUserId: authUser.id,
    targetUserId: clientId,
    studioId,
    messageId: message.id,
    metadata: { sizeBytes: req.file.size },
  });

  try {
    const objectKey = getStudioVideoObjectKey(message.id, mimeType);
    await uploadStudioVideoToS3(req.file.buffer, mimeType, objectKey);
    assertStudioVideoTransition({ currentState: "uploading", nextState: "uploaded", now: new Date() });
    await db.update(studioVideoMedia)
      .set({ state: "uploaded", objectKey, updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    assertStudioVideoTransition({ currentState: "uploaded", nextState: "processing", now: new Date() });
    await db.update(studioVideoMedia)
      .set({ state: "processing", updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    auditStudioVideoAction({
      req, event: "transcription_requested", actorUserId: authUser.id,
      targetUserId: clientId, studioId, messageId: message.id, metadata: {},
    });
    try {
      ({ transcript } = await transcribeStudioVideoBuffer(req.file.buffer, mimeType));
      await db.update(studioVideoMessages)
        .set({ transcript, transcriptStatus: "completed", transcribedAt: new Date(), updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      auditStudioVideoAction({
        req, event: "transcription_completed", actorUserId: authUser.id,
        targetUserId: clientId, studioId, messageId: message.id, metadata: {},
      });
    } catch (error) {
      await db.update(studioVideoMessages)
        .set({ transcriptStatus: "failed", updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      await db.update(studioVideoMedia)
        .set({ state: "transcription_failed", updatedAt: new Date() })
        .where(eq(studioVideoMedia.messageId, message.id));
      auditStudioVideoAction({
        req,
        event: "transcription_failed",
        actorUserId: authUser.id,
        targetUserId: clientId,
        studioId,
        messageId: message.id,
        metadata: getStudioVideoTranscriptionFailureMetadata(error),
      });
      res.status(422).json({ error: "We could not verify this video message. Please try recording it again." });
      return;
    }
    moderation = moderatePrivateStudioContent(transcript);
    if (!moderation.allowed) {
      await db.update(studioVideoMessages)
        .set({ transcriptStatus: "blocked", updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      await db.update(studioVideoMedia)
        .set({ state: "moderation_failed", moderationStatus: "blocked", moderatedAt: new Date(), updatedAt: new Date() })
        .where(eq(studioVideoMedia.messageId, message.id));
      auditStudioVideoAction({
        req, event: "moderation_completed", actorUserId: authUser.id,
        targetUserId: clientId, studioId, messageId: message.id, metadata: { approved: false },
      });
      res.status(422).json({ error: "This video message could not be sent." });
      return;
    }
    await db.update(studioVideoMedia)
      .set({ moderationStatus: "approved", moderatedAt: new Date(), updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    assertStudioVideoTransition({ currentState: "processing", nextState: "ready", now: new Date() });
    await db.update(studioVideoMedia)
      .set({ state: "ready", updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
  } catch (error) {
    await db.update(studioVideoMedia)
      .set({ state: "upload_failed", updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    res.status(502).json({ error: "Video upload failed. Please try again." });
    return;
  }

  auditStudioVideoAction({
    req,
    event: "upload_completed",
    actorUserId: authUser.id,
    targetUserId: clientId,
    studioId,
    messageId: message.id,
    metadata: { mimeType, durationSec },
  });
  auditStudioVideoAction({
    req,
    event: "moderation_completed",
    actorUserId: authUser.id,
    targetUserId: clientId,
    studioId,
    messageId: message.id,
    metadata: {
      approved: true,
      flagged: moderation?.severity !== null,
      severity: moderation?.severity ?? null,
      category: moderation?.category ?? null,
      reason: moderation?.reason ?? null,
    },
  });
  logClientActivity(studioId, clientId, authUser.id, "message_sent", "message", message.id, { type: "video", sender: "pro" });
  invalidateClientTabletCache(clientId);
  notifyClientOfMessage(clientId);

  res.set("Cache-Control", "no-store");
  res.status(201).json({
    entry: {
      id: message.id,
      body: "Video message",
      authorUserId: authUser.id,
      entryType: "message",
      visibility: "shared_with_client",
      sender: "pro",
      contentType: "video",
      videoMediaState: "ready",
      videoDurationSec: durationSec,
      transcript,
      videoTranscriptStatus: "completed",
      createdAt: message.createdAt,
    },
  });
});

router.delete("/:clientId/video/:messageId", requireWorkspaceAccess, async (req: Request, res: Response) => {
  res.status(410).json({
    error: "Private video media is managed automatically. Use Delete for me to remove this message from your Studio history.",
  });
});

router.delete("/:clientId/video/:messageId/transcript", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found" });
    return;
  }
  await hideProStudioMessageForViewer(
    req,
    res,
    authUser,
    studioId,
    req.params.clientId,
    req.params.messageId,
    "video_message",
  );
});

router.get("/:clientId/video/:messageId/playback", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found" });
    return;
  }
  if (await isStudioMessageHiddenForViewer({
    studioId,
    clientUserId: req.params.clientId,
    viewerUserId: authUser.id,
    messageId: req.params.messageId,
    kind: "video_message",
  })) {
    res.status(404).json({ error: "Video message not found" });
    return;
  }
  const record = await getStudioVideoMessage(studioId, req.params.clientId, req.params.messageId);
  if (!record) {
    res.status(404).json({ error: "Video message not found" });
    return;
  }
  try {
    assertStudioVideoFeatureEnabled();
    assertStudioVideoReadyForPlayback({
      state: record.media.state,
      transcriptStatus: record.message.transcriptStatus,
      moderationStatus: record.media.moderationStatus,
      objectKey: record.media.objectKey,
    });
  } catch (error) {
    if (studioVideoError(res, error)) return;
    res.status(409).json({ error: "Video is not ready for playback" });
    return;
  }
  if (!canReplayStudioVideo({
    state: record.media.state,
    objectKey: record.media.objectKey,
    createdAt: record.media.createdAt,
    expiresAt: record.media.expiresAt?.toISOString() ?? null,
    deletedAt: record.media.deletedAt?.toISOString() ?? null,
  }, new Date())) {
    res.status(410).json({ error: "This video is no longer available" });
    return;
  }

  if (req.query.stream === "1") {
    if (!isValidStudioVideoPlaybackToken(req.query.access, record.message.id, authUser.id)) {
      res.status(403).json({ error: "Playback access expired" });
      return;
    }
    res.set({ "Cache-Control": "no-store, private", "Content-Type": record.media.mimeType });
    getStudioVideoStream(record.media.objectKey!).on("error", () => {
      if (!res.headersSent) res.status(503).end();
    }).pipe(res);
    return;
  }
  const access = issueStudioVideoPlaybackToken(record.message.id, authUser.id);
  const url = `/api/pro/tablet/${req.params.clientId}/video/${record.message.id}/playback?stream=1&access=${encodeURIComponent(access)}`;
  auditStudioVideoAction({
    req, event: "playback_authorized", actorUserId: authUser.id,
    targetUserId: record.message.clientUserId, studioId, messageId: record.message.id,
    metadata: { actorRole: "professional" },
  });
  res.set("Cache-Control", "no-store, private");
  res.json({
    url,
    mimeType: record.media.mimeType,
    durationSec: record.media.durationSec,
    expiresAt: record.media.expiresAt,
    watchCompletedAt: record.media.watchCompletedAt,
  });
});

router.post("/:clientId/video/:messageId/progress", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found" });
    return;
  }
  if (await isStudioMessageHiddenForViewer({
    studioId,
    clientUserId: req.params.clientId,
    viewerUserId: authUser.id,
    messageId: req.params.messageId,
    kind: "video_message",
  })) {
    res.status(404).json({ error: "Video message not found" });
    return;
  }
  const record = await getStudioVideoMessage(studioId, req.params.clientId, req.params.messageId);
  if (!record) {
    res.status(404).json({ error: "Video message not found" });
    return;
  }
  if (record.message.recipientUserId !== authUser.id) {
    res.status(403).json({ error: "Only the video recipient can record watch completion" });
    return;
  }
  if (!canReplayStudioVideo({
    state: record.media.state,
    objectKey: record.media.objectKey,
    createdAt: record.media.createdAt,
    expiresAt: record.media.expiresAt?.toISOString() ?? null,
    deletedAt: record.media.deletedAt?.toISOString() ?? null,
  }, new Date())) {
    res.status(410).json({ error: "This video is no longer available" });
    return;
  }

  const previous = (record.media.watchProgress ?? createVerifiedWatchProgress(record.media.durationSec)) as VerifiedWatchProgress;
  const result = recordVerifiedWatchProgress(previous, {
    durationSec: record.media.durationSec,
    positionSec: Number(req.body.positionSec),
    observedAtMs: Number(req.body.observedAtMs),
    isPlaying: req.body.isPlaying === true,
    isSeeking: req.body.isSeeking === true,
    playbackRate: typeof req.body.playbackRate === "number" ? req.body.playbackRate : undefined,
  });
  const persistedWatchProgress = serializeVerifiedWatchProgress(result.progress);
  const update: Record<string, unknown> = { watchProgress: persistedWatchProgress, updatedAt: new Date() };
  if (result.complete && record.media.state === "ready") {
    const completedAt = new Date();
    const completion = completeStudioVideoWatch({
      currentState: "ready",
      progress: result.progress,
      completedAt,
    });
    const [persistedCompletion] = await db.update(studioVideoMedia)
      .set({
        watchProgress: persistedWatchProgress,
        state: completion.state,
        watchCompletedAt: new Date(completion.watchCompletedAt),
        expiresAt: new Date(completion.expiresAt),
        updatedAt: completedAt,
      })
      .where(and(
        eq(studioVideoMedia.id, record.media.id),
        eq(studioVideoMedia.state, "ready"),
        isNull(studioVideoMedia.watchCompletedAt),
        sql`COALESCE(
          ${studioVideoMedia.expiresAt},
          ${studioVideoMedia.createdAt} + (${STUDIO_VIDEO_MAX_UNOPENED_RETENTION_MS} * INTERVAL '1 millisecond')
        ) > ${completedAt}`,
      ))
      .returning({
        watchCompletedAt: studioVideoMedia.watchCompletedAt,
        expiresAt: studioVideoMedia.expiresAt,
      });
    if (!persistedCompletion) {
      res.status(409).json({ error: "Video availability changed before completion could be recorded" });
      return;
    }
    auditStudioVideoAction({
      req, event: "watch_completion_recorded", actorUserId: authUser.id,
      targetUserId: record.message.clientUserId, studioId, messageId: record.message.id,
      metadata: { coverageRatio: Number(result.coverageRatio.toFixed(3)), verified: true },
    });
    auditStudioVideoAction({
      req, event: "expiration_started", actorUserId: authUser.id,
      targetUserId: record.message.clientUserId, studioId, messageId: record.message.id,
      metadata: { windowMinutes: 15 },
    });
    res.set("Cache-Control", "no-store, private");
    res.json({
      accepted: result.accepted,
      complete: result.complete,
      coverageRatio: result.coverageRatio,
      watchCompletedAt: persistedCompletion.watchCompletedAt,
      expiresAt: persistedCompletion.expiresAt,
    });
    return;
  }
  await db.update(studioVideoMedia)
    .set(update as any)
    .where(eq(studioVideoMedia.id, record.media.id));
  res.set("Cache-Control", "no-store, private");
  res.json({
    accepted: result.accepted,
    complete: result.complete,
    coverageRatio: result.coverageRatio,
    watchCompletedAt: update.watchCompletedAt ?? record.media.watchCompletedAt,
    expiresAt: update.expiresAt ?? record.media.expiresAt,
  });
});

router.get("/unread-summary", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const cacheKey = `pro-unread:${authUser.id}`;
  const payload = await getOrSet(cacheKey, PRO_UNREAD_TTL_MS, async () => {
    const studioId = await getProStudioId(authUser.id);
    if (!studioId) {
      return { clients: [], totalUnread: 0 };
    }

    const result = await db.execute(sql`
      SELECT
        cn.client_user_id AS "clientUserId",
        COUNT(*) FILTER (
          WHERE cn.created_at > COALESCE(pmr.last_read_at, '1970-01-01'::timestamptz)
        )::int AS "unreadCount",
        MAX(cn.created_at) AS "lastMessageAt",
        (array_agg(cn.body ORDER BY cn.created_at DESC))[1] AS "lastMessageBody"
      FROM client_notes cn
      LEFT JOIN pro_message_reads pmr
        ON pmr.studio_id = cn.studio_id
        AND pmr.client_user_id = cn.client_user_id
      WHERE cn.studio_id = ${studioId}
        AND cn.entry_type = 'message'
        AND cn.sender = 'client'
        AND NOT EXISTS (
          SELECT 1
          FROM studio_message_viewer_deletions hidden
          WHERE hidden.viewer_user_id = ${authUser.id}
            AND hidden.client_note_id = cn.id
        )
      GROUP BY cn.client_user_id
    `);

    const clients = (result.rows as any[]).map((r: any) => ({
      clientUserId: r.clientUserId,
      unreadCount: Number(r.unreadCount) || 0,
      lastMessageAt: r.lastMessageAt,
      lastMessageBody: r.lastMessageBody,
    }));

    const totalUnread = clients.reduce((sum, c) => sum + c.unreadCount, 0);
    return { clients, totalUnread };
  });

  res.set("Cache-Control", "no-store");
  res.json(payload);
});

router.get("/all-messages", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.json({ messages: [] });
    return;
  }

  const entries = await db
    .select({
      id: clientNotes.id,
      body: clientNotes.body,
      clientUserId: clientNotes.clientUserId,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      sender: clientNotes.sender,
      contentType: clientNotes.contentType,
      createdAt: clientNotes.createdAt,
    } as any)
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.entryType, "message"),
        eq(clientNotes.sender, "client"),
        notExists(
          db
            .select({ id: studioMessageViewerDeletions.id })
            .from(studioMessageViewerDeletions)
            .where(
              and(
                eq(studioMessageViewerDeletions.viewerUserId, authUser.id),
                eq(studioMessageViewerDeletions.clientNoteId, clientNotes.id),
              ),
            ),
        ),
      )
    )
    .orderBy(desc(clientNotes.createdAt))
    .limit(100);

  const clientUserIds = [...new Set(entries.map(e => e.clientUserId))];
  let clientNames: Record<string, string> = {};
  if (clientUserIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, firstName: users.firstName, nickname: users.nickname })
      .from(users)
      .where(inArray(users.id, clientUserIds));
    for (const u of userRows) {
      clientNames[u.id] = u.nickname || u.firstName || "Client";
    }
  }

  const readResult = await db.execute(sql`
    SELECT client_user_id, last_read_at
    FROM pro_message_reads
    WHERE studio_id = ${studioId}
  `);
  const readMap: Record<string, Date> = {};
  for (const r of readResult.rows as any[]) {
    readMap[r.client_user_id] = new Date(r.last_read_at);
  }

  const messages = entries.map(e => ({
    ...e,
    clientName: clientNames[e.clientUserId] || "Client",
    isUnread: !readMap[e.clientUserId] || new Date(e.createdAt) > readMap[e.clientUserId],
  }));

  res.set("Cache-Control", "no-store");
  res.json({ messages });
});

router.get("/:clientId", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const entries = await db
    .select({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
      sender: clientNotes.sender,
      tags: clientNotes.tags,
      contentType: clientNotes.contentType,
      audioObjectKey: clientNotes.audioObjectKey,
      audioDurationSec: clientNotes.audioDurationSec,
      transcript: clientNotes.transcript,
      transcriptStatus: clientNotes.transcriptStatus,
      moderationStatus: clientNotes.moderationStatus,
      createdAt: clientNotes.createdAt,
    } as any)
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId),
        notExists(
          db
            .select({ id: studioMessageViewerDeletions.id })
            .from(studioMessageViewerDeletions)
            .where(
              and(
                eq(studioMessageViewerDeletions.viewerUserId, authUser.id),
                eq(studioMessageViewerDeletions.clientNoteId, clientNotes.id),
              ),
            ),
        ),
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);
  const videoMessages = await listStudioVideoMessages(studioId, clientId, authUser.id);

  markMessagesRead(studioId, clientId);

  const isClientOnly = (tags: string[] | null) =>
    Array.isArray(tags) && tags.includes("visibleTo:client");

  const messages = [
    ...entries.filter(e => e.entryType === "message" && !isClientOnly(e.tags)),
    ...videoMessages,
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const notes = entries.filter(e => e.entryType === "note");

  for (const video of videoMessages) {
    auditStudioVideoListAction({
      req,
      actorUserId: authUser.id,
      targetUserId: clientId,
      messageId: video.id,
    });
  }
  res.set("Cache-Control", "no-store");
  res.json({ messages, notes });
});

router.post("/:clientId/message", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;
  const { body } = req.body;

  if (!body || typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const moderation = moderatePrivateStudioContent(body.trim());
  if (!moderation.allowed) {
    logClientActivity(
      studioId,
      clientId,
      authUser.id,
      "message_blocked",
      "message",
      undefined,
      { severity: moderation.severity, category: moderation.category, reason: moderation.reason, sender: "pro" }
    );
    res.status(422).json({
      error: BLOCKED_MESSAGE,
      severity: moderation.severity,
      category: moderation.category,
      reason: moderation.reason,
    });
    return;
  }

  if (moderation.severity !== null) {
    logClientActivity(
      studioId,
      clientId,
      authUser.id,
      "message_flagged",
      "message",
      undefined,
      { severity: moderation.severity, reason: moderation.reason, sender: "pro" }
    );
  }

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: body.trim(),
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "pro",
    })
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  logClientActivity(
    studioId,
    clientId,
    authUser.id,
    "message_sent",
    "message",
    entry.id,
    { sender: "pro" }
  );

  notifyClientOfMessage(clientId);

  markMessagesRead(studioId, clientId);

  logAudit({ actor: authUser.id, target: clientId, orgId: authUser.organizationId ?? null, action: "WRITE", resourceType: "client_message", table: "client_notes", resourceId: entry.id, route: req.path, ip: getClientIp(req as any) });
  res.status(201).json({ entry });
});

router.post("/:clientId/note", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;
  const { body } = req.body;

  if (!body || typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: body.trim(),
      noteType: "general",
      visibility: "professional_only",
      entryType: "note",
      sender: "pro",
    })
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  logClientActivity(
    studioId,
    clientId,
    authUser.id,
    "note_added",
    "note",
    entry.id,
    { sender: "pro" }
  );

  notifyClientOfNote(clientId);

  logAudit({ actor: authUser.id, target: clientId, orgId: authUser.organizationId ?? null, action: "WRITE", resourceType: "client_note", table: "client_notes", resourceId: entry.id, route: req.path, ip: getClientIp(req as any) });
  res.status(201).json({ entry });
});

router.delete("/:clientId/entry/:entryId", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId, entryId } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found" });
    return;
  }

  if (await getStudioVideoMessage(studioId, clientId, entryId)) {
    await hideProStudioMessageForViewer(
      req,
      res,
      authUser,
      studioId,
      clientId,
      entryId,
      "video_message",
    );
    return;
  }

  const [existing] = await db
    .select({
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
    })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.id, entryId),
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId)
      )
    )
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  if (existing.entryType === "message" && existing.visibility === "shared_with_client") {
    await hideProStudioMessageForViewer(
      req,
      res,
      authUser,
      studioId,
      clientId,
      entryId,
      "client_note",
    );
    return;
  }

  const [deleted] = await db
    .delete(clientNotes)
    .where(
      and(
        eq(clientNotes.id, entryId),
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId)
      )
    )
    .returning({ id: clientNotes.id });

  if (!deleted) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const action = existing.entryType === "note" ? "note_deleted" : "message_deleted";
  logClientActivity(
    studioId,
    clientId,
    authUser.id,
    action as any,
    existing.entryType,
    entryId,
    { deletedBy: "pro" }
  );

  res.json({ ok: true });
});

router.post("/:clientId/voice-message", requireWorkspaceAccess, upload.single("audio"), async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;

  if (!req.file) {
    res.status(400).json({ error: "audio file is required" });
    return;
  }

  const mimeType = normalizeVoiceMimeType(req.file.mimetype || "audio/webm");
  if (!mimeType) {
    res.status(400).json({ error: "Audio must be a supported WebM, MP4, M4A, AAC, MP3, WAV, or OGG file" });
    return;
  }
  const buffer = req.file.buffer;

  if (buffer.length > 15 * 1024 * 1024) {
    res.status(400).json({ error: "Audio file too large (max 15 MB)" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  let entry;
  try {
    entry = await createStudioVoiceNote({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: "🎤 Voice note — transcribing…",
      entryType: "message",
      visibility: "shared_with_client",
      sender: "pro",
      mimeType,
    }, buffer);
  } catch (error) {
    console.error("[ProVoiceMessage] Could not store or queue voice message:", error);
    res.status(502).json({ error: "Voice message upload failed. Please retry." });
    return;
  }

  logClientActivity(studioId, clientId, authUser.id, "message_sent", "message", entry.id, { type: "voice" });
  notifyClientOfMessage(clientId);

  res.json({
    entry: {
      ...entry,
      contentType: "voice",
      transcriptStatus: "pending",
      moderationStatus: "pending",
    },
  });
});

router.post("/:clientId/voice-note", requireWorkspaceAccess, upload.single("audio"), async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;

  if (!req.file) {
    res.status(400).json({ error: "audio file is required" });
    return;
  }

  const mimeType = normalizeVoiceMimeType(req.file.mimetype || "audio/webm");
  if (!mimeType) {
    res.status(400).json({ error: "Audio must be a supported WebM, MP4, M4A, AAC, MP3, WAV, or OGG file" });
    return;
  }
  const buffer = req.file.buffer;

  if (buffer.length > 15 * 1024 * 1024) {
    res.status(400).json({ error: "Audio file too large (max 15 MB)" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  let entry;
  try {
    entry = await createStudioVoiceNote({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: "🎤 Voice note — transcribing…",
      entryType: "note",
      visibility: "professional_only",
      sender: "pro",
      mimeType,
    }, buffer);
  } catch (error) {
    console.error("[ProVoiceNote] Could not store or queue voice note:", error);
    res.status(502).json({ error: "Voice note upload failed. Please retry." });
    return;
  }

  logClientActivity(studioId, clientId, authUser.id, "note_added", "note", entry.id, { type: "voice" });

  res.json({
    entry: {
      ...entry,
      contentType: "voice",
      transcriptStatus: "pending",
      moderationStatus: "pending",
    },
  });
});

router.get("/audio/:entryId", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { entryId } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(403).json({ error: "No studio found" });
    return;
  }

  const result = await db.execute(sql`
    SELECT id, audio_object_key, audio_storage_backend, audio_mime_type,
           studio_id, client_user_id, content_type, transcript_status, moderation_status
    FROM client_notes
    WHERE id = ${entryId}
      AND studio_id = ${studioId}
      AND content_type = 'voice'
      AND NOT EXISTS (
        SELECT 1
        FROM studio_message_viewer_deletions hidden
        WHERE hidden.viewer_user_id = ${authUser.id}
          AND hidden.client_note_id = client_notes.id
      )
    LIMIT 1
  `);

  const note = result.rows[0] as any;
  if (!note?.audio_object_key) {
    res.status(404).json({ error: "Voice note not found" });
    return;
  }

  const backend = resolveVoiceStorageBackend(note.audio_storage_backend);
  if (backend === "replit") {
    const availability = await getStudioVoiceObjectAvailability(note.audio_object_key);
    if (availability === "missing") {
      res.status(410).json({ error: "Audio is no longer available" });
      return;
    }
    if (availability === "unavailable") {
      res.status(503).json({ error: "Audio playback is temporarily unavailable" });
      return;
    }

    if (req.query.stream === "1") {
      if (!isValidStudioVoicePlaybackToken(req.query.access, entryId, authUser.id)) {
        res.status(403).json({ error: "Playback access expired" });
        return;
      }
      res.set({
        "Cache-Control": "no-store, private",
        "Content-Type": note.audio_mime_type || "audio/webm",
      });
      getStudioVoiceStream(note.audio_object_key)
        .on("error", () => {
          if (!res.headersSent) res.status(503).end();
        })
        .pipe(res);
      return;
    }

    const access = issueStudioVoicePlaybackToken(entryId, authUser.id);
    const url = `/api/pro/tablet/audio/${entryId}?stream=1&access=${encodeURIComponent(access)}`;
    res.set("Cache-Control", "no-store, private");
    res.json({
      url,
      privatePlayback: true,
      transcriptStatus: note.transcript_status,
      moderationStatus: note.moderation_status,
    });
    return;
  }

  // Legacy records retain their existing read-only S3 route. New voice writes
  // never use this adapter.
  const url = await getSignedPlaybackUrl(note.audio_object_key);
  res.json({ url, transcriptStatus: note.transcript_status, moderationStatus: note.moderation_status });
});

export default router;
