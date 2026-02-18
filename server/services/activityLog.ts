import { db } from "../db";
import { clientActivityLog, studioMemberships } from "../db/schema/studio";
import { eq } from "drizzle-orm";

type ActivityAction =
  | "membership_created" | "membership_activated" | "membership_paused"
  | "builder_assigned" | "board_created" | "board_updated" | "board_deleted"
  | "program_updated" | "macros_updated" | "settings_changed"
  | "invite_sent" | "invite_accepted" | "note_added";

export async function logClientActivity(
  studioId: string,
  clientUserId: string,
  actorUserId: string,
  action: ActivityAction,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  try {
    await db.insert(clientActivityLog).values({
      studioId,
      clientUserId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function logClientActivityForStudioMember(
  clientUserId: string,
  actorUserId: string,
  action: ActivityAction,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const [membership] = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, clientUserId));

    if (!membership) return false;

    await logClientActivity(
      membership.studioId,
      clientUserId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata
    );
    return true;
  } catch (error) {
    console.error("Error in logClientActivityForStudioMember:", error);
    return false;
  }
}

export function logActivityFireAndForget(
  clientUserId: string,
  actorUserId: string,
  action: ActivityAction,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
): void {
  logClientActivityForStudioMember(
    clientUserId,
    actorUserId,
    action,
    entityType,
    entityId,
    metadata
  ).catch(err => console.error("Fire-and-forget activity log failed:", err));
}
