/**
 * Coaching Engine API Routes
 *
 * POST /api/coach/message — Send a message to the coaching engine
 * GET  /api/coach/conversation — Get the current open conversation
 * GET  /api/coach/conversation/:id/messages — Get messages for a conversation
 *
 * Phase 2: corner specialization only.
 * Phase 7+: pregnancy and pediatric added via the adapter registry.
 *
 * Authentication: requireAuth per-route (not router.use — see router-global-requireauth-bug.md)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { engine } from "../services/coaching/engine";
import type { CoachSpecialization } from "../../shared/coaching/types";
import { emitActivityEvent } from "../services/coaching/activityEvents";
import type { PlatformEventType, EventClass } from "../services/coaching/activityEvents";
import { coachingProfiles } from "../db/schema/ace";

const router = Router();

// ─── POST /message ────────────────────────────────────────────────────────────

const MessageBodySchema = z.object({
  specialization: z.enum(["corner"]).default("corner"), // Phase 2: corner only
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

router.post("/message", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = MessageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
  }

  const { specialization, message, conversationId } = parsed.data;

  // ── Server-side intake gate ────────────────────────────────────────────────
  // The UI redirect is UX — this is the governance boundary.
  // The engine depends on coach_profile_completed_at to know HOW to communicate
  // with this person. Reject anyone who hasn't completed behavioral intake.
  const [profile] = await db
    .select({ completedAt: coachingProfiles.coachProfileCompletedAt })
    .from(coachingProfiles)
    .where(eq(coachingProfiles.userId, userId))
    .limit(1);

  if (!profile?.completedAt) {
    return res.status(403).json({
      error: "Coaching profile not completed",
      code: "INTAKE_REQUIRED",
    });
  }

  try {
    const result = await engine.run(
      {
        specialization: specialization as CoachSpecialization,
        subject: {
          subjectType: "user",
          subjectId: userId,
          ownerId: userId,
        },
        userMessage: message,
        conversationId: conversationId ?? "",
      },
      req
    );

    return res.json({
      conversationId: result.conversationId,
      messageId: result.messageId,
      response: {
        whatIFound: result.whatIFound,
        whatItCouldMean: result.whatItCouldMean,
        todayPlan: result.todayPlan,
        learningOpportunity: result.learningOpportunity,
      },
      meta: result.meta,
    });
  } catch (err: any) {
    if (err.status === 400 || err.status === 403 || err.status === 401) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[CoachingEngine] POST /message error:", err);
    return res.status(500).json({ error: "Coaching engine error" });
  }
});

// ─── GET /conversation ────────────────────────────────────────────────────────

router.get("/conversation", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const specialization = (req.query.specialization as string) || "corner";

  try {
    const result = await db.execute<{
      id: string;
      specialization: string;
      status: string;
      last_message_at: string | null;
      created_at: string;
    }>(sql`
      SELECT id, specialization, status, last_message_at, created_at
      FROM coach_conversations
      WHERE owner_id = ${userId}
        AND specialization = ${specialization}
        AND status = 'open'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ conversation: null });
    }

    return res.json({ conversation: result.rows[0] });
  } catch (err: any) {
    console.error("[CoachingEngine] GET /conversation error:", err);
    return res.status(500).json({ error: "Failed to load conversation" });
  }
});

// ─── GET /conversation/:id/messages ──────────────────────────────────────────

router.get("/conversation/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);

  try {
    // Verify ownership
    const convo = await db.execute<{ id: string }>(sql`
      SELECT id FROM coach_conversations
      WHERE id = ${id} AND owner_id = ${userId}
      LIMIT 1
    `);
    if (convo.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db.execute<{
      id: string;
      role: string;
      content: string;
      structured_payload: any;
      created_at: string;
    }>(sql`
      SELECT id, role, content, structured_payload, created_at
      FROM coach_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);

    return res.json({ messages: messages.rows });
  } catch (err: any) {
    console.error("[CoachingEngine] GET /conversation/:id/messages error:", err);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

// ─── POST /activity-event ─────────────────────────────────────────────────────
// Lightweight client-callable endpoint for emitting consumption/engagement events.
// Used by Add-to-Macros buttons and other client-side confirmed-consumption actions.

const ActivityEventSchema = z.object({
  eventType: z.string().min(1),
  eventClass: z.enum(["usage", "engagement", "consumption", "outcome"]),
  sourceFeature: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/activity-event", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ActivityEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
  }

  const { eventType, eventClass, sourceFeature, entityType, entityId, metadata } = parsed.data;

  emitActivityEvent({
    ownerUserId: userId,
    eventType: eventType as PlatformEventType,
    eventClass: eventClass as EventClass,
    sourceFeature: sourceFeature as import("../services/coaching/activityEvents").SourceFeature | undefined,
    entityType,
    entityId,
    metadata: metadata as Record<string, unknown> | undefined,
  }).catch((err: Error) => console.error("[ActivityEvents] /activity-event:", err.message));

  return res.json({ ok: true });
});

// ─── GET /plans ───────────────────────────────────────────────────────────────

router.get("/plans", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const plans = await db.execute<{
      id: string;
      why: string;
      success_metric: string;
      next_check_in: string;
      status: string;
      created_at: string;
    }>(sql`
      SELECT id, why, success_metric, next_check_in, status, created_at
      FROM coach_action_plans
      WHERE owner_id = ${userId}
        AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    return res.json({ plans: plans.rows });
  } catch (err: any) {
    console.error("[CoachingEngine] GET /plans error:", err);
    return res.status(500).json({ error: "Failed to load plans" });
  }
});

// ─── Phase 5: Subjective completion ──────────────────────────────────────────

/**
 * POST /api/coach/plans/:planId/items/:itemId/complete
 * User explicitly reports they completed an action item.
 * Guards: must own the plan.
 */
