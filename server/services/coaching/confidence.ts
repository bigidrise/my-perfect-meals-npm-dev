/**
 * Coaching Engine — Confidence Scorer
 *
 * The server — not the LLM — determines confidence level.
 * The LLM's proposed confidence is accepted as input but NEVER the final answer.
 *
 * Scoring logic:
 *   high     = evidence coverage ≥90% AND no cross-observer conflict
 *   moderate = evidence coverage ≥67% AND no conflict
 *   low      = coverage <67% OR any cross-observer conflict detected
 *
 * When confidence is low:
 *   - Causal language is suppressed ("this is causing" → "this may suggest")
 *   - General educational content is REQUIRED (see three-level evidence doctrine)
 *   - Up to 2 action items; at least 1 must be substantive (eat/drink/other), not just logging
 *   - Learning opportunity is mandatory (what logging would personalize the next answer)
 *
 * The LLM cannot upgrade confidence. It can only propose a level that the
 * server may downgrade further if evidence doesn't support it.
 */

import type {
  ObserverOutput,
  MatchedPattern,
  ConfidenceAssessment,
  ConfidenceLevel,
  Evidence,
} from "../../../shared/coaching/types";

// Thresholds are implementation parameters, not clinical facts.
// Tunable per review but changes require documenting the reasoning.
const HIGH_COVERAGE_THRESHOLD = 0.9;
const MODERATE_COVERAGE_THRESHOLD = 0.67;

/**
 * Score confidence from the Observer evidence and matched patterns.
 *
 * @param observerOutputs - All Observer outputs from this investigation
 * @param patterns - Matched knowledge patterns (may be empty if no pattern matched)
 * @param llmProposedConfidence - The LLM's proposed confidence (may be downgraded)
 */
export function scoreConfidence(
  observerOutputs: ObserverOutput[],
  patterns: MatchedPattern[],
  llmProposedConfidence?: ConfidenceLevel
): ConfidenceAssessment {
  const allEvidence = observerOutputs.flatMap((o) => o.findings);

  // If no patterns matched and no evidence, confidence is low
  if (patterns.length === 0 && allEvidence.length === 0) {
    return {
      level: "low",
      coverageScore: 0,
      evidenceSatisfied: [],
      evidenceMissing: [],
      hasConflict: false,
      suppressCausal: true,
    };
  }

  // If patterns matched, use the best-coverage pattern's requirements
  if (patterns.length > 0) {
    const best = patterns[0]; // Already sorted by coverage score desc
    const coverageScore = best.coverageScore;
    const hasConflict = detectObserverConflict(allEvidence);

    let level: ConfidenceLevel;
    if (coverageScore >= HIGH_COVERAGE_THRESHOLD && !hasConflict) {
      level = "high";
    } else if (coverageScore >= MODERATE_COVERAGE_THRESHOLD && !hasConflict) {
      level = "moderate";
    } else {
      level = "low";
    }

    // Server can only downgrade from LLM's proposal, never upgrade
    level = downgrade(level, llmProposedConfidence);

    return {
      level,
      coverageScore,
      evidenceSatisfied: best.evidenceSatisfied,
      evidenceMissing: best.evidenceMissing,
      hasConflict,
      conflictDescription: hasConflict ? describeConflict(allEvidence) : undefined,
      suppressCausal: level !== "high",
    };
  }

  // Evidence exists but no pattern matched (general inquiry)
  // Confidence is low — we have data but no approved interpretation framework
  const coverageScore = allEvidence.filter((e) => e.quality !== "missing").length / Math.max(allEvidence.length, 1);
  const hasConflict = detectObserverConflict(allEvidence);

  return {
    level: "low",
    coverageScore,
    evidenceSatisfied: allEvidence
      .filter((e) => e.quality !== "missing")
      .map((e) => `${e.observer}.${e.metric}`),
    evidenceMissing: allEvidence
      .filter((e) => e.quality === "missing")
      .map((e) => `${e.observer}.${e.metric}`),
    hasConflict,
    conflictDescription: hasConflict ? describeConflict(allEvidence) : undefined,
    suppressCausal: true,
  };
}

/** Server can only downgrade — never upgrade — the LLM's proposed confidence */
function downgrade(serverLevel: ConfidenceLevel, llmProposed?: ConfidenceLevel): ConfidenceLevel {
  if (!llmProposed) return serverLevel;
  const rank: Record<ConfidenceLevel, number> = { high: 2, moderate: 1, low: 0 };
  return rank[serverLevel] <= rank[llmProposed] ? serverLevel : serverLevel;
}

/**
 * Detect conflicts across Observer outputs.
 * Example: Weight Observer shows downward trend but Compliance Observer shows
 * very low logging recency — data may not reflect reality.
 */
function detectObserverConflict(evidence: Evidence[]): boolean {
  // Conflict: weight trending down but logging is very sparse
  const weightDown = evidence.some(
    (e) => e.observer === "weight" && e.metric === "recent_trend" && e.trend === "down"
  );
  const loggingMissing = evidence.some(
    (e) => e.observer === "compliance" && e.metric === "logging_recency" && e.quality === "missing"
  );
  if (weightDown && loggingMissing) return true;

  // Conflict: intake appears fine but energy/weight signals suggest otherwise
  const intakeOk = evidence.some(
    (e) => e.observer === "macro" && e.metric === "intake_vs_goal" && e.quality !== "missing"
  );
  const weightUp = evidence.some(
    (e) => e.observer === "weight" && e.trend === "up"
  );
  if (intakeOk && weightUp) return true;

  return false;
}

function describeConflict(evidence: Evidence[]): string {
  return "Some of the data signals appear to be pointing in different directions. " +
    "This makes it harder to draw a clear conclusion — more consistent logging would help.";
}

/**
 * Apply confidence-based restrictions to the rendering pass prompt.
 * Low confidence → no causal language, max 1 action, mandatory learning opportunity.
 */
export function getConfidenceInstructions(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return [
        "Confidence is HIGH. You may use direct language grounded in the evidence.",
        "You may note connections between observations, but do not assert causation unless the pattern template explicitly permits it.",
        "Up to 3 action items are appropriate.",
      ].join(" ");
    case "moderate":
      return [
        "Confidence is MODERATE. Use hedged language: 'this may suggest', 'one possibility is', 'worth exploring'.",
        "Avoid phrases like 'this is causing', 'because of', 'definitely'.",
        "Up to 2 action items are appropriate.",
      ].join(" ");
    case "low":
      return [
        "Confidence is LOW — the platform has limited data about this user today.",
        "DOCTRINE: Insufficient data is a limitation on PERSONALIZATION, not a reason to withhold useful coaching.",
        "You MUST still give general educational content about the topic.",
        "Language rule: use 'in general', 'this can sometimes be associated with', 'generally speaking', 'one common reason is'.",
        "Do NOT use language like 'I want to look into this more' or 'let me gather more information' as the primary response — that leaves the user empty-handed.",
        "Do NOT assert personalized causation ('this is causing YOUR fatigue'). General associations are fine ('low energy can sometimes show up when carb intake drops').",
        "whatItCouldMean MUST enumerate the general nutritional possibilities for this topic — do not leave it as a vague placeholder.",
        "Today's Plan: up to 2 items. At least one must be a substantive action (eat, drink, or other). A logging item may be the second item but must NOT be the only item.",
        "The Learning Opportunity section is MANDATORY — what specific logging would make the next answer personalized?",
      ].join("\n");
  }
}
