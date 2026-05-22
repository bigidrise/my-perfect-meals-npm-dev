import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { requireWorkspaceAccess } from "../middleware/requireWorkspaceAccess";
import { logAudit, getClientIp } from "../lib/auditLog";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { moderateContent, BLOCKED_MESSAGE } from "../services/tabletModerationService";
import { notifyClientOfMessage, notifyClientOfNote } from "../services/tabletNotificationService";
import { logClientActivity } from "../services/activityLog";
import { sql } from "drizzle-orm";
import multer from "multer";
import {
  uploadVoiceToS3,
  getVoiceObjectKey,
  getSignedPlaybackUrl,
  MAX_VOICE_DURATION_SEC,
} from "../services/tabletVoiceService";
import { startVoiceJobWorker } from "../services/voiceJobWorker";

startVoiceJobWorker();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

router.get("/unread-summary", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.json({ clients: [], totalUnread: 0 });
    return;
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
    GROUP BY cn.client_user_id
  `);

  const clients = (result.rows as any[]).map((r: any) => ({
    clientUserId: r.clientUserId,
    unreadCount: Number(r.unreadCount) || 0,
    lastMessageAt: r.lastMessageAt,
    lastMessageBody: r.lastMessageBody,
  }));

  const totalUnread = clients.reduce((sum, c) => sum + c.unreadCount, 0);

  res.set("Cache-Control", "no-store");
  res.json({ clients, totalUnread });
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
        eq(clientNotes.sender, "client")
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
        eq(clientNotes.clientUserId, clientId)
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);

  markMessagesRead(studioId, clientId);

  const isClientOnly = (tags: string[] | null) =>
    Array.isArray(tags) && tags.includes("visibleTo:client");

  const messages = entries.filter(
    e => e.entryType === "message" && !isClientOnly(e.tags)
  );
  const notes = entries.filter(e => e.entryType === "note");

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

  const moderation = moderateContent(body.trim());
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

  if (moderation.severity === "low") {
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

  const [existing] = await db
    .select({ entryType: clientNotes.entryType })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.id, entryId),
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId)
      )
    )
    .limit(1);

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

  const action = existing?.entryType === "note" ? "note_deleted" : "message_deleted";
  logClientActivity(
    studioId,
    clientId,
    authUser.id,
    action as any,
    existing?.entryType || "message",
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

  const mimeType = req.file.mimetype || "audio/webm";
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

  const placeholder = "🎤 Voice note — transcribing…";

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: placeholder,
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "pro",
      contentType: "voice",
      audioMimeType: mimeType,
      transcriptStatus: "pending",
      moderationStatus: "pending",
    } as any)
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  const objectKey = getVoiceObjectKey(entry.id, mimeType);

  await uploadVoiceToS3(buffer, mimeType, objectKey);

  await db.execute(sql`
    UPDATE client_notes SET audio_object_key = ${objectKey} WHERE id = ${entry.id}
  `);

  await db.execute(sql`
    INSERT INTO tablet_voice_jobs (note_id, status) VALUES (${entry.id}, 'pending')
  `);

  logClientActivity(studioId, clientId, authUser.id, "message_sent", "message", entry.id, { type: "voice" });
  notifyClientOfMessage(clientId);

  res.json({
    entry: {
      ...entry,
      contentType: "voice",
      audioObjectKey: objectKey,
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

  const mimeType = req.file.mimetype || "audio/webm";
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

  const placeholder = "🎤 Voice note — transcribing…";

  const [entry] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: placeholder,
      noteType: "general",
      visibility: "professional_only",
      entryType: "note",
      sender: "pro",
      contentType: "voice",
      audioMimeType: mimeType,
      transcriptStatus: "pending",
      moderationStatus: "pending",
    } as any)
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      visibility: clientNotes.visibility,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  const objectKey = getVoiceObjectKey(entry.id, mimeType);

  await uploadVoiceToS3(buffer, mimeType, objectKey);

  await db.execute(sql`
    UPDATE client_notes SET audio_object_key = ${objectKey} WHERE id = ${entry.id}
  `);

  await db.execute(sql`
    INSERT INTO tablet_voice_jobs (note_id, status) VALUES (${entry.id}, 'pending')
  `);

  logClientActivity(studioId, clientId, authUser.id, "note_added", "note", entry.id, { type: "voice" });

  res.json({
    entry: {
      ...entry,
      contentType: "voice",
      audioObjectKey: objectKey,
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
    SELECT id, audio_object_key, studio_id, client_user_id, content_type, transcript_status, moderation_status
    FROM client_notes
    WHERE id = ${entryId}
      AND studio_id = ${studioId}
      AND content_type = 'voice'
    LIMIT 1
  `);

  const note = result.rows[0] as any;
  if (!note?.audio_object_key) {
    res.status(404).json({ error: "Voice note not found" });
    return;
  }

  const url = await getSignedPlaybackUrl(note.audio_object_key);
  res.json({ url, transcriptStatus: note.transcript_status, moderationStatus: note.moderation_status });
});

export default router;
