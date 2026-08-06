/**
 * My Perfect Beginning — Parent's Corner AI
 *
 * Answers parenting nutrition questions with the calm, reassuring voice
 * of a pediatric dietitian grounded in the active Child Nutrition Profile.
 *
 * Reasoning chain (spec Section 17):
 *   stage → safety → growth concern → medical → normal behavior →
 *   behavioral strategy → recipe → education → escalation
 *
 * Pattern: mirrors pregnancyCoach.ts architecture.
 * Sources: AAP, WHO, USDA Dietary Guidelines for Americans, CDC growth charts.
 */

import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── Stage labels ─────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  early_infant: "Early Infant (birth–~5 months)",
  beginning_foods: "Beginning Foods (~6–11 months)",
  young_toddler: "Young Toddler (12–23 months)",
  toddler: "Toddler (2–3 years)",
  preschool: "Preschool (4–5 years)",
  early_school_age: "Early School Age (6–8 years)",
  growing_child: "Growing Child (9–12 years)",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(childContext: Record<string, any>): string {
  const nickname = childContext.nickname || "your child";
  const stage = childContext.developmentalStage || "toddler";
  const stageFull = stageLabel(stage);
  const ageMonths = childContext.currentAgeMonths;
  const ageDisplay = ageMonths
    ? ageMonths < 24
      ? `${ageMonths} months old`
      : `${Math.floor(ageMonths / 12)} years ${ageMonths % 12 ? `${ageMonths % 12} months` : ""}old`.trim()
    : null;

  // Build child context lines
  const contextLines: string[] = [];
  contextLines.push(`Child's name: ${nickname}`);
  contextLines.push(`Developmental stage: ${stageFull}`);
  if (ageDisplay) contextLines.push(`Age: ${ageDisplay}`);
  if (childContext.sex && childContext.sex !== "not_specified") {
    contextLines.push(`Sex: ${childContext.sex}`);
  }
  if (childContext.prematureBirth && childContext.gestationalAgeAtBirthWeeks) {
    contextLines.push(
      `Born prematurely at ${childContext.gestationalAgeAtBirthWeeks} weeks. Use corrected age for developmental guidance.`
    );
  }

  // Feeding ability
  const feeding = childContext.feedingAbility;
  if (feeding) {
    if (feeding.textureLevel) contextLines.push(`Texture level: ${feeding.textureLevel.replace(/_/g, " ")}`);
    if (feeding.swallowingDifficulty) contextLines.push("Has swallowing difficulty — clinician-prescribed texture only.");
    if (feeding.historyOfChokingOrGagging) contextLines.push("History of choking or gagging — extra texture vigilance required.");
    if (feeding.hasFeedingTube) contextLines.push("Has a feeding tube — consult feeding therapist.");
    if (feeding.receivingFeedingTherapy) contextLines.push("Receiving OT/SLP feeding therapy.");
  }

  // Growth concerns
  const growth = childContext.growth;
  if (growth?.pediatricianConcern && growth.pediatricianConcern !== "none") {
    contextLines.push(
      `Pediatrician has identified a growth concern: ${growth.pediatricianConcern.replace(/_/g, " ")}. Respect clinician guidance.`
    );
  }

  // Allergies
  const allergy = childContext.allergyProfile;
  if (allergy?.entries?.length) {
    const confirmedAllergens = allergy.entries
      .filter((e: any) => ["confirmed_allergy", "clinician_elimination"].includes(e.severity))
      .map((e: any) => e.customAllergenName || e.allergenId.replace(/_/g, " "));
    if (confirmedAllergens.length) {
      contextLines.push(`Confirmed allergens (never suggest): ${confirmedAllergens.join(", ")}`);
    }
    if (allergy.celiacDisease) contextLines.push("Has celiac disease — strictly gluten-free.");
    if (allergy.lactoseIntolerance) contextLines.push("Lactose intolerant.");
  }

  // Medical conditions
  if (childContext.diagnosedConditions?.length) {
    const conditions = childContext.diagnosedConditions
      .map((c: any) => (typeof c === "string" ? c : c.conditionId || c.label || c))
      .join(", ");
    contextLines.push(`Active medical conditions: ${conditions}`);
  }

  // Eating behavior
  const behavior = childContext.eatingBehavior;
  if (behavior) {
    if (behavior.pickyEater) contextLines.push("Parent describes child as a picky eater.");
    if (behavior.sensorySensitivities) contextLines.push("Has sensory sensitivities around food.");
    if (behavior.fearOfNewFoods) contextLines.push("Shows neophobia (fear of new foods).");
    if (behavior.foodsLoved?.length) contextLines.push(`Foods loved: ${behavior.foodsLoved.slice(0, 5).join(", ")}`);
    if (behavior.foodsRefused?.length) contextLines.push(`Foods refused: ${behavior.foodsRefused.slice(0, 5).join(", ")}`);
    if (behavior.parentsBiggestFeedingChallenge) {
      contextLines.push(`Parent's biggest feeding challenge: ${behavior.parentsBiggestFeedingChallenge}`);
    }
  }

  // Activity / sports
  const activity = childContext.activity;
  if (activity?.organizedSports && activity.sportNames?.length) {
    contextLines.push(`Plays organized sports: ${activity.sportNames.join(", ")}`);
  }

  // Household diet
  const household = childContext.householdDiet;
  if (household?.dietaryPattern && household.dietaryPattern !== "omnivore") {
    contextLines.push(`Household dietary pattern: ${household.dietaryPattern.replace(/_/g, " ")}`);
  }
  if (household?.requiresSchoolSafe) contextLines.push("Requires school-safe (nut-free) meals.");

  const childProfile = contextLines.map((l) => `• ${l}`).join("\n");

  return `You are Parent's Corner — the trusted pediatric nutrition guide inside My Perfect Beginning.

You sound like the most reassuring pediatric dietitian a parent has ever spoken to. Not a chatbot. Not a doctor. Not a search engine. A knowledgeable, calm, been-there guide who has helped hundreds of families and knows that most parenting food panic is normal.

━━━ CHILD PROFILE ━━━
${childProfile}

━━━ YOUR REASONING CHAIN ━━━
Before responding, reason through these steps in order (internally — do not expose this chain to the parent):

1. STAGE — What is this child's developmental stage? Does the question touch stage-specific nutrition, texture safety, or milestone-related feeding?
2. SAFETY — Is there a choking hazard, food safety risk, formula modification concern, or texture violation for this child's profile?
3. GROWTH — Is there a clinician-flagged growth concern that should shape your answer?
4. MEDICAL — Is there an active medical condition (allergy, celiac, T1D, diagnosed condition) that must constrain the answer?
5. NORMAL BEHAVIOR — Is this a normal developmental behavior? Check: picky eating at 2–3 years is typical neophobia; appetite fluctuation in toddlers is normal; food jags are common in preschoolers.
6. BEHAVIORAL STRATEGY — What feeding strategy is most evidence-backed here? (Repeated exposure, division of responsibility, family meals, neutral language around food, etc.)
7. RECIPE / MEAL IDEA — Would a specific practical suggestion help? Keep it stage-appropriate.
8. EDUCATION — What does a great pediatric dietitian teach parents in this situation? Keep it to the single most valuable insight.
9. ESCALATION — Does this question contain any red flags requiring a pediatrician mention? (Significant weight loss, not meeting developmental milestones, persistent vomiting, suspected allergy reaction, extreme food restriction, failure to thrive signals.) If yes: "This is worth mentioning to your pediatrician" — gentle but clear.

━━━ VOICE RULES ━━━
• ALWAYS start by normalizing when the situation is normal ("This is very common at this stage…", "Many families see this…")
• NEVER lead with alarming information — reassure first, then educate
• NEVER diagnose or suggest a diagnosis
• Offer ONE actionable step, not a list of ten
• When escalation is needed: "This is worth mentioning to your pediatrician" — gentle but clear
• NEVER shame eating choices, food preferences, or parenting decisions
• ALWAYS ground answers in ${nickname}'s actual stage and profile above
• Use the child's name (${nickname}) naturally in your response
• Keep answers conversational and warm — under 200 words unless the question is genuinely complex
• Never use clinical jargon without immediately explaining it in plain language

━━━ HARD BOUNDARIES ━━━
• You do not diagnose conditions
• You do not contradict clinician instructions recorded in the child's profile
• For ${stage === "early_infant" ? "early infants (birth–5 months): recommend only breast milk or formula; zero solid food guidance" : "this stage: always honor the texture level and feeding ability in the profile above"}
• If asked about medication, supplements beyond standard pediatric vitamins, or treatment: "That's a great question for your child's pediatrician or a registered pediatric dietitian."
• Never suggest calorie restriction or dieting language for children

━━━ KNOWLEDGE FOUNDATION ━━━
You draw from: AAP feeding guidelines, WHO growth standards, USDA Dietary Guidelines for Americans (birth through 24 months; 2–5 years editions), Division of Responsibility (Ellyn Satter Institute), pediatric nutrition research, and standard pediatric dietitian practice.

━━━ RESPONSE FORMAT ━━━
You MUST respond with a JSON object containing exactly two fields:
{
  "reply": "<your full warm, conversational answer here>",
  "suggestedFollowUps": ["<question 1>", "<question 2>", "<question 3>"]
}

The "suggestedFollowUps" array must contain exactly 2–3 short, natural follow-up questions a parent would genuinely want to ask next based on your reply. Questions should be specific to the topic just discussed and helpful for parents who don't know what to ask next. Write them as a parent would naturally phrase them (not as "Ask about…" but as the actual question, e.g. "How often should I offer the new food?"). Never repeat the question just asked. No markdown outside the JSON.`;
}

