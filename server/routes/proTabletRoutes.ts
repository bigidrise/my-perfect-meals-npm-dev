import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios } from "../db/schema/studio";
import { eq, and, desc, asc } from "drizzle-orm";
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

router.get("/:clientId", requireWorkspaceAccess, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  const { clientId } = req.params;

  const studioId = await getProStudioId(authUser.id);
  if (!studioId) {
    res.status(404).json({ error: "No studio found for this professional" });
    return;
  }

  const notes = await db
    .select({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
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
    .limit(100);

  res.json({ notes });
});

router.post("/:clientId", requireWorkspaceAccess, async (req: Request, res: Response) => {
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

  const [note] = await db
    .insert(clientNotes)
    .values({
      studioId,
      clientUserId: clientId,
      authorUserId: authUser.id,
      body: body.trim(),
      noteType: "general",
      visibility: "professional_only",
    })
    .returning({
      id: clientNotes.id,
      body: clientNotes.body,
      authorUserId: clientNotes.authorUserId,
      createdAt: clientNotes.createdAt,
    });

  res.status(201).json({ note });
});

export default router;
