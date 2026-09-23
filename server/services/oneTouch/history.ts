import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "@shared/schema";
import {
  emptyOneTouchHistory,
  oneTouchHistorySchema,
  type OneTouchCreator,
  type OneTouchHistory,
  type OneTouchHistoryEntry,
} from "@shared/oneTouch";

const MAX_HISTORY = 96;

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