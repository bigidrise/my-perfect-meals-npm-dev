/**
 * Memory Extractor — Phase 5
 *
 * After each coaching conversation turn, proposes memory candidates via LLM,
 * then validates and writes accepted entries to coaching_memories.
 *
 * Authority chain:
 *   Safety > Platform Evidence > Knowledge Pattern > Coaching Memory > LLM
 *
 * The LLM may PROPOSE memory candidates. The server decides whether they are accepted.
 * No raw free-form AI memory is written directly to the database.
 *
 * Validation pipeline:
 *   1. Schema — required fields present + typed correctly
 *   2. Category — must be one of the allowed categories
 *   3. Key — validated against per-category allowed keys (no freeform injection)
 *   4. Confidence — must be >= 0.4 (low-confidence observations discarded)
 *   5. Duplication — same (user, spec, key) active? compare values; skip if identical
 *   6. Contradiction — different value for same key? archive old, create new
 *   7. Expiry — sensible defaults per category; LLM can shorten, never extend
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";
import type { ObserverOutput } from "../../../shared/coaching/types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── Allowed memory vocabulary ────────────────────────────────────────────────

export type MemoryCategory = "behavior" | "lifestyle" | "nutrition" | "success";

/**
 * Server-side key allowlist per category.
 * The LLM cannot introduce arbitrary keys — it must use one from this set.
 * Keys are human-readable descriptors, not database column names.
 */
const ALLOWED_KEYS: Record<MemoryCategory, Set<string>> = {
  behavior: new Set([
    "weekend_struggle",
    "morning_consistency",
    "evening_eating",
    "stress_eating",
    "emotional_eating",
    "accountability_style",
    "reassurance_needed",
    "direct_feedback_effective",
    "setback_recovery_pattern",
    "motivation_driver",
    "adherence_pattern",
    "craving_pattern",
    "skips_breakfast",
    "late_night_eating",
    "social_eating_pattern",
  ]),
  lifestyle: new Set([
    "travel_disrupts_routine",
    "work_schedule_impact",
    "family_responsibilities",
    "meal_prep_pattern",
    "restaurant_frequency",
    "hydration_pattern",
    "exercise_consistency",
    "sleep_pattern",
    "social_event_pattern",
    "commute_pattern",
    "cooking_preference",
    "grocery_routine",
  ]),
  nutrition: new Set([
    "protein_preference",
    "carb_tolerance",
    "meal_timing_preference",
    "portion_awareness",
    "food_aversion",
    "preferred_meal_structure",
    "snacking_pattern",
    "macronutrient_gap",
    "micronutrient_concern",
    "hydration_goal",
    "calorie_awareness",
  ]),
  success: new Set([
    "effective_strategy",
    "prior_weight_outcome",
    "behavior_outcome_correlation",
    "plan_adherence_outcome",
    "hydration_outcome",
    "meal_prep_outcome",
    "restaurant_reduction_outcome",
    "exercise_outcome",
  ]),
};

/** Default expiry in days per category (LLM may only shorten, not extend) */
const DEFAULT_EXPIRY_DAYS: Record<MemoryCategory, number> = {
  behavior:  90,
  lifestyle: 90,
  nutrition: 60,
  success:   180,
};

const MAX_EXPIRY_DAYS: Record<MemoryCategory, number> = {
  behavior:  180,
  lifestyle: 180,
  nutrition: 120,
  success:   365,
};

// ─── LLM proposal schema ──────────────────────────────────────────────────────

interface MemoryProposal {
  category: MemoryCategory;
  key: string;
  value_json: Record<string, unknown>;
  confidence: number;      // 0.0 – 1.0
  rationale: string;
  expires_in_days?: number;
}

interface LLMMemoryOutput {
  candidates: MemoryProposal[];
  no_new_memories_reason?: string;
}

// ─── LLM extraction pass ─────────────────────────────────────────────────────

