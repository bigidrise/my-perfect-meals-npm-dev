/**
 * Performance Nutrition — Three-track protocol setup and AI coach.
 *
 * Track 1 (lifestyle) — future phase, not built yet.
 * Track 2 (athletic)  — sport-specific fueling; saves to performanceContext.
 * Track 3 (competition) — date-driven prep; saves to competitionPrepContext.
 *
 * Medical safety layers (renal, cardiac, diabetes, pregnancy) always override
 * performance directives — this route never touches those fields.
 */

import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
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

// ── Save / update performance setup (both tracks) ────────────────────────────
router.post("/setup", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { track } = req.body;

    if (track === "competition") {
      // ── Track 3: Competition Prep ────────────────────────────────────────
      const {
        competitionType,
        division,
        eventDate,
        currentWeight,
        targetWeight,
      } = req.body;

      const validCompTypes = [
        "bodybuilding_show", "mens_physique", "classic_physique",
        "figure", "bikini", "wellness",
        "powerlifting_meet", "fight_camp", "wrestling_season",
      ];

      if (!competitionType || !validCompTypes.includes(competitionType)) {
        return res.status(400).json({ error: "Invalid competitionType" });
      }
      if (!eventDate || isNaN(Date.parse(eventDate))) {
        return res.status(400).json({ error: "Invalid eventDate" });
      }

      const now = new Date().toISOString();
      const competitionPrepContext = {
        competitionType,
        division: division ?? undefined,
        eventDate,
        currentWeight: currentWeight ?? undefined,
        targetWeight: targetWeight ?? undefined,
        activatedAt: now,
        updatedAt: now,
      };

      // Fetch current specialtyConditions
      const [current] = await db
        .select({ specialtyConditions: users.specialtyConditions })
        .from(users)
        .where(eq(users.id, userId));

      const existing: string[] = (current?.specialtyConditions as string[]) ?? [];
      const updated = [
        ...existing.filter(c => c !== "competition-prep" && c !== "performance-nutrition"),
        "competition-prep",
      ];

      await db
        .update(users)
        .set({
          competitionPrepContext: competitionPrepContext as any,
          activeProtocolTrack: "competition",
          specialtyConditions: updated as any,
        } as any)
        .where(eq(users.id, userId));

      return res.json({ success: true, track: "competition", competitionPrepContext });

    } else {
      // ── Track 2: Athletic Performance (default) ──────────────────────────
      const {
        primaryGoal,
        trainingType,
        trainingFrequency,
        cardioFocus,
        trainingPhase,
        twoADays = false,
      } = req.body;

      const validGoals = ["fat_loss", "muscle_gain", "maintenance", "performance"];
      const validTrainingTypes = [
        "strength", "hypertrophy", "powerlifting", "olympic_lifting",
        "mma", "boxing", "wrestling", "bjj", "crossfit",
        "endurance_running", "cycling", "triathlon", "tactical", "general_fitness",
      ];
      const validFrequencies = ["1-2", "3-4", "5-6", "7+"];
      const validCardio = ["none", "recovery", "zone_2", "tempo", "threshold", "hiit", "mixed"];
      const validPhases = ["off_season", "pre_season", "in_season", "weight_cut", "recovery"];

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

      // Fetch current specialtyConditions
      const [current] = await db
        .select({ specialtyConditions: users.specialtyConditions })
        .from(users)
        .where(eq(users.id, userId));

      const existing: string[] = (current?.specialtyConditions as string[]) ?? [];
      const updated = [
        ...existing.filter(c => c !== "performance-nutrition" && c !== "competition-prep"),
        "performance-nutrition",
      ];

      const performanceContext = {
        primaryGoal,
        trainingType,
        trainingFrequency,
        cardioFocus,
        trainingPhase,
        twoADays: !!twoADays,
        activatedAt: now,
        updatedAt: now,
      };

      await db
        .update(users)
        .set({
          performanceContext: performanceContext as any,
          activeProtocolTrack: "athletic",
          specialtyConditions: updated as any,
        } as any)
        .where(eq(users.id, userId));

      return res.json({ success: true, track: "athletic", performanceContext });
    }
  } catch (err: any) {
    console.error("[performanceNutrition] /setup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get current performance context ─────────────────────────────────────────
router.get("/context", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [row] = await db
      .select({
        performanceContext: users.performanceContext,
        competitionPrepContext: (users as any).competitionPrepContext,
        activeProtocolTrack: (users as any).activeProtocolTrack,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!row) return res.status(404).json({ error: "User not found" });

    // Migration shim: existing users with performanceContext but no activeProtocolTrack
    const track = row.activeProtocolTrack ??
      (row.performanceContext ? "athletic" : null);

    res.json({
      activeProtocolTrack: track,
      performanceContext: row.performanceContext ?? null,
      competitionPrepContext: row.competitionPrepContext ?? null,
    });
  } catch (err: any) {
    console.error("[performanceNutrition] /context error:", err);
    res.status(500).json({ error: "Internal server error" });
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
    const pCtx = (envelope.user as any)?.performanceContext;
    const compCtx = (envelope.user as any)?.competitionPrepContext;
    const activeTrack = (envelope.user as any)?.activeProtocolTrack ??
      (pCtx ? "athletic" : null);

    let systemPrompt = `You are a precision performance nutrition coach. You give direct, evidence-based advice on fueling, timing, and recovery. No filler, no generic wellness advice — every answer must be specific to this athlete's protocol.\n\n`;

    if (activeTrack === "competition" && compCtx) {
      const eventDate = new Date(compCtx.eventDate);
      const today = new Date();
      const weeksOut = Math.max(0, Math.round((eventDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      const compTypeMap: Record<string, string> = {
        bodybuilding_show: "bodybuilding show", mens_physique: "Men's Physique",
        classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
        wellness: "Wellness", powerlifting_meet: "powerlifting meet",
        fight_camp: "fight camp", wrestling_season: "wrestling season",
      };
      systemPrompt += `COMPETITION PREP PROTOCOL:
- Event: ${compTypeMap[compCtx.competitionType] ?? compCtx.competitionType}${compCtx.division ? ` — ${compCtx.division}` : ""}
- Event Date: ${compCtx.eventDate} (${weeksOut} weeks out)
- Current Weight: ${compCtx.currentWeight ?? "not set"}
- Target Weight/Class: ${compCtx.targetWeight ?? "not set"}
Focus on: precise macro management, peak week protocols, water and carb manipulation, post-competition reverse diet. The calendar drives decisions — not guesswork.`;
    } else if (activeTrack === "athletic" && pCtx) {
      systemPrompt += `ATHLETIC PERFORMANCE PROTOCOL:
- Sport/Training: ${pCtx.trainingType}
- Frequency: ${pCtx.trainingFrequency} sessions/week${pCtx.twoADays ? " (2-a-days)" : ""}
- Primary Goal: ${pCtx.primaryGoal}
- Training Phase: ${pCtx.trainingPhase}
- Cardio Focus: ${pCtx.cardioFocus}
Focus on: fueling for performance, recovery optimization, sport-specific macro timing. No maintenance warnings — this athlete trains to perform.`;
    } else {
      systemPrompt += `No performance protocol configured yet. Give general sports nutrition guidance and encourage the user to set up their protocol.`;
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "I couldn't generate a response. Please try again.";
    res.json({ reply });
  } catch (err: any) {
    console.error("[performanceNutrition] /ask error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
