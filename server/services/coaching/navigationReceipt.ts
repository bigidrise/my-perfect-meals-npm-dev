import { sql } from "drizzle-orm";
import { db } from "../../db";
import type { CoachDestinationId } from "../../../shared/coaching/navigation";
import { PENDING_NAVIGATION_TTL_MS } from "./conciergeNavigationContinuity";

/** Client-observed route evidence, scoped to the exact owner's offered action. */
export async function recordNavigationPerformed(
  ownerId: string, messageId: string, destinationId: CoachDestinationId,
): Promise<boolean> {
  const result = await db.execute(sql`
    WITH source AS (
      SELECT m.id, m.conversation_id,
        m.structured_payload #>> '{presentation,navigation,offeredAt}' AS offered_at
      FROM coach_messages m JOIN coach_conversations c ON c.id = m.conversation_id
      WHERE m.id = ${messageId} AND c.owner_id = ${ownerId}
        AND c.specialization = 'corner' AND c.status = 'open' AND m.role = 'assistant'
        AND m.created_at > ${new Date(Date.now() - PENDING_NAVIGATION_TTL_MS)}
        AND (
          m.structured_payload #>> '{presentation,navigation,offeredAt}' IS NULL OR (
            m.structured_payload #>> '{presentation,navigation,offeredAt}' > ${new Date(Date.now() - PENDING_NAVIGATION_TTL_MS).toISOString()}
            AND m.structured_payload #>> '{presentation,navigation,offeredAt}' <= ${new Date().toISOString()}
          )
        )
        AND m.structured_payload #>> '{presentation,destinationId}' = ${destinationId}
        AND m.structured_payload #>> '{presentation,navigation,destinationId}' = ${destinationId}
        AND m.structured_payload #>> '{presentation,navigation,state}'
          IN ('navigation_confirmed', 'direct_navigation')
    )
    UPDATE coach_messages m
    SET structured_payload = jsonb_set(m.structured_payload,
      '{presentation,navigation,performedAt}', to_jsonb(${new Date().toISOString()}::text), true)
    FROM source
    WHERE m.conversation_id = source.conversation_id
      AND m.role = 'assistant'
      AND m.structured_payload #>> '{presentation,navigation,destinationId}' = ${destinationId}
      AND (m.id = source.id OR (source.offered_at IS NOT NULL AND
        m.structured_payload #>> '{presentation,navigation,offeredAt}' = source.offered_at))
    RETURNING m.id
  `);
  return result.rows.length > 0;
}