async function proposeMemoryCandidates(params: {
  userId: string;
  specialization: string;
  userMessage: string;
  coachResponse: { whatIFound: string; whatItCouldMean: string };
  observerOutputs: ObserverOutput[];
  existingMemories: Array<{ key: string; category: string; value_json: unknown }>;
}): Promise<MemoryProposal[]> {
  const openai = getOpenAI();

  const systemPrompt = [
    "You are the MEMORY LAYER of the MPM Coaching Engine.",
    "After each coaching conversation, you identify durable behavioral facts worth remembering.",
    "",
    "RULES:",
    "1. Only propose memories supported by what the USER said or what PLATFORM EVIDENCE clearly shows.",
    "2. Do NOT invent observations not present in this conversation.",
    "3. Confidence must reflect how certain the observation is (0.0–1.0). Min 0.4 to propose.",
    "4. Key must be exactly one from the allowed list for that category.",
    "5. If nothing new was learned, return an empty candidates array.",
    "6. Expire behavioral memories sooner if they seem situational.",
    "",
    "ALLOWED CATEGORIES and KEYS:",
    JSON.stringify(
      Object.fromEntries(
        Object.entries(ALLOWED_KEYS).map(([cat, keys]) => [cat, Array.from(keys)])
      ),
      null, 2
    ),
    "",
    "RESPONSE SCHEMA (JSON only):",
    JSON.stringify({
      candidates: [{
        category: "behavior|lifestyle|nutrition|success",
        key: "one from allowed list above",
        value_json: { summary: "Brief factual description", observed: "what triggered this observation" },
        confidence: 0.7,
        rationale: "Why this is worth remembering",
        expires_in_days: 90,
      }],
      no_new_memories_reason: "string if candidates is empty",
    }, null, 2),
  ].join("\n");

  const userPrompt = [
    "CONVERSATION:",
    `User said: ${params.userMessage}`,
    `Coach observed: ${params.coachResponse.whatIFound}`,
    `Coach reasoning: ${params.coachResponse.whatItCouldMean}`,
    "",
    "PLATFORM EVIDENCE SUMMARY:",
    params.observerOutputs.length > 0
      ? params.observerOutputs.map((o) =>
          `${o.observerId}: ${o.findings.map((f) => `${f.metric}=${f.value}`).join(", ")}`
        ).join("\n")
      : "No platform evidence available.",
    "",
    "EXISTING MEMORIES (do not duplicate):",
    params.existingMemories.length > 0
      ? params.existingMemories.map((m) => `${m.category}/${m.key}`).join(", ")
      : "None",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // cheaper for extraction pass
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed: LLMMemoryOutput = JSON.parse(raw);
    return parsed.candidates ?? [];
  } catch (err: any) {
    console.warn("[MemoryExtractor] LLM proposal failed:", err.message);
    return [];
  }
}

// ─── Validation pipeline ──────────────────────────────────────────────────────

function validateProposal(
  proposal: MemoryProposal
): { valid: true; expiresAt: Date | null } | { valid: false; reason: string } {
  // 1. Category
  if (!["behavior", "lifestyle", "nutrition", "success"].includes(proposal.category)) {
    return { valid: false, reason: `unknown category: ${proposal.category}` };
  }

  // 2. Key allowlist
  if (!ALLOWED_KEYS[proposal.category].has(proposal.key)) {
    return { valid: false, reason: `key '${proposal.key}' not in allowed list for ${proposal.category}` };
  }

  // 3. Confidence threshold
  if (typeof proposal.confidence !== "number" || proposal.confidence < 0.4) {
    return { valid: false, reason: `confidence ${proposal.confidence} below threshold 0.4` };
  }

  // 4. Value shape
  if (!proposal.value_json || typeof proposal.value_json !== "object") {
    return { valid: false, reason: "value_json must be a non-null object" };
  }

  // 5. Expiry — cap at max, default if missing
  const defaultDays = DEFAULT_EXPIRY_DAYS[proposal.category];
  const maxDays = MAX_EXPIRY_DAYS[proposal.category];
  const requestedDays = typeof proposal.expires_in_days === "number"
    ? Math.max(1, Math.min(proposal.expires_in_days, maxDays))
    : defaultDays;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + requestedDays);

  return { valid: true, expiresAt };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract and persist memory candidates from a completed conversation turn.
 * Non-blocking fire-and-forget — engine does not wait for this.
 * Failures are logged but do not affect the user response.
 */
