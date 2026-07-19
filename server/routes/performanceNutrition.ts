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
import { logAudit, getClientIp } from "../lib/auditLog";

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
  console.log(`[performanceNutrition] /setup entered | userId=${(req as any).authUser?.id ?? (req as any).session?.userId ?? "unknown"}`);
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
        customSportName,
        customSportGroup,
      } = req.body;

      const validCompTypes = [
        "bodybuilding_show", "mens_physique", "classic_physique",
        "figure", "bikini", "wellness",
        "powerlifting_meet", "strongman_competition", "olympic_weightlifting_meet",
        "fight_camp", "wrestling_season",
        "crossfit_competition", "hyrox",
        "marathon", "triathlon_race", "spartan_race",
        "other",
      ];

      if (!competitionType || !validCompTypes.includes(competitionType)) {
        return res.status(400).json({ error: "Invalid competitionType" });
      }
      if (competitionType === "other" && !customSportName?.trim()) {
        return res.status(400).json({ error: "customSportName required when competitionType is other" });
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
        customSportName: customSportName?.trim() ?? undefined,
        customSportGroup: customSportGroup ?? undefined,
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

      logAudit({ actor: userId, action: "WRITE", resourceType: "performance_context", table: "users", field: "competition_prep_context", route: req.path, ip: getClientIp(req as any), meta: { track: "competition" } });
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
        sessionDuration,
        recoveryStatus,
        adaptationTarget,
      } = req.body;

      const validGoals = ["fat_loss", "muscle_gain", "maintenance", "performance"];
      const validTrainingTypes = [
        "strength", "hypertrophy", "powerlifting", "olympic_lifting",
        "mma", "boxing", "wrestling", "bjj", "crossfit",
        "endurance_running", "cycling", "triathlon", "tactical", "general_fitness",
        "other",
      ];
      const validFrequencies = ["1-2", "3-4", "5-6", "7+"];
      const validCardio = ["none", "recovery", "zone_2", "tempo", "threshold", "hiit", "mixed"];
      const validPhases = ["off_season", "pre_season", "in_season", "weight_cut", "recovery"];
      const validSessionDurations = ["under_30", "30_60", "60_90", "90_plus"];
      const validRecoveryStatuses = ["good", "average", "poor"];
      const validAdaptationTargets = [
        "endurance", "recovery", "conditioning", "work_capacity",
        "speed", "power", "fat_loss", "muscle_gain",
      ];

      if (!primaryGoal || !validGoals.includes(primaryGoal)) {
        return res.status(400).json({ error: "Invalid primaryGoal" });
      }
      if (!trainingType || !validTrainingTypes.includes(trainingType)) {
        return res.status(400).json({ error: "Invalid trainingType" });
      }
      const { customSportName: athleteCustomSport } = req.body;
      if (!trainingFrequency || !validFrequencies.includes(trainingFrequency)) {
        return res.status(400).json({ error: "Invalid trainingFrequency" });
      }
      if (!cardioFocus || !validCardio.includes(cardioFocus)) {
        return res.status(400).json({ error: "Invalid cardioFocus" });
      }
      if (!trainingPhase || !validPhases.includes(trainingPhase)) {
        return res.status(400).json({ error: "Invalid trainingPhase" });
      }
      if (sessionDuration && !validSessionDurations.includes(sessionDuration)) {
        return res.status(400).json({ error: "Invalid sessionDuration" });
      }
      if (recoveryStatus && !validRecoveryStatuses.includes(recoveryStatus)) {
        return res.status(400).json({ error: "Invalid recoveryStatus" });
      }
      if (adaptationTarget && !validAdaptationTargets.includes(adaptationTarget)) {
        return res.status(400).json({ error: "Invalid adaptationTarget" });
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
        sessionDuration:   sessionDuration   ?? undefined,
        recoveryStatus:    recoveryStatus    ?? undefined,
        adaptationTarget:  adaptationTarget  ?? undefined,
        customSportName: athleteCustomSport?.trim() ?? undefined,
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

      logAudit({ actor: userId, action: "WRITE", resourceType: "performance_context", table: "users", field: "performance_context", route: req.path, ip: getClientIp(req as any), meta: { track: "athletic" } });
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
    const pCtx = (envelope as any)?.performanceContext;
    const demand = (envelope as any)?.performanceLayer;

    // Fetch competition prep context and active track directly — not in protocol envelope
    const [perfRow] = await db
      .select({
        competitionPrepContext: (users as any).competitionPrepContext,
        activeProtocolTrack: (users as any).activeProtocolTrack,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const compCtx = (perfRow as any)?.competitionPrepContext ?? null;
    const activeTrack = (perfRow as any)?.activeProtocolTrack ??
      (pCtx ? "athletic" : null);

    // ── Macro Calculator pre-flight: require completion before AI coaching ────
    const [macroRow] = await db
      .select({
        dailyCalorieTarget:        users.dailyCalorieTarget,
        dailyProteinTarget:        users.dailyProteinTarget,
        dailyCarbsTarget:          users.dailyCarbsTarget,
        dailyFatTarget:            users.dailyFatTarget,
        dailyStarchyCarbsTarget:   (users as any).dailyStarchyCarbsTarget,
        dailyFibrousCarbsTarget:   (users as any).dailyFibrousCarbsTarget,
        weightKg:                  users.weightKg,
        activityLevel:             users.activityLevel,
        weeklyTrainingSchedule:    users.weeklyTrainingSchedule,
        performanceProtocolConfig: users.performanceProtocolConfig,
      } as any)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const coreTargets = [
      (macroRow as any)?.dailyCalorieTarget,
      (macroRow as any)?.dailyProteinTarget,
      (macroRow as any)?.dailyCarbsTarget,
      (macroRow as any)?.dailyFatTarget,
    ];
    if (coreTargets.some(v => v == null)) {
      return res.json({ macroCalculatorRequired: true });
    }

    const baselineProtein  = (macroRow as any).dailyProteinTarget  as number;
    const baselineCarbs    = (macroRow as any).dailyCarbsTarget    as number;
    const baselineFat      = (macroRow as any).dailyFatTarget      as number;
    const baselineCalories = (macroRow as any).dailyCalorieTarget  as number;
    const starchyCarbs     = (macroRow as any)?.dailyStarchyCarbsTarget ?? null;
    const fibrousCarbs     = (macroRow as any)?.dailyFibrousCarbsTarget ?? null;
    const weightKgRaw      = parseFloat(String((macroRow as any)?.weightKg ?? "0")) || null;
    const weightLbs        = weightKgRaw ? Math.round(weightKgRaw * 2.20462) : null;

    // Resolve today's performance targets (baseline + session modifier if schedule exists)
    const askSchedule   = (macroRow as any)?.weeklyTrainingSchedule;
    const askPerfConfig = (macroRow as any)?.performanceProtocolConfig;

    let resolvedForAsk = {
      proteinG:     baselineProtein,
      carbsG:       baselineCarbs,
      fatG:         baselineFat,
      calories:     baselineCalories,
      sessionLabel: "Baseline",
      sessionType:  "off" as string,
    };

    if (askSchedule && askPerfConfig) {
      const { resolveTodayTargets } = await import("../services/protocol/performanceProtocolResolver");
      const liveBase = {
        calories:      baselineCalories,
        proteinG:      baselineProtein,
        carbsG:        baselineCarbs,
        fatG:          baselineFat,
        starchyCarbsG: starchyCarbs !== null ? Number(starchyCarbs) : Math.round(baselineCarbs * 0.7),
        fibrousCarbsG: fibrousCarbs !== null ? Number(fibrousCarbs) : Math.round(baselineCarbs * 0.3),
      };
      const r = resolveTodayTargets(askSchedule, askPerfConfig, liveBase);
      resolvedForAsk = {
        proteinG:     r.proteinG,
        carbsG:       r.carbsG,
        fatG:         r.fatG,
        calories:     r.calories,
        sessionLabel: r.sessionLabel,
        sessionType:  r.sessionType,
      };
    }

    // ── LANGUAGE RULES — enforced on every single response ───────────────────
    // These rules override everything else. No exceptions.
    const languageRules = `
LANGUAGE RULES — NEVER BREAK THESE:
- NEVER say "caloric deficit", "calorie deficit", "caloric balance", "TDEE", "BMR", "energy balance", or "calories in vs. calories out". These terms are banned. Calories are the automatic result of what they eat — never a target to set.
- NEVER give the user a choice or ask what they want to do. The scale, their energy level, and their strength level tell us what to do. You tell them what to do.
- NEVER give a list of options like "you could try A or B". Give one clear action with the exact numbers.
- NEVER say "it depends" without immediately giving the specific answer for their exact situation.
- NEVER use paragraphs of explanation before the action. Lead with the action. Explanation follows in 1–2 short sentences max.
- Speak like a trusted coach in their ear — direct, specific, no fluff.

THE ONLY THREE SIGNALS THAT DRIVE CHANGES:
1. Scale weight (did it move? which direction? how many days with no movement?)
2. Energy level (up, down, or same?)
3. Strength level (up, down, or same?)

Nothing else justifies a protocol change. If the user asks "should I change X?" — tell them: the scale and how they feel answers that, not a question.

MACRO SWAP FRAMEWORK (how changes are made — MEMORIZE THIS):
Calories NEVER change as the primary goal. We swap macros, not total intake.
- To drop body fat while preserving muscle: drop carbs 50g, add 50g protein. Net calorie change = 0 (both are 4 cal/g). This is always the first move.
- If using red meat or higher-fat protein as the swap: fat is 9 cal/g vs protein at 4 cal/g, so a 50g carb drop replaced with ~22g fat (e.g. red meat portion) keeps calories roughly equal. Fat does NOT make you fat — excess carbs do.
- You only shift the ratio: fewer carbs, more protein (or more fat from quality meat). Total food volume stays similar.
- You do NOT track or count calories as a metric — macros are the lever.

REFEED PROTOCOL (what to do when weight stalls):
A stall = the same weight for multiple days IN A ROW while energy stays OK.
- LARGER ATHLETE (roughly 160 lbs+, male or stockier build): Add 50g carbs per day for 2–3 days. Expect to see the scale go UP 3–5 lbs. That weight gain is water — glycogen pulls water into muscle. After 2–3 days, drop back to previous carb level. Weight will come back down within 3–5 days, usually lower than before the refeed.
- SMALLER ATHLETE (roughly under 160 lbs, or a lighter female): Add 50g carbs per day for 2 days. Expect 2 lbs up. After 2 days, return to previous carb level. Scale resets within 3–4 days.
- If energy was dropping BEFORE the stall: the refeed is mandatory, not optional.
- If strength dropped during the stall: same refeed, but add an extra 25g protein on refeed days.

WHEN TO CHANGE NOTHING:
- Weight is moving down + energy is good + strength is holding = KEEP EVERYTHING EXACTLY THE SAME. Do not touch the protocol.
- Weight is moving down but energy is dropping = add the refeed now, don't wait for a stall.
- Weight is UP but energy and strength feel better = that is muscle + water. Do not panic. Do not drop carbs. Keep going.
`;

    let systemPrompt = `You are the competition prep and performance nutrition coach for MyPerfectMeals. You do not give nutritional education — you give orders. The user follows the protocol; you run the protocol.\n${languageRules}\n\n`;

    // ── Inject authoritative nutrition context — two separate blocks ──────────
    const starchyStr = starchyCarbs !== null ? `${starchyCarbs}g/day` : "not yet specified";
    const fibrousStr = fibrousCarbs !== null ? `${fibrousCarbs}g/day` : "not yet specified";
    const weightStr  = weightKgRaw ? `${weightKgRaw}kg / ${weightLbs}lb` : "not recorded";
    systemPrompt += `
AUTHORITATIVE BASELINE TARGETS — SOURCE: MACRO CALCULATOR
These are the permanent prescription. This system does not modify them.
When asked "how much protein should I eat?", state exactly ${baselineProtein}g — do not calculate a new number.
  Protein:        ${baselineProtein}g/day  [PROTECTED — no AI adjustment permitted]
  Carbohydrates:  ${baselineCarbs}g/day
  Starchy carbs:  ${starchyStr}
  Fibrous carbs:  ${fibrousStr}
  Fat:            ${baselineFat}g/day
  Calories:       ${baselineCalories}kcal/day
  Calculation timestamp: not stored in this system
  Body weight:    ${weightStr}
  Activity level: ${(macroRow as any)?.activityLevel ?? "not recorded"}

TODAY'S RESOLVED PERFORMANCE TARGETS — SOURCE: PERFORMANCE PROTOCOL RESOLVER
These are today's approved targets after the session modifier has been applied by the deterministic resolver.
The AI explains these values. The AI does not create a third set of numbers.
  Session type:   ${resolvedForAsk.sessionLabel}
  Protein:        ${resolvedForAsk.proteinG}g  [unchanged — protein is not session-adjusted]
  Carbohydrates:  ${resolvedForAsk.carbsG}g    [today's approved carb target]
  Fat:            ${resolvedForAsk.fatG}g       [unchanged — fat is not session-adjusted]
  Calories:       ${resolvedForAsk.calories}kcal

COACHING AUTHORITY RULES — NEVER VIOLATE:
- You execute these targets. You do not invent different numbers.
- Any carbohydrate timing guidance (pre/post workout) is an ALLOCATION of the ${resolvedForAsk.carbsG}g daily total — not an addition to it.
- Fat stays at ${resolvedForAsk.fatG}g. It does not auto-adjust when carbohydrates change.
- Protein stays at ${resolvedForAsk.proteinG}g. No modifier applies to protein in this system.

`;

    if (activeTrack === "competition" && compCtx) {
      const eventDate = new Date(compCtx.eventDate);
      const today = new Date();
      const weeksOut = Math.max(0, Math.round((eventDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      const compTypeMap: Record<string, string> = {
        bodybuilding_show: "Bodybuilding Show", mens_physique: "Men's Physique",
        classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
        wellness: "Wellness", powerlifting_meet: "Powerlifting Meet",
        strongman_competition: "Strongman Competition",
        olympic_weightlifting_meet: "Olympic Weightlifting Meet",
        fight_camp: "Fight Camp", wrestling_season: "Wrestling Season",
        crossfit_competition: "CrossFit Competition", hyrox: "Hyrox",
        marathon: "Marathon", triathlon_race: "Triathlon Race", spartan_race: "Spartan Race",
      };
      systemPrompt += `THIS ATHLETE'S COMPETITION PROFILE:
- Event: ${compTypeMap[compCtx.competitionType] ?? compCtx.competitionType}${compCtx.division ? ` — ${compCtx.division}` : ""}
- Event Date: ${compCtx.eventDate} (${weeksOut} weeks out)
- Current Weight: ${compCtx.currentWeight ?? "not recorded yet"}
- Target Weight: ${compCtx.targetWeight ?? "not recorded yet"}

PHASE GUIDANCE (based on weeks out):
${weeksOut > 16 ? "16+ weeks out: Build phase. Protein is the priority. Carbs are moderate and timed around training. No reason to drop anything yet — hold the line and let the body work." : ""}
${weeksOut <= 16 && weeksOut > 8 ? "8–16 weeks out: Early cut. If the scale is moving, keep current macros. If it stalls for 4+ days, drop carbs 50g and add 50g protein. That is the only move." : ""}
${weeksOut <= 8 && weeksOut > 4 ? "4–8 weeks out: Active cut. Scale must move week over week. If stalled 3+ days, drop 50g carbs and add 50g protein. Energy is a signal — if energy drops, trigger a 2-day refeed before making any other change." : ""}
${weeksOut <= 4 && weeksOut > 1 ? "Final 4 weeks: Peak prep. Every decision is about show-day condition. Water manipulation, sodium loading/depletion, and carb loading happen in the final 7 days only. Do not rush peak week protocol." : ""}
${weeksOut <= 1 ? "PEAK WEEK: Sodium depletion days 1–3. Distilled water only. Carb load starts day 4 — 200–300g complex carbs. Cut water day 6. Show day fueling is rice cakes + peanut butter backstage for pump." : ""}`;
    } else if (activeTrack === "athletic" && pCtx) {
      const demandLines = demand ? (() => {
        const fuelLabel: Record<string, string> = {
          low: "LOW — deficit/weight-cut phase",
          moderate: "MODERATE — balanced training",
          glycogen: "GLYCOGEN SUPPORT — high volume/intensity",
          competition: "COMPETITION — maximum glycolytic demand",
        };
        const recoveryLabel: Record<string, string> = {
          low: "LOW", moderate: "MODERATE", high: "HIGH — recovery is a priority right now",
        };
        const adaptLabel: Record<string, string> = {
          endurance_focused: "Endurance",
          power_focused: "Power/Speed",
          recovery_focused: "Recovery",
          body_composition_focused: "Body Composition",
        };
        return `
DEMAND INTELLIGENCE (computed from athlete profile):
- Fuel Demand: ${fuelLabel[demand.fuelDemand] ?? demand.fuelDemand}
- Recovery Demand: ${recoveryLabel[demand.recoveryDemand] ?? demand.recoveryDemand}
- Adaptation Focus: ${adaptLabel[demand.adaptationDemand] ?? demand.adaptationDemand}
- Training Load: ${demand.trainingLoad.toUpperCase()}
- Current Nutrition Priorities: ${demand.nutritionPriorities.join(" → ")}
Use these signals to inform the specificity and urgency of your coaching response.`;
      })() : "";

      systemPrompt += `THIS ATHLETE'S PERFORMANCE PROFILE:
- Sport/Training: ${pCtx.trainingType}
- Frequency: ${pCtx.trainingFrequency} sessions/week${pCtx.twoADays ? " (2-a-days)" : ""}
- Primary Goal: ${pCtx.primaryGoal}
- Training Phase: ${pCtx.trainingPhase}
- Cardio Focus: ${pCtx.cardioFocus}${pCtx.sessionDuration ? `\n- Session Duration: ${pCtx.sessionDuration}` : ""}${pCtx.recoveryStatus ? `\n- Self-Reported Recovery: ${pCtx.recoveryStatus}` : ""}${pCtx.adaptationTarget ? `\n- Adaptation Target: ${pCtx.adaptationTarget}` : ""}${demandLines}

ATHLETIC COACHING RULES:
- Fueling is about performance output — strength and endurance, not appearance.
- If strength is dropping: add carbs around training (pre and post). That is the first move.
- If energy is low on training days: add 25–50g carbs pre-workout. Not a supplement — food.
- If body composition is the goal alongside performance: follow the macro swap framework. Do NOT drop carbs on heavy training days.`;
    } else {
      systemPrompt += `No protocol configured yet. Tell the user: "Set up your protocol first — I need your training type and goal to give you specific numbers. Go to the setup screen." Do not give generic advice.`;
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 400,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "I couldn't generate a response. Please try again.";

    // ── Validate response against authoritative targets ───────────────────────
    const { validatePerformanceResponse, buildDeterministicFallback } = await import("../lib/performanceResponseValidator");
    const authTargets = {
      baseline: { proteinG: baselineProtein, carbsG: baselineCarbs, fatG: baselineFat, calories: baselineCalories },
      resolved: resolvedForAsk,
    };
    const firstCheck = validatePerformanceResponse(reply, authTargets);
    let finalReply = reply;

    if (!firstCheck.valid) {
      console.warn(`[APN /ask] Validation failed (${firstCheck.violations.length} violation(s)). Regenerating. Violations:`, firstCheck.violations);
      const retryMessages: any[] = [
        ...messages,
        { role: "assistant", content: reply },
        { role: "user", content: `SYSTEM CONSTRAINT: Your previous response contained a nutrition value that conflicts with this user's authoritative targets. Regenerate your response. Protein must be stated as exactly ${resolvedForAsk.proteinG}g. Carbohydrates must be stated as exactly ${resolvedForAsk.carbsG}g. Do not state different daily totals.` },
      ];
      const retryCompletion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: retryMessages,
        max_tokens: 400,
        temperature: 0.1,
      });
      const retryReply = retryCompletion.choices[0]?.message?.content?.trim() ?? "";
      const secondCheck = validatePerformanceResponse(retryReply, authTargets);
      if (!secondCheck.valid || !retryReply) {
        console.warn(`[APN /ask] Retry also failed validation. Returning deterministic fallback.`);
        finalReply = buildDeterministicFallback(authTargets);
      } else {
        finalReply = retryReply;
      }
    }

    res.json({ reply: finalReply });
  } catch (err: any) {
    console.error("[performanceNutrition] /ask error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Adaptive Performance Nutrition — Schedule + Today ─────────────────────────

/**
 * POST /api/performance/schedule
 * Saves weeklyTrainingSchedule + generates performanceProtocolConfig.
 * Can be called standalone (edit schedule) or from the setup flow.
 *
 * Body: {
 *   schedule: { monday, tuesday, wednesday, thursday, friday, saturday, sunday },
 *   trainingPhase: string,
 *   primaryGoal?: string,          // used to generate default modifiers
 *   baselineCalories?: number,     // override; falls back to user's daily_calorie_target
 *   baselineProteinG?: number,
 *   baselineCarbsG?: number,
 *   baselineFatG?: number,
 * }
 */
router.post("/schedule", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      schedule,
      trainingPhase,
      primaryGoal,
      baselineCalories,
      baselineProteinG,
      baselineCarbsG,
      baselineFatG,
    } = req.body;

    const VALID_SESSION_TYPES = ["strength", "power", "endurance", "sport_practice", "competition", "recovery", "off"];
    const VALID_PHASES = ["stabilization", "strength", "power", "peaking", "in_season", "off_season"];
    const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({ error: "schedule object required" });
    }

    const normalizedSchedule: Record<string, string> = {};
    for (const day of DAYS) {
      const val = schedule[day];
      if (!VALID_SESSION_TYPES.includes(val)) {
        return res.status(400).json({ error: `Invalid session type for ${day}: ${val}` });
      }
      normalizedSchedule[day] = val;
    }

    if (!VALID_PHASES.includes(trainingPhase)) {
      return res.status(400).json({ error: `Invalid trainingPhase: ${trainingPhase}` });
    }

    const [userRow] = await db
      .select({
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        dailyCarbsTarget:   users.dailyCarbsTarget,
        dailyFatTarget:     users.dailyFatTarget,
        performanceContext: users.performanceContext,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const pCtx = (userRow?.performanceContext as any) ?? {};
    const resolvedGoal = primaryGoal ?? pCtx.primaryGoal ?? "maintenance";

    const resolvedBaseCalories = baselineCalories ?? userRow?.dailyCalorieTarget ?? 2000;
    const resolvedBaseProtein  = baselineProteinG  ?? userRow?.dailyProteinTarget ?? 150;
    const resolvedBaseCarbs    = baselineCarbsG    ?? userRow?.dailyCarbsTarget   ?? 200;
    const resolvedBaseFat      = baselineFatG      ?? userRow?.dailyFatTarget     ?? 65;

    const { buildDefaultModifiers } = await import("../services/protocol/performanceProtocolResolver");
    const sessionModifiers = buildDefaultModifiers(resolvedGoal);

    const now = new Date().toISOString();

    const weeklyTrainingSchedule = {
      ...normalizedSchedule,
      trainingPhase,
      activatedAt: now,
      updatedAt: now,
    };

    // Performance Protocol only stores schedule modifiers — NOT a baseline snapshot.
    // The Macro Calculator (dailyCalorieTarget etc.) remains the sole owner of baseline macros.
    const performanceProtocolConfig = {
      sessionModifiers,
      generatedAt: now,
    };

    await db
      .update(users)
      .set({
        weeklyTrainingSchedule: weeklyTrainingSchedule as any,
        performanceProtocolConfig: performanceProtocolConfig as any,
      } as any)
      .where(eq(users.id, userId));

    const { resolveTodayTargets } = await import("../services/protocol/performanceProtocolResolver");
    const liveBaseline = {
      calories: resolvedBaseCalories,
      proteinG:  resolvedBaseProtein,
      carbsG:    resolvedBaseCarbs,
      fatG:      resolvedBaseFat,
    };
    const todayTargets = resolveTodayTargets(weeklyTrainingSchedule as any, performanceProtocolConfig as any, liveBaseline);

    console.log(`[APN] Schedule saved for user ${userId} — today: ${todayTargets.sessionType} (${todayTargets.calories} kcal)`);

    res.json({ ok: true, today: todayTargets, weeklyTrainingSchedule, performanceProtocolConfig });
  } catch (err: any) {
    console.error("[APN] /schedule error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/performance/today
 * Returns today's resolved session type + macro targets.
 * Sprint 1 success criterion: { sessionType, sessionLabel, calories, proteinG, carbsG, fatG }
 */
router.get("/today", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [userRow] = await db
      .select({
        weeklyTrainingSchedule:    users.weeklyTrainingSchedule,
        performanceProtocolConfig: users.performanceProtocolConfig,
        dailyCalorieTarget:        users.dailyCalorieTarget,
        dailyProteinTarget:        users.dailyProteinTarget,
        dailyCarbsTarget:          users.dailyCarbsTarget,
        dailyFatTarget:            users.dailyFatTarget,
        dailyStarchyCarbsTarget:   (users as any).dailyStarchyCarbsTarget,
        dailyFibrousCarbsTarget:   (users as any).dailyFibrousCarbsTarget,
        timezone:                  (users as any).timezone,
      } as any)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const schedule = (userRow as any)?.weeklyTrainingSchedule;
    const config   = (userRow as any)?.performanceProtocolConfig;

    // Gate: require Macro Calculator completion before serving personalized targets
    const todayCoreCheck = [
      (userRow as any)?.dailyCalorieTarget,
      (userRow as any)?.dailyProteinTarget,
      (userRow as any)?.dailyCarbsTarget,
      (userRow as any)?.dailyFatTarget,
    ];
    if (todayCoreCheck.some(v => v == null)) {
      return res.json({
        configured: false,
        macroCalculatorRequired: true,
        message: "Complete your Macro Calculator to unlock personalized performance targets.",
      });
    }

    if (!schedule || !config) {
      return res.json({ configured: false, message: "Performance schedule not yet configured." });
    }

    // Optional ?date=YYYY-MM-DD param — allows the hub to view any day's coaching plan
    const rawDateParam = typeof req.query.date === "string" ? req.query.date : null;
    const targetDate   = rawDateParam ? new Date(rawDateParam + "T12:00:00") : new Date();

    // Fetch macro log totals for the target date (today's logs when no date param)
    const { macroLogs } = await import("../../shared/schema");
    const logStart = new Date(targetDate); logStart.setHours(0, 0, 0, 0);
    const logEnd   = new Date(targetDate); logEnd.setHours(23, 59, 59, 999);
    const [logged] = await db
      .select({
        calories:      sql<number>`COALESCE(SUM(${macroLogs.kcal}), 0)`,
        proteinG:      sql<number>`COALESCE(SUM(${macroLogs.protein}), 0)`,
        carbsG:        sql<number>`COALESCE(SUM(${macroLogs.carbs}), 0)`,
        fatG:          sql<number>`COALESCE(SUM(${macroLogs.fat}), 0)`,
        starchyCarbsG: sql<number>`COALESCE(SUM(${macroLogs.starchyCarbs}), 0)`,
        fibrousCarbsG: sql<number>`COALESCE(SUM(${macroLogs.fibrousCarbs}), 0)`,
      })
      .from(macroLogs)
      .where(
        sql`${macroLogs.userId} = ${userId} AND ${macroLogs.at} >= ${logStart} AND ${macroLogs.at} <= ${logEnd}`
      );

    const { resolveTodayTargets } = await import("../services/protocol/performanceProtocolResolver");
    const { resolveDailyNutritionState } = await import("../services/dailyNutritionState");
    // Baseline always comes from the live Macro Calculator columns — never from the config snapshot.
    const rawStarchy = (userRow as any)?.dailyStarchyCarbsTarget ?? null;
    const rawFibrous = (userRow as any)?.dailyFibrousCarbsTarget ?? null;
    const baseCarbsG = (userRow as any)?.dailyCarbsTarget ?? 200;
    const liveBaseline = {
      calories:      (userRow as any)?.dailyCalorieTarget     ?? 2000,
      proteinG:      (userRow as any)?.dailyProteinTarget     ?? 150,
      carbsG:        baseCarbsG,
      fatG:          (userRow as any)?.dailyFatTarget         ?? 65,
      // If user hasn't set starchy/fibrous targets, estimate: 70% starchy / 30% fibrous of total carbs
      starchyCarbsG: rawStarchy !== null ? Number(rawStarchy) : Math.round(baseCarbsG * 0.7),
      fibrousCarbsG: rawFibrous !== null ? Number(rawFibrous) : Math.round(baseCarbsG * 0.3),
    };
    const today = resolveTodayTargets(schedule, config, liveBaseline, targetDate);

    // Resolve the C2 daily nutrition state — ledger reliability, starch policy, exhaustion
    // Only relevant when viewing today (not a past/future date).
    let dailyState: {
      starchPolicy: string;
      ledgerReliability: string;
      starchyBudgetExhausted: boolean;
      starchyCarbsRemainingG: number;
      scheduleConfigured: boolean;
    } | null = null;

    if (!rawDateParam) {
      try {
        const userTimezone = ((userRow as any)?.timezone as string | null) ?? "America/Chicago";
        const state = await resolveDailyNutritionState({
          userId:            String(userId),
          schedule,
          config,
          baseline:          liveBaseline,
          timezone:          userTimezone,
          performanceActive: true,
        });
        dailyState = {
          starchPolicy:          state.starchPolicy,
          ledgerReliability:     state.ledgerReliability,
          starchyBudgetExhausted: state.starchyBudgetExhausted,
          starchyCarbsRemainingG: state.starchyCarbsRemainingG,
          scheduleConfigured:    state.scheduleConfigured,
        };
      } catch (err) {
        console.warn("[APN] /today daily state resolution failed (non-fatal):", err);
      }
    }

    res.json({
      configured: true,
      ...today,
      logged: logged ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, starchyCarbsG: 0, fibrousCarbsG: 0 },
      dailyState,
    });
  } catch (err: any) {
    console.error("[APN] /today error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
