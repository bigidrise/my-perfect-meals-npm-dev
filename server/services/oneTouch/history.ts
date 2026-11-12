import { eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { db } from "../../db";
import { users } from "@shared/schema";
import {
  emptyOneTouchHistory,
  directionToFingerprint,
  oneTouchHistorySchema,
  oneTouchConceptSetSchema,
  type OneTouchCreator,
  type OneTouchHistory,
  type OneTouchHistoryEntry,
  type OneTouchConceptSet,
} from "@shared/oneTouch";

const MAX_HISTORY = 96;

/**
 * Refresh only a revalidated set's authority. Lock and compare the complete
 * snapshot so a late restore cannot overwrite a newer Menu or another Creator.
 * Unlike generation, this must not append history or replace any idea IDs.
 */
export async function refreshOneTouchConceptAuthority(
  userId: string,
  creator: OneTouchCreator,
  expected: OneTouchConceptSet,
  contextFingerprint: string,
): Promise<boolean> {
  const snapshot = oneTouchConceptSetSchema.safeParse(expected);
  if (!snapshot.success) return false;
  return db.transaction(async transaction => {
    const [row] = await transaction.select({ value: users.oneTouchHistory })
      .from(users).where(eq(users.id, userId)).limit(1).for("update");
    const parsed = oneTouchHistorySchema.safeParse(row?.value);
    if (!parsed.success || !isDeepStrictEqual(parsed.data.workingSets?.[creator], snapshot.data)) return false;
    await transaction.update(users).set({
      oneTouchHistory: {
        ...parsed.data,
        workingSets: {
          ...parsed.data.workingSets,
          [creator]: { ...snapshot.data, contextFingerprint },
        },
      },
    }).where(eq(users.id, userId));
    return true;
  });
}

export async function readOneTouchHistory(userId: string): Promise<OneTouchHistory> {
  const [row] = await db
    .select({ value: users.oneTouchHistory })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const parsed = oneTouchHistorySchema.safeParse(row?.value);
  return parsed.success ? parsed.data : emptyOneTouchHistory();
}

export async function appendOneTouchHistory(
  userId: string,
  creator: OneTouchCreator,
  entries: OneTouchHistoryEntry[],
): Promise<OneTouchHistory> {
  return db.transaction(async (transaction) => {
    const [row] = await transaction
      .select({ value: users.oneTouchHistory })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    const parsed = oneTouchHistorySchema.safeParse(row?.value);
    const current = parsed.success ? parsed.data : emptyOneTouchHistory();
    const next = {
      ...current,
      [creator]: [...entries, ...current[creator]].slice(0, MAX_HISTORY),
    } as OneTouchHistory;
    await transaction
      .update(users)
      .set({ oneTouchHistory: next })
      .where(eq(users.id, userId));
    return next;
  });
}

/** One Creator-owned, server-bound set per Creator. Never stores clinical context. */
export async function saveOneTouchConceptSet(
  userId: string,
  creator: OneTouchCreator,
  set: OneTouchConceptSet,
): Promise<void> {
  return db.transaction(async (transaction) => {
    const [row] = await transaction.select({ value: users.oneTouchHistory })
      .from(users).where(eq(users.id, userId)).limit(1).for("update");
    const parsed = oneTouchHistorySchema.safeParse(row?.value);
    const current = parsed.success ? parsed.data : emptyOneTouchHistory();
    const entries = set.concepts.map((concept) => ({
      ...directionToFingerprint(concept), creator,
    }));
    await transaction.update(users).set({
      oneTouchHistory: {
        ...current,
        workingSets: { ...current.workingSets, [creator]: set },
        ideaHistory: {
          create_a_dish: current.ideaHistory?.create_a_dish ?? [],
          craving_creator: current.ideaHistory?.craving_creator ?? [],
          [creator]: [...entries, ...(current.ideaHistory?.[creator] ?? [])].slice(0, MAX_HISTORY),
        },
      },
    }).where(eq(users.id, userId));
  });
}