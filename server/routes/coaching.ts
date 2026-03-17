import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { clientNotes, studioMemberships } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { eq, and, sql } from "drizzle-orm";
import { resolveCoach, isValidCoachSlug, coaches } from "../config/coaches";
import { sendCoachActivationEmail } from "../services/emailService";

const router = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

const ASSIGNMENT_TAG = "system:new_client_assignment";
const OVERDUE_HOURS = 24;

async function verifyCoachingPayment(
  stripeSessionId: string,
  expectedUserId: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!stripe) return { valid: false, reason: "Stripe not configured" };

  try {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (session.status !== "complete" && session.payment_status !== "paid") {
      return { valid: false, reason: `Session not paid: status=${session.status}, payment_status=${session.payment_status}` };
    }

    if (session.metadata?.userId !== expectedUserId) {
      return { valid: false, reason: `User mismatch: session.userId=${session.metadata?.userId}, authUser=${expectedUserId}` };
    }

    if (session.metadata?.sku !== "mpm_guidance") {
      return { valid: false, reason: `Wrong SKU: session.sku=${session.metadata?.sku}` };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Stripe lookup failed: ${err?.message}` };
  }
}

router.post("/notify-coach", requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    return res.status(401).json({ ok: false, error: "Unauthenticated" });
  }

  const { coachSlug, stripeSessionId } = req.body;

  if (!coachSlug || !isValidCoachSlug(coachSlug)) {
    return res.status(400).json({ ok: false, error: "Invalid coach slug" });
  }

  if (!stripeSessionId || typeof stripeSessionId !== "string") {
    return res.status(400).json({ ok: false, error: "Missing stripeSessionId" });
  }

  const paymentCheck = await verifyCoachingPayment(stripeSessionId, authUser.id);
  if (!paymentCheck.valid) {
    console.error(`[CoachNotify] Payment verification failed for user ${authUser.id}: ${paymentCheck.reason}`);
    return res.status(403).json({ ok: false, error: "Payment verification failed" });
  }

  const coach = resolveCoach(coachSlug);
  if (!coach) {
    return res.status(500).json({ ok: false, error: "Coach config not found" });
  }

  const clientUserId = authUser.id;
  const clientEmail = authUser.email || "unknown";

  try {
    const existingMembership = await db
      .select({ id: studioMemberships.id, status: studioMemberships.status })
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, clientUserId))
      .limit(1);

    if (existingMembership.length === 0) {
      await db.insert(studioMemberships).values({
        studioId: coach.studioId,
        clientUserId,
        status: "invited",
        workspace: "trainer",
      });
      console.log(`[CoachNotify] Membership created (invited) — coach: ${coach.slug}, client: ${clientUserId}`);
    } else {
      console.log(`[CoachNotify] Membership already exists (status: ${existingMembership[0].status}) — skipping insert`);
    }

    const assignmentTagJson = JSON.stringify([ASSIGNMENT_TAG]);
    const existingNote = await db
      .select({ id: clientNotes.id })
      .from(clientNotes)
      .where(
        and(
          eq(clientNotes.clientUserId, clientUserId),
          sql`${clientNotes.tags}::jsonb @> ${assignmentTagJson}::jsonb`
        )
      )
      .limit(1);

    if (existingNote.length > 0) {
      console.log(`[CoachNotify] Assignment note already exists — skipping duplicate`);
      return res.json({ ok: true, duplicate: true });
    }

    const messageBody = [
      `New Client Assignment`,
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
      title: "New Client Assignment",
      body: messageBody,
      entryType: "message",
      sender: "client",
      visibility: "shared_with_client",
      tags: [ASSIGNMENT_TAG],
    });

    console.log(`[CoachNotify] Assignment notification created — coach: ${coach.slug}, client: ${clientUserId}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[CoachNotify] Failed:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

router.post("/activate-client/:clientId", requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    return res.status(401).json({ ok: false, error: "Unauthenticated" });
  }

  const coachEntry = Object.values(coaches).find(
    (c) => process.env[c.userIdEnv] === authUser.id
  );
  if (!coachEntry) {
    return res.status(403).json({ ok: false, error: "Not a registered coach" });
  }

  const { clientId } = req.params;

  const coach = resolveCoach(coachEntry.slug);
  if (!coach) {
    return res.status(500).json({ ok: false, error: "Coach config error" });
  }

  try {
    const membership = await db
      .select({ id: studioMemberships.id, status: studioMemberships.status })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, clientId),
          eq(studioMemberships.studioId, coach.studioId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(404).json({ ok: false, error: "Client membership not found" });
    }

    if (membership[0].status === "active") {
      return res.status(200).json({ ok: true, alreadyActive: true });
    }

    await db
      .update(studioMemberships)
      .set({
        status: "active",
        joinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studioMemberships.clientUserId, clientId),
          eq(studioMemberships.studioId, coach.studioId)
        )
      );

    console.log(`[CoachActivate] Client activated — coach: ${coachEntry.slug}, client: ${clientId}`);

    const appUrl = process.env.APP_URL || "https://myperfectmeals.com";
    try {
      const [clientUser] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clientId));

      if (clientUser?.email) {
        await sendCoachActivationEmail({
          to: clientUser.email,
          coachDisplayName: coach.displayName,
          appUrl,
        });
      }
    } catch (emailErr) {
      console.error("[CoachActivate] Email failed (non-fatal):", emailErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[CoachActivate] Failed:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

router.get("/queue/new-clients", requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser?.id) {
    return res.status(401).json({ ok: false, error: "Unauthenticated" });
  }

  const coachEntry = Object.values(coaches).find(
    (c) => process.env[c.userIdEnv] === authUser.id
  );
  if (!coachEntry) {
    return res.status(403).json({ ok: false, error: "Not a registered coach" });
  }

  const coach = resolveCoach(coachEntry.slug);
  if (!coach) {
    return res.status(500).json({ ok: false, error: "Coach config error" });
  }

  try {
    const memberships = await db
      .select({
        id: studioMemberships.id,
        clientUserId: studioMemberships.clientUserId,
        status: studioMemberships.status,
        joinedAt: studioMemberships.joinedAt,
        createdAt: studioMemberships.createdAt,
      })
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, coach.studioId));

    const clientIds = memberships.map((m) => m.clientUserId);

    const assignmentNotes: Record<string, { body: string; createdAt: Date }> = {};
    if (clientIds.length > 0) {
      const notes = await db
        .select({
          clientUserId: clientNotes.clientUserId,
          body: clientNotes.body,
          createdAt: clientNotes.createdAt,
        })
        .from(clientNotes)
        .where(
          and(
            eq(clientNotes.studioId, coach.studioId),
            sql`${clientNotes.tags}::jsonb @> ${JSON.stringify([ASSIGNMENT_TAG])}::jsonb`
          )
        );

      for (const note of notes) {
        assignmentNotes[note.clientUserId] = {
          body: note.body,
          createdAt: note.createdAt,
        };
      }
    }

    const now = Date.now();
    const queue = memberships.map((m) => {
      const note = assignmentNotes[m.clientUserId];
      const paidAt = m.createdAt;
      const hoursSincePaid = Math.floor((now - new Date(paidAt).getTime()) / (1000 * 60 * 60));
      const overdue = m.status === "invited" && hoursSincePaid >= OVERDUE_HOURS;

      const emailLine = note?.body
        .split("\n")
        .find((l) => l.startsWith("Email:"));
      const clientEmail = emailLine ? emailLine.replace("Email:", "").trim() : "—";

      return {
        clientUserId: m.clientUserId,
        clientEmail,
        status: m.status,
        paidAt: paidAt.toISOString(),
        activatedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
        hoursSincePaid,
        overdue,
      };
    });

    queue.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
    });

    return res.json({ ok: true, clients: queue });
  } catch (err) {
    console.error("[CoachQueue] Failed:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
