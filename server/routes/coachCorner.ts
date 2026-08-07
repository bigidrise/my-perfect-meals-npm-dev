import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "../db";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { coachingProfiles } from "../db/schema/ace";
import { users } from "../../shared/schema";
import { biometricSample } from "../../shared/biometricsSchema";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import {
  COACH_CORNER_QUESTIONS,
  type CoachCornerFieldTarget,
} from "../services/ace/coachCornerQuestions";
import { resolveProgressSlowed } from "../services/ace/progressSlowedEngine";
import { resolveTired } from "../services/ace/tiredEngine";
import type {
  CoachResponse,
  PerceivedDuration,
  PerceivedTiredDuration,
  ProgressSlowedContext,
  SelfReportedWeightChange,
  SleepQuality,
  TiredContext,
  TiredTiming,
} from "../../shared/coachCornerTypes";
import type { CoachingProfile } from "../db/schema/ace";

// ─── OpenAI client ────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── Conversational context adapter ──────────────────────────────────────────
// Selects relevant context from the full protocol envelope.
// Does NOT dump the entire envelope — only what's meaningful for a coaching
// conversation. Adult-only; never called for pediatric or pregnancy contexts.

async function buildCoachContextBlock(
  userId: string,
  profile: CoachingProfile | null
): Promise<string> {
  const lines: string[] = [];

  try {
    const envelope = await loadUserProtocolEnvelope(userId);
    if (envelope) {
      if (envelope.dietaryIdentity?.length) {
        lines.push(`Dietary identity: ${envelope.dietaryIdentity.join(", ")}`);
      }
      if (envelope.allergies?.length) {
        lines.push(`Allergies (hard stops): ${envelope.allergies.join(", ")}`);
      }
      if (envelope.hasDiabetes) {
        lines.push(
          envelope.diabeticGuidance
            ? `Diabetic — current glucose guidance: ${envelope.diabeticGuidance}`
            : "Has a diabetic condition — carb and sugar management applies."
        );
      }
      if (envelope.glp1DailyTolerance) {
        const t = envelope.glp1DailyTolerance;
        lines.push(
          `On GLP-1 medication — today's tolerance: nausea ${t.nauseaLevel ?? "none"}, appetite ${t.appetiteLevel ?? "normal"}.`
        );
      }
      if (envelope.performanceContext?.active) {
        const p = envelope.performanceContext;
        lines.push(
          `Active athlete — sport type: ${p.trainingType ?? "general"}, training phase: ${p.trainingPhase ?? "general"}.`
        );
      }
      if (envelope.pregnancySupport) {
        lines.push("Currently in a pregnancy support protocol.");
      }
      if (envelope.thyroidSupport) {
        lines.push(`Thyroid support active${envelope.thyroidType ? ` (${envelope.thyroidType})` : ""}.`);
      }
      if (envelope.conditionGuidanceBlocks?.length) {
        lines.push(
          `Has ${envelope.conditionGuidanceBlocks.length} active medical protocol(s) — clinical constraints apply.`
        );
      }
      if (envelope.fitnessGoal) {
        lines.push(`Primary goal: ${envelope.fitnessGoal.replace(/_/g, " ")}${envelope.goalType ? ` (${envelope.goalType})` : ""}.`);
      }
    }

    // Macro targets — separate query (not in envelope interface)
    const [userRow] = await db
      .select({
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        weight: users.weight,
      })
      .from(users)
      .where(eq(users.id, userId as any))
      .limit(1);

    if (userRow?.dailyCalorieTarget) {
      let macro = `Daily targets: ${userRow.dailyCalorieTarget} cal`;
      if (userRow.dailyProteinTarget) macro += `, ${userRow.dailyProteinTarget}g protein`;
      lines.push(macro);
    }
    if (userRow?.weight) {
      lines.push(`Current weight: ${userRow.weight} lbs`);
    }
  } catch (err: any) {
    console.warn("[CoachCorner] Context adapter error (non-fatal):", err.message);
  }

  // Behavioral profile from coachingProfiles
  const behaviorLines: string[] = [];
  if (profile) {
    if (profile.setbackResponse) behaviorLines.push(`setback response: ${profile.setbackResponse.replace(/_/g, " ")}`);
    if (profile.motivationDriver) behaviorLines.push(`motivation: ${profile.motivationDriver.replace(/_/g, " ")}`);
    if (profile.trustStyle) behaviorLines.push(`trust style: ${profile.trustStyle.replace(/_/g, " ")}`);
    if (profile.overwhelmResponse) behaviorLines.push(`under pressure: ${profile.overwhelmResponse.replace(/_/g, " ")}`);
    if (profile.recoveryPreference) behaviorLines.push(`prefers: ${profile.recoveryPreference.replace(/_/g, " ")}`);
    if (profile.progressMindset) behaviorLines.push(`mindset: ${profile.progressMindset.replace(/_/g, " ")}`);
    if (profile.eatingDriver) behaviorLines.push(`eating driver: ${profile.eatingDriver.replace(/_/g, " ")}`);
    if (profile.cravingResponse) behaviorLines.push(`craving pattern: ${profile.cravingResponse.replace(/_/g, " ")}`);
    if (profile.hardestPart) behaviorLines.push(`hardest part of the plan: ${profile.hardestPart.replace(/_/g, " ")}`);
    if (profile.offTrackCauses && Array.isArray(profile.offTrackCauses) && profile.offTrackCauses.length) {
      behaviorLines.push(`common off-track causes: ${(profile.offTrackCauses as string[]).join(", ").replace(/_/g, " ")}`);
    }
  }

  const contextSection = lines.length
    ? `USER NUTRITION CONTEXT:\n${lines.map(l => `• ${l}`).join("\n")}`
    : "";
  const behaviorSection = behaviorLines.length
    ? `\n\nBEHAVIORAL PROFILE:\n• ${behaviorLines.join("\n• ")}`
    : "";

  return `${contextSection}${behaviorSection}`.trim();
}

