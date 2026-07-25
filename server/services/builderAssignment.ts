import { db } from "../db";
import { users } from "@shared/schema";
import { studioMemberships } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { logClientActivity } from "./activityLog";

export const VALID_BUILDERS = [
  "weekly",
  "diabetic",
  "glp1",
  "anti_inflammatory",
  "beach_body",
  "general_nutrition",
  "performance_competition",
] as const;

export type ValidBuilder = typeof VALID_BUILDERS[number];

export function isValidBuilder(key: string): key is ValidBuilder {
  return (VALID_BUILDERS as readonly string[]).includes(key);
}

export interface BuilderAssignmentResult {
  clientId: string;
  activeBoard: string;
}

/**
 * Authoritative builder assignment service.
 *
 * ## Ownership rule
 * users.activeBoard is the single source of truth for the client's active builder.
 * studioMemberships.assignedBuilder is updated as a follower/cache only — for active
 * memberships only — and must never serve as an authoritative read source.
 *
 * This service is the only place that writes users.activeBoard. Both the studio
 * assignment endpoint (PATCH /studios/:id/clients/:id/assign) and the legacy
 * pro-assign endpoint (POST /api/pro/assign-builder) must call this service so
 * they cannot diverge.
 */
export async function assignBuilder(
  proUserId: string,
  clientUserId: string,
  builderKey: string,
  opts: { studioId?: string; actorLabel?: string } = {}
): Promise<BuilderAssignmentResult> {
  const [updatedClient] = await db
    .update(users)
    .set({ activeBoard: builderKey })
    .where(eq(users.id, clientUserId))
    .returning({ id: users.id, activeBoard: users.activeBoard });

  if (!updatedClient) {
    throw new Error(`Client ${clientUserId} not found`);
  }

  await db
    .update(studioMemberships)
    .set({ assignedBuilder: builderKey, updatedAt: new Date() })
    .where(
      and(
        eq(studioMemberships.clientUserId, clientUserId),
        eq(studioMemberships.status, "active"),
        eq(studioMemberships.isArchived, false)
      )
    );

  if (opts.studioId) {
    const [membership] = await db
      .select({ id: studioMemberships.id })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, clientUserId),
          eq(studioMemberships.studioId, opts.studioId)
        )
      )
      .limit(1);

    if (membership) {
      await logClientActivity(
        opts.studioId,
        clientUserId,
        proUserId,
        "builder_assigned",
        "membership",
        membership.id,
        { assignedBuilder: builderKey, source: opts.actorLabel ?? "pro" }
      ).catch((e) =>
        console.error("⚠️ [BuilderAssignment] Activity log failed:", e)
      );
    }
  }

  return {
    clientId: updatedClient.id,
    activeBoard: updatedClient.activeBoard!,
  };
}
