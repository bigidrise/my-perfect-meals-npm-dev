/**
 * MPM Universal Coaching Engine — Phase 2
 *
 * Orchestrates the full pipeline for every coaching turn:
 *
 *   loadSubject → safetyGate → intentDetect → observerSelect → observerRun
 *   → patternMatch → scoreConfidence → resolveStyle → reasoningPass
 *   → validateCitations → renderingPass → validateResponse → persist → return
 *
 * The LLM is the language layer only. Every platform decision (safety, confidence,
 * patterns, style, citation validation) is made server-side.
 *
 * Phase 2: Observers are stubs — they return empty evidence.
 * Phase 3: Real Observer implementations replace the stubs.
 * The engine pipeline is identical in both phases.
 */

import OpenAI from "openai";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { ReasoningResultSchema, CoachResponseSchema } from "../../../shared/coaching/schemas";
import { runSafetyGate, buildSafetyResponse } from "./safety";
import { scoreConfidence, getConfidenceInstructions } from "./confidence";
import { matchPatterns } from "./patternMatcher";
import { resolveStyle } from "./styleResolver";
import { runObservers, selectObservers } from "./observers/stubs";
import { getAdapter } from "./adapters";
import type {
  CoachRequest,
  CoachResponse,
  CoachSubject,
  ObserverOutput,
  MatchedPattern,
  ConfidenceAssessment,
  StyleMode,
  Evidence,
  TodayPlan,
  TodayPlanItem,
} from "../../../shared/coaching/types";
import type { Request } from "express";

// ─── OpenAI Singleton ─────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── Intent Detection ─────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<string, string[]> = {
  weight_gain: [
    "gained weight", "weight went up", "gaining weight", "scale went up",
    "weight is higher", "gained pounds", "up on the scale", "put on weight",
    "heavier than", "weight is going up",
  ],
  weight_loss_plateau: [
    "plateau", "not losing", "weight stuck", "scale not moving", "stalled",
    "same weight", "not dropping", "stopped losing", "weight hasn't moved",
    "can't lose weight", "no progress", "haven't lost", "not lost any",
    "no weight loss", "lost no weight", "weight hasn't changed", "not losing weight",
    "haven't lost weight", "not lost weight",
  ],
  fatigue: [
    "tired", "no energy", "exhausted", "fatigued", "drained", "sluggish",
    "no motivation", "run down", "low energy", "worn out", "always tired",
    "so tired", "exhaustion",
  ],
  cravings: [
    "craving", "cravings", "want to snack", "hungry all", "can't stop eating",
    "always hungry", "snacking too much", "food noise", "urge to eat",
    "constantly eating", "eating too much",
  ],
  restaurant_eating: [
    "eating out", "restaurant", "takeout", "dining out", "going out to eat",
    "ordering in", "on the road", "eating at", "hard to eat healthy",
    "meal prep", "travel eating",
  ],
};

