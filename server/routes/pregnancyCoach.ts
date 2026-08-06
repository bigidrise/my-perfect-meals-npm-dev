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

function stageLabelFull(stage: string): string {
  const labels: Record<string, string> = {
    "trying-to-conceive": "trying to conceive",
    "trimester-1": "first trimester (weeks 1–13)",
    "trimester-2": "second trimester (weeks 14–27)",
    "trimester-3": "third trimester (weeks 28–40)",
    "breastfeeding": "breastfeeding",
    "postpartum": "postpartum recovery",
  };
  return labels[stage] ?? stage;
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    "trying-to-conceive": "Trying to Conceive",
    "trimester-1": "First Trimester",
    "trimester-2": "Second Trimester",
    "trimester-3": "Third Trimester",
    "breastfeeding": "Breastfeeding",
    "postpartum": "Postpartum",
  };
  return labels[stage] ?? "Pregnancy";
}

// ─── Conversation persistence ─────────────────────────────────────────────────
// Table: pregnancy_conversations (user_id TEXT PRIMARY KEY, messages JSONB, updated_at TIMESTAMPTZ)
// Keyed by user_id only — a user has one pregnancy conversation at a time.

async function getConversation(userId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const result = await db.execute(sql`
      SELECT messages FROM pregnancy_conversations
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const row = (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : null);
    if (!row?.messages) return [];
    const msgs = Array.isArray(row.messages) ? row.messages : JSON.parse(row.messages as string);
    return msgs.filter((m: any) => m?.role && m?.content);
  } catch (err: any) {
    // 42P01 = table not yet created — non-fatal, fall back to empty
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
  const trimmed = messages.slice(-20);
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

// GET /conversation — load persisted conversation history
router.get("/conversation", async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const messages = await getConversation(userId);
  res.json({ messages });
});

// PATCH /conversation — persist conversation turns server-side
router.patch("/conversation", async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.json({ ok: true });
  await saveConversation(userId, messages);
  res.json({ ok: true });
});

// DELETE /conversation — clear history (start fresh)
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
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    // ── Clinical paywall guard ──────────────────────────────────────────
    if (userId && process.env.BILLING_ENFORCED === "true") {
      const [userRow] = await db
        .select({ entitlements: users.entitlements })
        .from(users)
        .where(eq(users.id, userId));
      const entitlements: string[] = (userRow?.entitlements as string[]) || [];
      if (!entitlements.includes("pregnancy") && !entitlements.includes("FULL_ACCESS")) {
        return res.status(403).json({ error: "requires_upgrade", feature: "pregnancy" });
      }
    } else if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Load protocol envelope for full user context
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

        // Dietary identity
        if (envelope.dietaryIdentity?.length) {
          parts.push(`Dietary restrictions/identity: ${envelope.dietaryIdentity.join(", ")}`);
        }

        // Allergies
        if (envelope.allergies?.length) {
          parts.push(`Allergies (hard stops — never suggest these): ${envelope.allergies.join(", ")}`);
        }

        // Other active conditions
        if (envelope.conditionGuidanceBlocks?.length) {
          parts.push("This user also has active medical protocols (cardiac, renal, etc.) — all apply in parallel with pregnancy guidance.");
        }

        // Cuisine preferences
        if (envelope.cuisinePreference) {
          parts.push(`Preferred cuisine: ${envelope.cuisinePreference}`);
        }

        envelopeContext = parts.join(". ");

        // Pregnancy-specific context
        if (envelope.pregnancySupportContext) {
          stage = envelope.pregnancySupportContext.stage;
          weekOfPregnancy = envelope.pregnancySupportContext.weekOfPregnancy;
          symptoms = envelope.pregnancySupportContext.symptoms ?? [];
          isBreastfeeding = envelope.pregnancySupportContext.isBreastfeeding;

          const pregnancyParts: string[] = [];
          pregnancyParts.push(`Current stage: ${stageLabelFull(stage)}`);
          if (weekOfPregnancy) pregnancyParts.push(`Week: ${weekOfPregnancy}`);
          if (symptoms.length) {
            pregnancyParts.push(`Active symptoms: ${symptoms.map(s => s.replace(/_/g, " ")).join(", ")}`);
          }
          if (isBreastfeeding) pregnancyParts.push("Currently breastfeeding.");
          pregnancyContext = pregnancyParts.join(". ");
        }

        // Macro targets
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
          if (userRow.dailyProteinTarget) macroContext += `, ${userRow.dailyProteinTarget}g protein`;
        }
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

Keep responses conversational and appropriately concise. Use line breaks to make the answer easy to read. Always be supportive.`;

    // ── Load conversation history from DB (authoritative) ────────────────────
    const dbHistory = userId ? await getConversation(userId) : [];

    // Build conversation for OpenAI — use DB history, cap at 12 turns
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...dbHistory
        .slice(-12)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user", content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

    // ── Persist the new turn ──────────────────────────────────────────────────
    if (userId) {
      const updatedHistory = [
        ...dbHistory,
        { role: "user", content: message },
        { role: "assistant", content: reply },
      ];
      await saveConversation(userId, updatedHistory);
    }

    return res.json({
      reply,
      stage: stageLabel(stage),
      weekOfPregnancy,
    });
  } catch (error: any) {
    console.error("[PregnancyCoach] Error:", error);
    return res.status(500).json({ error: "Pregnancy Coach is temporarily unavailable." });
  }
});

