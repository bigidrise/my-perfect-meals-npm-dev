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
import type {
  PerceivedDuration,
  ProgressSlowedContext,
  SelfReportedWeightChange,
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

export default router;
