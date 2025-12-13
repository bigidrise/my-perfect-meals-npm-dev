import { Router } from "express";
import { db } from "../db";
import { onboardingProgress } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { mergeStepIntoPreferences } from "../services/onboardingMergeService";

const r = Router();

/**
 * GET /api/onboarding/progress
 * Returns a map of stepKey -> { data, completed, updatedAt }
 * Looks up by userId if provided, else by deviceId.
 */
r.get("/onboarding/progress", async (req, res) => {
  const deviceId = (req as any).deviceId as string;
  const userId = (req.query.userId as string | undefined) || undefined;

  try {
    const rows = await db.select().from(onboardingProgress)
      .where(userId
        ? eq(onboardingProgress.userId, userId)
        : eq(onboardingProgress.deviceId, deviceId)
      );

    const map: Record<string, any> = {};
    rows.forEach((row) => {
      map[row.stepKey] = {
        data: row.data,
        completed: row.completed,
        updatedAt: row.updatedAt,
      };
    });
    res.json({ steps: map });
  } catch (error) {
    console.error("Error fetching onboarding progress:", error);
    res.status(500).json({ error: "Failed to fetch onboarding progress" });
  }
});

// EMERGENCY: Request deduplication cache to prevent spam saves
const saveCache = new Map<string, { data: string, timestamp: number, count: number }>();
const rateLimitCache = new Map<string, { count: number, resetTime: number }>();
const CACHE_TTL = 5000; // 5 seconds
const RATE_LIMIT_WINDOW = 10000; // 10 seconds  
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per 10 seconds

/**
 * PUT /api/onboarding/step/:stepKey
 * Body: { data: {...}, completed?: boolean, apply?: boolean }
 * Upserts by (userId OR deviceId, stepKey).
 * If completed or apply=true => merge into user_preferences.
 * ENHANCED: Includes request deduplication to prevent spam saves
 */
r.put("/onboarding/step/:stepKey", async (req, res) => {
  const deviceId = (req as any).deviceId as string;
  const userId = (req.body?.userId as string | undefined) || undefined;
  const stepKey = req.params.stepKey;
  const data = (req.body?.data ?? {}) as Record<string, any>;
  const completed = !!req.body?.completed;
  const apply = !!req.body?.apply;

  try {
    // Create unique cache key
    const identity = userId || deviceId;
    const cacheKey = `${identity}:${stepKey}`;
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    const now = Date.now();

    // EMERGENCY: Rate limiting to prevent spam
    const rateLimitKey = `rateLimit:${identity}:${stepKey}`;
    const rateLimit = rateLimitCache.get(rateLimitKey);
    
    if (rateLimit) {
      if (now < rateLimit.resetTime) {
        if (rateLimit.count >= MAX_REQUESTS_PER_WINDOW) {
          console.log(`🚫 RATE LIMITED: ${stepKey} for ${identity} - too many requests`);
          return res.status(429).json({ error: "Rate limit exceeded. Please slow down." });
        }
        rateLimit.count++;
      } else {
        // Reset window
        rateLimit.count = 1;
        rateLimit.resetTime = now + RATE_LIMIT_WINDOW;
      }
    } else {
      rateLimitCache.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // Check cache for duplicate saves
    const cached = saveCache.get(cacheKey);
    if (cached && cached.data === dataString && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`🚫 Duplicate save blocked for ${stepKey} - too soon (${cached.count} attempts)`);
      cached.count++;
      return res.json({ ok: true, cached: true });
    }

    // Update cache
    saveCache.set(cacheKey, { data: dataString, timestamp: now, count: 1 });

    // Clean old cache entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean cache
      for (const [key, value] of Array.from(saveCache.entries())) {
        if (now - value.timestamp > CACHE_TTL * 2) {
          saveCache.delete(key);
        }
      }
    }

    // Upsert (prefer userId, else deviceId)
    const baseMatch = userId
      ? and(eq(onboardingProgress.userId, userId), eq(onboardingProgress.stepKey, stepKey))
      : and(eq(onboardingProgress.deviceId, deviceId), eq(onboardingProgress.stepKey, stepKey));

    const existing = await db.select().from(onboardingProgress).where(baseMatch).limit(1);

    if (existing[0]) {
      // Check if data actually changed before updating database
      const existingDataString = JSON.stringify(existing[0].data, Object.keys(existing[0].data || {}).sort());
      if (existingDataString === dataString && !completed && !apply) {
        console.log(`💾 No database update needed for ${stepKey} - data unchanged`);
        return res.json({ ok: true, unchanged: true });
      }

      await db.update(onboardingProgress)
        .set({ data, completed, updatedAt: new Date() })
        .where(eq(onboardingProgress.id, existing[0].id));
      
      console.log(`✅ Updated onboarding step ${stepKey} for ${identity}`);
    } else {
      await db.insert(onboardingProgress).values({
        deviceId, userId, stepKey, data, completed,
      });
      
      console.log(`✅ Created onboarding step ${stepKey} for ${identity}`);
    }

    // Merge into user_preferences only when we have a userId and (completed or apply)
    if (userId && (completed || apply)) {
      await mergeStepIntoPreferences(userId, stepKey, data);
      console.log(`🔄 Merged step ${stepKey} into user preferences for ${userId}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving onboarding step:", error);
    res.status(500).json({ error: "Failed to save onboarding step" });
  }
});

/**
 * DELETE /api/onboarding/step/:stepKey
 * Resets a single step (device or user scope).
 */
r.delete("/onboarding/step/:stepKey", async (req, res) => {
  const deviceId = (req as any).deviceId as string;
  const userId = (req.query.userId as string | undefined) || undefined;
  const stepKey = req.params.stepKey;

  try {
    const baseMatch = userId
      ? and(eq(onboardingProgress.userId, userId), eq(onboardingProgress.stepKey, stepKey))
      : and(eq(onboardingProgress.deviceId, deviceId), eq(onboardingProgress.stepKey, stepKey));

    await db.delete(onboardingProgress).where(baseMatch);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error resetting onboarding step:", error);
    res.status(500).json({ error: "Failed to reset onboarding step" });
  }
});

/**
 * POST /api/onboarding/reset-all
 * Clears all steps for this identity.
 */
r.post("/onboarding/reset-all", async (req, res) => {
  const deviceId = (req as any).deviceId as string;
  const userId = (req.body?.userId as string | undefined) || undefined;

  try {
    const baseMatch = userId
      ? eq(onboardingProgress.userId, userId)
      : eq(onboardingProgress.deviceId, deviceId);

    await db.delete(onboardingProgress).where(baseMatch);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error resetting all onboarding progress:", error);
    res.status(500).json({ error: "Failed to reset all onboarding progress" });
  }
});

/**
 * POST /api/onboarding/claim
 * Attach all device-only progress rows to a newly created userId (after sign up).
 */
r.post("/onboarding/claim", async (req, res) => {
  const deviceId = (req as any).deviceId as string;
  const userId = (req.body?.userId || "").toString().trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // Move rows to userId
    const rows = await db.select().from(onboardingProgress).where(eq(onboardingProgress.deviceId, deviceId));
    for (const row of rows) {
      await db.update(onboardingProgress)
        .set({ userId })
        .where(eq(onboardingProgress.id, row.id));

      // If any were completed while anonymous, merge now
      if (row.completed) {
        await mergeStepIntoPreferences(userId, row.stepKey, row.data);
      }
    }
    res.json({ ok: true, claimed: rows.length });
  } catch (error) {
    console.error("Error claiming onboarding progress:", error);
    res.status(500).json({ error: "Failed to claim onboarding progress" });
  }
});

export default r;