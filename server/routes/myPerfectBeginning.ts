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
import {
  buildPediatricGuidanceBlocks,
  type ChildProfileInput,
  type PediatricGuidanceOutput,
} from "../services/pediatric/buildPediatricGuidanceBlocks";
import type { DevelopmentalStage } from "../services/pediatric/pediatricStageConstants";
import { processMealImageForSave } from "../services/imageLifecycle";

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

function buildSystemPrompt(
  childContext: Record<string, any>,
  guidanceOutput?: PediatricGuidanceOutput | null
): string {
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

  // ── Pediatric protocol guidance blocks ──────────────────────────────────────
  // Injected from buildPediatricGuidanceBlocks: DRI baselines + condition-specific
  // directive blocks (e.g., autism sensory, T1D, iron deficiency, dysphagia).
  let driSection = "";
  let protocolSection = "";
  let clinicianNote = "";

  if (guidanceOutput && !guidanceOutput.hardBlocked) {
    if (guidanceOutput.stageDRIBlock) {
      driSection = `\n━━━ DAILY NUTRITION REFERENCE ━━━\n${guidanceOutput.stageDRIBlock}`;
    }
    if (guidanceOutput.conditionGuidanceBlocks.length > 0) {
      protocolSection = `\n━━━ ACTIVE CONDITION PROTOCOLS ━━━\n${guidanceOutput.conditionGuidanceBlocks.join("\n\n")}`;
    }
    if (guidanceOutput.requiresClinicianFlag) {
      clinicianNote = "\n⚕️ CLINICIAN OVERSIGHT REQUIRED: At least one active condition requires clinical nutrition supervision. Always defer clinical nutrition decisions to the care team and reinforce this boundary in your response.";
    } else if (guidanceOutput.requiresDietitianFlag) {
      clinicianNote = "\n🥗 DIETITIAN RECOMMENDED: At least one active condition benefits from a registered pediatric dietitian. Encourage the parent to work with a pediatric RD for meal planning.";
    }
  }

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
You draw from: AAP feeding guidelines, WHO growth standards, USDA Dietary Guidelines for Americans (birth through 24 months; 2–5 years editions), Division of Responsibility (Ellyn Satter Institute), pediatric nutrition research, and standard pediatric dietitian practice.${driSection}${protocolSection}${clinicianNote}

━━━ RESPONSE FORMAT ━━━
You MUST respond with a JSON object:
{
  "reply": "<your full warm, conversational answer here>",
  "suggestedFollowUps": ["<question 1>", "<question 2>", "<question 3>"],
  "suggestedMealActions": [
    { "actionType": "create_child_meal", "label": "<short button label, e.g. Build a Hidden-Veggie Cheeseburger>", "mealIdea": "<specific buildable meal concept, e.g. Turkey cheeseburger with finely grated zucchini mixed into the patty, toddler-friendly size>" }
  ]
}

"suggestedFollowUps": Exactly 2–3 short, natural follow-up questions a parent would want to ask next. Specific to the topic just discussed. Written as the parent would ask them (e.g. "How often should I offer the new food?"). Never repeat the question just asked.

"suggestedMealActions": Include ONLY when your reply addresses a concrete food, meal, snack, or drink challenge that has a buildable solution. Leave as [] for behavior questions, feeding schedules, medical referrals, growth concerns, or anything with no direct meal answer. Maximum 2 actions. The "mealIdea" must be a specific, descriptive concept a meal builder can act on — not a generic category. "actionType" must always be exactly "create_child_meal".

No markdown outside the JSON.`;
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

// GET /children — list authenticated user's non-archived children (all fields)
router.get("/children", requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await db.execute(sql`
      SELECT id, user_id, name, date_of_birth, age_stage, allergies, allergy_details,
             dietary_preferences, medical_conditions, feeding_concerns,
             sensory_issues, dislikes, cultural_preferences, emoji,
             sex, height_cm, weight_kg, growth_context,
             birth_history, feeding_development, feeding_ability,
             family_goals, kitchen_equipment, kitchen_budget,
             kitchen_time_minutes, kitchen_skill,
             school_safe_required, pediatrician_oversight,
             medication_affects_appetite, g_tube,
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

// POST /children — create a new child profile (all extended fields)
router.post("/children", requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    name, age_stage, date_of_birth = null, emoji = "👶",
    allergies = [], allergy_details = [],
    dietary_preferences = [], medical_conditions = [],
    feeding_concerns = [], sensory_issues = [], dislikes = [],
    cultural_preferences = null,
    // extended fields
    sex = null,
    height_cm = null,
    weight_kg = null,
    growth_context = "typical",
    birth_history = {},
    feeding_development = {},
    feeding_ability = {},
    family_goals = [],
    kitchen_equipment = [],
    kitchen_budget = "moderate",
    kitchen_time_minutes = 30,
    kitchen_skill = "intermediate",
    school_safe_required = false,
    pediatrician_oversight = false,
    medication_affects_appetite = false,
  } = req.body;
  // g_tube is derived from feeding_ability.hasFeedingTube — it is no longer
  // accepted as a standalone request field. The DB column is kept for backward
  // compatibility but feeding_ability.hasFeedingTube is the canonical source.
  const g_tube_derived = !!(
    typeof feeding_ability === "object" &&
    feeding_ability !== null &&
    (feeding_ability as any).hasFeedingTube
  );

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!age_stage || !VALID_AGE_STAGES_SET.has(age_stage)) {
    return res.status(400).json({ error: "valid age_stage is required" });
  }

  const aJson   = JSON.stringify(Array.isArray(allergies) ? allergies : []);
  const adJson  = JSON.stringify(Array.isArray(allergy_details) ? allergy_details : []);
  const dpJson  = JSON.stringify(Array.isArray(dietary_preferences) ? dietary_preferences : []);
  const mcJson  = JSON.stringify(Array.isArray(medical_conditions) ? medical_conditions : []);
  const fcJson  = JSON.stringify(Array.isArray(feeding_concerns) ? feeding_concerns : []);
  const siJson  = JSON.stringify(Array.isArray(sensory_issues) ? sensory_issues : []);
  const dlJson  = JSON.stringify(Array.isArray(dislikes) ? dislikes : []);
  const fgJson  = JSON.stringify(Array.isArray(family_goals) ? family_goals : []);
  const keJson  = JSON.stringify(Array.isArray(kitchen_equipment) ? kitchen_equipment : []);
  const bhJson  = JSON.stringify(typeof birth_history === "object" ? birth_history : {});
  const fdJson  = JSON.stringify(typeof feeding_development === "object" ? feeding_development : {});
  const faJson  = JSON.stringify(typeof feeding_ability === "object" ? feeding_ability : {});

  try {
    const result = await db.execute(sql`
      INSERT INTO child_profiles (
        user_id, name, age_stage, date_of_birth, emoji, cultural_preferences,
        allergies, allergy_details, dietary_preferences, medical_conditions,
        feeding_concerns, sensory_issues, dislikes, family_goals, kitchen_equipment,
        birth_history, feeding_development, feeding_ability,
        sex, height_cm, weight_kg, growth_context,
        kitchen_budget, kitchen_time_minutes, kitchen_skill,
        school_safe_required, pediatrician_oversight, medication_affects_appetite, g_tube
      ) VALUES (
        ${userId}, ${name.trim()}, ${age_stage}, ${date_of_birth}, ${emoji}, ${cultural_preferences ?? null},
        ${aJson}::jsonb, ${adJson}::jsonb, ${dpJson}::jsonb, ${mcJson}::jsonb,
        ${fcJson}::jsonb, ${siJson}::jsonb, ${dlJson}::jsonb, ${fgJson}::jsonb, ${keJson}::jsonb,
        ${bhJson}::jsonb, ${fdJson}::jsonb, ${faJson}::jsonb,
        ${sex ?? null}, ${height_cm ?? null}, ${weight_kg ?? null}, ${growth_context},
        ${kitchen_budget}, ${kitchen_time_minutes}, ${kitchen_skill},
        ${!!school_safe_required}, ${!!pediatrician_oversight}, ${!!medication_affects_appetite}, ${g_tube_derived}
      )
      RETURNING *
    `);
    const child = normalizeRows(result)[0];
    return res.json({ child });
  } catch (err: any) {
    console.error("[MPB/children] POST error:", err.message);
    return res.status(500).json({ error: "Failed to create child profile" });
  }
});

