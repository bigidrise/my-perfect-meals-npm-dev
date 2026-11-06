import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { ConciergeGoalSchema } from "../../../shared/coaching/schemas";
import { isCoachDestinationId } from "../../../shared/coaching/navigation";
import type { ConciergePresentation } from "../../../shared/coaching/types";
import { pendingNavigationIsFresh, isConfirmableNavigation } from "./conciergeNavigationContinuity";

export type PendingRecommendation = NonNullable<ConciergePresentation["navigation"]>;
const StoredNavigation = z.object({
  state: z.enum(["recommendation_pending", "navigation_confirmed", "direct_navigation"]),
  destinationId: z.string().refine(isCoachDestinationId),
  goal: ConciergeGoalSchema,
  offeredAt: z.string().optional(),
  performedAt: z.string().datetime().optional(),
});

/** Read the latest assistant only: never resurrect a superseded recommendation
 * from text history or a rolling summary. No schema or new session store. */
export async function loadRecentNavigation(
  conversationId: string, ownerId: string,
): Promise<PendingRecommendation | undefined> {
  try {
    const result = await db.execute<{ structured_payload: any; created_at: Date | string }>(sql`
      SELECT m.structured_payload, m.created_at
      FROM coach_messages m
      JOIN coach_conversations c ON c.id = m.conversation_id
      WHERE c.id = ${conversationId} AND c.owner_id = ${ownerId}
        AND c.specialization = 'corner' AND c.status = 'open'
        AND m.role = 'assistant'
      ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    `);
    const parsed = StoredNavigation.safeParse(
      result.rows[0]?.structured_payload?.presentation?.navigation,
    );
    if (!parsed.success) return undefined;
    // Legacy immediate offers use their actual stored timestamp. Never scan
    // older messages or renew the original age after an informational reply.
    const offeredAt = parsed.data.offeredAt ??
      (result.rows[0]?.created_at instanceof Date
        ? result.rows[0].created_at.toISOString() : result.rows[0]?.created_at);
    if (!pendingNavigationIsFresh(offeredAt)) return undefined;
    return { ...parsed.data, offeredAt } as PendingRecommendation;
  } catch {
    // An unavailable record is not authorization. A fresh named direct request
    // can still be validated independently; "yes" cannot.
    console.warn("[ChefConcierge] pending_recommendation_unavailable");
    return undefined;
  }
}

export async function loadPendingRecommendation(
  conversationId: string, ownerId: string,
): Promise<PendingRecommendation | undefined> {
  const recent = await loadRecentNavigation(conversationId, ownerId);
  return isConfirmableNavigation(recent) ? recent : undefined;
}
