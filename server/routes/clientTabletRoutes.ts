import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/requireAuth";

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

router.get("/messages", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const link = await getActiveProLink(authUser.id);
  if (!link) {
    res.status(404).json({ error: "No active professional connection" });
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
        eq(clientNotes.clientUserId, authUser.id),
        eq(clientNotes.entryType, "message"),
        eq(clientNotes.visibility, "shared_with_client"),
        eq(clientNotes.deletedByClient, false)
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);

  res.json({ messages: entries });
});

router.post("/messages", async (req: Request, res: Response) => {
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

  const link = await getActiveProLink(authUser.id);
  if (!link) {
    res.status(404).json({ error: "No active professional connection" });
    return;
  }

  const studioId = await getStudioIdByOwner(link.proUserId);
  if (!studioId) {
    res.status(404).json({ error: "Professional studio not found" });
    return;
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

  res.status(201).json({ entry });
});

router.patch("/messages/:id/delete", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { id } = req.params;

  const [note] = await db
    .select({
      id: clientNotes.id,
      authorUserId: clientNotes.authorUserId,
      entryType: clientNotes.entryType,
      clientUserId: clientNotes.clientUserId,
    })
    .from(clientNotes)
    .where(eq(clientNotes.id, id))
    .limit(1);

  if (!note) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  if (note.clientUserId !== authUser.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (note.entryType !== "message") {
    res.status(400).json({ error: "Can only delete messages" });
    return;
  }

  if (note.authorUserId !== authUser.id) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }

  await db
    .update(clientNotes)
    .set({ deletedByClient: true })
    .where(eq(clientNotes.id, id));

  res.json({ success: true });
});

export default router;