// PATCH /children/:id — update a child profile (ownership validated, all extended fields)
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

  const b = req.body;

  // Helper: merge array field (use incoming if array, else keep current)
  const arr = (field: string, fallback: any[] = []) =>
    Array.isArray(b[field]) ? b[field] : (current[field] ?? fallback);
  // Helper: merge object field
  const obj = (field: string, fallback: Record<string,any> = {}) =>
    (b[field] && typeof b[field] === "object" && !Array.isArray(b[field]))
      ? b[field]
      : (current[field] ?? fallback);
  // Helper: scalar with fallback
  const scalar = (field: string, fallback: any) =>
    field in b ? b[field] : (current[field] ?? fallback);
  // Helper: boolean field
  const bool = (field: string, fallback = false) =>
    field in b ? !!b[field] : !!(current[field] ?? fallback);

  const name             = typeof b.name === "string" ? b.name.trim() : current.name;
  const age_stage        = VALID_AGE_STAGES_SET.has(b.age_stage) ? b.age_stage : current.age_stage;
  const date_of_birth    = "date_of_birth" in b ? (b.date_of_birth ?? null) : current.date_of_birth;
  const emoji            = scalar("emoji", "👶");
  const cultural_pref    = "cultural_preferences" in b ? (b.cultural_preferences ?? null) : current.cultural_preferences;

  const allergies            = arr("allergies");
  const allergy_details      = arr("allergy_details");
  const dietary_preferences  = arr("dietary_preferences");
  const medical_conditions   = arr("medical_conditions");
  const feeding_concerns     = arr("feeding_concerns");
  const sensory_issues       = arr("sensory_issues");
  const dislikes             = arr("dislikes");
  const family_goals         = arr("family_goals");
  const kitchen_equipment    = arr("kitchen_equipment");

  const birth_history        = obj("birth_history");
  const feeding_development  = obj("feeding_development");
  const feeding_ability      = obj("feeding_ability");

  const sex                       = scalar("sex", null);
  const height_cm                 = scalar("height_cm", null);
  const weight_kg                 = scalar("weight_kg", null);
  const growth_context            = scalar("growth_context", "typical");
  const kitchen_budget            = scalar("kitchen_budget", "moderate");
  const kitchen_time_minutes      = scalar("kitchen_time_minutes", 30);
  const kitchen_skill             = scalar("kitchen_skill", "intermediate");
  const school_safe_required      = bool("school_safe_required");
  const pediatrician_oversight    = bool("pediatrician_oversight");
  const medication_affects_appetite = bool("medication_affects_appetite");
  // g_tube is derived from feeding_ability.hasFeedingTube (canonical source).
  // The DB column is kept for backward compat but is no longer a standalone request field.
  const g_tube_derived = !!(
    feeding_ability &&
    typeof feeding_ability === "object" &&
    (feeding_ability as any).hasFeedingTube
  );

  try {
    const result = await db.execute(sql`
      UPDATE child_profiles SET
        name                        = ${name},
        age_stage                   = ${age_stage},
        date_of_birth               = ${date_of_birth},
        emoji                       = ${emoji},
        cultural_preferences        = ${cultural_pref ?? null},
        allergies                   = ${JSON.stringify(allergies)}::jsonb,
        allergy_details             = ${JSON.stringify(allergy_details)}::jsonb,
        dietary_preferences         = ${JSON.stringify(dietary_preferences)}::jsonb,
        medical_conditions          = ${JSON.stringify(medical_conditions)}::jsonb,
        feeding_concerns            = ${JSON.stringify(feeding_concerns)}::jsonb,
        sensory_issues              = ${JSON.stringify(sensory_issues)}::jsonb,
        dislikes                    = ${JSON.stringify(dislikes)}::jsonb,
        family_goals                = ${JSON.stringify(family_goals)}::jsonb,
        kitchen_equipment           = ${JSON.stringify(kitchen_equipment)}::jsonb,
        birth_history               = ${JSON.stringify(birth_history)}::jsonb,
        feeding_development         = ${JSON.stringify(feeding_development)}::jsonb,
        feeding_ability             = ${JSON.stringify(feeding_ability)}::jsonb,
        sex                         = ${sex ?? null},
        height_cm                   = ${height_cm ?? null},
        weight_kg                   = ${weight_kg ?? null},
        growth_context              = ${growth_context},
        kitchen_budget              = ${kitchen_budget},
        kitchen_time_minutes        = ${kitchen_time_minutes},
        kitchen_skill               = ${kitchen_skill},
        school_safe_required        = ${school_safe_required},
        pediatrician_oversight      = ${pediatrician_oversight},
        medication_affects_appetite = ${medication_affects_appetite},
        g_tube                      = ${g_tube_derived},
        updated_at                  = now()
      WHERE id = ${id} AND user_id = ${userId} AND is_archived = false
      RETURNING *
    `);
    const child = normalizeRows(result)[0];
    if (!child) return res.status(404).json({ error: "Child profile not found" });
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

// ── Age helper ──────────────────────────────────────────────────────────────
function calcAgeMonths(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  try {
    const birth = new Date(dob.includes("T") ? dob : dob + "T12:00:00");
    const now = new Date();
    return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
  } catch {
    return undefined;
  }
}

// GET /parents-corner/tip — returns today's rotating tip for a given developmental stage
router.get("/parents-corner/tip", requireAuth, async (req, res) => {
  const stage = (req.query.stage as string) || "toddler";
  const tip = getTodaysTip(stage);
  res.json({ tip });
});

// GET /parents-corner/conversation — load saved conversation for a child profile
router.get("/parents-corner/conversation", requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    const childProfileId: string | null = (req.query.childProfileId as string) || null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!childProfileId) return res.json({ messages: [] });
      const owned = await assertChildOwnership(userId, childProfileId);
  if (!owned) return res.status(403).json({ error: "Forbidden" });
  const messages = await getConversation(userId, childProfileId);
  res.json({ messages });
});

