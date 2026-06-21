/**
 * Performance Nutrition — Sport-specific fueling protocol setup and AI coach.
 *
 * Manages the performanceContext JSONB blob on the users table.
 * Adds "performance-nutrition" to specialtyConditions on activation.
 * Medical safety layers (renal, cardiac, diabetes, pregnancy) always override
 * performance directives — this route never touches those fields.
 */

import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";

const router = express.Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

// ── Save / update performance setup ─────────────────────────────────────────
router.post("/setup", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      primaryGoal,
      trainingType,
      trainingFrequency,
      cardioFocus,
      trainingPhase,
      twoADays = false,
    } = req.body;

    // Validate required fields
    const validGoals = ["fat_loss", "muscle_gain", "maintenance", "performance", "competition_prep"];
    const validTrainingTypes = ["strength", "hypertrophy", "powerlifting", "olympic_lifting", "mma", "boxing", "wrestling", "bjj", "crossfit", "endurance_running", "cycling", "triathlon", "tactical", "general_fitness"];
    const validFrequencies = ["1-2", "3-4", "5-6", "7+"];
    const validCardio = ["none", "recovery", "zone_2", "tempo", "threshold", "hiit", "mixed"];
    const validPhases = ["off_season", "pre_season", "in_season", "competition_prep", "weight_cut", "recovery"];

    if (!primaryGoal || !validGoals.includes(primaryGoal)) {
      return res.status(400).json({ error: "Invalid primaryGoal" });
    }
    if (!trainingType || !validTrainingTypes.includes(trainingType)) {
      return res.status(400).json({ error: "Invalid trainingType" });
    }
    if (!trainingFrequency || !validFrequencies.includes(trainingFrequency)) {
      return res.status(400).json({ error: "Invalid trainingFrequency" });
    }
    if (!cardioFocus || !validCardio.includes(cardioFocus)) {
      return res.status(400).json({ error: "Invalid cardioFocus" });
    }
    if (!trainingPhase || !validPhases.includes(trainingPhase)) {
      return res.status(400).json({ error: "Invalid trainingPhase" });
    }

    const now = new Date().toISOString();

    // Read current specialtyConditions — add "performance-nutrition" without clobbering others
    const [currentUser] = await db
      .select({ specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentConditions: string[] = (currentUser?.specialtyConditions as string[] | null) ?? [];
    const updatedConditions: string[] = currentConditions.includes("performance-nutrition")
      ? currentConditions
      : [...currentConditions, "performance-nutrition"];

    await db
      .update(users)
      .set({
        performanceContext: {
          primaryGoal,
          trainingType,
          trainingFrequency,
          cardioFocus,
          trainingPhase,
          twoADays: Boolean(twoADays),
          activatedAt: now,
          updatedAt: now,
        } as any,
        specialtyConditions: updatedConditions as any,
      })
      .where(eq(users.id, userId));

    console.log(
      `[PerformanceNutrition] Setup saved for user ${userId}: ${trainingType} / ${trainingPhase} / ${cardioFocus}`
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[PerformanceNutrition] Setup error:", error);
    return res.status(500).json({ error: "Failed to save performance setup" });
  }
});

// ── Get current performance context ─────────────────────────────────────────
router.get("/context", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db
      .select({
        performanceContext: users.performanceContext,
        specialtyConditions: users.specialtyConditions,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      performanceContext: user.performanceContext ?? null,
      isActive: ((user.specialtyConditions as string[]) ?? []).includes("performance-nutrition"),
    });
  } catch (error: any) {
    console.error("[PerformanceNutrition] Context fetch error:", error);
    return res.status(500).json({ error: "Failed to load performance context" });
  }
});

// ── AI Performance Coach ─────────────────────────────────────────────────────
router.post("/ask", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required" });

    const envelope = await loadUserProtocolEnvelope(userId);
    const pCtx = (envelope as any).performanceContext ?? null;

    const systemPrompt = `You are the MPM Performance Nutrition Coach — a sport-specific nutrition expert trained in exercise physiology, energy systems, carb timing, recovery, and body composition for athletes.

${pCtx ? `Current athlete protocol:
- Primary Goal: ${pCtx.primaryGoal?.replace(/_/g, " ")}
- Training Type: ${pCtx.trainingType?.replace(/_/g, " ")}
- Frequency: ${pCtx.trainingFrequency} sessions/week
- Cardio Focus: ${pCtx.cardioFocus?.replace(/_/g, " ")}
- Current Phase: ${pCtx.trainingPhase?.replace(/_/g, " ")}
${pCtx.twoADays ? "- Training twice per day (2-a-days)" : ""}
` : "No performance protocol set yet — help the user understand what to configure."}

Medical safety rules: Any active medical protocols (renal, cardiac, diabetes, pregnancy) take absolute priority. Never recommend practices that conflict with those conditions.

Keep answers practical, specific, and evidence-based. Reference energy systems (ATP-PC, glycolytic, oxidative), cardio zones (Zone 1–5), and periodization concepts where relevant. When discussing meals, translate science into actual foods and timing windows. No generic advice.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 600,
    });

    const reply = response.choices[0]?.message?.content ?? "No response generated.";
    return res.json({ reply });
  } catch (error: any) {
    console.error("[PerformanceNutrition] Coach error:", error);
    return res.status(500).json({ error: "Performance coach unavailable" });
  }
});

export default router;