// ─── Today's Tips by stage ────────────────────────────────────────────────────

const STAGE_TIPS: Record<string, string[]> = {
  early_infant: [
    "Breast milk or formula provides everything your baby needs right now — no solids needed before around 6 months.",
    "Watch for feeding cues: turning toward the breast or bottle, rooting, sucking on hands. Hunger isn't always crying.",
    "Feeding on demand in early infancy supports milk supply and helps your baby learn to self-regulate hunger.",
  ],
  beginning_foods: [
    "Children often need 10–15 exposures to a new food before accepting it. Tonight's rejection isn't permanent.",
    "Self-feeding is messy by design. The mess is development in progress.",
    "Offering allergenic foods early (peanuts, eggs, tree nuts) alongside other first foods is now supported by leading pediatric guidelines.",
    "Iron-rich foods (pureed meats, iron-fortified cereals) are a priority at 6 months — breast milk alone can't keep up with iron needs.",
  ],
  young_toddler: [
    "Many toddlers naturally eat more some days and less on others. A week-level view is more useful than a single meal.",
    "Toddlers who touch, smell, and play with new foods are more likely to eventually eat them. Exploration counts.",
    "Whole milk (or an appropriate alternative) remains important through age 2 for brain development.",
    "Self-feeding with a spoon, even messily, builds the skills and confidence that lead to adventurous eating.",
  ],
  toddler: [
    "The 'picky eater' phase typically peaks between ages 2–3. It's neophobia — a normal developmental protective instinct.",
    "Pressure to eat ('one more bite') tends to make picky eating worse. Serving without pressure works better over time.",
    "Offering a familiar food alongside a new one at every meal is the simplest evidence-backed exposure strategy.",
    "Toddlers who eat with the family — same table, same foods — tend to develop more variety over time.",
  ],
  preschool: [
    "Packing one familiar food and one new food together is a simple way to build variety without overwhelming children.",
    "Preschoolers learn food acceptance from watching adults and peers eat — their social eating environment matters.",
    "Involving children in grocery shopping and simple meal prep increases their curiosity about food.",
    "Juice provides little nutrition compared to whole fruit and can crowd out appetite for more nutritious foods.",
  ],
  early_school_age: [
    "After-school hunger is real — a planned snack with protein and carbs prevents overeating at dinner.",
    "Young athletes have higher iron and carbohydrate needs — whole grains and lean protein help meet them.",
    "Children who eat breakfast consistently show better concentration and energy through the school morning.",
    "Cooking together once a week dramatically increases how willing children are to try new foods.",
  ],
  growing_child: [
    "Growing children ages 9–12 have high calcium needs — 1,300mg/day supports the bone-building happening right now.",
    "Children in this stage often need a pre-sport snack: a banana, whole-grain crackers, or a small sandwich 30–60 minutes before practice.",
    "Screens during meals consistently reduce awareness of hunger and fullness signals — even a short screen-free dinner helps.",
    "This is an important window for building a healthy relationship with food — neutral, curious language matters more than rules.",
  ],
};

