import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studios, studioMemberships } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import { users } from "../../shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { moderateContent, BLOCKED_MESSAGE } from "../services/tabletModerationService";
import { notifyProfessionalOfMessage } from "../services/tabletNotificationService";
import { logClientActivity } from "../services/activityLog";
import { sendCoachMessageAlert } from "../services/emailService";

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

router.get("/", async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const studioId = await resolveStudioId(authUser.id);
  if (!studioId) {
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
        eq(clientNotes.visibility, "shared_with_client")
      )
    )
    .orderBy(asc(clientNotes.createdAt))
    .limit(200);

  res.set("Cache-Control", "no-store");
  res.json({ messages: entries });
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
        portalUrl: "https://app.myperfectmeals.com/pro/clients",
      });
    } catch (err) {
      console.warn("[CoachAlert] Non-fatal email error:", err);
    }
  })();

  res.status(201).json({ entry });
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

export default router;
