/**
 * Follow-up Worker — Phase 5
 *
 * When a coaching follow-up becomes due, this worker:
 *   1. Loads the original plan + action items
 *   2. Loads original investigation evidence (to compare against fresh evidence)
 *   3. Re-runs only the Observers relevant to the original plan
 *   4. Detects objective/subjective/unknown completion per action item
 *   5. Loads coaching memories + behavioral profile
 *   6. Generates a grounded follow-up message via LLM
 *   7. Persists as a new assistant message in the conversation
 *   8. Marks the followup as 'delivered'
 *   9. Creates a success memory if completion + outcome evidence warrants it
 *
 * Authority chain (unchanged from main engine):
 *   Safety > Platform Evidence > Knowledge Pattern > Coaching Memory > LLM
 *
 * Absolute rules:
 * - NEVER claim the action worked unless evidence supports it
 * - NEVER describe unknown completion as failure
 * - NEVER manufacture data the user did not log
 * - Behavioral style (accountability/education/encouragement/reassurance) always applies
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";
import { runObservers } from "./observers/stubs";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
import { detectPlanCompletion } from "./completionDetector";
import { createSuccessMemory } from "./memoryExtractor";
import type { CoachSubject } from "../../../shared/coaching/types";

// ─── Data loading ─────────────────────────────────────────────────────────────

interface DueFollowup {
  id: string;
  plan_id: string;
  owner_id: string;
  due_at: string;
  observer_selection: string[] | null;
  investigation_id: string | null;
}

interface ActionPlan {
  id: string;
  conversation_id: string;
  owner_id: string;
  why: string;
  success_metric: string;
  next_check_in: string;
  created_at: string;
  plan_json: any;
}

interface Investigation {
  id: string;
  evidence_json: any;
  confidence: string;
}

interface BehavioralProfile {
  goal_type: string | null;
  setback_response: string | null;
  trust_style: string | null;
  overwhelm_response: string | null;
  progress_mindset: string | null;
}

async function loadDueFollowups(limit = 10): Promise<DueFollowup[]> {
  const r = await db.execute(sql`
    SELECT id, plan_id, owner_id, due_at, observer_selection, investigation_id
    FROM coach_followups
    WHERE status = 'pending'
      AND due_at <= NOW()
    ORDER BY due_at ASC
    LIMIT ${limit}
  `);
  return r.rows as unknown as DueFollowup[];
}

async function loadPlan(planId: string): Promise<ActionPlan | null> {
  const r = await db.execute(sql`
    SELECT id, conversation_id, owner_id, why, success_metric, next_check_in, created_at, plan_json
    FROM coach_action_plans
    WHERE id = ${planId}
    LIMIT 1
  `);
  return (r.rows[0] as unknown as ActionPlan) ?? null;
}

async function loadInvestigation(investigationId: string): Promise<Investigation | null> {
  if (!investigationId) return null;
  const r = await db.execute(sql`
    SELECT id, evidence_json, confidence
    FROM coach_investigations
    WHERE id = ${investigationId}
    LIMIT 1
  `);
  return (r.rows[0] as unknown as Investigation) ?? null;
}

async function loadBehavioralProfile(userId: string): Promise<BehavioralProfile | null> {
  const r = await db.execute(sql`
    SELECT goal_type, setback_response, trust_style, overwhelm_response, progress_mindset
    FROM coaching_profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `);
  return (r.rows[0] as unknown as BehavioralProfile) ?? null;
}

async function loadCoachingMemories(userId: string, specialization: string) {
  const r = await db.execute<{ key: string; value_json: any; confidence: number; category: string }>(sql`
    SELECT key, value_json, confidence, category
    FROM coaching_memories
    WHERE user_id = ${userId}
      AND specialization = ${specialization}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 15
  `);
  return r.rows;
}

// ─── Style resolver (simplified for follow-up) ────────────────────────────────

function resolveFollowupStyle(profile: BehavioralProfile | null): {
  mode: string;
  instructions: string;
} {
  if (!profile) {
    return {
      mode: "encouragement",
      instructions: "Be warm, supportive, and non-judgmental. Celebrate any progress.",
    };
  }

  const { setback_response, trust_style, overwhelm_response } = profile;

  if (setback_response === "stops_everything" || overwhelm_response === "shuts_down") {
    return {
      mode: "reassurance",
      instructions:
        "Lead with what DID happen or what IS working. Normalize imperfection. " +
        "Do not emphasize what was missed. End with one simple, achievable next step.",
    };
  }
  if (trust_style === "data_driven" || setback_response === "recovers_quickly") {
    return {
      mode: "accountability",
      instructions:
        "Be direct and evidence-based. State what happened, what the evidence shows, " +
        "and what the clear next action is. Avoid excessive hedging.",
    };
  }
  if (trust_style === "scientific" || overwhelm_response === "break_down") {
    return {
      mode: "education",
      instructions:
        "Explain what the evidence means in context. Give the user understanding, " +
        "not just instructions. Teach briefly when relevant.",
    };
  }

  return {
    mode: "encouragement",
    instructions:
      "Be warm and forward-looking. Acknowledge what happened without dwelling on gaps. " +
      "Focus on momentum and what comes next.",
  };
}

// ─── Follow-up LLM pass ───────────────────────────────────────────────────────

interface FollowupLLMResponse {
  whatIFound: string;
  whatItCouldMean: string;
  todayPlan: {
    why: string;
    items: Array<{ horizon: string; kind: string; text: string; completionSignal?: string }>;
    successMetric: string;
    nextCheckIn: string;
    followUpAt?: string;
  };
  learningOpportunity: string | null;
}

async function generateFollowupMessage(params: {
  plan: ActionPlan;
  completionSummary: string;
  freshEvidenceSummary: string;
  originalEvidenceSummary: string;
  coachingMemories: any[];
  behavioralStyle: { mode: string; instructions: string };
  daysSincePlan: number;
  allObjectivelyConfirmed: boolean;
  completionRate: number;
  successDescription: string | null;
}): Promise<FollowupLLMResponse> {
  const openai = getOpenAI();

  const systemPrompt = [
    "You are the MPM Coaching Engine generating a follow-up check-in message.",
    "A plan was made and you are now checking in on what happened.",
    "",
    "ABSOLUTE RULES:",
    "1. NEVER describe an unknown or unconfirmed item as failed. Use: 'I don't have enough information to know if...'",
    "2. NEVER invent data not in the FRESH EVIDENCE block.",
    "3. NEVER claim causation — describe correlation only.",
    "4. If the evidence is incomplete, describe it as incomplete, not negative.",
    "5. Apply the BEHAVIORAL STYLE GUIDE exactly — it controls tone, not content.",
    "6. You are the SAME coach continuing a relationship — not a new AI generating a notification.",
    "7. Respond ONLY in valid JSON matching the four-section schema. No markdown.",
    "",
    "FOUR-SECTION RESPONSE SCHEMA (same as regular coaching response):",
    JSON.stringify({
      whatIFound: "What you observed in the evidence since the plan. Start with what IS there, not what is missing.",
      whatItCouldMean: "What the pattern suggests. Hedge appropriately. Honest about unknowns.",
      todayPlan: {
        why: "Why this follow-up plan — grounded in what the evidence actually shows",
        items: [{ horizon: "today|tomorrow|next_check_in", kind: "drink|eat|avoid|log|activity|weigh|other", text: "Next step" }],
        successMetric: "How we'll know this is working",
        nextCheckIn: "When to check in next (human-readable)",
        followUpAt: "ISO date string, optional",
      },
      learningOpportunity: "What additional logging would help next time. Null if not needed.",
    }, null, 2),
  ].join("\n");

  const userPrompt = [
    `BEHAVIORAL STYLE (${params.behavioralStyle.mode.toUpperCase()}):`,
    params.behavioralStyle.instructions,
    "",
    `CONTEXT: This is a follow-up check-in ${params.daysSincePlan} day(s) after a plan was made.`,
    "",
    "ORIGINAL PLAN:",
    `Why: ${params.plan.why}`,
    `Success metric: ${params.plan.success_metric}`,
    "",
    "PLAN COMPLETION STATUS:",
    params.completionSummary,
    "",
    "ORIGINAL EVIDENCE (what we saw before the plan):",
    params.originalEvidenceSummary,
    "",
    "FRESH EVIDENCE (what we see now):",
    params.freshEvidenceSummary,
    "",
    params.successDescription
      ? `OUTCOME NOTE: ${params.successDescription}`
      : "OUTCOME NOTE: No clear outcome improvement detected yet.",
    "",
    "COACHING MEMORIES (personalized context):",
    params.coachingMemories.length > 0
      ? params.coachingMemories
          .map((m) => `${m.category}/${m.key}: ${JSON.stringify(m.value_json?.summary ?? m.value_json)}`)
          .join("\n")
      : "No prior coaching memories.",
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as FollowupLLMResponse;
  } catch (err: any) {
    console.error("[FollowupWorker] LLM generation failed:", err.message);
    // Fallback — honest and safe
    return {
      whatIFound:
        "I was looking forward to checking in, but I ran into an issue gathering the latest data.",
      whatItCouldMean:
        "This is a technical hiccup on my end — nothing to worry about. Let's pick up when you're ready.",
      todayPlan: {
        why: "Let's regroup and make sure you have clear direction.",
        items: [{ horizon: "today", kind: "log", text: "Reach out when ready to continue your plan." }],
        successMetric: "Reconnected with your plan.",
        nextCheckIn: "Whenever you're ready",
      },
      learningOpportunity: null,
    };
  }
}

// ─── Evidence summarizers ─────────────────────────────────────────────────────

function summarizeCompletion(
  items: Array<{ text: string; status: string; source: string; evidence: string }>
): string {
  if (items.length === 0) return "No action items in original plan.";
  return items
    .map((item, i) => {
      const statusLabel =
        item.status === "completed"
          ? `✓ Completed (${item.source} — ${item.evidence})`
          : `? Unknown — ${item.evidence} (cannot confirm or deny)`;
      return `${i + 1}. "${item.text}": ${statusLabel}`;
    })
    .join("\n");
}

function summarizeEvidence(observerOutputs: any[]): string {
  if (!observerOutputs || observerOutputs.length === 0) {
    return "No observer evidence available.";
  }
  return observerOutputs
    .map((o) => {
      const observerId = o.observerId ?? o.observer_id ?? "unknown";
      const findings = (o.findings ?? []).map(
        (f: any) => `${f.metric}=${f.value}${f.unit ? f.unit : ""}${f.trend ? ` (${f.trend})` : ""}`
      );
      return `${observerId}: ${findings.join(", ") || "no data"}`;
    })
    .join("\n");
}

// ─── Outcome detector ─────────────────────────────────────────────────────────

function detectPositiveOutcome(
  originalEvidence: any[],
  freshEvidence: any[]
): string | null {
  // Look for weight trending down (after a weight gain concern)
  try {
    const originalWeight = originalEvidence
      .flatMap((o) => o?.findings ?? [])
      .find((f: any) => f?.metric === "weight_30d_trend");
    const freshWeight = freshEvidence
      .flatMap((o) => o?.findings ?? [])
      .find((f: any) => f?.metric === "weight_30d_trend");

    if (originalWeight?.trend === "up" && freshWeight?.trend === "down") {
      return "Weight trend has shifted from upward to downward since the plan was made.";
    }
    if (originalWeight?.trend === "up" && freshWeight?.trend === "stable") {
      return "Weight trend has stabilized from an upward trajectory since the plan was made.";
    }
  } catch { /* best-effort */ }
  return null;
}

