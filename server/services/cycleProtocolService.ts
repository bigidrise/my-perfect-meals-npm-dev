import { db } from "../db";
import { clientCycleProtocols, clientNotes, studioMemberships, type StrategyType } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { logClientActivity } from "./activityLog";
import { pushToUser } from "./pushNotify";

export { STRATEGY_TYPES } from "../db/schema/studio";
export type { StrategyType } from "../db/schema/studio";

export interface NutritionStrategyInput {
  studioId: string;
  clientUserId: string;
  strategyType: StrategyType;
  coachInstructions: string;
  watchFor?: string | null;
  updatedByUserId: string;
  updatedByRole: "trainer" | "physician";
}

function buildClientMessage(role: string, strategyType: string): string {
  const roleLabel = role === "physician" ? "Your physician" : "Your coach";
  return `${roleLabel} updated your Current Nutrition Strategy to "${strategyType}". Tap to review your instructions.`;
}

async function getActorName(userId: string, fallback: string): Promise<string> {
  const [actor] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return actor
    ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || fallback
    : fallback;
}

export async function upsertNutritionStrategy(
  input: NutritionStrategyInput
): Promise<{ ok: boolean; error?: string }> {
  const { studioId, clientUserId, strategyType, coachInstructions, watchFor, updatedByUserId, updatedByRole } = input;

  const actorName = await getActorName(updatedByUserId, updatedByRole);
  const clientMsg = buildClientMessage(updatedByRole, strategyType);

  const existing = await db
    .select({ strategyVersion: clientCycleProtocols.strategyVersion })
    .from(clientCycleProtocols)
    .where(eq(clientCycleProtocols.clientUserId, clientUserId))
    .limit(1);

  const nextVersion = existing.length > 0 ? (existing[0].strategyVersion ?? 1) + 1 : 1;

  await db.transaction(async (tx) => {
    await tx
      .insert(clientCycleProtocols)
      .values({
        studioId,
        clientUserId,
        strategyType,
        coachInstructions,
        watchFor: watchFor ?? null,
        strategyVersion: nextVersion,
        updatedByUserId,
        updatedByRole,
        updatedAt: new Date(),
        lastViewedAt: null,
        lastViewedByUserId: null,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        acknowledgedVersion: null,
      })
      .onConflictDoUpdate({
        target: clientCycleProtocols.clientUserId,
        set: {
          studioId,
          strategyType,
          coachInstructions,
          watchFor: watchFor ?? null,
          strategyVersion: nextVersion,
          updatedByUserId,
          updatedByRole,
          updatedAt: new Date(),
          lastViewedAt: null,
          lastViewedByUserId: null,
          acknowledgedAt: null,
          acknowledgedByUserId: null,
          acknowledgedVersion: null,
        },
      });

    await tx.insert(clientNotes).values({
      studioId,
      clientUserId,
      authorUserId: updatedByUserId,
      entryType: "message",
      sender: "pro",
      visibility: "shared_with_client",
      body: clientMsg,
      tags: ["system:cycle_protocol_updated"],
    });
  });

  await logClientActivity(
    studioId,
    clientUserId,
    updatedByUserId,
    "cycle_protocol_updated",
    "nutrition_strategy",
    undefined,
    {
      strategyType,
      updatedByRole,
      actorName,
      version: nextVersion,
    }
  );

  pushToUser(clientUserId, {
    title: "Nutrition Strategy Updated",
    body: clientMsg,
    url: "/care-team/trainer",
  }).catch(() => {});

  return { ok: true };
}

export async function getNutritionStrategy(clientUserId: string) {
  const [row] = await db
    .select()
    .from(clientCycleProtocols)
    .where(eq(clientCycleProtocols.clientUserId, clientUserId))
    .limit(1);

  if (!row) return null;

  const actorName = await getActorName(row.updatedByUserId, row.updatedByRole);

  const ackStatus: "not_seen" | "seen" | "acknowledged" =
    row.acknowledgedVersion === row.strategyVersion
      ? "acknowledged"
      : row.lastViewedAt
      ? "seen"
      : "not_seen";

  return {
    id: row.id,
    strategyType: row.strategyType as StrategyType,
    coachInstructions: row.coachInstructions,
    watchFor: row.watchFor,
    strategyVersion: row.strategyVersion,
    updatedByRole: row.updatedByRole,
    updatedByName: actorName,
    updatedAt: row.updatedAt,
    lastViewedAt: row.lastViewedAt,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedVersion: row.acknowledgedVersion,
    ackStatus,
  };
}

export async function markStrategyViewed(
  clientUserId: string,
  viewerUserId: string
): Promise<{ ok: boolean }> {
  const [row] = await db
    .select({ strategyVersion: clientCycleProtocols.strategyVersion, lastViewedAt: clientCycleProtocols.lastViewedAt })
    .from(clientCycleProtocols)
    .where(eq(clientCycleProtocols.clientUserId, clientUserId))
    .limit(1);

  if (!row) return { ok: false };
  if (row.lastViewedAt) return { ok: true };

  await db
    .update(clientCycleProtocols)
    .set({ lastViewedAt: new Date(), lastViewedByUserId: viewerUserId })
    .where(eq(clientCycleProtocols.clientUserId, clientUserId));

  const [membership] = await db
    .select({ studioId: studioMemberships.studioId })
    .from(studioMemberships)
    .where(eq(studioMemberships.clientUserId, clientUserId))
    .limit(1);

  if (membership) {
    logClientActivity(
      membership.studioId,
      clientUserId,
      viewerUserId,
      "nutrition_strategy_viewed",
      "nutrition_strategy",
      undefined,
      { version: row.strategyVersion }
    ).catch(() => {});
  }

  return { ok: true };
}

export async function acknowledgeStrategy(
  clientUserId: string,
  viewerUserId: string,
  studioId: string
): Promise<{ ok: boolean }> {
  const [row] = await db
    .select({
      strategyVersion: clientCycleProtocols.strategyVersion,
      acknowledgedVersion: clientCycleProtocols.acknowledgedVersion,
    })
    .from(clientCycleProtocols)
    .where(eq(clientCycleProtocols.clientUserId, clientUserId))
    .limit(1);

  if (!row) return { ok: false };
  if (row.acknowledgedVersion === row.strategyVersion) return { ok: true };

  await db
    .update(clientCycleProtocols)
    .set({
      acknowledgedAt: new Date(),
      acknowledgedByUserId: viewerUserId,
      acknowledgedVersion: row.strategyVersion,
      lastViewedAt: new Date(),
      lastViewedByUserId: viewerUserId,
    })
    .where(eq(clientCycleProtocols.clientUserId, clientUserId));

  await logClientActivity(
    studioId,
    clientUserId,
    viewerUserId,
    "nutrition_strategy_acknowledged",
    "nutrition_strategy",
    undefined,
    { version: row.strategyVersion }
  );

  return { ok: true };
}
