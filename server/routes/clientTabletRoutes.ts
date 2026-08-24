import { Router, Request, Response } from "express";
import multer from "multer";
import { db } from "../db";
import { clientNotes, studios, studioMemberships, studioVideoMedia, studioVideoMessages } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import { users } from "../../shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { moderateContent, BLOCKED_MESSAGE } from "../services/tabletModerationService";
import { notifyProfessionalOfMessage } from "../services/tabletNotificationService";
import { logClientActivity } from "../services/activityLog";
import { sendCoachMessageAlert } from "../services/emailService";
import {
  getSignedPlaybackUrl,
  uploadVoiceToS3,
  getVoiceObjectKey,
} from "../services/tabletVoiceService";
import { getOrSet, invalidatePrefix } from "../services/queryCache";
import { requireClientWorkspaceAccess } from "../middleware/requireWorkspaceAccess";
import {
  assertStudioVideoFeatureEnabled,
  auditStudioVideoAction,
  auditStudioVideoListAction,
  getStudioVideoMessage,
  isValidStudioVideoPlaybackToken,
  issueStudioVideoPlaybackToken,
  listStudioVideoMessages,
} from "../services/studioVideoMessageService";
import {
  assertStudioVideoReadyForPlayback,
  assertStudioVideoTransition,
  canReplayStudioVideo,
  completeStudioVideoWatch,
  createVerifiedWatchProgress,
  recordVerifiedWatchProgress,
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

const CLIENT_TABLET_TTL_MS = 15_000;

function invalidateClientTabletCache(clientUserId: string): void {
  invalidatePrefix(`client-tablet:${clientUserId}`);
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_STUDIO_VIDEO_SIZE_BYTES } });

const router = Router();

async function getActiveProLink(clientUserId: string) {
  const [link] = await db
    .select({
      proUserId: clientLinks.proUserId,
    })
    .from(clientLinks)
    .where(
      and(
        eq(clientLinks.clientUserId, clientUserId),
        eq(clientLinks.active, true)
      )
    )
    .limit(1);
  return link ?? null;
}

async function getStudioIdByOwner(proUserId: string): Promise<string | null> {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);
  return studio?.id ?? null;
}

async function getStudioIdByMembership(clientUserId: string): Promise<string | null> {
  const [membership] = await db
    .select({ studioId: studioMemberships.studioId })
    .from(studioMemberships)
    .where(eq(studioMemberships.clientUserId, clientUserId))
    .limit(1);
  return membership?.studioId ?? null;
}

async function resolveStudioId(clientUserId: string): Promise<string | null> {
  const link = await getActiveProLink(clientUserId);
  if (link) {
    return await getStudioIdByOwner(link.proUserId);
  }
  return await getStudioIdByMembership(clientUserId);
}