// ─── Main worker entry point ──────────────────────────────────────────────────

/**
 * Process a single follow-up.
 * Returns the new assistant message ID if successful, null if it failed.
 *
 * Called from the follow-up cron AND from the inline delivery endpoint
 * when the user opens Coach's Corner before the cron runs.
 */
export async function processFollowup(followupId: string): Promise<string | null> {
  // Lock the followup immediately to prevent duplicate processing
  const lockResult = await db.execute<{ id: string }>(sql`
    UPDATE coach_followups
    SET status = 'processing', updated_at = NOW()
    WHERE id = ${followupId}
      AND status = 'pending'
    RETURNING id
  `);
  if (!lockResult.rows[0]) {
    console.log(`[FollowupWorker] Followup ${followupId.slice(0, 8)} already being processed — skipping`);
    return null;
  }

  try {
    const followupRow = await db.execute(sql`
      SELECT id, plan_id, owner_id, due_at, observer_selection, investigation_id
      FROM coach_followups WHERE id = ${followupId} LIMIT 1
    `);
    const followup = followupRow.rows[0] as unknown as DueFollowup | undefined;
    if (!followup) return null;

    // 1. Load plan
    const plan = await loadPlan(followup.plan_id);
    if (!plan) {
      await db.execute(sql`UPDATE coach_followups SET status = 'cancelled', updated_at = NOW() WHERE id = ${followupId}`);
      console.warn(`[FollowupWorker] Plan ${followup.plan_id} not found — followup cancelled`);
      return null;
    }

    // 2. Load original investigation evidence
    const investigation = followup.investigation_id
      ? await loadInvestigation(followup.investigation_id)
      : null;
    const originalEvidenceRaw: any[] = investigation?.evidence_json ?? [];

    // 3. Re-run relevant observers
    const observerIds: string[] = followup.observer_selection ?? ["weight", "macro", "hydration", "compliance"];
    const subject: CoachSubject = {
      subjectType: "user",
      subjectId: followup.owner_id,
      ownerId: followup.owner_id,
    };
    const freshObserverOutputs = await runObservers(observerIds, subject);

    // 4. Detect completion
    const planCreatedAt = new Date(plan.created_at);
    const completionResult = await detectPlanCompletion(
      plan.id,
      followup.owner_id,
      planCreatedAt
    );

    // 5. Load coaching memories + behavioral profile
    const [memories, behavProfile] = await Promise.all([
      loadCoachingMemories(followup.owner_id, "corner"),
      loadBehavioralProfile(followup.owner_id),
    ]);

    // 6. Resolve style
    const style = resolveFollowupStyle(behavProfile);

    // 7. Compute outcome
    const successDescription = completionResult.completionRate > 0.5
      ? detectPositiveOutcome(originalEvidenceRaw, freshObserverOutputs)
      : null;

    // 8. Days since plan
    const daysSincePlan = Math.max(
      1,
      Math.round((Date.now() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
    );

    // 9. Generate follow-up message
    const followupResponse = await generateFollowupMessage({
      plan,
      completionSummary: summarizeCompletion(
        completionResult.items.map((i) => ({
          text: (plan.plan_json?.items?.[completionResult.items.indexOf(i)]?.text ?? `Item ${i.itemId.slice(0, 6)}`),
          status: i.status,
          source: i.source,
          evidence: i.evidence,
        }))
      ),
      freshEvidenceSummary: summarizeEvidence(freshObserverOutputs),
      originalEvidenceSummary: summarizeEvidence(originalEvidenceRaw),
      coachingMemories: memories,
      behavioralStyle: style,
      daysSincePlan,
      allObjectivelyConfirmed: completionResult.allObjectivelyConfirmed,
      completionRate: completionResult.completionRate,
      successDescription,
    });

    // 10. Persist as assistant message in conversation
    const msgResult = await db.execute<{ id: string }>(sql`
      INSERT INTO coach_messages (conversation_id, role, content, structured_payload)
      VALUES (
        ${plan.conversation_id},
        'assistant',
        ${followupResponse.whatIFound + "\n\n" + followupResponse.whatItCouldMean},
        ${JSON.stringify({
          ...followupResponse,
          meta: {
            specialization: "corner",
            confidence: "moderate",
            styleMode: style.mode,
            patternKeys: [],
            observersRun: observerIds,
            redFlag: false,
            isFollowup: true,
            followupId: followupId,
          },
        })}::jsonb
      )
      RETURNING id
    `);
    const messageId = msgResult.rows[0]?.id;
    if (!messageId) throw new Error("Failed to persist follow-up message");

    // Update conversation timestamp
    await db.execute(sql`
      UPDATE coach_conversations
      SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = ${plan.conversation_id}
    `);

    // 11. If follow-up plan has next_check_at, create another followup
    const nextFollowUpAt = followupResponse.todayPlan?.followUpAt;
    if (nextFollowUpAt) {
      const nextDue = new Date(nextFollowUpAt);
      if (!isNaN(nextDue.getTime()) && nextDue > new Date()) {
        await db.execute(sql`
          INSERT INTO coach_followups
            (plan_id, owner_id, due_at, status, observer_selection, investigation_id)
          VALUES (
            ${plan.id},
            ${followup.owner_id},
            ${nextDue.toISOString()},
            'pending',
            ${JSON.stringify(observerIds)}::jsonb,
            ${followup.investigation_id ?? null}
          )
          ON CONFLICT DO NOTHING
        `);
      }
    }

    // 12. Mark follow-up delivered
    await db.execute(sql`
      UPDATE coach_followups
      SET status = 'delivered',
          notified_at = NOW(),
          updated_at = NOW(),
          payload_json = ${JSON.stringify({ messageId, completionRate: completionResult.completionRate })}::jsonb
      WHERE id = ${followupId}
    `);

    console.log(`[FollowupWorker] Delivered follow-up ${followupId.slice(0, 8)} → message ${messageId.slice(0, 8)}`);

    // 13. Create success memory if warranted (non-blocking)
    if (completionResult.completionRate > 0.5 && successDescription) {
      const planItems = plan.plan_json?.items ?? [];
      const actionSummary = planItems.map((i: any) => i.text).join("; ");
      createSuccessMemory({
        userId: followup.owner_id,
        specialization: "corner",
        sourceMessageId: messageId,
        originalPlanWhy: plan.why,
        actionSummary,
        completionRate: completionResult.completionRate,
        outcomeDescription: successDescription,
        dateRangeStart: planCreatedAt,
        dateRangeEnd: new Date(),
      }).catch((err) => console.warn("[FollowupWorker] Success memory failed:", err.message));
    }

    return messageId;
  } catch (err: any) {
    console.error("[FollowupWorker] processFollowup failed:", err.message);
    // Reset to pending so cron can retry
    await db.execute(sql`
      UPDATE coach_followups
      SET status = 'pending', updated_at = NOW()
      WHERE id = ${followupId}
    `);
    return null;
  }
}

/**
 * Batch process all due follow-ups.
 * Called by the cron job every 10 minutes.
 */
export async function processDueFollowups(): Promise<void> {
  let followups: DueFollowup[];
  try {
    followups = await loadDueFollowups(10);
  } catch (err: any) {
    console.error("[FollowupWorker] Failed to load due followups:", err.message);
    return;
  }

  if (followups.length === 0) return;

  console.log(`[FollowupWorker] Processing ${followups.length} due followup(s)`);

  for (const followup of followups) {
    await processFollowup(followup.id);
  }
}

/**
 * Check if a specific user has a due (undelivered) followup.
 * Returns the followup ID and due date if found.
 */
export async function findDueFollowupForUser(
  userId: string
): Promise<{ id: string; dueAt: string } | null> {
  const r = await db.execute(sql`
    SELECT cf.id, cf.due_at
    FROM coach_followups cf
    JOIN coach_action_plans cap ON cap.id = cf.plan_id
    WHERE cf.owner_id = ${userId}
      AND cf.status = 'pending'
      AND cf.due_at <= NOW()
    ORDER BY cf.due_at ASC
    LIMIT 1
  `);
  if (!r.rows[0]) return null;
  const row = r.rows[0] as unknown as { id: string; due_at: string };
  return { id: row.id, dueAt: row.due_at };
}