function detectIntent(message: string, _history: Array<{ role: string; content: string }>): string {
  const normalized = message.toLowerCase();
  let bestIntent = "general_inquiry";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.filter((kw) => normalized.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

// ─── Evidence ID System ───────────────────────────────────────────────────────
// Each Evidence item needs a predictable ID so the LLM can cite it and the
// server can validate those citations.

function buildEvidenceWithIds(
  observerOutputs: ObserverOutput[]
): Array<Evidence & { id: string }> {
  const all: Array<Evidence & { id: string }> = [];
  for (const output of observerOutputs) {
    for (const finding of output.findings) {
      const id = `${finding.observer}.${finding.metric}.${finding.window}`;
      all.push({ ...finding, id });
    }
  }
  return all;
}

function buildEvidenceIdSet(evidence: Array<Evidence & { id: string }>): Set<string> {
  return new Set(evidence.map((e) => e.id));
}

// ─── Citation Validation ──────────────────────────────────────────────────────

interface ValidationResult<T> {
  valid: T;
  hallucinated: string[];
  stripped: number;
}

function validateCitations(
  reasoning: any,
  validIds: Set<string>
): ValidationResult<typeof reasoning> {
  const hallucinated: string[] = [];
  let stripped = 0;

  const cleanedHypotheses = (reasoning.hypotheses ?? []).map((h: any) => {
    const validCitations = (h.evidenceCitationIds ?? []).filter((id: string) => {
      if (validIds.has(id)) return true;
      hallucinated.push(id);
      stripped++;
      return false;
    });
    return { ...h, evidenceCitationIds: validCitations };
  });

  return {
    valid: { ...reasoning, hypotheses: cleanedHypotheses },
    hallucinated,
    stripped,
  };
}

// ─── Phase 5 imports ─────────────────────────────────────────────────────────

import { loadBoundedHistory } from "./conversationSummarizer";
import { extractAndPersistMemories } from "./memoryExtractor";

// ─── Phase 2 (Reasoning Library) imports ─────────────────────────────────────

import {
  matchReasoningFamily,
  renderReasoningBriefForPrompt,
} from "./reasoningFamilyMatcher";

// ─── Phase 2 (Supportive Accountability Doctrine) imports ─────────────────────

import {
  generateDoctrineSystemPromptSection,
} from "./doctrine/supportiveAccountabilityDoctrine";
import {
  classifyBehaviorProgress,
  renderBehaviorSignalBlock,
} from "./doctrine/behaviorProgressClassifier";

// ─── Memory Loading ───────────────────────────────────────────────────────────

async function loadCoachingMemories(userId: string, specialization: string) {
  try {
    const result = await db.execute(sql`
      SELECT key, value_json, confidence, category
      FROM coaching_memories
      WHERE user_id = ${userId}
        AND specialization = ${specialization}
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return result.rows;
  } catch {
    return [];
  }
}

async function loadNutritionMemories(userId: string) {
  try {
    const result = await db.execute(sql`
      SELECT key, value_json, confidence, source
      FROM nutrition_memories
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
      LIMIT 15
    `);
    return result.rows;
  } catch {
    return [];
  }
}

// ─── Conversation Management ──────────────────────────────────────────────────

async function resolveConversation(
  conversationId: string | undefined,
  subject: CoachSubject,
  specialization: string
): Promise<string> {
  if (conversationId) {
    // Verify the conversation belongs to this owner
    const result = await db.execute<{ id: string }>(sql`
      SELECT id FROM coach_conversations
      WHERE id = ${conversationId}
        AND owner_id = ${subject.ownerId}
        AND status = 'open'
      LIMIT 1
    `);
    if (result.rows[0]) return result.rows[0].id;
  }

  // Find existing open conversation for this owner + specialization
  const existing = await db.execute<{ id: string }>(sql`
    SELECT id FROM coach_conversations
    WHERE owner_id = ${subject.ownerId}
      AND specialization = ${specialization}
      AND status = 'open'
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1
  `);
  if (existing.rows[0]) return existing.rows[0].id;

  // Create a new conversation
  const created = await db.execute<{ id: string }>(sql`
    INSERT INTO coach_conversations
      (owner_id, specialization, subject_type, subject_id, status)
    VALUES
      (${subject.ownerId}, ${specialization}, ${subject.subjectType}, ${subject.subjectId}, 'open')
    RETURNING id
  `);
  return created.rows[0].id;
}

async function loadConversationHistory(
  conversationId: string,
  userId: string,
  specialization: string
): Promise<{ history: Array<{ role: string; content: string }>; rollingContext: string | null }> {
  try {
    const bounded = await loadBoundedHistory(conversationId, userId, specialization);
    return { history: bounded.recentMessages, rollingContext: bounded.rollingContext };
  } catch {
    // Fallback to simple last-10 on summarizer failure
    const result = await db.execute<{ role: string; content: string }>(sql`
      SELECT role, content
      FROM coach_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at DESC
      LIMIT 10
    `);
    return { history: result.rows.reverse(), rollingContext: null };
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistTurn(
  conversationId: string,
  subject: CoachSubject,
  userMessage: string,
  response: CoachResponse,
  observerOutputs: ObserverOutput[],
  patterns: MatchedPattern[],
  confidence: ConfidenceAssessment,
  intent: string,
  validatedReasoning: any,
  selectedObserverIds: string[] = []
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  // Save user message
  const userMsg = await db.execute<{ id: string }>(sql`
    INSERT INTO coach_messages (conversation_id, role, content)
    VALUES (${conversationId}, 'user', ${userMessage})
    RETURNING id
  `);
  const userMessageId = userMsg.rows[0].id;

  // Save assistant message with full structured payload
  const assistantMsg = await db.execute<{ id: string }>(sql`
    INSERT INTO coach_messages (conversation_id, role, content, structured_payload)
    VALUES (
      ${conversationId},
      'assistant',
      ${response.whatIFound + "\n\n" + response.whatItCouldMean},
      ${JSON.stringify(response)}::jsonb
    )
    RETURNING id
  `);
  const assistantMessageId = assistantMsg.rows[0].id;

  // Save investigation (full audit trail) — Phase 5: includes observer_selection
  // NOTE: drizzle sql`` expands JS arrays as tuple params ($1,$2) not PG arrays.
  // Build a PG array literal string e.g. '{id1,id2}' and cast it server-side.
  const patternIdsLiteral = `{${patterns.map((p) => p.patternId).join(",")}}`;
  const investigation = await db.execute<{ id: string }>(sql`
    INSERT INTO coach_investigations
      (conversation_id, message_id, intent, observer_selection, evidence_json, matched_pattern_ids, confidence, coverage_score)
    VALUES (
      ${conversationId},
      ${assistantMessageId},
      ${intent},
      ${JSON.stringify(selectedObserverIds)}::jsonb,
      ${JSON.stringify(observerOutputs)}::jsonb,
      ${patternIdsLiteral}::text[],
      ${confidence.level},
      ${confidence.coverageScore}
    )
    RETURNING id
  `);
  const investigationId = investigation.rows[0].id;

  // Save action plan if there are items
  if (response.todayPlan.items.length > 0) {
    const followUpAt = response.todayPlan.followUpAt
      ? new Date(response.todayPlan.followUpAt).toISOString()
      : null;

    const plan = await db.execute<{ id: string }>(sql`
      INSERT INTO coach_action_plans
        (conversation_id, investigation_id, owner_id, why, success_metric, next_check_in,
         next_check_at, plan_json)
      VALUES (
        ${conversationId},
        ${investigationId},
        ${subject.ownerId},
        ${response.todayPlan.why},
        ${response.todayPlan.successMetric},
        ${response.todayPlan.nextCheckIn},
        ${followUpAt},
        ${JSON.stringify(response.todayPlan)}::jsonb
      )
      RETURNING id
    `);
    const planId = plan.rows[0].id;

    // Save individual action items
    for (let i = 0; i < response.todayPlan.items.length; i++) {
      const item = response.todayPlan.items[i];
      await db.execute(sql`
        INSERT INTO coach_action_items
          (plan_id, sequence, kind, horizon, text, due_at, completion_signal, feature_target)
        VALUES (
          ${planId}, ${i}, ${item.kind}, ${item.horizon}, ${item.text},
          ${item.dueAt ? new Date(item.dueAt).toISOString() : null},
          ${item.completionSignal ?? null},
          ${item.featureTarget ?? null}
        )
      `);
    }

    // Phase 5: create follow-up record if next_check_at is set
    // ON CONFLICT DO NOTHING: the unique partial index prevents duplicate pending followups
    if (followUpAt) {
      try {
        await db.execute(sql`
          INSERT INTO coach_followups
            (plan_id, owner_id, due_at, status, observer_selection, investigation_id)
          VALUES (
            ${planId},
            ${subject.ownerId},
            ${followUpAt},
            'pending',
            ${JSON.stringify(selectedObserverIds)}::jsonb,
            ${investigationId}
          )
          ON CONFLICT DO NOTHING
        `);
      } catch (followupErr: any) {
        // Non-fatal — log and continue
        console.warn("[Engine] Follow-up creation failed:", followupErr.message);
      }
    }
  }

  // Update conversation last_message_at
  await db.execute(sql`
    UPDATE coach_conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId}
  `);

  return { userMessageId, assistantMessageId };
}

// ─── Reasoning Pass ───────────────────────────────────────────────────────────

async function runReasoningPass(params: {
  userMessage: string;
  evidence: Array<Evidence & { id: string }>;
  patterns: MatchedPattern[];
  confidence: ConfidenceAssessment;
  coachingMemories: any[];
  nutritionMemories: any[];
  additionalContext: Record<string, unknown>;
  history: Array<{ role: string; content: string }>;
  rollingContext?: string;
  specialization: string;
}): Promise<any> {
  const openai = getOpenAI();

  const evidenceBlock =
    params.evidence.length > 0
      ? JSON.stringify(params.evidence, null, 2)
      : "No platform evidence available yet. The user is starting fresh or Observers are not yet active.";

  const patternBlock =
    params.patterns.length > 0
      ? JSON.stringify(
          params.patterns.map((p) => ({
            key: p.patternKey,
            interpretation: p.template.interpretation,
            coverageScore: p.coverageScore,
            evidenceSatisfied: p.evidenceSatisfied,
            evidenceMissing: p.evidenceMissing,
            safetyClass: p.safetyClass,
          })),
          null, 2
        )
      : "No knowledge pattern matched this inquiry yet.";

  const memoryBlock =
    params.coachingMemories.length > 0
      ? JSON.stringify(params.coachingMemories, null, 2)
      : "No prior coaching memories for this user.";

  // Inject the Supportive Accountability & Reinforcement Doctrine into the system prompt.
  // For the universal engine, all turns are in the 'corner' surface.
  // Pregnancy Coach and Parent's Corner inject this directly into their own system prompts.
  const doctrineSectionForReasoning = generateDoctrineSystemPromptSection("corner");

  const systemPrompt = [
    "You are the REASONING LAYER of the MPM Coaching Engine.",
    "Your job: reason from the sealed evidence block and propose coaching hypotheses.",
    "",
    doctrineSectionForReasoning,
    "",
    "COACHING INTELLIGENCE PIPELINE — KNOW → INTERPRET → SUPPORT → COACH → REINFORCE → LEARN:",
    "  1. KNOW:       What does the platform actually know? Read DATA CONFIDENCE first.",
    "  2. INTERPRET:  What does the evidence suggest? Cite only evidence IDs from the block.",
    "  3. SUPPORT:    What is the behavioral evidence pattern? See BEHAVIOR SIGNAL in user prompt.",
    "                 This governs HOW you reason about the person — not the nutritional facts.",
    "  4. COACH:      What is the most useful, evidence-grounded hypothesis to lead with?",
    "  5. REINFORCE:  Is there behavior progress to note? (BEHAVIOR SIGNAL — recovery, consistency)",
    "  6. LEARN:      What additional data would change or sharpen this reasoning?",
    "",
    "DATA CONFIDENCE (from COACHING CONTEXT SNAPSHOT):",
    "  HIGH:    Prescription + today's intake both present. Reason from platform evidence.",
    "  PARTIAL: Some signals present. Acknowledge what's missing. Combine observed data with",
    "           general guidance for gaps. Do not fill missing fields with invented numbers.",
    "  LOW:     Minimal data. IMPORTANT: Low data is a limitation on PERSONALIZATION, not a",
    "           reason to withhold useful coaching. You MUST still produce a substantive",
    "           leadHypothesis that covers the general nutrition science for this topic.",
    "           Acknowledge the evidence gap in primaryConcern, but your hypotheses should",
    "           enumerate the nutritional possibilities (e.g. for fatigue: under-eating,",
    "           inadequate carbs, hydration, meal timing, training load) at a general level.",
    "           End missingData with the specific logging that would personalize this.",
    "           missingData must contain at most 8 items — prioritize the most impactful gaps.",
    "",
    "THREE-LEVEL EVIDENCE DOCTRINE:",
    "  Level 1 (LOW):     General education + safe actions. Clearly identified as general.",
    "                     No platform data cited — none is available. Always give something.",
    "  Level 2 (PARTIAL): Combine observed data with general guidance for what's missing.",
    "                     Cite the observed fields explicitly. Be specific about gaps.",
    "  Level 3 (HIGH):    Personalized, evidence-grounded observations. Earn the right to",
    "                     say 'I've noticed that your low-energy days tend to follow...'",
    "",
    "CONSISTENCY BEFORE ADJUSTMENT RULE:",
    "If the user signals 'the plan isn't working' or 'no progress', check adherence FIRST.",
    "Bad results + missing macro logs = execution problem, not a prescription problem.",
    "Do NOT propose changing targets when you cannot confirm the prescription was followed.",
    "",
    "MISSING vs ZERO distinction:",
    "  A field marked MISSING means the platform has no data — treat as unknown.",
    "  A field marked '0 (confirmed)' means the user logged zero — reason from it.",
    "  Never treat MISSING as zero. Never treat zero as MISSING.",
    "",
    "MISSING DATA IS NOT EVIDENCE OF NON-COMPLIANCE:",
    "  Missing logs = we cannot assess adherence. That is all.",
    "  You may NEVER conclude or imply the user is not following the plan based solely on missing logs.",
    "  Correct framing: 'Without logged meals I can't see what you've been eating.'",
    "  Correct framing: 'More logging will help me give you a more specific answer.'",
    "  Forbidden framing — any of these phrases are disqualifying:",
    "    'adherence issue', 'not fully adhering', 'not following the plan', 'not sticking to it',",
    "    'if you've been following the plan', 'commit to following', 'stay consistent with the plan'.",
    "  The last two are especially common mistakes: telling someone to 'commit to following'",
    "  or 'stay consistent' implies they aren't — without any logged evidence.",
    "  The only valid adherence frame when data is missing: 'I don't have enough logged data to know.'",
    "",
    "MEDICAL CONDITIONS — RELEVANCE GATE:",
    "  Medical conditions and specialty conditions from the user profile are context — not automatic explanations.",
    "  Only include a medical condition in your hypotheses if it is plausibly relevant to the specific question.",
    "  A condition being present in the profile is NOT permission to cite it for every question.",
    "  If a condition is not plausibly connected to the question, omit it entirely.",
    "",
    "CRITICAL RULES:",
    "1. You may ONLY reference evidence IDs that appear verbatim in the EVIDENCE BLOCK.",
    "2. You cannot introduce ANY facts not present in the evidence block or context snapshot.",
    "   Exception: general nutrition science (e.g. 'fatigue can be associated with low carb",
    "   intake') is always available as general context — it does not require a citation ID.",
    "3. You cannot make causal claims. Use 'may suggest', 'could indicate', 'worth exploring'.",
    "4. If evidence is empty, acknowledge the gap AND still reason from general nutrition",
    "   science for this topic. Insufficient data ≠ no coaching value.",
    "5. You are the REASONING layer — not the coach. Do not write user-facing language.",
    "6. Set redFlag=true ONLY for acute medical emergencies not already caught by the safety gate.",
    "7. Respond ONLY in valid JSON. No markdown, no explanations outside the JSON.",
    "",
    "REQUIRED JSON SCHEMA:",
    JSON.stringify({
      primaryConcern: "string (what the user is actually asking about)",
      hypotheses: [{
        explanation: "string",
        evidenceCitationIds: ["array of evidence IDs from the block above"],
        likelihood: "most_likely | possible | unlikely",
      }],
      leadHypothesis: "string (the explanation you lead with)",
      proposedConfidence: "high | moderate | low",
      redFlag: false,
      redFlagReason: "string or omit",
      missingData: ["what data would change the reasoning"],
    }, null, 2),
  ].join("\n");

  // Inject the CoachingContextSnapshot block if the adapter produced one.
  // This replaces the raw additionalContext JSON dump with a structured,
  // human-readable evidence block the LLM can reason from directly.
  const contextBlock = typeof params.additionalContext?.coachingContextBlock === "string"
    ? params.additionalContext.coachingContextBlock as string
    : null;

  // Phase 2: Reasoning Library brief — server-determined coaching brief for this family
  const reasoningBriefBlock = typeof params.additionalContext?.reasoningBriefBlock === "string"
    ? params.additionalContext.reasoningBriefBlock as string
    : null;

  // Phase 2 Doctrine: behavior signal block — server-classified evidence pattern
  const behaviorSignalBlock = typeof params.additionalContext?.behaviorSignalBlock === "string"
    ? params.additionalContext.behaviorSignalBlock as string
    : null;

  // Strip the pre-rendered blocks from the JSON dump to avoid duplication
  const contextForJson = { ...params.additionalContext };
  delete (contextForJson as any).coachingContextBlock;
  delete (contextForJson as any).coachingContextSnapshot; // large object — not needed in JSON
  delete (contextForJson as any).reasoningBriefBlock;
  delete (contextForJson as any).behaviorSignalBlock;

  const userPrompt = [
    ...(contextBlock
      ? [contextBlock, ""]
      : [
          `ADDITIONAL CONTEXT:`,
          JSON.stringify(contextForJson, null, 2),
          "",
        ]),
    ...(behaviorSignalBlock
      ? [
          `BEHAVIOR SIGNAL (server-classified — governs SUPPORT + REINFORCE steps):`,
          behaviorSignalBlock,
          "",
        ]
      : []),
    ...(reasoningBriefBlock
      ? [
          `COACHING REASONING BRIEF (server-determined — follow the interpretation boundaries, approved actions, and forbidden conclusions exactly):`,
          reasoningBriefBlock,
          "",
        ]
      : []),
    `OBSERVER EVIDENCE BLOCK (cite only these IDs — each ID is your citation key):`,
    evidenceBlock,
    "",
    `MATCHED PATTERNS:`,
    patternBlock,
    "",
    `COACHING MEMORIES:`,
    memoryBlock,
    "",
    ...(params.rollingContext
      ? [
          `EARLIER CONVERSATION CONTEXT (summarized, do not cite as evidence):`,
          params.rollingContext,
          "",
        ]
      : []),
    `RECENT CONVERSATION HISTORY (last ${params.history.length} turns):`,
    params.history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"),
    "",
    `USER MESSAGE: ${params.userMessage}`,
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1000,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const validated = ReasoningResultSchema.parse(parsed);
  return validated;
}

// ─── completionSignal normalizer ──────────────────────────────────────────────
// The LLM often produces creative strings ("eaten", "food_logged", "completed")
// that are not in the CompletionSignalSchema enum. Since completionSignal is
// bookkeeping metadata, we normalize rather than discard the whole response.

const VALID_COMPLETION_SIGNALS = new Set([
  "weight_logged", "water_logged", "meal_logged", "macro_logged",
  "restaurant_logged", "exercise_logged", "beverage_logged",
  "self_reported", "unknown",
]);

function normalizeCompletionSignal(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (VALID_COMPLETION_SIGNALS.has(raw)) return raw;
  const s = raw.toLowerCase();
  if (s.includes("meal") || s.includes("food") || s.includes("eat") ||
      s.includes("lunch") || s.includes("dinner") || s.includes("breakfast") ||
      s.includes("snack")) return "meal_logged";
  if (s.includes("water") || s.includes("hydrat")) return "water_logged";
  if (s.includes("beverage") || s.includes("drink") || s.includes("coffee") ||
      s.includes("juice") || s.includes("shake") || s.includes("protein")) return "beverage_logged";
  if (s.includes("weight") || s.includes("scale")) return "weight_logged";
  if (s.includes("exercise") || s.includes("workout") || s.includes("gym") ||
      s.includes("train") || s.includes("run") || s.includes("walk")) return "exercise_logged";
  if (s.includes("macro") || s.includes("calor") || s.includes("carb")) return "macro_logged";
  if (s.includes("restaurant") || s.includes("dining") || s.includes("takeout")) return "restaurant_logged";
  if (s.includes("self") || s.includes("report") || s.includes("check") ||
      s.includes("noted") || s.includes("done") || s.includes("complet")) return "self_reported";
  return "unknown";
}

/** Strip invalid completionSignal values before hitting Zod — prevents a
 *  single metadata field from invalidating an otherwise valid coaching response. */
function sanitizeRenderingResponse(raw: any): any {
  if (!raw?.todayPlan?.items || !Array.isArray(raw.todayPlan.items)) return raw;
  return {
    ...raw,
    todayPlan: {
      ...raw.todayPlan,
      items: raw.todayPlan.items.map((item: any) => ({
        ...item,
        completionSignal: normalizeCompletionSignal(item.completionSignal),
      })),
    },
  };
}

// ─── Rendering Pass ───────────────────────────────────────────────────────────

async function runRenderingPass(params: {
  userMessage: string;
  reasoning: any;
  styleResolution: { mode: StyleMode; instructions: string };
  confidence: ConfidenceAssessment;
  patterns: MatchedPattern[];
  additionalContext: Record<string, unknown>;
  availableTools: Array<{ id: string; label: string; featureTarget: string; description: string }>;
  specialization: string;
}): Promise<CoachResponse> {
  const openai = getOpenAI();

  const confidenceInstructions = getConfidenceInstructions(params.confidence.level);

  const patternTemplates =
    params.patterns.length > 0
      ? JSON.stringify(
          params.patterns.slice(0, 2).map((p) => ({
            allowedFramings: p.rule.interpretationBoundaries.allowedFramings,
            forbiddenFramings: p.rule.interpretationBoundaries.forbiddenFramings,
            actionTemplates: p.template.actionTemplates,
            learningTemplates: p.template.learningTemplates,
          })),
          null, 2
        )
      : "No specific pattern matched — use general exploratory coaching.";

  // Inject the Supportive Accountability & Reinforcement Doctrine into the rendering pass.
  const doctrineSectionForRendering = generateDoctrineSystemPromptSection("corner");

  const systemPrompt = [
    "You are the LANGUAGE LAYER of the MPM Coaching Engine.",
    "The coaching decision has been made. Your job: express it as natural, helpful conversation.",
    "",
    doctrineSectionForRendering,
    "",
    "EXPRESSION PIPELINE — KNOW → INTERPRET → SUPPORT → COACH → REINFORCE → LEARN:",
    "  SUPPORT:    See BEHAVIOR SIGNAL in the user prompt. Match your tone and approach to the evidence pattern.",
    "              The signal governs HOW you speak to this person, not the coaching content.",
    "  REINFORCE:  If behavior highlights are present in the signal, open by naming what the data now",
    "              reveals — not as praise, as a data report. ('This helps. You've logged consistently...')",
    "              If recoveryDetected=YES, acknowledge the return specifically before anything else.",
    "",
    "SCOPE OF PRACTICE — NON-NEGOTIABLE:",
    "  Chef's Corner may: educate, identify patterns, suggest appropriate My Perfect Meals",
    "  capabilities, and offer practical nutrition and behavior options.",
    "  Chef's Corner must not: diagnose, prescribe treatment, override a professional care plan,",
    "  or independently modify a prescribed nutrition protocol.",
    "  When the user has a coach, dietitian, physician, or other healthcare professional, position",
    "  recommendations as supportive suggestions and defer clinical or prescribed-plan decisions",
    "  to that professional.",
    "  Forbidden language: 'I'm adjusting your targets', 'this will fix it', 'fixable by', 'fix the',",
    "  'your problem is X', 'I'm changing your plan to', 'I'll fix', 'this fixes'.",
    "  These are medical/clinical determinations — not yours to make.",
    "  Confident coaching language is encouraged: 'If a full meal doesn't sound good right now,",
    "  something lighter may be easier—try Beverage Creator.' That is coaching, not diagnosing.",
    "",
    "CORE COACHING PHILOSOPHY — READ FIRST:",
    "  Insufficient data is a LIMITATION ON PERSONALIZATION, not a reason to withhold useful coaching.",
    "  The coach must always give something actionable and educational.",
    "  The only exception: when answering would require a medical determination the coach has no",
    "  authority to make. Even then, give appropriate general education and next steps.",
    "  This applies to: fatigue, hunger, cravings, poor workout energy, appetite changes,",
    "  hydration questions, meal timing problems, adherence struggles, and similar topics.",
    "",
    "THREE-LEVEL EVIDENCE DOCTRINE (governs whatIFound + whatItCouldMean):",
    "  Level 1 — LOW confidence (little or no platform data):",
    "    • Acknowledge the gap in one sentence.",
    "    • Then give useful general education about the topic. Name the nutritional possibilities",
    "      (e.g. for fatigue: 'Low energy can sometimes show up when you're under-eating, going",
    "      too long between meals, getting fewer carbohydrates than your body is used to,",
    "      not drinking enough fluids, training harder than usual, or dealing with more stress.')",
    "    • Provide safe, reasonable nutrition-focused actions from todayPlan.",
    "    • Clearly label guidance as general, not personalized.",
    "    • Close with what specific logging would make the next answer personalized.",
    "    • If the topic requires medical determination, add a brief safety note.",
    "    • Do NOT just ask them to go log something and leave them empty-handed.",
    "  Level 2 — PARTIAL confidence (some platform data):",
    "    • Name what IS visible from the platform AND what is missing in the same breath.",
    "      ('You haven't logged breakfast, and you're at 35g of your 160g carb target so far...')",
    "    • Combine the observed data with general guidance for the gaps.",
    "    • Be specific about what's observed; be general about what's not.",
    "  Level 3 — HIGH confidence (strong longitudinal evidence):",
    "    • Lead with specific platform observations. Earn personalized claims.",
    "      ('I've noticed that 4 of your last 5 low-energy check-ins followed days when you",
    "       were substantially below your carbohydrate target.')",
    "    • Generic coaching should recede as evidence about this individual gets stronger.",
    "",
    "DATA CONFIDENCE (calibrate whatIFound opening — maps to Level above):",
    "  HIGH:    Lead with specific observations from data. ('Looking at the last several days, I can see...')",
    "  PARTIAL: Name what is visible AND what is missing. ('I can see X, but I don't have Y logged yet...')",
    "  LOW:     Acknowledge the gap first. Then give general education and safe actions.",
    "           Never leave the user empty-handed. Always close with what logging would personalize this.",
    "",
    "CRITICAL RULES:",
    "1. You are EXPRESSING an already-made decision — not making new decisions.",
    "2. Do NOT introduce any facts not in the REASONING DECISION below.",
    "   Exception: general nutrition education (common causes, general mechanisms) is always",
    "   permitted when confidence is LOW — it is not 'inventing facts', it is educating.",
    "3. Follow the STYLE GUIDE exactly — it controls tone and delivery, not content.",
    "4. FORBIDDEN FRAMINGS below are non-negotiable — never use this language.",
    "5. Apply CONFIDENCE RESTRICTIONS — these cannot be overridden.",
    "6. CAPABILITY SELECTION — read carefully:",
    "   a. The COACHING CONTEXT SNAPSHOT lists each feature with its Purpose and 'Applicable when' situations.",
    "   b. Recommend a feature ONLY when the user's expressed need or grounded evidence matches one of",
    "      that feature's listed situations. Prefer the strongest match.",
    "   c. Do NOT recommend a feature merely because it is available. An unrelated tool recommendation",
    "      is worse than no recommendation.",
    "   d. A user can have more than one need — recommend more than one feature only if each is genuinely matched.",
    "   e. Use ONLY feature IDs and routes from the snapshot. Do not invent feature names.",
    "",
    "   MEDICAL CONDITIONS IN RESPONSES — read carefully:",
    "   f. Medical and specialty conditions from the user profile are context clues, not automatic explanations.",
    "   g. Only mention a condition in your response if the REASONING DECISION identified it as relevant.",
    "   h. A condition appearing in the profile does NOT justify citing it for every question.",
    "   i. If the reasoning decision did not connect a condition to the current question, leave it out.",
    "7. Respond ONLY in valid JSON matching the four-section schema. No markdown.",
    "",
    "FOUR-SECTION RESPONSE SCHEMA:",
    JSON.stringify({
      whatIFound: "What the coach observed in the platform. Grounded in evidence. Start with what was actually seen, not what the user said. If evidence is empty, acknowledge that openly.",
      whatItCouldMean: "What the pattern suggests. Reasoning from evidence. Do not assert causation. Hedge appropriately per confidence level.",
      todayPlan: {
        why: "Why this plan — grounded in the evidence (1–2 sentences)",
        items: [{ horizon: "today|tomorrow|next_check_in", kind: "drink|eat|avoid|log|activity|weigh|contact_care|use_feature|other", text: "Action text", completionSignal: "OPTIONAL — if provided, must be exactly one of: weight_logged | water_logged | meal_logged | macro_logged | restaurant_logged | exercise_logged | beverage_logged | self_reported | unknown — omit the field entirely when none of these fits cleanly", featureTarget: "optional — only for use_feature" }],
        successMetric: "How we'll know the plan worked",
        nextCheckIn: "When to check in (human-readable)",
        followUpAt: "ISO date string (optional)",
      },
      learningOpportunity: "What additional logging would improve future coaching. NULL if: high confidence already, or safety escalation, or would overwhelm the user.",
    }, null, 2),
  ].join("\n");

  // Inject the context snapshot block if available (Phase 1)
  const renderContextBlock = typeof params.additionalContext?.coachingContextBlock === "string"
    ? params.additionalContext.coachingContextBlock as string
    : null;

  // Phase 2: Reasoning Library brief — approved actions and forbidden conclusions carry into rendering
  const renderReasoningBrief = typeof params.additionalContext?.reasoningBriefBlock === "string"
    ? params.additionalContext.reasoningBriefBlock as string
    : null;

  // Phase 2 Doctrine: behavior signal — governs SUPPORT + REINFORCE steps
  const renderBehaviorSignal = typeof params.additionalContext?.behaviorSignalBlock === "string"
    ? params.additionalContext.behaviorSignalBlock as string
    : null;

  const renderContextForJson = { ...params.additionalContext };
  delete (renderContextForJson as any).coachingContextBlock;
  delete (renderContextForJson as any).coachingContextSnapshot;
  delete (renderContextForJson as any).reasoningBriefBlock;
  delete (renderContextForJson as any).behaviorSignalBlock;

  const userPrompt = [
    `STYLE GUIDE:`,
    params.styleResolution.instructions,
    "",
    `CONFIDENCE RESTRICTIONS:`,
    confidenceInstructions,
    "",
    ...(renderContextBlock
      ? [`COACHING CONTEXT SNAPSHOT (use DATA CONFIDENCE to calibrate your opening):`, renderContextBlock, ""]
      : [`USER CONTEXT:`, JSON.stringify(renderContextForJson, null, 2), ""]),
    ...(renderBehaviorSignal
      ? [
          `BEHAVIOR SIGNAL (server-classified — governs SUPPORT + REINFORCE steps in your response):`,
          renderBehaviorSignal,
          "",
        ]
      : []),
    ...(renderReasoningBrief
      ? [
          `COACHING REASONING BRIEF (approved actions and forbidden conclusions — honour these exactly):`,
          renderReasoningBrief,
          "",
        ]
      : []),
    `REASONING DECISION (express this):`,
    JSON.stringify(params.reasoning, null, 2),
    "",
    `PATTERN TEMPLATES AND INTERPRETATION BOUNDARIES:`,
    patternTemplates,
    "",
    `AVAILABLE TOOLS (use ONLY these for feature redirects — do not invent feature names):`,
    JSON.stringify(params.availableTools.map((t) => ({ id: t.id, label: t.label, featureTarget: t.featureTarget, description: t.description })), null, 2),
  ].join("\n");

  let retries = 0;
  const MAX_RETRIES = 2;

  while (retries <= MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);

      // Normalize completionSignal before Zod — the LLM often returns creative
      // strings that aren't in the enum. This metadata field must never discard
      // an otherwise valid coaching response.
      const sanitized = sanitizeRenderingResponse(parsed);
      const validated = CoachResponseSchema.parse(sanitized);

      // Enforce confidence restrictions programmatically
      // LOW: max 2 items — the doctrine calls for "safe actions" (plural); 1 was too restrictive
      //      for a LOW-data user who needs general guidance + a logging next step.
      // MODERATE: max 3 items
      const rawItems = validated.todayPlan.items;
      const cappedItems =
        params.confidence.level === "low" && rawItems.length > 2
          ? rawItems.slice(0, 2)
          : params.confidence.level === "moderate" && rawItems.length > 3
            ? rawItems.slice(0, 3)
            : rawItems;

      // Explicitly construct typed TodayPlanItem[] so the Zod-inferred shape
      // and the TodayPlanItem contract are unified at the type level.
      const typedItems: TodayPlanItem[] = cappedItems.map((item) => ({
        horizon: item.horizon,
        kind: item.kind,
        text: item.text,
        ...(item.dueAt !== undefined && { dueAt: item.dueAt }),
        ...(item.completionSignal !== undefined && { completionSignal: item.completionSignal }),
        ...(item.featureTarget !== undefined && { featureTarget: item.featureTarget }),
      }));

      const typedTodayPlan: TodayPlan = {
        why: validated.todayPlan.why,
        successMetric: validated.todayPlan.successMetric,
        nextCheckIn: validated.todayPlan.nextCheckIn,
        ...(validated.todayPlan.followUpAt !== undefined && { followUpAt: validated.todayPlan.followUpAt }),
        items: typedItems,
      };

      // Low confidence: learning opportunity is mandatory
      const learningOpportunity =
        params.confidence.level === "low" && !validated.learningOpportunity
          ? "The more you log, the better I can help. If you can log your meals consistently for the next few days, I'll be able to give you much more specific guidance."
          : validated.learningOpportunity;

      return {
        whatIFound: validated.whatIFound,
        whatItCouldMean: validated.whatItCouldMean,
        todayPlan: typedTodayPlan,
        learningOpportunity,
        meta: {
          specialization: params.specialization as any,
          confidence: params.confidence.level,
          styleMode: params.styleResolution.mode,
          patternKeys: params.patterns.map((p) => p.patternKey),
          observersRun: [],
          redFlag: false,
        },
      };
    } catch (err: any) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error("[Engine] Rendering pass failed after retries:", err.message);
        return await buildFallbackResponse(params.confidence.level, params.styleResolution.mode, params.specialization, params.userMessage);
      }
      console.warn(`[Engine] Rendering pass attempt ${retries} failed, retrying...`);
    }
  }

  return await buildFallbackResponse(params.confidence.level, params.styleResolution.mode, params.specialization, params.userMessage);
}

async function buildFallbackResponse(
  confidence: any,
  style: any,
  specialization: any,
  userMessage: string
): Promise<CoachResponse> {
  // The fallback fires when the rendering pass fails after retries.
  // We still need to give a useful, topic-aware response — not generic boilerplate
  // and never "I ran into a technical issue." Per the three-level evidence doctrine:
  // insufficient data limits personalization, it does not eliminate coaching value.
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a nutrition coach with no access to this user's personal logged data.",
            "The user asked a question. Respond under LOW evidence rules:",
            "1. Acknowledge in ONE brief sentence that you don't have their personal platform data to personalize this.",
            "2. Give genuinely useful, topic-specific general coaching about exactly what they asked.",
            "   Name 2-4 realistic possibilities or factors relevant to their question.",
            "3. Suggest 1-2 safe, specific actions relevant to their actual question (not generic 'eat consistently').",
            "4. Explain in one sentence what logging would help you personalize the answer next time.",
            "NEVER say 'technical issue', 'error', 'system failure', or expose internal state.",
            "NEVER give generic nutrition foundations unrelated to what they asked.",
            "Respond ONLY with valid JSON:",
            JSON.stringify({
              whatIFound: "One sentence: what you can and cannot see from the platform right now",
              whatItCouldMean: "General education about the topic they asked — specific possibilities, not generic advice",
              planWhy: "Why these specific actions make sense for their question",
              action1: "First specific action relevant to their actual question",
              action2: "Second specific action or logging step",
              learningOpportunity: "What specific logging would let you personalize this next time"
            })
          ].join("\n"),
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const r = JSON.parse(raw);

    return {
      whatIFound: r.whatIFound ?? "I don't have your logged data available right now to personalize this.",
      whatItCouldMean: r.whatItCouldMean ?? "Without your logs I can only offer general guidance on this topic.",
      todayPlan: {
        why: r.planWhy ?? "Safe actions based on your question.",
        items: [
          { horizon: "today" as const, kind: "other" as const, text: r.action1 ?? "Start with something light and manageable.", completionSignal: "self_reported" as const },
          { horizon: "today" as const, kind: "log" as const, text: r.action2 ?? "Log what you eat today so I can give you a personalized answer next time.", completionSignal: "meal_logged" as const },
        ],
        successMetric: "You took one action and logged something today.",
        nextCheckIn: "Next time you check in",
      },
      learningOpportunity: r.learningOpportunity ?? "Logging your meals and today's check-in will let me give you a personalized answer.",
      meta: { specialization, confidence, styleMode: style, patternKeys: [], observersRun: [], redFlag: false },
    };
  } catch {
    // Last-resort static fallback — still topic-aware at minimum, never "technical issue"
    return {
      whatIFound: "I don't have your logged data available right now to personalize this answer.",
      whatItCouldMean:
        "Without your platform data I can only offer general guidance. " +
        "For most nutrition questions — hunger, appetite changes, energy, meal timing — " +
        "the answer depends on your targets, what you've eaten, and your recent patterns. " +
        "Start with something small and manageable, and log it so I can give you a real answer next time.",
      todayPlan: {
        why: "General guidance until your data is available.",
        items: [
          { horizon: "today" as const, kind: "other" as const, text: "Start small — even a light option is better than nothing if you're hungry.", completionSignal: "self_reported" as const },
          { horizon: "today" as const, kind: "log" as const, text: "Log what you eat today so I can personalize my next answer for you.", completionSignal: "meal_logged" as const },
        ],
        successMetric: "You ate something and logged it.",
        nextCheckIn: "Next time you check in",
      },
      learningOpportunity: "Log your meals and check-in so I can move from general guidance to specific answers for you.",
      meta: { specialization, confidence, styleMode: style, patternKeys: [], observersRun: [], redFlag: false },
    };
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class CoachingEngine {
  async run(
    request: CoachRequest,
    req: Request
  ): Promise<CoachResponse & { conversationId: string; messageId: string }> {
    const { specialization, userMessage } = request;

    console.log(`[Engine] run — specialization=${specialization}, intent detection starting`);

    // 1. Load specialization adapter
    const adapter = getAdapter(specialization);

    // 2. Load and authorize subject
    const subject = await adapter.loadSubject(req);
    console.log(`[Engine] subject loaded — type=${subject.subjectType}, id=${subject.subjectId}`);

    // 3. Safety gate — runs before EVERYTHING else
    const safety = await runSafetyGate(userMessage, adapter.safetyRules);
    if (safety.triggered) {
      console.log(`[Engine] Safety gate triggered: ${safety.reason} (class: ${safety.class})`);
      // Still need a conversationId for persistence
      const conversationId = await resolveConversation(
        request.conversationId, subject, specialization
      );
      const safeResponse = buildSafetyResponse(safety);
      const { assistantMessageId } = await persistTurn(
        conversationId, subject, userMessage,
        safeResponse as CoachResponse,
        [], [], { level: "low", coverageScore: 0, evidenceSatisfied: [], evidenceMissing: [], hasConflict: false, suppressCausal: true },
        "safety_escalation", {}, []
      );
      return { ...(safeResponse as CoachResponse), conversationId, messageId: assistantMessageId };
    }

    // 4. Resolve conversation
    const conversationId = await resolveConversation(
      request.conversationId, subject, specialization
    );

    // 5. Load conversation history (bounded continuity — Phase 5)
    const { history, rollingContext } = await loadConversationHistory(
      conversationId, subject.ownerId, specialization
    );

    // 6. Intent detection
    const intent = detectIntent(userMessage, history);
    console.log(`[Engine] intent detected: ${intent}`);

    // 7. Select and run Observers
    const selectedObserverIds = selectObservers(intent, adapter.supportedObservers);
    console.log(`[Engine] observers selected: ${selectedObserverIds.join(", ")}`);
    const observerOutputs = await runObservers(selectedObserverIds, subject);

    // 8. Build evidence with IDs for citation validation
    const evidenceWithIds = buildEvidenceWithIds(observerOutputs);
    const evidenceIdSet = buildEvidenceIdSet(evidenceWithIds);

    // 9. Load additional context and memories in parallel
    const [additionalContext, coachingMemories, nutritionMemories] = await Promise.all([
      adapter.loadAdditionalContext(subject),
      loadCoachingMemories(subject.ownerId, specialization),
      loadNutritionMemories(subject.ownerId),
    ]);

    // 10. Pattern matching
    const patterns = await matchPatterns(
      intent, observerOutputs, adapter.knowledgeScopes, specialization
    );
    console.log(`[Engine] patterns matched: ${patterns.map((p) => p.patternKey).join(", ") || "none"}`);

    // 11. Confidence scoring (server-side, LLM cannot override)
    const confidence = scoreConfidence(observerOutputs, patterns);
    console.log(`[Engine] confidence: ${confidence.level} (coverage: ${confidence.coverageScore.toFixed(2)})`);

    // 12. Style resolution
    const styleResolution = await resolveStyle(subject.ownerId);
    console.log(`[Engine] style: ${styleResolution.mode} (profile found: ${styleResolution.profileFound})`);

    // 12.5. Reasoning Library — match a coaching family and build the server-controlled brief
    // This runs after observers (have trending evidence) and context (have today's snapshot).
    const coachingContextSnapshot =
      (additionalContext as any).coachingContextSnapshot ?? null;
    const reasoningLibraryMatch = coachingContextSnapshot
      ? matchReasoningFamily(userMessage, intent, coachingContextSnapshot, observerOutputs)
      : { primary: null, modifier: null };
    const reasoningBriefBlock = renderReasoningBriefForPrompt(reasoningLibraryMatch);
    if (reasoningLibraryMatch.primary) {
      console.log(`[Engine] reasoning family: ${reasoningLibraryMatch.primary.familyId}${reasoningLibraryMatch.modifier ? " + reinforcement modifier" : ""}`);
    }
    // Attach to additionalContext so both LLM passes receive it
    (additionalContext as any).reasoningBriefBlock = reasoningBriefBlock || null;

    // 12.6. Supportive Accountability Doctrine — classify behavioral evidence pattern
    // Describes the EVIDENCE PATTERN (not the person). governs HOW the coach approaches them.
    const behaviorSignal = classifyBehaviorProgress(observerOutputs, coachingContextSnapshot);
    const behaviorSignalBlock = renderBehaviorSignalBlock(behaviorSignal);
    console.log(`[Engine] behavior pattern: ${behaviorSignal.evidencePattern}${behaviorSignal.recoveryDetected ? " (recovery detected)" : ""}`);
    (additionalContext as any).behaviorSignalBlock = behaviorSignalBlock;

    // 13. Reasoning pass (LLM call 1 — internal JSON, not shown to user)
    // Wrapped in try-catch: a Zod validation failure here (e.g. empty evidence block
    // causing evidenceCitationIds: [] when schema expected min(1)) must not kill the
    // turn — fall through to the rendering pass with a minimal synthetic reasoning object.
    let rawReasoning: any;
    try {
      rawReasoning = await runReasoningPass({
        userMessage,
        evidence: evidenceWithIds,
        patterns,
        confidence,
        coachingMemories,
        nutritionMemories,
        additionalContext,
        history,
        rollingContext: rollingContext ?? undefined,
        specialization,
      });
    } catch (reasoningErr: any) {
      console.warn(`[Engine] Reasoning pass failed (${reasoningErr.message}) — using synthetic reasoning fallback`);
      rawReasoning = {
        primaryConcern: userMessage,
        hypotheses: [{
          explanation: "Insufficient platform evidence to form a specific hypothesis at this time.",
          evidenceCitationIds: [],
          likelihood: "possible" as const,
        }],
        leadHypothesis: "The user has raised a concern. Without sufficient logged data, the coach will acknowledge the situation and guide next steps.",
        proposedConfidence: "low" as const,
        redFlag: false,
        missingData: ["meal logs", "daily prescription adherence"],
      };
    }

    // 14. Citation validation — strip any hallucinated evidence IDs
    const { valid: validatedReasoning, hallucinated, stripped } = validateCitations(
      rawReasoning, evidenceIdSet
    );
    if (hallucinated.length > 0) {
      console.warn(`[Engine] Citation validation: ${stripped} hallucinated citation(s) stripped: ${hallucinated.join(", ")}`);
    }

    // If red flag from reasoning (not caught by safety gate — rare edge case)
    if (validatedReasoning.redFlag) {
      console.log(`[Engine] Red flag from reasoning pass: ${validatedReasoning.redFlagReason}`);
      const safeResponse = buildSafetyResponse({
        triggered: true,
        class: "escalate",
        reason: validatedReasoning.redFlagReason ?? "reasoning_red_flag",
        suggestedResponse: validatedReasoning.redFlagReason,
      });
      const { assistantMessageId } = await persistTurn(
        conversationId, subject, userMessage,
        safeResponse as CoachResponse,
        observerOutputs, patterns, confidence, intent, validatedReasoning, []
      );
      return { ...(safeResponse as CoachResponse), conversationId, messageId: assistantMessageId };
    }

    // 15. Rendering pass (LLM call 2 — user-facing CoachResponse)
    const response = await runRenderingPass({
      userMessage,
      reasoning: validatedReasoning,
      styleResolution,
      confidence,
      patterns,
      additionalContext,
      availableTools: adapter.availableTools,
      specialization,
    });

    // 16. Persist conversation, investigation, plan, items, follow-up record
    const { assistantMessageId } = await persistTurn(
      conversationId, subject, userMessage,
      response, observerOutputs, patterns, confidence, intent, validatedReasoning,
      selectedObserverIds
    );

    console.log(`[Engine] turn complete — conversationId=${conversationId}, messageId=${assistantMessageId}`);

    // 17. Phase 5: Fire-and-forget memory extraction (non-blocking)
    extractAndPersistMemories({
      userId: subject.ownerId,
      specialization,
      sourceMessageId: assistantMessageId,
      userMessage,
      coachResponse: { whatIFound: response.whatIFound, whatItCouldMean: response.whatItCouldMean },
      observerOutputs,
    }).catch((err: Error) => console.warn("[Engine] Memory extraction failed:", err.message));

    return { ...response, conversationId, messageId: assistantMessageId };
  }
}

export const engine = new CoachingEngine();
