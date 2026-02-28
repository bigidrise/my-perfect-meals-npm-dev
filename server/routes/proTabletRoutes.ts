import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios } from "../db/schema/studio";
import { eq, and, asc, desc, lt, sql } from "drizzle-orm";
import { requireWorkspaceAccess } from "../middleware/requireWorkspaceAccess";
import { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

async function getProStudioId(proUserId: string): Promise<string | null> {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);
  return studio?.id ?? null;
}

router.get("/:clientId/messages", requireWorkspaceAccess, async (req: Request, res: Response) => {
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
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId),
        eq(clientNotes.entryType, "message"),
        eq(clientNotes.deletedByPro, false)
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);

  res.json({ messages: entries });
});

router.post("/:clientId/messages", requireWorkspaceAccess, async (req: Request, res: Response) => {
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
      visibility: "shared_with_client",
      entryType: "message",
      sender: "pro",
    })
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      sender: clientNotes.sender,
      createdAt: clientNotes.createdAt,
    });

  res.status(201).json({ entry });
});

router.patch("/:clientId/messages/:id/delete", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId, id } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const [note] = await db
    .select({
      id: clientNotes.id,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      studioId: clientNotes.studioId,
      clientUserId: clientNotes.clientUserId,
    })
    .from(clientNotes)
    .where(eq(clientNotes.id, id))
    .limit(1);

  if (!note) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  if (note.studioId !== studioId || note.clientUserId !== clientId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (note.entryType !== "message") {
    res.status(400).json({ error: "Can only delete messages via this route" });
    return;
  }

  if (note.authorUserId !== authUser.id) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }

  await db
    .update(clientNotes)
    .set({ deletedByPro: true })
    .where(eq(clientNotes.id, id));

  res.json({ success: true });
});

router.get("/:clientId/notes", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;
  const archived = req.query.archived === "true";

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
      sender: clientNotes.sender,
      archived: clientNotes.archived,
      createdAt: clientNotes.createdAt,
      updatedAt: clientNotes.updatedAt,
    })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId),
        eq(clientNotes.entryType, "note"),
        eq(clientNotes.archived, archived)
      )
    )
    .orderBy(desc(clientNotes.createdAt))
    .limit(200);

  res.json({ notes: entries });
});

router.post("/:clientId/notes", requireWorkspaceAccess, async (req: Request, res: Response) => {
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
      sender: clientNotes.sender,
      archived: clientNotes.archived,
      createdAt: clientNotes.createdAt,
      updatedAt: clientNotes.updatedAt,
    });

  res.status(201).json({ entry });
});

router.patch("/:clientId/notes/:id", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId, id } = req.params;
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

  const [note] = await db
    .select({
      id: clientNotes.id,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      studioId: clientNotes.studioId,
      clientUserId: clientNotes.clientUserId,
    })
    .from(clientNotes)
    .where(eq(clientNotes.id, id))
    .limit(1);

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  if (note.studioId !== studioId || note.clientUserId !== clientId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (note.entryType !== "note") {
    res.status(400).json({ error: "Can only edit notes" });
    return;
  }

  if (note.authorUserId !== authUser.id) {
    res.status(403).json({ error: "You can only edit your own notes" });
    return;
  }

  const [updated] = await db
    .update(clientNotes)
    .set({ body: body.trim(), updatedAt: new Date() })
    .where(eq(clientNotes.id, id))
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      sender: clientNotes.sender,
      archived: clientNotes.archived,
      createdAt: clientNotes.createdAt,
      updatedAt: clientNotes.updatedAt,
    });

  res.json({ entry: updated });
});

router.delete("/:clientId/notes/:id", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId, id } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const [note] = await db
    .select({
      id: clientNotes.id,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      studioId: clientNotes.studioId,
      clientUserId: clientNotes.clientUserId,
    })
    .from(clientNotes)
    .where(eq(clientNotes.id, id))
    .limit(1);

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  if (note.studioId !== studioId || note.clientUserId !== clientId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (note.entryType !== "note") {
    res.status(400).json({ error: "Can only delete notes via this route" });
    return;
  }

  if (note.authorUserId !== authUser.id) {
    res.status(403).json({ error: "You can only delete your own notes" });
    return;
  }

  await db.delete(clientNotes).where(eq(clientNotes.id, id));

  res.json({ success: true });
});

router.patch("/:clientId/notes/:id/archive", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId, id } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const [note] = await db
    .select({
      id: clientNotes.id,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      studioId: clientNotes.studioId,
      clientUserId: clientNotes.clientUserId,
      archived: clientNotes.archived,
    })
    .from(clientNotes)
    .where(eq(clientNotes.id, id))
    .limit(1);

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  if (note.studioId !== studioId || note.clientUserId !== clientId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (note.entryType !== "note") {
    res.status(400).json({ error: "Can only archive notes" });
    return;
  }

  if (note.authorUserId !== authUser.id) {
    res.status(403).json({ error: "You can only archive your own notes" });
    return;
  }

  const [updated] = await db
    .update(clientNotes)
    .set({ archived: !note.archived, updatedAt: new Date() })
    .where(eq(clientNotes.id, id))
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      sender: clientNotes.sender,
      archived: clientNotes.archived,
      createdAt: clientNotes.createdAt,
      updatedAt: clientNotes.updatedAt,
    });

  res.json({ entry: updated });
});

router.patch("/:clientId/notes/bulk-archive", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;
  const { olderThanMonths } = req.body;

  if (!olderThanMonths || ![12, 24, 36].includes(olderThanMonths)) {
    res.status(400).json({ error: "olderThanMonths must be 12, 24, or 36" });
    return;
  }

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);

  const result = await db
    .update(clientNotes)
    .set({ archived: true, updatedAt: new Date() })
    .where(
      and(
        eq(clientNotes.studioId, studioId),
        eq(clientNotes.clientUserId, clientId),
        eq(clientNotes.entryType, "note"),
        eq(clientNotes.authorUserId, authUser.id),
        eq(clientNotes.archived, false),
        lt(clientNotes.createdAt, cutoffDate)
      )
    )
    .returning({ id: clientNotes.id });

  res.json({ archivedCount: result.length });
});

export default router;