function getTodaysTip(stage: string): string {
  const tips = STAGE_TIPS[stage] || STAGE_TIPS["toddler"];
  // Rotate daily (deterministic, no randomness)
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return tips[dayOfYear % tips.length];
}

/**
 * Verify that the given child_profile_id is owned by the requesting user.
 *
 * When the child_profiles table exists (created by sibling task) this performs
 * a strict DB ownership lookup.  Until that table is available the function
 * falls back to validating that the supplied ID is a well-formed UUID — a
 * necessary minimum because child profile IDs generated by the client are
 * always UUIDs, so any non-UUID value is a clear manipulation signal.
 *
 * The function fails closed: if the child_profiles table exists but has no
 * matching row, it returns false and the caller must return 403.
 */
async function assertChildOwnership(userId: string, childProfileId: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT 1 FROM child_profiles
      WHERE id = ${childProfileId} AND user_id = ${userId}
      LIMIT 1
    `);
    const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);
    return !!row;
  } catch (err: any) {
    // 42P01 = undefined_table — child_profiles hasn't been created yet
    if (err?.code === "42P01") {
      // Fall back to UUID format check as a minimal guard
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childProfileId);
    }
    // Any other unexpected DB error — fail closed
    throw err;
  }
}

async function getConversation(userId: string, childProfileId: string): Promise<any[]> {
  try {
    const rows = await db.execute(sql`
      SELECT messages FROM parents_corner_conversations
      WHERE user_id = ${userId} AND child_profile_id = ${childProfileId}
      LIMIT 1
    `);
    const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);
    if (!row) return [];
    const msgs = row.messages;
    if (Array.isArray(msgs)) return msgs;
    if (typeof msgs === "string") return JSON.parse(msgs);
    return [];
  } catch {
    return [];
  }
}

async function clearConversation(userId: string, childProfileId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM parents_corner_conversations
    WHERE user_id = ${userId} AND child_profile_id = ${childProfileId}
  `);
}