// ─── LLM conversational generation ───────────────────────────────────────────
// ACE determines intent/context. The LLM converts that structured output into
// a natural coaching response. ACE's clinical decisions are authoritative —
// the LLM must never override the intent or clinical direction.

async function generateCoachMessage(
  aceResponse: CoachResponse,
  contextBlock: string,
  situationLabel: string
): Promise<string> {
  const intentExplanations: Record<string, string> = {
    reassure: "The user needs reassurance — stay the course, don't add pressure or introduce doubt.",
    educate: "The user needs education — explain what's happening and what to do, with supportive tone.",
    redirect: "The user needs to redirect — be direct and supportive about the next concrete step.",
  };
  const intentExplanation = intentExplanations[aceResponse.intent] ?? aceResponse.intent;

  const systemPrompt = `You are a nutrition and wellness coach inside My Perfect Meals — Coach's Corner.

The coaching engine has already analyzed this user's situation and determined a coaching strategy. Your job is to deliver that strategy as a natural, human coaching message.

━━━ COACHING ENGINE OUTPUT ━━━
Situation: ${situationLabel}
Intent: ${aceResponse.intent.toUpperCase()} — ${intentExplanation}
Recommendation: ${aceResponse.recommendation}

What the data shows: ${aceResponse.message.acknowledgment}
Guidance: ${aceResponse.message.recommendation}
The science: ${aceResponse.message.science}
Perspective: ${aceResponse.message.philosophy}
What to watch for: ${aceResponse.message.whatToWatchFor}
Next action: ${aceResponse.message.action}

━━━ ${contextBlock ? contextBlock + "\n\n━━━ " : ""}YOUR TASK ━━━
Write ONE natural coaching response based on the analysis above.

Rules:
• Honor the coaching intent exactly — do NOT change the direction or add unsupported clinical statements
• Sound like a real coach, not a chatbot or a health app
• Weave the acknowledgment, guidance, and perspective together naturally — no labeled sections
• Reference the user's actual nutrition context where it genuinely helps (dietary identity, conditions, goal) — but only when directly relevant to this situation
• Match tone to their behavioral profile — respect how they respond to coaching
• Under 220 words unless the science or guidance genuinely needs more
• End with the specific action step — make it concrete and immediate
• Never mention "ACE", "the algorithm", "the engine", or any internal system names — you ARE the coach

Write just the coaching message. No preamble, no sign-off.`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: systemPrompt }],
    temperature: 0.65,
    max_tokens: 380,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

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

  const typed: Partial<Record<CoachCornerFieldTarget, string | string[] | number>> = {};

  for (const question of COACH_CORNER_QUESTIONS) {
    if (!VALID_QUESTION_IDS.has(question.id)) continue;
    const raw = answers[question.id];
    if (raw === undefined || raw === null) continue;

    const validValues = new Set(question.options.map((o) => o.value));

    if (question.multiSelect) {
      const rawArray = Array.isArray(raw) ? raw : [];
      const values = rawArray.filter(
        (v): v is string => typeof v === "string" && validValues.has(v)
      );
      if (values.length === 0) continue;
      const max = question.maxSelect ?? values.length;
      typed[question.target] = values.slice(0, max);
      continue;
    }

    if (typeof raw !== "string" || !validValues.has(raw)) continue;

    if (question.target === "activeDaysPerWeek") {
      typed[question.target] = parseInt(raw, 10);
    } else {
      typed[question.target] = raw;
    }
  }

  try {
    const values = {
      userId,
      offTrackCauses: (typed.offTrackCauses as string[]) ?? null,
      setbackResponse: (typed.setbackResponse as string) ?? null,
      progressMindset: (typed.progressMindset as string) ?? null,
      trustStyle: (typed.trustStyle as string) ?? null,
      overwhelmResponse: (typed.overwhelmResponse as string) ?? null,
      decisionStyle: (typed.decisionStyle as string) ?? null,
      eatingDriver: (typed.eatingDriver as string) ?? null,
      cravingResponse: (typed.cravingResponse as string) ?? null,
      hardestPart: (typed.hardestPart as string) ?? null,
      activityLevel: (typed.activityLevel as string) ?? null,
      activeDaysPerWeek: (typed.activeDaysPerWeek as number) ?? null,
      planStartStage: (typed.planStartStage as string) ?? null,
      recoveryPreference: (typed.recoveryPreference as string) ?? null,
      motivationDriver: (typed.motivationDriver as string) ?? null,
      goalType: (typed.goalType as string) ?? null,
      stressResponse: null,
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

    // ── LLM conversational generation (additive — ACE decision is authoritative) ──
    let coachMessage: string | undefined;
    try {
      const contextBlock = await buildCoachContextBlock(userId, profile ?? null);
      coachMessage = await generateCoachMessage(response, contextBlock, "My progress has slowed");
    } catch (llmErr: any) {
      console.warn("[CoachCorner] LLM generation failed (non-fatal):", llmErr.message);
    }

    res.json({ context, response: { ...response, coachMessage } });
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

    // ── LLM conversational generation (additive — ACE decision is authoritative) ──
    let coachMessage: string | undefined;
    try {
      const contextBlock = await buildCoachContextBlock(userId, profile ?? null);
      coachMessage = await generateCoachMessage(response, contextBlock, "I'm feeling tired");
    } catch (llmErr: any) {
      console.warn("[CoachCorner] LLM generation failed (non-fatal):", llmErr.message);
    }

    res.json({ context, response: { ...response, coachMessage } });
  } catch (err: any) {
    console.error("[CoachCorner] POST /situations/tired/resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve tired situation" });
  }
});

export default router;
