/**
 * Completion Detector — Phase 5
 *
 * Determines whether action items from a coach_action_plan were completed
 * by checking platform evidence (objective) or user-reported confirmation (subjective).
 *
 * Authority chain:
 *   Safety > Platform Evidence > Knowledge Pattern > Coaching Memory > LLM
 *
 * Rules:
 * - OBJECTIVE completion = platform observed a matching log entry → HIGH confidence
 * - SUBJECTIVE completion = user stated in conversation they did it → MEDIUM confidence
 * - UNKNOWN = no evidence, no report → never treated as failure
 * - Usage events (feature opened) are never treated as consumption
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

export type CompletionSource = "objective" | "subjective" | "unknown";
export type CompletionConfidence = "high" | "medium" | "low";

export interface ItemCompletionResult {
  itemId: string;
  status: "completed" | "unknown";
  source: CompletionSource;
  confidence: CompletionConfidence;
  evidence: string; // human-readable description for the follow-up LLM
}

export interface PlanCompletionResult {
  planId: string;
  userId: string;
  planCreatedAt: Date;
  items: ItemCompletionResult[];
  /** Fraction of items completed (0.0 – 1.0) */
  completionRate: number;
  /** True only if ALL evidence supports completion — do not claim success on partial data */
  allObjectivelyConfirmed: boolean;
}

// ─── Platform log checks ─────────────────────────────────────────────────────

async function checkWaterLogged(userId: string, since: Date): Promise<{ found: boolean; detail: string }> {
  try {
    const r = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) as cnt FROM water_logs
      WHERE user_id = ${userId} AND created_at > ${since.toISOString()}
    `);
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    return { found: cnt > 0, detail: cnt > 0 ? `${cnt} hydration log(s) recorded` : "no hydration logs found" };
  } catch { return { found: false, detail: "hydration data unavailable" }; }
}

async function checkWeightLogged(userId: string, since: Date): Promise<{ found: boolean; detail: string }> {
  try {
    const r = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) as cnt FROM biometric_sample
      WHERE user_id = ${userId} AND type = 'weight' AND start_time > ${since.toISOString()}
    `);
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    return { found: cnt > 0, detail: cnt > 0 ? `${cnt} weight log(s) recorded` : "no weight entries found" };
  } catch { return { found: false, detail: "weight data unavailable" }; }
}