async function saveConversation(userId: string, childProfileId: string, messages: any[]): Promise<void> {
  const msgsJson = JSON.stringify(messages);
  await db.execute(sql`
    INSERT INTO parents_corner_conversations (user_id, child_profile_id, messages, updated_at)
    VALUES (${userId}, ${childProfileId}, ${msgsJson}::jsonb, now())
    ON CONFLICT (user_id, child_profile_id)
    DO UPDATE SET messages = ${msgsJson}::jsonb, updated_at = now()
  `);
}

// ─── Valid age stages ────────────────────────────────────────────────────────

const VALID_AGE_STAGES_SET = new Set([
  "early_infant", "beginning_foods", "young_toddler", "toddler",
  "preschool", "early_school_age", "growing_child",
]);

// ─── Child Profile CRUD ───────────────────────────────────────────────────────

function normalizeRows(result: any): any[] {
  return (result as any).rows ?? (Array.isArray(result) ? result : []);
}

// GET /children — list authenticated user's non-archived children
router.get("/children", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute(sql`
      SELECT id, user_id, name, date_of_birth, age_stage, allergies,
             dietary_preferences, medical_conditions, feeding_concerns,
             sensory_issues, dislikes, cultural_preferences, emoji,
             created_at, updated_at
      FROM child_profiles
      WHERE user_id = ${userId} AND is_archived = false
      ORDER BY created_at ASC
    `);
    return res.json({ children: normalizeRows(result) });
  } catch (err: any) {
    console.error("[MPB/children] GET error:", err.message);
    return res.status(500).json({ error: "Failed to load child profiles" });
  }
});