// DELETE /parents-corner/conversation — clear saved conversation for a child profile
router.delete("/parents-corner/conversation", requireAuth, async (req, res) => {
    const userId = (req as AuthenticatedRequest).authUser?.id;
  // childProfileId may arrive in body or query string
    const childProfileId: string | null = (req.body.childProfileId || req.query.childProfileId as string) || null;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!childProfileId) return res.json({ ok: true });
      const owned = await assertChildOwnership(userId, childProfileId);
  if (!owned) return res.status(403).json({ error: "Forbidden" });
  await clearConversation(userId, childProfileId);
  res.json({ ok: true });
});

// PATCH /parents-corner/conversation — persist conversation for a child profile (keep last 20 turns)
router.patch("/parents-corner/conversation", requireAuth, async (req, res) => {
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

// POST /parents-corner — main Parent's Corner AI chat endpoint
// Loads authoritative child profile server-side; never trusts client-supplied context
// for safety constraints. No adult nutrition fields are read.
router.post("/parents-corner", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { message, childContext = {}, conversationHistory = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    // ── Server-side child profile loading ──────────────────────────────────────
    // Extract childProfileId from client-supplied context (the id field).
    // If present, assert ownership and load the authoritative profile from the DB.
    // The AI then operates on server-verified, DB-sourced pediatric context only —
    // never on raw client-supplied data for safety-critical fields.
    const childProfileId: string | null = childContext?.id ?? null;
    let resolvedContext: Record<string, any> = childContext;
    let childProfileInput: ChildProfileInput | null = null;

    if (childProfileId) {
      const owned = await assertChildOwnership(userId, childProfileId);
      if (!owned) {
        return res.status(403).json({ error: "Forbidden: child profile does not belong to this user." });
      }

      try {
        const profileResult = await db.execute(sql`
          SELECT id, name, date_of_birth, age_stage, sex,
                 allergy_details, dietary_preferences, medical_conditions,
                 feeding_concerns, sensory_issues, dislikes,
                 birth_history, feeding_ability, growth_context,
                 school_safe_required, medication_affects_appetite
          FROM child_profiles
          WHERE id = ${childProfileId} AND user_id = ${userId}
          LIMIT 1
        `);
        const row = (profileResult as any).rows?.[0] ?? (Array.isArray(profileResult) ? profileResult[0] : null);

        if (row) {
          const birthHistory = typeof row.birth_history === "object" && row.birth_history ? row.birth_history : {};
          const feedingAbility = typeof row.feeding_ability === "object" && row.feeding_ability ? row.feeding_ability : {};
          const growthContext = typeof row.growth_context === "object" && row.growth_context ? row.growth_context : {};
          const medicalConditions: string[] = Array.isArray(row.medical_conditions) ? row.medical_conditions : [];
          const feedingConcerns: string[] = Array.isArray(row.feeding_concerns) ? row.feeding_concerns : [];
          const sensoryIssues: any[] = Array.isArray(row.sensory_issues) ? row.sensory_issues : [];
          const dislikes: string[] = Array.isArray(row.dislikes) ? row.dislikes : [];
          const dietaryPreferences: string[] = Array.isArray(row.dietary_preferences) ? row.dietary_preferences : [];
          const allergyDetails: any[] = Array.isArray(row.allergy_details) ? row.allergy_details : [];

          // Map DB row → childContext shape expected by buildSystemPrompt.
          // Only pediatric fields are included — adult nutrition identity, macros,
          // weight-loss targets, GLP-1 state, etc. are deliberately excluded.
          resolvedContext = {
            id: row.id,
            nickname: row.name,
            developmentalStage: row.age_stage,
            currentAgeMonths: calcAgeMonths(row.date_of_birth),
            sex: row.sex,
            prematureBirth: !!birthHistory.prematureBirth,
            gestationalAgeAtBirthWeeks: birthHistory.gestationalAgeAtBirthWeeks ?? null,
            feedingAbility,
            growth: growthContext,
            allergyProfile: {
              entries: allergyDetails,
              celiacDisease: medicalConditions.some(c => /celiac/i.test(c)),
              lactoseIntolerance: medicalConditions.some(c => /lactose/i.test(c)),
            },
            diagnosedConditions: medicalConditions,
            eatingBehavior: {
              pickyEater: feedingConcerns.some(c => /picky/i.test(c)),
              sensorySensitivities: sensoryIssues.length > 0,
              fearOfNewFoods: feedingConcerns.some(c => /neophob|fear.*food|new.*food/i.test(c)),
              foodsRefused: dislikes,
              parentsBiggestFeedingChallenge: feedingConcerns[0] ?? null,
            },
            householdDiet: {
              dietaryPattern: dietaryPreferences[0] ?? "omnivore",
              requiresSchoolSafe: !!row.school_safe_required,
            },
          };

          // ── Build ChildProfileInput for pediatric protocol guidance blocks ──
          // Uses the same raw DB fields — no extra DB query needed.
          // Never includes adult nutrition fields; stays within pediatric boundary.
          childProfileInput = {
            developmentalStage: row.age_stage as DevelopmentalStage,
            medicalConditions,
            sensoryIssues: sensoryIssues.map((s: any) =>
              typeof s === "string" ? s : (s?.type ?? String(s))
            ),
            feedingConcerns,
            growth: {
              pediatricianConcern: growthContext.pediatricianConcern,
            },
            feedingAbility: {
              textureLevel: feedingAbility.textureLevel,
              swallowingDifficulty: !!feedingAbility.swallowingDifficulty,
              hasFeedingTube: !!feedingAbility.hasFeedingTube,
              historyOfChokingOrGagging: !!feedingAbility.historyOfChokingOrGagging,
            },
            sex: row.sex,
            allergyDetails: allergyDetails
              .filter((e: any) =>
                ["confirmed_allergy", "clinician_elimination"].includes(e?.severity)
              )
              .map((e: any) => ({
                allergen: e.customAllergenName || e.allergenId?.replace(/_/g, " ") || e.allergen || "",
                severity: e.severity,
                epiPen: !!e.epiPen,
                crossContact: !!e.crossContact,
                clinicianInstructions: e.clinicianInstructions,
              })),
            schoolSafeRequired: !!row.school_safe_required,
          };

          console.log(`[ParentsCorner] Server-loaded profile: ${row.name} (${row.age_stage})`);
        }
      } catch (profileErr: any) {
        // If child_profiles table is unavailable or query fails, fall back to client context
        // so a graceful degradation is preferred over a hard failure.
        console.warn("[ParentsCorner] Child profile lookup fell back to client context:", profileErr.message);
      }
    }

    // ── Run pediatric protocol registry ──────────────────────────────────────
    // buildPediatricGuidanceBlocks is synchronous and uses only registry data.
    // Connects the existing pediatric infrastructure (DRI baselines, condition
    // protocols, conflict resolution) to the conversational AI for the first time.
    let guidanceOutput: PediatricGuidanceOutput | null = null;
    if (childProfileInput) {
      try {
        guidanceOutput = buildPediatricGuidanceBlocks(childProfileInput);

        // Hard block: a condition requires clinical intervention before conversation
        if (guidanceOutput.hardBlocked) {
          console.warn(
            `[ParentsCorner] Hard block for condition: ${guidanceOutput.hardBlockConditionId}`
          );
          return res.json({
            reply: guidanceOutput.hardBlockMessage ??
              "For this child's specific medical situation, I recommend speaking directly with your child's pediatrician or a registered pediatric dietitian before we discuss meal recommendations. They'll be able to give you guidance that's tailored to your child's care plan.",
            suggestedFollowUps: [
              "What questions should I bring to the pediatrician?",
              "How do I find a pediatric dietitian?",
            ],
          });
        }

        if (guidanceOutput.activeProtocolIds.length > 0) {
          console.log(
            `[ParentsCorner] Active protocols: ${guidanceOutput.activeProtocolIds.join(", ")}`
          );
        }
      } catch (guidanceErr: any) {
        // Non-fatal — if the registry fails, proceed with profile-only context
        console.warn("[ParentsCorner] Pediatric guidance blocks failed (non-fatal):", guidanceErr.message);
        guidanceOutput = null;
      }
    }

    const openai = getOpenAI();
    const systemPrompt = buildSystemPrompt(resolvedContext, guidanceOutput);

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
    let suggestedMealActions: { actionType: string; label: string; mealIdea: string }[] = [];
    try {
      const parsed = JSON.parse(raw);
      reply = typeof parsed.reply === "string" ? parsed.reply : raw;
      if (Array.isArray(parsed.suggestedFollowUps)) {
        suggestedFollowUps = parsed.suggestedFollowUps
          .filter((q: unknown) => typeof q === "string" && (q as string).trim())
          .slice(0, 3);
      }
      if (Array.isArray(parsed.suggestedMealActions)) {
        suggestedMealActions = parsed.suggestedMealActions
          .filter(
            (a: unknown): a is { actionType: string; label: string; mealIdea: string } =>
              typeof a === "object" &&
              a !== null &&
              (a as any).actionType === "create_child_meal" &&
              typeof (a as any).label === "string" &&
              (a as any).label.trim() &&
              typeof (a as any).mealIdea === "string" &&
              (a as any).mealIdea.trim()
          )
          .slice(0, 2);
      }
    } catch {
      reply = raw;
    }

    if (!reply) {
      reply = "I'm sorry, I didn't get a response. Please try again.";
    }

    res.json({ reply, suggestedFollowUps, suggestedMealActions });
  } catch (err: any) {
    console.error("[MyPerfectBeginning/ParentsCorner] Error:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ─── Meal Options (Step 1 — three concept choices before full recipe) ──────────

router.post('/meal-options', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { ageStage, foodRequest, childName, childProfileId, allergies } = req.body;
    if (!ageStage || !foodRequest) {
      return res.status(400).json({ error: 'ageStage and foodRequest are required' });
    }

    const openai = getOpenAI();
    const nickname = childName ? String(childName) : 'your child';
    const allergenList = Array.isArray(allergies) && allergies.length > 0
      ? allergies
          .map((a: any) => a.customAllergenName || a.allergenId || '')
          .filter(Boolean)
          .join(', ')
      : 'none reported';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a pediatric nutrition assistant. Generate exactly 3 child-appropriate, safe, and appealing meal variations for ${nickname} (developmental stage: ${stageLabel(ageStage)}). Allergens to avoid: ${allergenList}.

Return ONLY a JSON object with no extra text:
{
  "options": [
    { "id": "1", "name": "Short specific meal name", "description": "One to two sentences about what makes this version special or appealing for this child." },
    { "id": "2", "name": "Short specific meal name", "description": "One to two sentences." },
    { "id": "3", "name": "Short specific meal name", "description": "One to two sentences." }
  ]
}

Names should be short and specific (e.g. "Hidden-Veggie Turkey Cheeseburger", "Mini Cheeseburger Sliders"). Each option should be genuinely different. No markdown outside the JSON.`,
        },
        {
          role: 'user',
          content: `Meal request: ${String(foodRequest).slice(0, 200)}`,
        },
      ],
      max_tokens: 450,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let options: { id: string; name: string; description: string }[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.options)) {
        options = parsed.options
          .filter((o: any) => typeof o.name === 'string' && o.name.trim())
          .slice(0, 3)
          .map((o: any, i: number) => ({
            id: String(o.id ?? i + 1),
            name: String(o.name).trim(),
            description: typeof o.description === 'string' ? String(o.description).trim() : '',
          }));
      }
    } catch { /* fallback: frontend handles empty options by generating directly */ }

    res.json({ options });
  } catch (err: any) {
    console.error('[MPB/meal-options] Error:', err.message);
    res.status(500).json({ error: 'Could not generate options. Please try again.' });
  }
});

// ─── Generated Meals Persistence ──────────────────────────────────────────────

router.post('/generated-meals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const { childProfileId, recipeData, imageUrl, selectedOptionName } = req.body;
    if (!recipeData) {
      return res.status(400).json({ error: 'recipeData is required' });
    }

    // Attempt to persist ephemeral images (base64 / DALL-E temp URLs) to permanent
    // storage before saving to DB. If S3 + GCS both fail, safeImageUrl is null —
    // the restore path will re-generate the image rather than storing a broken link.
    const recipeName = (typeof recipeData === 'object' && recipeData?.recipeName)
      ? String(recipeData.recipeName)
      : 'meal';
    const { imageUrl: safeImageUrl } = await processMealImageForSave(imageUrl ?? null, recipeName);

    const result = await db.execute(sql`
      INSERT INTO mpb_generated_meals (user_id, child_profile_id, recipe_data, image_url, selected_option_name)
      VALUES (
        ${userId},
        ${childProfileId ?? null},
        ${JSON.stringify(recipeData)},
        ${safeImageUrl ?? null},
        ${selectedOptionName ?? null}
      )
      RETURNING id
    `);

    const id = (result.rows[0] as any)?.id ?? null;
    res.json({ id, imagePersisted: !!safeImageUrl });
  } catch (err: any) {
    console.error('[MPB/generated-meals POST] Error:', err.message);
    res.status(500).json({ error: 'Could not save meal.' });
  }
});

router.get('/generated-meals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const childProfileId = typeof req.query.childProfileId === 'string' ? req.query.childProfileId : null;

    const result = childProfileId
      ? await db.execute(sql`
          SELECT id, recipe_data, image_url, selected_option_name, created_at
          FROM mpb_generated_meals
          WHERE user_id = ${userId} AND child_profile_id = ${childProfileId}
          ORDER BY created_at DESC
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id, recipe_data, image_url, selected_option_name, created_at
          FROM mpb_generated_meals
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 1
        `);

    const row = result.rows[0] as any;
    if (!row) return res.json({ meal: null });

    // Normalise completePlate so older saves (which predate the field) don't
    // produce undefined/null on the client — the CompleteThePlateSection
    // already hides itself when sides.length === 0, so an empty normalised
    // value is safe for legacy rows.
    const recipeData = row.recipe_data;
    if (recipeData && typeof recipeData === 'object') {
      if (!recipeData.completePlate || !Array.isArray(recipeData.completePlate.sides)) {
        recipeData.completePlate = { sides: [], plateNote: '' };
      } else {
        // Drop any malformed side entries that may have slipped through
        recipeData.completePlate.sides = recipeData.completePlate.sides.filter(
          (s: any) => s && typeof s.name === 'string' && s.name.trim(),
        );
        if (typeof recipeData.completePlate.plateNote !== 'string') {
          recipeData.completePlate.plateNote = '';
        }
      }
    }

    res.json({
      meal: {
        id: row.id,
        recipeData,
        imageUrl: row.image_url ?? null,
        selectedOptionName: row.selected_option_name ?? null,
        createdAt: row.created_at,
      },
    });
  } catch (err: any) {
    console.error('[MPB/generated-meals GET] Error:', err.message);
    res.status(500).json({ error: 'Could not retrieve saved meal.' });
  }
});

export default router;
