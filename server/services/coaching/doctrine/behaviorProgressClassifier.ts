/**
 * Behavior Progress Classifier
 *
 * Server-side classifier that reads compliance observer output and the
 * coaching context snapshot to produce a BehaviorProgressSignal.
 *
 * IMPORTANT: This describes the EVIDENCE PATTERN — not the person.
 * States like "inconsistent" and "declining" describe what the data shows,
 * not who the user is or what they should feel.
 *
 * MPM classifies behavioral evidence. The LLM does not invent this assessment.
 *
 * Works with or without observer data:
 *   - Full observer outputs → rich classification
 *   - No observer data (Pregnancy Coach, Parent's Corner) → insufficient_evidence
 *     but may still detect recovery from conversation engagement
 */

import type {
  BehaviorProgressSignal,
  CoachingContextSnapshot,
  ObserverOutput,
} from "../../../../shared/coaching/types";

// ─── Finding Extractor ────────────────────────────────────────────────────────

function getNumericFinding(
  observerOutputs: ObserverOutput[],
  observerId: string,
  metric: string
): number | null {
  const output = observerOutputs.find((o) => o.observerId === observerId);
  if (!output) return null;
  const finding = output.findings.find((f) => f.metric === metric);
  if (!finding || finding.value === null || finding.quality === "missing") return null;
  const val = typeof finding.value === "number" ? finding.value : parseFloat(String(finding.value));
  return isNaN(val) ? null : val;
}

function getStringFinding(
  observerOutputs: ObserverOutput[],
  observerId: string,
  metric: string
): string | null {
  const output = observerOutputs.find((o) => o.observerId === observerId);
  if (!output) return null;
  const finding = output.findings.find((f) => f.metric === metric);
  if (!finding || finding.value === null || finding.quality === "missing") return null;
  return String(finding.value);
}

// ─── Recovery Detection ───────────────────────────────────────────────────────
// Detects: returned after a gap, logged today after missing days.

function detectRecovery(
  observerOutputs: ObserverOutput[],
  snapshot: CoachingContextSnapshot | null
): boolean {
  const logDays7d = getNumericFinding(observerOutputs, "compliance", "macro_log_days_7d")
    ?? getNumericFinding(observerOutputs, "compliance", "log_days_7d");
  const logDays30d = getNumericFinding(observerOutputs, "compliance", "macro_log_days_30d");

  // Recovery: monthly participation was genuinely low (< 30% of days = < 9 of 30)
  // AND the person is logging this week (at least 2 days) — they came back.
  // This does NOT fire for someone who is consistently participating.
  if (logDays7d !== null && logDays30d !== null) {
    const weeklyRate = logDays7d / 7;
    const monthlyRate = logDays30d / 30;
    const monthlyWasLow = monthlyRate < 0.30;           // < 9 of 30 days historically
    const recentUptick = weeklyRate > monthlyRate + 0.15; // meaningfully more active recently
    if (monthlyWasLow && recentUptick && logDays7d >= 2) return true;
  }

  // Signal 2: today has a macro log but the prior week was very sparse (≤ 1 day)
  // → logged today after essentially disappearing.
  if (snapshot?.today?.meals) {
    const todayMealCount = snapshot.today.meals.count;
    const hasTodayData = todayMealCount?.status === "observed" && (todayMealCount.value ?? 0) > 0;
    if (hasTodayData && logDays7d !== null && logDays7d <= 1) {
      return true;
    }
  }

  return false;
}

// ─── Behavior Highlights ──────────────────────────────────────────────────────
// Specific positive behaviors visible in the evidence.

function extractBehaviorHighlights(
  observerOutputs: ObserverOutput[],
  snapshot: CoachingContextSnapshot | null,
  logDays7d: number | null,
  calorieAdherence: number | null,
  proteinAdherence: number | null
): string[] {
  const highlights: string[] = [];

  if (logDays7d !== null && logDays7d >= 5) {
    highlights.push(`Logged meals ${logDays7d} of the last 7 days — consistent participation`);
  } else if (logDays7d !== null && logDays7d >= 3) {
    highlights.push(`Logged meals ${logDays7d} of the last 7 days — building consistency`);
  }

  if (proteinAdherence !== null && proteinAdherence >= 90) {
    highlights.push(`Protein target met on ${Math.round(proteinAdherence)}% of logged days`);
  }

  if (calorieAdherence !== null && calorieAdherence >= 90) {
    highlights.push(`Calorie targets followed closely — strong adherence visible`);
  }

  // Check-in participation
  if (snapshot?.today?.checkin) {
    const checkin = snapshot.today.checkin;
    const hasCheckin = ["hunger", "energy", "mood", "stress", "cravings"].some(
      (field) => (checkin as any)[field]?.status === "observed"
    );
    if (hasCheckin) highlights.push("Completed today's check-in — gives me richer context");
  }

  // Restaurant observer — used Restaurant Guide
  const restaurantUsage = getStringFinding(observerOutputs, "restaurant", "guide_used_7d");
  if (restaurantUsage === "true" || restaurantUsage === "yes") {
    highlights.push("Used MPM Restaurant Guide while eating out");
  }

  return highlights;
}