// Save pregnancy setup (stage, due date, symptoms, tracking mode)
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

    // Validate stage
    const validStages = ["trying-to-conceive", "trimester-1", "trimester-2", "trimester-3", "breastfeeding", "postpartum"];
    if (stage && !validStages.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const now = new Date().toISOString();

    // Read current specialty conditions so we can upsert "pregnancy-support"
    // without clobbering other active conditions (thyroid, cardiac, etc.).
    const [currentUser] = await db
      .select({ specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentConditions: string[] = (currentUser?.specialtyConditions as string[] | null) ?? [];
    const updatedConditions: string[] = currentConditions.includes("pregnancy-support")
      ? currentConditions
      : [...currentConditions, "pregnancy-support"];

    await db
      .update(users)
      .set({
        ...(stage ? { pregnancyStage: stage } : {}),
        ...(dueDate !== undefined ? { pregnancyDueDate: dueDate || null } : {}),
        pregnancySupportContext: {
          symptoms: symptoms,
          trackingMode: trackingMode,
          isBreastfeeding: isBreastfeeding,
          activatedAt: now,
          updatedAt: now,
        } as any,
        specialtyConditions: updatedConditions as any,
      })
      .where(eq(users.id, userId));

    console.log(`[PregnancyCoach] Setup saved for user ${userId}: stage=${stage}, trackingMode=${trackingMode}, symptoms=${symptoms.join(",")}`);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[PregnancyCoach] Setup error:", error);
    return res.status(500).json({ error: "Failed to save pregnancy setup" });
  }
});

// Deactivate pregnancy support — clears all pregnancy fields and removes
// "pregnancy-support" from specialtyConditions without touching other protocols.
router.delete("/setup", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [currentUser] = await db
      .select({ specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentConditions: string[] = (currentUser?.specialtyConditions as string[] | null) ?? [];
    const updatedConditions = currentConditions.filter(c => c !== "pregnancy-support");

    await db
      .update(users)
      .set({
        pregnancyStage: null,
        pregnancyDueDate: null,
        pregnancySupportContext: null,
        specialtyConditions: updatedConditions as any,
      })
      .where(eq(users.id, userId));

    console.log(`[PregnancyCoach] Pregnancy support deactivated for user ${userId}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[PregnancyCoach] Deactivate error:", error);
    return res.status(500).json({ error: "Failed to deactivate pregnancy support" });
  }
});

export default router;