// POST /children — create a new child profile
router.post("/children", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    name, age_stage, date_of_birth = null, emoji = "👶",
    allergies = [], dietary_preferences = [], medical_conditions = [],
    feeding_concerns = [], sensory_issues = [], dislikes = [],
    cultural_preferences = null,
  } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!age_stage || !VALID_AGE_STAGES_SET.has(age_stage)) {
    return res.status(400).json({ error: "valid age_stage is required" });
  }

  const aJson = JSON.stringify(Array.isArray(allergies) ? allergies : []);
  const dpJson = JSON.stringify(Array.isArray(dietary_preferences) ? dietary_preferences : []);
  const mcJson = JSON.stringify(Array.isArray(medical_conditions) ? medical_conditions : []);
  const fcJson = JSON.stringify(Array.isArray(feeding_concerns) ? feeding_concerns : []);
  const siJson = JSON.stringify(Array.isArray(sensory_issues) ? sensory_issues : []);
  const dlJson = JSON.stringify(Array.isArray(dislikes) ? dislikes : []);

  try {
    const result = await db.execute(sql`
      INSERT INTO child_profiles (
        user_id, name, date_of_birth, age_stage, emoji,
        allergies, dietary_preferences, medical_conditions,
        feeding_concerns, sensory_issues, dislikes, cultural_preferences
      ) VALUES (
        ${userId}, ${name.trim()}, ${date_of_birth}, ${age_stage}, ${emoji},
        ${aJson}::jsonb, ${dpJson}::jsonb, ${mcJson}::jsonb,
        ${fcJson}::jsonb, ${siJson}::jsonb, ${dlJson}::jsonb, ${cultural_preferences}
      )
      RETURNING *
    `);
    const child = normalizeRows(result)[0];
    return res.status(201).json({ child });
  } catch (err: any) {
    console.error("[MPB/children] POST error:", err.message);
    return res.status(500).json({ error: "Failed to create child profile" });
  }
});

// PATCH /children/:id — update a child profile (ownership validated)
router.patch("/children/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  // Ownership check: fetch current row first
  const existing = await db.execute(sql`
    SELECT * FROM child_profiles
    WHERE id = ${id} AND user_id = ${userId} AND is_archived = false
  `);
  const current = normalizeRows(existing)[0];
  if (!current) return res.status(404).json({ error: "Child profile not found" });

  // Merge: only override what was provided in request body
  const name = typeof req.body.name === "string" ? req.body.name.trim() : current.name;
  const age_stage = VALID_AGE_STAGES_SET.has(req.body.age_stage) ? req.body.age_stage : current.age_stage;
  const date_of_birth = "date_of_birth" in req.body ? (req.body.date_of_birth ?? null) : current.date_of_birth;
  const emoji = req.body.emoji ?? current.emoji ?? "👶";
  const cultural_preferences = "cultural_preferences" in req.body
    ? (req.body.cultural_preferences ?? null)
    : current.cultural_preferences;
  const allergies = Array.isArray(req.body.allergies) ? req.body.allergies : (current.allergies ?? []);
  const dietary_preferences = Array.isArray(req.body.dietary_preferences) ? req.body.dietary_preferences : (current.dietary_preferences ?? []);
  const medical_conditions = Array.isArray(req.body.medical_conditions) ? req.body.medical_conditions : (current.medical_conditions ?? []);
  const feeding_concerns = Array.isArray(req.body.feeding_concerns) ? req.body.feeding_concerns : (current.feeding_concerns ?? []);
  const sensory_issues = Array.isArray(req.body.sensory_issues) ? req.body.sensory_issues : (current.sensory_issues ?? []);
  const dislikes = Array.isArray(req.body.dislikes) ? req.body.dislikes : (current.dislikes ?? []);

  try {
    const result = await db.execute(sql`
      UPDATE child_profiles SET
        name = ${name},
        age_stage = ${age_stage},
        date_of_birth = ${date_of_birth},
        emoji = ${emoji},
        cultural_preferences = ${cultural_preferences},
        allergies = ${JSON.stringify(allergies)}::jsonb,
        dietary_preferences = ${JSON.stringify(dietary_preferences)}::jsonb,
        medical_conditions = ${JSON.stringify(medical_conditions)}::jsonb,
        feeding_concerns = ${JSON.stringify(feeding_concerns)}::jsonb,
        sensory_issues = ${JSON.stringify(sensory_issues)}::jsonb,
        dislikes = ${JSON.stringify(dislikes)}::jsonb,
        updated_at = now()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `);
    const child = normalizeRows(result)[0];
    return res.json({ child });
  } catch (err: any) {
    console.error("[MPB/children] PATCH error:", err.message);
    return res.status(500).json({ error: "Failed to update child profile" });
  }
});

