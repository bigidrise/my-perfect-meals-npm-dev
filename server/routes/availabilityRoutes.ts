import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

const ALLOWED_STATUSES = ["available", "busy", "away", "offline"] as const;

const AvailabilitySchema = z.object({
  availabilityStatus: z.enum(ALLOWED_STATUSES),
  backAt: z.string().datetime({ offset: true }).optional().nullable(),
});

// PATCH /api/professionals/me/availability
// Only users with a professionalRole set (trainer, physician) or role=admin/coach can call this
router.patch("/me/availability", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const userId = authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [caller] = await db
      .select({ role: users.role, professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isProfessional =
      caller?.role === "admin" ||
      caller?.role === "coach" ||
      !!caller?.professionalRole;

    if (!isProfessional) {
      return res.status(403).json({ error: "Only professionals can update availability." });
    }

    const parsed = AvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const { availabilityStatus, backAt } = parsed.data;

    await db.update(users).set({
      availabilityStatus,
      backAt: backAt ? new Date(backAt) : null,
    }).where(eq(users.id, userId));

    console.log(`📡 [AVAILABILITY] ${userId} → ${availabilityStatus}${backAt ? ` (back: ${backAt})` : ""}`);

    // Notify linked clients via in-app tablet message (reuses existing tablet system)
    try {
      await notifyLinkedClients(userId, availabilityStatus, backAt ?? null);
    } catch (notifyErr) {
      console.warn("[AVAILABILITY] Client notification failed (non-fatal):", notifyErr);
    }

    return res.json({ ok: true, availabilityStatus, backAt: backAt ?? null });
  } catch (e) {
    console.error("Availability update error:", e);
    return res.status(500).json({ error: "Failed to update availability" });
  }
});

// GET /api/providers
// Public — returns real availability status for coaches listed on the Meet the Providers page.
// Only exposes id, name, availabilityStatus, backAt — no private data.
router.get("/providers", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        professionalRole: users.professionalRole,
        availabilityStatus: users.availabilityStatus,
        backAt: users.backAt,
      })
      .from(users)
      .where(inArray(users.professionalRole, ["trainer", "physician"] as any[]));

    return res.json({ providers: rows });
  } catch (e) {
    console.error("Providers fetch error:", e);
    return res.status(500).json({ error: "Failed to fetch providers" });
  }
});

// GET /api/users/:id/goal
// Returns a client's goal fields — accessible by coaches who have the client linked
router.get("/users/:id/goal", requireAuth, async (req, res) => {
  try {
    const requestingUserId = (req as AuthenticatedRequest).authUser?.id;
    if (!requestingUserId) return res.status(401).json({ error: "Unauthorized" });

    const targetId = req.params.id;

    // Allow: requesting own goals, or coach/admin
    const [requestor] = await db
      .select({ role: users.role, professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, requestingUserId))
      .limit(1);

    const isCoachOrAdmin =
      requestor?.role === "admin" ||
      requestor?.role === "coach" ||
      !!requestor?.professionalRole;

    const isSelf = requestingUserId === targetId;

    if (!isSelf && !isCoachOrAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [row] = await db
      .select({
        goalType: users.goalType,
        goalTarget: users.goalTarget,
        goalTimelineWeeks: users.goalTimelineWeeks,
        goalStartDate: users.goalStartDate,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "User not found" });

    return res.json(row);
  } catch (e) {
    console.error("Goal fetch error:", e);
    return res.status(500).json({ error: "Failed to fetch goal" });
  }
});

// ── Helper: notify linked clients via the existing tablet (clientNotes) system ──
async function notifyLinkedClients(
  proUserId: string,
  status: string,
  backAt: string | null
) {
  const { clientLinks } = await import("../db/schema/procare");
  const { clientNotes, studios } = await import("../db/schema/studio");

  // Look up the pro's studio (needed for clientNotes.studioId)
  const [studioRow] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId))
    .limit(1);

  if (!studioRow) {
    console.log("[AVAILABILITY] No studio found for pro — skipping client notifications.");
    return;
  }

  const linked = await db
    .select({ clientUserId: clientLinks.clientUserId })
    .from(clientLinks)
    .where(eq(clientLinks.proUserId, proUserId));

  if (!linked.length) return;

  const statusLabel: Record<string, string> = {
    available: "is now available",
    busy: "is currently busy with other clients",
    away: "is away",
    offline: "is offline",
  };

  const backMsg = backAt
    ? ` (expected back: ${new Date(backAt).toLocaleDateString()})`
    : "";

  const body = `Your coach ${statusLabel[status] ?? status}${backMsg}. You can still send messages — they will respond when available.`;

  const inserts = linked.map(({ clientUserId }) => ({
    studioId: studioRow.id,
    clientUserId,
    authorUserId: proUserId,
    noteType: "general" as const,
    visibility: "shared_with_client" as const,
    entryType: "message" as const,
    sender: "pro" as const,
    body,
  }));

  if (inserts.length) {
    await db.insert(clientNotes).values(inserts);
    console.log(`📬 [AVAILABILITY] Notified ${inserts.length} client(s) of status change → ${status}`);
  }
}

export default router;
