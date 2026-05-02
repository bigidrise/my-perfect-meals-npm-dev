// server/routes/checkInSchedules.ts
// CRUD for check-in schedules + alert preferences
// Coaches POST a schedule when they set a follow-up date.
// The background cron reads this table to send timed alerts to both sides.

import { Router, Request, Response } from "express";
import { db } from "../db";
import { checkInSchedules, checkInAlertPrefs, studios, clientNotes, studioMemberships } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and, gt, gte, isNull, or } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { randomUUID } from "crypto";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getStudioForPro(proUserId: string): Promise<string | null> {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);
  return studio?.id ?? null;
}

// ─── POST /api/check-in-schedules ────────────────────────────────────────────
// Coach creates a check-in schedule for a client.
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const proUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!proUserId) return res.status(401).json({ error: "Unauthorized" });

  const { clientUserId, dueAt, note } = req.body;
  if (!clientUserId || !dueAt) {
    return res.status(400).json({ error: "clientUserId and dueAt are required" });
  }

  const studioId = await getStudioForPro(proUserId);
  if (!studioId) return res.status(404).json({ error: "No studio found for this professional" });

  // Security: verify this client actually belongs to the pro's studio
  const [membership] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.clientUserId, clientUserId),
      )
    )
    .limit(1);

  if (!membership) {
    return res.status(403).json({ error: "Client not authorized for this studio" });
  }

  const [created] = await db
    .insert(checkInSchedules)
    .values({
      studioId,
      clientUserId,
      proUserId,
      dueAt: new Date(dueAt),
      note: note?.trim() || null,
      done: false,
      alertsSent: {},
    })
    .returning();

  // Immediate confirmation: post a shared message so the client sees it right away
  try {
    const [coachUser] = await db
      .select({ firstName: users.firstName, nickname: users.nickname })
      .from(users)
      .where(eq(users.id, proUserId))
      .limit(1);
    const coachName = coachUser?.nickname || coachUser?.firstName || "your coach";

    const dateStr = new Date(dueAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await db.insert(clientNotes).values({
      studioId,
      clientUserId,
      authorUserId: "system",
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "pro",
      title: "Check-in Scheduled",
      body: `📅 Your check-in with ${coachName} is scheduled for ${dateStr}.`,
      tags: ["system:check_in_scheduled"],
    });
  } catch (err) {
    console.warn("[CheckIn] Non-fatal: could not post confirmation message", err);
  }

  res.status(201).json({ schedule: created });
});

// ─── GET /api/check-in-schedules?clientId=xxx ────────────────────────────────
// List upcoming (not done, not past-due) check-in schedules for a given client.
// Access allowed if: requester IS the client, OR requester is a pro whose
// studio has this client as a member.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const clientId = req.query.clientId as string | undefined;
  if (!clientId) return res.status(400).json({ error: "clientId query param required" });

  // Authorization: allow if the requester is the client themselves
  let authorized = userId === clientId;

  // Authorization: allow if the requester is a pro whose studio has this client
  if (!authorized) {
    const proStudioId = await getStudioForPro(userId);
    if (proStudioId) {
      const [membership] = await db
        .select({ id: studioMemberships.id })
        .from(studioMemberships)
        .where(
          and(
            eq(studioMemberships.studioId, proStudioId),
            eq(studioMemberships.clientUserId, clientId),
          )
        )
        .limit(1);
      if (membership) authorized = true;
    }
  }

  if (!authorized) {
    return res.status(403).json({ error: "Not authorized to view this client's schedules" });
  }

  const now = new Date();

  const rows = await db
    .select({
      id: checkInSchedules.id,
      dueAt: checkInSchedules.dueAt,
      note: checkInSchedules.note,
      done: checkInSchedules.done,
      coachName: users.firstName,
      coachNickname: users.nickname,
    })
    .from(checkInSchedules)
    .leftJoin(users, eq(checkInSchedules.proUserId, users.id))
    .where(
      and(
        eq(checkInSchedules.clientUserId, clientId),
        eq(checkInSchedules.done, false),
        gte(checkInSchedules.dueAt, now),
      )
    )
    .orderBy(checkInSchedules.dueAt);

  const schedules = rows.map((r) => ({
    id: r.id,
    dueAt: r.dueAt,
    note: r.note,
    done: r.done,
    coachDisplayName: r.coachNickname || r.coachName || "Your Coach",
  }));

  res.json({ schedules });
});