function studioVideoError(res: Response, error: unknown): boolean {
  if (error instanceof Error && error.message.startsWith("STUDIO_VIDEO_MESSAGES_DISABLED")) {
    res.status(503).json({ error: "Video messages are temporarily unavailable" });
    return true;
  }
  return false;
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

router.post("/video-message", requireClientWorkspaceAccess, videoUpload.single("video"), async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
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
  if (!["video/webm", "video/mp4", "video/quicktime"].includes(req.file.mimetype)) {
    res.status(400).json({ error: "Video must be WebM, MP4, or MOV" });
    return;
  }
  const durationSec = parseVideoDuration(req.body.durationSec);
  if (!durationSec) {
    res.status(400).json({ error: `Video duration must be between 1 and ${MAX_STUDIO_VIDEO_DURATION_SEC} seconds` });
    return;
  }
  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }
  const [studio] = await db
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studio) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }

  const [message] = await db
    .insert(studioVideoMessages)
    .values({
      studioId,
      clientUserId: authUser.id,
      authorUserId: authUser.id,
      recipientUserId: studio.ownerUserId,
      sender: "client",
      visibility: "shared_with_client",
      body: "Video message",
      transcriptStatus: "pending",
    })
    .returning({ id: studioVideoMessages.id, createdAt: studioVideoMessages.createdAt });
  await db.insert(studioVideoMedia).values({
    messageId: message.id,
    state: "draft",
    mimeType: req.file.mimetype,
    durationSec,
    sizeBytes: req.file.size,
    temporaryDerivativeKeys: [],
    moderationStatus: "pending",
  });
  auditStudioVideoAction({
    req, event: "message_created", actorUserId: authUser.id, targetUserId: authUser.id,
    studioId, messageId: message.id, metadata: { sender: "client" },
  });

  assertStudioVideoTransition({ currentState: "draft", nextState: "uploading", now: new Date() });
  await db.update(studioVideoMedia)
    .set({ state: "uploading", updatedAt: new Date() })
    .where(eq(studioVideoMedia.messageId, message.id));
  auditStudioVideoAction({
    req, event: "upload_started", actorUserId: authUser.id, targetUserId: authUser.id,
    studioId, messageId: message.id, metadata: { sizeBytes: req.file.size },
  });

  try {
    const objectKey = getStudioVideoObjectKey(message.id, req.file.mimetype);
    await uploadStudioVideoToS3(req.file.buffer, req.file.mimetype, objectKey);
    assertStudioVideoTransition({ currentState: "uploading", nextState: "uploaded", now: new Date() });
    await db.update(studioVideoMedia)
      .set({ state: "uploaded", objectKey, updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    assertStudioVideoTransition({ currentState: "uploaded", nextState: "processing", now: new Date() });
    await db.update(studioVideoMedia)
      .set({ state: "processing", updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    auditStudioVideoAction({
      req, event: "transcription_requested", actorUserId: authUser.id, targetUserId: authUser.id,
      studioId, messageId: message.id, metadata: {},
    });
    let transcript: string;
    try {
      ({ transcript } = await transcribeStudioVideoBuffer(req.file.buffer, req.file.mimetype));
      await db.update(studioVideoMessages)
        .set({ transcript, transcriptStatus: "completed", transcribedAt: new Date(), updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      auditStudioVideoAction({
        req, event: "transcription_completed", actorUserId: authUser.id, targetUserId: authUser.id,
        studioId, messageId: message.id, metadata: {},
      });
    } catch {
      await db.update(studioVideoMessages)
        .set({ transcriptStatus: "failed", updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      await db.update(studioVideoMedia)
        .set({ state: "transcription_failed", updatedAt: new Date() })
        .where(eq(studioVideoMedia.messageId, message.id));
      res.status(422).json({ error: "We could not verify this video message. Please try recording it again." });
      return;
    }
    const moderation = moderateContent(transcript);
    if (!moderation.allowed) {
      await db.update(studioVideoMessages)
        .set({ transcriptStatus: "blocked", updatedAt: new Date() })
        .where(eq(studioVideoMessages.id, message.id));
      await db.update(studioVideoMedia)
        .set({ state: "moderation_failed", moderationStatus: "blocked", moderatedAt: new Date(), updatedAt: new Date() })
        .where(eq(studioVideoMedia.messageId, message.id));
      auditStudioVideoAction({
        req, event: "moderation_completed", actorUserId: authUser.id, targetUserId: authUser.id,
        studioId, messageId: message.id, metadata: { approved: false },
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
  } catch {
    await db.update(studioVideoMedia)
      .set({ state: "upload_failed", updatedAt: new Date() })
      .where(eq(studioVideoMedia.messageId, message.id));
    res.status(502).json({ error: "Video upload failed. Please try again." });
    return;
  }

  auditStudioVideoAction({
    req, event: "upload_completed", actorUserId: authUser.id, targetUserId: authUser.id,
    studioId, messageId: message.id, metadata: { mimeType: req.file.mimetype, durationSec },
  });
  auditStudioVideoAction({
    req, event: "moderation_completed", actorUserId: authUser.id, targetUserId: authUser.id,
    studioId, messageId: message.id, metadata: { approved: true },
  });
  logClientActivity(studioId, authUser.id, authUser.id, "message_sent", "message", message.id, { type: "video", sender: "client" });
  invalidateClientTabletCache(authUser.id);
  const [clientUser] = await db
    .select({ firstName: users.firstName, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  const clientName = clientUser?.nickname || clientUser?.firstName || "Client";
  notifyProfessionalOfMessage(authUser.id, clientName);

  res.set("Cache-Control", "no-store");
  res.status(201).json({
    entry: {
      id: message.id,
      body: "Video message",
      authorUserId: authUser.id,
      entryType: "message",
      visibility: "shared_with_client",
      sender: "client",
      contentType: "video",
      videoMediaState: "ready",
      videoDurationSec: durationSec,
      createdAt: message.createdAt,
    },
  });
});

router.get("/video/:messageId/playback", requireClientWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }
  const record = await getStudioVideoMessage(studioId, authUser.id, req.params.messageId);
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
  const url = `/api/client/tablet/video/${record.message.id}/playback?stream=1&access=${encodeURIComponent(access)}`;
  auditStudioVideoAction({
    req, event: "playback_authorized", actorUserId: authUser.id, targetUserId: authUser.id,
    studioId, messageId: record.message.id, metadata: { actorRole: "client" },
  });
  res.set("Cache-Control", "no-store, private");
  res.json({
    url,
    durationSec: record.media.durationSec,
    expiresAt: record.media.expiresAt,
    watchCompletedAt: record.media.watchCompletedAt,
  });
});

router.post("/video/:messageId/progress", requireClientWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }
  const record = await getStudioVideoMessage(studioId, authUser.id, req.params.messageId);
  if (!record) {
    res.status(404).json({ error: "Video message not found" });
    return;
  }
  if (!canReplayStudioVideo({
    state: record.media.state,
    objectKey: record.media.objectKey,
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
  const update: Record<string, unknown> = { watchProgress: result.progress, updatedAt: new Date() };
  if (result.complete && record.media.state === "ready") {
    const completion = completeStudioVideoWatch({
      currentState: "ready",
      progress: result.progress,
      completedAt: new Date(),
    });
    update.state = completion.state;
    update.watchCompletedAt = new Date(completion.watchCompletedAt);
    update.expiresAt = new Date(completion.expiresAt);
    auditStudioVideoAction({
      req, event: "watch_completion_recorded", actorUserId: authUser.id, targetUserId: authUser.id,
      studioId, messageId: record.message.id,
      metadata: { coverageRatio: Number(result.coverageRatio.toFixed(3)), verified: true },
    });
    auditStudioVideoAction({
      req, event: "expiration_started", actorUserId: authUser.id, targetUserId: authUser.id,
      studioId, messageId: record.message.id, metadata: { windowHours: 24 },
    });
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

router.get("/", requireClientWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const cacheKey = `client-tablet:${authUser.id}`;
  const payload = await getOrSet(cacheKey, CLIENT_TABLET_TTL_MS, async () => {
    const studioId = await resolveStudioId(authUser.id);
    if (!studioId) {
      return null; // caller handles 404
    }

    const result = await db.execute(sql`
      SELECT
        id,
        body,
        author_user_id AS "authorUserId",
        entry_type     AS "entryType",
        sender,
        created_at     AS "createdAt",
        content_type   AS "contentType",
        audio_object_key  AS "audioObjectKey",
        audio_duration_sec AS "audioDurationSec",
        transcript,
        transcript_status AS "transcriptStatus"
      FROM client_notes
      WHERE client_user_id = ${authUser.id}
        AND entry_type     = 'message'
        AND visibility     = 'shared_with_client'
      ORDER BY created_at ASC
      LIMIT 200
    `);

    const videoMessages = await listStudioVideoMessages(studioId, authUser.id);
    return {
      messages: [...(result.rows as any[]), ...videoMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    };
  });

  if (payload === null) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }

  const videoMessages = (payload.messages as any[]).filter(
    (message) => message.contentType === "video",
  );
  for (const video of videoMessages) {
    auditStudioVideoListAction({
      req,
      actorUserId: authUser.id,
      targetUserId: authUser.id,
      messageId: video.id,
    });
  }
  res.set("Cache-Control", "no-store");
  res.json(payload);
});

router.post("/message", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { body } = req.body;
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }

  const moderation = moderateContent(body.trim());
  if (!moderation.allowed) {
    logClientActivity(
      studioId,
      authUser.id,
      authUser.id,
      "message_blocked",
      "message",
      undefined,
      { severity: moderation.severity, category: moderation.category, reason: moderation.reason, sender: "client" }
    );
    res.status(422).json({
      error: BLOCKED_MESSAGE,
      severity: moderation.severity,
      category: moderation.category,
      reason: moderation.reason,
    });
    return;
  }

  if (moderation.severity === "low") {
    logClientActivity(
      studioId,
      authUser.id,
      authUser.id,
      "message_flagged",
      "message",
      undefined,
      { severity: moderation.severity, reason: moderation.reason, sender: "client" }
    );
  }

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: authUser.id,
      authorUserId: authUser.id,
      body: body.trim(),
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "client",
    })
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  logClientActivity(
    studioId,
    authUser.id,
    authUser.id,
    "message_sent",
    "message",
    entry.id,
    { sender: "client" }
  );

  // Invalidate the cached message list so the client sees their own message
  // on the very next poll, not after the TTL expires.
  invalidateClientTabletCache(authUser.id);

  const [clientUser] = await db
    .select({ firstName: users.firstName, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  const clientName = clientUser?.nickname || clientUser?.firstName || "Client";

  notifyProfessionalOfMessage(authUser.id, clientName);

  (async () => {
    try {
      const [studio] = await db
        .select({ ownerUserId: studios.ownerUserId })
        .from(studios)
        .where(eq(studios.id, studioId))
        .limit(1);
      if (!studio) return;

      const [coach] = await db
        .select({ email: users.email, firstName: users.firstName, nickname: users.nickname })
        .from(users)
        .where(eq(users.id, studio.ownerUserId))
        .limit(1);
      if (!coach?.email) return;

      const coachName = coach.nickname || coach.firstName || "Coach";
      await sendCoachMessageAlert({
        to: coach.email,
        coachName,
        clientName,
        messagePreview: body.trim(),
        portalUrl: `${process.env.PUBLIC_APP_URL || "https://app.myperfectmeals.ai"}/pro/clients`,
      });
    } catch (err) {
      console.warn("[CoachAlert] Non-fatal email error:", err);
    }
  })();

  res.status(201).json({ entry });
});

router.post("/voice-message", upload.single("audio"), async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "audio file is required" });
    return;
  }

  const mimeType = req.file.mimetype || "audio/webm";
  const buffer = req.file.buffer;

  if (buffer.length > 15 * 1024 * 1024) {
    res.status(400).json({ error: "Audio file too large (max 15 MB)" });
    return;
  }

  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }

  const placeholder = "🎤 Voice message — transcribing…";

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: authUser.id,
      authorUserId: authUser.id,
      body: placeholder,
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "client",
      contentType: "voice",
      audioMimeType: mimeType,
      transcriptStatus: "pending",
      moderationStatus: "pending",
    } as any)
    .returning({ id: clientNotes.id, createdAt: clientNotes.createdAt });

  const objectKey = getVoiceObjectKey(entry.id, mimeType);
  await uploadVoiceToS3(buffer, mimeType, objectKey);

  await db.execute(sql`
    UPDATE client_notes SET audio_object_key = ${objectKey} WHERE id = ${entry.id}
  `);

  await db.execute(sql`
    INSERT INTO tablet_voice_jobs (note_id, status) VALUES (${entry.id}, 'pending')
  `);

  logClientActivity(
    studioId,
    authUser.id,
    authUser.id,
    "message_sent",
    "message",
    entry.id,
    { type: "voice", sender: "client" }
  );

  const [clientUser] = await db
    .select({ firstName: users.firstName, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  const clientName = clientUser?.nickname || clientUser?.firstName || "Client";

  notifyProfessionalOfMessage(authUser.id, clientName);

  (async () => {
    try {
      const [studio] = await db
        .select({ ownerUserId: studios.ownerUserId })
        .from(studios)
        .where(eq(studios.id, studioId))
        .limit(1);
      if (!studio) return;

      const [coach] = await db
        .select({ email: users.email, firstName: users.firstName, nickname: users.nickname })
        .from(users)
        .where(eq(users.id, studio.ownerUserId))
        .limit(1);
      if (!coach?.email) return;

      const coachName = coach.nickname || coach.firstName || "Coach";
      await sendCoachMessageAlert({
        to: coach.email,
        coachName,
        clientName,
        messagePreview: "🎤 Sent you a voice message",
        portalUrl: `${process.env.PUBLIC_APP_URL || "https://app.myperfectmeals.ai"}/pro/clients`,
      });
    } catch (err) {
      console.warn("[CoachAlert] Non-fatal email error:", err);
    }
  })();

  res.status(201).json({
    entry: {
      id: entry.id,
      body: placeholder,
      sender: "client",
      entryType: "message",
      contentType: "voice",
      transcriptStatus: "pending",
      audioObjectKey: objectKey,
      createdAt: entry.createdAt,
    },
  });
});

router.delete("/entry/:entryId", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { entryId } = req.params;

  const studioId = await resolveStudioId(authUser.id);

  const [deleted] = await db
    .delete(clientNotes)
    .where(
      and(
        eq(clientNotes.id, entryId),
        eq(clientNotes.clientUserId, authUser.id),
        eq(clientNotes.entryType, "message"),
        eq(clientNotes.visibility, "shared_with_client")
      )
    )
    .returning({ id: clientNotes.id });

  if (!deleted) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  if (studioId) {
    logClientActivity(
      studioId,
      authUser.id,
      authUser.id,
      "message_deleted",
      "message",
      entryId,
      { deletedBy: "client" }
    );
  }

  res.json({ ok: true });
});

router.get("/audio/:entryId", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { entryId } = req.params;

  const result = await db.execute(sql`
    SELECT id, audio_object_key, client_user_id, visibility, content_type,
           transcript_status, moderation_status, transcript
    FROM client_notes
    WHERE id = ${entryId}
      AND client_user_id = ${authUser.id}
      AND content_type = 'voice'
      AND visibility = 'shared_with_client'
    LIMIT 1
  `);

  const note = result.rows[0] as any;
  if (!note?.audio_object_key) {
    res.status(404).json({ error: "Voice note not found" });
    return;
  }

  if (note.moderation_status === "blocked") {
    res.status(403).json({ error: "This voice note has been removed" });
    return;
  }

  if (note.transcript_status !== "completed") {
    res.status(202).json({ pending: true, message: "Transcript not yet available" });
    return;
  }

  const url = await getSignedPlaybackUrl(note.audio_object_key);
  res.json({ url, transcript: note.transcript, transcriptStatus: note.transcript_status });
});

export default router;
