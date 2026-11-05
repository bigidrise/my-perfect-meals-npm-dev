import { sql } from "drizzle-orm";
import type { db } from "../../db";

/**
 * Called inside a transaction. Clear the account's open personal Ask Chef
 * history, not just the first row bootstrap happened to select.
 * Other subjects, specializations, archived chats and owners remain untouched.
 */
export async function clearChefConversation(
  tx: Pick<typeof db, "execute">, ownerId: string, conversationId: string,
) {
  const result = await tx.execute<{
    owner_id: string; specialization: string; subject_type: string; subject_id: string;
  }>(sql`SELECT owner_id, specialization, subject_type, subject_id
    FROM coach_conversations WHERE id = ${conversationId} FOR UPDATE`);
  const conversation = result.rows[0];
  if (!conversation) return { status: 404, body: { error: "Conversation not found" } };
  if (conversation.owner_id !== ownerId) return { status: 403, body: { error: "Forbidden" } };

  const scope = sql`SELECT id FROM coach_conversations
    WHERE owner_id = ${ownerId}
      AND specialization = ${conversation.specialization}
      AND subject_type = ${conversation.subject_type}
      AND subject_id = ${conversation.subject_id}
      AND (id = ${conversationId} OR (${conversation.specialization === "corner"} AND status = 'open'))`;
  // Lock the exact rows before removing their children.
  await tx.execute(sql`${scope} FOR UPDATE`);
  await tx.execute(sql`DELETE FROM coach_messages WHERE conversation_id IN (${scope})`);
  await tx.execute(sql`DELETE FROM coach_investigations WHERE conversation_id IN (${scope})`);
  await tx.execute(sql`DELETE FROM coach_action_plans WHERE conversation_id IN (${scope})`);
  await tx.execute(sql`DELETE FROM coach_conversations WHERE id IN (${scope})`);
  return { status: 200, body: { success: true } };
}
