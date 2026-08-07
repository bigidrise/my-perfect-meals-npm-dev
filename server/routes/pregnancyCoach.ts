/**
 * Pregnancy Coach — AI Companion for My Perfect Pregnancy
 *
 * Reads the user's protocol envelope (stage, week, symptoms, allergies,
 * dietary identity, macros) and answers questions about food safety,
 * nausea, heartburn, fatigue, grocery shopping, restaurants, labs,
 * and meal planning during pregnancy.
 *
 * Pattern: mirrors groceryCoach.ts and getaway.ts coach architecture.
 * Sources: ACOG, FDA, CDC, EPA, NIH, AAP, WHO — cited neutrally.
 */

import express from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { coachingProfiles } from "../db/schema/ace";
import { eq, sql } from "drizzle-orm";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { getTierForLookupKey } from "@shared/planFeatures";

const router = express.Router();

// ─── Conversation persistence helpers ────────────────────────────────────────
// Table: pregnancy_conversations (user_id TEXT PRIMARY KEY, messages JSONB, updated_at TIMESTAMPTZ)

const MAX_TURNS = 20;

async function getConversation(
  userId: string
): Promise<Array<{ role: string; content: string }>> {
  try {
    const result = await db.execute(sql`
      SELECT messages FROM pregnancy_conversations
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const row =
      (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : null);
    if (!row?.messages) return [];
    const msgs = Array.isArray(row.messages)
      ? row.messages
      : JSON.parse(row.messages as string);
    return msgs.filter((m: any) => m?.role && m?.content);
  } catch (err: any) {
    if (err?.code !== "42P01") {
      console.warn("[PregnancyCoach] getConversation error:", err.message);
    }
    return [];
  }
}

async function saveConversation(
  userId: string,
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  const trimmed = messages.slice(-MAX_TURNS);
  try {
    await db.execute(sql`
      INSERT INTO pregnancy_conversations (user_id, messages, updated_at)
      VALUES (${userId}, ${JSON.stringify(trimmed)}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE
        SET messages = ${JSON.stringify(trimmed)}::jsonb,
            updated_at = now()
    `);
  } catch (err: any) {
    if (err?.code !== "42P01") {
      console.warn("[PregnancyCoach] saveConversation error:", err.message);
    }
  }
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

function stageLabelFull(stage: string): string {
  const labels: Record<string, string> = {
    "trying-to-conceive": "trying to conceive",
    "trimester-1": "first trimester (weeks 1–13)",
    "trimester-2": "second trimester (weeks 14–27)",
    "trimester-3": "third trimester (weeks 28–40)",
    breastfeeding: "breastfeeding",
    postpartum: "postpartum recovery",
  };
  return labels[stage] ?? stage;
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    "trying-to-conceive": "Trying to Conceive",
    "trimester-1": "First Trimester",
    "trimester-2": "Second Trimester",
    "trimester-3": "Third Trimester",
    breastfeeding: "Breastfeeding",
    postpartum: "Postpartum",
  };
  return labels[stage] ?? "Pregnancy";
}

// GET /conversation — load persisted conversation history
router.get("/conversation", async (req, res) => {
    const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const msgs = await getConversation(userId);
  return res.json({ messages: msgs });
});

// PATCH /conversation — persist conversation turns server-side
router.patch("/conversation", async (req, res) => {
    const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }
  try {
    await saveConversation(userId, messages);
  } catch {
    // non-fatal
  }
  return res.json({ ok: true });
});

// DELETE /conversation — clear conversation history
router.delete("/conversation", async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    await db.execute(sql`
      DELETE FROM pregnancy_conversations WHERE user_id = ${userId}
    `);
  } catch { /* non-fatal */ }
  res.json({ ok: true });
});

router.post("/ask", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // ── Paywall: pregnancy coach requires Clinical (ultimate) tier ───────────
    // Mirrors requireClinicalAccess middleware — same contract, same error shape.
    // BILLING_ENFORCED=true activates gating; false bypasses (dev/test).
    const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";
    if (BILLING_ENFORCED) {
      const authUser = (req as any).authUser ?? {};
      const { planLookupKey, accessTier } = authUser;
      // accessTier !== "PAID_FULL" → free/expired/trial — reject immediately
      if (accessTier !== "PAID_FULL") {
        return res.status(403).json({
          error: "This feature requires a Clinical subscription",
          code: "CLINICAL_REQUIRED",
          requiredTier: "clinical",
          accessTier,
        });
      }
      // null planLookupKey with PAID_FULL = internal/founder account — grant access
      if (planLookupKey !== null && planLookupKey !== undefined) {
        const tier = getTierForLookupKey(planLookupKey);
        if (tier !== "ultimate") {
          return res.status(403).json({
            error: "This feature requires a Clinical subscription",
            code: "CLINICAL_REQUIRED",
            requiredTier: "clinical",
            accessTier,
            currentTier: tier,
          });
        }
      }
    }

    let envelopeContext = "";
    let pregnancyContext = "";
    let macroContext = "";
    let stage = "trimester-2";
    let weekOfPregnancy: number | null = null;
    let symptoms: string[] = [];
    let isBreastfeeding = false;

    if (userId) {
      const envelope = await loadUserProtocolEnvelope(userId);
      if (envelope) {
        const parts: string[] = [];

        if (envelope.dietaryIdentity?.length) {
          parts.push(
            `Dietary restrictions/identity: ${envelope.dietaryIdentity.join(", ")}`
          );
        }
        if (envelope.allergies?.length) {
          parts.push(
            `Allergies (hard stops — never suggest these): ${envelope.allergies.join(", ")}`
          );
        }
        if (envelope.conditionGuidanceBlocks?.length) {
          parts.push(
            "This user also has active medical protocols (cardiac, renal, etc.) — all apply in parallel with pregnancy guidance."
          );
        }
        if (envelope.cuisinePreference) {
          parts.push(`Preferred cuisine: ${envelope.cuisinePreference}`);
        }
        envelopeContext = parts.join(". ");

        if (envelope.pregnancySupportContext) {
          stage = envelope.pregnancySupportContext.stage;
          weekOfPregnancy = envelope.pregnancySupportContext.weekOfPregnancy;
          symptoms = envelope.pregnancySupportContext.symptoms ?? [];
          isBreastfeeding = envelope.pregnancySupportContext.isBreastfeeding;

          const pregnancyParts: string[] = [];
          pregnancyParts.push(`Current stage: ${stageLabelFull(stage)}`);
          if (weekOfPregnancy)
            pregnancyParts.push(`Week: ${weekOfPregnancy}`);
          if (symptoms.length) {
            pregnancyParts.push(
              `Active symptoms: ${symptoms.map(s => s.replace(/_/g, " ")).join(", ")}`
            );
          }
          if (isBreastfeeding) pregnancyParts.push("Currently breastfeeding.");
          pregnancyContext = pregnancyParts.join(". ");
        }

        const [userRow] = await db
          .select({
            dailyCalorieTarget: users.dailyCalorieTarget,
            dailyProteinTarget: users.dailyProteinTarget,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (userRow?.dailyCalorieTarget) {
          macroContext = `Daily calorie target: ${userRow.dailyCalorieTarget} cal`;
          if (userRow.dailyProteinTarget)
            macroContext += `, ${userRow.dailyProteinTarget}g protein`;
        }
      }
    }

    // ── Behavioral profile ────────────────────────────────────────────────────
    let behavioralContext = "";
    if (userId) {
      try {
        const [profile] = await db
          .select()
          .from(coachingProfiles)
          .where(eq(coachingProfiles.userId, userId))
          .limit(1);

        if (profile) {
          const lines: string[] = [];
          if (profile.setbackResponse)
            lines.push(
              `setback response: ${profile.setbackResponse.replace(/_/g, " ")}`
            );
          if (profile.motivationDriver)
            lines.push(
              `motivation: ${profile.motivationDriver.replace(/_/g, " ")}`
            );
          if (profile.trustStyle)
            lines.push(
              `trust style: ${profile.trustStyle.replace(/_/g, " ")}`
            );
          if (profile.overwhelmResponse)
            lines.push(
              `under pressure: ${profile.overwhelmResponse.replace(/_/g, " ")}`
            );
          if (profile.recoveryPreference)
            lines.push(
              `prefers: ${profile.recoveryPreference.replace(/_/g, " ")}`
            );
          if (profile.progressMindset)
            lines.push(
              `mindset: ${profile.progressMindset.replace(/_/g, " ")}`
            );
          if (profile.eatingDriver)
            lines.push(
              `eating driver: ${profile.eatingDriver.replace(/_/g, " ")}`
            );
          if (profile.cravingResponse)
            lines.push(
              `craving pattern: ${profile.cravingResponse.replace(/_/g, " ")}`
            );
          if (profile.hardestPart)
            lines.push(
              `hardest part of the plan: ${profile.hardestPart.replace(/_/g, " ")}`
            );
          if (
            profile.offTrackCauses &&
            Array.isArray(profile.offTrackCauses) &&
            profile.offTrackCauses.length
          ) {
            lines.push(
              `common off-track causes: ${(profile.offTrackCauses as string[])
                .join(", ")
                .replace(/_/g, " ")}`
            );
          }
          if (lines.length) behavioralContext = lines.join("; ");
        }
      } catch {
        // non-fatal — behavioral profile is enrichment, not required
      }
    }

    const stageDisplay = stageLabel(stage);
    const weekDisplay = weekOfPregnancy ? ` (Week ${weekOfPregnancy})` : "";

    const systemPrompt = `You are the Pregnancy Coach for My Perfect Pregnancy — a warm, knowledgeable nutrition companion built into the My Perfect Meals app. You specialize in pregnancy nutrition, food safety, and wellness support throughout every stage of pregnancy and postpartum.

ABOUT THIS USER:
${pregnancyContext ? `• ${pregnancyContext}` : `• Pregnancy stage: ${stageDisplay}${weekDisplay}`}
${envelopeContext ? `• ${envelopeContext}` : ""}
${macroContext ? `• ${macroContext}` : ""}

YOUR ROLE:
You help this user with questions about:
- Food safety during pregnancy (mercury in fish, listeria risk foods, raw proteins, alcohol, soft cheeses, deli meats)
- Nausea, heartburn, constipation, fatigue, food aversions, swelling, and other pregnancy symptoms
- Trimester-specific nutrient priorities (folate, iron, calcium, DHA, choline, vitamin D)
- Grocery shopping with a pregnancy lens (what to look for, what to skip)
- Restaurant ordering safely during pregnancy
- Meal planning ideas that honor her stage, symptoms, and dietary identity
- Breastfeeding nutrition if applicable
- Preconception nutrition if trying to conceive

FOOD SAFETY RULES YOU ALWAYS ENFORCE:
- Alcohol: zero tolerance — no safe amount during pregnancy or breastfeeding
- Raw fish, sushi, sashimi, raw shellfish: always advise against
- Raw/soft-boiled eggs: advise against unless pasteurized
- Deli meats, cold cuts, refrigerated smoked salmon: advise heating to 165°F or avoiding
- Unpasteurized dairy, soft cheeses (brie, camembert, queso fresco, gorgonzola): advise against unless confirmed pasteurized
- High-mercury fish: shark, swordfish, king mackerel, tilefish, bigeye tuna — always advise against
- Limit fish: albacore tuna, halibut, mahi-mahi — max 6 oz/week
- Raw sprouts: advise against (listeria risk)
When relevant, mention FDA/ACOG/CDC as the source of these guidelines.

SYMPTOM SUPPORT YOU KNOW:
- Nausea: ginger, bland foods, small frequent meals, crackers, B6, cool or room-temperature foods
- Heartburn: avoid acidic/spicy/fried foods, small meals, eat upright, bananas, oatmeal, yogurt
- Constipation: fiber (prunes, chia, oats, vegetables), hydration, gentle movement
- Fatigue: iron-rich foods + vitamin C for absorption, complex carbs, B vitamins
- Swelling: reduce sodium, potassium-rich foods (banana, avocado, sweet potato), hydration
- Food aversions: bland, familiar foods; respect what she can eat and work with it

HOW TO COACH THIS PERSON:
${
  behavioralContext
    ? `Her behavioral profile: ${behavioralContext}.
Use this to shape your communication style — not the content of pregnancy safety rules, which never change.`
    : `No behavioral profile on file yet — use a warm, encouraging, practical tone as a default.`
}

TONE:
- Warm, encouraging, practical — like a knowledgeable friend who also happens to know nutrition
- Never alarmist or fear-based
- Always remind her that her OB/GYN, midwife, or registered dietitian is her primary care guide
- Frame food guidance as "supportive" and "nourishing" — never as medical treatment or guaranteed outcomes
- When in doubt, tell her to confirm with her healthcare provider

SAFETY BOUNDARIES — NEVER DO:
- Never diagnose, treat, or suggest a specific pregnancy complication has been prevented or resolved
- Never recommend supplement doses, prenatal vitamin brands, or medication changes
- Never suggest food can prevent miscarriage, ensure a healthy baby, or guarantee any pregnancy outcome
- Never reference miscarriage, birth defects, or fetal health outcomes in alarming ways
- If asked about symptoms that sound medical (severe pain, bleeding, vision changes, severe swelling), always advise contacting her healthcare provider immediately — do not try to diagnose

Keep responses conversational and appropriately concise. Use line breaks to make the answer easy to read. Always be supportive.

RESPONSE FORMAT:
You MUST respond with a JSON object:
{
  "reply": "<your full warm, conversational answer here>",
  "suggestedMealActions": [
    { "actionType": "create_pregnancy_meal", "label": "<short button label, e.g. Build a Nausea-Friendly Ginger Bowl>", "mealIdea": "<specific buildable meal concept>" }
  ]
}

"suggestedMealActions": Include ONLY when your reply addresses a concrete food, meal, snack, or drink question that has a buildable solution. Leave as [] for symptom questions without a direct meal answer, medical referrals, supplement questions, or general safety warnings. Maximum 2 actions. "actionType" must always be exactly "create_pregnancy_meal".`;

    // ── Load conversation history from DB (authoritative) ─────────────────────
    const dbHistory = await getConversation(userId);

    // Build OpenAI message array — DB history capped at 12 turns
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...dbHistory.slice(-12).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let reply = "";
    let suggestedMealActions: { actionType: string; label: string; mealIdea: string }[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.reply === "string" && parsed.reply.trim()) reply = parsed.reply;
      if (Array.isArray(parsed.suggestedMealActions)) {
        suggestedMealActions = parsed.suggestedMealActions
          .filter((a: any) => a.actionType === "create_pregnancy_meal" && typeof a.label === "string" && typeof a.mealIdea === "string")
          .slice(0, 2);
      }
    } catch {
      if (raw && raw !== "{}") reply = raw;
    }
    if (userId) {
      const updatedHistory = [
        ...dbHistory,
        { role: "user", content: message },
        { role: "assistant", content: reply },
      ];
      saveConversation(userId, updatedHistory).catch(err =>
        console.warn("[PregnancyCoach] Failed to persist conversation:", err)
      );
    }

    return res.json({
      reply,
      stage: stageLabel(stage),
      weekOfPregnancy,
      ...(suggestedMealActions.length > 0 ? { suggestedMealActions } : {}),
    });
  } catch (error: any) {
    console.error("[PregnancyCoach] Error:", error);
    return res
      .status(500)
      .json({ error: "Pregnancy Coach is temporarily unavailable." });
  }
});

// POST /setup — save pregnancy stage, due date, symptoms, tracking mode
router.post("/setup", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const {
      stage,
      dueDate,
      symptoms = [],
      trackingMode = "manual",
      isBreastfeeding = false,
    } = req.body;

    const validStages = [
      "trying-to-conceive",
      "trimester-1",
      "trimester-2",
      "trimester-3",
      "breastfeeding",
      "postpartum",
    ];
    if (stage && !validStages.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const now = new Date().toISOString();

    const [currentUser] = await db
      .select({ specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentConditions: string[] =
      (currentUser?.specialtyConditions as string[] | null) ?? [];
    const updatedConditions = currentConditions.filter(
      c => c !== "pregnancy-support"
    );

    await db
      .update(users)
      .set({
        ...(stage ? { pregnancyStage: stage } : {}),
        ...(dueDate !== undefined
          ? { pregnancyDueDate: dueDate || null }
          : {}),
        pregnancySupportContext: {
          symptoms,
          trackingMode,
          isBreastfeeding,
          activatedAt: now,
          updatedAt: now,
        } as any,
        specialtyConditions: updatedConditions as any,
      })
      .where(eq(users.id, userId));

    console.log(
      `[PregnancyCoach] Setup saved for user ${userId}: stage=${stage}, trackingMode=${trackingMode}, symptoms=${symptoms.join(",")}`
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[PregnancyCoach] Setup error:", error);
    return res
      .status(500)
      .json({ error: "Failed to save pregnancy setup" });
  }
});

// DELETE /setup — deactivate pregnancy support without touching other protocols
router.delete("/setup", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const [currentUser] = await db
      .select({ specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentConditions: string[] =
      (currentUser?.specialtyConditions as string[] | null) ?? [];
    const updatedConditions = currentConditions.filter(
      c => c !== "pregnancy-support"
    );

    await db
      .update(users)
      .set({
        pregnancyStage: null,
        pregnancyDueDate: null,
        pregnancySupportContext: null,
        specialtyConditions: updatedConditions as any,
      })
      .where(eq(users.id, userId));

    console.log(
      `[PregnancyCoach] Pregnancy support deactivated for user ${userId}`
    );
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[PregnancyCoach] Deactivate error:", error);
    return res
      .status(500)
      .json({ error: "Failed to deactivate pregnancy support" });
  }
});

export default router;