router.post("/plans/:planId/items/:itemId/complete", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { planId, itemId } = req.params;

  try {
    // Verify ownership
    const planCheck = await db.execute<{ id: string }>(sql`
      SELECT id FROM coach_action_plans
      WHERE id = ${planId} AND owner_id = ${userId}
      LIMIT 1
    `);
    if (!planCheck.rows[0]) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Verify item belongs to plan
    const itemCheck = await db.execute<{ id: string }>(sql`
      SELECT id FROM coach_action_items
      WHERE id = ${itemId} AND plan_id = ${planId}
      LIMIT 1
    `);
    if (!itemCheck.rows[0]) {
      return res.status(404).json({ error: "Action item not found" });
    }

    const { markSubjectiveCompletion } = await import("../services/coaching/completionDetector");
    await markSubjectiveCompletion(itemId);

    return res.json({ success: true, itemId, completionSource: "subjective", completionConfidence: "medium" });
  } catch (err: any) {
    console.error("[CoachingEngine] POST /plans/:planId/items/:itemId/complete error:", err);
    return res.status(500).json({ error: "Failed to mark completion" });
  }
});

// ─── Phase 5: Follow-up delivery ─────────────────────────────────────────────

/**
 * GET /api/coach/followup/due
 * Returns the earliest due, undelivered follow-up for the current user.
 * Used by CoachsCorner to trigger inline delivery if the cron hasn't run yet.
 */
router.get("/followup/due", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { findDueFollowupForUser } = await import("../services/coaching/followupWorker");
    const pending = await findDueFollowupForUser(userId);
    return res.json({ followup: pending ?? null });
  } catch (err: any) {
    console.error("[CoachingEngine] GET /followup/due error:", err);
    return res.status(500).json({ error: "Failed to check for due followup" });
  }
});

/**
 * POST /api/coach/followup/:id/deliver
 * Triggers inline delivery of a specific followup.
 * Guards: the followup must belong to the requesting user.
 * Called when CoachsCorner detects a due followup before the cron fires.
 */
router.post("/followup/:id/deliver", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  try {
    // Verify ownership
    const check = await db.execute<{ id: string; owner_id: string }>(sql`
      SELECT id, owner_id FROM coach_followups
      WHERE id = ${id} AND owner_id = ${userId}
      LIMIT 1
    `);
    if (!check.rows[0]) {
      return res.status(404).json({ error: "Followup not found" });
    }
    if (check.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { processFollowup } = await import("../services/coaching/followupWorker");
    const messageId = await processFollowup(id);

    if (!messageId) {
      // Worker is already processing or followup was already delivered
      return res.json({ alreadyDelivered: true });
    }

    return res.json({ success: true, messageId });
  } catch (err: any) {
    console.error("[CoachingEngine] POST /followup/:id/deliver error:", err);
    return res.status(500).json({ error: "Failed to deliver followup" });
  }
});