async function checkMealLogged(userId: string, since: Date): Promise<{ found: boolean; detail: string }> {
  try {
    const r = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) as cnt FROM macro_logs
      WHERE user_id = ${userId} AND log_date >= ${since.toISOString()}::date
    `);
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    return { found: cnt > 0, detail: cnt > 0 ? `${cnt} meal log entry(ies) recorded` : "no meal logs found" };
  } catch { return { found: false, detail: "meal log data unavailable" }; }
}

async function checkActivityEvent(
  userId: string,
  since: Date,
  eventTypePattern: string
): Promise<{ found: boolean; detail: string }> {
  try {
    const r = await db.execute<{ cnt: string; event_type: string }>(sql`
      SELECT COUNT(*) as cnt, MAX(event_type) as event_type
      FROM platform_activity_events
      WHERE owner_user_id = ${userId}
        AND event_type LIKE ${eventTypePattern}
        AND occurred_at > ${since.toISOString()}
        AND event_class = 'consumption'
    `);
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    return {
      found: cnt > 0,
      detail: cnt > 0 ? `${cnt} confirmed ${r.rows[0]?.event_type ?? "activity"} event(s)` : `no matching consumption events found`,
    };
  } catch { return { found: false, detail: "activity event data unavailable" }; }
}

// ─── Signal dispatcher ────────────────────────────────────────────────────────

async function checkSignal(
  userId: string,
  since: Date,
  completionSignal: string | null,
  kind: string
): Promise<{ found: boolean; detail: string }> {
  const sig = completionSignal ?? inferSignalFromKind(kind);

  switch (sig) {
    case "water_logged":
      return checkWaterLogged(userId, since);
    case "weight_logged":
      return checkWeightLogged(userId, since);
    case "meal_logged":
    case "macro_logged":
      return checkMealLogged(userId, since);
    case "restaurant_logged":
      return checkActivityEvent(userId, since, "restaurant_meal_%");
    case "beverage_logged":
      return checkActivityEvent(userId, since, "beverage_added_%");
    case "exercise_logged":
      return checkActivityEvent(userId, since, "exercise_%");
    default:
      // 'self_reported' and 'unknown' → no objective check available
      return { found: false, detail: "objective signal not available for this action type" };
  }
}

function inferSignalFromKind(kind: string): string {
  switch (kind) {
    case "drink":   return "water_logged";
    case "weigh":   return "weight_logged";
    case "eat":
    case "log":     return "meal_logged";
    case "avoid":   return "meal_logged"; // best proxy
    default:        return "unknown";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface ActionItemRow {
  id: string;
  kind: string;
  horizon: string;
  text: string;
  completion_signal: string | null;
  status: string;
  completion_source: string | null;
  completion_confidence: string | null;
}

/**
 * Detect objective completion for all items in a plan.
 * Items already subjectively completed are preserved.
 * Unknown items are left as unknown — never marked as failed.
 */
export async function detectPlanCompletion(
  planId: string,
  userId: string,
  planCreatedAt: Date
): Promise<PlanCompletionResult> {
  const itemRows = await db.execute(sql`
    SELECT id, kind, horizon, text, completion_signal, status, completion_source, completion_confidence
    FROM coach_action_items
    WHERE plan_id = ${planId}
    ORDER BY sequence ASC
  `);

  const results: ItemCompletionResult[] = [];

  for (const item of itemRows.rows as unknown as ActionItemRow[]) {
    // Already subjectively or objectively completed — respect existing signal
    if (item.status === "completed" && item.completion_source) {
      results.push({
        itemId: item.id,
        status: "completed",
        source: item.completion_source as CompletionSource,
        confidence: (item.completion_confidence as CompletionConfidence) ?? "medium",
        evidence: `Previously marked completed (${item.completion_source})`,
      });
      continue;
    }

    // Try objective check
    const { found, detail } = await checkSignal(
      userId,
      planCreatedAt,
      item.completion_signal,
      item.kind
    );

    if (found) {
      // Update DB
      await db.execute(sql`
        UPDATE coach_action_items
        SET status = 'completed',
            completion_source = 'objective',
            completion_confidence = 'high',
            completed_at = NOW()
        WHERE id = ${item.id}
      `);
      results.push({
        itemId: item.id,
        status: "completed",
        source: "objective",
        confidence: "high",
        evidence: detail,
      });
    } else {
      // Unknown — never assumed failure
      results.push({
        itemId: item.id,
        status: "unknown",
        source: "unknown",
        confidence: "low",
        evidence: detail,
      });
    }
  }

  const completed = results.filter((r) => r.status === "completed");
  const allObjective = completed.length > 0 && completed.every((r) => r.source === "objective");

  return {
    planId,
    userId,
    planCreatedAt,
    items: results,
    completionRate: results.length > 0 ? completed.length / results.length : 0,
    allObjectivelyConfirmed: allObjective,
  };
}

/**
 * Mark an action item as subjectively completed.
 * Called when the user explicitly reports completion in conversation.
 * Idempotent — won't downgrade an objective high-confidence completion.
 */
export async function markSubjectiveCompletion(itemId: string): Promise<void> {
  await db.execute(sql`
    UPDATE coach_action_items
    SET status = 'completed',
        completion_source = COALESCE(completion_source, 'subjective'),
        completion_confidence = CASE
          WHEN completion_source = 'objective' THEN completion_confidence
          ELSE 'medium'
        END,
        completed_at = COALESCE(completed_at, NOW())
    WHERE id = ${itemId}
      AND status != 'completed'
  `);
}
