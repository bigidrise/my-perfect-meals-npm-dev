import { sql } from "drizzle-orm";
import { db } from "../db";

// A role-changing approval does not bind an old Studio verification marker to
// the newly approved licensed identity. No credential-review writer is added
// in Stage 2; this boundary cannot be cleared by payment or another approval.
export async function identityRequiresIndependentCredentialReview(userId: string): Promise<boolean> {
  const result = await db.execute(sql`SELECT event.id
    FROM professional_identity_events event
    JOIN professional_identity_requests request ON request.id = event.request_id
    JOIN users account ON account.id = request.owner_user_id
    WHERE account.id = ${userId} AND event.event_type = 'identity_approved'
      AND event.metadata->>'roleChanged' = 'true'
      AND account.professional_role IN ('physician','dietitian','nurse_practitioner')
      AND event.metadata->>'approvedIdentity' = account.professional_role
    ORDER BY event.created_at DESC, event.request_revision DESC LIMIT 1`);
  return result.rows.length > 0;
}
