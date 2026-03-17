import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studioMemberships } from "../db/schema/studio";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { eq } from "drizzle-orm";
import { resolveCoach, isValidCoachSlug } from "../config/coaches";

const router = Router();

router.post("/notify-coach", requireAuth, async (req: Request, res: Response) => {
  res.json({ ok: true });

  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    console.error("[CoachNotify] No authenticated user");
    return;
  }

  const { coachSlug } = req.body;

  if (!coachSlug || !isValidCoachSlug(coachSlug)) {
    console.error("[CoachNotify] Invalid or missing coach slug:", coachSlug);
    return;
  }

  const coach = resolveCoach(coachSlug);
  if (!coach) {
    console.error("[CoachNotify] Could not resolve coach config for slug:", coachSlug);
    return;
  }

  const clientUserId = authUser.id;
  const clientEmail = authUser.email || "unknown";

  try {
    const existing = await db
      .select({ id: studioMemberships.id })
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, clientUserId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(studioMemberships).values({
        studioId: coach.studioId,
        clientUserId,
        status: "active",
        workspace: "trainer",
      });
      console.log(`[CoachNotify] Created studio membership — coach: ${coach.slug}, client: ${clientUserId}`);
    }

    const messageBody = [
      `🔔 New Client Assignment`,
      "",
      `Email: ${clientEmail}`,
      "",
      `This client has completed payment and selected ${coach.displayName} as their coach.`,
      "Please contact them within 24 hours.",
    ].join("\n");

    await db.insert(clientNotes).values({
      studioId: coach.studioId,
      clientUserId,
      authorUserId: clientUserId,
      body: messageBody,
      entryType: "message",
      sender: "client",
      visibility: "shared_with_client",
    });

    console.log(`[CoachNotify] Notification sent — coach: ${coach.slug}, client: ${clientUserId}`);
  } catch (err) {
    console.error("[CoachNotify] Failed:", err);
  }
});

export default router;