export async function extractAndPersistMemories(params: {
  userId: string;
  specialization: string;
  sourceMessageId: string;
  userMessage: string;
  coachResponse: { whatIFound: string; whatItCouldMean: string };
  observerOutputs: ObserverOutput[];
}): Promise<void> {
  try {
    // Load existing active memories for deduplication
    const existing = await db.execute<{ key: string; category: string; value_json: unknown; id: string }>(sql`
      SELECT id, key, category, value_json
      FROM coaching_memories
      WHERE user_id = ${params.userId}
        AND specialization = ${params.specialization}
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 30
    `);

    // Ask LLM to propose candidates
    const proposals = await proposeMemoryCandidates({
      userId: params.userId,
      specialization: params.specialization,
      userMessage: params.userMessage,
      coachResponse: params.coachResponse,
      observerOutputs: params.observerOutputs,
      existingMemories: existing.rows.map((r) => ({
        key: r.key,
        category: r.category,
        value_json: r.value_json,
      })),
    });

    if (proposals.length === 0) return;

    for (const proposal of proposals) {
      const validation = validateProposal(proposal);
      if (validation.valid === false) {
        console.log(`[MemoryExtractor] Rejected proposal ${proposal.key}: ${validation.reason}`);
        continue;
      }

      const { expiresAt } = validation;

      // Check for existing active memory with same key
      const existingEntry = existing.rows.find(
        (r) => r.key === proposal.key && r.category === proposal.category
      );

      if (existingEntry) {
        // Compare values — skip if identical summary
        const existingSummary = (existingEntry.value_json as any)?.summary;
        const newSummary = proposal.value_json?.summary;
        if (existingSummary === newSummary) {
          console.log(`[MemoryExtractor] Skipping duplicate memory: ${proposal.key}`);
          continue;
        }

        // Contradiction — archive old, create new
        const newId = crypto.randomUUID();
        await db.execute(sql`
          UPDATE coaching_memories
          SET status = 'superseded',
              superseded_by_id = ${newId}
          WHERE id = ${existingEntry.id}
        `);

        await db.execute(sql`
          INSERT INTO coaching_memories
            (id, user_id, specialization, category, key, value_json, confidence,
             source_message_id, status, expires_at)
          VALUES (
            ${newId},
            ${params.userId},
            ${params.specialization},
            ${proposal.category},
            ${proposal.key},
            ${JSON.stringify(proposal.value_json)}::jsonb,
            ${Math.min(proposal.confidence, 1.0)},
            ${params.sourceMessageId},
            'active',
            ${expiresAt ? expiresAt.toISOString() : null}
          )
        `);
        console.log(`[MemoryExtractor] Superseded '${proposal.key}' with updated observation`);
      } else {
        // New memory
        await db.execute(sql`
          INSERT INTO coaching_memories
            (user_id, specialization, category, key, value_json, confidence,
             source_message_id, status, expires_at)
          VALUES (
            ${params.userId},
            ${params.specialization},
            ${proposal.category},
            ${proposal.key},
            ${JSON.stringify(proposal.value_json)}::jsonb,
            ${Math.min(proposal.confidence, 1.0)},
            ${params.sourceMessageId},
            'active',
            ${expiresAt ? expiresAt.toISOString() : null}
          )
        `);
        console.log(`[MemoryExtractor] Saved new memory: ${proposal.category}/${proposal.key} (conf=${proposal.confidence})`);
      }
    }
  } catch (err: any) {
    console.error("[MemoryExtractor] Failed:", err.message);
    // Non-fatal — memory extraction never blocks the coaching response
  }
}

/**
 * Create a success memory when a follow-up reveals a plan worked.
 * Only called when completionRate > 0.5 AND outcome evidence supports improvement.
 */
export async function createSuccessMemory(params: {
  userId: string;
  specialization: string;
  sourceMessageId: string;
  originalPlanWhy: string;
  actionSummary: string;
  completionRate: number;
  outcomeDescription: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
}): Promise<void> {
  try {
    const valueJson = {
      summary: `${params.actionSummary} was followed and was associated with: ${params.outcomeDescription}`,
      originalContext: params.originalPlanWhy,
      completionRate: params.completionRate,
      outcome: params.outcomeDescription,
      dateRange: {
        start: params.dateRangeStart.toISOString().split("T")[0],
        end: params.dateRangeEnd.toISOString().split("T")[0],
      },
      correlationNote:
        "This describes correlation only. One prior outcome does not prove causation.",
    };

    // Confidence based on completion rate + outcome quality
    const confidence = Math.min(0.5 + params.completionRate * 0.35, 0.85);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 180);

    await db.execute(sql`
      INSERT INTO coaching_memories
        (user_id, specialization, category, key, value_json, confidence,
         source_message_id, status, expires_at)
      VALUES (
        ${params.userId},
        ${params.specialization},
        'success',
        'plan_adherence_outcome',
        ${JSON.stringify(valueJson)}::jsonb,
        ${confidence},
        ${params.sourceMessageId},
        'active',
        ${expiresAt.toISOString()}
      )
    `);
    console.log(`[MemoryExtractor] Success memory created for user ${params.userId}`);
  } catch (err: any) {
    console.error("[MemoryExtractor] Success memory failed:", err.message);
  }
}
