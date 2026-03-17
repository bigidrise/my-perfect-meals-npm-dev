import { Router, Request, Response } from "express";
import { db } from "../db";
import { clientNotes, studioMemberships } from "../db/schema/studio";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { eq, and } from "drizzle-orm";

const router = Router();

const COACH_USER_ID = process.env.COACH_IDRISE_USER_ID || "6796ce88-dff8-4336-adcb-e53986830f3f";
const COACH_STUDIO_ID = process.env.COACH_IDRISE_STUDIO_ID || "041e92f8-2694-442f-83fa-306cebdc5393";

router.post("/notify-coach", requireAuth, async (req: Request, res: Response) => {
  res.json({ ok: true });

  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    console.error("[CoachNotify] No authenticated user");
    return;
  }

  const { coachSlug } = req.body;
  if (coachSlug !== "idrise") {
    console.error("[CoachNotify] Unknown coach slug:", coachSlug);
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
        studioId: COACH_STUDIO_ID,
        clientUserId,
        status: "active",
        workspace: "trainer",
      });
      console.log(`[CoachNotify] Created studio membership for client ${clientUserId}`);
    }

    const messageBody = [
      "🔔 New Client Assignment",
      "",
      `Email: ${clientEmail}`,
      "",
      "This client has completed payment and selected you as their coach.",
      "Please contact them within 24 hours.",
    ].join("\n");

    await db.insert(clientNotes).values({
      studioId: COACH_STUDIO_ID,
      clientUserId,
      authorUserId: clientUserId,
      body: messageBody,
      entryType: "message",
      sender: "client",
      visibility: "shared_with_client",
    });

    console.log(`[CoachNotify] Message created for coach - client: ${clientUserId}`);
  } catch (err) {
    console.error("[CoachNotify] Failed:", err);
  }
});

export default router;
