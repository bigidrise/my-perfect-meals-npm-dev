import { db } from "../db";
import { builderSwitchHistory, users } from "../../shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const SWITCH_LIMIT = 3;
const WINDOW_MONTHS = 12;

// FEATURE FLAG: Set to true to enforce builder switch limits (for regular users only)
// When false: unlimited switches, no tracking for everyone
// When true: 3 switches per year for regular users, admins/testers always unlimited
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

// Check if user is admin/tester - they NEVER have switch limits
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

// Return unlimited status - used for admins and when limits are off
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
  // When limits aren't enforced, everyone gets unlimited
  if (!ENFORCE_SWITCH_LIMITS) {
    return getUnlimitedStatus();
  }
  
  // Admins/testers always get unlimited, even when limits are enforced
  const isAdmin = await isAdminOrTester(userId);
  if (isAdmin) {
    return getUnlimitedStatus();
  }
  
  // For regular users when limits are enforced, check their history
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
  
  // Same builder - just return success, no action needed
  if (currentBuilder === newBuilder) {
    const status = await getBuilderSwitchStatus(userId);
    return {
      success: true,
      status,
    };
  }
  
  // Check if admin/tester - they ALWAYS can switch, no limits ever
  const isAdmin = await isAdminOrTester(userId);
  
  // Only check limits for non-admin users when ENFORCE_SWITCH_LIMITS is true
  if (ENFORCE_SWITCH_LIMITS && !isAdmin) {
    const status = await getBuilderSwitchStatus(userId);
    
    if (!status.canSwitch) {
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
    
    // Only track history when limits are enforced (for non-admins)
    await db.insert(builderSwitchHistory).values({
      userId,
      fromBuilder: currentBuilder,
      toBuilder: newBuilder,
    });
  }
  
  // Update the user's selected builder
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
