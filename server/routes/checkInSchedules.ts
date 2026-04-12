// server/routes/checkInSchedules.ts
// CRUD for check-in schedules + alert preferences
// Coaches POST a schedule when they set a follow-up date.
// The background cron reads this table to send timed alerts to both sides.

import { Router, Request, Response } from "express";
import { db } from "../db";
import { checkInSchedules, checkInAlertPrefs, studios, clientNotes } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and, gt, isNull, or } from "drizzle-orm";
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

  res.status(201).json({ schedule: created });
});

// ─── GET /api/check-in-schedules?clientId=xxx ────────────────────────────────
// List all check-in schedules for a given client (coach or client can call this).
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const clientId = req.query.clientId as string | undefined;
  if (!clientId) return res.status(400).json({ error: "clientId query param required" });

  const rows = await db
    .select()
    .from(checkInSchedules)
    .where(eq(checkInSchedules.clientUserId, clientId))
    .orderBy(checkInSchedules.dueAt);

  res.json({ schedules: rows });
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