// ─── GET /bootstrap ───────────────────────────────────────────────────────────
// Single startup call that replaces the old status → conversation → messages
// waterfall. Returns everything CoachsCorner needs to render in one round-trip.
//
// Server-side query plan:
//   Phase 1 (parallel): profile row + open conversation
//   Phase 2 (parallel): messages for that conversation + due follow-up
// Total: 2 DB round-trips instead of the 4 the client was making sequentially.

router.get("/bootstrap", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const specialization = (req.query.specialization as string) || "corner";

  try {
    // ── Phase 1: profile + conversation in parallel ────────────────────────
    const [profileRows, convResult] = await Promise.all([
      db.select().from(coachingProfiles).where(eq(coachingProfiles.userId, userId)).limit(1),
      db.execute<{
        id: string;
        specialization: string;
        status: string;
        last_message_at: string | null;
        created_at: string;
      }>(sql`
        SELECT id, specialization, status, last_message_at, created_at
        FROM coach_conversations
        WHERE owner_id = ${userId}
          AND specialization = ${specialization}
          AND status = 'open'
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 1
      `),
    ]);

    const profile = profileRows[0] ?? null;
    const profileCompleted = !!profile?.coachProfileCompletedAt;
    const conversation = convResult.rows[0] ?? null;
    // convId ownership is proven: the query above filters by owner_id = userId.
    const convId = conversation?.id ?? null;

    // ── Phase 2: messages + due follow-up in parallel ─────────────────────
    const [messagesResult, dueFollowup] = await Promise.all([
      convId
        ? db.execute<{
            id: string;
            role: string;
            content: string;
            structured_payload: any;
            created_at: string;
          }>(sql`
            SELECT id, role, content, structured_payload, created_at
            FROM coach_messages
            WHERE conversation_id = ${convId}
            ORDER BY created_at ASC
            LIMIT 20
          `)
        : Promise.resolve({ rows: [] as any[] }),
      (async () => {
        try {
          const { findDueFollowupForUser } = await import("../services/coaching/followupWorker");
          return await findDueFollowupForUser(userId);
        } catch {
          return null;
        }
      })(),
    ]);

    return res.json({
      profileCompleted,
      profile,
      conversationId: convId,
      messages: messagesResult.rows,
      dueFollowup: dueFollowup ?? null,
    });
  } catch (err: any) {
    console.error("[CoachingEngine] GET /bootstrap error:", err);
    return res.status(500).json({ error: "Failed to load coaching bootstrap" });
  }
});

// ─── DELETE /conversation/:id ─────────────────────────────────────────────────
// Clears the conversation — deletes all messages, investigations, and action
// plans, then removes the conversation row itself. Ownership verified before
// any deletion. Next bootstrap call will return no conversation → empty state.

router.delete("/conversation/:id", requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  try {
    // Verify ownership
    const convCheck = await db.execute<{ owner_id: string }>(sql`
      SELECT owner_id FROM coach_conversations WHERE id = ${id} LIMIT 1
    `);
    const conv = convCheck.rows[0];
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (conv.owner_id !== userId) return res.status(403).json({ error: "Forbidden" });

    // Delete child rows first (FK order), then the conversation itself
    await db.execute(sql`DELETE FROM coach_messages      WHERE conversation_id = ${id}`);
    await db.execute(sql`DELETE FROM coach_investigations WHERE conversation_id = ${id}`);
    await db.execute(sql`DELETE FROM coach_action_plans  WHERE conversation_id = ${id}`);
    await db.execute(sql`DELETE FROM coach_conversations WHERE id = ${id}`);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[CoachingEngine] DELETE /conversation/:id error:", err);
    return res.status(500).json({ error: "Failed to clear conversation" });
  }
});

export default router;

