import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { coachingProfiles } from "../db/schema/ace";
import { users } from "../../shared/schema";
import { biometricSample } from "../../shared/biometricsSchema";
import {
  COACH_CORNER_QUESTIONS,
  type CoachCornerFieldTarget,
} from "../services/ace/coachCornerQuestions";
import { resolveProgressSlowed } from "../services/ace/progressSlowedEngine";
import { resolveTired } from "../services/ace/tiredEngine";
import type {
  PerceivedDuration,
  PerceivedTiredDuration,
  ProgressSlowedContext,
  SelfReportedWeightChange,
  SleepQuality,
  TiredContext,
  TiredTiming,
} from "../../shared/coachCornerTypes";

const router = Router();

router.get("/questions", requireAuth, async (_req, res) => {
  res.json({ questions: COACH_CORNER_QUESTIONS });
});

router.get("/status", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;

  try {
    const [profile] = await db
      .select()
      .from(coachingProfiles)
      .where(eq(coachingProfiles.userId, userId))
      .limit(1);

    res.json({
      completed: !!profile?.coachProfileCompletedAt,
      profile: profile ?? null,
    });
  } catch (err: any) {
    console.error("[CoachCorner] GET /status error:", err.message);
    res.status(500).json({ error: "Failed to load Coach's Corner status" });
  }
});

const VALID_QUESTION_IDS = new Set(COACH_CORNER_QUESTIONS.map((q) => q.id));

router.post("/intake", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;

  const answers = req.body?.answers;
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "Missing answers" });
  }

  const typed: Partial<Record<CoachCornerFieldTarget, string>> = {};

  for (const question of COACH_CORNER_QUESTIONS) {
    if (!VALID_QUESTION_IDS.has(question.id)) continue;
    const raw = answers[question.id];
    if (raw === undefined || raw === null) continue;

    const validValues = new Set(question.options.map((o) => o.value));
    const value = typeof raw === "string" && validValues.has(raw) ? raw : null;
    if (!value) continue;

    typed[question.target] = value;
  }

  try {
    const values = {
      userId,
      setbackResponse: typed.setbackResponse ?? null,
      stressResponse: typed.stressResponse ?? null,
      recoveryPreference: typed.recoveryPreference ?? null,
      coachProfileCompletedAt: new Date(),
      updatedAt: new Date(),
    };

    await db
      .insert(coachingProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: coachingProfiles.userId,
        set: values,
      });

    const [profile] = await db
      .select()
      .from(coachingProfiles)
      .where(eq(coachingProfiles.userId, userId))
      .limit(1);

    res.json({ profile });
  } catch (err: any) {
    console.error("[CoachCorner] POST /intake error:", err.message);
    res.status(500).json({ error: "Failed to save Coach's Corner profile" });
  }
});

// ---- "My progress has slowed" vertical coaching loop ----

async function loadProgressSlowedContext(
  userId: string
): Promise<ProgressSlowedContext> {
  const [user] = await db
    .select({
      onboardingCompletedAt: users.onboardingCompletedAt,
      weight: users.weight,
    })
    .from(users)
    .where(eq(users.id, userId as any))
    .limit(1);

  const planStartAt = user?.onboardingCompletedAt ?? null;
  const weeksOnPlan = planStartAt
    ? Math.floor((Date.now() - new Date(planStartAt).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  let weightChangeLb: number | null = null;
  let weightChangePercent: number | null = null;
  let hasWeightData = false;

  try {
    const fromDate = planStartAt ? new Date(planStartAt) : new Date(0);
    const samples = await db
      .select({ value: biometricSample.value, startTime: biometricSample.startTime })
      .from(biometricSample)
      .where(
        and(
          eq(biometricSample.userId, userId as any),
          eq(biometricSample.type, "weight"),
          gte(biometricSample.startTime, fromDate)
        )
      )
      .orderBy(biometricSample.startTime);

    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const firstVal = Number(first.value);
      const lastVal = Number(last.value);
      if (Number.isFinite(firstVal) && Number.isFinite(lastVal) && firstVal > 0) {
        weightChangeLb = firstVal - lastVal;
        weightChangePercent = (weightChangeLb / firstVal) * 100;
        hasWeightData = true;
      }
    }
  } catch (err: any) {
    console.error("[CoachCorner] context weight lookup error:", err.message);
  }

  return { weeksOnPlan, hasWeightData, weightChangeLb, weightChangePercent };
}

router.get("/situations/progress-slowed/context", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const context = await loadProgressSlowedContext(authReq.authUser.id);
    res.json({ context });
  } catch (err: any) {
    console.error("[CoachCorner] GET /situations/progress-slowed/context error:", err.message);
    res.status(500).json({ error: "Failed to load context" });
  }
});

