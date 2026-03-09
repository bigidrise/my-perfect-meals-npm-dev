import { db } from "../db";
import { aiUsage } from "../db/schema/aiUsage";
import { users } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { getTierForLookupKey } from "../../shared/planFeatures";

export enum AiFeature {
  FRIDGE_RESCUE = "FRIDGE_RESCUE",
  CRAVING_CREATOR = "CRAVING_CREATOR",
  DESSERT_CREATOR = "DESSERT_CREATOR",
  BEVERAGE_CREATOR = "BEVERAGE_CREATOR",
  MEAL_BUILDER = "MEAL_BUILDER",
}

const FREE_DAILY_LIMITS: Record<string, number> = {
  [AiFeature.FRIDGE_RESCUE]: 1,
};

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  resetAt: string;
  limitCode?: string;
}

function getTomorrowMidnightUTC(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.toISOString();
}

async function getUserTier(userId: string): Promise<string> {
  const [user] = await db
    .select({ planLookupKey: users.planLookupKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return "free";
  return getTierForLookupKey(user.planLookupKey);
}

export async function checkDailyQuota(
  userId: string,
  feature: AiFeature,
): Promise<QuotaCheckResult> {
  const tier = await getUserTier(userId);

  const dailyLimit = FREE_DAILY_LIMITS[feature];

  if (tier !== "free" || !dailyLimit) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      used: 0,
      resetAt: getTomorrowMidnightUTC(),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.feature, feature),
        eq(aiUsage.usageDate, today),
      ),
    )
    .limit(1);

  const used = row?.count ?? 0;
  const remaining = Math.max(0, dailyLimit - used);

  if (used >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      used,
      resetAt: getTomorrowMidnightUTC(),
      limitCode: "FREE_DAILY_LIMIT_REACHED",
    };
  }

  return {
    allowed: true,
    remaining,
    limit: dailyLimit,
    used,
    resetAt: getTomorrowMidnightUTC(),
  };
}

export async function incrementDailyUsage(
  userId: string,
  feature: AiFeature,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  await db
    .insert(aiUsage)
    .values({
      userId,
      feature,
      usageDate: today,
      count: 1,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.feature, aiUsage.usageDate],
      set: {
        count: sql`${aiUsage.count} + 1`,
        lastUsedAt: new Date(),
      },
    });
}