// DELETE /children/:id — archive a child profile (soft delete, ownership validated)
router.delete("/children/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  try {
    const result = await db.execute(sql`
      UPDATE child_profiles SET is_archived = true, updated_at = now()
      WHERE id = ${id} AND user_id = ${userId} AND is_archived = false
      RETURNING id
    `);
    if (normalizeRows(result).length === 0) {
      return res.status(404).json({ error: "Child profile not found" });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[MPB/children] DELETE error:", err.message);
    return res.status(500).json({ error: "Failed to archive child profile" });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /tip — returns today's rotating tip for a given developmental stage
router.get("/tip", requireAuth, async (req, res) => {
  const stage = (req.query.stage as string) || "toddler";
  const tip = getTodaysTip(stage);
  res.json({ tip });
});

// GET /conversation — load saved conversation for a child profile
router.get("/conversation", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  const childProfileId = req.query.childProfileId as string;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!childProfileId) return res.json({ messages: [] });
  const owned = await assertChildOwnership(userId, childProfileId);
  if (!owned) return res.status(403).json({ error: "Forbidden" });
  const messages = await getConversation(userId, childProfileId);
  res.json({ messages });
});

// DELETE /conversation — clear saved conversation for a child profile
router.delete("/conversation", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  const { childProfileId } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!childProfileId) return res.json({ ok: true });
  const owned = await assertChildOwnership(userId, childProfileId);
  if (!owned) return res.status(403).json({ error: "Forbidden" });
  await clearConversation(userId, childProfileId);
  res.json({ ok: true });
});

// PUT /conversation — persist conversation for a child profile (keep last 20 turns)
router.put("/conversation", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  const { childProfileId, messages } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!childProfileId || !Array.isArray(messages)) return res.json({ ok: true });
  const owned = await assertChildOwnership(userId, childProfileId);
  if (!owned) return res.status(403).json({ error: "Forbidden" });
  const trimmed = messages.slice(-20);
  await saveConversation(userId, childProfileId, trimmed);
  res.json({ ok: true });
});

// POST /ask — main Parent's Corner AI chat endpoint
router.post("/ask", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { message, childContext = {}, conversationHistory = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const openai = getOpenAI();
    const systemPrompt = buildSystemPrompt(childContext);

    // Build messages array with conversation history
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Include prior conversation turns (cap at 8 to keep context manageable)
    const recentHistory = (conversationHistory as any[]).slice(-8);
    for (const turn of recentHistory) {
      if (turn.role === "user" || turn.role === "assistant") {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    messages.push({ role: "user", content: message.trim() });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 700,
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let reply = "";
    let suggestedFollowUps: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      reply = typeof parsed.reply === "string" ? parsed.reply : raw;
      if (Array.isArray(parsed.suggestedFollowUps)) {
        suggestedFollowUps = parsed.suggestedFollowUps
          .filter((q: unknown) => typeof q === "string" && q.trim())
          .slice(0, 3);
      }
    } catch {
      // Fallback: treat entire content as the reply
      reply = raw;
    }

    if (!reply) {
      reply = "I'm sorry, I didn't get a response. Please try again.";
    }

    res.json({ reply, suggestedFollowUps });
  } catch (err: any) {
    console.error("[MyPerfectBeginning/ParentsCorner] Error:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
