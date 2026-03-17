import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios } from "../db/schema/studio";
import { eq, and, asc } from "drizzle-orm";
import { requireWorkspaceAccess } from "../middleware/requireWorkspaceAccess";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { moderateContent, BLOCKED_MESSAGE } from "../services/tabletModerationService";
import { notifyClientOfMessage, notifyClientOfNote } from "../services/tabletNotificationService";
import { logClientActivity } from "../services/activityLog";

const router = Router();

async function getProStudioId(proUserId: string): Promise<string | null> {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);
  return studio?.id ?? null;
}

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
      createdAt: clientNotes.createdAt,
    })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId)
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);

  const messages = entries.filter(e => e.entryType === "message");
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

export default router;
