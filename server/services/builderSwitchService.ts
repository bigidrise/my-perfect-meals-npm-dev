import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface BuilderSwitchStatus {
  changesUsed: number;
  changesRemaining: number;
  changeLimit: number;
  canSwitch: boolean;
  isUnlimited: boolean;
}

export async function getBuilderSwitchStatus(userId: string): Promise<BuilderSwitchStatus> {
  const [user] = await db
    .select({
      builderSwitchUnlimited: users.builderSwitchUnlimited,
      builderChangesUsed: users.builderChangesUsed,
      builderChangeLimit: users.builderChangeLimit,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { changesUsed: 0, changesRemaining: 4, changeLimit: 4, canSwitch: true, isUnlimited: false };
  }

  if (user.builderSwitchUnlimited) {
    return { changesUsed: 0, changesRemaining: 999, changeLimit: 999, canSwitch: true, isUnlimited: true };
  }

  const used = user.builderChangesUsed ?? 0;
  const limit = user.builderChangeLimit ?? 4;
  const remaining = Math.max(0, limit - used);

  return {
    changesUsed: used,
    changesRemaining: remaining,
    changeLimit: limit,
    canSwitch: remaining > 0,
    isUnlimited: false,
  };
}

export async function attemptBuilderSwitch(
  userId: string,
  newBuilder: string
): Promise<{ success: boolean; error?: string; status: BuilderSwitchStatus }> {
  const [user] = await db
    .select({
      selectedMealBuilder: users.selectedMealBuilder,
      builderSwitchUnlimited: users.builderSwitchUnlimited,
      builderChangesUsed: users.builderChangesUsed,
      builderChangeLimit: users.builderChangeLimit,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  if (user.selectedMealBuilder === newBuilder) {
    const status = await getBuilderSwitchStatus(userId);
    return { success: true, status };
  }

  if (user.builderSwitchUnlimited) {
    await db.update(users).set({ selectedMealBuilder: newBuilder, activeBoard: newBuilder }).where(eq(users.id, userId));
    const status = await getBuilderSwitchStatus(userId);
    return { success: true, status };
  }

  const used = user.builderChangesUsed ?? 0;
  const limit = user.builderChangeLimit ?? 4;

  if (used >= limit) {
    const status = await getBuilderSwitchStatus(userId);
    return {
      success: false,
      error: `You've used all ${limit} builder changes during beta testing. Contact support if you need additional access.`,
      status,
    };
  }

  await db
    .update(users)
    .set({
      selectedMealBuilder: newBuilder,
      activeBoard: newBuilder,
      builderChangesUsed: used + 1,
    })
    .where(eq(users.id, userId));

  const status = await getBuilderSwitchStatus(userId);
  return { success: true, status };
}

export async function recordInitialBuilderSelection(userId: string, builder: string): Promise<void> {
  const [user] = await db
    .select({ selectedMealBuilder: users.selectedMealBuilder })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.selectedMealBuilder) return;

  await db.update(users).set({ selectedMealBuilder: builder }).where(eq(users.id, userId));
}
