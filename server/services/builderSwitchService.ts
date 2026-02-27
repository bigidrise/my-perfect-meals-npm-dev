import { db } from "../db";
import { builderSwitchHistory, users } from "../../shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const SWITCH_LIMIT = 3;

// FEATURE FLAG: Set to true to enforce builder switch limits (for regular users only)
// When false: unlimited switches, no tracking for everyone
// When true: 3 switches per subscription year for regular users, admins/testers always unlimited
// No rollover — unused switches do not carry into the next subscription year
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

function getAnchorMonthDay(subscriptionDate: Date): { month: number; day: number } {
  const month = subscriptionDate.getUTCMonth();
  const day = subscriptionDate.getUTCDate();
  if (month === 1 && day === 29) {
    return { month: 1, day: 28 };
  }
  return { month, day };
}

function getCurrentPeriodStart(subscriptionDate: Date): Date {
  const now = new Date();
  const { month, day } = getAnchorMonthDay(subscriptionDate);

  const thisYearAnniversary = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  if (thisYearAnniversary <= now) {
    return thisYearAnniversary;
  }
  return new Date(Date.UTC(now.getUTCFullYear() - 1, month, day));
}

function getNextPeriodStart(subscriptionDate: Date): Date {
  const periodStart = getCurrentPeriodStart(subscriptionDate);
  const { month, day } = getAnchorMonthDay(subscriptionDate);
  return new Date(Date.UTC(periodStart.getUTCFullYear() + 1, month, day));
}

async function isAdminOrTester(userId: string): Promise<boolean> {
  const [user] = await db.select({
    role: users.role,
    isTester: users.isTester,
    entitlements: users.entitlements,
  }).from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) return false;
  
  return (
    user.role === "admin" ||
    user.isTester === true ||
    (user.entitlements || []).includes("FULL_ACCESS")
  );
}

function getUnlimitedStatus(): BuilderSwitchStatus {
  return {
    switchesUsed: 0,
    switchesRemaining: 999,
    canSwitch: true,
    nextSwitchAvailable: null,
    recentSwitches: [],
  };
}

export async function getBuilderSwitchStatus(userId: string): Promise<BuilderSwitchStatus> {
  if (!ENFORCE_SWITCH_LIMITS) {
    return getUnlimitedStatus();
  }
  
  const isAdmin = await isAdminOrTester(userId);
  if (isAdmin) {
    return getUnlimitedStatus();
  }

  const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.createdAt) {
    return getUnlimitedStatus();
  }
  
  const periodStart = getCurrentPeriodStart(user.createdAt);
  
  const switches = await db
    .select()
    .from(builderSwitchHistory)
    .where(
      and(
        eq(builderSwitchHistory.userId, userId),
        gte(builderSwitchHistory.switchedAt, periodStart)
      )
    )
    .orderBy(desc(builderSwitchHistory.switchedAt));
  
  const switchesUsed = switches.length;
  const switchesRemaining = Math.max(0, SWITCH_LIMIT - switchesUsed);
  const canSwitch = switchesRemaining > 0;
  
  let nextSwitchAvailable: Date | null = null;
  if (!canSwitch) {
    nextSwitchAvailable = getNextPeriodStart(user.createdAt);
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
      success: true,
      status,
    };
  }
  
  const isAdmin = await isAdminOrTester(userId);
  
  if (ENFORCE_SWITCH_LIMITS && !isAdmin) {
    const status = await getBuilderSwitchStatus(userId);
    
    if (!status.canSwitch) {
      const nextDate = status.nextSwitchAvailable
        ? status.nextSwitchAvailable.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "your next subscription anniversary";
      
      return {
        success: false,
        error: `You've used all ${SWITCH_LIMIT} program transitions for this subscription year. Your transitions reset on ${nextDate}.`,
        status,
      };
    }
    
    await db.insert(builderSwitchHistory).values({
      userId,
      fromBuilder: currentBuilder,
      toBuilder: newBuilder,
    });
  }
  
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