// ─── Behavior Concerns ────────────────────────────────────────────────────────
// Specific gaps in the evidence — described as patterns, not character judgments.

function extractBehaviorConcerns(
  logDays7d: number | null,
  calorieAdherence: number | null,
  proteinAdherence: number | null
): string[] {
  const concerns: string[] = [];

  if (logDays7d !== null && logDays7d < 3) {
    concerns.push(`Logged meals only ${logDays7d} of the last 7 days — not enough data to evaluate the plan`);
  }

  if (calorieAdherence !== null && calorieAdherence < 70) {
    concerns.push(`Calorie adherence has been below target on most logged days`);
  }

  if (proteinAdherence !== null && proteinAdherence < 70) {
    concerns.push(`Protein target has been missed consistently on logged days`);
  }

  return concerns;
}

// ─── Main Classifier ──────────────────────────────────────────────────────────

/**
 * Classify the behavioral evidence pattern for this coaching turn.
 *
 * @param observerOutputs - Evidence from selected observers (may be empty)
 * @param snapshot - CoachingContextSnapshot if available (Phase 1)
 * @returns BehaviorProgressSignal — always returns a valid signal, never throws
 */
export function classifyBehaviorProgress(
  observerOutputs: ObserverOutput[],
  snapshot: CoachingContextSnapshot | null = null
): BehaviorProgressSignal {
  // Extract key signals
  const logDays7d = getNumericFinding(observerOutputs, "compliance", "macro_log_days_7d")
    ?? getNumericFinding(observerOutputs, "compliance", "log_days_7d");
  const logDays30d = getNumericFinding(observerOutputs, "compliance", "macro_log_days_30d");
  const calorieAdherence = getNumericFinding(observerOutputs, "macro", "calorie_adherence_pct_7d");
  const proteinAdherence = getNumericFinding(observerOutputs, "macro", "protein_adherence_pct_7d");
  const weightDataPoints = getNumericFinding(observerOutputs, "weight", "data_points_14d");

  // ── Determine evidence pattern ────────────────────────────────────────────

  let evidencePattern: BehaviorProgressSignal["evidencePattern"];

  if (logDays7d === null && calorieAdherence === null) {
    // No observer data at all
    evidencePattern = "insufficient_evidence";
  } else if (logDays7d !== null && logDays7d < 2) {
    // Very sparse — cannot draw any meaningful pattern
    evidencePattern = "insufficient_evidence";
  } else if (logDays7d !== null && logDays7d >= 5 && (calorieAdherence === null || calorieAdherence >= 80)) {
    // 5+ of 7 days logged, adherence reasonable or unknown
    evidencePattern = "consistent";
  } else if (logDays7d !== null && logDays30d !== null) {
    // Compare recent vs monthly to detect direction
    const weeklyRate = logDays7d / 7;
    const monthlyRate = logDays30d / 30;
    if (weeklyRate > monthlyRate + 0.15) {
      // Recent week significantly better than monthly average
      evidencePattern = "improving";
    } else if (weeklyRate < monthlyRate - 0.15) {
      // Recent week significantly worse than monthly average
      evidencePattern = "declining";
    } else {
      evidencePattern = "inconsistent";
    }
  } else if (logDays7d !== null) {
    // Have weekly data but no monthly comparison
    if (logDays7d >= 4) {
      evidencePattern = "inconsistent"; // Partial — not quite consistent
    } else {
      evidencePattern = "inconsistent";
    }
  } else {
    evidencePattern = "insufficient_evidence";
  }

  // ── Recovery detection ────────────────────────────────────────────────────
  const recoveryDetected = detectRecovery(observerOutputs, snapshot);

  // If recovery is detected and the pattern was declining/insufficient, upgrade to improving
  // (returning to log today after absence is itself an improving behavior signal)
  if (recoveryDetected && (evidencePattern === "declining" || evidencePattern === "insufficient_evidence")) {
    evidencePattern = "improving";
  }

  // ── Behavior highlights & concerns ───────────────────────────────────────
  const behaviorHighlights = extractBehaviorHighlights(
    observerOutputs, snapshot, logDays7d, calorieAdherence, proteinAdherence
  );
  const behaviorConcerns = extractBehaviorConcerns(logDays7d, calorieAdherence, proteinAdherence);

  // ── Additional flags ──────────────────────────────────────────────────────
  const outcomeVisible =
    (weightDataPoints !== null && weightDataPoints >= 3) ||
    (calorieAdherence !== null && logDays7d !== null && logDays7d >= 4);

  const toolUsageDetected =
    getStringFinding(observerOutputs, "restaurant", "guide_used_7d") === "true";

  const checkInParticipation = snapshot
    ? ["hunger", "energy", "mood", "stress", "cravings"].some(
        (field) => (snapshot.today.checkin as any)[field]?.status === "observed"
      )
    : false;

  return {
    evidencePattern,
    recoveryDetected,
    loggingDays7d: logDays7d ?? 0,
    calorieAdherence7d: calorieAdherence,
    proteinAdherence7d: proteinAdherence,
    behaviorHighlights,
    behaviorConcerns,
    outcomeVisible,
    toolUsageDetected,
    checkInParticipation,
  };
}

