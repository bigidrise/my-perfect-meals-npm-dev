import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { ConciergeGoalSchema } from "../../../shared/coaching/schemas";
import { isCoachDestinationId } from "../../../shared/coaching/navigation";
import type { ConciergePresentation } from "../../../shared/coaching/types";

export type PendingRecommendation = NonNullable<ConciergePresentation["navigation"]>;
const StoredNavigation = z.object({
  state: z.literal("recommendation_pending"),
  destinationId: z.string().refine(isCoachDestinationId),
  goal: ConciergeGoalSchema,
});

/** Read the latest assistant only: never resurrect a superseded recommendation
 * from text history or a rolling summary. No schema or new session store. */
export async function loadPendingRecommendation(
  conversationId: string, ownerId: string,
): Promise<PendingRecommendation | undefined> {
  try {
    const result = await db.execute<{ structured_payload: any }>(sql`
      SELECT m.structured_payload
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
    return parsed.success ? parsed.data as PendingRecommendation : undefined;
  } catch {
    // An unavailable record is not authorization. A fresh named direct request
    // can still be validated independently; "yes" cannot.
    console.warn("[ChefConcierge] pending_recommendation_unavailable");
    return undefined;
  }
}
