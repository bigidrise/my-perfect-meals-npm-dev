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

export async function checkAndIncrementQuota(
  userId: string,
  feature: AiFeature,
): Promise<QuotaCheckResult> {
  const tier = await getUserTier(userId);
  const dailyLimit = FREE_DAILY_LIMITS[feature];

  if (tier !== "free" || !dailyLimit) {
    console.log(`[AI_QUOTA] user=${userId.slice(0, 8)}… feature=${feature} tier=${tier} bypass=true`);
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      used: 0,
      resetAt: getTomorrowMidnightUTC(),
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await db.execute(sql`
    INSERT INTO ai_usage (user_id, feature, usage_date, count, last_used_at)
    VALUES (${userId}, ${feature}, ${today}::date, 1, NOW())
    ON CONFLICT (user_id, feature, usage_date)
    DO UPDATE SET
      count = CASE
        WHEN ai_usage.count < ${dailyLimit} THEN ai_usage.count + 1
        ELSE ai_usage.count
      END,
      last_used_at = NOW()
    RETURNING count
  `);

  const newCount = Number((result as any).rows?.[0]?.count ?? 1);

  if (newCount > dailyLimit) {
    console.log(`[AI_QUOTA] user=${userId.slice(0, 8)}… feature=${feature} count=${newCount} limit=${dailyLimit} allowed=false (limit reached)`);
    return {
      allowed: false,
      remaining: 0,
      limit: dailyLimit,
      used: newCount,
      resetAt: getTomorrowMidnightUTC(),
      limitCode: "FREE_DAILY_LIMIT_REACHED",
    };
  }

  if (newCount === dailyLimit && newCount > 1) {
    const [check] = await db
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
    if ((check?.count ?? 0) > dailyLimit) {
      console.log(`[AI_QUOTA] user=${userId.slice(0, 8)}… feature=${feature} count=${newCount} limit=${dailyLimit} allowed=false (race guard)`);
      return {
        allowed: false,
        remaining: 0,
        limit: dailyLimit,
        used: newCount,
        resetAt: getTomorrowMidnightUTC(),
        limitCode: "FREE_DAILY_LIMIT_REACHED",
      };
    }
  }

  console.log(`[AI_QUOTA] user=${userId.slice(0, 8)}… feature=${feature} count=${newCount} limit=${dailyLimit} allowed=true remaining=${Math.max(0, dailyLimit - newCount)}`);
  return {
    allowed: true,
    remaining: Math.max(0, dailyLimit - newCount),
    limit: dailyLimit,
    used: newCount,
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