// ─── PATCH /api/check-in-schedules/:id/done ──────────────────────────────────
// Mark a check-in as completed. Cancels future alerts automatically (alertsSent stays).
router.patch("/:id/done", requireAuth, async (req: Request, res: Response) => {
  const proUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!proUserId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  const [updated] = await db
    .update(checkInSchedules)
    .set({ done: true })
    .where(
      and(
        eq(checkInSchedules.id, id),
        eq(checkInSchedules.proUserId, proUserId),
      )
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Schedule not found" });

  // Post a "Check-in completed" system message to the shared thread
  try {
    const [clientUser] = await db
      .select({ firstName: users.firstName, nickname: users.nickname })
      .from(users)
      .where(eq(users.id, updated.clientUserId))
      .limit(1);
    const clientName = clientUser?.nickname || clientUser?.firstName || "Client";

    await db.insert(clientNotes).values({
      studioId: updated.studioId,
      clientUserId: updated.clientUserId,
      authorUserId: "system",
      noteType: "general",
      visibility: "shared_with_client",
      entryType: "message",
      sender: "pro",
      body: `✅ Check-in completed.`,
      tags: ["system:check_in_completed"],
    });
  } catch (err) {
    console.warn("[CheckIn] Non-fatal: could not post completion message", err);
  }

  res.json({ ok: true, schedule: updated });
});

// ─── GET /api/check-in-schedules/prefs ───────────────────────────────────────
// Get alert preferences for the coach's studio. Returns defaults if not set.
router.get("/prefs", requireAuth, async (req: Request, res: Response) => {
  const proUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!proUserId) return res.status(401).json({ error: "Unauthorized" });

  const studioId = await getStudioForPro(proUserId);
  if (!studioId) return res.status(404).json({ error: "No studio found" });

  const [prefs] = await db
    .select()
    .from(checkInAlertPrefs)
    .where(eq(checkInAlertPrefs.studioId, studioId))
    .limit(1);

  res.json({
    prefs: prefs ?? { intervals: ["24h", "1w"], enabled: true },
  });
});

// ─── PUT /api/check-in-schedules/prefs ───────────────────────────────────────
// Update alert preferences for the coach's studio.
router.put("/prefs", requireAuth, async (req: Request, res: Response) => {
  const proUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!proUserId) return res.status(401).json({ error: "Unauthorized" });

  const studioId = await getStudioForPro(proUserId);
  if (!studioId) return res.status(404).json({ error: "No studio found" });

  const { intervals, enabled } = req.body;

  const VALID = new Set(["2h", "24h", "48h", "1w"]);
  const cleanIntervals: string[] = Array.isArray(intervals)
    ? intervals.filter((i: string) => VALID.has(i))
    : ["24h", "1w"];

  const [existing] = await db
    .select({ id: checkInAlertPrefs.id })
    .from(checkInAlertPrefs)
    .where(eq(checkInAlertPrefs.studioId, studioId))
    .limit(1);

  let result;
  if (existing) {
    [result] = await db
      .update(checkInAlertPrefs)
      .set({ intervals: cleanIntervals, enabled: enabled !== false, updatedAt: new Date() })
      .where(eq(checkInAlertPrefs.studioId, studioId))
      .returning();
  } else {
    [result] = await db
      .insert(checkInAlertPrefs)
      .values({ studioId, intervals: cleanIntervals, enabled: enabled !== false })
      .returning();
  }

  res.json({ prefs: result });
});

export default router;
