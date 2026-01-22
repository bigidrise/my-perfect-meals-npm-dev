import { db } from "../db";
import { builderSwitchHistory, users } from "../../shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const SWITCH_LIMIT = 3;
const WINDOW_MONTHS = 12;

// FEATURE FLAG: Set to true to enforce builder switch limits
const ENFORCE_SWITCH_LIMITS = false;

export interface BuilderSwitchStatus {
  switchesUsed: number;
  switchesRemaining: number;
  canSwitch: boolean;
  nextSwitchAvailable: Date | null;
  recentSwitches: Array<{
    fromBuilder: string | null;
    toBuilder: string;
    switchedAt: Date;
  }>;
}

function getWindowStartDate(): Date {
  const now = new Date();
  now.setMonth(now.getMonth() - WINDOW_MONTHS);
  return now;
}

export async function getBuilderSwitchStatus(userId: string): Promise<BuilderSwitchStatus> {
  const windowStart = getWindowStartDate();
  
  const switches = await db
    .select()
    .from(builderSwitchHistory)
    .where(
      and(
        eq(builderSwitchHistory.userId, userId),
        gte(builderSwitchHistory.switchedAt, windowStart)
      )
    )
    .orderBy(desc(builderSwitchHistory.switchedAt));
  
  const switchesUsed = switches.length;
  const switchesRemaining = Math.max(0, SWITCH_LIMIT - switchesUsed);
  const canSwitch = switchesRemaining > 0;
  
  let nextSwitchAvailable: Date | null = null;
  if (!canSwitch && switches.length > 0) {
    const oldestSwitch = switches[switches.length - 1];
    const oldestDate = new Date(oldestSwitch.switchedAt);
    oldestDate.setMonth(oldestDate.getMonth() + WINDOW_MONTHS);
    nextSwitchAvailable = oldestDate;
  }
  
  return {
    switchesUsed,
    switchesRemaining,
    canSwitch,
    nextSwitchAvailable,
    recentSwitches: switches.map(s => ({
      fromBuilder: s.fromBuilder,
      toBuilder: s.toBuilder,
      switchedAt: new Date(s.switchedAt),
    })),
  };
}

export async function attemptBuilderSwitch(
  userId: string,
  newBuilder: string
): Promise<{ success: boolean; error?: string; status: BuilderSwitchStatus }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    throw new Error("User not found");
  }
  
  const currentBuilder = user.selectedMealBuilder;
  
  if (currentBuilder === newBuilder) {
    const status = await getBuilderSwitchStatus(userId);
    return {
      success: false,
      error: "You're already using this meal builder.",
      status,
    };
  }
  
  const status = await getBuilderSwitchStatus(userId);
  
  // Only enforce limits if the feature flag is enabled
  if (ENFORCE_SWITCH_LIMITS && !status.canSwitch) {
    const nextDate = status.nextSwitchAvailable
      ? status.nextSwitchAvailable.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "later this year";
    
    return {
      success: false,
      error: `You've used all ${SWITCH_LIMIT} builder switches for this year. Your next switch will be available on ${nextDate}.`,
      status,
    };
  }
  
  await db.insert(builderSwitchHistory).values({
    userId,
    fromBuilder: currentBuilder,
    toBuilder: newBuilder,
  });
  
  await db
    .update(users)
    .set({ selectedMealBuilder: newBuilder })
    .where(eq(users.id, userId));
  
  const newStatus = await getBuilderSwitchStatus(userId);
  
  return {
    success: true,
    status: newStatus,
  };
}

export async function recordInitialBuilderSelection(
  userId: string,
  builder: string
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    throw new Error("User not found");
  }
  
  if (user.selectedMealBuilder) {
    return;
  }
  
  await db
    .update(users)
    .set({ selectedMealBuilder: builder })
    .where(eq(users.id, userId));
}