const VALID_DURATIONS: PerceivedDuration[] = ["short", "medium", "long"];
const VALID_WEIGHT_CHANGE_REPORTS: SelfReportedWeightChange[] = [
  "none_little",
  "moderate",
  "significant",
];

router.post("/situations/progress-slowed/resolve", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;

  const perceivedDuration = req.body?.perceivedDuration;
  const selfReportedWeightChange = req.body?.selfReportedWeightChange;

  if (!VALID_DURATIONS.includes(perceivedDuration)) {
    return res.status(400).json({ error: "Invalid or missing perceivedDuration" });
  }
  if (
    selfReportedWeightChange !== undefined &&
    !VALID_WEIGHT_CHANGE_REPORTS.includes(selfReportedWeightChange)
  ) {
    return res.status(400).json({ error: "Invalid selfReportedWeightChange" });
  }

  try {
    const [profile] = await db
      .select()
      .from(coachingProfiles)
      .where(eq(coachingProfiles.userId, userId))
      .limit(1);

    const context = await loadProgressSlowedContext(userId);

    const response = resolveProgressSlowed(
      context,
      { perceivedDuration, selfReportedWeightChange },
      profile ?? null
    );

    await db
      .update(coachingProfiles)
      .set({
        progressSlowedLastIntent: response.intent,
        progressSlowedLastRecommendation: response.recommendation,
        progressSlowedLastAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coachingProfiles.userId, userId));

    res.json({ context, response });
  } catch (err: any) {
    console.error("[CoachCorner] POST /situations/progress-slowed/resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve progress-slowed situation" });
  }
});

// ---- "I'm tired" vertical coaching loop ----

async function loadTiredContext(userId: string): Promise<TiredContext> {
  const [profile] = await db
    .select({ updatedAt: coachingProfiles.updatedAt })
    .from(coachingProfiles)
    .where(eq(coachingProfiles.userId, userId))
    .limit(1);

  // V1 placeholder evidence: we don't yet track meal-plan macro-change
  // history, so we conservatively treat a recent Coach's Corner profile
  // update as a proxy signal. This is intentionally simple — real plan
  // change detection is a future enhancement, not a V1 blocker.
  const daysSincePlanChange = profile?.updatedAt
    ? Math.floor((Date.now() - new Date(profile.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    daysSincePlanChange,
    recentlyReducedCarbsOrSugar: false,
  };
}

router.get("/situations/tired/context", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const context = await loadTiredContext(authReq.authUser.id);
    res.json({ context });
  } catch (err: any) {
    console.error("[CoachCorner] GET /situations/tired/context error:", err.message);
    res.status(500).json({ error: "Failed to load context" });
  }
});

const VALID_TIRED_DURATIONS: PerceivedTiredDuration[] = ["today", "few_days", "week_plus"];
const VALID_TIRED_TIMINGS: TiredTiming[] = ["all_day", "afternoon_slump", "after_meals"];
const VALID_SLEEP_QUALITY: SleepQuality[] = ["normal", "poor", "not_sure"];

router.post("/situations/tired/resolve", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;

  const duration = req.body?.duration;
  const timing = req.body?.timing;
  const sleepQuality = req.body?.sleepQuality;

  if (!VALID_TIRED_DURATIONS.includes(duration)) {
    return res.status(400).json({ error: "Invalid or missing duration" });
  }
  if (!VALID_TIRED_TIMINGS.includes(timing)) {
    return res.status(400).json({ error: "Invalid or missing timing" });
  }
  if (!VALID_SLEEP_QUALITY.includes(sleepQuality)) {
    return res.status(400).json({ error: "Invalid or missing sleepQuality" });
  }

  try {
    const [profile] = await db
      .select()
      .from(coachingProfiles)
      .where(eq(coachingProfiles.userId, userId))
      .limit(1);

    const context = await loadTiredContext(userId);

    const response = resolveTired(context, { duration, timing, sleepQuality }, profile ?? null);

    await db
      .update(coachingProfiles)
      .set({
        tiredLastIntent: response.intent,
        tiredLastRecommendation: response.recommendation,
        tiredLastAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(coachingProfiles.userId, userId));

    res.json({ context, response });
  } catch (err: any) {
    console.error("[CoachCorner] POST /situations/tired/resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve tired situation" });
  }
});

export default router;