// ─── Signal Renderer ──────────────────────────────────────────────────────────
// Renders the behavior signal into a string block for the LLM user prompt.

import { EVIDENCE_PATTERN_PLAYBOOKS, RECOVERY_REINFORCEMENT_GUIDANCE } from "./supportiveAccountabilityDoctrine";

// ─── Shared Compliance Query Helper ──────────────────────────────────────────
// Used by coaching surfaces that don't run the full observer pipeline
// (Pregnancy Coach, Parent's Corner). Lightweight — one DB query.

import { db } from "../../../db";
import { sql } from "drizzle-orm";

/**
 * Fetch logging compliance data directly from macro_logs for a user.
 * Returns a minimal ObserverOutput[] compatible with classifyBehaviorProgress().
 * Non-fatal — returns empty array on any error.
 */
export async function fetchComplianceOutputForUser(userId: string): Promise<ObserverOutput[]> {
  try {
    const result = await db.execute<{ log_days_7d: string; log_days_30d: string }>(sql`
      SELECT
        COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC')) FILTER (WHERE at >= NOW() - INTERVAL '7 days')  AS log_days_7d,
        COUNT(DISTINCT DATE(at AT TIME ZONE 'UTC')) FILTER (WHERE at >= NOW() - INTERVAL '30 days') AS log_days_30d
      FROM macro_logs
      WHERE user_id = ${userId}
    `);
    const row = (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : null);
    if (!row) return [];

    const logDays7d  = parseInt(String(row.log_days_7d  ?? "0"));
    const logDays30d = parseInt(String(row.log_days_30d ?? "0"));
    const now = new Date();
    const nowIso = now.toISOString();

    const complianceOutput: ObserverOutput = {
      observerId: "compliance",
      ranAt: now,
      windowsCovered: ["7d", "30d"],
      sourcesQueried: ["macro_logs"],
      findings: [
        { metric: "macro_log_days_7d",  value: logDays7d,  quality: "measured", window: "7d",  source: "macro_logs", observedAt: now },
        { metric: "macro_log_days_30d", value: logDays30d, quality: "measured", window: "30d", source: "macro_logs", observedAt: now },
      ],
    };
    return [complianceOutput];
  } catch (err: any) {
    // Non-fatal — surface proceeds without behavior signal classification
    console.warn("[BehaviorClassifier] Compliance query failed (non-fatal):", err.message);
    return [];
  }
}

/**
 * Convenience: fetch compliance data and return a ready-to-render BehaviorProgressSignal.
 * Safe to call from any coaching route — never throws.
 */
export async function getComplianceBehaviorSignal(userId: string): Promise<BehaviorProgressSignal> {
  const outputs = await fetchComplianceOutputForUser(userId);
  return classifyBehaviorProgress(outputs, null);
}

export function renderBehaviorSignalBlock(signal: BehaviorProgressSignal): string {
  const lines: string[] = [
    "── BEHAVIOR PROGRESS SIGNAL (server-classified from evidence) ──",
    `Evidence pattern:  ${signal.evidencePattern.toUpperCase()}`,
    `Recovery detected: ${signal.recoveryDetected ? "YES — user has returned after a gap" : "no"}`,
    `Logging days (7d): ${signal.loggingDays7d}`,
  ];

  if (signal.calorieAdherence7d !== null) {
    lines.push(`Calorie adherence: ${Math.round(signal.calorieAdherence7d)}% (on logged days)`);
  }
  if (signal.proteinAdherence7d !== null) {
    lines.push(`Protein adherence: ${Math.round(signal.proteinAdherence7d)}% (on logged days)`);
  }

  if (signal.behaviorHighlights.length > 0) {
    lines.push("", "Behavior highlights (specific positives to potentially acknowledge):");
    for (const h of signal.behaviorHighlights) lines.push(`  ✓ ${h}`);
  }

  if (signal.behaviorConcerns.length > 0) {
    lines.push("", "Behavior concerns (address supportively — not as failure):");
    for (const c of signal.behaviorConcerns) lines.push(`  → ${c}`);
  }

  const playbook = EVIDENCE_PATTERN_PLAYBOOKS[signal.evidencePattern];
  if (playbook) {
    lines.push(
      "",
      `Communication approach for "${playbook.label}":`,
      `  ${playbook.communicationApproach}`,
      "",
      `Example language:`,
      `  ${playbook.example}`
    );
  }

  if (signal.recoveryDetected) {
    lines.push(
      "",
      "RECOVERY REINFORCEMENT ACTIVE — reinforce the return:",
      `  ${RECOVERY_REINFORCEMENT_GUIDANCE.example}`
    );
  }

  lines.push("── END BEHAVIOR SIGNAL ──");

  return lines.join("\n");
}
