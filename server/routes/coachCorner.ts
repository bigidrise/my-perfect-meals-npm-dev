import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { coachingProfiles } from "../db/schema/ace";
import {
  COACH_CORNER_QUESTIONS,
  type CoachCornerFieldTarget,
} from "../services/ace/coachCornerQuestions";

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

  const single: Record<string, string> = {};
  const arrays: Record<CoachCornerFieldTarget, string[]> = {
    coachingStyle: [],
    accountabilityPref: [],
    motivations: [],
    lifestyleFlags: [],
    biggestChallenges: [],
  };

  for (const question of COACH_CORNER_QUESTIONS) {
    if (!VALID_QUESTION_IDS.has(question.id)) continue;
    const raw = answers[question.id];
    if (raw === undefined || raw === null) continue;

    const validValues = new Set(question.options.map((o) => o.value));
    const selected: string[] = Array.isArray(raw)
      ? raw.filter((v) => typeof v === "string" && validValues.has(v))
      : typeof raw === "string" && validValues.has(raw)
        ? [raw]
        : [];

    if (selected.length === 0) continue;

    if (question.multiSelect) {
      arrays[question.target].push(...selected.slice(0, question.maxSelect ?? selected.length));
    } else {
      single[question.target] = selected[0];
    }
  }

  try {
    const values = {
      userId,
      coachingStyle: single.coachingStyle ?? null,
      accountabilityPref: single.accountabilityPref ?? null,
      motivations: [
        ...(single.motivations ? [single.motivations] : []),
        ...arrays.motivations,
      ],
      lifestyleFlags: [
        ...(single.lifestyleFlags ? [single.lifestyleFlags] : []),
        ...arrays.lifestyleFlags,
      ],
      biggestChallenges: [
        ...(single.biggestChallenges ? [single.biggestChallenges] : []),
        ...arrays.biggestChallenges,
      ],
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

export default router;
